import asyncro from 'asyncro';
import {
  logError,
  safePackageName,
  createProgressEstimator,
  getOutputPath,
  cleanDistFolder,
} from './utils';
import { BuildOpts } from './types';
import * as fs from 'fs-extra';
import { paths } from './utils';
import flatten from 'lodash/flatten';
import path from 'path';
import { createRollupTask, getRollupConfigs } from './rollup';
import { createConfig, getRelativePath } from './config';

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

function transformPackageJsonTask(transforms: any[] = []) {
  const transform = (pkgJson: any) => {
    for (var t of transforms) {
      if (t) {
        pkgJson = t(pkgJson);
      }
    }
    return pkgJson;
  };
  return {
    run: async () => {
      const json = await fs.readJson(paths.packageJson);
      const transformed = transform(json);
      await fs.writeFile(
        paths.packageJson,
        JSON.stringify(transformed, null, 2)
      );
    },
  };
}

async function createPkgTasks(pkg: any) {
  const { target, format, source } = pkg;

  return [
    ...getRollupConfigs(pkg).map(createRollupTask),
    format.includes('cjs') && {
      run: async () => {
        const outputPath = getOutputPath({ ...pkg, format: 'cjs' });
        await fs.outputFile(
          outputPath,
          cjsEntryFile(pkg.entryName || pkg.name)
        );
      },
    },
    !pkg.root &&
      pkg.target !== 'cli' && {
        run: async () => {
          fs.mkdirp(path.join(process.cwd(), pkg.entryName));
        },
      },
    // format.includes('cjs') &&
    //   cjsEntryFileTask({
    //     ...pkg,
    //     format: 'cjs',
    //     env: 'development',
    //     input: source,
    //   }),
  ].filter(Boolean);
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

async function createAllTasks(options: any) {
  const { entries, ...root } = options;
  return flatten(
    await Promise.all([
      createPkgTasks(root),
      ...entries.map((entry: any) => createPkgTasks(entry)),
      transformPackageJsonTask(
        [
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
          root.format.includes('cjs') &&
            ((p: any) => ({
              ...p,
              main: getRelativePath(
                process.cwd(),
                getOutputPath({ ...root, format: 'cjs', env: 'production' })
              ),
            })),
          // add bin for 'cli'
          ...[entries, root]
            .filter(entry => entry.target === 'cli')
            .map(pkg => addBin(pkg)),
        ].filter(Boolean)
      ),
    ])
  );
}

export const build = async (cliOpts: BuildOpts) => {
  const opts = await createConfig(cliOpts);
  const tasks = await createAllTasks(opts);
  await cleanDistFolder();
  const logger = await createProgressEstimator();
  try {
    const promise = asyncro
      .map(tasks, async (task: any) => {
        await task.run();
      })
      .catch((e: any) => {
        throw e;
      });
    logger(promise, 'Building modules');
    await promise;
  } catch (error) {
    logError(error);
    process.exit(1);
  }
};
