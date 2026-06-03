# claude-chat-archive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a zero-runtime-dependency CLI npm package (`claude-chat-archive`) that converts a Claude.ai export folder (`conversations.json` + `projects/*.json`) into an Obsidian-friendly markdown archive, runnable via `npx`/`bunx`.

**Architecture:** Pure-function transform layer (message → markdown, attachment → inline/external, filename, frontmatter) wrapped by streaming readers and I/O writers. CLI orchestrator wires it all together via `node:util.parseArgs`. All modules use Node standard APIs only.

**Tech Stack:** TypeScript, Node ≥ 20 / Bun runtime, `node:fs/promises`, `node:path`, `node:util.parseArgs`, `bun:test`, `bun build --target=node`, oxlint, oxfmt.

---

## File Structure

```
claude-chat-archive/
├── package.json              # name, bin, files, scripts (modify existing)
├── tsconfig.json             # existing OK
├── .gitignore                # existing OK
├── .npmignore                # NEW — keep package small
├── README.md                 # NEW — usage docs
├── src/
│   ├── cli.ts                # entry: shebang + parseArgs + run()
│   ├── config.ts             # CLI argv → Config + validate
│   ├── types.ts              # ExportConversation, ExportMessage, etc.
│   ├── index.ts              # programmatic API export
│   ├── reader/
│   │   ├── conversations.ts  # load conversations.json
│   │   └── projects.ts       # load projects/*.json
│   ├── transform/
│   │   ├── filename.ts       # safeFilename, conversationFilename
│   │   ├── frontmatter.ts    # toYamlFrontmatter
│   │   ├── attachment.ts     # renderAttachment, decideAttachmentPlacement
│   │   └── message.ts        # renderMessage (mode-aware)
│   └── writer/
│       ├── attachment.ts     # writeExternalAttachment
│       ├── chat.ts           # writeChat
│       └── project.ts        # writeProject
└── test/
    ├── fixtures/             # tiny sanitized export samples
    │   ├── export-min/
    │   └── helpers.ts
    ├── transform/
    │   ├── filename.test.ts
    │   ├── frontmatter.test.ts
    │   ├── attachment.test.ts
    │   └── message.test.ts
    ├── reader/
    │   ├── conversations.test.ts
    │   └── projects.test.ts
    ├── writer/
    │   ├── attachment.test.ts
    │   ├── chat.test.ts
    │   └── project.test.ts
    ├── config.test.ts
    └── cli.test.ts           # integration: full pipeline
```

**Build order rationale:** Types → pure transforms → config/readers → writers → CLI orchestrator → docs. Each layer only depends on prior layers.

---

## Task 1: Project Bootstrap

**Files:**

- Modify: `package.json`
- Create: `.npmignore`
- Modify: `index.ts` (delete — replaced by `src/index.ts`)
- Create: `src/` directory tree

- [ ] **Step 1: Replace `package.json` contents**

```json
{
  "name": "claude-chat-archive",
  "version": "0.1.0",
  "description": "Convert Claude.ai chat export into a navigable markdown archive.",
  "keywords": ["claude", "claude-ai", "archive", "markdown", "export", "obsidian"],
  "license": "MIT",
  "author": "soomtong",
  "type": "module",
  "bin": {
    "claude-chat-archive": "./dist/cli.js"
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist", "README.md"],
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "build": "bun build --target=node --outdir=dist src/cli.ts src/index.ts && bun run build:types",
    "build:types": "tsc --emitDeclarationOnly --declaration --outDir dist",
    "test": "bun test",
    "lint": "oxlint",
    "format": "oxfmt"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "oxlint": "latest",
    "oxfmt": "latest",
    "typescript": "^5"
  }
}
```

- [ ] **Step 2: Create `.npmignore`**

```
src/
test/
docs/
projects/
*.json
!package.json
node_modules/
.cursor/
CLAUDE.md
.claude/
```

- [ ] **Step 3: Remove old `index.ts` and create source tree**

```bash
rm index.ts
mkdir -p src/reader src/transform src/writer
mkdir -p test/transform test/reader test/writer test/fixtures
```

- [ ] **Step 4: Adjust tsconfig for emit (keep noEmit but add declaration support via cli flag)**

Open `tsconfig.json`. Change `"noEmit": true` to `"noEmit": false` and add:

```json
"declaration": true,
"declarationMap": false,
"outDir": "dist",
"rootDir": "src",
"include": ["src/**/*"],
"exclude": ["test", "dist", "node_modules"]
```

Final `tsconfig.json`:

```json
{
  "compilerOptions": {
    "lib": ["ESNext"],
    "target": "ESNext",
    "module": "Preserve",
    "moduleDetection": "force",
    "jsx": "react-jsx",
    "allowJs": true,
    "types": ["bun"],
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "noEmit": false,
    "declaration": true,
    "declarationMap": false,
    "emitDeclarationOnly": true,
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "skipLibCheck": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noPropertyAccessFromIndexSignature": false
  },
  "include": ["src/**/*"],
  "exclude": ["test", "dist", "node_modules"]
}
```

- [ ] **Step 5: Install devDependencies**

Run: `bun install`
Expected: oxlint, oxfmt, typescript installed.

- [ ] **Step 6: Commit**

```bash
git add package.json .npmignore tsconfig.json
git rm index.ts
git commit -m "Bootstrap claude-chat-archive package skeleton"
```

---

## Task 2: Define Export Schema Types

**Files:**

- Create: `src/types.ts`

- [ ] **Step 1: Write `src/types.ts`**

```typescript
export type Sender = "human" | "assistant";

export type ContentType = "text" | "thinking" | "tool_use" | "tool_result" | "token_budget";

export interface ExportContent {
  type: ContentType;
  text?: string;
  // tool_use fields
  name?: string;
  input?: unknown;
  // tool_result fields
  content?: unknown;
  is_error?: boolean;
  // token_budget fields
  budget?: number;
}

export interface ExportAttachment {
  file_name: string;
  file_size: number;
  file_type: string;
  extracted_content: string;
}

export interface ExportFile {
  file_uuid: string;
  file_name: string;
}

export interface ExportMessage {
  uuid: string;
  text: string;
  sender: Sender;
  created_at: string;
  updated_at: string;
  content: ExportContent[];
  attachments: ExportAttachment[];
  files: ExportFile[];
  parent_message_uuid: string;
}

export interface ExportConversation {
  uuid: string;
  name: string;
  summary: string;
  created_at: string;
  updated_at: string;
  account: { uuid: string };
  chat_messages: ExportMessage[];
}

export interface ExportProjectDoc {
  uuid: string;
  filename: string;
  content: string;
}

export interface ExportProject {
  uuid: string;
  name: string;
  description: string;
  is_private: boolean;
  is_starter_project: boolean;
  prompt_template: string;
  created_at: string;
  updated_at: string;
  creator: { uuid: string; full_name: string };
  docs: ExportProjectDoc[];
}

export type ContentMode = "minimal" | "standard" | "full";
export type Scope = "all" | "chats" | "projects";

export interface Config {
  inputDir: string;
  outputDir: string;
  mode: ContentMode;
  includeThinking: boolean;
  includeTools: boolean;
  attachmentThreshold: number;
  scope: Scope;
  dryRun: boolean;
}

export interface RunStats {
  chatsTotal: number;
  chatsWritten: number;
  chatsSkipped: number;
  projectsTotal: number;
  projectsWritten: number;
  attachmentsInline: number;
  attachmentsExternal: number;
  attachmentsMissing: number;
}
```

- [ ] **Step 2: Verify type-check passes**

Run: `bun tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "Define Claude export schema and Config types"
```

---

## Task 3: filename Transform (TDD)

**Files:**

- Create: `src/transform/filename.ts`
- Create: `test/transform/filename.test.ts`

- [ ] **Step 1: Write failing tests**

Create `test/transform/filename.test.ts`:

