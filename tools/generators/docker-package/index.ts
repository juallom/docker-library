import { exec } from 'child_process';

import {
  Tree,
  formatFiles,
  readProjectConfiguration,
  generateFiles,
  joinPathFragments,
  updateProjectConfiguration,
  ProjectConfiguration,
} from '@nrwl/devkit';
import { npmPackageGenerator } from '@nrwl/workspace/generators';

type Schema = {
  name: string;
  from: string;
  description: string;
  github_token: string;
  version?: string;
};

export default async function (tree: Tree, schema: Schema) {
  const { name, github_token, version } = schema;
  await npmPackageGenerator(tree, { name });
  const packageRoot = readProjectConfiguration(tree, name).root;

  // Remove unnecessary files
  tree.delete(`${packageRoot}/index.js`);
  tree.delete(`${packageRoot}/package.json`);

  // Add project configuration
  const config: ProjectConfiguration = {
    name,
    root: packageRoot,
    targets: {
      publish: {
        executor: '@nx-tools/nx-docker:build',
        options: {
          push: true,
          'cache-from': [
            `type=registry,ref=ghcr.io/juallom/${name}:buildcache`,
          ],
          'cache-to': [
            `type=registry,ref=ghcr.io/juallom/${name}:buildcache,mode=max`,
          ],
          metadata: {
            images: [`ghcr.io/juallom/${name}`],
            tags: [
              'type=schedule',
              `type=match,pattern=${name}_(.*),group=1`,
              `type=match,pattern=${name}_(\\d.\\d),group=1`,
              `type=match,pattern=${name}_(\\d),group=1`,
              'type=sha',
              'type=raw,value=latest',
            ],
          },
        },
      },
    },
  };
  updateProjectConfiguration(tree, name, config);

  await formatFiles(tree);
  generateFiles(tree, joinPathFragments(__dirname, './files'), packageRoot, {
    ...schema,
    created: new Date().toISOString(),
    version: version || '1.0.0-alpha',
  });
  return () => {
    const ENV = `ROOT=${packageRoot} SCHEMA_NAME=${name} TOKEN=${github_token} VERSION=${version}`;
    exec(
      `${ENV} tools/generators/docker-package/init`,
      (err, stdout, stderr) => {
        if (err) {
          console.error(err);
        } else {
          console.log(`stdout: ${stdout}`);
          console.log(`stderr: ${stderr}`);
        }
      }
    );
  };
}
