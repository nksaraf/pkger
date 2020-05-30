import { build } from 'gluegun';

/**
 * Create the cli and kick it off
 */
export async function run(argv, devMode) {
  // create a CLI runtime
  devMode && console.log('[debug] booting ...');

  const cli = build()
    .brand('pkger')
    .src(
      __dirname,
      devMode
        ? {
            commandFilePattern: [`*.{js,ts,tsx}`, `!*.test.{js,ts}`],
            extensionFilePattern: [`*.{js,ts,tsx}`, `!*.test.{js,ts}`],
          }
        : undefined
    )
    .plugins('./node_modules', { matching: 'pkger-*', hidden: true })
    .exclude([
      'http',
      'template',
      'semver',
      'system',
      'strings',
      'prompt',
      'print',
      // 'parameters',
    ])
    .help() // provides default for help, h, --help, -h
    .version() // provides default for version, v, --version, -v
    .create();

  devMode && console.log('[debug] booted');
  devMode && console.log('[debug] running...');

  // enable the following method if you'd like to skip loading one of these core extensions
  // this can improve performance if they're not necessary for your project:
  // .exclude(['meta', 'strings', 'print', 'filesystem', 'semver', 'system', 'prompt', 'http', 'template', 'patching', 'package-manager'])
  // and run it
  const toolbox = await cli.run(argv);
  devMode && console.log('[debug] finished');

  // send it back (for testing, mostly)
  return toolbox;
}
