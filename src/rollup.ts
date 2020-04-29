import { safeVariableName, safePackageName } from './utils';
import { RollupOptions, rollup } from 'rollup';
import { terser } from 'rollup-plugin-terser';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import replace from '@rollup/plugin-replace';
import nodeResolve from '@rollup/plugin-node-resolve';
import resolve from 'resolve';
// import sourceMaps from 'rollup-plugin-sourcemaps';
// import typescript from 'rollup-plugin-typescript2';
import babel from 'rollup-plugin-babel';
import path from 'path';
// import ts from 'typescript';

// import { extractErrors } from '../archive/errors/extractErrors';
// import { babelPluginTsdx } from './babel';
import { TsdxOptions } from './types';
import { babelConfig } from './babel';

import { Plugin } from 'rollup';
import MagicString from 'magic-string';
import { getOutputPath } from './utils';

export function getRollupConfigs(pkg: any) {
  const { target, format, source } = pkg;

  return [
    format.includes('esm') &&
      getRollupConfig({ ...pkg, format: 'esm', input: source }),
    target === 'cli' &&
      getRollupConfig({
        ...pkg,
        format: 'cjs',
        input: source,
      }),
    format.includes('cjs') &&
      getRollupConfig({
        ...pkg,
        format: 'cjs',
        env: 'production',
        input: source,
      }),
    format.includes('cjs') &&
      getRollupConfig({
        ...pkg,
        format: 'cjs',
        env: 'development',
        input: source,
      }),
    // format.includes('cjs') &&
    //   cjsEntryFileTask({
    //     ...pkg,
    //     format: 'cjs',
    //     env: 'development',
    //     input: source,
    //   }),
  ].filter(Boolean);
}

function getRollupConfig(options: TsdxOptions) {
  options = {
    ...options,
    minify:
      options.minify !== undefined
        ? options.minify
        : options.env === 'production',
    outputFile: getOutputPath(options),
  };
  const config = createRollupConfig(options, 0);
  const rollupConfig = options.rollup(config, options);
  return rollupConfig;
}

export function createRollupTask(rollupConfig: any) {
  return {
    run: async () => {
      let bundle = await rollup(rollupConfig);
      await bundle.write(rollupConfig.output);
    },
  };
}

export function createRollupConfig(
  opts: TsdxOptions,
  outputNum: number
): Promise<RollupOptions> {
  const { presets, plugins, extensions } = babelConfig(opts);
  return {
    // Tell Rollup the entry point to the package
    // @ts-ignore
    input: opts.input,
    // Tell Rollup which packages to ignore
    external: (source: string, importer: string) => {
      if (source === 'babel-plugin-transform-async-to-promises/helpers') {
        return false;
      } else if (!source.startsWith('.') && !path.isAbsolute(source)) {
        return true;
      }

      try {
        if (!opts.entryPaths) {
          return false;
        }
        // what is the imported file path
        let p = resolve.sync(source, {
          basedir: path.dirname(importer),
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
      } catch (e) {}
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
      name: opts.name || safeVariableName(opts.name),
      sourcemap: true,
      globals: { react: 'React', 'react-native': 'ReactNative' },
      exports: 'named',
    },
    plugins: [
      nodeResolve({
        mainFields: [
          'module',
          'main',
          opts.target === 'browser' ? 'browser' : undefined,
        ].filter(Boolean) as string[],
        // defaults + .jsx
        extensions: extensions,
      }),
      opts.format === 'umd' &&
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
        extensions,
        presets,
        plugins,
        sourceMap: true,
        inputSourceMap: true,
      }),
      opts.env !== undefined &&
        replace({
          'process.env.NODE_ENV': JSON.stringify(opts.env),
        }),
      // sourceMaps(),
      // sizeSnapshot({
      //   printInfo: false,
      // }),
      opts.minify &&
        terser({
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

const SHEBANG_RX = /^#!.*/;

function preserveShebangs({ shebang }: { shebang: string }) {
  const shebangs: Record<string, string> = {};

  const plugin: Plugin = {
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
        const str = new MagicString(code);
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
