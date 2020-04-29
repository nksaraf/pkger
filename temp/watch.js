"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const config_1 = require("./config");
const rollup_1 = require("rollup");
const ora_1 = tslib_1.__importDefault(require("ora"));
const rollup_2 = require("./rollup");
const flatten_1 = tslib_1.__importDefault(require("lodash/flatten"));
const utils_1 = require("./utils");
const chalk_1 = tslib_1.__importDefault(require("chalk"));
async function watch(cliOpts) {
    const options = await config_1.createConfig(cliOpts);
    let firstTime = true;
    let successKiller = null;
    let failureKiller = null;
    function killHooks() {
        return Promise.all([
            successKiller ? successKiller.kill('SIGTERM') : null,
            failureKiller ? failureKiller.kill('SIGTERM') : null,
        ]);
    }
    const { entries } = options, root = tslib_1.__rest(options, ["entries"]);
    const configs = flatten_1.default([
        rollup_2.getRollupConfigs(root),
        ...entries.map((entry) => rollup_2.getRollupConfigs(entry)),
    ]).map(config => (Object.assign(Object.assign({}, config), { watch: {
            silent: true,
            include: ['src/**'],
            exclude: ['node_modules/**'],
        } })));
    const spinner = ora_1.default().start();
    // spinner;
    rollup_1.watch(configs).on('event', async (event) => {
        // clear previous onSuccess/onFailure hook processes so they don't pile up
        await killHooks();
        if (event.code === 'START') {
            if (!cliOpts.verbose) {
                utils_1.clearConsole();
            }
            spinner.start(chalk_1.default.bold.cyan('Compiling modules...'));
        }
        if (event.code === 'ERROR') {
            spinner.fail(chalk_1.default.bold.red('Failed to compile'));
            utils_1.logError(event.error);
            failureKiller = utils_1.runCommand(cliOpts.onFailure);
        }
        if (event.code === 'END') {
            spinner.succeed(chalk_1.default.bold.green('Compiled successfully'));
            console.log(`
  ${chalk_1.default.dim('Watching for changes')}
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
exports.watch = watch;
