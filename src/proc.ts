import padEnd from 'lodash/padEnd';
import chalk from 'chalk';
import { str } from './utils';
import asyncro from 'asyncro';

const PROC_WIDTH = 12;
const SPINNER_PADDING = '  ';
const TAB_WIDTH = 2;
const TAB = '  ';

export function proc(command: string): string {
  return padEnd(command, 12, ' ');
}

export function tab(command: string): string {
  return SPINNER_PADDING + TAB + padEnd(command, PROC_WIDTH - TAB_WIDTH, ' ');
}

interface TaskEventHandlers {
  onError?: (error: any, task: Task) => void;
  onSuccess?: (result: string | undefined, task: Task) => void;
  onStart?: (task: Task) => void;
}

interface TaskConfig extends TaskEventHandlers, Record<string, any> {
  name?: string;
  taskType?: any;
}

interface Task extends TaskConfig {
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

// export function createSpinnies() {
//   return new Spinnies({ color: 'cyan', spinnerColor: 'cyan' });
// }

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

// const processManager = () => {};

// export const getSpinner = (spinnies: any, task: any, index: any) => {
//   return {
//     add: (message?: string) =>
//       spinnies.add(index, {
//         text: (chalk as any)[task.process[2]](
//           str(proc(task.process[0]), Array.isArray(task.description) ? task.description[0] : task.description, ...(Array.isArray(message) ? message : [message]), '...')
//         ),
//       }),
//     succeed: (message?: string) => {
//       return spinnies.succeed(index, {
//         text: (chalk as any)[task.process[3]](
//           str(proc(task.process[1]), Array.isArray(task.description) ? task.description[1] : task.description, ...(Array.isArray(message) ? message : [message]))
//         ),
//       })
//     },

//     fail: (message?: string) =>
//       spinnies.fail(index, {
//         text: (chalk as any)[task.process[4]](
//           str(proc(task.process[0]), Array.isArray(task.description) ? task.description[2] : task.description, ...(Array.isArray(message) ? message : [message]))
//         ),
//       }),
//     pick: () => {
//       return spinnies.pick(index)
//     }
//   };
// };
