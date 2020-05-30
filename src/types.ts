import { GluegunToolbox } from 'gluegun';
import { RollupOptions } from 'rollup';
import { BabelOptions } from './extensions/babel';
export type PackageFormat = 'esm' | 'umd' | 'cjs';
export interface PackageOptions {
  builder?: 'rollup' | 'tsc';
  typecheck?: boolean;
  tsconfig?: string;
  debug?: boolean;
  dev?: boolean;
  cmd?: string;
  tsconfigContents?: {
    [key: string]: any;
  };
  rollup?: (config: RollupOptions, pkg: PackageOptions) => RollupOptions;
  babel?: (config: BabelOptions, pkg: PackageOptions) => BabelOptions;
  preBuild?: (toolbox: Toolbox, pkg: PackageOptions) => void | Promise<void>;
  postBuild?: (toolbox: Toolbox, pkg: PackageOptions) => void | Promise<void>;
  onBuildError?: (toolbox: Toolbox, pkg: PackageOptions) => void;
  name?: string;
  external?: (
    pkg: PackageOptions,
    imported: string,
    importer: string,
    resolved: boolean
  ) => boolean;
  browserlist?: string;
  source?: string;
  input?: string;
  label?: string;
  env?: 'development' | 'production';
  jsx?: 'react' | 'h' | 'React.createElement';
  root?: boolean;
  target?: 'node' | 'browser' | 'cli';
  format?: PackageFormat[];
  silent?: boolean;
  minify?: boolean;
  tasks?: {
    [key: string]: (
      toolbox: Toolbox,
      pkg: PackageOptions
    ) => void | Promise<void>;
  };
  jest?: any;
  eslint?: any;
  dependencies?: {
    [packageName: string]: string;
  };
  devDependencies?: {
    [packageName: string]: string;
  };
  engines?: {
    node?: string;
  };
  outputFile?: string;
  outputFormat?: PackageFormat;
  entryName?: string;
  allPackages?: PackageOptions[];
  allEntries?: PackageOptions[];
  entries?: (string | PackageOptions)[];
  packages?: PackageOptions[];
  exports?: {
    [key: string]: boolean | PackageOptions;
  };
}

export interface Toolbox extends GluegunToolbox {}
