import asyncro from 'asyncro';
import { GluegunToolbox } from 'gluegun';

export interface TaskEventHandlers {
  onError?: (error: any, task: Task) => void;
  onSuccess?: (result: string | undefined, task: Task) => void;
  onStart?: (task: Task) => void;
}

export interface TaskConfig extends TaskEventHandlers, Record<string, any> {
  name?: string;
  taskType?: any;
}

export interface Task extends TaskConfig {
  run: () => void | Promise<void> | Promise<string | undefined>;
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
  } else if (task.onStart) {
    task.onStart(task);
  }

  try {
    const result = (await task.run()) || undefined;
    if (onSuccess) {
      onSuccess(result, task);
    } else if (task.onSuccess) {
      task.onSuccess(result, task);
    }
  } catch (error) {
    if (onError) {
      onError(error, task);
    } else if (task.onError) {
      task.onError(error, task);
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
        await runTask(task, childHandlers);
      } catch (error) {
        error.task = task;
        throw error;
      }
    })
    .catch((e) => {
      throw e;
    });
}

export async function createParallelTask(
  name: string,
  tasks: any[],
  handlers: TaskConfig = {},
  childHandlers: TaskEventHandlers = {}
) {
  return createTask(
    name,
    handlers,
    async () => await mapTasksParallel(tasks, childHandlers)
  );
}

export const PROCESS = {
  EMIT: ['🧪', 'emitting', 'emitted', 'magenta', 'green', 'red'],
  COMPILE: ['📦', 'compiling', 'compiled', 'cyan', 'green', 'red'],
  FIX: ['🔧', 'fixing', 'fixed', 'blue', 'green', 'red'],
  WRITE: ['📝', 'writing', 'wrote', 'blue', 'green', 'red'],
  PKGER: ['👷', 'pkger', 'pkger', 'yellow', 'greenBright', 'bold'],
};

declare module 'gluegun' {
  interface GluegunTask {
    create: typeof createTask;
    createParallel: typeof createParallelTask;
    mapParallel: typeof mapTasksParallel;
    run: typeof runTask;
    TYPES: typeof PROCESS;
  }

  interface GluegunToolbox {
    task: GluegunTask;
  }
}

export default (toolbox: GluegunToolbox) => {
  toolbox.task = {
    create: createTask,
    createParallel: createParallelTask,
    mapParallel: mapTasksParallel,
    run: runTask,
    TYPES: PROCESS,
  };
};
