import { Toolbox, GluegunToolbox } from 'gluegun';
import path, { PlatformPath } from 'path';
import resolve from 'resolve';

/**
 * Given a source directory and a target filename, return the relative
 * file path from source to target.
 * @param source {String} directory path to start from for traversal
 * @param target {String} directory path and filename to seek from source
 * @return Relative path (e.g. "../../style.css") as {String}
 */
export function getRelativePath(source: string, target: string) {
  var sep = source.indexOf('/') !== -1 ? '/' : '\\',
    targetArr = target.split(sep),
    sourceArr = source.split(sep),
    filename = targetArr.pop(),
    targetPath = targetArr.join(sep),
    relativePath = '';
  while (targetPath.indexOf(sourceArr.join(sep)) === -1) {
    sourceArr.pop();
    relativePath += '..' + sep;
  }
  var relPathArr = targetArr.slice(sourceArr.length);
  relPathArr.length && (relativePath += relPathArr.join(sep) + sep);
  relativePath = !relativePath.startsWith('.')
    ? './' + relativePath
    : relativePath;
  return relativePath + filename;
}

declare module 'gluegun' {
  interface GluegunPath extends PlatformPath {
    from: typeof getRelativePath;
    oneExists: (
      pathsToTry: string[],
      defaultPath?: string,
      baseDir?: string
    ) => string | undefined;
    resolveEntry: (cwd: string) => string | undefined;
  }

  interface Toolbox extends GluegunToolbox {
    path: GluegunPath;
  }
}

export default (toolbox: Toolbox) => {
  function firstExistingPath(
    pathsToTry: string[],
    defaultPath?: string,
    baseDir: string = process.cwd()
  ) {
    for (var path of pathsToTry) {
      if (toolbox.filesystem.exists(toolbox.path.join(baseDir, path))) {
        return path;
      }
    }
    return defaultPath;
  }

  function resolveJSEntry(cwd: string) {
    let libDir = firstExistingPath(['lib', 'src'], '.', cwd);
    libDir = libDir ? `./${libDir}` : '';
    const resolveDir =
      cwd.startsWith('.') || cwd.startsWith('/') ? cwd : `./${cwd}`;

    // console.log(base_lib_dir);
    try {
      return resolve.sync(libDir, {
        basedir: resolveDir,
        extensions: ['.js', '.ts', '.tsx', '.jsx'],
      });
    } catch (e) {}
    return;
  }

  toolbox.path = {
    ...path,
    from: getRelativePath,
    oneExists: firstExistingPath,
    resolveEntry: resolveJSEntry,
  };
};