```typescript
import { test, expect, describe } from "bun:test";
import { sanitizeFilename, conversationFilename } from "../../src/transform/filename.ts";
import type { ExportConversation } from "../../src/types.ts";

describe("sanitizeFilename", () => {
  test("preserves Korean characters", () => {
    expect(sanitizeFilename("프로그래밍 강의")).toBe("프로그래밍 강의");
  });
  test("replaces filesystem-forbidden chars with underscore", () => {
    expect(sanitizeFilename('a/b\\c:d*e?f"g<h>i|j')).toBe("a_b_c_d_e_f_g_h_i_j");
  });
  test("trims whitespace", () => {
    expect(sanitizeFilename("  hello  ")).toBe("hello");
  });
  test("collapses internal whitespace", () => {
    expect(sanitizeFilename("a\n\nb\tc")).toBe("a b c");
  });
});

describe("conversationFilename", () => {
  const baseConv = (overrides: Partial<ExportConversation>): ExportConversation => ({
    uuid: "5a2e2c19-7df0-4a92-ad55-c52a5189bcbe",
    name: "PDF 버퍼를 이미지로 변환",
    summary: "",
    created_at: "2026-01-29T12:06:57.494326Z",
    updated_at: "2026-01-29T12:07:25.180935Z",
    account: { uuid: "x" },
    chat_messages: [],
    ...overrides,
  });

  test("uses created_at date + name", () => {
    const f = conversationFilename(baseConv({}), new Set());
    expect(f).toBe("2026-01-29 PDF 버퍼를 이미지로 변환.md");
  });

  test("falls back to first human message text when name is empty", () => {
    const f = conversationFilename(
      baseConv({
        name: "",
        chat_messages: [
          {
            uuid: "m1",
            text: "안녕하세요 도와주세요",
            sender: "human",
            created_at: "2026-01-29T12:06:57Z",
            updated_at: "2026-01-29T12:06:57Z",
            content: [],
            attachments: [],
            files: [],
            parent_message_uuid: "00000000-0000-4000-8000-000000000000",
          },
        ],
      }),
      new Set(),
    );
    expect(f).toBe("2026-01-29 안녕하세요 도와주세요.md");
  });

  test("untitled fallback uses uuid prefix when no human message", () => {
    const f = conversationFilename(baseConv({ name: "", chat_messages: [] }), new Set());
    expect(f).toBe("2026-01-29 untitled-5a2e2c19.md");
  });

  test("appends -2 on collision", () => {
    const used = new Set<string>(["2026-01-29 PDF 버퍼를 이미지로 변환.md"]);
    const f = conversationFilename(baseConv({}), used);
    expect(f).toBe("2026-01-29 PDF 버퍼를 이미지로 변환-2.md");
  });

  test("appends -3 when -2 also taken", () => {
    const used = new Set<string>([
      "2026-01-29 PDF 버퍼를 이미지로 변환.md",
      "2026-01-29 PDF 버퍼를 이미지로 변환-2.md",
    ]);
    const f = conversationFilename(baseConv({}), used);
    expect(f).toBe("2026-01-29 PDF 버퍼를 이미지로 변환-3.md");
  });

  test("truncates very long names to 80 chars before extension", () => {
    const long = "가".repeat(200);
    const f = conversationFilename(baseConv({ name: long }), new Set());
    expect(f.endsWith(".md")).toBe(true);
    expect(f.length).toBeLessThanOrEqual(11 + 80 + 3); // date + space + 80 + .md
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test test/transform/filename.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/transform/filename.ts`**

```typescript
import type { ExportConversation } from "../types.ts";

const FORBIDDEN = /[/\\:*?"<>|]/g;
const WHITESPACE = /\s+/g;
const MAX_TITLE_LENGTH = 80;

export function sanitizeFilename(input: string): string {
  return input.replace(FORBIDDEN, "_").replace(WHITESPACE, " ").trim();
}

function isoDate(iso: string): string {
  return iso.slice(0, 10);
}

function firstHumanText(conv: ExportConversation): string | null {
  const msg = conv.chat_messages.find((m) => m.sender === "human");
  if (!msg) return null;
  const text = msg.text || msg.content.find((c) => c.type === "text")?.text || "";
  const trimmed = text.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function deriveTitle(conv: ExportConversation): string {
  const name = conv.name?.trim();
  if (name) return name;
  const human = firstHumanText(conv);
  if (human) return human.slice(0, 30);
  return `untitled-${conv.uuid.slice(0, 8)}`;
}

export function conversationFilename(conv: ExportConversation, used: Set<string>): string {
  const date = isoDate(conv.created_at);
  const titleRaw = deriveTitle(conv);
  const titleClean = sanitizeFilename(titleRaw).slice(0, MAX_TITLE_LENGTH);
  const base = `${date} ${titleClean}`;

  let name = `${base}.md`;
  let suffix = 2;
  while (used.has(name)) {
    name = `${base}-${suffix}.md`;
    suffix += 1;
  }
  used.add(name);
  return name;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test test/transform/filename.test.ts`
Expected: PASS — 8 passing.

- [ ] **Step 5: Commit**

```bash
git add src/transform/filename.ts test/transform/filename.test.ts
git commit -m "Add filename sanitization with collision handling"
```

---

## Task 4: frontmatter Transform (TDD)

**Files:**

- Create: `src/transform/frontmatter.ts`
- Create: `test/transform/frontmatter.test.ts`

- [ ] **Step 1: Write failing tests**

Create `test/transform/frontmatter.test.ts`:

```typescript
import { test, expect, describe } from "bun:test";
import { toYamlFrontmatter } from "../../src/transform/frontmatter.ts";

describe("toYamlFrontmatter", () => {
  test("renders simple scalar fields", () => {
    const out = toYamlFrontmatter({
      uuid: "abc",
      title: "hello",
      message_count: 4,
    });
    expect(out).toBe("---\nuuid: abc\ntitle: hello\nmessage_count: 4\n---\n");
  });

  test("quotes strings containing colons", () => {
    const out = toYamlFrontmatter({ title: "name: with colon" });
    expect(out).toBe('---\ntitle: "name: with colon"\n---\n');
  });

  test("escapes embedded double quotes", () => {
    const out = toYamlFrontmatter({ title: 'has "quotes" inside' });
    expect(out).toBe('---\ntitle: "has \\"quotes\\" inside"\n---\n');
  });

  test("renders multiline string with literal block scalar", () => {
    const out = toYamlFrontmatter({ summary: "line1\nline2\nline3" });
    expect(out).toBe("---\nsummary: |\n  line1\n  line2\n  line3\n---\n");
  });

  test("renders array of strings inline", () => {
    const out = toYamlFrontmatter({ tags: ["claude-chat", "korean"] });
    expect(out).toBe("---\ntags: [claude-chat, korean]\n---\n");
  });

  test("renders boolean values", () => {
    const out = toYamlFrontmatter({ is_private: true, is_starter: false });
    expect(out).toBe("---\nis_private: true\nis_starter: false\n---\n");
  });

  test("omits null and undefined fields", () => {
    const out = toYamlFrontmatter({ a: "x", b: null, c: undefined, d: 1 });
    expect(out).toBe("---\na: x\nd: 1\n---\n");
  });

  test("omits empty string summary", () => {
    const out = toYamlFrontmatter({ uuid: "x", summary: "" });
    expect(out).toBe("---\nuuid: x\n---\n");
  });
});
```

- [ ] **Step 2: Run tests — should fail**

Run: `bun test test/transform/frontmatter.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/transform/frontmatter.ts`**

```typescript
export type FrontmatterValue = string | number | boolean | string[] | null | undefined;

const NEEDS_QUOTING = /[:#&*!|>'"%@`,\[\]{}?\-]/;

function renderScalar(value: string | number | boolean): string {
  if (typeof value === "boolean" || typeof value === "number") {
    return String(value);
  }
  if (value.includes("\n")) {
    const indented = value
      .split("\n")
      .map((line) => `  ${line}`)
      .join("\n");
    return `|\n${indented}`;
  }
  if (NEEDS_QUOTING.test(value) || value !== value.trim()) {
    const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `"${escaped}"`;
  }
  return value;
}

function renderArray(values: string[]): string {
  if (values.length === 0) return "[]";
  return `[${values.join(", ")}]`;
}

