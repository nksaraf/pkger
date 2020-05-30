# 📦 pkger

Simple (yet powerful) build tool inspired by tsdx, microbundle and klap. Designed to do everything well by default, and allow you to customize any step of the process to your liking.

Standing on the shoulders of **giants**:

- [rollup](https://github.com/rollup/rollup)
- [Babel](https://github.com/babel/babel)
- [typescript](https://github.com/microsoft/Typescript)
- [ink](https://github.com/vadimdemedes/ink)
- [gluegun](https://github.com/infinitered/gluegun)

## Features

- Build packages for the browser, node and the cli
- Rollup powered build system (can be extended infinitely)
- Super easy api for multiple entry points
- Interprets and manages `package.json` (`module`, `exports`, `bin`, `files`, ...)
- Automatically creates entry points for sub-entries
- Zero-config support for typescript, React and latest ES syntax (powered by Babel)
- Scaffold command line apps
- Custom config with a `pkger.config.ts` file or `pkger` entry in `package.json`:
  - Hook into build system (`preBuild`, `postBuild`) and do anything with a gluegun-powered toolbox
  - Add custom tasks that can be run with `pkger run <cmd>` (allowing to write mini node tasks for your projects)
- Range of templates to get started working on your ideas
