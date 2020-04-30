// import { createConfigItem } from '@babel/core';
// import babelPlugin from 'rollup-plugin-babel';
// import merge from 'lodash.merge';

import { DEFAULT_EXTENSIONS } from '@babel/core';

// babel presets
import presetEnv from '@babel/preset-env';
import presetTs from '@babel/preset-typescript';
import presetReact from '@babel/preset-react';

// babel plugins
import pluginObjectRestSpread from '@babel/plugin-proposal-object-rest-spread';
import pluginAsyncToPromise from 'babel-plugin-transform-async-to-promises';
// import pluginDecorators from '@babel/plugin-proposal-decorators';
import pluginClassProperties from '@babel/plugin-proposal-class-properties';
import pluginNullOperator from '@babel/plugin-proposal-nullish-coalescing-operator';
import pluginOptionalChaining from '@babel/plugin-proposal-optional-chaining';
import pluginTransformRegen from '@babel/plugin-transform-regenerator';
// import pluginStyledComponents from 'babel-plugin-styled-components';
import pluginMacros from 'babel-plugin-macros';

let hasReact = (pkg: string) =>
  ['dependencies', 'devDependencies', 'peerDependencies'].reduce(
    (last, current) => last || (pkg[current] && pkg[current]['react']),
    false
  );

export const babelConfig = (options: any) => {
  const extensions = [...DEFAULT_EXTENSIONS, '.ts', '.tsx', '.json', '.node'];
  const { browserlist, format , jsx} = options;

  // Note: when using `React`, presetTs needs `React` as jsxPragma,
  // vs presetReact needs `React.createElement`,
  // but when using `h` as pragma, both presets needs it to be just `h`
  let [jsxPragma, pragma, pragmaFrag] = jsx !== "react" ? [jsx, jsx, jsx] : hasReact(options)
    ? ['React', 'React.createElement', 'React.Fragment']
    : ['h', 'h', 'h'];

  const presets = [
    [
      presetEnv,
      {
        // bugfixes: true,
        loose: true,
        useBuiltIns: false,
        modules: false,
        targets: options.target === 'browser' ? { esmodules: true } : { node: '12' },
        exclude: ['transform-async-to-generator', 'transform-regenerator'],
      },
    ],
    [presetTs, { jsxPragma, isTSX: true, allExtensions: true }],
    [presetReact, { pragma, pragmaFrag }],
  ];

  const plugins = [
    [pluginObjectRestSpread, { loose: true, useBuiltIns: true }],
    [pluginAsyncToPromise, { inlineHelpers: true, externalHelpers: true }],
    // [pluginDecorators, { legacy: true }],
    [pluginClassProperties, { loose: true }],
    [pluginTransformRegen, { async: false }],
    [pluginNullOperator],
    [pluginOptionalChaining],
    // pluginStyledComponents,
    [pluginMacros],
  ];

  return { presets, plugins, extensions };
};
