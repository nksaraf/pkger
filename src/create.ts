import chalk from 'chalk';
import logError from './logError';
import path from 'path';
import execa from 'execa';
import fs from 'fs-extra';
import shell from 'shelljs';
import ora from 'ora';
import glob from 'tiny-glob/sync';
import Mustache from 'mustache';
import semver from 'semver';
import { Input, Select } from 'enquirer';
import { templates } from './templates';
import * as Output from './output';
import { isDir } from './utils';
import { PackageJson } from './types';

export let pkgManager: PackageManager;

type PackageManager = 'yarn' | 'npm';

function getNodeEngineRequirement({ engines }: PackageJson) {
  return engines && engines.node;
}

async function packageManager(): Promise<PackageManager> {
  if (pkgManager) {
    return pkgManager;
  }

  try {
    await execa('yarnpkg', ['--version']);
    pkgManager = 'yarn';
  } catch (e) {
    pkgManager = 'npm';
  }

  return pkgManager;
}

function getInstallArgs(
  pkgManager: PackageManager,
  packages: string[],
  isDev: boolean
): string[] {
  switch (pkgManager) {
    case 'npm':
      return ['install', ...packages, isDev && '--save-dev'].filter(
        Boolean
      ) as string[];
    case 'yarn':
      return ['add', ...packages, isDev && '--dev'].filter(Boolean) as string[];
  }
}

const startMessage = async function(projectName: string) {
  const pkgManager = await packageManager();

  const commands = {
    install: pkgManager === 'npm' ? 'npm install' : 'yarn install',
    build: pkgManager === 'npm' ? 'npm run build' : 'yarn build',
    start: pkgManager === 'npm' ? 'npm run start' : 'yarn start',
    test: pkgManager === 'npm' ? 'npm test' : 'yarn test',
  };

  return `
  ${chalk.green('Awesome!')} You're now ready to start coding.
  
  I already ran ${Output.cmd(commands.install)} for you, so your next steps are:
    ${Output.cmd(`cd ${projectName}`)}
  
  To start developing (rebuilds on changes):
    ${Output.cmd(commands.start)}
  
  To build for production:
    ${Output.cmd(commands.build)}

  To test your library with Jest:
    ${Output.cmd(commands.test)}
    
  Questions? Feedback? Please let me know!
  ${chalk.green('https://github.com/jaredpalmer/tsdx/issues')}
`;
};

const installingMessage = function(packages: string[]) {
  const pkgText = packages
    .map(function(pkg) {
      return `    ${chalk.cyan(chalk.bold(pkg))}`;
    })
    .join('\n');

  return `Installing npm modules:
${pkgText}
`;
};

const incorrectNodeVersionMessage = function(requiredVersion: string) {
  return `Unsupported Node version! Your current Node version (${chalk.red(
    process.version
  )}) does not satisfy the requirement of Node ${chalk.cyan(requiredVersion)}.`;
};

export async function create(pkg: string, opts: any) {
  console.log(
    chalk.blue(`
              ____.----.
    ____.----'          \\
    \\                    \\
     \\                    \\
      \\                    \\
       \\          ____.----'\`--.__
        \\___.----'          |     \`--.____
       /\`-._                |       __.-' \\
      /     \`-._            ___.---'       \\
     /          \`-.____.---'                \\
    /            / | \\                       \\
   /            /  |  \\                   _.--'
   \`-.         /   |   \\            __.--'
      \`-._    /    |    \\     __.--'     |
        | \`-./     |     \\_.-'           |
        |          |                     |
 _______|          |                     |______
        \`-.        |                  _.-'
           \`-.     |           __..--'
              \`-.  |      __.-'
                 \`-|__.--'
  `)
  );
  const bootSpinner = ora(`Creating ${chalk.bold.green(pkg)}...`);
  try {
    const cwd = await fs.realpath(process.cwd());
    pkg = await createUniqueProjectName(cwd, pkg, bootSpinner);
    let template = await getTemplate(opts, bootSpinner);

    await fs.mkdirp(path.join(cwd, pkg));
    // copy the template
    await copyTemplate(template, cwd, pkg, bootSpinner);
    console.log(await startMessage(pkg));
  } catch (error) {
    bootSpinner.fail(`Failed to create ${pkg}`);
    logError(error);
    process.exit(1);
  }
}

const createUniqueProjectName = async (
  cwd: string,
  pkgName: string,
  spinner: ora.Ora
) => {
  try {
    // Helper fn to prompt the user for a different
    // folder name if one already exists
    async function getProjectName(pkgName: string): Promise<string> {
      const exists = await fs.pathExists(path.join(cwd, pkgName));
      if (!exists) {
        return pkgName;
      }
      spinner.fail(`Failed to create ${chalk.bold.red(pkgName)}`);
      const prompt = new Input({
        message: `A folder named ${chalk.bold.red(
          pkgName
        )} already exists! ${chalk.bold('Choose a different name')}`,
        initial: pkgName + '-1',
        result: (v: string) => v.trim(),
      });
      pkgName = await prompt.run();
      spinner.start(`Creating ${chalk.bold.green(pkgName)}...`);
      return await getProjectName(pkgName); // recursion!
    }
    pkgName = await getProjectName(pkgName);
    return pkgName;
  } catch (error) {
    spinner.fail(`Failed to create ${chalk.bold.red(pkgName)}`);
    throw error;
  }
};

