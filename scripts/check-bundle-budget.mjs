#!/usr/bin/env node

import { resolve } from 'node:path';
import {
  createBundleBudgetReport,
  renderBundleBudgetReport
} from '../src/shared/performance/bundleBudget.mjs';

const USAGE = `Usage: node scripts/check-bundle-budget.mjs [options]

Options:
  --json                 Print a machine-readable JSON report
  --assets-dir <path>    Inspect this directory (default: dist/assets)
  --help                 Show this help`;

class ArgumentError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ArgumentError';
    this.code = 'INVALID_ARGUMENTS';
  }
}

function parseArguments(argumentsList) {
  const options = {
    assetsDirectory: 'dist/assets',
    json: false,
    help: false
  };

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];

    if (argument === '--json') {
      options.json = true;
    } else if (argument === '--help' || argument === '-h') {
      options.help = true;
    } else if (argument === '--assets-dir') {
      const directory = argumentsList[index + 1];
      if (!directory || directory.startsWith('--')) {
        throw new ArgumentError('--assets-dir requires a path');
      }
      options.assetsDirectory = directory;
      index += 1;
    } else if (argument.startsWith('--assets-dir=')) {
      const directory = argument.slice('--assets-dir='.length);
      if (!directory) {
        throw new ArgumentError('--assets-dir requires a path');
      }
      options.assetsDirectory = directory;
    } else {
      throw new ArgumentError(`Unknown argument: ${argument}`);
    }
  }

  return options;
}

function serializeError(error) {
  return {
    ok: false,
    error: {
      name: error instanceof Error ? error.name : 'Error',
      code: error && typeof error === 'object' && 'code' in error ? error.code : 'UNKNOWN_ERROR',
      message: error instanceof Error ? error.message : String(error)
    }
  };
}

async function main() {
  let options;

  try {
    options = parseArguments(process.argv.slice(2));
  } catch (error) {
    const wantsJson = process.argv.includes('--json');
    if (wantsJson) {
      process.stdout.write(`${JSON.stringify(serializeError(error), null, 2)}\n`);
    } else {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n\n${USAGE}\n`);
    }
    process.exitCode = 2;
    return;
  }

  if (options.help) {
    process.stdout.write(`${USAGE}\n`);
    return;
  }

  try {
    const report = await createBundleBudgetReport(resolve(options.assetsDirectory));

    if (options.json) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      process.stdout.write(`${renderBundleBudgetReport(report)}\n`);
    }

    if (!report.ok) {
      process.exitCode = 1;
    }
  } catch (error) {
    if (options.json) {
      process.stdout.write(`${JSON.stringify(serializeError(error), null, 2)}\n`);
    } else {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`Bundle budget ERROR\n${message}\n`);
    }

    process.exitCode = 2;
  }
}

await main();
