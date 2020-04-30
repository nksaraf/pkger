import { createConfig } from './config';
import { watch as rollupWatch } from 'rollup';
import execa from 'execa';
import ora from 'ora';
import { getRollupConfigs, showSize } from './compile/rollup';
import flatten from 'lodash/flatten';
import {
  clearConsole,
  logError,
  runCommand,
  // createProgressEstimator,
  cleanDistFolder,
} from './utils';
import chalk from 'chalk';
import { getSpinner, PROCESS, runTask, proc } from './proc';
import { typescriptTask } from './build';
import React, { useState, useReducer } from 'react';
import { Box, render } from 'ink';
import { Color } from 'ink';
import createContext from 'create-hook-context';

const [ProcessManager, useProcessManager] = createContext(
  function useProcessManager({}: object) {
    const [processes, dispatch] = React.useReducer(
      (state, { type, name, ...ctx }) => {
        switch (type) {
          case 'START': {
            return {
              ...state,
              [name]: {
                ...state[name],
                status: 'running',
                ...ctx,
              },
            };
          }
          case 'ADD':
          case 'RESET': {
            return {
              ...state,
              [name]: {
                ...state[name],
                status: 'idle',
                ...ctx,
              },
            };
          }
          case 'FAIL': {
            return {
              ...state,
              [name]: {
                ...state[name],
                status: 'fail',
                ...ctx,
              },
            };
          }
          case 'SUCCEED': {
            return {
              ...state,
              [name]: {
                ...state[name],
                status: 'success',
                ...ctx,
              },
            };
          }
          default:
            return state;
        }
      },
      {}
    );
    const ref = React.useRef(processes);
    ref.current = processes;

    const processDispatch = (name: string) => (props) =>
      dispatch({ name, ...props });

    const fail = React.useCallback(
      (name, props) => {
        processDispatch(name)({ type: 'FAIL', ...props });
      },
      [dispatch]
    );
    const succeed = React.useCallback(
      (name, props) => {
        processDispatch(name)({ type: 'SUCCEED', ...props });
      },
      [dispatch]
    );
    const start = React.useCallback(
      (name, props) => {
        processDispatch(name)({ type: 'START', ...props });
      },
      [dispatch]
    );
    const add = React.useCallback(
      (name, props) => {
        processDispatch(name)({ type: 'ADD', ...props });
      },
      [dispatch]
    );
    const reset = React.useCallback(
      (name, props) => {
        processDispatch(name)({ type: 'RESET', ...props });
      },
      [dispatch]
    );

    return {
      processDispatch,
      processes: ref,
      dispatch,
      fail,
      succeed,
      start,
      add,
      reset,
    };
  }
);

export async function watch(cliOpts: any) {
  const options = await createConfig(cliOpts);

  render(
    <ProcessManager>
      <Watch options={options} />
    </ProcessManager>
  );
}

type Killer = execa.ExecaChildProcess | null;

