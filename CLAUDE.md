# claude-chat-archive — project rules

This repo is the source of the `claude-chat-archive` npm package: a CLI that converts a Claude.ai export folder into a markdown archive. Distributed via `npx` and `bunx`, so the **published artifact must run on plain Node** without Bun.

## Runtime target

- **Node ≥ 20 and Bun**, both supported. Build target is `node`.
- **Use `node:*` standard APIs only** in `src/` — `node:fs/promises`, `node:path`, `node:os`, `node:url`, `node:util` (`parseArgs`).
- **Do NOT use Bun-only APIs in `src/`**: no `Bun.file`, `Bun.serve`, `Bun.$`, `Bun.sql`, `Bun.redis`, `bun:sqlite`, etc. These break `npx claude-chat-archive`.
- **Zero runtime dependencies.** Add to `devDependencies` only.
- Bun-only APIs are fine in `test/` (we run tests with `bun test`).

## Tooling (use Bun for dev workflow)

- `bun install` — install
- `bun test` — run tests (uses `bun:test`)
- `bun run build` — `bun build --target=node --outdir=dist src/cli.ts src/index.ts && tsc --emitDeclarationOnly`
- `bun run lint` — oxlint
- `bun run format` — oxfmt
- `bun src/cli.ts ...` — run CLI from source for smoke tests
- `bun pm pack --dry-run` — verify package contents before publish

## Module structure

```
src/
├── cli.ts         # entry: shebang + parseArgs (no logic beyond wiring)
├── config.ts      # CLI argv → Config + validation
├── types.ts       # ExportConversation, ExportProject, Config, RunStats
├── index.ts       # programmatic API: archive(cfg)
├── reader/        # JSON loaders (one file per source: conversations, projects)
├── transform/     # PURE FUNCTIONS only — input → output, no I/O
│   ├── filename.ts, frontmatter.ts, attachment.ts, message.ts
└── writer/        # I/O — markdown + extracted files to disk
    ├── chat.ts, project.ts, attachment.ts, created.ts
test/              # mirrors src/ structure, plus integration test/cli.test.ts
test/fixtures/export-min/  # tiny sanitized export used by integration tests
```

**Layering rule:** `transform/` is pure (no `fs`, no `process`). `writer/` is the only place that writes files. `reader/` is the only place that reads source JSON. `index.ts` orchestrates; `cli.ts` parses argv and calls `archive()`.

## Coding conventions

- **TDD discipline.** New behavior: write failing test first → run it (must fail) → minimal implementation → run again (must pass) → commit.
- **No new runtime deps.** If you reach for one, restate the problem.
- **YAML frontmatter** is hand-rolled in `transform/frontmatter.ts` — quote rules live there, do not pull in `js-yaml`.
- **Filenames** go through `sanitizeFilename()` in `transform/filename.ts` before any disk write. This is the single sanitization point — don't re-implement it.
- **Collision handling**: `conversationFilename()` and `writeCreatedFile()` accept a `Set<string>` of used names and append `-2`, `-3` suffixes. Do not change this protocol.
- **Korean text**: preserve as-is in filenames and markdown. Do not slugify, do not romanize.
- Comments are rare — only when the WHY is non-obvious (e.g., the YAML quote regex). Identifiers should self-document.

## Schema source of truth

`src/types.ts` defines the export schema. Verified fields and content types (Dec 2025–May 2026 exports):

- Conversation top fields: `uuid, name, summary, created_at, updated_at, account, chat_messages` — **no `project_uuid`**, so chat ↔ project linkage is impossible.
- Message content types: `text, thinking, tool_use, tool_result, token_budget`.
- Tools that produce file content (extracted to `output/created/`): `create_file` (`{path, file_text, description}`), `artifacts` with command in {`create`, `update`, `rewrite`} (`{title|id, content}`).
- Other observed tools (kept as one-line / code-block summary, no extraction): `bash_tool`, `web_search`, `present_files`, `view`, `str_replace`, `web_fetch`, `conversation_search`, `ask_user_input_v0`, `memory_user_edits`, `recent_chats`, `visualize:*`, `bash`.

If a new tool name appears, decide whether it produces a file (extend `extractCreatedFile()` in `transform/message.ts`) or is just a call (no change needed).

## Commit style

- No prefix, capital first letter, under 80 chars, imperative mood. Examples already in `git log`:
  - `Add filename sanitization with collision handling`
  - `Extract create_file and artifacts content into created/ folder`

## Output structure (what users see)

```
output/
├── chats/<YYYY-MM-DD title>.md       # one per conversation, frontmatter + body
├── projects/
│   ├── <name>.md                      # if project has no docs
│   └── <name>/README.md + docs/...    # if project has docs
├── attachments/<chat-uuid>/<file>     # files the user uploaded (extracted_content >= threshold)
└── created/<chat-uuid>/<file>         # files Claude created via create_file / artifacts
```

`attachments/` and `created/` are intentionally separate — different provenance (user vs. assistant).

## CLI surface (do not break without a major bump)

```
claude-chat-archive <input-dir> [output-dir] [options]
```

Options: `--mode {minimal,standard,full}` (default `standard`), `--no-thinking`, `--no-tools`, `--attachment-threshold <bytes>` (default `4096`), `--scope {all,chats,projects}` (default `all`), `--dry-run`, `-h/--help`, `-v/--version`.

Single-arg form derives output as `<input>/output`.
