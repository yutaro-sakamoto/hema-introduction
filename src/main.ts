import { App, Stack, StackProps } from "aws-cdk-lib";
import * as cdk from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3 from "aws-cdk-lib/aws-s3";
import { AwsSolutionsChecks, NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";

export class StaticWebsiteStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps = {}) {
    super(scope, id, props);
    // S3バケットの作成

    const accessLogBucket = new s3.Bucket(this, "AccessLogBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY, // スタック削除時にバケットを削除
      autoDeleteObjects: true, // バケット内のオブジェクトも削除
      enforceSSL: true, // SSLを強制
      lifecycleRules: [
        {
          expiration: cdk.Duration.days(3), // 3日後にオブジェクトを削除
        },
      ],
    });

    const websiteBucket = new s3.Bucket(this, "WebsiteBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY, // スタック削除時にバケットを削除
      autoDeleteObjects: true, // バケット内のオブジェクトも削除
      enforceSSL: true, // SSLを強制
      serverAccessLogsBucket: accessLogBucket, // アクセスログを保存するバケット
    });

    // CloudFrontディストリビューションの作成
    const distribution = new cloudfront.Distribution(
      this,
      "WebsiteDistribution",
      {
        defaultRootObject: "index.html",
        defaultBehavior: {
          origin: origins.S3BucketOrigin.withOriginAccessControl(websiteBucket),
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        },
        minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
        sslSupportMethod: cloudfront.SSLMethod.SNI,
        enableLogging: true,
        logBucket: accessLogBucket,
        logIncludesCookies: true,
        logFilePrefix: "cloudfront-logs/",
      },
    );

    NagSuppressions.addResourceSuppressions(distribution, [
      {
        id: "AwsSolutions-CFR4",
        reason: "CloudFront Distribution uses the default CloudFront viewer",
      },
    ]);

    // distフォルダの内容をS3バケットにデプロイ
    new s3deploy.BucketDeployment(this, "DeployWebsite", {
      sources: [s3deploy.Source.asset("dist")],
      destinationBucket: websiteBucket,
      distribution,
      distributionPaths: ["/*"],
    });

    new cdk.CfnOutput(this, "CloudFrontURL", {
      value: distribution.distributionDomainName,
      description: "CloudFront Distribution URL",
    });
  }
}

// for development, use account/region from cdk cli
const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const app = new App();

const stack = new StaticWebsiteStack(app, "hema-introduction-dev", {
  env: devEnv,
});
cdk.Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));
NagSuppressions.addStackSuppressions(stack, [
  { id: "AwsSolutions-IAM5", reason: "Allow IAM policies to contain *" },
  { id: "AwsSolutions-IAM4", reason: "Allow using managed policies" },
  {
    id: "AwsSolutions-L1",
    reason: "Allow to use lambda functions deployed by s3deploy",
  },
]);
app.synth();
