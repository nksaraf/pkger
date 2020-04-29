"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const utils_1 = require("./utils");
const rollup_1 = require("rollup");
const rollup_plugin_terser_1 = require("rollup-plugin-terser");
const plugin_commonjs_1 = tslib_1.__importDefault(require("@rollup/plugin-commonjs"));
const plugin_json_1 = tslib_1.__importDefault(require("@rollup/plugin-json"));
const plugin_replace_1 = tslib_1.__importDefault(require("@rollup/plugin-replace"));
const plugin_node_resolve_1 = tslib_1.__importDefault(require("@rollup/plugin-node-resolve"));
const resolve_1 = tslib_1.__importDefault(require("resolve"));
// import sourceMaps from 'rollup-plugin-sourcemaps';
// import typescript from 'rollup-plugin-typescript2';
const rollup_plugin_babel_1 = tslib_1.__importDefault(require("rollup-plugin-babel"));
const path_1 = tslib_1.__importDefault(require("path"));
const babel_1 = require("./babel");
const magic_string_1 = tslib_1.__importDefault(require("magic-string"));
const utils_2 = require("./utils");
function getRollupConfigs(pkg) {
    const { target, format, source } = pkg;
    return [
        format.includes('esm') &&
            getRollupConfig(Object.assign(Object.assign({}, pkg), { format: 'esm', input: source })),
        target === 'cli' &&
            getRollupConfig(Object.assign(Object.assign({}, pkg), { format: 'cjs', input: source })),
        format.includes('cjs') &&
            getRollupConfig(Object.assign(Object.assign({}, pkg), { format: 'cjs', env: 'production', input: source })),
        format.includes('cjs') &&
            getRollupConfig(Object.assign(Object.assign({}, pkg), { format: 'cjs', env: 'development', input: source })),
    ].filter(Boolean);
}
exports.getRollupConfigs = getRollupConfigs;
function getRollupConfig(options) {
    options = Object.assign(Object.assign({}, options), { minify: options.minify !== undefined
            ? options.minify
            : options.env === 'production', outputFile: utils_2.getOutputPath(options) });
    const config = createRollupConfig(options, 0);
    const rollupConfig = options.rollup(config, options);
    return rollupConfig;
}
function createRollupTask(rollupConfig) {
    return {
        run: async () => {
            let bundle = await rollup_1.rollup(rollupConfig);
            await bundle.write(rollupConfig.output);
        },
    };
}
exports.createRollupTask = createRollupTask;
function createRollupConfig(opts, outputNum) {
    const { presets, plugins, extensions } = babel_1.babelConfig(opts);
    return {
        // Tell Rollup the entry point to the package
        // @ts-ignore
        input: opts.input,
        // Tell Rollup which packages to ignore
        external: (source, importer) => {
            if (source === 'babel-plugin-transform-async-to-promises/helpers') {
                return false;
            }
            else if (!source.startsWith('.') && !path_1.default.isAbsolute(source)) {
                return true;
            }
            try {
                if (!opts.entryPaths) {
                    return false;
                }
                // what is the imported file path
                let p = resolve_1.default.sync(source, {
                    basedir: path_1.default.dirname(importer),
                    extensions: extensions,
                });
                // @ts-ignore is it one of the pkg entries
                const entry = opts.entryPaths.find(o => p === o);
                if (!entry) {
                    return false;
                }
                // if not an entry or if the importer is
                // if (!entry || path.dirname(importer) === path.dirname(entry)) {
                //   return false;
                // }
                return true;
                // console.log(source, importer, p);
            }
            catch (e) { }
            return true;
            // return !source.startsWith('.') && !path.isAbsolute(source);
        },
        // Rollup has treeshaking by default, but we can optimize it further...
        treeshake: {
            // We assume reading a property of an object never has side-effects.
            // This means tsdx WILL remove getters and setters defined directly on objects.
            // Any getters or setters defined on classes will not be effected.
            //
            // @example
            //
            // const foo = {
            //  get bar() {
            //    console.log('effect');
            //    return 'bar';
            //  }
            // }
            //
            // const result = foo.bar;
            // const illegalAccess = foo.quux.tooDeep;
            //
            // Punchline....Don't use getters and setters
            propertyReadSideEffects: false,
        },
        // Establish Rollup output
        output: {
            // Set filenames of the consumer's package
            file: opts.outputFile,
            // Pass through the file format
            format: opts.format,
            // Do not let Rollup call Object.freeze() on namespace import objects
            // (i.e. import * as namespaceImportObject from...) that are accessed dynamically.
            freeze: false,
            // Respect tsconfig esModuleInterop when setting __esModule.
            esModule: true,
            name: opts.name || utils_1.safeVariableName(opts.name),
            sourcemap: true,
            globals: { react: 'React', 'react-native': 'ReactNative' },
            exports: 'named',
        },
        plugins: [
            plugin_node_resolve_1.default({
                mainFields: [
                    'module',
                    'main',
                    opts.target === 'browser' ? 'browser' : undefined,
                ].filter(Boolean),
                // defaults + .jsx
                extensions: extensions,
            }),
            opts.format === 'umd' &&
                plugin_commonjs_1.default({
                    // use a regex to make sure to include eventual hoisted packages
                    include: /\/node_modules\//,
                }),
            plugin_json_1.default(),
            rollup_plugin_babel_1.default({
                babelrc: false,
                configFile: false,
                compact: false,
                exclude: 'node_modules/**',
                extensions,
                presets,
                plugins,
                sourceMap: true,
                inputSourceMap: true,
            }),
            opts.env !== undefined &&
                plugin_replace_1.default({
                    'process.env.NODE_ENV': JSON.stringify(opts.env),
                }),
            // sourceMaps(),
            // sizeSnapshot({
            //   printInfo: false,
            // }),
            opts.minify &&
                rollup_plugin_terser_1.terser({
                    sourcemap: true,
                    output: { comments: false },
                    compress: {
                        keep_infinity: true,
                        pure_getters: true,
                        passes: 10,
                    },
                    ecma: 5,
                    toplevel: opts.format === 'cjs',
                    warnings: true,
                }),
            opts.target === 'cli' &&
                preserveShebangs({ shebang: '#!/usr/bin/env node' }),
        ].filter(Boolean),
    };
}
exports.createRollupConfig = createRollupConfig;
const SHEBANG_RX = /^#!.*/;
function preserveShebangs({ shebang }) {
    const shebangs = {};
    const plugin = {
        name: 'rollup-plugin-preserve-shebang',
        transform(code, id) {
            const match = code.match(SHEBANG_RX);
            if (match) {
                shebangs[id] = match[0];
            }
            code = code.replace(SHEBANG_RX, '');
            return {
                code,
                map: null,
            };
        },
        renderChunk(code, chunk, { sourcemap }) {
            if (chunk.facadeModuleId && (shebangs[chunk.facadeModuleId] || shebang)) {
                const str = new magic_string_1.default(code);
                str.prepend((shebangs[chunk.facadeModuleId] || shebang) + '\n');
                return {
                    code: str.toString(),
                    map: sourcemap ? str.generateMap({ hires: true }) : null,
                };
            }
            return {
                code,
                map: null,
            };
        },
    };
    return plugin;
}
