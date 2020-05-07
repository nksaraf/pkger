import { GluegunToolbox } from 'gluegun';

import path from 'path';
import defaults from 'lodash/defaults';
import resolve from 'resolve';
import * as fs from 'fs-extra';
import { PackageJson, TsdxOptions } from '../types';
import { RollupOptions } from 'rollup';
import { paths, DEBUG } from '../utils';

export async function createConfig(toolbox: GluegunToolbox) {
  const cwd = process.cwd();
  const cliOpts = { ...toolbox.config };

  const config = toolbox.config.loadConfig(process.cwd(), 'pkger');
  const packageJson = await loadPackageJson();

  const name = path.basename(cwd);
  const tsconfig = firstExistingPath(
    ['tsconfig.build.json', 'tsconfig.json'],
    undefined,
    cwd
  );
  const tsconfigContents = await fs.readJSON(
    path.join(cwd, tsconfig ?? 'tsconfig.build.json')
  );
  let source = resolveEntry(cwd);
  source = source ? './' + getRelativePath(cwd, source) : undefined;
  DEBUG && console.log('SOURCE', source);
  const rootOptions = defaults(
    cliOpts,
    defaults(
      config,
      defaults(packageJson, {
        name,
        source,
        root: true,
        target: 'browser',
        // format: 'esm,cjs',
        tsconfig,
        tsconfigContents,
        rollup(config: RollupOptions, _options: TsdxOptions): RollupOptions {
          return config;
        },
      })
    )
  );

  const sourceDir = path.dirname(rootOptions.source);
  const allEntries: string[] = [rootOptions];
  const entries: any[] = (rootOptions.entries || []).map(
    (option: string | any) => {
      const pkgName = typeof option === 'string' ? option : option.name;
      let name = rootOptions.name + '/' + pkgName;
      let source = resolveEntry(path.join(sourceDir, pkgName));
      source = source
        ? './' + getRelativePath(cwd, source)
        : typeof option === 'object'
        ? option.source
        : undefined;
      DEBUG && console.log('SOURCE', source);

      let baseEntryOption =
        typeof option === 'string'
          ? { name, source, entryName: pkgName }
          : { ...option, name, source, entryName: pkgName };
      const entryOption = defaults(baseEntryOption, rootOptions);
      allEntries.push(entryOption);
      return entryOption;
    }
  );

  // const entryPaths = entries.map((entry: any) => {
  //   // const entryDir = path.dirname(entry.source);
  //   // if (entryDir.endsWith(entry.entryName)) {
  //   //   return path.join(process.cwd(), entryDir);
  //   // }
  //   return path.join(process.cwd(), entry.source);
  // });

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

/**
 * Given a source directory and a target filename, return the relative
 * file path from source to target.
 * @param source {String} directory path to start from for traversal
 * @param target {String} directory path and filename to seek from source
 * @return Relative path (e.g. "../../style.css") as {String}
 */
export function getRelativePath(source: string, target: string) {
  var sep = source.indexOf('/') !== -1 ? '/' : '\\',
    targetArr = target.split(sep),
    sourceArr = source.split(sep),
    filename = targetArr.pop(),
    targetPath = targetArr.join(sep),
    relativePath = '';
  while (targetPath.indexOf(sourceArr.join(sep)) === -1) {
    sourceArr.pop();
    relativePath += '..' + sep;
  }
  var relPathArr = targetArr.slice(sourceArr.length);
  relPathArr.length && (relativePath += relPathArr.join(sep) + sep);
  return relativePath + filename;
}

export function firstExistingPath(
  list: string[],
  def?: string,
  baseDir: string = process.cwd()
) {
  for (var p of list) {
    if (fs.existsSync(path.join(baseDir, p))) {
      return p;
    }
  }
  return def;
}

export function resolveEntry(cwd: string) {
  // console.log(cwd);
  let libDir = firstExistingPath(['lib', 'src'], '.', cwd);
  libDir = libDir ? `./${libDir}` : '';
  const resolveDir =
    cwd.startsWith('.') || cwd.startsWith('/') ? cwd : `./${cwd}`;
  DEBUG && console.log('CWD', resolveDir);
  DEBUG && console.log('LIB_DIR', libDir);
  // console.log(base_lib_dir);
  try {
    return resolve.sync(libDir, {
      basedir: resolveDir,
      extensions: ['.js', '.ts', '.tsx', '.jsx'],
    });
  } catch (e) {}
  return;
}

// add your CLI-specific functionality here, which will then be accessible
// to your commands
export default async (toolbox: GluegunToolbox) => {
  // enable this if you want to read configuration in from
  // the current folder's package.json (in a "pkger" property),
  // pkger.config.json, etc.
  toolbox.config = await createConfig(toolbox);
};