export function toYamlFrontmatter(fields: Record<string, FrontmatterValue>): string {
  const lines: string[] = ["---"];
  for (const [key, value] of Object.entries(fields)) {
    if (value === null || value === undefined) continue;
    if (typeof value === "string" && value === "") continue;
    if (Array.isArray(value)) {
      lines.push(`${key}: ${renderArray(value)}`);
    } else {
      lines.push(`${key}: ${renderScalar(value)}`);
    }
  }
  lines.push("---", "");
  return lines.join("\n");
}
```

- [ ] **Step 4: Run tests — should pass**

Run: `bun test test/transform/frontmatter.test.ts`
Expected: PASS — 8 passing.

- [ ] **Step 5: Commit**

```bash
git add src/transform/frontmatter.ts test/transform/frontmatter.test.ts
git commit -m "Add YAML frontmatter serializer with multiline support"
```

---

## Task 5: attachment Transform (TDD)

**Files:**

- Create: `src/transform/attachment.ts`
- Create: `test/transform/attachment.test.ts`

- [ ] **Step 1: Write failing tests**

Create `test/transform/attachment.test.ts`:

```typescript
import { test, expect, describe } from "bun:test";
import { renderAttachment, decideAttachmentPlacement } from "../../src/transform/attachment.ts";
import type { ExportAttachment } from "../../src/types.ts";

const att = (overrides: Partial<ExportAttachment>): ExportAttachment => ({
  file_name: "note.txt",
  file_size: 100,
  file_type: "txt",
  extracted_content: "hello world",
  ...overrides,
});

describe("decideAttachmentPlacement", () => {
  test("inline when content length is below threshold", () => {
    const a = att({ extracted_content: "x".repeat(4095) });
    expect(decideAttachmentPlacement(a, 4096)).toBe("inline");
  });
  test("external when content length equals threshold", () => {
    const a = att({ extracted_content: "x".repeat(4096) });
    expect(decideAttachmentPlacement(a, 4096)).toBe("external");
  });
  test("external when content length exceeds threshold", () => {
    const a = att({ extracted_content: "x".repeat(4097) });
    expect(decideAttachmentPlacement(a, 4096)).toBe("external");
  });
  test("inline when content is empty", () => {
    expect(decideAttachmentPlacement(att({ extracted_content: "" }), 4096)).toBe("inline");
  });
});

describe("renderAttachment", () => {
  test("renders inline as collapsible callout", () => {
    const md = renderAttachment(att({}), "inline", "chat-uuid", "../attachments");
    expect(md).toContain("> [!file]- 📎 note.txt (100 bytes)");
    expect(md).toContain("> hello world");
  });

  test("renders external as relative link", () => {
    const md = renderAttachment(att({}), "external", "chat-uuid", "../attachments");
    expect(md).toBe("📎 [note.txt](../attachments/chat-uuid/note.txt) (100 bytes)");
  });

  test("uses fallback name when file_name is empty (inline)", () => {
    const a = att({ file_name: "" });
    const md = renderAttachment(a, "inline", "chat-uuid", "../attachments");
    expect(md).toContain("📎 attachment.txt (100 bytes)");
  });

  test("escapes multiline content as quoted callout body", () => {
    const a = att({ extracted_content: "line1\nline2" });
    const md = renderAttachment(a, "inline", "chat-uuid", "../attachments");
    expect(md).toContain("> line1\n> line2");
  });
});
```

- [ ] **Step 2: Run tests — should fail**

Run: `bun test test/transform/attachment.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/transform/attachment.ts`**

```typescript
import type { ExportAttachment, ExportFile } from "../types.ts";

export type Placement = "inline" | "external";

export function decideAttachmentPlacement(a: ExportAttachment, thresholdBytes: number): Placement {
  return a.extracted_content.length >= thresholdBytes ? "external" : "inline";
}

function safeName(a: ExportAttachment): string {
  if (a.file_name && a.file_name.trim().length > 0) return a.file_name;
  return `attachment.${a.file_type || "txt"}`;
}

export function renderAttachment(
  a: ExportAttachment,
  placement: Placement,
  chatUuid: string,
  attachmentsRelDir: string,
): string {
  const name = safeName(a);
  if (placement === "external") {
    return `📎 [${name}](${attachmentsRelDir}/${chatUuid}/${name}) (${a.file_size} bytes)`;
  }
  const body = a.extracted_content
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
  return `> [!file]- 📎 ${name} (${a.file_size} bytes)\n${body}`;
}

export function renderMissingFile(f: ExportFile): string {
  const label = f.file_name?.trim() || f.file_uuid;
  return `📎 [missing] ${label}`;
}
```

- [ ] **Step 4: Run tests — should pass**

Run: `bun test test/transform/attachment.test.ts`
Expected: PASS — 8 passing.

- [ ] **Step 5: Commit**

```bash
git add src/transform/attachment.ts test/transform/attachment.test.ts
git commit -m "Add attachment placement decision and renderer"
```

---

## Task 6: message Transform (TDD)

**Files:**

- Create: `src/transform/message.ts`
- Create: `test/transform/message.test.ts`

- [ ] **Step 1: Write failing tests**

Create `test/transform/message.test.ts`:

````typescript
import { test, expect, describe } from "bun:test";
import { renderMessage } from "../../src/transform/message.ts";
import type { Config, ExportMessage } from "../../src/types.ts";

const baseConfig: Config = {
  inputDir: "/in",
  outputDir: "/out",
  mode: "standard",
  includeThinking: true,
  includeTools: true,
  attachmentThreshold: 4096,
  scope: "all",
  dryRun: false,
};

const human = (text: string): ExportMessage => ({
  uuid: "h1",
  text,
  sender: "human",
  created_at: "2026-01-29T12:06:57Z",
  updated_at: "2026-01-29T12:06:57Z",
  content: [{ type: "text", text }],
  attachments: [],
  files: [],
  parent_message_uuid: "00000000-0000-4000-8000-000000000000",
});

const assistant = (
  parts: {
    type: "text" | "thinking" | "tool_use" | "tool_result" | "token_budget";
    text?: string;
    name?: string;
    input?: unknown;
    budget?: number;
  }[],
): ExportMessage => ({
  uuid: "a1",
  text: parts.find((p) => p.type === "text")?.text ?? "",
  sender: "assistant",
  created_at: "2026-01-29T12:06:58Z",
  updated_at: "2026-01-29T12:06:58Z",
  content: parts as ExportMessage["content"],
  attachments: [],
  files: [],
  parent_message_uuid: "h1",
});

describe("renderMessage — human", () => {
  test("renders header and body", () => {
    const { markdown } = renderMessage(human("안녕하세요"), baseConfig, "chat-uuid");
    expect(markdown).toContain("## 👤 User · 2026-01-29 12:06");
    expect(markdown).toContain("안녕하세요");
  });
});

describe("renderMessage — assistant", () => {
  test("renders text content", () => {
    const { markdown } = renderMessage(
      assistant([{ type: "text", text: "안녕히 가세요" }]),
      baseConfig,
      "chat-uuid",
    );
    expect(markdown).toContain("## 🤖 Claude · 2026-01-29 12:06");
    expect(markdown).toContain("안녕히 가세요");
  });

  test("standard mode wraps thinking in collapsible callout", () => {
    const { markdown } = renderMessage(
      assistant([
        { type: "thinking", text: "사용자의 의도는..." },
        { type: "text", text: "응답입니다" },
      ]),
      baseConfig,
      "chat-uuid",
    );
    expect(markdown).toContain("> [!note]- 사고 과정");
    expect(markdown).toContain("> 사용자의 의도는...");
    expect(markdown).toContain("응답입니다");
  });

  test("minimal mode omits thinking", () => {
    const { markdown } = renderMessage(
      assistant([
        { type: "thinking", text: "내부 사고" },
        { type: "text", text: "출력" },
      ]),
      { ...baseConfig, mode: "minimal" },
      "chat-uuid",
    );
    expect(markdown).not.toContain("사고 과정");
    expect(markdown).not.toContain("내부 사고");
    expect(markdown).toContain("출력");
  });

  test("standard mode renders tool_use as one-line summary", () => {
    const { markdown } = renderMessage(
      assistant([
        { type: "tool_use", name: "Read", input: { file_path: "/src/foo.ts" } },
        { type: "text", text: "ok" },
      ]),
      baseConfig,
      "chat-uuid",
    );
    expect(markdown).toContain('🔧 `Read({"file_path":"/src/foo.ts"})`');
  });

  test("full mode renders tool_use as code block", () => {
    const { markdown } = renderMessage(
      assistant([{ type: "tool_use", name: "Read", input: { file_path: "/src/foo.ts" } }]),
      { ...baseConfig, mode: "full" },
      "chat-uuid",
    );
    expect(markdown).toContain("```json");
    expect(markdown).toContain('"file_path": "/src/foo.ts"');
  });

  test("--no-thinking flag overrides mode", () => {
    const { markdown } = renderMessage(
      assistant([
        { type: "thinking", text: "사고" },
        { type: "text", text: "out" },
      ]),
      { ...baseConfig, includeThinking: false },
      "chat-uuid",
    );
    expect(markdown).not.toContain("사고");
  });

  test("--no-tools flag overrides mode", () => {
    const { markdown } = renderMessage(
      assistant([
        { type: "tool_use", name: "Read", input: {} },
        { type: "text", text: "out" },
      ]),
      { ...baseConfig, includeTools: false },
      "chat-uuid",
    );
    expect(markdown).not.toContain("🔧");
    expect(markdown).not.toContain("Read");
  });

  test("token_budget shown only in full mode", () => {
    const standard = renderMessage(
      assistant([
        { type: "token_budget", budget: 1000 },
        { type: "text", text: "x" },
      ]),
      baseConfig,
      "chat-uuid",
    ).markdown;
    expect(standard).not.toContain("token");

    const full = renderMessage(
      assistant([
        { type: "token_budget", budget: 1000 },
        { type: "text", text: "x" },
      ]),
      { ...baseConfig, mode: "full" },
      "chat-uuid",
    ).markdown;
    expect(full).toContain("token_budget: 1000");
  });
});

