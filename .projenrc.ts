import { awscdk, YamlFile } from 'projen';
const project = new awscdk.AwsCdkTypeScriptApp({
  cdkVersion: '2.1.0',
  defaultReleaseBranch: 'main',
  name: 'hema-introduction',
  projenrcTs: true,

  // deps: [],                /* Runtime dependencies of this module. */
  // description: undefined,  /* The description is just a string that helps people understand the purpose of the package. */
  // devDeps: [],             /* Build dependencies for this module. */
  // packageName: undefined,  /* The "name" in package.json. */
});
project.addDeps('cdk-nag');
project.gitignore.addPatterns('docs');

project.tryRemoveFile('.github/workflows/build.yml');
project.tryRemoveFile('.github/workflows/upgrade.yml');
project.tryRemoveFile('.github/workflows/pull-request-lint.yml');

new YamlFile(project, '.github/workflows/check-workflows.yml', {
  obj: {
    name: 'Check workflow files',
    on: {
      workflow_call: {},
    },
    permissions: {
      contents: 'read',
    },
    jobs: {
      build: {
        'runs-on': 'ubuntu-latest',
        'steps': [
          {
            name: 'Checkout',
            uses: 'actions/checkout@v4',
          },
          {
            name: 'Install actionlint',
            run: 'GOBIN=$(pwd) go install github.com/rhysd/actionlint/cmd/actionlint@latest',
          },
          {
            name: 'Run actionlint',
            run: './actionlint',
          },
        ],
      },
    },
  },
});

new YamlFile(project, '.github/workflows/push.yml', {
  obj: {
    name: 'push',
    on: {
      push: {
        'branches-ignore': ['main'],
      },
    },
    concurrency: {
      'group': '${{ github.workflow }}-${{ github.ref }}',
      'cancel-in-progress': true,
    },
    permissions: {
      'contents': 'read',
      'id-token': 'write',
    },
    jobs: {
      'check-workflows': {
        permissions: {
          contents: 'read',
        },
        uses: './.github/workflows/check-workflows.yml',
      },
      'test': {
        needs: 'check-workflows',
        secrets: 'inherit',
        uses: './.github/workflows/test.yml',
      },
    },
  },
});

new YamlFile(project, '.github/workflows/test.yml', {
  obj: {
    name: 'test',
    on:
      'workflow_call',
    env: {
      CDK_DEFAULT_ACCOUNT: 'example-account',
      CDK_DEFAULT_REGION: 'ap-northeast-1',
    },
    jobs: {
      test: {
        'runs-on': 'ubuntu-latest',
        'steps': [
          {
            name: 'Checkout',
            uses: 'actions/checkout@v4',
          },
          {
            uses: 'actions/setup-node@v4',
            with: {
              'node-version': '22',
              'cache': 'yarn',
              'cache-dependency-path': 'yarn.lock',
            },
          },
          {
            run: 'yarn install',
          },
          {
            name: 'Check format by Prettier',
            run: 'npx prettier src test --check',
          },
          {
            name: 'Check by ESLint',
            run: 'yarn eslint',
          },
          {
            name: 'Tests',
            run: 'yarn test',
          },
          {
            name: 'Check docs',
            run: 'npx typedoc --validation src/*.ts',
          },
        ],
      },
    },
  },
});

new YamlFile(project, '.github/workflows/pull-request.yml', {
  obj: {
    name: 'pull request',
    on: {
      pull_request: {
        types: ['opened', 'reopened', 'review_requested', 'synchronize'],
      },
    },
    concurrency: {
      'group': '${{ github.workflow }}-${{ github.ref }}',
      'cancel-in-progress': true,
    },
    jobs: {
      'check-workflows': {
        permissions: {
          contents: 'read',
        },
        uses: './.github/workflows/check-workflows.yml',
      },
      'test': {
        needs: 'check-workflows',
        permissions: {
          contents: 'read',
        },
        secrets: 'inherit',
        uses: './.github/workflows/test.yml',
      },
      // 'cdk-diff-comment': {
      //   needs: 'check-workflows',
      //   if: "github.actor != 'dependabot[bot]'",
      //   permissions: {
      //     'id-token': 'write',
      //     contents: 'write',
      //     'pull-requests': 'write',
      //   },
      //   secrets: 'inherit',
      //   uses: './.github/workflows/post-cdk-diff.yml',
      // },
      // 'auto-merge-dependabot-pr': {
      //   needs: ['test'],
      //   if: "github.actor == 'dependabot[bot]'",
      //   'runs-on': 'ubuntu-latest',
      //   permissions: {
      //     contents: 'write',
      //     'pull-requests': 'write',
      //   },
      //   steps: [
      //     {
      //       uses: 'actions/checkout@v4',
      //     },
      //     {
      //       run: 'gh pr merge "${GITHUB_HEAD_REF}" --squash --auto',
      //       env: {
      //         GITHUB_TOKEN: '${{ secrets.GITHUB_TOKEN }}',
      //       },
      //     },
      //   ],
      // },
    },
  },
});

// Deploy to AWS
new YamlFile(project, '.github/workflows/push-main.yml', {
  obj: {
    name: 'push',
    on: {
      push: {
        branches: ['main'],
      },
    },
    concurrency: {
      'group': '${{ github.workflow }}-${{ github.ref }}',
      'cancel-in-progress': true,
    },
    permissions: {
      contents: 'read',
    },
    jobs: {
      'check-workflows': {
        permissions: {
          contents: 'read',
        },
        uses: './.github/workflows/check-workflows.yml',
      },
      'deploy': {
        needs: 'check-workflows',
        permissions: {
          'contents': 'read',
          'id-token': 'write',
        },
        secrets: 'inherit',
        uses: './.github/workflows/deploy.yml',
      },
    },
  },
});

// Deploy to AWS
new YamlFile(project, '.github/workflows/deploy.yml', {
  obj: {
    name: 'deploy',
    on:
      'workflow_call',
    permissions: {
      'contents': 'read',
      'id-token': 'write',
    },
    jobs: {
      deploy: {
        'runs-on': 'ubuntu-latest',
        steps: [
          {
            uses: 'aws-actions/configure-aws-credentials@v4',
            with: {
              'role-to-assume': 'arn:aws:iam::${{ secrets.AWS_ID }}:role/${{ secrets.ROLE_NAME }}',
              'role-session-name': 'gh-oidc-${{ github.run_id }}-${{ github.run_attempt }}',
              'aws-region': '${{ secrets.AWS_REGION }}',
            },
          },
          {
            name: 'Checkout',
            uses: 'actions/checkout@v4',
          },
          {
            uses: 'actions/setup-node@v4',
            with: {
              'node-version': '22',
              'cache': 'yarn',
              'cache-dependency-path': 'yarn.lock',
            },
          },
          {
            run: 'yarn install',
          },
          {
            name: 'Set environment variables',
            run: `
              echo CDK_DEFAULT_REGION="\${{ secrets.AWS_REGION }}" >> "$GITHUB_ENV" &&
              echo CDK_DEFAULT_ACCOUNT="\${{ secrets.AWS_ID }}" >> "$GITHUB_ENV"
            `,
          },
          {
            name: 'Deploy EcsDeployPipeline Stack',
            run: 'npx cdk deploy --require-approval never --outputs-file cdk-outputs-ecs-deploy.json aws-cobol-cicd-example-dev-ecs-pipeline',
          },
        ],
      },
    },
  },
});


project.synth();