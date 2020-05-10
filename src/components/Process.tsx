import React from 'react';
import { Box } from 'ink';
import { Color } from 'ink';
import { Spinner } from './Spinner';

import { createContext } from 'create-hook-context';
import { runTask } from '../extensions/task';

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
          case 'INIT':
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
                status: 'error',
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

    const taskApi = (name) => {
      return {
        fail: (props = {}) => {
          processDispatch(name)({ ...props, type: 'FAIL' });
        },
        init: (props = {}) => {
          processDispatch(name)({ ...props, type: 'INIT' });
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
    };

    const add = React.useCallback(
      (name, addProps = {}) => {
        const api = taskApi(name);
        api.init(addProps);
        return api;
      },
      [dispatch]
    );

    const addTask = React.useCallback(
      (task, props = {}) => {
        const api = taskApi(task.name);
        api.init({ ...props, ...task });
        task.onSuccess = (result) => api.succeed({ result });
        task.onStart = api.start;
        task.onError = (error) => api.fail({ error });

        return {
          task,
          ...api,
          runTask: async () => {
            return await runTask(task);
          },
        };
      },
      [dispatch]
    );

    const get = React.useCallback(
      (name) => {
        if (ref.current[name]) {
          return {
            ...taskApi(name),
            ...ref.current[name],
          };
        }
        return null;
      },
      [dispatch]
    );

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

export function Process({ id }) {
  const manager = useProcessManager();
  const process = manager.get(id);
  if (!process) {
    return null;
  }
  const t = process.taskType;
  return (
    <Box>
      <Box>
        {process.status === 'running' && <Spinner type="dots" color="cyan" />}
        {process.status === 'idle' && <Spinner color="dim" type="dots" />}
        {process.status === 'success' && <Color green>✔ </Color>}
        {process.status === 'error' && <Color red>✖ </Color>}
      </Box>
      <Box>
        <Color {...{ [getColor(process.status, t)]: true }}>
          <Box width="12">
            {t[0]} {getCommand(process.status, t)}
          </Box>
          {process.description ? (
            <>
              {typeof process.description === 'string'
                ? process.description
                : process.description[process.status]}{' '}
            </>
          ) : (
            ''
          )}
          {process.message}{' '}
          {process.status === 'idle' || process.status === 'running' ? (
            <Spinner type="simpleDotsScrolling" />
          ) : null}
        </Color>
      </Box>
    </Box>
  );
}
