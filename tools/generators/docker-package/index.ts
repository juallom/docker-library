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
};

export default async function (tree: Tree, schema: Schema) {
  await npmPackageGenerator(tree, { name: schema.name });
  const packageRoot = readProjectConfiguration(tree, schema.name).root;

  // Remove unnecessary files
  tree.delete(`${packageRoot}/index.js`);
  tree.delete(`${packageRoot}/package.json`);

  // Add project configuration
  const config: ProjectConfiguration = {
    name: schema.name,
    root: packageRoot,
    targets: {
      publish: {
        executor: '@nx-tools/nx-docker:build',
        options: {
          push: true,
          'cache-from': [
            `type=registry,ref=ghcr.io/juallom/${schema.name}:buildcache`,
          ],
          'cache-to': [
            `type=registry,ref=ghcr.io/juallom/${schema.name}:buildcache,mode=max`,
          ],
          metadata: {
            images: [
              `juallom/${schema.name}`,
              `ghcr.io/juallom/${schema.name}`,
            ],
            tags: [
              'type=schedule',
              'type=semver,pattern={{version}}',
              'type=semver,pattern={{major}}.{{minor}}',
              'type=semver,pattern={{major}}',
              'type=sha',
            ],
          },
        },
      },
    },
  };
  updateProjectConfiguration(tree, schema.name, config);

  await formatFiles(tree);
  generateFiles(
    tree,
    joinPathFragments(__dirname, './files'),
    packageRoot,
    schema
  );
  return () => {
    exec(`git add ${packageRoot}/Dockerfile ${packageRoot}/project.json`);
  };
}
