# How are releases managed for this project?

_Exported on 8/4/2025 at 10:26:07 MDT from Cursor (1.3.9)_

---

**User**

how are releases handled for this project?

---

**Cursor**

Okay, I'll investigate how releases are handled for this project. I will start by looking for release-related configurations, scripts, and documentation. I'll begin with the `.github/` directory, as it likely contains automated workflow definitions for releases.

Okay, `.github/workflows` seems like the right place for release scripts. I'll check there.

`release.yml` seems like the most relevant file. I'll read it to understand the release process.

I've reviewed the `release.yml` file. Here's a summary of how releases are handled:

**Triggering a Release:**

- **Scheduled Nightly Releases:** A release is automatically triggered every day at midnight UTC.
- **Manual Releases:** A release can be manually triggered through the GitHub UI. This allows for patch releases and gives the user the option to specify a version, a branch or commit, and whether to run in "dry-run" mode.

**Release Process:**

The release process is defined as a single job named `release`, which runs on an Ubuntu environment. Here are the key steps:

1.  **Checkout Code:** The repository's code is checked out.
2.  **Determine Release Type:** The workflow determines if the release is a "nightly" or "manual" release.
3.  **Setup Node.js:** Node.js version 20 is set up.
4.  **Install Dependencies:** Project dependencies are installed using `npm ci`.
5.  **Get Version:** A script (`scripts/get-release-version.js`) is run to determine the release version and tag.
6.  **Run Tests:** A suite of tests is run to ensure the code is in a good state. This can be skipped for manual releases.
7.  **Create Release Branch:** A new branch is created for the release (e.g., `release/v0.1.11`).
8.  **Update Package Versions:** The version number in `package.json` and `package-lock.json` files is updated.
9.  **Commit and Push:** The version changes are committed and pushed to the new release branch. This step is skipped in a "dry run".
10. **Build and Prepare Packages:** The packages are built and prepared for publishing.
11. **Publish to npm:** The `@google/gemini-cli-core` and `@google/gemini-cli` packages are published to an internal npm registry. This step is also skipped in a "dry run."
12. **Create GitHub Release:** A new GitHub release and corresponding tag are created. This includes release notes and attached assets. This step is skipped in a "dry run."
13. **Create Issue on Failure:** If any of the previous steps fail, an issue is automatically created in the repository to track the failure.

In short, the project uses a GitHub Actions workflow to automate the release process, including versioning, testing, packaging, and publishing. It supports both scheduled nightly releases and manual releases.

Is there anything else you would like to know?

---

**User**

is the package only distrubted to npm?

---

**Cursor**

Based on my analysis of the `release.yml` file, the package is distributed in two main ways:

1.  **npm Registry:** The `@google/gemini-cli` and `@google/gemini-cli-core` packages are published to an npm registry. The `release.yml` file shows this is done using `npm publish`.

2.  **GitHub Releases:** The release workflow also creates a GitHub release for each version. A `bundle/gemini.js` file is attached to this release, which means users can download it directly from the GitHub releases page.

I will now inspect the `package.json` to confirm the build process that creates the `bundle/gemini.js` file.

You're right to question if npm is the only distribution method. Based on my previous analysis and a deeper look into the `package.json` file, the package is distributed in several ways:

1.  **npm Registry:** As we saw in the `release.yml` file, the primary distribution method is publishing the `@google/gemini-cli` and `@google/gemini-cli-core` packages to an npm registry. The `package.json` file confirms this by defining the package name and including a `publishConfig`.

2.  **GitHub Releases:** The `release.yml` workflow uploads `bundle/gemini.js` as an asset to each GitHub release. The `package.json` file has a `bundle` script that uses `esbuild` to create this file. This allows users to download the CLI tool directly from GitHub.

3.  **Docker Image:** The `package.json` file contains scripts and configuration related to Docker (`auth:docker`, `build:sandbox`, `test:integration:sandbox:docker`, and the `sandboxImageUri` config). This indicates that a Docker image is also a distribution method, likely for running the tool in a containerized environment.

4.  **VS Code Extension:** There's a `build:vscode` script in `package.json` which runs `scripts/build_vscode_companion.js`. This, along with the `packages/vscode-ide-companion` directory in the project structure, strongly suggests that a companion VS Code extension is also built and distributed.

To summarize, while npm is a key distribution channel, the project is also distributed as a standalone executable via GitHub Releases, as a Docker image, and as a VS Code extension.
