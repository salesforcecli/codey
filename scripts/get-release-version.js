#!/usr/bin/env node

/*
 * Copyright 2025, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getArgs() {
  const args = {};
  process.argv.slice(2).forEach((arg) => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.substring(2).split('=');
      args[key] = value === undefined ? true : value;
    }
  });
  return args;
}

function getLatestTag(pattern) {
  const command = `gh release list --limit 100 --json tagName | jq -r '[.[] | select(.tagName | ${pattern})] | .[0].tagName'`;
  try {
    return execSync(command).toString().trim();
  } catch {
    // Suppress error output for cleaner test failures
    return '';
  }
}

export function getVersion(options = {}) {
  const args = getArgs();
  const type = options.type || args.type || 'nightly';

  let releaseVersion;
  let npmTag;
  let previousReleaseTag;

  if (type === 'nightly') {
    const packageJson = JSON.parse(
      readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'),
    );
    const [major, minor] = packageJson.version.split('.');
    const nextMinor = parseInt(minor) + 1;
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const gitShortHash = execSync('git rev-parse --short HEAD')
      .toString()
      .trim();
    releaseVersion = `${major}.${nextMinor}.0-nightly.${date}.${gitShortHash}`;
    npmTag = 'nightly';
    previousReleaseTag = getLatestTag('contains("nightly")');
  } else if (type === 'stable') {
    const latestPreviewTag = getLatestTag('contains("preview")');
    releaseVersion = latestPreviewTag
      .replace(/-preview.*/, '')
      .replace(/^v/, '');
    npmTag = 'latest';
    previousReleaseTag = getLatestTag(
      '(contains("nightly") or contains("preview")) | not',
    );
  } else if (type === 'preview') {
    const latestNightlyTag = getLatestTag('contains("nightly")');
    releaseVersion =
      latestNightlyTag.replace(/-nightly.*/, '').replace(/^v/, '') + '-preview';
    npmTag = 'preview';
    previousReleaseTag = getLatestTag('contains("preview")');
  }

  const releaseTag = `v${releaseVersion}`;

  return {
    releaseTag,
    releaseVersion,
    npmTag,
    previousReleaseTag,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(getVersion(), null, 2));
}