describe("renderMessage — attachments", () => {
  test("inline attachment under threshold", () => {
    const msg: ExportMessage = {
      ...human("see file"),
      attachments: [
        {
          file_name: "note.txt",
          file_size: 11,
          file_type: "txt",
          extracted_content: "hello world",
        },
      ],
    };
    const { markdown, externalAttachments } = renderMessage(msg, baseConfig, "chat-uuid");
    expect(markdown).toContain("> [!file]- 📎 note.txt");
    expect(externalAttachments).toEqual([]);
  });

  test("external attachment above threshold returns externalAttachments entry", () => {
    const big = "x".repeat(5000);
    const msg: ExportMessage = {
      ...human("see file"),
      attachments: [
        { file_name: "big.txt", file_size: 5000, file_type: "txt", extracted_content: big },
      ],
    };
    const { markdown, externalAttachments } = renderMessage(msg, baseConfig, "chat-uuid");
    expect(markdown).toContain("📎 [big.txt](../attachments/chat-uuid/big.txt)");
    expect(externalAttachments).toHaveLength(1);
    expect(externalAttachments[0]).toEqual({
      chatUuid: "chat-uuid",
      fileName: "big.txt",
      content: big,
    });
  });

  test("missing file (no extracted_content) renders placeholder", () => {
    const msg: ExportMessage = {
      ...human("see file"),
      files: [{ file_uuid: "uuid-1", file_name: "image.png" }],
    };
    const { markdown } = renderMessage(msg, baseConfig, "chat-uuid");
    expect(markdown).toContain("📎 [missing] image.png");
  });
});
````

- [ ] **Step 2: Run tests — should fail**

Run: `bun test test/transform/message.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/transform/message.ts`**

````typescript
import type {
  Config,
  ExportContent,
  ExportMessage,
  ExportAttachment,
  ContentMode,
} from "../types.ts";
import { decideAttachmentPlacement, renderAttachment, renderMissingFile } from "./attachment.ts";

export interface ExternalAttachment {
  chatUuid: string;
  fileName: string;
  content: string;
}

export interface RenderedMessage {
  markdown: string;
  externalAttachments: ExternalAttachment[];
}

const HEADERS: Record<"human" | "assistant", string> = {
  human: "## 👤 User",
  assistant: "## 🤖 Claude",
};

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function shouldShowThinking(cfg: Config): boolean {
  if (!cfg.includeThinking) return false;
  return cfg.mode !== "minimal";
}

function shouldShowTools(cfg: Config): boolean {
  if (!cfg.includeTools) return false;
  return cfg.mode !== "minimal";
}

function shouldShowTokenBudget(cfg: Config): boolean {
  return cfg.mode === "full";
}

function renderThinking(text: string): string {
  const body = text
    .split("\n")
    .map((l) => `> ${l}`)
    .join("\n");
  return `> [!note]- 사고 과정\n${body}`;
}

function renderToolUse(content: ExportContent, mode: ContentMode): string {
  const name = content.name ?? "tool";
  if (mode === "full") {
    const json = JSON.stringify(content.input ?? {}, null, 2);
    return ["```json", `// tool_use: ${name}`, json, "```"].join("\n");
  }
  const compact = JSON.stringify(content.input ?? {});
  return `🔧 \`${name}(${compact})\``;
}

function renderToolResult(content: ExportContent, mode: ContentMode): string {
  if (mode === "full") {
    const json = JSON.stringify(content.content ?? null, null, 2);
    return ["```json", "// tool_result", json, "```"].join("\n");
  }
  const summary =
    typeof content.content === "string"
      ? content.content.slice(0, 80)
      : JSON.stringify(content.content ?? null).slice(0, 80);
  return `↩️ \`${summary}\``;
}

function renderTokenBudget(content: ExportContent): string {
  return `<!-- token_budget: ${content.budget ?? 0} -->`;
}

export function renderMessage(msg: ExportMessage, cfg: Config, chatUuid: string): RenderedMessage {
  const blocks: string[] = [];
  blocks.push(`${HEADERS[msg.sender]} · ${formatTimestamp(msg.created_at)}`);

  for (const c of msg.content) {
    if (c.type === "text") {
      if (c.text && c.text.trim().length > 0) blocks.push(c.text);
    } else if (c.type === "thinking") {
      if (shouldShowThinking(cfg) && c.text) blocks.push(renderThinking(c.text));
    } else if (c.type === "tool_use") {
      if (shouldShowTools(cfg)) blocks.push(renderToolUse(c, cfg.mode));
    } else if (c.type === "tool_result") {
      if (shouldShowTools(cfg)) blocks.push(renderToolResult(c, cfg.mode));
    } else if (c.type === "token_budget") {
      if (shouldShowTokenBudget(cfg)) blocks.push(renderTokenBudget(c));
    }
  }

  // Fallback: if msg.content was empty but msg.text has value
  if (msg.content.length === 0 && msg.text && msg.text.trim().length > 0) {
    blocks.push(msg.text);
  }

  const externalAttachments: ExternalAttachment[] = [];
  for (const a of msg.attachments) {
    const placement = decideAttachmentPlacement(a, cfg.attachmentThreshold);
    blocks.push(renderAttachment(a, placement, chatUuid, "../attachments"));
    if (placement === "external") {
      externalAttachments.push({
        chatUuid,
        fileName: a.file_name?.trim() || `attachment.${a.file_type || "txt"}`,
        content: a.extracted_content,
      });
    }
  }
  for (const f of msg.files) {
    blocks.push(renderMissingFile(f));
  }

  return { markdown: blocks.join("\n\n"), externalAttachments };
}
````

- [ ] **Step 4: Run tests — should pass**

Run: `bun test test/transform/message.test.ts`
Expected: PASS — 12 passing (across describes).

- [ ] **Step 5: Commit**

```bash
git add src/transform/message.ts test/transform/message.test.ts
git commit -m "Add message renderer with mode-aware content handling"
```

---

## Task 7: config (parseArgs) (TDD)

**Files:**

- Create: `src/config.ts`
- Create: `test/config.test.ts`

- [ ] **Step 1: Write failing tests**

Create `test/config.test.ts`:

