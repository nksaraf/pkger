"use strict";
// @ts-nocheck
// import { createConfigItem } from '@babel/core';
// import babelPlugin from 'rollup-plugin-babel';
// import merge from 'lodash.merge';
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const core_1 = require("@babel/core");
// babel presets
const preset_env_1 = tslib_1.__importDefault(require("@babel/preset-env"));
const preset_typescript_1 = tslib_1.__importDefault(require("@babel/preset-typescript"));
const preset_react_1 = tslib_1.__importDefault(require("@babel/preset-react"));
// babel plugins
const plugin_proposal_object_rest_spread_1 = tslib_1.__importDefault(require("@babel/plugin-proposal-object-rest-spread"));
const babel_plugin_transform_async_to_promises_1 = tslib_1.__importDefault(require("babel-plugin-transform-async-to-promises"));
// import pluginDecorators from '@babel/plugin-proposal-decorators';
const plugin_proposal_class_properties_1 = tslib_1.__importDefault(require("@babel/plugin-proposal-class-properties"));
const plugin_proposal_nullish_coalescing_operator_1 = tslib_1.__importDefault(require("@babel/plugin-proposal-nullish-coalescing-operator"));
const plugin_proposal_optional_chaining_1 = tslib_1.__importDefault(require("@babel/plugin-proposal-optional-chaining"));
const plugin_transform_regenerator_1 = tslib_1.__importDefault(require("@babel/plugin-transform-regenerator"));
// import pluginStyledComponents from 'babel-plugin-styled-components';
const babel_plugin_macros_1 = tslib_1.__importDefault(require("babel-plugin-macros"));
let hasReact = pkg => ['dependencies', 'devDependencies', 'peerDependencies'].reduce((last, current) => last || (pkg[current] && pkg[current]['react']), false);
exports.babelConfig = options => {
    const extensions = [...core_1.DEFAULT_EXTENSIONS, '.ts', '.tsx', '.json', '.node'];
    const { browserlist, format } = options;
    // Note: when using `React`, presetTs needs `React` as jsxPragma,
    // vs presetReact needs `React.createElement`,
    // but when using `h` as pragma, both presets needs it to be just `h`
    let [jsxPragma, pragma, pragmaFrag] = hasReact(options)
        ? ['React', 'React.createElement', 'React.Fragment']
        : ['h', 'h', 'h'];
    const presets = [
        [
            preset_env_1.default,
            {
                // bugfixes: true,
                loose: true,
                useBuiltIns: false,
                modules: false,
                targets: format === 'umd' ? browserlist + ', ie 11' : browserlist,
                exclude: ['transform-async-to-generator', 'transform-regenerator'],
            },
        ],
        [preset_typescript_1.default, { jsxPragma, isTSX: true, allExtensions: true }],
        [preset_react_1.default, { pragma, pragmaFrag }],
    ];
    const plugins = [
        [plugin_proposal_object_rest_spread_1.default, { loose: true, useBuiltIns: true }],
        [babel_plugin_transform_async_to_promises_1.default, { inlineHelpers: true, externalHelpers: true }],
        // [pluginDecorators, { legacy: true }],
        [plugin_proposal_class_properties_1.default, { loose: true }],
        [plugin_transform_regenerator_1.default, { async: false }],
        [plugin_proposal_nullish_coalescing_operator_1.default],
        [plugin_proposal_optional_chaining_1.default],
        // pluginStyledComponents,
        babel_plugin_macros_1.default,
    ];
    return { presets, plugins, extensions };
};
