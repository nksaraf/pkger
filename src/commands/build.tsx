import { GluegunCommand } from 'gluegun';
import React from 'react';
import { Box } from 'ink';

import asyncro from 'asyncro';
import {
  safePackageName,
  getOutputPath,
  cleanDistFolder,
  runCommand,
  str,
  logError,
} from '../utils';
import { BuildOpts } from '../types';
import * as fs from 'fs-extra';
import { paths } from '../utils';
import flatten from 'lodash/flatten';
import path, { join } from 'path';
import {
  createRollupTask,
  getRollupConfigs,
  showSize,
} from '../compile/rollup';
import { getRelativePath } from '../extensions/config';
import { mapTasksParallel, createParallelTask } from '../proc';

export function cjsEntryFile(name: string) {
  const baseLine = `module.exports = require('./`;
  return `
'use strict'

if (process.env.NODE_ENV === 'production') {
  ${baseLine}production/${name}.js')
} else {
  ${baseLine}development/${name}.js')
}
`;
}

function addBin(pkg: { cmd: any; name: string }) {
  return (pkgJson: { [x: string]: any }) => {
    const outputPath = getOutputPath({
      ...pkg,
      format: 'cjs',
    });
    return {
      ...pkgJson,
      bin: {
        ...pkgJson['bin'],
        [pkg.cmd || safePackageName(pkg.name)]: getRelativePath(
          process.cwd(),
          outputPath
        ),
      },
    };
  };
}

function ensureInFiles(entryName: string) {
  return (pkgJson: { [x: string]: any }) => {
    const { files = [], ...other } = pkgJson;
    if (!files.some((f: any) => f === entryName)) {
      files.push(entryName);
    }
    return {
      ...other,
      files,
    };
  };
}

function transformPackageJsonTask(options, transforms: any[] = []) {
  const { entries, ...root } = options;
  const transform = (pkgJson: any) => {
    for (var t of [
      ...[
        // add types for 'types'
        // make sure files has everythin
        // add module for 'esm'
        root.format.includes('esm') &&
          ((p: any) => ({
            ...p,
            module: getRelativePath(
              process.cwd(),
              getOutputPath({ ...root, format: 'esm' })
            ),
          })),
        root.target === 'browser' &&
          ((p: any) => ({
            ...p,
            browser: getRelativePath(
              process.cwd(),
              getOutputPath({ ...root, format: 'esm' })
            ),
          })),
        root.format.includes('cjs') &&
          ((p: any) => ({
            ...p,
            main: getRelativePath(
              process.cwd(),
              getOutputPath({ ...root, format: 'cjs' })
            ),
          })),
        (p: any) => ({
          ...p,
          types:
            options.tsconfigContents.compilerOptions['declarationDir'] ||
            'dist/types' ||
            'dist/types',
        }),
        // add bin for 'cli'
        ...[entries, root]
          .filter((entry) => entry.target === 'cli')
          .map((pkg) => addBin(pkg)),
        ...entries
          .filter((entry: { target: string }) => entry.target !== 'cli')
          .map((pkg: { cmd: any; entryName: string }) =>
            ensureInFiles(pkg.entryName)
          ),
        ensureInFiles('dist'),
        ensureInFiles(
          options.tsconfigContents.compilerOptions['declarationDir'] ||
            'dist/types'
        ),
      ].filter(Boolean),
      ...transforms,
    ]) {
      if (t) {
        pkgJson = t(pkgJson);
      }
    }
    return pkgJson;
  };

  return createTask('package.json', { taskType: PROCESS.FIX }, async () => {
    const json = await fs.readJson(paths.packageJson);
    const transformed = transform(json);
    await fs.writeFile(paths.packageJson, JSON.stringify(transformed, null, 2));
  });
}

export function nonRollupTasks(pkg) {
  const { format } = pkg;
  return [
    format.includes('cjs') &&
      createTask(
        str(pkg.name, 'cjs', 'entry'),
        { taskType: PROCESS.WRITE },
        async () => {
          const outputPath = getOutputPath({ ...pkg, format: 'cjs' });
          await fs.outputFile(
            outputPath,
            cjsEntryFile(pkg.entryName || pkg.name)
          );
        }
      ),
    !pkg.root &&
      pkg.target !== 'cli' &&
      createTask(
        str(pkg.name, 'package.json'),
        { taskType: PROCESS.FIX },
        async () => {
          fs.mkdirp(path.join(process.cwd(), pkg.entryName));
          const packageJson = {
            name: pkg.name,
            private: true,
            ...(pkg.format.includes('cjs')
              ? {
                  main: getRelativePath(
                    path.join(process.cwd(), pkg.entryName),
                    getOutputPath({ ...pkg, format: 'cjs' })
                  ),
                }
              : {}),
            ...(pkg.format.includes('esm')
              ? {
                  module: getRelativePath(
                    path.join(process.cwd(), pkg.entryName),
                    getOutputPath({ ...pkg, format: 'esm' })
                  ),
                }
              : {}),
            types:
              '../' +
              (pkg.tsconfigContents.compilerOptions['declarationDir'] ||
                'dist/types'),
          };
          await fs.writeFile(
            path.join(process.cwd(), pkg.entryName, 'package.json'),
            JSON.stringify(packageJson, null, 2)
          );
        }
      ),
  ].filter(Boolean);
}

export function packageTasks(pkg: any) {
  return createParallelTask(
    pkg.name,
    [
      ...getRollupConfigs(pkg).map(createRollupTask),
      ...nonRollupTasks(pkg),
    ].filter(Boolean),
    { taskType: PROCESS.COMPILE }
  );
}

export function typescriptTask(options: any) {
  return createTask('typescript', { taskType: PROCESS.EMIT }, async () => {
    await runCommand(`tsc -p ${options.tsconfig}`);
  });
}

async function createAllTasks(options: any) {
  const { entries, ...root } = options;
  return flatten(
    await Promise.all([
      packageTasks(root),
      ...entries.map((entry: any) => packageTasks(entry)),
      transformPackageJsonTask(options, []),
      typescriptTask(options),
    ])
  );
}

import { PROCESS, createTask } from '../proc';
import {
  ProcessManager,
  useProcessManager,
  Process,
} from '../components/Process';
import { useToolbox } from '../components/Toolbox';

function Build() {
  const toolbox = useToolbox();
  const manager = useProcessManager();

  React.useEffect(() => {
    const pkgerProcess = manager.add('build', {
      taskType: PROCESS.PKGER,
      description: {
        running: 'building',
        success: 'built',
        fail: 'failed to build',
      },
    });

    pkgerProcess.start();
    async function builder() {
      try {
        const config = toolbox.config;
        await cleanDistFolder();
        const tasks = (await createAllTasks(config)).map(
          (task) => manager.addTask(task).task
        );
        await mapTasksParallel(tasks);
        pkgerProcess.succeed();
      } catch (e) {
        pkgerProcess.fail();
      }
    }

    builder();
  }, []);

  return (
    <>
      {Object.keys(manager.processes.current).map((proc) => (
        <Process key={proc} process={proc} />
      ))}
    </>
  );
}

export default {
  name: 'build',
  run: async (toolbox) => {
    const { print, render } = toolbox;

    render(
      <ProcessManager>
        <Build />
      </ProcessManager>
    );
  },
} as GluegunCommand;
