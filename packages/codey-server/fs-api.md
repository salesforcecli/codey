### Codey Server File System API (POC)

This document specifies a minimal, safe-by-default file system API for Codey Server, scoped to a session’s workspace root. This is a POC: no authorization is required and git-aware endpoints, grep, and glob are intentionally excluded.

- **Scope**: All operations are restricted to the session’s `workspaceRoot` supplied at `POST /api/sessions`.
- **Routing base**: `/api/sessions/:id/fs/...`
- **Security model (POC)**: No auth. Path containment and basic safeguards still apply.
- **Out of scope**: grep/glob, git helpers, advanced policy prompts.

### Path resolution and safeguards

- **Root binding**: The effective root is the session’s `workspaceRoot` (resolved and canonicalized).
- **Containment**: For any client-provided `path`, the server will resolve `abs = realpath(join(workspaceRoot, path))` and reject if `abs` escapes the root after symlink resolution.
- **Symlinks**: Follow symlinks but reject if target escapes the root. Symlink creation is allowed only when the final target remains within the root.
- **Binary/text**: Text I/O uses UTF-8. For binary transfers, use base64 or streaming download/upload.
- **Ignore options**: Endpoints that enumerate files accept `respect_git_ignore` and `respect_codey_ignore` flags. Defaults align with Codey Core: both true.

### Conventions

- **Request ID**: Clients may set `x-request-id`; the server will generate one if missing.
- **ETag**: Read endpoints may return `etag`. Mutating endpoints accept `If-Match` to prevent overwrites. On mismatch, return `409`.
- **Errors**: JSON shape `{ error: string }` with meaningful HTTP status codes.
- **Timestamps**: ISO8601 strings.

### Endpoints

#### GET /api/sessions/:id/fs
Returns server capabilities and defaults for this POC.

Response 200:
```json
{
  "service": "codey-server/fs",
  "version": "0.1-poc",
  "features": {
    "list": true,
    "stat": true,
    "tree": true,
    "read": true,
    "download": true,
    "write": true,
    "replace": true,
    "mkdir": true,
    "move": true,
    "copy": true,
    "delete_file": true,
    "delete_dir": true,
    "upload": true
  },
  "defaults": {
    "respect_git_ignore": true,
    "respect_codey_ignore": true,
    "truncate_tool_output_lines": 1000
  }
}
```

#### GET /api/sessions/:id/fs/stat?path=...
Returns metadata for a file or directory.

Query params:
- `path` (string, required)

Response 200:
```json
{
  "path": "src/index.ts",
  "isDir": false,
  "size": 1234,
  "mode": 420,
  "mtime": "2025-09-15T10:20:00.000Z",
  "etag": "W/\"c1a9...\""
}
```

#### GET /api/sessions/:id/fs/list?path=...&recursive=false&respect_git_ignore=true&respect_codey_ignore=true&page=1&page_size=1000
Lists direct children of a directory. With `recursive=true`, returns a flattened listing under that directory (still subject to ignore settings). Large lists may paginate.

Query params:
- `path` (string, required)
- `recursive` (boolean, default false)
- `respect_git_ignore` (boolean, default true)
- `respect_codey_ignore` (boolean, default true)
- `page` (number, optional)
- `page_size` (number, optional)

Response 200:
```json
{
  "entries": [
    { "name": "src", "path": "src", "isDir": true, "size": 0, "mtime": "2025-09-15T10:00:00.000Z" },
    { "name": "README.md", "path": "README.md", "isDir": false, "size": 2048, "mtime": "2025-09-15T09:55:00.000Z" }
  ],
  "page": 1,
  "pageSize": 1000,
  "total": 2
}
```

#### GET /api/sessions/:id/fs/tree?path=...&depth=2&respect_git_ignore=true&respect_codey_ignore=true
Returns a compact directory tree structure up to `depth`.

Query params:
- `path` (string, required)
- `depth` (number, default 2)
- `respect_git_ignore` (boolean, default true)
- `respect_codey_ignore` (boolean, default true)

Response 200:
```json
{
  "path": "src",
  "name": "src",
  "isDir": true,
  "children": [
    { "path": "src/index.ts", "name": "index.ts", "isDir": false },
    { "path": "src/lib", "name": "lib", "isDir": true, "children": [] }
  ]
}
```

