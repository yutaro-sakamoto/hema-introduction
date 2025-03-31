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

project.tryRemoveFile('.github/workflows/build.yml');
project.tryRemoveFile('.github/workflows/upgrade.yml');

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

project.synth();