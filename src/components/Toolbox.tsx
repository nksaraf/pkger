import { createContext } from 'create-hook-context';
import { GluegunToolbox } from 'gluegun';

export const [ToolboxProvider, useToolbox, withToolbox] = createContext<
  GluegunToolbox,
  { toolbox: GluegunToolbox }
>(
  ({ toolbox }) => {
    return toolbox;
  },
  undefined,
  'Toolbox'
);
