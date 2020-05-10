import { createContext } from 'create-hook-context';
import { Toolbox } from 'gluegun';

export const [ToolboxProvider, useToolbox, withToolbox] = createContext<
  Toolbox,
  { toolbox: Toolbox }
>(
  ({ toolbox }) => {
    return toolbox;
  },
  undefined,
  'Toolbox'
);
