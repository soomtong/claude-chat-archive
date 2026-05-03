import { test, expect, describe } from "bun:test";
import { formatKnownTool } from "../../src/transform/tool-formatter.ts";
import type { ExportContent } from "../../src/types.ts";

const toolUse = (name: string, input: unknown): ExportContent => ({
  type: "tool_use",
  name,
  input,
});

describe("formatKnownTool — ask_user_input_v*", () => {
  test("single_select renders question + options as numbered list", () => {
    const md = formatKnownTool(
      toolUse("ask_user_input_v0", {
        questions: [{ type: "single_select", question: "어떤 순서로?", options: ["A", "B", "C"] }],
      }),
    );
    expect(md).toContain("> [!question]- 사용자에게 질문");
    expect(md).toContain("> **어떤 순서로?**");
    expect(md).toContain("> 1. A");
    expect(md).toContain("> 2. B");
    expect(md).toContain("> 3. C");
  });

  test("multi_select renders with checkbox-style", () => {
    const md = formatKnownTool(
      toolUse("ask_user_input_v0", {
        questions: [{ type: "multi_select", question: "복수 선택", options: ["X", "Y"] }],
      }),
    );
    expect(md).toContain("> - [ ] X");
    expect(md).toContain("> - [ ] Y");
  });

  test("question without options renders just the question", () => {
    const md = formatKnownTool(
      toolUse("ask_user_input_v0", {
        questions: [{ question: "자유 입력 부탁" }],
      }),
    );
    expect(md).toContain("> **자유 입력 부탁**");
    expect(md).not.toContain("- [ ]");
  });

  test("multiple questions render in order", () => {
    const md = formatKnownTool(
      toolUse("ask_user_input_v0", {
        questions: [
          { type: "single_select", question: "Q1", options: ["a"] },
          { type: "single_select", question: "Q2", options: ["b"] },
        ],
      }),
    );
    const q1Idx = md.indexOf("Q1");
    const q2Idx = md.indexOf("Q2");
    expect(q1Idx).toBeGreaterThan(0);
    expect(q2Idx).toBeGreaterThan(q1Idx);
  });

  test("ask_user_input_v1 (future version) also matches", () => {
    const md = formatKnownTool(
      toolUse("ask_user_input_v1", {
        questions: [{ question: "Q" }],
      }),
    );
    expect(md).toContain("Q");
  });
});

describe("formatKnownTool — web tools", () => {
  test("web_search shows query", () => {
    expect(formatKnownTool(toolUse("web_search", { query: "Gleam language" }))).toBe(
      '🔍 검색: "Gleam language"',
    );
  });

  test("web_fetch shows url", () => {
    expect(formatKnownTool(toolUse("web_fetch", { url: "https://example.com" }))).toBe(
      "🌐 가져오기: https://example.com",
    );
  });
});

describe("formatKnownTool — shell / file tools", () => {
  test("bash_tool renders command in code block with description", () => {
    const md = formatKnownTool(
      toolUse("bash_tool", { command: "ls -la", description: "List files" }),
    );
    expect(md).toContain("$ List files");
    expect(md).toContain("```bash");
    expect(md).toContain("ls -la");
  });

  test("bash without description still renders command", () => {
    const md = formatKnownTool(toolUse("bash", { command: "echo hi" }));
    expect(md).toContain("```bash");
    expect(md).toContain("echo hi");
  });

  test("view shows path", () => {
    expect(formatKnownTool(toolUse("view", { path: "/src/foo.ts" }))).toBe("👁️ `/src/foo.ts`");
  });

  test("view shows path + description", () => {
    expect(
      formatKnownTool(toolUse("view", { path: "/src/foo.ts", description: "Check imports" })),
    ).toBe("👁️ `/src/foo.ts` — Check imports");
  });

  test("str_replace shows path + description", () => {
    expect(
      formatKnownTool(toolUse("str_replace", { path: "/foo.ts", description: "Fix typo" })),
    ).toBe("✏️ `/foo.ts` — Fix typo");
  });

  test("present_files lists filepaths", () => {
    expect(formatKnownTool(toolUse("present_files", { filepaths: ["/a.md", "/b.md"] }))).toBe(
      "📋 파일 표시: `/a.md`, `/b.md`",
    );
  });
});

describe("formatKnownTool — search / memory tools", () => {
  test("conversation_search shows query", () => {
    expect(formatKnownTool(toolUse("conversation_search", { query: "java" }))).toBe(
      '🔎 이전 대화 검색: "java"',
    );
  });

  test("recent_chats shows count", () => {
    expect(formatKnownTool(toolUse("recent_chats", { n: 20 }))).toBe("📜 최근 20개 대화 조회");
  });

  test("memory_user_edits shows command", () => {
    expect(formatKnownTool(toolUse("memory_user_edits", { command: "view" }))).toBe(
      "🧠 메모리: view",
    );
  });
});

describe("formatKnownTool — unknown tool", () => {
  test("returns null for unknown tool name", () => {
    expect(formatKnownTool(toolUse("totally_unknown_tool", { x: 1 }))).toBeNull();
  });

  test("returns null when input is missing required fields", () => {
    expect(formatKnownTool(toolUse("web_search", {}))).toBeNull();
  });
});
