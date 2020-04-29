import sade from 'sade';
import { create, templates } from './create';
import { build } from './build';
import { watch } from './watch';
// @ts-ignore
import { version } from '../package.json';

import chalk from 'chalk';
import { runCommand } from './utils';

const prog = sade('pkger').version(version);

prog
  .command('create <pkg>')
  .describe('Create a new package with TSDX')
  .example('create mypackage')
  .option(
    '--template',
    `Specify a template. Allowed choices: [${templates.join(', ')}]`
  )
  .example('create --template react mypackage')
  .action(create);

prog.command('check')
  .option('--tsconfig', 'Specify custom tsconfig path')
  .example('watch --tsconfig ./tsconfig.foo.json')
  .action(async (cliOpts) => {
    console.log('here');
    console.log(cliOpts);
    console.log(await runCommand(`tsc -p ${cliOpts.tsconfig}`));
  })

prog
  .command('watch')
  .describe('Rebuilds on any change')
  .option('--entry, -i', 'Entry module(s)')
  .example('watch --entry src/foo.tsx')
  .option('--target', 'Specify your target environment')
  .example('watch --target node')
  .option('--name', 'Specify name exposed in UMD builds')
  .example('watch --name Foo')
  .option('--format', 'Specify module format(s)')
  .example('watch --format cjs,esm')
  .option(
    '--verbose',
    'Keep outdated console output in watch mode instead of clearing the screen'
  )
  .example('watch --verbose')
  .option('--noClean', "Don't clean the dist folder", '')
  .example('watch --noClean')
  .option('--tsconfig', 'Specify custom tsconfig path')
  .example('watch --tsconfig ./tsconfig.foo.json')
  .option('--onFirstSuccess', 'Run a command on the first successful build')
  .example('watch --onFirstSuccess "echo The first successful build!"')
  .option('--onSuccess', 'Run a command on a successful build')
  .example('watch --onSuccess "echo Successful build!"')
  .option('--onFailure', 'Run a command on a failed build')
  .example('watch --onFailure "The build failed!"')
  .option('--transpileOnly', 'Skip type checking')
  .example('watch --transpileOnly')
  .option('--extractErrors', 'Extract invariant errors to ./errors/codes.json.')
  .example('watch --extractErrors')
  .action(watch);

prog
  .command('build', '', { default: true })
  .describe('Build your project once and exit')
  .option('--source, --entry, -i,', 'Entry module(s)')
  .example('build --source src/foo.tsx')
  .option('--target', 'Specify your target environment')
  .example('build --target node')
  .option('--name', 'Specify name exposed in UMD builds')
  .example('build --name Foo')
  .option('--format', 'Specify module format(s)')
  .example('build --format cjs,esm')
  .option('--tsconfig', 'Specify custom tsconfig path')
  .example('build --tsconfig ./tsconfig.foo.json')
  .option('--transpileOnly', 'Skip type checking')
  .example('build --transpileOnly')
  // .option(
  //   '--extractErrors',
  //   'Extract errors to ./errors/codes.json and provide a url for decoding.'
  // )
  // .example(
  //   'build --extractErrors=https://reactjs.org/docs/error-decoder.html?invariant='
  // )
  .action(build);

// prog
//   .command('test')
//   .describe(
//     'Run jest test runner in watch mode. Passes through all flags directly to Jest'
//   )
//   .action(async (opts: { config?: string }) => {
//     // Do this as the first thing so that any code reading it knows the right env.
//     process.env.BABEL_ENV = 'test';
//     process.env.NODE_ENV = 'test';
//     // Makes the script crash on unhandled rejections instead of silently
//     // ignoring them. In the future, promise rejections that are not handled will
//     // terminate the Node.js process with a non-zero exit code.
//     process.on('unhandledRejection', err => {
//       throw err;
//     });

//     const argv = process.argv.slice(2);
//     let jestConfig: JestConfigOptions = {
//       ...createJestConfig(
//         relativePath => path.resolve(__dirname, '..', relativePath),
//         opts.config ? path.dirname(opts.config) : paths.appRoot
//       ),
//       ...appPackageJson.jest,
//     };

