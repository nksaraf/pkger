import React from 'react';
import { paths } from '../utils';
import { Box, Color } from 'ink';
import {
  ProcessManager,
  useProcessManager,
  Process,
} from '../components/Process';
import { useToolbox } from '../components/Toolbox';
import { Toolbox } from 'gluegun';

import '../extensions/pkger';

export function Build() {
  const toolbox = useToolbox();
  const manager = useProcessManager();

  React.useEffect(() => {
    const buildTask = manager.addTask(
      toolbox.task.create(
        'build',
        {
          taskType: toolbox.task.TYPES.PKGER,
          description: {
            running: 'building',
            success: 'built',
            fail: 'failed to build',
          },
          onError: (e) => {
            throw e;
          },
        },
        async () => {
          const config = toolbox.config;
          let error = false;
          try {
            await toolbox.filesystem.removeAsync(paths.appDist);
            await config.preBuild(toolbox, config);
            const tasks = toolbox.pkger
              .build(config)
              .map((task) => manager.addTask(task).task);
            await toolbox.task.mapParallel(tasks, {
              onError: (e) => {
                error = e;
              },
            });
            await config.postBuild(toolbox, config);
          } catch (e) {
            config.onBuildError(toolbox, config);
            throw e;
          }
          if (error) {
            throw new Error('A process failed: ' + (error as any).message);
          }
        }
      )
    );

    buildTask.runTask();
  }, []);

  if (toolbox.config.silent) {
    return null;
  }

  return (
    <>
      {Object.keys(manager.processes.current).map((proc) => (
        <Process key={proc} id={proc} />
      ))}
      {Object.keys(manager.processes.current).map((proc) => (
        <ProcessResult key={proc} id={proc} />
      ))}
    </>
  );
}

function ProcessResult({ id }) {
  const manager = useProcessManager();
  const process = manager.get(id);
  if (!process) {
    return null;
  }
  if (process.error && process.error.stdout) {
    return (
      <>
        <Color>
          <Box>
            {process.taskType[0]} {id}
          </Box>
        </Color>
        <Color red>
          <Box flexDirection="column">{process.error.stdout}</Box>
        </Color>
      </>
    );
  }

  if (process.result && process.result.stdout) {
    return <Box>{process.result.stdout}</Box>;
  }

  return null;
}

export default {
  name: 'build',
  run: async (toolbox: Toolbox) => {
    toolbox.config.debug && console.log('[debug] building...');
    toolbox.ink.render(
      <ProcessManager>
        <Build key={1} />
      </ProcessManager>
    );
  },
};
