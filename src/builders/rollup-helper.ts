const SHEBANG_RX = /^#!.*/;
import { Plugin } from 'rollup';
import MagicString from 'magic-string';

export function preserveShebangs({ shebang }: { shebang: string }) {
  const shebangs: Record<string, string> = {};

  const plugin: Plugin = {
    name: 'rollup-plugin-preserve-shebang',
    transform(code, id) {
      const match = code.match(SHEBANG_RX);

      if (match) {
        shebangs[id] = match[0];
      }

      code = code.replace(SHEBANG_RX, '');

      return {
        code,
        map: null,
      };
    },
    renderChunk(code, chunk, { sourcemap }) {
      if (chunk.facadeModuleId && (shebangs[chunk.facadeModuleId] || shebang)) {
        const str = new MagicString(code);
        str.prepend((shebangs[chunk.facadeModuleId] || shebang) + '\n');
        return {
          code: str.toString(),
          map: sourcemap ? str.generateMap({ hires: true }) : null,
        };
      }
      return {
        code,
        map: null,
      };
    },
  };

  return plugin;
}

/**
 * A rollup plugin to print gzip size of output assets.
 * Why we need a custom plugin :- To save 2 terser passes
 * - `rollup-plugin-filesize` does an internal terser pass for all the files
 * - This is little expensive, specially when we use `terser` to generate final output anyway.
 */
import gzip from 'gzip-size';
import prettyBytes from 'pretty-bytes';
// import greenlet from './greenlet';
// import { info } from '../logger';

export const showSize = (bundle: { code: any; fileName: any }) => {
  const { code, fileName } = bundle;
  // console.log(code);
  const size = prettyBytes(gzip.sync(code));
  return size;
  // console.log(`\t${size}\t${fileName}`);
};
