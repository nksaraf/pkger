"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const fs = tslib_1.__importStar(require("fs-extra"));
const path_1 = tslib_1.__importDefault(require("path"));
const chalk_1 = tslib_1.__importDefault(require("chalk"));
const camelcase_1 = tslib_1.__importDefault(require("camelcase"));
const progress_estimator_1 = tslib_1.__importDefault(require("progress-estimator"));
const execa_1 = tslib_1.__importDefault(require("execa"));
exports.DEBUG = true;
// Remove the package name scope if it exists
exports.removeScope = (name) => name.replace(/^@.*\//, '');
// UMD-safe package name
exports.safeVariableName = (name) => camelcase_1.default(exports.removeScope(name)
    .toLowerCase()
    .replace(/((^[^a-zA-Z]+)|[^\w.-])|([^a-zA-Z0-9]+$)/g, ''));
exports.safePackageName = (name) => name
    .toLowerCase()
    .replace(/(^@.*\/)|((^[^a-zA-Z]+)|[^\w.-])|([^a-zA-Z0-9]+$)/g, '');
// export const external = (id: string) =>
//   !id.startsWith('.') && !path.isAbsolute(id);
// Make sure any symlinks in the project folder are resolved:
// https://github.com/facebookincubator/create-react-app/issues/637
exports.pkgDirectory = fs.realpathSync(process.cwd());
exports.resolvePkgPath = function (relativePath) {
    return path_1.default.resolve(exports.pkgDirectory, relativePath);
};
exports.paths = {
    packageJson: exports.resolvePkgPath('package.json'),
    tsconfigJson: exports.resolvePkgPath('tsconfig.build.json'),
    // testsSetup: resolveApp('test/setupTests.ts'),
    appRoot: exports.resolvePkgPath('.'),
    appSrc: exports.resolvePkgPath('lib'),
    // appErrorsJson: resolveApp('errors/codes.json'),
    // appErrors: resolveApp('errors'),
    appDist: exports.resolvePkgPath('dist'),
    appConfig: exports.resolvePkgPath('tsdx.config.js'),
    // jestConfig: resolveApp('jest.config.js'),
    progressEstimatorCache: exports.resolvePkgPath('node_modules/.cache/.progress-estimator'),
};
// Taken from Create React App, react-dev-utils/clearConsole
// @see https://github.com/facebook/create-react-app/blob/master/packages/react-dev-utils/clearConsole.js
function clearConsole() {
    process.stdout.write(process.platform === 'win32' ? '\x1B[2J\x1B[0f' : '\x1B[2J\x1B[3J\x1B[H');
}
exports.clearConsole = clearConsole;
function getReactVersion({ dependencies, devDependencies, }) {
    return ((dependencies && dependencies.react) ||
        (devDependencies && devDependencies.react));
}
exports.getReactVersion = getReactVersion;
exports.isDir = (name) => fs
    .stat(name)
    .then(stats => stats.isDirectory())
    .catch(() => false);
exports.isFile = (name) => fs
    .stat(name)
    .then(stats => stats.isFile())
    .catch(() => false);
const stderr = console.error.bind(console);
function logError(err) {
    const error = err.error || err;
    const description = `${error.name ? error.name + ': ' : ''}${error.message ||
        error}`;
    const message = error.plugin
        ? error.plugin === 'rpt2'
            ? `(typescript) ${description}`
            : `(${error.plugin} plugin) ${description}`
        : description;
    stderr(chalk_1.default.bold.red(message));
    if (error.loc) {
        stderr();
        stderr(`at ${error.loc.file}:${error.loc.line}:${error.loc.column}`);
    }
    if (error.frame) {
        stderr();
        stderr(chalk_1.default.dim(error.frame));
    }
    else if (err.stack) {
        const headlessStack = error.stack.replace(message, '');
        stderr(chalk_1.default.dim(headlessStack));
    }
    stderr();
}
exports.logError = logError;
async function createProgressEstimator() {
    await fs.ensureDir(exports.paths.progressEstimatorCache);
    // @ts-ignore
    return progress_estimator_1.default({
        // All configuration keys are optional, but it's recommended to specify a storage location.
        storagePath: exports.paths.progressEstimatorCache,
    });
}
exports.createProgressEstimator = createProgressEstimator;
function runCommand(command) {
    if (!command) {
        return null;
    }
    const [exec, ...args] = command.split(' ');
    return execa_1.default(exec, args, {
        stdio: 'inherit',
    });
}
exports.runCommand = runCommand;
async function cleanDistFolder() {
    await fs.remove(exports.paths.appDist);
}
exports.cleanDistFolder = cleanDistFolder;
function getOutputPath(options) {
    var _a;
    return path_1.default.join(...[
        exports.paths.appDist,
        options.format,
        options.env,
        [
            (_a = 
            // @ts-ignore
            options.entryName, (_a !== null && _a !== void 0 ? _a : options.name)),
            'js',
        ]
            .filter(Boolean)
            .join('.'),
    ].filter(Boolean));
}
exports.getOutputPath = getOutputPath;
