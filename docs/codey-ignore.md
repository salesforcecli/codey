# Ignoring Files

This document provides an overview of the Codey Ignore (`.codeyignore`) feature of the Vibe Codey CLI.

The Vibe Codey CLI includes the ability to automatically ignore files, similar to `.gitignore` (used by Git) and `.aiexclude` (used by Gemini Code Assist). Adding paths to your `.codeyignore` file will exclude them from tools that support this feature, although they will still be visible to other services (such as Git).

## How it works

When you add a path to your `.codeyignore` file, tools that respect this file will exclude matching files and directories from their operations. For example, when you use the [`read_many_files`](./tools/multi-file.md) command, any paths in your `.codeyignore` file will be automatically excluded.

For the most part, `.codeyignore` follows the conventions of `.gitignore` files:

- Blank lines and lines starting with `#` are ignored.
- Standard glob patterns are supported (such as `*`, `?`, and `[]`).
- Putting a `/` at the end will only match directories.
- Putting a `/` at the beginning anchors the path relative to the `.codeyignore` file.
- `!` negates a pattern.

You can update your `.codeyignore` file at any time. To apply the changes, you must restart your Vibe Codey CLI session.

## How to use `.codeyignore`

To enable `.codeyignore`:

1. Create a file named `.codeyignore` in the root of your project directory.

To add a file or directory to `.codeyignore`:

1. Open your `.codeyignore` file.
2. Add the path or file you want to ignore, for example: `/archive/` or `apikeys.txt`.

### `.codeyignore` examples

You can use `.codeyignore` to ignore directories and files:

```
# Exclude your /packages/ directory and all subdirectories
/packages/

# Exclude your apikeys.txt file
apikeys.txt
```

You can use wildcards in your `.codeyignore` file with `*`:

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

To remove paths from your `.codeyignore` file, delete the relevant lines.
