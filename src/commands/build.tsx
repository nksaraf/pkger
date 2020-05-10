import { GluegunCommand } from 'gluegun';
import React from 'react';
import { paths } from '../utils';

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
      taskType: toolbox.task.TYPES.PKGER,
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
        await toolbox.filesystem.removeAsync(paths.appDist);
        const tasks = (await toolbox.pkger.build(config)).map(
          (task) => manager.addTask(task).task
        );
        await toolbox.task.mapParallel(tasks);
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
    toolbox.ink.render(
      <ProcessManager>
        <Build />
      </ProcessManager>
    );
  },
} as GluegunCommand;
