import { createConfig } from './config';
import { watch as rollupWatch } from 'rollup';
import { getRollupConfigs, showSize } from './compile/rollup';
import flatten from 'lodash/flatten';
import { PROCESS, runTask } from './proc';
import { typescriptTask } from './build';

import React from 'react';
import { render } from 'ink';
import { Color } from 'ink';
import { Process, ProcessManager, useProcessManager } from './Process';

export async function watch(cliOpts: any) {
  render(
    <ProcessManager>
      <Watch cliOptions={cliOpts} />
    </ProcessManager>
  );
}

function Watch({ cliOptions }) {
  const manager = useProcessManager();

  React.useEffect(() => {
    const pkgerProcess = manager.add('watch', {
      taskType: PROCESS.PKGER,
      description: {
        idle: <Color white>waiting for changes</Color>,
        running: 'bundling',
        fail: (
          <Color dim red>
            failed bundling, waiting for changes
          </Color>
        ),
      },
    });

    async function watcher() {
      const options = await createConfig(cliOptions);

      const { entries, ...root } = options;
      let rollupConfigs = flatten([
        getRollupConfigs(root),
        ...entries.map((entry) => getRollupConfigs(entry)),
      ]).map(({ label, ...rollupConfig }) => {
        return rollupConfig;
      });

      const rootProcess = manager.add(root.name, {
        taskType: PROCESS.COMPILE,
        description: root.name,
      });

      entries.map((entry) => {
        manager.add(entry.name, {
          taskType: PROCESS.COMPILE,
          description: entry.name,
        });
      });

      const typescriptProcess = manager.addTask(typescriptTask(options));

      rollupWatch(rollupConfigs).on('event', async (event) => {
        if (event.code === 'START') {
          pkgerProcess.start();
        }

        if (event.code === 'BUNDLE_START') {
          const pkg = [root, ...entries].find(
            (entry) => entry.source === event.input
          );
          const entryProcess = manager.get(pkg.name);
          entryProcess.start();
        }

        if (event.code === 'BUNDLE_END') {
          const pkg = [root, ...entries].find(
            (entry) => entry.source === event.input
          );
          const entryProcess = manager.get(pkg.name);
          if (entryProcess) {
            const bundle = await event.result.generate({});
            const size = showSize(bundle.output[0]);
            if (!entryProcess.size || entryProcess.size > size) {
              entryProcess.succeed({ size: size, message: size });
            } else {
              entryProcess.succeed({ message: size });
            }
          }
        }

        if (event.code === 'ERROR') {
          pkgerProcess.fail();
        }

        if (event.code === 'END') {
          try {
            await runTask(typescriptProcess.task);
            pkgerProcess.reset();
          } catch (e) {
            pkgerProcess.fail(e);
          }
        }
      });
    }
    watcher();
  }, [cliOptions]);

  return (
    <>
      {Object.keys(manager.processes.current).map((proc) => (
        <Process key={proc} process={proc} />
      ))}
    </>
  );
}
