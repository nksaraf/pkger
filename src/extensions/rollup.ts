import { getRelativePath } from './path';
import { getOutputPath, paths, str, safePackageName } from '../utils';
import { createTask, PROCESS, Task, createParallelTask, list } from './task';
import { PackageOptions, Toolbox } from '../types';
import { createRollupTask, getRollupConfigs } from '../builders/rollup';
import path from 'path';
import fs from 'fs-extra';
import { GluegunToolbox } from 'gluegun';
import { typescriptTask } from '../builders/tsc';

export function cjsEntryFile(name: string) {
  const baseLine = `module.exports = require('./`;
  return `
'use strict'

if (process.env.NODE_ENV === 'production') {
  ${baseLine}production/${name}.js')
} else {
  ${baseLine}development/${name}.js')
}
`;
}

function addBin(pkg: PackageOptions) {
  return (pkgJson: PackageOptions & any) => {
    const outputPath = getOutputPath({
      ...pkg,
      outputFormat: 'cjs',
    });
    return {
      ...pkgJson,
      bin: {
        ...pkgJson['bin'],
        [pkg.cmd || safePackageName(pkg.name)]: getRelativePath(
          process.cwd(),
          outputPath
        ),
      },
    };
  };
}

function ensureInFiles(entryName: string) {
  return (pkgJson: { [x: string]: any }) => {
    const { files = [], ...other } = pkgJson;
    if (!files.some((f: any) => f === entryName)) {
      files.push(entryName);
    }
    return {
      ...other,
      files,
    };
  };
}

function transformPackageJsonTask(pkg: PackageOptions, transforms: any[] = []) {
  const { packages, ...root } = pkg;
  const transform = (pkgJson: any) => {
    for (var t of [
      ...[
        // add types for 'types'
        // make sure files has everythin
        // add module for 'esm'
        root.format.includes('esm') &&
          ((p: any) => ({
            ...p,
            module: getRelativePath(
              process.cwd(),
              getOutputPath({ ...root, outputFormat: 'esm' })
            ),
          })),
        root.format.includes('umd') &&
          ((p: any) => ({
            ...p,
            browser: getRelativePath(
              process.cwd(),
              getOutputPath({ ...root, outputFormat: 'umd' })
            ),
          })),
        root.target.includes('browser') &&
          ((p: any) => ({
            ...p,
            browser: getRelativePath(
              process.cwd(),
              getOutputPath({ ...root, outputFormat: 'esm' })
            ),
          })),
        root.format.includes('cjs') &&
          ((p: any) => ({
            ...p,
            main: getRelativePath(
              process.cwd(),
              getOutputPath({ ...root, outputFormat: 'cjs', env: 'production' })
            ),
          })),
        (p: any) => ({
          ...p,
          types:
            pkg.tsconfigContents.compilerOptions['declarationDir'] ||
            'dist/types',
        }),
        (p) => ({
          ...p,
          exports: {
            '.': exportMapForPackage(root),
            ...Object.fromEntries(
              packages.map((pkg) => [
                './' + pkg.entryName,
                exportMapForPackage(pkg),
              ])
            ),
            './package.json': './package.json',
            './': './',
          },
        }),
        // add bin for 'cli'
        // ...[entries, root]
        //   .filter((entry) => entry.target === 'cli')
        //   .map((pkg) => addBin(pkg)),
        ...packages
          .filter((entry) => entry.target !== 'cli')
          .map((pkg: { cmd: any; entryName: string }) =>
            ensureInFiles(pkg.entryName)
          ),
        ensureInFiles('dist'),
        ensureInFiles(
          pkg.tsconfigContents.compilerOptions['declarationDir'] || 'dist/types'
        ),
      ].filter(Boolean),
      ...transforms,
    ]) {
      if (t) {
        pkgJson = t(pkgJson);
      }
    }
    return pkgJson;
  };

  return createTask('package.json', { taskType: PROCESS.FIX }, async () => {
    const json = await fs.readJson(paths.packageJson);
    const transformed = transform(json);
    await fs.writeFile(paths.packageJson, JSON.stringify(transformed, null, 2));
  });
}

type TaskPlugin = (pkg: PackageOptions) => Task[] | Task | undefined;

const cjsEntryTask: TaskPlugin = (pkg) => {
  if (pkg.format.includes('cjs')) {
    return [
      createTask(
        str(pkg.name, 'cjs', 'entry'),
        { taskType: PROCESS.WRITE },
        async () => {
          const outputPath = getOutputPath({ ...pkg, outputFormat: 'cjs' });
          await fs.outputFile(
            outputPath,
            cjsEntryFile(pkg.entryName || pkg.name)
          );
        }
      ),
    ];
  }
};

const subPackageFolderTask: TaskPlugin = (pkg) => {
  return (
    !pkg.root &&
    pkg.target !== 'cli' &&
    createTask(
      str(pkg.name, 'package.json'),
      { taskType: PROCESS.FIX },
      async () => {
        fs.mkdirp(path.join(process.cwd(), pkg.entryName));
        const packageJson = {
          name: pkg.name,
          private: true,
          ...(pkg.format.includes('cjs')
            ? {
                main: getRelativePath(
                  path.join(process.cwd(), pkg.entryName),
                  getOutputPath({ ...pkg, outputFormat: 'cjs' })
                ),
              }
            : {}),
          ...(pkg.format.includes('esm')
            ? {
                module: getRelativePath(
                  path.join(process.cwd(), pkg.entryName),
                  getOutputPath({ ...pkg, outputFormat: 'esm' })
                ),
              }
            : {}),
          types:
            '../' +
            (pkg.tsconfigContents.compilerOptions['declarationDir'] ||
              'dist/types'),
        };
        await fs.writeFile(
          path.join(process.cwd(), pkg.entryName, 'package.json'),
          JSON.stringify(packageJson, null, 2)
        );
      }
    )
  );
};

declare module 'gluegun' {
  interface GluegunBuilders {
    rollup: (pkg: PackageOptions, toolbox: Toolbox) => Task[];
  }

  interface Toolbox extends GluegunToolbox {
    build: GluegunBuilders;
  }
}

const buildPackage = (pkg: PackageOptions) => {
  return createParallelTask(
    pkg.name,
    list(
      getRollupConfigs(pkg).map(createRollupTask),
      cjsEntryTask(pkg),
      subPackageFolderTask(pkg)
    ),
    { taskType: PROCESS.COMPILE }
  );
};

export default (toolbox: Toolbox) => {
  toolbox.build = toolbox.build ?? ({} as any);
  toolbox.build.rollup = (pkg: PackageOptions, toolbox: Toolbox) => {
    return list(
      buildPackage(pkg),
      ...pkg.packages.map((pkg) => buildPackage(pkg)),
      transformPackageJsonTask(pkg, []),
      pkg.typecheck && typescriptTask(pkg)
    );
  };
};

function exportMapForPackage(pkg: PackageOptions) {
  return {
    import: getRelativePath(
      process.cwd(),
      getOutputPath({ ...pkg, outputFormat: 'esm' })
    ),
    browser: getRelativePath(
      process.cwd(),
      getOutputPath({ ...pkg, outputFormat: 'esm' })
    ),
    require: getRelativePath(
      process.cwd(),
      getOutputPath({ ...pkg, outputFormat: 'cjs', env: 'production' })
    ),
    node: getRelativePath(
      process.cwd(),
      getOutputPath({ ...pkg, outputFormat: 'cjs', env: 'production' })
    ),
    default: getRelativePath(
      process.cwd(),
      getOutputPath({ ...pkg, outputFormat: 'esm' })
    ),
  };
}
