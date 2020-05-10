import { GluegunCommand } from 'gluegun';

export default {
  name: 'pkger',
  run: async (toolbox) => {
    const { print } = toolbox;
    print.info('Welcome to your CLI');
  },
} as GluegunCommand;
