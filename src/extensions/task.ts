import asyncro from 'asyncro';
import { Toolbox } from 'gluegun';
import { flatten } from 'lodash';

export interface TaskEventHandlers {
  onError?: (error: any, task: Task) => void;
  onSuccess?: (result: string | undefined, task: Task) => void;
  onStart?: (task: Task) => void;
}

export interface TaskConfig extends TaskEventHandlers, Record<string, any> {
  name?: string;
  taskType?: any;
  description?: string | { [key: string]: string };
}

export interface Task extends TaskConfig {
  run: () => void | Promise<void> | Promise<any>;
}

export const createTask = (
  name: string,
  config: TaskConfig,
  run: Task['run']
): Task => {
  return {
    run,
    name,
    description: name,
    ...config,
  };
};

export async function runTask(
  task: Task,
  { onError, onSuccess, onStart }: TaskEventHandlers = {}
) {
  if (onStart) {
    onStart(task);
  }
  if (task.onStart) {
    task.onStart(task);
  }

  try {
    const result = (await task.run()) || undefined;

    if (onSuccess) {
      onSuccess(result, task);
    }
    if (task.onSuccess) {
      task.onSuccess(result, task);
    }
  } catch (error) {
    if (onError) {
      onError(error, task);
    } else if (task.onError) {
      task.onError(error, task);
    } else {
      throw error;
    }
  }
}

export async function mapTasksParallel(
  tasks: Task[],
  childHandlers: TaskEventHandlers = {}
) {
  return await asyncro
    .map(tasks, async (task: any) => {
      try {
        return await runTask(task, childHandlers);
      } catch (error) {
        error.task = task;
        throw error;
      }
    })
    .catch((e) => {
      throw e;
    });
}

export function createParallelTask(
  name: string,
  tasks: any[],
  handlers: TaskConfig = {},
  childHandlers: TaskEventHandlers = {}
) {
  return createTask(
    name,
    handlers,
    async () => await mapTasksParallel(list(tasks), childHandlers)
  );
}

export const PROCESS = {
  EMIT: ['🧪', 'emitting', 'emitted', 'magenta', 'green', 'red'],
  COMPILE: ['📦', 'compiling', 'compiled', 'cyan', 'green', 'red'],
  FIX: ['🔧', 'fixing', 'fixed', 'blue', 'green', 'red'],
  WRITE: ['📝', 'writing', 'wrote', 'blue', 'green', 'red'],
  PKGER: ['👷', 'pkger', 'pkger', 'yellow', 'greenBright', 'red'],
};

declare module 'gluegun' {
  interface GluegunTask {
    create: typeof createTask;
    createParallel: typeof createParallelTask;
    mapParallel: typeof mapTasksParallel;
    run: typeof runTask;
    TYPES: typeof PROCESS;
  }

  interface Toolbox {
    task: GluegunTask;
  }
}

export default (toolbox: Toolbox) => {
  toolbox.task = {
    create: createTask,
    createParallel: createParallelTask,
    mapParallel: mapTasksParallel,
    run: runTask,
    TYPES: PROCESS,
  };
};

export function list<T>(...tasks: (T | T[])[]): T[] {
  return flatten(Array.isArray(tasks) ? tasks : [tasks]).filter(Boolean);
}