const getTemplate = async (opts: any, spinner: ora.Ora) => {
  try {
    let template;
    const prompt = new Select({
      message: 'Choose a template',
      choices: Object.keys(templates),
    });
    if (opts.template) {
      template = opts.template.trim();
      if (!prompt.choices.includes(template)) {
        spinner.fail(`Invalid template ${chalk.bold.red(template)}`);
        template = await prompt.run();
      }
    } else {
      spinner.stop();
      template = await prompt.run();
    }

    spinner.start();
    return template;
  } catch (error) {
    spinner.fail('Failed to get template');
    throw error;
  }
};

function setNpmAuthorName(author: string) {
  shell.exec(`npm config set init-author-name "${author}"`, { silent: true });
}

const getUserAuthorName = () => {
  let author = '';

  author = shell
    .exec('npm config get init-author-name', { silent: true })
    .stdout.trim();
  if (author) return author;

  author = shell
    .exec('git config --global user.name', { silent: true })
    .stdout.trim();
  if (author) {
    setNpmAuthorName(author);
    return author;
  }

  author = shell
    .exec('npm config get init-author-email', { silent: true })
    .stdout.trim();
  if (author) return author;

  author = shell
    .exec('git config --global user.email', { silent: true })
    .stdout.trim();
  if (author) return author;

  return author;
};

const getAuthorName = async (spinner: ora.Ora) => {
  try {
    let author = getUserAuthorName();
    if (!author) {
      spinner.stop();
      const licenseInput = new Input({
        name: 'author',
        message: 'Who is the package author?',
      });
      author = await licenseInput.run();
      setNpmAuthorName(author);
      spinner.start();
    }
    return author;
  } catch (error) {
    spinner.fail('Failed to get author name');
    throw error;
  }
};

const copyTemplate = async (
  template: string,
  cwd: string,
  pkgName: string,
  spinner: ora.Ora
) => {
  const projectPath = path.join(cwd, pkgName);
  let author = await getAuthorName(spinner);

  let templateDir = path.resolve(__dirname, `../templates/${template}`);
  const templateFiles: string[] = await glob('**/*', {
    cwd: templateDir,
    dot: true,
  });

  const vars = {
    pkgname: pkgName,
    author: author.trim(),
    year: new Date().getFullYear(),
  };

  for (var file of templateFiles) {
    if (await isDir(path.join(templateDir, file))) {
      await fs.mkdirp(path.join(projectPath, file));
      continue;
    }
    const contents = await fs.readFile(path.join(templateDir, file), {
      encoding: 'utf-8',
    });

    const renderContents = Mustache.render(contents, vars);
    if (file !== 'package.json') {
      await fs.writeFile(path.join(projectPath, file), renderContents);
    }
  }

  const pkgJSON = JSON.parse(
    Mustache.render(
      await fs.readFile(path.join(templateDir, 'package.json'), {
        encoding: 'utf-8',
      }),
      vars
    )
  );

  const devDependencies = pkgJSON.devDependencies;
  const dependencies = pkgJSON.dependencies;
  pkgJSON.devDependencies = {};
  pkgJSON.dependencies = {};

  const nodeVersionReq = getNodeEngineRequirement(pkgJSON);
  if (nodeVersionReq && !semver.satisfies(process.version, nodeVersionReq)) {
    spinner.fail(incorrectNodeVersionMessage(nodeVersionReq));
    process.exit(1);
  }

  await fs.outputJSON(path.resolve(projectPath, 'package.json'), pkgJSON);
  spinner.succeed(`Created ${chalk.bold.green(pkgName)}`);

  process.chdir(projectPath);
  const devDeps = Object.entries(devDependencies).map(([dep, _]) => dep);
  const deps = Object.entries(dependencies).map(([dep, _]) => dep);
  await installDependencies(devDeps, true);
  if (deps.length > 0) {
    await installDependencies(deps, false);
  }

  // Install deps
};

const installDependencies = async (deps: string[], isDev: boolean = true) => {
  const installSpinner = ora(installingMessage(deps.sort())).start();
  try {
    const cmd = await packageManager();
    await execa(cmd, getInstallArgs(cmd, deps, isDev));
    installSpinner.succeed(`Installed ${isDev ? 'dev ' : ''}dependencies`);
  } catch (error) {
    installSpinner.fail(`Failed to install ${isDev ? 'dev ' : ''}dependencies`);
    throw error;
  }
};