function Watch({ options }) {
  // let successKiller = React.useRef<Killer>(null);
  // let failureKiller = React.useRef<Killer>(null);

  // function killHooks() {
  //   return Promise.all([
  //     successKiller ? successKiller.current.kill('SIGTERM') : null,
  //     failureKiller ? failureKiller.current.kill('SIGTERM') : null,
  //   ]);
  // }

  const pm = useProcessManager();

  // const [bundles, setBundles] = React.useState(() => {
  //   Object.fromEntries(
  //     [configs.root, ...configs].map((entry) => [
  //       entry.name,
  //       { status: 'idle', name: entry.name, fileSize: undefined },
  //     ])
  //   );
  // });

  React.useEffect(() => {
    pm.add('pkger', {
      processType: PROCESS.PKGER,
      description: '',
      message: (
        <>
          waiting <Spinner type="simpleDotsScrolling" />
        </>
      ),
    });
    const { entries, ...root } = options;
    let configs = flatten([
      getRollupConfigs(root),
      ...entries.map((entry) => getRollupConfigs(entry)),
    ]);

    entries.map((entry) => {
      pm.add(entry.name, {
        processType: PROCESS.COMPILE,
        description: entry.name,
        message: (
          <>
            {entry.name} <Spinner type="simpleDotsScrolling" />
          </>
        ),
      });
    });

    pm.add(root.name, {
      processType: PROCESS.COMPILE,
      description: root.name,
      message: (
        <>
          {root.name} <Spinner type="simpleDotsScrolling" />
        </>
      ),
    });

    configs = configs.map(({ label, ...rollupConfig }) => {
      return rollupConfig;
    });

    rollupWatch(configs).on('event', async (event) => {
      // clear previous onSuccess/onFailure hook processes so they don't pile up
      // await killHooks();
      // console.log(event);
      if (event.code === 'START') {
        pm.start('pkger', {
          message: (
            <>
              bundling changes <Spinner type="simpleDotsScrolling" />
            </>
          ),
        });
        // if (!cliOpts.verbose) {
        //   clearConsole();
        // }
        // unhook_intercept = intercept(function(text: string) {
        //   return '';
        // });
        // console.log("This text won't be sent to stdout.");
        // Stop capturing stdout.
        // compileSpinner.add('working');
        // spinner.start(chalk.bold.cyan('Compiling modules...'));
      }

      if (event.code === 'BUNDLE_START') {
        // console.log(event.output);
        const pkg = [root, ...entries].find(
          (entry) => entry.source === event.input
        );
        pm.start(pkg.name, {});
        // spinners[pkg.name].spinner.add();
      }

      if (event.code === 'BUNDLE_END') {
        const pkg = [root, ...entries].find(
          (entry) => entry.source === event.input
        );

        if (pkg && pm.processes.current[pkg.name]) {
          const r = await pkg.result;
          const bundle = await event.result.generate({});
          const size = showSize(bundle.output[0]);
          if (
            !pm.processes.current[pkg.name].size ||
            pm.processes.current[pkg.name].size > size
          ) {
            pm.succeed(pkg.name, { size: size, message: size });
          } else {
            pm.succeed(pkg.name, { message: size });
          }
        }
        // .filter((bundle) => !bundle.isAsset)
        // .forEach((bundle) => showSize(bundle));)
      }

      if (event.code === 'ERROR') {
        // compileSpinner.fail('failed to compile');
        // // logError(event.error);
        // failureKiller = runCommand(cliOpts.onFailure);
        pm.fail('pkger', {
          message: 'failed bundling',
        });
      }

      if (event.code === 'END') {
        // run(opts.onFirstSuccess);
        // } else {
        try {
          await runTask(typescriptTask(options), null, { silent: true });
          pm.succeed('pkger', {
            message: 'waiting for changes',
          });
        } catch (e) {
          pm.fail('pkger', {
            message: (
              <Color dim white>
                waiting for changes <Spinner type="simpleDotsScrolling" />
              </Color>
            ),
          });
        }
        // typecheckSpinner.add();
      }
    });
  }, [options]);

  return (
    <>
      <Process process="pkger" />
      <Process process={options.name} />
      {options.entries.map((entry) => (
        <Process process={entry.name} />
      ))}
    </>
  );
}

// str(
//   proc(task.process[0]),
//   Array.isArray(task.description) ? task.description[0] : task.description,
//   ...(Array.isArray(message) ? message : [message]),
//   '...'
// );

const getColor = (status, procType) =>
  (procType &&
    procType[
      {
        running: 2,
        success: 3,
        error: 4,
      }[status]
    ]) ||
  'yellow';

const getCommand = (status, procType) => {
  return (
    (procType &&
      procType[
        {
          idle: 0,
          running: 0,
          success: 1,
          error: 0,
        }[status]
      ]) ||
    'waiting'
  );
};

function Process({ process }) {
  const pm = useProcessManager();
  const thisProcess = pm.processes.current[process];
  if (!thisProcess) {
    return null;
  }

  const t = thisProcess.processType;

  return (
    <Box>
      <Box>
        {thisProcess.status === 'running' && (
          <Spinner type="dots" color="cyan" />
        )}
        {thisProcess.status === 'idle' && (
          <Spinner color="yellow" type="dots" />
        )}
        {thisProcess.status === 'success' && <Color green>✔ </Color>}
        {thisProcess.status === 'error' && <Color red>✖ </Color>}
      </Box>
      <Box>
        <Color {...{ [getColor(thisProcess.status, t)]: true }}>
          <Box width="12">{getCommand(thisProcess.status, t)}</Box>
          {thisProcess.description && thisProcess.description + ' '}
          {thisProcess.message}
        </Color>
      </Box>
    </Box>
  );
}

import spinners from 'cli-spinners';

function Spinner({ type, children = null, color = 'white' }) {
  const [frame, setFrame] = React.useState(0);
  const spinnerRef = React.useRef(
    typeof type === 'string' ? spinners[type] : type || spinners.dots
  );

  const frameRef = React.useRef(frame);
  frameRef.current = frame;

  React.useEffect(() => {
    const switchFrame = () => {
      const spinner = spinnerRef.current;
      const frame = frameRef.current;
      const isLastFrame = frameRef.current === spinner.frames.length - 1;
      const nextFrame = isLastFrame ? 0 : frame + 1;

      setFrame(nextFrame);
    };

    let timer = setInterval(switchFrame, spinnerRef.current.interval);
    return () => {
      clearInterval(timer);
    };
  }, []);

  return (
    <Box>
      <Color {...{ [color]: true }}>
        {spinnerRef.current.frames[frame]} {children}
      </Color>
    </Box>
  );
}
