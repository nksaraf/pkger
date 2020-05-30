import * as fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import camelCase from 'camelcase';
import execa from 'execa';
import { list } from './extensions/task';
import { PackageOptions } from "./types";

export let DEBUG = process.argv.includes('--dev');

// Remove the package name scope if it exists
export const removeScope = (name: string) => name.replace(/^@.*\//, '');

// UMD-safe package name
export const safeVariableName = (name: string) =>
  camelCase(
    removeScope(name)
      .toLowerCase()
      .replace(/((^[^a-zA-Z]+)|[^\w.-])|([^a-zA-Z0-9]+$)/g, '')
  );

export const safePackageName = (name: string) =>
  name
    .toLowerCase()
    .replace(/(^@.*\/)|((^[^a-zA-Z]+)|[^\w.-])|([^a-zA-Z0-9]+$)/g, '');

// export const external = (id: string) =>
//   !id.startsWith('.') && !path.isAbsolute(id);

// Make sure any symlinks in the project folder are resolved:
// https://github.com/facebookincubator/create-react-app/issues/637
export const pkgDirectory = fs.realpathSync(process.cwd());

export const resolvePkgPath = function (relativePath: string) {
  return path.resolve(pkgDirectory, relativePath);
};

export const paths = {
  packageJson: resolvePkgPath('package.json'),
  tsconfigJson: resolvePkgPath('tsconfig.build.json'),
  // testsSetup: resolveApp('test/setupTests.ts'),
  appRoot: resolvePkgPath('.'),
  appSrc: resolvePkgPath('lib'),
  // appErrorsJson: resolveApp('errors/codes.json'),
  // appErrors: resolveApp('errors'),
  appDist: resolvePkgPath('dist'),
  // jestConfig: resolveApp('jest.config.js'),
  progressEstimatorCache: resolvePkgPath(
    'node_modules/.cache/.progress-estimator'
  ),
};

// Taken from Create React App, react-dev-utils/clearConsole
// @see https://github.com/facebook/create-react-app/blob/master/packages/react-dev-utils/clearConsole.js
export function clearConsole() {
  process.stdout.write(
    process.platform === 'win32' ? '\x1B[2J\x1B[0f' : '\x1B[2J\x1B[3J\x1B[H'
  );
}

export function getReactVersion({
  dependencies,
  devDependencies,
}: PackageOptions) {
  return (
    (dependencies && dependencies.react) ||
    (devDependencies && devDependencies.react)
  );
}

export const isDir = (name: string) =>
  fs
    .stat(name)
    .then((stats) => stats.isDirectory())
    .catch(() => false);

export const isFile = (name: string) =>
  fs
    .stat(name)
    .then((stats) => stats.isFile())
    .catch(() => false);

const stderr = console.error.bind(console);

export function logError(err: any) {
  const error = err.error || err;
  const description = `${error.name ? error.name + ': ' : ''}${
    error.message || error
  }`;
  const message = error.plugin
    ? error.plugin === 'rpt2'
      ? `(typescript) ${description}`
      : `(${error.plugin} plugin) ${description}`
    : description;

  stderr(chalk.bold.red(message));

  if (error.loc) {
    stderr();
    stderr(`at ${error.loc.file}:${error.loc.line}:${error.loc.column}`);
  }

  if (error.frame) {
    stderr();
    stderr(chalk.dim(error.frame));
  } else if (err.stack) {
    const headlessStack = error.stack.replace(message, '');
    stderr(chalk.dim(headlessStack));
  }

  stderr();
}

export const str = (...args: (string | undefined)[]) =>
  args.filter(Boolean).join(' ');

export function runCommand(command?: string) {
  if (!command) {
    return null;
  }

  const [exec, ...args] = command.split(' ');
  return execa(exec, args, {
    stdio: 'pipe',
  });
}

export async function cleanDistFolder() {
  await fs.remove(paths.appDist);
}

export function getOutputPath(options: PackageOptions) {
  return path.join(
    ...list([
      paths.appDist,
      options.outputFormat,
      options.env,
      list([options.entryName ?? options.name, 'js']).join('.'),
    ])
  );
}
