import { createConfig } from './config';
import { watch as rollupWatch } from 'rollup';
import { getRollupConfigs, showSize } from './compile/rollup';
import flatten from 'lodash/flatten';
import { PROCESS, runTask } from './proc';
import { typescriptTask } from './build';

import React from 'react';
import { render } from 'ink';
import { Color } from 'ink';
import { Spinner } from './Spinner';
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
    const pkgerProcess = manager.add('pkger', {
      taskType: PROCESS.PKGER,
      description: '',
      message: (
        <>
          waiting <Spinner type="simpleDotsScrolling" />
        </>
      ),
    });

    async function watcher() {
      const options = await createConfig(cliOptions);

      const { entries, ...root } = options;
      let rollupConfigs = flatten([
        getRollupConfigs(root),
        ...entries.map((entry) => getRollupConfigs(entry)),
      ]).map(({ label, ...rollupConfig }) => {
        // console.log(label, rollupConfig.input);

        return rollupConfig;
      });

      const rootProcess = manager.add(root.name, {
        taskType: PROCESS.COMPILE,
        description: root.name,
        message: <Spinner type="simpleDotsScrolling" />,
      });

      entries.map((entry) => {
        manager.add(entry.name, {
          taskType: PROCESS.COMPILE,
          description: entry.name,
          message: <Spinner type="simpleDotsScrolling" />,
        });
      });

      const typescriptProcess = manager.addTask(typescriptTask(options));

      rollupWatch(rollupConfigs).on('event', async (event) => {
        if (event.code === 'START') {
          pkgerProcess.start({
            message: (
              <>
                bundling changes <Spinner type="simpleDotsScrolling" />
              </>
            ),
          });
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
          pkgerProcess.fail({
            message: 'failed bundling',
          });
        }

        if (event.code === 'END') {
          try {
            await runTask(typescriptProcess.task);
            pkgerProcess.succeed({
              message: (
                <Color dim white>
                  waiting for changes
                  <Spinner type="simpleDotsScrolling" />
                </Color>
              ),
            });
          } catch (e) {
            pkgerProcess.fail({
              message: (
                <Color dim white>
                  waiting for changes <Spinner type="simpleDotsScrolling" />
                </Color>
              ),
            });
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
