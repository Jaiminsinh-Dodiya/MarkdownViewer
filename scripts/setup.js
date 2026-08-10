#!/usr/bin/env node

/**
 * Markdown Viewer — One-command project setup.
 *
 * Usage:
 *   node scripts/setup.js          (from the project root)
 *   npm run setup                  (after the first npm install, or via npx)
 *
 * What it does:
 *   1. Verifies Node.js and npm meet the minimum required versions.
 *   2. Runs `npm install` (with automatic retry on transient network failures).
 *   3. Compiles TypeScript into ./out.
 *   4. Runs the linter.
 *   5. Prints clear next-step instructions for running/debugging the extension.
 *
 * This script uses ONLY Node.js built-in modules (child_process, fs, path)
 * so it works before any dependencies are installed.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ── Configuration ──────────────────────────────────────────────────────────

const MIN_NODE_MAJOR = 18;
const MIN_NPM_MAJOR = 9;
const NPM_INSTALL_MAX_RETRIES = 3;
const NPM_INSTALL_RETRY_DELAY_MS = 5000;

// ── Helpers ────────────────────────────────────────────────────────────────

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';

const CHECK = `${GREEN}✔${RESET}`;
const CROSS = `${RED}✘${RESET}`;
const WARN = `${YELLOW}⚠${RESET}`;
const ARROW = `${CYAN}→${RESET}`;

function log(message) {
  console.log(message);
}

function header(text) {
  log('');
  log(`${BOLD}${CYAN}${'─'.repeat(60)}${RESET}`);
  log(`${BOLD}  ${text}${RESET}`);
  log(`${BOLD}${CYAN}${'─'.repeat(60)}${RESET}`);
  log('');
}

function step(number, text) {
  log(`${BOLD}  [${number}]${RESET} ${text}`);
}

function success(text) {
  log(`  ${CHECK} ${text}`);
}

function fail(text) {
  log(`  ${CROSS} ${text}`);
}

function warn(text) {
  log(`  ${WARN} ${text}`);
}

function info(text) {
  log(`      ${DIM}${text}${RESET}`);
}

function run(command, options = {}) {
  return execSync(command, {
    cwd: projectRoot,
    stdio: options.silent ? 'pipe' : 'inherit',
    encoding: 'utf-8',
    ...options,
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getVersion(command) {
  try {
    return run(command, { silent: true }).trim();
  } catch {
    return null;
  }
}

function parseMajor(versionString) {
  if (!versionString) { return 0; }
  const match = versionString.replace(/^v/, '').match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

// ── Resolve project root (one level up from scripts/) ──────────────────────

const projectRoot = path.resolve(__dirname, '..');

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  header('Markdown Viewer — Project Setup');

  const errors = [];

  // ── Step 1: Check prerequisites ────────────────────────────────────────

  step(1, 'Checking prerequisites…');
  log('');

  // Node.js
  const nodeVersion = getVersion('node --version');
  const nodeMajor = parseMajor(nodeVersion);
  if (nodeMajor >= MIN_NODE_MAJOR) {
    success(`Node.js ${nodeVersion}`);
  } else if (nodeVersion) {
    fail(`Node.js ${nodeVersion} — version ${MIN_NODE_MAJOR}+ required`);
    errors.push(`Upgrade Node.js to v${MIN_NODE_MAJOR} or later: https://nodejs.org`);
  } else {
    fail('Node.js not found');
    errors.push('Install Node.js v18+: https://nodejs.org');
  }

  // npm
  const npmVersion = getVersion('npm --version');
  const npmMajor = parseMajor(npmVersion);
  if (npmMajor >= MIN_NPM_MAJOR) {
    success(`npm ${npmVersion}`);
  } else if (npmVersion) {
    warn(`npm ${npmVersion} — version ${MIN_NPM_MAJOR}+ recommended`);
    info('Run: npm install -g npm@latest');
  } else {
    fail('npm not found');
    errors.push('npm is required — it ships with Node.js');
  }

  // VS Code (optional but helpful)
  const codeVersion = getVersion('code --version');
  if (codeVersion) {
    success(`VS Code ${codeVersion.split('\n')[0]}`);
  } else {
    warn('VS Code CLI ("code") not found on PATH — optional but recommended');
    info('Install: https://code.visualstudio.com');
    info('Add to PATH: Ctrl+Shift+P → "Shell Command: Install \'code\' in PATH"');
  }

  // Git
  const gitVersion = getVersion('git --version');
  if (gitVersion) {
    success(`${gitVersion}`);
  } else {
    warn('Git not found — optional but recommended for development');
  }

  log('');

  if (errors.length > 0) {
    fail('Prerequisites check failed:');
    errors.forEach((e) => log(`      ${RED}•${RESET} ${e}`));
    log('');
    log(`  Fix the issues above and re-run: ${BOLD}node scripts/setup.js${RESET}`);
    process.exit(1);
  }

  // ── Step 2: npm install (with retry) ───────────────────────────────────

  step(2, 'Installing dependencies…');
  log('');

  let installSuccess = false;
  for (let attempt = 1; attempt <= NPM_INSTALL_MAX_RETRIES; attempt++) {
    try {
      run('npm install');
      installSuccess = true;
      break;
    } catch (err) {
      if (attempt < NPM_INSTALL_MAX_RETRIES) {
        warn(`npm install failed (attempt ${attempt}/${NPM_INSTALL_MAX_RETRIES}) — retrying in ${NPM_INSTALL_RETRY_DELAY_MS / 1000}s…`);
        info('This is usually a transient network issue.');
        await sleep(NPM_INSTALL_RETRY_DELAY_MS);
      } else {
        fail(`npm install failed after ${NPM_INSTALL_MAX_RETRIES} attempts.`);
        log('');
        info('Troubleshooting tips:');
        info('  • Check your internet connection');
        info('  • If behind a proxy: npm config set proxy http://proxy:port');
        info('  • Try: npm cache clean --force && npm install');
        info('  • Try: npm install --prefer-offline');
        process.exit(1);
      }
    }
  }

  if (installSuccess) {
    success('Dependencies installed');
    log('');
  }

  // ── Step 3: Compile TypeScript ─────────────────────────────────────────

  step(3, 'Compiling TypeScript…');
  log('');

  try {
    run('npm run compile');
    success('TypeScript compiled → ./out/');
  } catch {
    fail('TypeScript compilation failed — check the errors above');
    process.exit(1);
  }

  log('');

  // ── Step 4: Lint ───────────────────────────────────────────────────────

  step(4, 'Running linter…');
  log('');

  try {
    run('npm run lint');
    success('No lint errors');
  } catch {
    warn('Lint warnings detected — see output above (non-blocking)');
  }

  log('');

  // ── Step 5: Verify build output ────────────────────────────────────────

  step(5, 'Verifying build output…');
  log('');

  const expectedFiles = [
    'out/src/extension.js',
    'out/src/commands/openPreview.js',
    'out/src/commands/openPreviewToSide.js',
    'out/src/markdown/MarkdownRenderer.js',
    'out/src/preview/MarkdownPreviewProvider.js',
  ];

  let allPresent = true;
  for (const file of expectedFiles) {
    const fullPath = path.join(projectRoot, file);
    if (fs.existsSync(fullPath)) {
      success(file);
    } else {
      fail(`${file} — missing`);
      allPresent = false;
    }
  }

  if (!allPresent) {
    log('');
    fail('Some build outputs are missing. The compilation may have partially failed.');
    process.exit(1);
  }

  // ── Done! ──────────────────────────────────────────────────────────────

  header('Setup Complete!');

  log(`  ${BOLD}You're ready to develop. Here's what to do next:${RESET}`);
  log('');
  log(`  ${ARROW} ${BOLD}Run & Debug the extension:${RESET}`);
  log(`      Open this folder in VS Code, then press ${BOLD}F5${RESET}`);
  log(`      This launches an Extension Development Host window.`);
  log(`      Open any ${CYAN}.md${RESET} file and press ${BOLD}Ctrl+K V${RESET} for side preview.`);
  log('');
  log(`  ${ARROW} ${BOLD}Watch mode (auto-recompile on save):${RESET}`);
  log(`      ${DIM}npm run watch${RESET}`);
  log('');
  log(`  ${ARROW} ${BOLD}Run tests:${RESET}`);
  log(`      ${DIM}npm test${RESET}`);
  log('');
  log(`  ${ARROW} ${BOLD}Package as .vsix for distribution:${RESET}`);
  log(`      ${DIM}npm run package${RESET}`);
  log(`      ${DIM}code --install-extension markdown-viewer-*.vsix${RESET}`);
  log('');
  log(`  ${DIM}For more details, see README.md${RESET}`);
  log('');
}

main().catch((err) => {
  log('');
  fail(`Unexpected error: ${err.message}`);
  process.exit(1);
});
