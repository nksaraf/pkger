import padEnd from 'lodash/padEnd';
import chalk from 'chalk';
import { str } from './utils';
import asyncro from 'asyncro';
import Spinnies from 'spinnies';

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

export const createTask = (description: any, proce: any, run: any) => {
  return {
    run,
    description,
    process: proce,
    getSpinner: (spinnies: any) =>
      getSpinner(spinnies, { description, process: proce }, Array.isArray(description) ? description[0] : description),
  };
};

export function createSpinnies() {
  return new Spinnies({ color: 'cyan', spinnerColor: 'cyan' });
}

export async function runTask(
  task: any,
  spinnies: any,
  { silent = false, formatError = (e) => e.message } = {}
) {
  const spinner = task.getSpinner(spinnies);
  !silent && spinner.add();

  try {
    const result = await task.run();
    !silent && spinner.succeed(result);
  } catch (error) {
    !silent && spinner.fail(chalk.keyword('gray')(formatError(error)));
    throw error;
    // logError(error);
    // process.exit(1);
  }
}

export async function mapTasksParallel(
  tasks: any[],
  spinnies: any,
  { silent = false, formatError = (e) => e.message } = {}
) {
  return await asyncro
    .map(tasks, async (task: any) => {
      try {
        await runTask(task, spinnies, {
          silent,
          formatError: (e) => '\n' + e.toString(),
        });
      } catch (error) {
        throw new Error('\n' + str(tab('failed'), task.process[0], task.description));
      }
    })
    .catch((e) => {
      throw e;
    });
}

export const PROCESS = {
  EMIT: ['🧪 emitting', '🧪 emitted', 'magenta', 'green', 'red'],
  COMPILE: ['📦 compiling', '📦 compiled', 'cyan', 'green', 'red'],
  FIX: ['🔧 fixing', '🔧 fixed', 'blue', 'green', 'red'],
  WRITE: ['📝 writing', '📝 wrote', 'blue', 'green', 'red'],
  PKGER: ['👷 pkger', '👷 pkger', 'yellow', 'greenBright', 'bold'],
};

export const getSpinner = (spinnies: any, task: any, index: any) => {
  return {
    add: (message?: string) =>
      spinnies.add(index, {
        text: (chalk as any)[task.process[2]](
          str(proc(task.process[0]), Array.isArray(task.description) ? task.description[0] : task.description, ...(Array.isArray(message) ? message : [message]), '...')
        ),
      }),
    succeed: (message?: string) => {
      return spinnies.succeed(index, {
        text: (chalk as any)[task.process[3]](
          str(proc(task.process[1]), Array.isArray(task.description) ? task.description[1] : task.description, ...(Array.isArray(message) ? message : [message]))
        ),
      })
    },
      
    fail: (message?: string) =>
      spinnies.fail(index, {
        text: (chalk as any)[task.process[4]](
          str(proc(task.process[0]), Array.isArray(task.description) ? task.description[2] : task.description, ...(Array.isArray(message) ? message : [message]))
        ),
      }),
    pick: () => {
      return spinnies.pick(index)
    }
  };
};
