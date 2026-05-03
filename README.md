# claude-chat-archive

Convert your Claude.ai chat export into a navigable markdown archive.

## What it does

Claude.ai's data export is a single 70MB+ JSON. This tool turns it into:

- One markdown file per conversation, named `YYYY-MM-DD <title>.md`
- One file or folder per project (with `docs/` if any docs exist)
- Attachments inlined when small, separated when large
- YAML frontmatter for Obsidian / Dataview queries

## Usage

```bash
# Most common: point at your export folder
npx claude-chat-archive ./claude-export ./output

# Or under Bun
bunx claude-chat-archive ./claude-export ./output

# Single argument creates ./claude-export/output
npx claude-chat-archive ./claude-export
```

## Options

| Flag                              | Default    | Description                                                                       |
| --------------------------------- | ---------- | --------------------------------------------------------------------------------- |
| `--mode <m>`                      | `standard` | `minimal` (text only) / `standard` (+ thinking + tool summaries) / `full` (everything) |
| `--no-thinking`                   | off        | Omit assistant thinking content                                                   |
| `--no-tools`                      | off        | Omit tool_use / tool_result content                                               |
| `--attachment-threshold <bytes>`  | `4096`     | Inline attachments smaller than this; otherwise external                          |
| `--scope <s>`                     | `all`      | `all` / `chats` / `projects`                                                      |
| `--dry-run`                       | off        | Print stats without writing                                                       |
| `-h, --help`                      | —          | Show help                                                                         |
| `-v, --version`                   | —          | Show version                                                                      |

## Output structure

```
output/
├── chats/
│   └── 2026-01-29 PDF 버퍼를 이미지로 변환.md
├── projects/
│   ├── 프로그래밍 강의.md            # no docs → single file
│   └── How to use Claude/             # has docs → folder
│       ├── README.md
│       └── docs/Claude prompting guide.md
└── attachments/
    └── <chat-uuid>/<filename>
```

Each chat markdown has frontmatter for searchable metadata:

```yaml
---
uuid: 5a2e2c19-7df0-4a92-ad55-c52a5189bcbe
title: PDF 버퍼를 이미지로 변환
created: 2026-01-29T12:06:57Z
updated: 2026-01-29T12:07:25Z
message_count: 4
attachment_count: 1
tags: [claude-chat]
summary: |
  Conversation summary preserved from the export…
---
```

## Programmatic API

```typescript
import { archive } from "claude-chat-archive";

const stats = await archive({
  inputDir: "./claude-export",
  outputDir: "./out",
  mode: "standard",
  includeThinking: true,
  includeTools: true,
  attachmentThreshold: 4096,
  scope: "all",
  dryRun: false,
});

console.log(stats);
// { chatsTotal: 177, chatsWritten: 177, projectsWritten: 15, ... }
```

## Requirements

- Node ≥ 20 or Bun
- Zero runtime dependencies

## License

MIT
