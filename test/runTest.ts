import * as path from 'path';
import { runTests } from '@vscode/test-electron';

/**
 * Launches a VS Code instance and runs the extension test suite inside it.
 * This is required for tests that touch the vscode module; pure-logic
 * tests (Markdown engine, utils) also run here since Mocha collects both.
 */
async function main(): Promise<void> {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');
    const extensionTestsPath = path.resolve(__dirname, './suite/index');

    await runTests({ extensionDevelopmentPath, extensionTestsPath });
  } catch (err) {
    console.error('Failed to run tests:', err);
    process.exit(1);
  }
}

void main();
