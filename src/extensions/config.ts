import { Toolbox } from 'gluegun';

import path from 'path';
import defaults from 'lodash/defaults';
import * as fs from 'fs-extra';
import { PackageJson, TsdxOptions } from '../types';
import { RollupOptions } from 'rollup';
import { paths, DEBUG } from '../utils';

export async function createConfig(toolbox: Toolbox) {
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

  DEBUG && console.log('SOURCE', source);
  const rootOptions = defaults(
    toolbox.parameters.options,
    defaults(
      toolbox.config.loadConfig('pkger', cwd),
      defaults(packageJson, {
        name,
        source,
        root: true,
        target: 'browser',
        silent: false,
        builder: 'rollup',
        // format: 'esm,cjs',
        tsconfig,
        tsconfigContents,
        rollup(config: RollupOptions, _options: TsdxOptions): RollupOptions {
          return config;
        },
        preBuild(toolbox, config) {
          return null;
        },
        postBuild(toolbox, config) {
          return null;
        },
        onBuildError(toolbox, config) {
          return null;
        },
      })
    )
  );

  const sourceDir = path.dirname(rootOptions.source as any);
  const allEntries: string[] = [rootOptions as any];
  const entries: any[] = (rootOptions.entries || []).map(
    (option: string | any) => {
      const pkgName = typeof option === 'string' ? option : option.name;
      let name = rootOptions.name + '/' + pkgName;
      let source = toolbox.path.resolveEntry(
        toolbox.path.join(sourceDir, pkgName)
      );
      source = source
        ? './' + toolbox.path.from(cwd, source)
        : typeof option === 'object'
        ? option.source
        : undefined;

      let baseEntryOption =
        typeof option === 'string'
          ? { name, source, entryName: pkgName }
          : { ...option, name, source, entryName: pkgName };
      const entryOption = defaults(baseEntryOption, rootOptions);
      allEntries.push(entryOption);
      return entryOption;
    }
  );

  rootOptions.entries = entries
    .map((entry) => ({ ...entry, root: false, allEntries }))
    .map(resolveDependentOptions);
  rootOptions.allEntries = allEntries;
  return resolveDependentOptions(rootOptions);
}

const FORMATS: any = {
  browser: 'cjs,esm',
  node: 'cjs',
  cli: '',
};

function resolveDependentOptions(pkg: any) {
  const { target, format = target ? FORMATS[target] : 'esm' } = pkg;
  return { ...pkg, target, format };
}

async function loadPackageJson() {
  let packageJson: PackageJson = {} as any;

  try {
    packageJson = await fs.readJSON(paths.packageJson);
  } catch (e) {}

  return packageJson;
}

// add your CLI-specific functionality here, which will then be accessible
// to your commands
export default async (toolbox: Toolbox) => {
  // enable this if you want to read configuration in from
  // the current folder's package.json (in a "pkger" property),
  // pkger.config.json, etc.
  toolbox.config = await createConfig(toolbox);
};
