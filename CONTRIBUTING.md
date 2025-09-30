# Contributing to Vibe Codey CLI

First off, thank you for considering contributing to Vibe Codey CLI! It's people like you that make the open source community such a great place. We welcome contributions of all kinds, from reporting bugs and improving documentation to submitting code that adds new features or fixes problems.

## Code of Conduct

All contributors are expected to follow our [Code of Conduct](./CODE_OF_CONDUCT.md). Please make sure you are familiar with its contents.

## Ways to Contribute

### Reporting Bugs

If you find a bug, please check the [issues list](https://github.com/salesforcecli/codey/issues) to see if it has already been reported. If not, please [open a new issue](https://github.com/salesforcecli/codey/issues/new) and provide as much detail as possible, including:

- A clear, descriptive title.
- Steps to reproduce the bug.
- The expected behavior and what actually happened.
- Your operating system, Node.js version, and Vibe Codey CLI version.

### Suggesting Enhancements

If you have an idea for a new feature or an improvement to an existing one, please [open an issue](https://github.com/salesforcecli/codey/issues/new) to start a discussion. This allows us to align on the proposal before any code is written.

### Pull Requests

We love pull requests! If you're ready to contribute code, please follow the steps below.

## Development Setup

1.  **Fork the repository** on GitHub.
2.  **Clone your fork** locally:
    ```bash
    git clone https://github.com/YOUR_USERNAME/codey.git
    cd codey
    ```
3.  **Install dependencies**:
    ```bash
    npm install
    ```
4.  **Build the project**:
    ```bash
    npm run build
    ```
5.  **Run the CLI locally**:
    To test your changes, you can run the CLI from the project root:
    ```bash
    node ./scripts/start.js
    ```
    You will also need to set up authentication as described in the [README.md](./README.md#authentication).

## Submitting a Pull Request

1.  Create a new branch for your changes:
    ```bash
    git checkout -b my-feature-branch
    ```
2.  Make your changes.
3.  **Format and lint your code**:
    ```bash
    npm run format
    npm run lint
    ```
4.  **Run tests**:
    Make sure all tests pass before submitting your pull request.
    ```bash
    npm test
    ```
5.  Commit your changes. We encourage using [conventional commit messages](https://www.conventionalcommits.org/).
6.  Push your branch to your fork on GitHub:
    ```bash
    git push origin my-feature-branch
    ```
7.  Open a pull request from your fork to the `main` branch of the `salesforcecli/codey` repository.
8.  In the pull request description, please explain the changes you made and link to any relevant issues.

## Contributor License Agreement (CLA)

External contributors will be required to sign a Contributor's License Agreement. You can do so by going to: https://cla.salesforce.com/sign-cla.

## Security

Please report any security vulnerabilities to `security@salesforce.com` as soon as they are discovered.
