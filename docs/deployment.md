# Vibe Codey CLI Execution and Deployment

This document describes how to run Vibe Codey CLI and explains the deployment architecture that Vibe Codey CLI uses.

## Running Vibe Codey CLI

There are several ways to run Vibe Codey CLI. The option you choose depends on how you intend to use Vibe Codey CLI.

---

### 1. Standard installation (Recommended for typical users)

This is the recommended way for end-users to install Vibe Codey CLI. It involves downloading the Vibe Codey CLI package from the NPM registry.

- **Global install:**

  ```bash
  npm install -g @salesforce/codey
  ```

  Then, run the CLI from anywhere:

  ```bash
  codey
  ```

- **NPX execution:**

  ```bash
  # Execute the latest version from NPM without a global install
  npx @salesforce/codey
  ```

---

### 2. Running from source (Recommended for Vibe Codey CLI contributors)

Contributors to the project will want to run the CLI directly from the source code.

- **Development Mode:**
  This method provides hot-reloading and is useful for active development.
  ```bash
  # From the root of the repository
  npm run start
  ```
- **Production-like mode (Linked package):**
  This method simulates a global installation by linking your local package. It's useful for testing a local build in a production workflow.

  ```bash
  # Link the local cli package to your global node_modules
  npm link packages/cli

  # Now you can run your local version using the `codey` command
  codey
  ```

---

### 3. Running the latest Vibe Codey CLI commit from GitHub

You can run the most recently committed version of Vibe Codey CLI directly from the GitHub repository. This is useful for testing features still in development.

```bash
# Execute the CLI directly from the main branch on GitHub
npx https://github.com/salesforcecli/codey
```

## Deployment architecture

The execution methods described above are made possible by the following architectural components and processes:

**NPM packages**

Vibe Codey CLI project is a monorepo that publishes two core packages to the NPM registry:

- `@salesforce/codey-core`: The backend, handling logic and tool execution.
- `@salesforce/codey`: The user-facing frontend.

These packages are used when performing the standard installation and when running Vibe Codey CLI from the source.

**Build and packaging processes**

There are two distinct build processes used, depending on the distribution channel:

- **NPM publication:** For publishing to the NPM registry, the TypeScript source code in `@salesforce/codey-core` and `@salesforce/codey` is transpiled into standard JavaScript using the TypeScript Compiler (`tsc`). The resulting `dist/` directory is what gets published in the NPM package. This is a standard approach for TypeScript libraries.

- **GitHub `npx` execution:** When running the latest version of Vibe Codey CLI directly from GitHub, a different process is triggered by the `prepare` script in `package.json`. This script uses `esbuild` to bundle the entire application and its dependencies into a single, self-contained JavaScript file. This bundle is created on-the-fly on the user's machine and is not checked into the repository.

## Release process

The release process is automated through GitHub Actions. The release workflow performs the following actions:

1.  Build the NPM packages using `tsc`.
2.  Publish the NPM packages to the artifact registry.
3.  Create GitHub releases with bundled assets.
