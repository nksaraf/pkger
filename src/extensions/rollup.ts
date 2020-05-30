import { safeVariableName, safePackageName, str } from '../utils';
import { RollupOptions, rollup } from 'rollup';
import { terser } from 'rollup-plugin-terser';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import replace from '@rollup/plugin-replace';
import nodeResolve from '@rollup/plugin-node-resolve';
import resolve from 'resolve';
import alias from '@rollup/plugin-alias';

// import sourceMaps from 'rollup-plugin-sourcemaps';
// import typescript from 'rollup-plugin-typescript2';
import babel from '@rollup/plugin-babel';
import path from 'path';
// import ts from 'typescript';

// import { extractErrors } from '../archive/errors/extractErrors';
// import { babelPluginTsdx } from './babel';
import { babelConfig } from './babel';

import { Plugin } from 'rollup';
import MagicString from 'magic-string';
import { getOutputPath } from '../utils';

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

function getRollupConfig(options: TsdxOptions) {
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
  opts: TsdxOptions
  // outputNum: number
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
      } else if (
        !(
          source.startsWith('.') ||
          path.isAbsolute(source) ||
          source.startsWith('@')
        )
      ) {
        return true;
      }

      try {
        if (!opts.allEntries) {
          return false;
        }

        if (source.startsWith('@')) {
          return false;
        }
        // what is the imported file path
        let p = resolve.sync(source, {
          basedir: path.dirname(importer),
          extensions: extensions,
        });
        // @ts-ignore is it one of the pkg entries
        const cwd = process.cwd();
        const entry = opts.allEntries.find(
          (o) => p === path.join(process.cwd(), o.source)
        );
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

/**
 * A rollup plugin to print gzip size of output assets.
 * Why we need a custom plugin :- To save 2 terser passes
 * - `rollup-plugin-filesize` does an internal terser pass for all the files
 * - This is little expensive, specially when we use `terser` to generate final output anyway.
 */
import gzip from 'gzip-size';
import prettyBytes from 'pretty-bytes';
import { PROCESS, createTask } from './task';
import { Toolbox } from 'gluegun';
// import greenlet from './greenlet';
// import { info } from '../logger';

export const showSize = (bundle: { code: any; fileName: any }) => {
  const { code, fileName } = bundle;
  // console.log(code);
  const size = prettyBytes(gzip.sync(code));
  return size;
  // console.log(`\t${size}\t${fileName}`);
};

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