#### GET /api/sessions/:id/fs/read?path=...&offset=0&limit=500&as=text|base64
Reads a file. Supports line slicing for text and base64 for binary.

Query params:
- `path` (string, required)
- `offset` (number, optional; for text)
- `limit` (number, optional; for text)
- `as` (string, one of `text`|`base64`, default `text`)

Response 200 (text):
```json
{
  "content": "export const x = 1\n",
  "truncated": false,
  "etag": "W/\"c1a9...\"",
  "mtime": "2025-09-15T10:00:00.000Z"
}
```

Response 200 (base64):
```json
{
  "encoding": "base64",
  "content": "iVBORw0KGgoAAAANSUhEUgAA...",
  "etag": "W/\"b8f3...\"",
  "mtime": "2025-09-15T10:00:00.000Z"
}
```

#### GET /api/sessions/:id/fs/download?path=...
Streams the file as `application/octet-stream` with standard download headers. Rejects if outside root.

#### POST /api/sessions/:id/fs/write
Creates or overwrites a file. Parent directories are created as needed.

Body:
```json
{
  "path": "src/new.ts",
  "content": "export const x = 1\n",
  "contentEncoding": "text|base64",
  "ifMatchEtag": "optional"
}
```

Responses:
- 201 on create, 200 on overwrite
```json
{ "path": "src/new.ts", "bytesWritten": 16, "etag": "W/\"c1a9...\"", "mtime": "2025-09-15T10:10:00.000Z", "created": true }
```

#### POST /api/sessions/:id/fs/replace
Single-file in-place edit (search/replace once). If `old_string` appears multiple times, fail by default unless `allowMultiple=true` is provided, in which case all are replaced and the count is returned.

Body:
```json
{
  "path": "src/a.ts",
  "old_string": "foo",
  "new_string": "bar",
  "ifMatchEtag": "optional",
  "allowMultiple": false
}
```

Response 200:
```json
{ "path": "src/a.ts", "replacements": 1, "etag": "W/\"d3b2...\"" }
```

#### POST /api/sessions/:id/fs/mkdir
Create a directory.

Body:
```json
{ "path": "src/utils", "recursive": true }
```

Response 201:
```json
{ "path": "src/utils", "created": true }
```

#### POST /api/sessions/:id/fs/move
Move/rename a file or directory within the root.

Body:
```json
{ "from": "src/old.ts", "to": "src/new.ts", "overwrite": false, "ifMatchEtag": "optional" }
```

Response 200:
```json
{ "from": "src/old.ts", "to": "src/new.ts" }
```

#### POST /api/sessions/:id/fs/copy
Copy a file or directory within the root.

Body:
```json
{ "from": "assets/logo.png", "to": "public/logo.png", "overwrite": false }
```

Response 200:
```json
{ "from": "assets/logo.png", "to": "public/logo.png" }
```

#### DELETE /api/sessions/:id/fs/file?path=...&force=false
Delete a single file. If `If-Match` is provided and mismatches, return `409`.

Response 200:
```json
{ "path": "src/tmp.txt", "deleted": true }
```

#### DELETE /api/sessions/:id/fs/dir?path=...&recursive=false&force=false
Delete a directory. If `recursive=false` and the directory is not empty, return `400`.

Response 200:
```json
{ "path": "dist", "deleted": true }
```

#### POST /api/sessions/:id/fs/upload
Create or overwrite a file via JSON payload. Use for small/medium content; prefer `download/upload` streaming for very large files.

Body:
```json
{ "path": "assets/logo.png", "content": "iVBORw0KGgoAAA...", "contentEncoding": "base64" }
```

Response 201/200:
```json
{ "path": "assets/logo.png", "bytesWritten": 12345, "etag": "W/\"ab12...\"", "mtime": "2025-09-15T10:30:00.000Z" }
```

### Error responses

- 400: Validation errors (missing `path`, invalid flags, directory not empty without `recursive`).
- 404: Path not found or outside root after resolution.
- 409: ETag mismatch.
- 422: Semantic errors (e.g., multiple matches in replace without `allowMultiple`).
- 500: Unexpected server error.

Shapes:
```json
{ "error": "Message describing the issue" }
```

### Notes

- These endpoints are designed to align with Codey Core tool semantics (read, write, edit) without requiring the model or CLI to be in the loop.
- This is a POC: no authentication/authorization is enforced. Add auth before production use.


