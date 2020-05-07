import React from 'react';
import { Box } from 'ink';
import { Color } from 'ink';
import { Spinner } from './Spinner';

import { createContext } from 'create-hook-context';
import { runTask } from '../proc';

export const [ProcessManager, useProcessManager] = createContext(
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
      dispatch({ ...props, name });

    // const fail = React.useCallback(
    //   (name, props) => {
    //     processDispatch(name)({ type: 'FAIL', ...props });
    //   },
    //   [dispatch]
    // );
    // const succeed = React.useCallback(
    //   (name, props) => {
    //     processDispatch(name)({ type: 'SUCCEED', ...props });
    //   },
    //   [dispatch]
    // );
    // const start = React.useCallback(
    //   (name, props) => {
    //     processDispatch(name)({ type: 'START', ...props });
    //   },
    //   [dispatch]
    // );
    const add = React.useCallback(
      (name, addProps = {}) => {
        processDispatch(name)({ ...addProps, type: 'ADD' });
        return {
          fail: (props = {}) => {
            processDispatch(name)({ ...props, type: 'FAIL' });
          },
          succeed: (props = {}) => {
            processDispatch(name)({ ...props, type: 'SUCCEED' });
          },
          start: (props = {}) => {
            processDispatch(name)({ ...props, type: 'START' });
          },
          reset: (props = {}) => {
            processDispatch(name)({ ...props, type: 'RESET' });
          },
        };
      },
      [dispatch]
    );

    const addTask = React.useCallback(
      (task, props = {}) => {
        processDispatch(task.name)({ ...props, type: 'ADD', ...task });

        const api = {
          fail: (props = {}) => {
            processDispatch(task.name)({ ...props, type: 'FAIL' });
          },
          succeed: (props = {}) => {
            processDispatch(task.name)({ ...props, type: 'SUCCEED' });
          },
          start: (props = {}) => {
            processDispatch(task.name)({ ...props, type: 'START' });
          },
          reset: (props = {}) => {
            processDispatch(task.name)({ ...props, type: 'RESET' });
          },
        };

        task.onSuccess = (result) => api.succeed({ result });
        task.onStart = api.start;
        task.onError = (error) => api.fail({ error });

        return {
          task,
          ...api,
          runTask: async () => {
            await runTask(task);
          },
        };
      },
      [dispatch]
    );

    const get = React.useCallback(
      (name) => {
        if (ref.current[name]) {
          return {
            fail: (props = {}) => {
              processDispatch(name)({ ...props, type: 'FAIL' });
            },
            succeed: (props = {}) => {
              processDispatch(name)({ ...props, type: 'SUCCEED' });
            },
            start: (props = {}) => {
              processDispatch(name)({ ...props, type: 'START' });
            },
            reset: (props = {}) => {
              processDispatch(name)({ ...props, type: 'RESET' });
            },
            ...ref.current[name],
          };
        }
        return null;
      },
      [dispatch]
    );
    // const reset = React.useCallback(
    //   (name, props) => {
    //     processDispatch(name)({ type: 'RESET', ...props });
    //   },
    //   [dispatch]
    // );

    return {
      // processDispatch,
      processes: ref,
      dispatch,
      addTask,
      // fail,
      // succeed,
      // start,
      add,
      get,
      // reset,
    };
  }
);

export const getColor = (status, procType) =>
  (procType &&
    procType[
      {
        running: 3,
        success: 4,
        error: 5,
      }[status]
    ]) ||
  'dim';

export const getCommand = (status, procType) => {
  return (
    (procType &&
      procType[
        {
          idle: 1,
          running: 1,
          success: 2,
          error: 1,
        }[status]
      ]) ||
    'waiting'
  );
};

export function Process({ process }) {
  const pm = useProcessManager();
  const thisProcess = pm.get(process);
  if (!thisProcess) {
    return null;
  }
  const t = thisProcess.taskType;
  return (
    <Box>
      <Box>
        {thisProcess.status === 'running' && (
          <Spinner type="dots" color="cyan" />
        )}
        {thisProcess.status === 'idle' && <Spinner color="dim" type="dots" />}
        {thisProcess.status === 'success' && <Color green>✔ </Color>}
        {thisProcess.status === 'error' && <Color red>✖ </Color>}
      </Box>
      <Box>
        <Color {...{ [getColor(thisProcess.status, t)]: true }}>
          <Box width="12">
            {t[0]} {getCommand(thisProcess.status, t)}
          </Box>
          {thisProcess.description ? (
            <>
              {typeof thisProcess.description === 'string'
                ? thisProcess.description
                : thisProcess.description[thisProcess.status]}{' '}
            </>
          ) : (
            ''
          )}
          {thisProcess.message}{' '}
          {thisProcess.status === 'idle' || thisProcess.status === 'running' ? (
            <Spinner type="simpleDotsScrolling" />
          ) : null}
        </Color>
      </Box>
    </Box>
  );
}
