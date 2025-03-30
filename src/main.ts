import { App, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as cdk from "aws-cdk-lib";

export class StaticWebsiteStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps = {}) {
    super(scope, id, props);
    // S3バケットの作成
    const websiteBucket = new s3.Bucket(this, "WebsiteBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY, // スタック削除時にバケットを削除
      autoDeleteObjects: true, // バケット内のオブジェクトも削除
    });

    // CloudFrontディストリビューションの作成
    const distribution = new cloudfront.Distribution(
      this,
      "WebsiteDistribution",
      {
        defaultRootObject: "index.html",
        defaultBehavior: {
          origin: origins.S3BucketOrigin.withOriginAccessControl(websiteBucket),
        },
      },
    );

    // デプロイ後の出力
    new cdk.CfnOutput(this, "BucketURL", {
      value: websiteBucket.bucketWebsiteUrl,
      description: "S3 Bucket URL",
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

new StaticWebsiteStack(app, "hema-introduction-dev", { env: devEnv });
// new MyStack(app, 'hema-introduction-prod', { env: prodEnv });

app.synth();
