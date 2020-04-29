"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const path_1 = tslib_1.__importDefault(require("path"));
const defaults_1 = tslib_1.__importDefault(require("lodash/defaults"));
const resolve_1 = tslib_1.__importDefault(require("resolve"));
const fs = tslib_1.__importStar(require("fs-extra"));
const cosmiconfig_1 = require("cosmiconfig");
const utils_1 = require("./utils");
const explorer = cosmiconfig_1.cosmiconfig('pkger');
async function createConfig(cliOpts) {
    var _a, _b;
    const cwd = process.cwd();
    const config = (_b = (_a = (await explorer.search(cwd))) === null || _a === void 0 ? void 0 : _a.config, (_b !== null && _b !== void 0 ? _b : {}));
    const packageJson = await loadPackageJson();
    const name = path_1.default.basename(cwd);
    const tsconfig = firstExistingPath(['tsconfig.build.json', 'tsconfig.json'], undefined, cwd);
    let source = resolveEntry(cwd);
    source = source ? './' + getRelativePath(cwd, source) : undefined;
    utils_1.DEBUG && console.log('SOURCE', source);
    const rootOptions = defaults_1.default(cliOpts, defaults_1.default(config, defaults_1.default(packageJson, {
        name,
        source,
        root: true,
        target: 'browser',
        // format: 'esm,cjs',
        tsconfig,
        rollup(config, _options) {
            return config;
        },
    })));
    const sourceDir = path_1.default.dirname(rootOptions.source);
    const pkgSources = [];
    const entries = (rootOptions.entries || []).map((option) => {
        const pkgName = typeof option === 'string' ? option : option.name;
        let name = rootOptions.name + '/' + pkgName;
        let source = resolveEntry(path_1.default.join(sourceDir, pkgName));
        source = source
            ? './' + getRelativePath(cwd, source)
            : typeof option === 'object'
                ? option.source
                : undefined;
        utils_1.DEBUG && console.log('SOURCE', source);
        let baseEntryOption = typeof option === 'string'
            ? { name, source, entryName: pkgName }
            : Object.assign(Object.assign({}, option), { name, source, entryName: pkgName });
        const entryOption = defaults_1.default(baseEntryOption, rootOptions);
        pkgSources.push(path_1.default.join(cwd, entryOption.source));
        return entryOption;
    });
    // const entryPaths = entries.map((entry: any) => {
    //   // const entryDir = path.dirname(entry.source);
    //   // if (entryDir.endsWith(entry.entryName)) {
    //   //   return path.join(process.cwd(), entryDir);
    //   // }
    //   return path.join(process.cwd(), entry.source);
    // });
    rootOptions.entries = entries
        .map(entry => (Object.assign(Object.assign({}, entry), { root: false, pkgSources })))
        .map(resolveDependentOptions);
    rootOptions.pkgSources = pkgSources;
    return resolveDependentOptions(rootOptions);
}
exports.createConfig = createConfig;
const FORMATS = {
    browser: 'cjs,esm',
    node: 'cjs',
    cli: '',
};
function resolveDependentOptions(pkg) {
    const { target, format = target ? FORMATS[target] : 'esm' } = pkg;
    return Object.assign(Object.assign({}, pkg), { target, format });
}
async function loadPackageJson() {
    let packageJson = {};
    try {
        packageJson = await fs.readJSON(utils_1.paths.packageJson);
    }
    catch (e) { }
    return packageJson;
}
/**
 * Given a source directory and a target filename, return the relative
 * file path from source to target.
 * @param source {String} directory path to start from for traversal
 * @param target {String} directory path and filename to seek from source
 * @return Relative path (e.g. "../../style.css") as {String}
 */
function getRelativePath(source, target) {
    var sep = source.indexOf('/') !== -1 ? '/' : '\\', targetArr = target.split(sep), sourceArr = source.split(sep), filename = targetArr.pop(), targetPath = targetArr.join(sep), relativePath = '';
    while (targetPath.indexOf(sourceArr.join(sep)) === -1) {
        sourceArr.pop();
        relativePath += '..' + sep;
    }
    var relPathArr = targetArr.slice(sourceArr.length);
    relPathArr.length && (relativePath += relPathArr.join(sep) + sep);
    return relativePath + filename;
}
exports.getRelativePath = getRelativePath;
function firstExistingPath(list, def, baseDir = process.cwd()) {
    for (var p of list) {
        if (fs.existsSync(path_1.default.join(baseDir, p))) {
            return p;
        }
    }
    return def;
}
exports.firstExistingPath = firstExistingPath;
function resolveEntry(cwd) {
    // console.log(cwd);
    let libDir = firstExistingPath(['lib', 'src'], '.', cwd);
    libDir = libDir ? `./${libDir}` : '';
    const resolveDir = cwd.startsWith('.') || cwd.startsWith('/') ? cwd : `./${cwd}`;
    utils_1.DEBUG && console.log('CWD', resolveDir);
    utils_1.DEBUG && console.log('LIB_DIR', libDir);
    // console.log(base_lib_dir);
    try {
        return resolve_1.default.sync(libDir, {
            basedir: resolveDir,
            extensions: ['.js', '.ts', '.tsx', '.jsx'],
        });
    }
    catch (e) { }
    return;
}
exports.resolveEntry = resolveEntry;
