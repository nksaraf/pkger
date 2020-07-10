import { createTask, PROCESS } from '../extensions/task';
import { PackageOptions } from '../types';
import { runCommand } from '../utils';

export function typescriptTask(pkg: PackageOptions) {
  return createTask('typescript', { taskType: PROCESS.EMIT }, async () => {
    await runCommand(`yarn tsc -p ${pkg.tsconfig}`);
  });
}
