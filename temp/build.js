"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const asyncro_1 = tslib_1.__importDefault(require("asyncro"));
const utils_1 = require("./utils");
const fs = tslib_1.__importStar(require("fs-extra"));
const utils_2 = require("./utils");
const flatten_1 = tslib_1.__importDefault(require("lodash/flatten"));
const path_1 = tslib_1.__importDefault(require("path"));
const rollup_1 = require("./rollup");
const config_1 = require("./config");
function cjsEntryFile(name) {
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
exports.cjsEntryFile = cjsEntryFile;
function transformPackageJsonTask(transforms = []) {
    const transform = (pkgJson) => {
        for (var t of transforms) {
            if (t) {
                pkgJson = t(pkgJson);
            }
        }
        return pkgJson;
    };
    return {
        run: async () => {
            const json = await fs.readJson(utils_2.paths.packageJson);
            const transformed = transform(json);
            await fs.writeFile(utils_2.paths.packageJson, JSON.stringify(transformed, null, 2));
        },
    };
}
async function createPkgTasks(pkg) {
    const { target, format, source } = pkg;
    return [
        ...rollup_1.getRollupConfigs(pkg).map(rollup_1.createRollupTask),
        format.includes('cjs') && {
            run: async () => {
                const outputPath = utils_1.getOutputPath(Object.assign(Object.assign({}, pkg), { format: 'cjs' }));
                await fs.outputFile(outputPath, cjsEntryFile(pkg.entryName || pkg.name));
            },
        },
        !pkg.root &&
            pkg.target !== 'cli' && {
            run: async () => {
                fs.mkdirp(path_1.default.join(process.cwd(), pkg.entryName));
                const packageJson = Object.assign(Object.assign(Object.assign({ name: pkg.name, private: true }, (pkg.format.includes('cjs')
                    ? {
                        main: config_1.getRelativePath(path_1.default.join(process.cwd(), pkg.entryName), utils_1.getOutputPath(Object.assign(Object.assign({}, pkg), { format: 'cjs' }))),
                    }
                    : {})), (pkg.format.includes('esm')
                    ? {
                        module: config_1.getRelativePath(path_1.default.join(process.cwd(), pkg.entryName), utils_1.getOutputPath(Object.assign(Object.assign({}, pkg), { format: 'esm' }))),
                    }
                    : {})), { types: '../' + (pkg.tsconfigContents['declarationDir'] || '../dist/types') });
                await fs.writeFile(path_1.default.join(process.cwd(), pkg.entryName, 'package.json'), JSON.stringify(packageJson, null, 2));
            },
        },
    ].filter(Boolean);
}
function addBin(pkg) {
    return (pkgJson) => {
        const outputPath = utils_1.getOutputPath(Object.assign(Object.assign({}, pkg), { format: 'cjs' }));
        return Object.assign(Object.assign({}, pkgJson), { bin: Object.assign(Object.assign({}, pkgJson['bin']), { [pkg.cmd || utils_1.safePackageName(pkg.name)]: config_1.getRelativePath(process.cwd(), outputPath) }) });
    };
}
function ensureInFiles(entryName) {
    return (pkgJson) => {
        const { files = [] } = pkgJson, other = tslib_1.__rest(pkgJson, ["files"]);
        if (!files.some((f) => f === entryName)) {
            files.push(entryName);
        }
        return Object.assign(Object.assign({}, other), { files });
    };
}
async function createAllTasks(options) {
    const { entries } = options, root = tslib_1.__rest(options, ["entries"]);
    return flatten_1.default(await Promise.all([
        createPkgTasks(root),
        ...entries.map((entry) => createPkgTasks(entry)),
        transformPackageJsonTask([
            // add types for 'types'
            // make sure files has everythin
            // add module for 'esm'
            root.format.includes('esm') &&
                ((p) => (Object.assign(Object.assign({}, p), { module: config_1.getRelativePath(process.cwd(), utils_1.getOutputPath(Object.assign(Object.assign({}, root), { format: 'esm' }))) }))),
            root.target === 'browser' &&
                ((p) => (Object.assign(Object.assign({}, p), { browser: config_1.getRelativePath(process.cwd(), utils_1.getOutputPath(Object.assign(Object.assign({}, root), { format: 'esm' }))) }))),
            root.format.includes('cjs') &&
                ((p) => (Object.assign(Object.assign({}, p), { main: config_1.getRelativePath(process.cwd(), utils_1.getOutputPath(Object.assign(Object.assign({}, root), { format: 'cjs' }))) }))),
            (p) => (Object.assign(Object.assign({}, p), { types: options.tsconfigContents['declarationDir'] || 'dist/types' })),
            // add bin for 'cli'
            ...[entries, root]
                .filter(entry => entry.target === 'cli')
                .map(pkg => addBin(pkg)),
            ...entries
                .filter((entry) => entry.target !== 'cli')
                .map((pkg) => ensureInFiles(pkg.entryName)),
            ensureInFiles('dist'),
            ensureInFiles(options.tsconfigContents['declarationDir'] || 'dist/types'),
        ].filter(Boolean)),
        {
            run: () => {
                utils_1.runCommand(`tsc -p ${options.tsconfig}`);
            },
        },
    ]));
}
exports.build = async (cliOpts) => {
    const opts = await config_1.createConfig(cliOpts);
    const tasks = await createAllTasks(opts);
    await utils_1.cleanDistFolder();
    const logger = await utils_1.createProgressEstimator();
    try {
        const promise = asyncro_1.default
            .map(tasks, async (task) => {
            await task.run();
        })
            .catch((e) => {
            throw e;
        });
        logger(promise, 'Building modules');
        await promise;
    }
    catch (error) {
        utils_1.logError(error);
        process.exit(1);
    }
};
