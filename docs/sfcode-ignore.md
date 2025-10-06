# Ignoring Files

This document provides an overview of the sfcode Ignore (`.sfcodeignore`) feature of the Agentforce Vibes CLI.

The Agentforce Vibes CLI includes the ability to automatically ignore files, similar to `.gitignore` (used by Git) and `.aiexclude` (used by Gemini Code Assist). Adding paths to your `.sfcodeignore` file will exclude them from tools that support this feature, although they will still be visible to other services (such as Git).

## How it works

When you add a path to your `.sfcodeignore` file, tools that respect this file will exclude matching files and directories from their operations. For example, when you use the [`read_many_files`](./tools/multi-file.md) command, any paths in your `.sfcodeignore` file will be automatically excluded.

For the most part, `.sfcodeignore` follows the conventions of `.gitignore` files:

- Blank lines and lines starting with `#` are ignored.
- Standard glob patterns are supported (such as `*`, `?`, and `[]`).
- Putting a `/` at the end will only match directories.
- Putting a `/` at the beginning anchors the path relative to the `.sfcodeignore` file.
- `!` negates a pattern.

You can update your `.sfcodeignore` file at any time. To apply the changes, you must restart your Agentforce Vibes CLI session.

## How to use `.sfcodeignore`

To enable `.sfcodeignore`:

1. Create a file named `.sfcodeignore` in the root of your project directory.

To add a file or directory to `.sfcodeignore`:

1. Open your `.sfcodeignore` file.
2. Add the path or file you want to ignore, for example: `/archive/` or `apikeys.txt`.

### `.sfcodeignore` examples

You can use `.sfcodeignore` to ignore directories and files:

```
# Exclude your /packages/ directory and all subdirectories
/packages/

# Exclude your apikeys.txt file
apikeys.txt
```

You can use wildcards in your `.sfcodeignore` file with `*`:

```
# Exclude all .md files
*.md
```

Finally, you can exclude files and directories from exclusion with `!`:

```
# Exclude all .md files except README.md
*.md
!README.md
```

To remove paths from your `.sfcodeignore` file, delete the relevant lines.
