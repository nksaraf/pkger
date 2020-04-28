import { rollup, RollupOptions, OutputOptions, ModuleFormat } from 'rollup';
import asyncro from 'asyncro';
import { logError, isFile, resolveApp, isDir, safePackageName } from './utils';
import { BuildOpts, PackageJson, WatchOpts } from './types';
import { createProgressEstimator } from './createProgressEstimator';
import { cosmiconfig } from 'cosmiconfig';
import merge from 'lodash.merge';
import * as fs from 'fs-extra';
import { concatAllArray } from 'jpjs';
import glob from 'tiny-glob/sync';
import path from 'path';
import { paths } from './utils';
import { TsdxOptions, NormalizedOpts } from './types';

import { createRollupConfig } from './createRollupConfig';

let appPackageJson: PackageJson;

try {
  appPackageJson = fs.readJSONSync(paths.appPackageJson);
} catch (e) {}

async function jsOrTs(filename: string) {
  const extension = (await isFile(resolveApp(filename + '.ts')))
    ? '.ts'
    : (await isFile(resolveApp(filename + '.tsx')))
    ? '.tsx'
    : (await isFile(resolveApp(filename + '.jsx')))
    ? '.jsx'
    : '.js';

  return resolveApp(`${filename}${extension}`);
}

async function getInputs(
  entries?: string | string[],
  source?: string
): Promise<string[]> {
  let inputs: string[] = [];
  let stub: any[] = [];
  stub
    .concat(
      entries && entries.length
        ? entries
        : (source && resolveApp(source)) ||
            ((await isDir(resolveApp('lib'))) && (await jsOrTs('lib/index')))
    )
    .map(file => glob(file))
    .forEach(input => inputs.push(input));

  return concatAllArray(inputs);
}

export async function normalizeOpts(opts: WatchOpts): Promise<NormalizedOpts> {
  return {
    ...opts,
    name: opts.name || appPackageJson.name,
    input: await getInputs(opts.entry, appPackageJson.source),
    format: (opts.format.split(',').map((format: string) => {
      if (format === 'es') {
        return 'esm';
      }
      return format;
    }) as [ModuleFormat, ...ModuleFormat[]]) as any,
  };
}

export async function cleanDistFolder() {
  await fs.remove(paths.appDist);
}

export function writeCjsEntryFile(name: string) {
  const baseLine = `module.exports = require('./${safePackageName(name)}`;
  const contents = `
'use strict'

if (process.env.NODE_ENV === 'production') {
  ${baseLine}.cjs.production.min.js')
} else {
  ${baseLine}.cjs.development.js')
}
`;
  return fs.outputFile(path.join(paths.appDist, 'index.js'), contents);
}

const explorer = cosmiconfig('pkger');

// check for custom tsdx.config.js
let tsdxConfig = {
  rollup(config: RollupOptions, _options: TsdxOptions): RollupOptions {
    return config;
  },
};

if (fs.existsSync(paths.appConfig)) {
  tsdxConfig = require(paths.appConfig);
}

export async function createBuildConfigs(
  opts: NormalizedOpts
): Promise<Array<RollupOptions & { output: OutputOptions }>> {
  const allInputs = concatAllArray(
    opts.input.map((input: string) =>
      createAllFormats(opts, input).map(
        (options: TsdxOptions, index: number) => ({
          ...options,
          // We want to know if this is the first run for each entryfile
          // for certain plugins (e.g. css)
          writeMeta: index === 0,
        })
      )
    )
  );

  return await Promise.all(
    allInputs.map(async (options: TsdxOptions, index: number) => {
      // pass the full rollup config to tsdx.config.js override
      const config = await createRollupConfig(options, index);
      return tsdxConfig.rollup(config, options);
    })
  );
}

function createAllFormats(
  opts: NormalizedOpts,
  input: string
): [TsdxOptions, ...TsdxOptions[]] {
  return [
    opts.format.includes('cjs') && {
      ...opts,
      format: 'cjs',
      env: 'development',
      input,
    },
    opts.format.includes('cjs') && {
      ...opts,
      format: 'cjs',
      env: 'production',
      input,
    },
    opts.format.includes('esm') && { ...opts, format: 'esm', input },
    opts.format.includes('umd') && {
      ...opts,
      format: 'umd',
      env: 'development',
      input,
    },
    opts.format.includes('umd') && {
      ...opts,
      format: 'umd',
      env: 'production',
      input,
    },
    opts.format.includes('system') && {
      ...opts,
      format: 'system',
      env: 'development',
      input,
    },
    opts.format.includes('system') && {
      ...opts,
      format: 'system',
      env: 'production',
      input,
    },
  ].filter(Boolean) as [TsdxOptions, ...TsdxOptions[]];
}

export const build = async (dirtyOpts: BuildOpts) => {
  let opts = await normalizeOpts(dirtyOpts);
  const result = await explorer.search(process.cwd());
  if (result?.config) {
    opts = merge(result.config, opts);
  }
  const buildConfigs = await createBuildConfigs(opts);
  await cleanDistFolder();
  const logger = await createProgressEstimator();
  if (opts.format.includes('cjs')) {
    const promise = writeCjsEntryFile(opts.name).catch(logError);
    logger(promise, 'Creating entry file');
  }
  try {
    const promise = asyncro
      .map(
        buildConfigs,
        async (
          inputOptions: RollupOptions & {
            output: OutputOptions;
          }
        ) => {
          let bundle = await rollup(inputOptions);
          await bundle.write(inputOptions.output);
        }
      )
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
