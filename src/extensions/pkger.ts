import { Task, list } from './task';
import { Toolbox, GluegunToolbox } from 'gluegun';
import { PackageOptions } from '../types';
import { typescriptTask } from '../builders/tsc';

declare module 'gluegun' {
  interface GluegunPkger {
    build: (options: any) => Task[];
  }

  interface GluegunBuilders {
    tsc?: (pkg: PackageOptions, toolbox: Toolbox) => Task[];
  }

  interface Toolbox extends GluegunToolbox {
    pkger: GluegunPkger;
    build: GluegunBuilders;
  }
}

export default (toolbox: Toolbox) => {
  toolbox.build = toolbox.build ?? ({} as any);
  toolbox.build.tsc = (pkg: PackageOptions, toolbox: Toolbox) => {
    return list(typescriptTask(pkg));
  };

  function build(pkg: PackageOptions) {
    const { builder, ...root } = pkg;
    try {
      if (toolbox.build[builder]) {
        return list(...toolbox.build[builder](pkg, toolbox));
      }
    } catch (e) {
      console.log(e);
    }
  }

  toolbox.pkger = {
    build: build,
  };
};