```typescript
import { test, expect, describe } from "bun:test";
import { parseConfig } from "../src/config.ts";

describe("parseConfig", () => {
  test("two positional args set inputDir and outputDir", () => {
    const cfg = parseConfig(["./export", "./out"]);
    expect(cfg.inputDir.endsWith("export")).toBe(true);
    expect(cfg.outputDir.endsWith("out")).toBe(true);
  });

  test("one positional arg defaults outputDir to <input>/output", () => {
    const cfg = parseConfig(["./export"]);
    expect(cfg.outputDir).toBe(`${cfg.inputDir}/output`);
  });

  test("default mode is standard", () => {
    const cfg = parseConfig(["./export"]);
    expect(cfg.mode).toBe("standard");
  });

  test("--mode full sets mode", () => {
    const cfg = parseConfig(["./export", "--mode", "full"]);
    expect(cfg.mode).toBe("full");
  });

  test("invalid mode throws", () => {
    expect(() => parseConfig(["./export", "--mode", "weird"])).toThrow(/mode must be/);
  });

  test("--no-thinking flips includeThinking", () => {
    const cfg = parseConfig(["./export", "--no-thinking"]);
    expect(cfg.includeThinking).toBe(false);
  });

  test("--no-tools flips includeTools", () => {
    const cfg = parseConfig(["./export", "--no-tools"]);
    expect(cfg.includeTools).toBe(false);
  });

  test("--attachment-threshold parses int", () => {
    const cfg = parseConfig(["./export", "--attachment-threshold", "8192"]);
    expect(cfg.attachmentThreshold).toBe(8192);
  });

  test("negative attachment-threshold throws", () => {
    expect(() => parseConfig(["./export", "--attachment-threshold", "-1"])).toThrow(/threshold/);
  });

  test("--scope chats", () => {
    const cfg = parseConfig(["./export", "--scope", "chats"]);
    expect(cfg.scope).toBe("chats");
  });

  test("--dry-run flag", () => {
    const cfg = parseConfig(["./export", "--dry-run"]);
    expect(cfg.dryRun).toBe(true);
  });

  test("zero positional args throws with usage hint", () => {
    expect(() => parseConfig([])).toThrow(/usage|input/i);
  });
});
```

- [ ] **Step 2: Run tests — should fail**

Run: `bun test test/config.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/config.ts`**

```typescript
import { parseArgs } from "node:util";
import { resolve } from "node:path";
import type { Config, ContentMode, Scope } from "./types.ts";

const VALID_MODES: ContentMode[] = ["minimal", "standard", "full"];
const VALID_SCOPES: Scope[] = ["all", "chats", "projects"];

export function parseConfig(argv: string[]): Config {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: true,
    options: {
      mode: { type: "string", default: "standard" },
      "no-thinking": { type: "boolean", default: false },
      "no-tools": { type: "boolean", default: false },
      "attachment-threshold": { type: "string", default: "4096" },
      scope: { type: "string", default: "all" },
      "dry-run": { type: "boolean", default: false },
      help: { type: "boolean", default: false, short: "h" },
      version: { type: "boolean", default: false, short: "v" },
    },
  });

  if (positionals.length === 0) {
    throw new Error("usage: claude-chat-archive <input-dir> [output-dir] [options]");
  }

  const mode = values.mode as ContentMode;
  if (!VALID_MODES.includes(mode)) {
    throw new Error(`mode must be one of: ${VALID_MODES.join(", ")}`);
  }

  const scope = values.scope as Scope;
  if (!VALID_SCOPES.includes(scope)) {
    throw new Error(`scope must be one of: ${VALID_SCOPES.join(", ")}`);
  }

  const threshold = Number.parseInt(values["attachment-threshold"] as string, 10);
  if (!Number.isFinite(threshold) || threshold < 0) {
    throw new Error("attachment-threshold must be a non-negative integer");
  }

  const inputDir = resolve(positionals[0]!);
  const outputDir = positionals[1] ? resolve(positionals[1]) : `${inputDir}/output`;

  return {
    inputDir,
    outputDir,
    mode,
    includeThinking: !values["no-thinking"],
    includeTools: !values["no-tools"],
    attachmentThreshold: threshold,
    scope,
    dryRun: Boolean(values["dry-run"]),
  };
}

export const HELP_TEXT = `claude-chat-archive — convert Claude.ai export to markdown

Usage:
  claude-chat-archive <input-dir> [output-dir] [options]

Arguments:
  input-dir              Folder containing conversations.json and projects/
  output-dir             Output folder (default: <input-dir>/output)

Options:
  --mode <m>             Content detail: minimal | standard | full (default: standard)
  --no-thinking          Omit assistant thinking content
  --no-tools             Omit tool_use / tool_result content
  --attachment-threshold <bytes>
                         Inline attachments smaller than this (default: 4096)
  --scope <s>            What to convert: all | chats | projects (default: all)
  --dry-run              Print stats without writing
  -h, --help             Show this help
  -v, --version          Show version
`;
```

- [ ] **Step 4: Run tests — should pass**

Run: `bun test test/config.test.ts`
Expected: PASS — 12 passing.

- [ ] **Step 5: Commit**

```bash
git add src/config.ts test/config.test.ts
git commit -m "Add CLI argument parser with validation"
```

---

## Task 8: reader/conversations (TDD)

**Files:**

- Create: `src/reader/conversations.ts`
- Create: `test/reader/conversations.test.ts`
- Create: `test/fixtures/export-min/conversations.json`

- [ ] **Step 1: Create fixture file `test/fixtures/export-min/conversations.json`**

```json
[
  {
    "uuid": "conv-1",
    "name": "First chat",
    "summary": "test",
    "created_at": "2026-01-01T00:00:00Z",
    "updated_at": "2026-01-01T00:00:00Z",
    "account": { "uuid": "acc-1" },
    "chat_messages": [
      {
        "uuid": "msg-1",
        "text": "hello",
        "sender": "human",
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z",
        "content": [{ "type": "text", "text": "hello" }],
        "attachments": [],
        "files": [],
        "parent_message_uuid": "00000000-0000-4000-8000-000000000000"
      }
    ]
  }
]
```

- [ ] **Step 2: Write failing test `test/reader/conversations.test.ts`**

```typescript
import { test, expect, describe } from "bun:test";
import { loadConversations } from "../../src/reader/conversations.ts";

describe("loadConversations", () => {
  test("loads valid conversations.json", async () => {
    const convs = await loadConversations("test/fixtures/export-min/conversations.json");
    expect(convs).toHaveLength(1);
    expect(convs[0]!.uuid).toBe("conv-1");
    expect(convs[0]!.chat_messages).toHaveLength(1);
  });

  test("throws clear error when file missing", async () => {
    await expect(loadConversations("test/fixtures/does-not-exist.json")).rejects.toThrow(
      /conversations\.json/,
    );
  });

  test("throws clear error on invalid JSON", async () => {
    await expect(
      loadConversations("test/fixtures/export-min/conversations.json.invalid"),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Run test — should fail**

Run: `bun test test/reader/conversations.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `src/reader/conversations.ts`**

```typescript
import { readFile } from "node:fs/promises";
import type { ExportConversation } from "../types.ts";

export async function loadConversations(path: string): Promise<ExportConversation[]> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (err) {
    throw new Error(`Failed to read conversations.json at ${path}: ${(err as Error).message}`);
  }
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`conversations.json at ${path} is not an array`);
  }
  return parsed as ExportConversation[];
}
```

- [ ] **Step 5: Run test — should pass (first 2 tests)**

Run: `bun test test/reader/conversations.test.ts`
Expected: 2 passing, 1 failing (invalid JSON file does not exist).

- [ ] **Step 6: Create the invalid fixture and rerun**

```bash
echo "not json {{{" > test/fixtures/export-min/conversations.json.invalid
```

Run: `bun test test/reader/conversations.test.ts`
Expected: 3 passing.

- [ ] **Step 7: Commit**

```bash
git add src/reader/conversations.ts test/reader/conversations.test.ts test/fixtures/
git commit -m "Add conversations.json reader with error wrapping"
```

---

## Task 9: reader/projects (TDD)

**Files:**

- Create: `src/reader/projects.ts`
- Create: `test/reader/projects.test.ts`
- Create: `test/fixtures/export-min/projects/proj-1.json`

- [ ] **Step 1: Create fixture `test/fixtures/export-min/projects/proj-1.json`**

```json
{
  "uuid": "proj-1",
  "name": "Test Project",
  "description": "A demo project",
  "is_private": false,
  "is_starter_project": false,
  "prompt_template": "",
  "created_at": "2026-01-01T00:00:00Z",
  "updated_at": "2026-01-02T00:00:00Z",
  "creator": { "uuid": "u1", "full_name": "soomtong" },
  "docs": [{ "uuid": "d1", "filename": "guide.md", "content": "# guide" }]
}
```

- [ ] **Step 2: Write failing test `test/reader/projects.test.ts`**

