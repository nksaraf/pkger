import { createConfig } from './config';
import { watch as rollupWatch } from 'rollup';
import execa from 'execa';
import ora from 'ora';
import { getRollupConfigs } from './rollup';
import flatten from 'lodash/flatten';
import {
  clearConsole,
  logError,
  runCommand,
  createProgressEstimator,
  cleanDistFolder,
} from './utils';
import chalk from 'chalk';

export async function watch(cliOpts: any) {
  const options = await createConfig(cliOpts);
  // if (!options.noClean) {
  await cleanDistFolder();
  // }
  // if (opts.format.includes('cjs')) {
  //   await writeCjsEntryFile(opts.name);
  // }

  // const logger = createProgressEstimator();

  type Killer = execa.ExecaChildProcess | null;

  let firstTime = true;
  let successKiller: Killer = null;
  let failureKiller: Killer = null;

  function killHooks() {
    return Promise.all([
      successKiller ? successKiller.kill('SIGTERM') : null,
      failureKiller ? failureKiller.kill('SIGTERM') : null,
    ]);
  }

  const { entries, ...root } = options;
  const configs = flatten([
    getRollupConfigs(root),
    ...entries.map((entry: any) => getRollupConfigs(entry)),
  ]).map(config => ({
    ...config,
    watch: {
      silent: true,
      include: ['src/**'],
      exclude: ['node_modules/**'],
    },
  }));

  const spinner = ora().start();
  // spinner;
  rollupWatch(configs).on('event', async event => {
    // clear previous onSuccess/onFailure hook processes so they don't pile up
    await killHooks();

    if (event.code === 'START') {
      if (!cliOpts.verbose) {
        clearConsole();
      }
      spinner.start(chalk.bold.cyan('Compiling modules...'));
    }
    if (event.code === 'ERROR') {
      spinner.fail(chalk.bold.red('Failed to compile'));
      logError(event.error);
      failureKiller = runCommand(cliOpts.onFailure);
    }
    if (event.code === 'END') {
      spinner.succeed(chalk.bold.green('Compiled successfully'));
      console.log(`
  ${chalk.dim('Watching for changes')}
  `);

      // try {
      // await deprecated.moveTypes();

      // if (firstTime && opts.onFirstSuccess) {
      firstTime = false;
      // run(opts.onFirstSuccess);
      // } else {
      // successKiller = run(opts.onSuccess);
      // }
      // } catch (_error) {}
    }
  });
}
