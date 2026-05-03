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
  parts: { type: "text" | "thinking" | "tool_use" | "tool_result" | "token_budget"; text?: string; name?: string; input?: unknown; budget?: number }[],
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
    expect(markdown).toContain("🔧 `Read({\"file_path\":\"/src/foo.ts\"})`");
  });

  test("full mode renders tool_use as code block", () => {
    const { markdown } = renderMessage(
      assistant([
        { type: "tool_use", name: "Read", input: { file_path: "/src/foo.ts" } },
      ]),
      { ...baseConfig, mode: "full" },
      "chat-uuid",
    );
    expect(markdown).toContain("```json");
    expect(markdown).toContain('"file_path": "/src/foo.ts"');
  });

  test("--no-thinking flag overrides mode", () => {
    const { markdown } = renderMessage(
      assistant([{ type: "thinking", text: "사고" }, { type: "text", text: "out" }]),
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
      assistant([{ type: "token_budget", budget: 1000 }, { type: "text", text: "x" }]),
      baseConfig,
      "chat-uuid",
    ).markdown;
    expect(standard).not.toContain("token");

    const full = renderMessage(
      assistant([{ type: "token_budget", budget: 1000 }, { type: "text", text: "x" }]),
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
        { file_name: "note.txt", file_size: 11, file_type: "txt", extracted_content: "hello world" },
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