//     // Allow overriding with jest.config
//     const defaultPathExists = await fs.pathExists(paths.jestConfig);
//     if (opts.config || defaultPathExists) {
//       const jestConfigPath = resolveApp(opts.config || paths.jestConfig);
//       const jestConfigContents: JestConfigOptions = require(jestConfigPath);
//       jestConfig = { ...jestConfig, ...jestConfigContents };
//     }

//     // if custom path, delete the arg as it's already been merged
//     if (opts.config) {
//       let configIndex = argv.indexOf('--config');
//       if (configIndex !== -1) {
//         // case of "--config path", delete both args
//         argv.splice(configIndex, 2);
//       } else {
//         // case of "--config=path", only one arg to delete
//         const configRegex = /--config=.+/;
//         configIndex = argv.findIndex(arg => arg.match(configRegex));
//         if (configIndex !== -1) {
//           argv.splice(configIndex, 1);
//         }
//       }
//     }

//     argv.push(
//       '--config',
//       JSON.stringify({
//         ...jestConfig,
//       })
//     );

//     const [, ...argsToPassToJestCli] = argv;
//     jest.run(argsToPassToJestCli);
//   });

// prog
//   .command('lint')
//   .describe('Run eslint with Prettier')
//   .example('lint src test')
//   .option('--fix', 'Fixes fixable errors and warnings')
//   .example('lint src test --fix')
//   .option('--ignore-pattern', 'Ignore a pattern')
//   .example('lint src test --ignore-pattern test/foobar.ts')
//   .option('--write-file', 'Write the config file locally')
//   .example('lint --write-file')
//   .option('--report-file', 'Write JSON report to file locally')
//   .example('lint --report-file eslint-report.json')
//   .action(
//     async (opts: {
//       fix: boolean;
//       'ignore-pattern': string;
//       'write-file': boolean;
//       'report-file': string;
//       _: string[];
//     }) => {
//       if (opts['_'].length === 0 && !opts['write-file']) {
//         const defaultInputs = ['src', 'test'].filter(fs.existsSync);
//         opts['_'] = defaultInputs;
//         console.log(
//           chalk.yellow(
//             `Defaulting to "tsdx lint ${defaultInputs.join(' ')}"`,
//             '\nYou can override this in the package.json scripts, like "lint": "tsdx lint src otherDir"'
//           )
//         );
//       }

//       const config = await createEslintConfig({
//         pkg: appPackageJson,
//         rootDir: paths.appRoot,
//         writeFile: opts['write-file'],
//       });

//       const cli = new CLIEngine({
//         baseConfig: {
//           ...config,
//           ...appPackageJson.eslint,
//         },
//         extensions: ['.ts', '.tsx', '.js', '.jsx'],
//         fix: opts.fix,
//         ignorePattern: opts['ignore-pattern'],
//       });
//       const report = cli.executeOnFiles(opts['_']);
//       if (opts.fix) {
//         CLIEngine.outputFixes(report);
//       }
//       console.log(cli.getFormatter()(report.results));
//       if (opts['report-file']) {
//         await fs.outputFile(
//           opts['report-file'],
//           cli.getFormatter('json')(report.results)
//         );
//       }
//       if (report.errorCount) {
//         process.exit(1);
//       }
//     }
//   );

prog.parse(process.argv);

// export const header = chalk.red(`       __.
//  __.--'   \\
//  \\         \\
//   \\    __.--\`--.__
//   _'--'    |   __'\\       ${chalk.blue(`______  _`)}
//  /   \`-.__.---'    \\      ${chalk.blue(`| ___ \\| |`)}
// /      /|\\          \\     ${chalk.blue(`| |_/ /| | __ __ _   ___  _ __`)}
// -.    / | \\     __.--'    ${chalk.blue(`|  __/ | |/ // _\` | / _ \\| '__|`)}
//   \`-./  |  \\_.-'   |      ${chalk.blue(`| |    |   <| (_| ||  __/| |`)}
//   |     |          |      ${chalk.blue(`\\_|    |_|\\_\\\\__, | \\___||_|`)}
//    \`-.  |      __.-'                    ${chalk.blue(`__/ |`)}
//       \`-|__.--'                        ${chalk.blue(`|___/`)}
// `);
