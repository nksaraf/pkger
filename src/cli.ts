import { build } from 'gluegun';

/**
 * Create the cli and kick it off
 */
async function run(argv) {
  // create a CLI runtime
  const cli = build()
    .brand('pkger')
    .src(__dirname, {
      commandFilePattern: [`*.{js,ts,tsx}`, `!*.test.{js,ts}`],
      extensionFilePattern: [`*.{js,ts,tsx}`, `!*.test.{js,ts}`],
    })
    .plugins('./node_modules', { matching: 'pkger-*', hidden: true })
    .help() // provides default for help, h, --help, -h
    .version() // provides default for version, v, --version, -v
    .create();
  // enable the following method if you'd like to skip loading one of these core extensions
  // this can improve performance if they're not necessary for your project:
  // .exclude(['meta', 'strings', 'print', 'filesystem', 'semver', 'system', 'prompt', 'http', 'template', 'patching', 'package-manager'])
  // and run it
  console.log(cli);
  const toolbox = await cli.run(argv);

  // send it back (for testing, mostly)
  return toolbox;
}

module.exports = { run };
