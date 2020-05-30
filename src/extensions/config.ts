import { Toolbox, GluegunToolbox } from 'gluegun';

import path from 'path';
import defaults from 'lodash/defaults';
import * as fs from 'fs-extra';
import { paths, DEBUG } from '../utils';
import { defaultLoaders, cosmiconfigSync } from 'cosmiconfig';
import { PackageOptions, PackageFormat } from '../types';

// import { AsyncLoader } from 'cosmiconfig';
// import get from 'lodash.get';

// import TypeScriptCompileError from './Errors/TypeScriptCompileError';

const loader = (tsconfig: string) => (filePath: string) => {
  try {
    require('ts-node').register({
      project: process.cwd() + `/${tsconfig}`,
      extensions: '.ts',
      transpileOnly: true,
    });

    const result = require(filePath);
    return result?.default ?? result;

    // return get(result, 'default', result);
  } catch (error) {
    // Replace with logger class OR throw a more specific error
    // throw TypeScriptCompileError.fromError(error);
    throw error;
  }
};

export function loadConfig(
  moduleName: string,
  src: string,
  tsconfig: string
): PackageOptions {
  const cosmic = cosmiconfigSync(moduleName || '', {
    loaders: {
      ...defaultLoaders,
      '.ts': loader(tsconfig),
    },
    searchPlaces: [
      'package.json',
      // `.${moduleName}rc`,
      // `.${moduleName}rc.json`,
      // `.${moduleName}rc.yaml`,
      // `.${moduleName}rc.yml`,
      // `.${moduleName}rc.js`,
      `${moduleName}.config.js`,
      `${moduleName}.config.ts`,
    ],
  }).search(src || '');

  // use what we found or fallback to an empty object
  const config = (cosmic && cosmic.config) || {};
  DEBUG && console.log('[debug] config: ', config);
  return config;
}

const noop = function (...args: any[]) {};

export async function createConfig(toolbox: Toolbox): Promise<PackageOptions> {
  const cwd = process.cwd();
  const packageJson = await loadPackageJson();
  const name = path.basename(cwd);

  const tsconfig = toolbox.path.oneExists(
    ['tsconfig.build.json', 'tsconfig.json'],
    undefined,
    cwd
  );

  const tsconfigContents = await fs.readJSON(
    path.join(cwd, tsconfig ?? 'tsconfig.build.json')
  );
  let source = toolbox.path.resolveEntry(cwd);
  source = source ? './' + toolbox.path.from(cwd, source) : undefined;

  const rootOptions: PackageOptions = defaults<PackageOptions, PackageOptions>(
    toolbox.parameters.options as any,
    defaults(
      loadConfig('pkger', cwd, tsconfig),
      defaults(packageJson, {
        name,
        source,
        root: true,
        target: 'browser',
        silent: false,
        builder: 'rollup',
        tasks: {},
        tsconfig,
        debug: DEBUG,
        tsconfigContents,
        rollup(config) {
          return config;
        },
        external() {
          return true;
        },
        babel(config) {
          return config;
        },
        preBuild: noop,
        postBuild: noop,
        onBuildError: noop,
      } as PackageOptions)
    )
  );

  const sourceDir = path.dirname(rootOptions.source as any);
  const allPackages: PackageOptions[] = [rootOptions];
  const packages: PackageOptions[] = (rootOptions.entries || []).map((pkg) => {
    const pkgName = typeof pkg === 'string' ? pkg : pkg.name;
    let name = rootOptions.name + '/' + pkgName;
    let source = toolbox.path.resolveEntry(
      toolbox.path.join(sourceDir, pkgName)
    );
    source = source
      ? './' + toolbox.path.from(cwd, source)
      : typeof pkg === 'object'
      ? pkg.source
      : undefined;

    let basePkg: PackageOptions =
      typeof pkg === 'string'
        ? { name, source, entryName: pkgName }
        : { ...pkg, name, source, entryName: pkgName };

    let fullPkg = defaults(basePkg, rootOptions);

    if (!fullPkg.rollup) {
      fullPkg.rollup = rootOptions.rollup;
    }

    fullPkg.root = false;
    fullPkg.allPackages = allPackages;
    fullPkg.allEntries = allPackages;
    fullPkg = resolveFormatFromTarget(fullPkg);
    allPackages.push(fullPkg);
    return fullPkg;
  });

  rootOptions.entries = packages;
  rootOptions.packages = packages;
  rootOptions.allEntries = allPackages;
  rootOptions.allPackages = allPackages;
  return resolveFormatFromTarget(rootOptions);
}

const FORMATS: {
  [key in PackageOptions['target']]: PackageFormat[];
} = {
  browser: ['cjs', 'esm'],
  node: ['cjs', 'esm'],
  cli: [],
};

function resolveFormatFromTarget(pkg: PackageOptions): PackageOptions {
  const { target = 'browser', format = FORMATS[target] } = pkg;
  return {
    ...pkg,
    target,
    format: (typeof format === 'string'
      ? (format as any).split(',').map((f) => f.trim())
      : format
    ).filter((f: string) => f.length > 0) as PackageFormat[],
  };
}

async function loadPackageJson() {
  let packageJson: PackageOptions = {} as any;

  try {
    packageJson = await fs.readJSON(paths.packageJson);
  } catch (e) {}

  return packageJson;
}

declare module 'gluegun' {
  interface Toolbox extends GluegunToolbox {
    config: PackageOptions;
  }
}

// add your CLI-specific functionality here, which will then be accessible
// to your commands
export default async (toolbox: Toolbox) => {
  // enable this if you want to read configuration in from
  // the current folder's package.json (in a "pkger" property),
  // pkger.config.json, etc.
  toolbox.config = await createConfig(toolbox);
};
