"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const chalk_1 = tslib_1.__importDefault(require("chalk"));
const path_1 = tslib_1.__importDefault(require("path"));
const execa_1 = tslib_1.__importDefault(require("execa"));
const fs_extra_1 = tslib_1.__importDefault(require("fs-extra"));
const shelljs_1 = tslib_1.__importDefault(require("shelljs"));
const ora_1 = tslib_1.__importDefault(require("ora"));
const sync_1 = tslib_1.__importDefault(require("tiny-glob/sync"));
const mustache_1 = tslib_1.__importDefault(require("mustache"));
const semver_1 = tslib_1.__importDefault(require("semver"));
const enquirer_1 = require("enquirer");
const Output = tslib_1.__importStar(require("./output"));
const utils_1 = require("./utils");
const index_1 = require("./index");
function getNodeEngineRequirement({ engines }) {
    return engines && engines.node;
}
exports.templates = ['basic', 'react'];
async function packageManager() {
    if (exports.pkgManager) {
        return exports.pkgManager;
    }
    try {
        await execa_1.default('yarnpkg', ['--version']);
        exports.pkgManager = 'yarn';
    }
    catch (e) {
        exports.pkgManager = 'npm';
    }
    return exports.pkgManager;
}
function getInstallArgs(pkgManager, packages, isDev) {
    switch (pkgManager) {
        case 'npm':
            return ['install', ...packages, isDev && '--save-dev'].filter(Boolean);
        case 'yarn':
            return ['add', ...packages, isDev && '--dev'].filter(Boolean);
    }
}
const startMessage = async function (projectName) {
    const pkgManager = await packageManager();
    const commands = {
        install: pkgManager === 'npm' ? 'npm install' : 'yarn install',
        build: pkgManager === 'npm' ? 'npm run build' : 'yarn build',
        start: pkgManager === 'npm' ? 'npm run start' : 'yarn start',
        test: pkgManager === 'npm' ? 'npm test' : 'yarn test',
    };
    return `
  ${chalk_1.default.green('Awesome!')} You're now ready to start coding.
  
  I already ran ${Output.cmd(commands.install)} for you, so your next steps are:
    ${Output.cmd(`cd ${projectName}`)}
  
  To start developing (rebuilds on changes):
    ${Output.cmd(commands.start)}
  
  To build for production:
    ${Output.cmd(commands.build)}
`;
    // To test your library with Jest:
    // ${Output.cmd(commands.test)}
    // Questions? Feedback? Please let me know!
    // ${chalk.green('https://github.com/nksaraf/pkger/issues')}
};
const installingMessage = function (packages) {
    const pkgText = packages
        .map(function (pkg) {
        return `    ${chalk_1.default.cyan(chalk_1.default.bold(pkg))}`;
    })
        .join('\n');
    return `Installing npm modules:
${pkgText}
`;
};
const incorrectNodeVersionMessage = function (requiredVersion) {
    return `Unsupported Node version! Your current Node version (${chalk_1.default.red(process.version)}) does not satisfy the requirement of Node ${chalk_1.default.cyan(requiredVersion)}.`;
};
async function create(pkg, opts) {
    console.log(chalk_1.default.red(index_1.headerVert));
    const bootSpinner = ora_1.default(`Creating ${chalk_1.default.bold.green(pkg)}...`);
    try {
        const cwd = await fs_extra_1.default.realpath(process.cwd());
        pkg = await createUniqueProjectName(cwd, pkg, bootSpinner);
        let template = await getTemplate(opts, bootSpinner);
        await fs_extra_1.default.mkdirp(path_1.default.join(cwd, pkg));
        await copyTemplate(template, cwd, pkg, bootSpinner);
        console.log(await startMessage(pkg));
    }
    catch (error) {
        bootSpinner.fail(`Failed to create ${pkg}`);
        utils_1.logError(error);
        process.exit(1);
    }
}
exports.create = create;
const createUniqueProjectName = async (cwd, pkgName, spinner) => {
    try {
        // Helper fn to prompt the user for a different
        // folder name if one already exists
        async function getProjectName(pkgName) {
            const exists = await fs_extra_1.default.pathExists(path_1.default.join(cwd, pkgName));
            if (!exists) {
                return pkgName;
            }
            spinner.fail(`Failed to create ${chalk_1.default.bold.red(pkgName)}`);
            const prompt = new enquirer_1.Input({
                message: `A folder named ${chalk_1.default.bold.red(pkgName)} already exists! ${chalk_1.default.bold('Choose a different name')}`,
                initial: pkgName + '-1',
                result: (v) => v.trim(),
            });
            pkgName = await prompt.run();
            spinner.start(`Creating ${chalk_1.default.bold.green(pkgName)}...`);
            return await getProjectName(pkgName); // recursion!
        }
        pkgName = await getProjectName(pkgName);
        return pkgName;
    }
    catch (error) {
        spinner.fail(`Failed to create ${chalk_1.default.bold.red(pkgName)}`);
        throw error;
    }
};
const getTemplate = async (opts, spinner) => {
    try {
        let template;
        const prompt = new enquirer_1.Select({
            message: 'Choose a template',
            choices: exports.templates,
        });
        if (opts.template) {
            template = opts.template.trim();
            if (!prompt.choices.includes(template)) {
                spinner.fail(`Invalid template ${chalk_1.default.bold.red(template)}`);
                template = await prompt.run();
            }
        }
        else {
            spinner.stop();
            template = await prompt.run();
        }
        spinner.start();
        return template;
    }
    catch (error) {
        spinner.fail('Failed to get template');
        throw error;
    }
};
function setNpmAuthorName(author) {
    shelljs_1.default.exec(`npm config set init-author-name "${author}"`, { silent: true });
}
const getUserAuthorName = () => {
    let author = '';
    author = shelljs_1.default
        .exec('npm config get init-author-name', { silent: true })
        .stdout.trim();
    if (author)
        return author;
    author = shelljs_1.default
        .exec('git config --global user.name', { silent: true })
        .stdout.trim();
    if (author) {
        setNpmAuthorName(author);
        return author;
    }
    author = shelljs_1.default
        .exec('npm config get init-author-email', { silent: true })
        .stdout.trim();
    if (author)
        return author;
    author = shelljs_1.default
        .exec('git config --global user.email', { silent: true })
        .stdout.trim();
    if (author)
        return author;
    return author;
};
const getAuthorName = async (spinner) => {
    try {
        let author = getUserAuthorName();
        if (!author) {
            spinner.stop();
            const licenseInput = new enquirer_1.Input({
                name: 'author',
                message: 'Who is the package author?',
            });
            author = await licenseInput.run();
            setNpmAuthorName(author);
            spinner.start();
        }
        return author;
    }
    catch (error) {
        spinner.fail('Failed to get author name');
        throw error;
    }
};
const copyTemplate = async (template, cwd, pkgName, spinner) => {
    const projectPath = path_1.default.join(cwd, pkgName);
    let author = await getAuthorName(spinner);
    let templateDir = path_1.default.resolve(__dirname, `../templates/${template}`);
    const templateFiles = await sync_1.default('**/*', {
        cwd: templateDir,
        dot: true,
    });
    const vars = {
        pkgname: pkgName,
        author: author.trim(),
        year: new Date().getFullYear(),
    };
    for (var file of templateFiles) {
        if (await utils_1.isDir(path_1.default.join(templateDir, file))) {
            await fs_extra_1.default.mkdirp(path_1.default.join(projectPath, file));
            continue;
        }
        const contents = await fs_extra_1.default.readFile(path_1.default.join(templateDir, file), {
            encoding: 'utf-8',
        });
        const renderContents = mustache_1.default.render(contents, vars);
        if (file !== 'package.json') {
            await fs_extra_1.default.writeFile(path_1.default.join(projectPath, file), renderContents);
        }
    }
    const pkgJSON = JSON.parse(mustache_1.default.render(await fs_extra_1.default.readFile(path_1.default.join(templateDir, 'package.json'), {
        encoding: 'utf-8',
    }), vars));
    const devDependencies = pkgJSON.devDependencies;
    const dependencies = pkgJSON.dependencies;
    pkgJSON.devDependencies = {};
    pkgJSON.dependencies = {};
    const nodeVersionReq = getNodeEngineRequirement(pkgJSON);
    if (nodeVersionReq && !semver_1.default.satisfies(process.version, nodeVersionReq)) {
        spinner.fail(incorrectNodeVersionMessage(nodeVersionReq));
        process.exit(1);
    }
    await fs_extra_1.default.outputJSON(path_1.default.resolve(projectPath, 'package.json'), pkgJSON);
    spinner.succeed(`Created ${chalk_1.default.bold.green(pkgName)}`);
    process.chdir(projectPath);
    const devDeps = Object.entries(devDependencies).map(([dep, _]) => dep);
    const deps = Object.entries(dependencies).map(([dep, _]) => dep);
    await installDependencies(devDeps, true);
    if (deps.length > 0) {
        await installDependencies(deps, false);
    }
    // Install deps
};
const installDependencies = async (deps, isDev = true) => {
    const installSpinner = ora_1.default(installingMessage(deps.sort())).start();
    try {
        const cmd = await packageManager();
        await execa_1.default(cmd, getInstallArgs(cmd, deps, isDev));
        installSpinner.succeed(`Installed ${isDev ? 'dev ' : ''}dependencies`);
    }
    catch (error) {
        installSpinner.fail(`Failed to install ${isDev ? 'dev ' : ''}dependencies`);
        throw error;
    }
};