```typescript
import { test, expect, describe } from "bun:test";
import { loadProjects } from "../../src/reader/projects.ts";

describe("loadProjects", () => {
  test("loads all *.json files in projects dir", async () => {
    const projects = await loadProjects("test/fixtures/export-min/projects");
    expect(projects).toHaveLength(1);
    expect(projects[0]!.uuid).toBe("proj-1");
    expect(projects[0]!.docs).toHaveLength(1);
  });

  test("returns empty array when projects dir missing", async () => {
    const projects = await loadProjects("test/fixtures/no-such-dir");
    expect(projects).toEqual([]);
  });

  test("skips non-json files", async () => {
    const projects = await loadProjects("test/fixtures/export-min/projects");
    expect(projects.every((p) => typeof p.uuid === "string")).toBe(true);
  });
});
```

- [ ] **Step 3: Run test — should fail**

Run: `bun test test/reader/projects.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `src/reader/projects.ts`**

```typescript
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ExportProject } from "../types.ts";

export async function loadProjects(dir: string): Promise<ExportProject[]> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }

  const projects: ExportProject[] = [];
  for (const name of entries) {
    if (!name.endsWith(".json")) continue;
    const raw = await readFile(join(dir, name), "utf8");
    projects.push(JSON.parse(raw) as ExportProject);
  }
  return projects;
}
```

- [ ] **Step 5: Run test — should pass**

Run: `bun test test/reader/projects.test.ts`
Expected: 3 passing.

- [ ] **Step 6: Commit**

```bash
git add src/reader/projects.ts test/reader/projects.test.ts test/fixtures/
git commit -m "Add projects directory reader returning empty on missing dir"
```

---

## Task 10: writer/attachment (TDD)

**Files:**

- Create: `src/writer/attachment.ts`
- Create: `test/writer/attachment.test.ts`

- [ ] **Step 1: Write failing test `test/writer/attachment.test.ts`**

```typescript
import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeExternalAttachment } from "../../src/writer/attachment.ts";

let baseDir: string;

beforeEach(async () => {
  baseDir = await mkdtemp(join(tmpdir(), "cca-att-"));
});
afterEach(async () => {
  await rm(baseDir, { recursive: true, force: true });
});

describe("writeExternalAttachment", () => {
  test("creates <attachments>/<chat-uuid>/<filename>", async () => {
    await writeExternalAttachment(baseDir, "chat-uuid", "note.txt", "hello");
    const path = join(baseDir, "chat-uuid", "note.txt");
    expect(await readFile(path, "utf8")).toBe("hello");
  });

  test("creates parent directories if missing", async () => {
    await writeExternalAttachment(baseDir, "deep/uuid", "x.txt", "data");
    const path = join(baseDir, "deep/uuid", "x.txt");
    expect(await readFile(path, "utf8")).toBe("data");
  });

  test("sanitizes filename to remove path traversal", async () => {
    await writeExternalAttachment(baseDir, "uuid", "../escape.txt", "x");
    const path = join(baseDir, "uuid", "_._escape.txt");
    expect(await readFile(path, "utf8")).toBe("x");
  });
});
```

- [ ] **Step 2: Run test — should fail**

Run: `bun test test/writer/attachment.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/writer/attachment.ts`**

```typescript
import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { sanitizeFilename } from "../transform/filename.ts";

function safe(name: string): string {
  return sanitizeFilename(name).replace(/\.\./g, "_._");
}

export async function writeExternalAttachment(
  attachmentsDir: string,
  chatUuid: string,
  fileName: string,
  content: string,
): Promise<void> {
  const safeUuid = chatUuid.replace(/\.\./g, "_._");
  const target = join(attachmentsDir, safeUuid, safe(fileName));
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content, "utf8");
}
```

- [ ] **Step 4: Run test — should pass**

Run: `bun test test/writer/attachment.test.ts`
Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add src/writer/attachment.ts test/writer/attachment.test.ts
git commit -m "Add external attachment writer with path traversal guard"
```

---

## Task 11: writer/chat (TDD)

**Files:**

- Create: `src/writer/chat.ts`
- Create: `test/writer/chat.test.ts`

- [ ] **Step 1: Write failing test `test/writer/chat.test.ts`**

```typescript
import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeChat } from "../../src/writer/chat.ts";
import type { Config, ExportConversation } from "../../src/types.ts";

let outDir: string;
const cfg: Omit<Config, "inputDir" | "outputDir"> = {
  mode: "standard",
  includeThinking: true,
  includeTools: true,
  attachmentThreshold: 4096,
  scope: "all",
  dryRun: false,
};

beforeEach(async () => {
  outDir = await mkdtemp(join(tmpdir(), "cca-chat-"));
});
afterEach(async () => {
  await rm(outDir, { recursive: true, force: true });
});

const conv: ExportConversation = {
  uuid: "c1-uuid-aaaa-bbbb",
  name: "Test chat",
  summary: "summary text",
  created_at: "2026-02-01T00:00:00Z",
  updated_at: "2026-02-01T00:01:00Z",
  account: { uuid: "x" },
  chat_messages: [
    {
      uuid: "m1",
      text: "hi",
      sender: "human",
      created_at: "2026-02-01T00:00:00Z",
      updated_at: "2026-02-01T00:00:00Z",
      content: [{ type: "text", text: "hi" }],
      attachments: [],
      files: [],
      parent_message_uuid: "00000000-0000-4000-8000-000000000000",
    },
    {
      uuid: "m2",
      text: "hello",
      sender: "assistant",
      created_at: "2026-02-01T00:01:00Z",
      updated_at: "2026-02-01T00:01:00Z",
      content: [{ type: "text", text: "hello" }],
      attachments: [],
      files: [],
      parent_message_uuid: "m1",
    },
  ],
};

describe("writeChat", () => {
  test("writes chat md with frontmatter and both messages", async () => {
    const used = new Set<string>();
    await writeChat(conv, { ...cfg, inputDir: "/in", outputDir: outDir }, used);
    const files = await readdir(join(outDir, "chats"));
    expect(files).toContain("2026-02-01 Test chat.md");
    const md = await readFile(join(outDir, "chats", "2026-02-01 Test chat.md"), "utf8");
    expect(md).toContain("uuid: c1-uuid-aaaa-bbbb");
    expect(md).toContain("title: Test chat");
    expect(md).toContain("# Test chat");
    expect(md).toContain("👤 User");
    expect(md).toContain("🤖 Claude");
  });

  test("dry-run writes nothing", async () => {
    const used = new Set<string>();
    await writeChat(conv, { ...cfg, inputDir: "/in", outputDir: outDir, dryRun: true }, used);
    await expect(readdir(join(outDir, "chats"))).rejects.toThrow();
  });

  test("returns stats counts", async () => {
    const used = new Set<string>();
    const stats = await writeChat(conv, { ...cfg, inputDir: "/in", outputDir: outDir }, used);
    expect(stats.inline).toBe(0);
    expect(stats.external).toBe(0);
    expect(stats.missing).toBe(0);
  });
});
```

- [ ] **Step 2: Run test — should fail**

Run: `bun test test/writer/chat.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/writer/chat.ts`**

```typescript
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Config, ExportConversation } from "../types.ts";
import { conversationFilename } from "../transform/filename.ts";
import { toYamlFrontmatter } from "../transform/frontmatter.ts";
import { renderMessage, type ExternalAttachment } from "../transform/message.ts";
import { writeExternalAttachment } from "./attachment.ts";

export interface ChatWriteStats {
  inline: number;
  external: number;
  missing: number;
}

export async function writeChat(
  conv: ExportConversation,
  cfg: Config,
  usedFilenames: Set<string>,
): Promise<ChatWriteStats> {
  const filename = conversationFilename(conv, usedFilenames);
  const chatsDir = join(cfg.outputDir, "chats");
  const attachmentsDir = join(cfg.outputDir, "attachments");

  const externalAttachments: ExternalAttachment[] = [];
  let inline = 0;
  let missing = 0;

  const blocks: string[] = [];
  for (const msg of conv.chat_messages) {
    const r = renderMessage(msg, cfg, conv.uuid);
    blocks.push(r.markdown);
    externalAttachments.push(...r.externalAttachments);
    inline += msg.attachments.length - r.externalAttachments.length;
    missing += msg.files.length;
  }

  const titleFromFilename = filename.replace(/^\d{4}-\d{2}-\d{2} /, "").replace(/\.md$/, "");
  const title = conv.name?.trim() || titleFromFilename;

  const fm = toYamlFrontmatter({
    uuid: conv.uuid,
    title,
    created: conv.created_at,
    updated: conv.updated_at,
    message_count: conv.chat_messages.length,
    attachment_count: conv.chat_messages.reduce((n, m) => n + m.attachments.length, 0),
    tags: ["claude-chat"],
    summary: conv.summary,
  });

  const heading = `# ${title}`;
  const document = `${fm}\n${heading}\n\n${blocks.join("\n\n")}\n`;

  const stats: ChatWriteStats = { inline, external: externalAttachments.length, missing };

  if (cfg.dryRun) return stats;

  await mkdir(chatsDir, { recursive: true });
  await writeFile(join(chatsDir, filename), document, "utf8");
  for (const att of externalAttachments) {
    await writeExternalAttachment(attachmentsDir, att.chatUuid, att.fileName, att.content);
  }
  return stats;
}
```

- [ ] **Step 4: Run test — should pass**

Run: `bun test test/writer/chat.test.ts`
Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add src/writer/chat.ts test/writer/chat.test.ts
git commit -m "Add chat writer producing markdown with frontmatter"
```

