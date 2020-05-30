import { GluegunCommand } from 'gluegun';
import React from 'react';
import { ProcessManager } from '../components/Process';
import { Build } from './build';

export default {
  name: 'pkger',
  run: async (toolbox) => {
    toolbox.config.debug && console.log('[debug] building...');
    toolbox.ink.render(
      <ProcessManager>
        <Build key={1} />
      </ProcessManager>
    );
  },
} as GluegunCommand;
