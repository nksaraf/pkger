import { getOutputPath } from '../utils';
import { createTask, PROCESS } from '../extensions/task';
import path from 'path';
import { Toolbox } from 'gluegun';
import { PackageOptions } from '../types';

import { safeVariableName, str } from '../utils';
import { RollupOptions, rollup } from 'rollup';
import { terser } from 'rollup-plugin-terser';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import replace from '@rollup/plugin-replace';
import nodeResolve from '@rollup/plugin-node-resolve';
import alias from '@rollup/plugin-alias';

// import sourceMaps from 'rollup-plugin-sourcemaps';
// import typescript from 'rollup-plugin-typescript2';
import babel from '@rollup/plugin-babel';
// import ts from 'typescript';

// import { extractErrors } from '../archive/errors/extractErrors';
// import { babelPluginTsdx } from './babel';
// import { babelConfig } from '../extensions/babel';

export function getRollupConfigs(pkg: PackageOptions) {
  const { target, format, source, name, label = `${name} ${format}` } = pkg;

  return [
    format.includes('esm') &&
      getRollupConfig({
        ...pkg,
        outputFormat: 'esm',
        input: source,
        label: str(name, 'esm'),
      }),
    target === 'cli' &&
      getRollupConfig({
        ...pkg,
        outputFormat: 'cjs',
        input: source,
        label: str(name, 'cli'),
      }),
    format.includes('cjs') &&
      getRollupConfig({
        ...pkg,
        outputFormat: 'cjs',
        env: 'production',
        input: source,
        label: str(name, 'cjs', 'prod'),
      }),
    format.includes('cjs') &&
      getRollupConfig({
        ...pkg,
        outputFormat: 'cjs',
        env: 'development',
        input: source,
        label: str(name, 'cjs', 'dev'),
      }),
    format.includes('umd') &&
      getRollupConfig({
        ...pkg,
        outputFormat: 'umd',
        // env: 'development',
        input: source,
        label: str(name, 'umd'),
      }),
  ].filter(Boolean);
}

import Worker from 'web-worker';
import * as Comlink from 'comlink';
import { preserveShebangs } from './rollup-helper';
import { babelConfig } from '../extensions/babel';

function getRollupConfig(options: PackageOptions) {
  options = {
    ...options,
    minify:
      options.minify !== undefined
        ? options.minify
        : options.env === 'production',
    outputFile: getOutputPath(options),
  };
  const config = createRollupConfig(options);
  // @ts-ignore
  const rollupConfig = options.rollup(config, options);
  (rollupConfig as any).label = options.label;
  return rollupConfig;
}

export function createRollupTask(rollupConfig: any) {
  const { label = rollupConfig.input, ...config } = rollupConfig;
  return createTask(
    label,
    { taskType: PROCESS.COMPILE, onError: console.log },
    async () => {
      let bundle = await rollup(config);
      return await bundle.write(config.output);
    }
  );
}

export function createRollupConfig(
  pkg: PackageOptions
  // outputNum: number
): RollupOptions {
  const { presets, plugins, extensions } = babelConfig(pkg);
  const config: RollupOptions = {
    // Tell Rollup the entry point to the package
    // @ts-ignore
    input: pkg.input,
    // Tell Rollup which packages to ignore
    external: (source, importer, resolved) => {
      if (source === 'babel-plugin-transform-async-to-promises/helpers') {
        return false;
      } else if (source.startsWith('.') || path.isAbsolute(source)) {
        return false;
      }

      return pkg.external(pkg, source, importer, resolved);
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
      file: pkg.outputFile,
      // Pass through the file format
      format: pkg.outputFormat,
      // Do not let Rollup call Object.freeze() on namespace import objects
      // (i.e. import * as namespaceImportObject from...) that are accessed dynamically.
      freeze: false,
      // Respect tsconfig esModuleInterop when setting __esModule.
      esModule: Boolean(
        pkg.tsconfigContents.compilerOptions['esModuleInterop']
      ),
      name: pkg.name || safeVariableName(pkg.name),
      sourcemap: true,
      globals: { react: 'React', 'react-native': 'ReactNative' },
      exports: 'named',
    },
    plugins: [
      alias({
        entries: pkg.allPackages.map((e) => ({
          find: `@${e.entryName ?? e.name}`,
          replacement: `./${e.entryName ?? e.name}`,
        })),
      }),
      nodeResolve({
        mainFields: [
          'module',
          'main',
          pkg.target === 'browser' ? 'browser' : undefined,
        ].filter(Boolean) as string[],
        // defaults + .jsx
        extensions: extensions,
      }),
      pkg.format.includes('umd') &&
        commonjs({
          // use a regex to make sure to include eventual hoisted packages
          include: /\/node_modules\//,
        }),
      json(),
      babel({
        babelrc: false,
        configFile: false,
        compact: false,
        exclude: 'node_modules/**',
        babelHelpers: 'bundled',
        extensions,
        presets,
        plugins,
        sourceMap: true,
        inputSourceMap: true,
      }),
      pkg.env !== undefined &&
        replace({
          'process.env.NODE_ENV': JSON.stringify(pkg.env),
        }),
      // sourceMaps(),
      // sizeSnapshot({
      //   printInfo: false,
      // }),
      pkg.minify &&
        terser({
          sourcemap: true,
          output: { comments: false },
          compress: {
            keep_infinity: true,
            pure_getters: true,
            passes: 10,
          },
          ecma: 5,
          toplevel: pkg.outputFormat === 'cjs',
          warnings: true,
        }),
      // sizeme(),
      pkg.target === 'cli' &&
        preserveShebangs({ shebang: '#!/usr/bin/env node' }),
    ].filter(Boolean),
  };

  return config;
}

declare module 'gluegun' {
  interface GluegunRollup {
    createTask: typeof createRollupTask;
  }

  interface Toolbox {
    rollup: GluegunRollup;
  }
}

export default (toolbox: Toolbox) => {
  toolbox.rollup = {
    createTask: createRollupTask,
  };
};