---

## Task 12: writer/project (TDD)

**Files:**

- Create: `src/writer/project.ts`
- Create: `test/writer/project.test.ts`

- [ ] **Step 1: Write failing test `test/writer/project.test.ts`**

```typescript
import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, readFile, readdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeProject } from "../../src/writer/project.ts";
import type { Config, ExportProject } from "../../src/types.ts";

let outDir: string;
const cfg: Omit<Config, "inputDir" | "outputDir"> = {
  mode: "standard",
  includeThinking: true,
  includeTools: true,
  attachmentThreshold: 4096,
  scope: "all",
  dryRun: false,
};

beforeEach(async () => {
  outDir = await mkdtemp(join(tmpdir(), "cca-proj-"));
});
afterEach(async () => {
  await rm(outDir, { recursive: true, force: true });
});

const projectNoDocs: ExportProject = {
  uuid: "p1",
  name: "프로그래밍 강의",
  description: "Course curriculum",
  is_private: true,
  is_starter_project: false,
  prompt_template: "",
  created_at: "2025-12-01T00:00:00Z",
  updated_at: "2025-12-01T00:00:00Z",
  creator: { uuid: "u", full_name: "soomtong" },
  docs: [],
};

const projectWithDocs: ExportProject = {
  ...projectNoDocs,
  uuid: "p2",
  name: "How to use Claude",
  docs: [{ uuid: "d1", filename: "guide.md", content: "# Guide content" }],
};

describe("writeProject", () => {
  test("project without docs writes single .md file", async () => {
    await writeProject(projectNoDocs, { ...cfg, inputDir: "/in", outputDir: outDir });
    const files = await readdir(join(outDir, "projects"));
    expect(files).toContain("프로그래밍 강의.md");
    const md = await readFile(join(outDir, "projects", "프로그래밍 강의.md"), "utf8");
    expect(md).toContain("type: project");
    expect(md).toContain("Course curriculum");
  });

  test("project with docs writes folder + README + docs/", async () => {
    await writeProject(projectWithDocs, { ...cfg, inputDir: "/in", outputDir: outDir });
    const folder = join(outDir, "projects", "How to use Claude");
    expect((await stat(folder)).isDirectory()).toBe(true);
    const readme = await readFile(join(folder, "README.md"), "utf8");
    expect(readme).toContain("type: project");
    const doc = await readFile(join(folder, "docs", "guide.md"), "utf8");
    expect(doc).toBe("# Guide content");
  });

  test("dry-run writes nothing", async () => {
    await writeProject(projectWithDocs, {
      ...cfg,
      inputDir: "/in",
      outputDir: outDir,
      dryRun: true,
    });
    await expect(readdir(join(outDir, "projects"))).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test — should fail**

Run: `bun test test/writer/project.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/writer/project.ts`**

```typescript
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Config, ExportProject } from "../types.ts";
import { sanitizeFilename } from "../transform/filename.ts";
import { toYamlFrontmatter } from "../transform/frontmatter.ts";

function projectFrontmatter(p: ExportProject): string {
  return toYamlFrontmatter({
    uuid: p.uuid,
    type: "project",
    name: p.name,
    created: p.created_at,
    updated: p.updated_at,
    is_private: p.is_private,
    is_starter_project: p.is_starter_project,
    creator: p.creator?.full_name,
    docs_count: p.docs.length,
  });
}

function projectBody(p: ExportProject): string {
  const parts: string[] = [`# ${p.name}`];
  if (p.description?.trim()) {
    parts.push(`## Description\n\n${p.description}`);
  }
  if (p.prompt_template?.trim()) {
    parts.push(`## Prompt Template\n\n${p.prompt_template}`);
  } else {
    parts.push(`## Prompt Template\n\n(empty)`);
  }
  return parts.join("\n\n");
}

export async function writeProject(p: ExportProject, cfg: Config): Promise<void> {
  if (cfg.dryRun) return;

  const projectsDir = join(cfg.outputDir, "projects");
  const safeName = sanitizeFilename(p.name);
  const fm = projectFrontmatter(p);
  const body = projectBody(p);
  const document = `${fm}\n${body}\n`;

  if (p.docs.length === 0) {
    await mkdir(projectsDir, { recursive: true });
    await writeFile(join(projectsDir, `${safeName}.md`), document, "utf8");
    return;
  }

  const folder = join(projectsDir, safeName);
  const docsDir = join(folder, "docs");
  await mkdir(docsDir, { recursive: true });
  await writeFile(join(folder, "README.md"), document, "utf8");
  for (const d of p.docs) {
    const safeFilename = sanitizeFilename(d.filename || `${d.uuid}.md`);
    await writeFile(join(docsDir, safeFilename), d.content, "utf8");
  }
}
```

- [ ] **Step 4: Run test — should pass**

Run: `bun test test/writer/project.test.ts`
Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add src/writer/project.ts test/writer/project.test.ts
git commit -m "Add project writer with docs-aware output structure"
```

---

## Task 13: CLI Orchestrator + Programmatic API (TDD)

**Files:**

- Create: `src/cli.ts`
- Create: `src/index.ts`
- Create: `test/cli.test.ts`

- [ ] **Step 1: Write failing integration test `test/cli.test.ts`**

```typescript
import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, readdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { archive } from "../src/index.ts";

let outDir: string;
beforeEach(async () => {
  outDir = await mkdtemp(join(tmpdir(), "cca-int-"));
});
afterEach(async () => {
  await rm(outDir, { recursive: true, force: true });
});

describe("archive (full pipeline)", () => {
  test("converts fixture export end-to-end", async () => {
    const stats = await archive({
      inputDir: "test/fixtures/export-min",
      outputDir: outDir,
      mode: "standard",
      includeThinking: true,
      includeTools: true,
      attachmentThreshold: 4096,
      scope: "all",
      dryRun: false,
    });
    expect(stats.chatsWritten).toBe(1);
    expect(stats.projectsWritten).toBe(1);
    const chats = await readdir(join(outDir, "chats"));
    expect(chats).toHaveLength(1);
    const projects = await readdir(join(outDir, "projects"));
    expect(projects.length).toBeGreaterThan(0);
  });

  test("scope=chats skips projects", async () => {
    const stats = await archive({
      inputDir: "test/fixtures/export-min",
      outputDir: outDir,
      mode: "minimal",
      includeThinking: true,
      includeTools: true,
      attachmentThreshold: 4096,
      scope: "chats",
      dryRun: false,
    });
    expect(stats.projectsWritten).toBe(0);
    await expect(readdir(join(outDir, "projects"))).rejects.toThrow();
  });

  test("dry-run reports stats but writes nothing", async () => {
    const stats = await archive({
      inputDir: "test/fixtures/export-min",
      outputDir: outDir,
      mode: "standard",
      includeThinking: true,
      includeTools: true,
      attachmentThreshold: 4096,
      scope: "all",
      dryRun: true,
    });
    expect(stats.chatsWritten).toBe(1);
    await expect(readdir(join(outDir, "chats"))).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test — should fail**

Run: `bun test test/cli.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/index.ts` (programmatic API)**

```typescript
import { join } from "node:path";
import type { Config, RunStats } from "./types.ts";
import { loadConversations } from "./reader/conversations.ts";
import { loadProjects } from "./reader/projects.ts";
import { writeChat } from "./writer/chat.ts";
import { writeProject } from "./writer/project.ts";

export type { Config, RunStats } from "./types.ts";

