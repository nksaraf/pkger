export default {
  builder: 'tsc',
  target: 'cli',
  source: './src/cli.ts',
  tasks: {
    copyAssets: (toolbox: any) => {
      console.log('heereee');
    },
  },
};
