import { GluegunCommand } from 'gluegun';

export default {
  name: 'run',
  run: async (toolbox) => {
    const { config } = toolbox;
    if (toolbox.parameters.first) {
      config.dev &&
        console.log('[debug] running task: ' + toolbox.parameters.first);
      await config.tasks[toolbox.parameters.first](toolbox, config);
    }
  },
} as GluegunCommand;