export async function archive(cfg: Config): Promise<RunStats> {
  const stats: RunStats = {
    chatsTotal: 0,
    chatsWritten: 0,
    chatsSkipped: 0,
    projectsTotal: 0,
    projectsWritten: 0,
    attachmentsInline: 0,
    attachmentsExternal: 0,
    attachmentsMissing: 0,
  };

  const used = new Set<string>();

  if (cfg.scope !== "projects") {
    const convs = await loadConversations(join(cfg.inputDir, "conversations.json"));
    stats.chatsTotal = convs.length;
    for (const c of convs) {
      try {
        const r = await writeChat(c, cfg, used);
        stats.chatsWritten += 1;
        stats.attachmentsInline += r.inline;
        stats.attachmentsExternal += r.external;
        stats.attachmentsMissing += r.missing;
      } catch (err) {
        stats.chatsSkipped += 1;
        process.stderr.write(`[skip] chat ${c.uuid}: ${(err as Error).message}\n`);
      }
    }
  }

  if (cfg.scope !== "chats") {
    const projects = await loadProjects(join(cfg.inputDir, "projects"));
    stats.projectsTotal = projects.length;
    for (const p of projects) {
      try {
        await writeProject(p, cfg);
        stats.projectsWritten += 1;
      } catch (err) {
        process.stderr.write(`[skip] project ${p.uuid}: ${(err as Error).message}\n`);
      }
    }
  }

  return stats;
}
```

- [ ] **Step 4: Run integration test — should pass**

Run: `bun test test/cli.test.ts`
Expected: 3 passing.

- [ ] **Step 5: Implement `src/cli.ts`**

```typescript
#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseConfig, HELP_TEXT } from "./config.ts";
import { archive } from "./index.ts";

async function readVersion(): Promise<string> {
  const here = dirname(fileURLToPath(import.meta.url));
  try {
    const pkg = JSON.parse(await readFile(join(here, "..", "package.json"), "utf8"));
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

async function main(argv: string[]): Promise<number> {
  if (argv.includes("-h") || argv.includes("--help")) {
    process.stdout.write(HELP_TEXT);
    return 0;
  }
  if (argv.includes("-v") || argv.includes("--version")) {
    process.stdout.write(`${await readVersion()}\n`);
    return 0;
  }

  let cfg;
  try {
    cfg = parseConfig(argv);
  } catch (err) {
    process.stderr.write(`error: ${(err as Error).message}\n`);
    process.stderr.write(HELP_TEXT);
    return 2;
  }

  process.stdout.write(`Reading export from: ${cfg.inputDir}\n`);
  process.stdout.write(`Writing archive to:  ${cfg.outputDir}\n`);
  if (cfg.dryRun) process.stdout.write("(dry-run mode — no files will be written)\n");

  try {
    const stats = await archive(cfg);
    process.stdout.write(
      `\nDone. chats: ${stats.chatsWritten}/${stats.chatsTotal} ` +
        `(${stats.chatsSkipped} skipped), ` +
        `projects: ${stats.projectsWritten}/${stats.projectsTotal}, ` +
        `attachments: ${stats.attachmentsInline} inline, ` +
        `${stats.attachmentsExternal} external, ` +
        `${stats.attachmentsMissing} missing\n`,
    );
    return 0;
  } catch (err) {
    process.stderr.write(`error: ${(err as Error).message}\n`);
    return 1;
  }
}

main(process.argv.slice(2)).then((code) => process.exit(code));
```

- [ ] **Step 6: Smoke-test CLI directly**

Run: `bun src/cli.ts test/fixtures/export-min /tmp/cca-smoke && ls /tmp/cca-smoke/chats /tmp/cca-smoke/projects`
Expected: stats line printed, files present in output.

Run: `bun src/cli.ts --help`
Expected: HELP_TEXT printed.

- [ ] **Step 7: Commit**

```bash
git add src/cli.ts src/index.ts test/cli.test.ts
git commit -m "Wire CLI orchestrator and programmatic archive API"
```

---

## Task 14: Build & Bin Verification

**Files:**

- Modify: nothing (verify build pipeline)

- [ ] **Step 1: Build to dist/**

Run: `bun run build`
Expected: `dist/cli.js`, `dist/index.js`, `dist/index.d.ts`, `dist/types.d.ts` all created.

- [ ] **Step 2: Verify shebang preserved on cli.js**

Run: `head -1 dist/cli.js`
Expected: `#!/usr/bin/env node`

If missing, modify `src/cli.ts` shebang line and rerun build. Bun preserves shebangs by default; if it strips, prepend manually in package.json's build script:

```json
"build": "bun build --target=node --outdir=dist src/cli.ts src/index.ts && echo '#!/usr/bin/env node' | cat - dist/cli.js > dist/cli.js.tmp && mv dist/cli.js.tmp dist/cli.js && chmod +x dist/cli.js && bun run build:types"
```

- [ ] **Step 3: Make cli.js executable and smoke test**

Run: `chmod +x dist/cli.js && node dist/cli.js test/fixtures/export-min /tmp/cca-built`
Expected: same successful output as Task 13 step 6.

- [ ] **Step 4: Verify with Bun runtime as well**

Run: `bun dist/cli.js test/fixtures/export-min /tmp/cca-built-bun`
Expected: same successful output.

- [ ] **Step 5: Run full test suite**

Run: `bun test`
Expected: all tests pass (≥ 50 passing across all files).

- [ ] **Step 6: Lint and format**

Run: `bun run lint && bun run format`
Expected: no errors, no formatting changes.

- [ ] **Step 7: Pack tarball to inspect what would be published**

Run: `bun pm pack --dry-run`
Expected: only `dist/`, `package.json`, `README.md` listed. No `src/`, `test/`, `conversations.json`.

- [ ] **Step 8: Commit (only if package.json build script needed update)**

```bash
git add package.json
git commit -m "Adjust build pipeline to preserve cli shebang"
```

---

## Task 15: README and Publish Prep

**Files:**

- Create: `README.md`

- [ ] **Step 1: Write `README.md`**

````markdown
# claude-chat-archive

Convert your Claude.ai chat export into a navigable markdown archive.

## What it does

Claude.ai's data export is a single 100MB+ JSON. This tool turns it into:

- One markdown file per conversation, named `YYYY-MM-DD <title>.md`
- One file or folder per project (with `docs/` if any)
- Attachments inlined when small, separated when large
- YAML frontmatter for Obsidian / dataview queries

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

| Flag                             | Default    | Description                                                                            |
| -------------------------------- | ---------- | -------------------------------------------------------------------------------------- |
| `--mode <m>`                     | `standard` | `minimal` (text only) / `standard` (+ thinking + tool summaries) / `full` (everything) |
| `--no-thinking`                  | off        | Omit assistant thinking                                                                |
| `--no-tools`                     | off        | Omit tool_use / tool_result                                                            |
| `--attachment-threshold <bytes>` | `4096`     | Inline attachments smaller than this; otherwise external                               |
| `--scope <s>`                    | `all`      | `all` / `chats` / `projects`                                                           |
| `--dry-run`                      | off        | Print stats without writing                                                            |

## Output structure

```
output/
├── chats/
│   └── 2026-01-29 PDF 버퍼를 이미지로 변환.md
├── projects/
│   ├── 프로그래밍 강의.md            (no docs)
│   └── How to use Claude/             (with docs)
│       ├── README.md
│       └── docs/Claude prompting guide.md
└── attachments/
    └── <chat-uuid>/<filename>
```

## Requirements

- Node ≥ 20 or Bun
- Zero runtime dependencies

## License

MIT
````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "Add README with usage and options reference"
```

- [ ] **Step 3: Verify final state**

Run: `bun test && bun run build && bun pm pack --dry-run`
Expected: all tests pass, build succeeds, packed tarball contains only `dist/`, `package.json`, `README.md`.

- [ ] **Step 4: Publish (manual — do not automate)**

Inform the user the package is ready. They should run:

```bash
npm login
npm publish --access public
```

---

## Summary

15 tasks, ~60 commits, fully TDD. After Task 15 the package is publishable to npm and runnable via `npx claude-chat-archive` or `bunx claude-chat-archive`.

**Verification at every layer:**

- Pure transforms: unit tests with inline fixtures
- I/O: temp directory tests
- Integration: full pipeline against `test/fixtures/export-min/`
- CLI: smoke test against built `dist/cli.js`
- Package: dry-run pack to confirm contents
