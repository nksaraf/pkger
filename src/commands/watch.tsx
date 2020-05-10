import React from 'react';
import { render } from 'ink';
import { Color } from 'ink';
import {
  Process,
  ProcessManager,
  useProcessManager,
} from '../components/Process';
import { GluegunCommand } from 'gluegun';
import { useToolbox } from '../components/Toolbox';

export default {
  name: 'watch',
  run: async (toolbox) => {
    toolbox.ink.render(<ProcessManager>{/* <Watch /> */}</ProcessManager>);
  },
} as GluegunCommand;

// function Watch() {
//   const manager = useProcessManager();
//   const toolbox = useToolbox();

//   React.useEffect(() => {
//     const pkgerProcess = manager.add('watch', {
//       taskType: PROCESS.PKGER,
//       description: {
//         idle: <Color white>waiting for changes</Color>,
//         running: 'bundling',
//         fail: (
//           <Color dim red>
//             failed bundling, waiting for changes
//           </Color>
//         ),
//       },
//     });

//     const buildProcess = manager.add('build', {
//       taskType: PROCESS.PKGER,
//       description: {
//         idle: <Color white>waiting for changes</Color>,
//         running: 'bundling',
//         fail: (
//           <Color dim red>
//             failed bundling, waiting for changes
//           </Color>
//         ),
//       },
//     });

//     async function watcher() {
//       const options = toolbox.config;

//       const { entries, ...root } = options;
//       let rollupConfigs = flatten([
//         getRollupConfigs(root),
//         ...entries.map((entry) => getRollupConfigs(entry)),
//       ]).map(({ label, ...rollupConfig }) => {
//         return rollupConfig;
//       });

//       const rootProcess = manager.add(root.name, {
//         taskType: PROCESS.COMPILE,
//         description: root.name,
//       });

//       entries.map((entry) => {
//         manager.add(entry.name, {
//           taskType: PROCESS.COMPILE,
//           description: entry.name,
//         });
//       });

//       const typescriptProcess = manager.addTask(typescriptTask(options));

//       rollupWatch(rollupConfigs).on('event', async (event) => {
//         if (event.code === 'START') {
//           pkgerProcess.start();
//         }

//         if (event.code === 'BUNDLE_START') {
//           const pkg = [root, ...entries].find(
//             (entry) => entry.source === event.input
//           );
//           const entryProcess = manager.get(pkg.name);
//           entryProcess.start();
//         }

//         if (event.code === 'BUNDLE_END') {
//           const pkg = [root, ...entries].find(
//             (entry) => entry.source === event.input
//           );
//           const entryProcess = manager.get(pkg.name);
//           if (entryProcess) {
//             const bundle = await event.result.generate({});
//             const size = showSize(bundle.output[0]);
//             if (!entryProcess.size || entryProcess.size > size) {
//               entryProcess.succeed({ size: size, message: size });
//             } else {
//               entryProcess.succeed({ message: size });
//             }
//           }
//         }

//         if (event.code === 'ERROR') {
//           pkgerProcess.fail();
//         }

//         if (event.code === 'END') {
//           try {
//             await runTask(typescriptProcess.task);
//             pkgerProcess.reset();
//           } catch (e) {
//             pkgerProcess.fail(e);
//           }
//         }
//       });
//     }
//     watcher();
//   }, []);

//   return (
//     <>
//       {Object.keys(manager.processes.current).map((proc) => (
//         <Process key={proc} process={proc} />
//       ))}
//     </>
//   );
// }
