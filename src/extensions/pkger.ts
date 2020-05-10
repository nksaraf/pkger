import {
  getOutputPath,
  safePackageName,
  paths,
  str,
  runCommand,
} from '../utils';
import fs from 'fs-extra';
import { getRelativePath } from './path';
import { createTask, PROCESS, createParallelTask } from './task';
import path, { PlatformPath } from 'path';
import { getRollupConfigs, createRollupTask } from './rollup';
import { flatten } from 'lodash';
import { Toolbox, GluegunToolbox } from 'gluegun';

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

function addBin(pkg: { cmd: any; name: string }) {
  return (pkgJson: { [x: string]: any }) => {
    const outputPath = getOutputPath({
      ...pkg,
      format: 'cjs',
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

function transformPackageJsonTask(options, transforms: any[] = []) {
  const { entries, ...root } = options;
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
              getOutputPath({ ...root, format: 'esm' })
            ),
          })),
        root.target === 'browser' &&
          ((p: any) => ({
            ...p,
            browser: getRelativePath(
              process.cwd(),
              getOutputPath({ ...root, format: 'esm' })
            ),
          })),
        root.format.includes('cjs') &&
          ((p: any) => ({
            ...p,
            main: getRelativePath(
              process.cwd(),
              getOutputPath({ ...root, format: 'cjs' })
            ),
          })),
        (p: any) => ({
          ...p,
          types:
            options.tsconfigContents.compilerOptions['declarationDir'] ||
            'dist/types' ||
            'dist/types',
        }),
        // add bin for 'cli'
        ...[entries, root]
          .filter((entry) => entry.target === 'cli')
          .map((pkg) => addBin(pkg)),
        ...entries
          .filter((entry: { target: string }) => entry.target !== 'cli')
          .map((pkg: { cmd: any; entryName: string }) =>
            ensureInFiles(pkg.entryName)
          ),
        ensureInFiles('dist'),
        ensureInFiles(
          options.tsconfigContents.compilerOptions['declarationDir'] ||
            'dist/types'
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

export function nonRollupTasks(pkg) {
  const { format } = pkg;
  return [
    format.includes('cjs') &&
      createTask(
        str(pkg.name, 'cjs', 'entry'),
        { taskType: PROCESS.WRITE },
        async () => {
          const outputPath = getOutputPath({ ...pkg, format: 'cjs' });
          await fs.outputFile(
            outputPath,
            cjsEntryFile(pkg.entryName || pkg.name)
          );
        }
      ),
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
                    getOutputPath({ ...pkg, format: 'cjs' })
                  ),
                }
              : {}),
            ...(pkg.format.includes('esm')
              ? {
                  module: getRelativePath(
                    path.join(process.cwd(), pkg.entryName),
                    getOutputPath({ ...pkg, format: 'esm' })
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
      ),
  ].filter(Boolean);
}

export function packageTasks(pkg: any) {
  return createParallelTask(
    pkg.name,
    [
      ...getRollupConfigs(pkg).map(createRollupTask),
      ...nonRollupTasks(pkg),
    ].filter(Boolean),
    { taskType: PROCESS.COMPILE }
  );
}
declare module 'gluegun' {
  interface GluegunPkger {
    build: (options: any) => Promise<any[]>;
  }

  interface Toolbox extends GluegunToolbox {
    pkger: GluegunPkger;
  }
}

export function typescriptTask(options: any) {
  return createTask('typescript', { taskType: PROCESS.EMIT }, async () => {
    await runCommand(`tsc -p ${options.tsconfig}`);
  });
}

export default (toolbox: Toolbox) => {
  async function build(options: any) {
    const { entries, ...root } = options;
    if (root.builder === 'rollup') {
      return flatten(
        await Promise.all(
          [
            packageTasks(root),
            ...entries.map((entry: any) => packageTasks(entry)),
            transformPackageJsonTask(options, []),
            root.typecheck && typescriptTask(options),
          ].filter(Boolean)
        )
      );
    } else if (root.builder === 'tsc') {
      const task = toolbox.task?.create(
        'typescript',
        { taskType: PROCESS.EMIT },
        async () => {
          return await runCommand(`tsc -p ${options.tsconfig}`);
        }
      );
      return [task];
    }

    return [];
  }

  toolbox.pkger = {
    build: build,
  };
};
