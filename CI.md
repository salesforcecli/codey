# GitHub Actions Workflows

This document provides a comprehensive overview of the GitHub Actions workflows used in this repository. These workflows automate various aspects of our development lifecycle, including continuous integration, testing, release management, and repository maintenance.

## CI/CD and Testing

### `ci.yml`

This is the main Continuous Integration (CI) workflow that ensures the quality and stability of the codebase.

**Triggers:**

- Pushes and pull requests to `main` and `release/**` branches.
- Manual trigger through the GitHub UI.

**Jobs:**

- **Lint**: Checks the code for style and formatting errors using ESLint, Prettier, and other linters.
- **Test**: Runs unit and integration tests across multiple operating systems (Linux, macOS, Windows) and Node.js versions.
- **CodeQL**: Performs static analysis to identify security vulnerabilities.
- **Bundle Size Check**: On pull requests, this job checks for any significant increase in the size of the application bundle.

### `e2e.yml`

This workflow is dedicated to running end-to-end (E2E) tests, which simulate real user scenarios.

**Triggers:**

- Pushes and pull requests to `main` and `release/**` branches.
- For pull requests from forks, a maintainer must add the `maintainer:e2e:ok` label to trigger the workflow, as it requires access to secrets.

**Jobs:**

- Builds the project and runs E2E tests on Linux, macOS, and Windows.

### `docs-page-action.yml`

This workflow automates the deployment of the project's documentation to GitHub Pages.

**Triggers:**

- When a new version tag (e.g., `v1.2.3`) is pushed to the repository.

**Jobs:**

- Builds the documentation using Jekyll and deploys it to the `gh-pages` branch.

## Release and Deployment

### `release-manual.yml`

This workflow allows for a manual release of the software.

**Triggers:**

- Manual trigger through the GitHub UI.

**Inputs:**

- `version`: The version to release (e.g., `v0.1.11`).
- `ref`: The Git ref (branch, tag, or SHA) to release from.
- `npm_channel`: The npm channel to publish to (e.g., `latest`, `preview`).

### `release-nightly.yml`

This workflow automates the creation of nightly releases.

**Triggers:**

- Runs on a schedule (daily at midnight).
- Manual trigger through the GitHub UI.

**Jobs:**

- Determines the next nightly version number.
- Runs tests.
- Publishes the new version to npm.
- Creates a pull request to update the version number in the `package.json` files.

### Patch Release Workflows

This set of workflows manages the process of creating and publishing patch releases for stable and preview channels.

- **`release-patch-from-comment.yml`**: Initiates the patch process when a maintainer comments `/patch` on a merged pull request.
- **`release-patch-1-create-pr.yml`**: Creates a pull request to cherry-pick the required commit into the release branch.
- **`release-patch-2-trigger.yml`**: Once the cherry-pick pull request is merged, this workflow triggers the final release process.
- **`release-patch-3-release.yml`**: Publishes the patch release to npm and creates a GitHub release. This workflow includes a check to prevent race conditions if multiple patches are being released concurrently.

### `release-promote.yml`

This workflow promotes a release from one channel to another (e.g., from `preview` to `stable`).

**Triggers:**

- Manual trigger through the GitHub UI.

**Jobs:**

- Calculates the new version numbers for the stable and preview releases.
- Runs tests on the specific commits being promoted.
- Publishes the new versions to their respective npm channels.
- Prepares the `main` branch for the next nightly release.

### `release-change-tags.yml`

This utility workflow allows maintainers to manually change the npm distribution tags for a specific version of a package.

**Triggers:**

- Manual trigger through the GitHub UI.

### `release-sandbox.yml`

This workflow is for deploying a version of the CLI to a sandbox environment for testing purposes.

**Triggers:**

- Manual trigger through the GitHub UI.

## Issue & PR Management (AI-Powered)

These workflows leverage Gemini to automate various aspects of issue and pull request management.

- **`gemini-automated-issue-dedup.yml`**: When a new issue is opened, this workflow uses Gemini to search for potential duplicates and, if found, applies the `status/possible-duplicate` label and leaves a comment.
- **`gemini-automated-issue-triage.yml`**: For new issues, this workflow uses Gemini to analyze the title and body to apply appropriate labels, such as `kind/bug`, `area/*`, and a priority label.
- **`gemini-scheduled-issue-dedup.yml`**: Runs on an hourly schedule to refresh the embeddings used by the issue de-duplication model, ensuring its accuracy.
- **`gemini-scheduled-issue-triage.yml`**: Runs hourly to find and triage any issues that are unlabeled or have the `status/need-triage` label.
- **`gemini-scheduled-pr-triage.yml`**: Runs every 15 minutes to perform automated triage on open pull requests.
- **`gemini-self-assign-issue.yml`**: Allows contributors to self-assign an issue by commenting `/assign`. The workflow checks if the issue is available and if the user has not exceeded their assignment limit.

## Community and Maintenance

### `community-report.yml`

This workflow generates a weekly report summarizing community activity.

**Triggers:**

- Runs on a schedule (every Monday at 12:00 UTC).
- Manual trigger through the GitHub UI.

**Jobs:**

- Gathers statistics on new issues, pull requests, and discussions.
- Distinguishes between contributions from Googlers and the wider community.
- Uses Gemini to provide a brief summary and highlight any interesting trends.

### `no-response.yml`

This workflow helps manage issues and pull requests that are waiting for more information.

**Triggers:**

- Runs on a daily schedule.

**Jobs:**

- Closes issues and pull requests that have the `status/need-information` label and have not had any activity for 14 days.

### `stale.yml`

This workflow helps keep the repository clean by managing stale issues and pull requests.

**Triggers:**

- Runs on a daily schedule.

**Jobs:**

- Marks issues and pull requests as stale after 60 days of inactivity.
- Closes stale items if there is no further activity for another 14 days.

## Evaluation

### `eval.yml`

This workflow is used for running performance evaluations of the `swe-agent` against the SWE-bench benchmark.

**Triggers:**

- Manual trigger through the GitHub UI.

**Jobs:**

- Runs the evaluation in a containerized environment connected to Google Cloud Platform.
