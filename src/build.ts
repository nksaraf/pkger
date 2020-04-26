import { rollup, RollupOptions, OutputOptions } from 'rollup';
import asyncro from 'asyncro';
import { logError } from './utils';
import { createBuildConfigs } from './createBuildConfigs';
import { BuildOpts } from './types';
import { createProgressEstimator } from './createProgressEstimator';
import { normalizeOpts, cleanDistFolder, writeCjsEntryFile } from './index';

export const build = async (dirtyOpts: BuildOpts) => {
  const opts = await normalizeOpts(dirtyOpts);
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
