import { test, expect, describe } from "bun:test";
import {
  formatKnownToolResult,
  shouldSkipToolResult,
} from "../../src/transform/tool-result-formatter.ts";
import type { ExportContent } from "../../src/types.ts";

const result = (name: string, textOrItems: string | unknown[], isError = false): ExportContent => {
  const content = Array.isArray(textOrItems) ? textOrItems : [{ type: "text", text: textOrItems }];
  return {
    type: "tool_result",
    name,
    content,
    is_error: isError,
  };
};

describe("shouldSkipToolResult", () => {
  test("ask_user_input_v0 is skipped (redundant echo)", () => {
    expect(shouldSkipToolResult(result("ask_user_input_v0", "anything"))).toBe(true);
  });
  test("ask_user_input_v1 is also skipped", () => {
    expect(shouldSkipToolResult(result("ask_user_input_v1", "anything"))).toBe(true);
  });
  test("other tools are not skipped", () => {
    expect(shouldSkipToolResult(result("web_search", "x"))).toBe(false);
  });
});

describe("formatKnownToolResult — create_file", () => {
  test("extracts path from success message", () => {
    expect(
      formatKnownToolResult(
        result("create_file", "File created successfully: /home/claude/x.md"),
        "standard",
      ),
    ).toBe("↩️ ✓ 파일 생성: `/home/claude/x.md`");
  });
  test("falls back to plain text when message format unexpected", () => {
    expect(formatKnownToolResult(result("create_file", "weird"), "standard")).toBe("↩️ weird");
  });
  test("error result is highlighted", () => {
    expect(
      formatKnownToolResult(result("create_file", "permission denied", true), "standard"),
    ).toBe("⚠️ create_file 실패: permission denied");
  });
});

describe("formatKnownToolResult — view", () => {
  test("strips boilerplate and shows file body in code block", () => {
    const md = formatKnownToolResult(
      result(
        "view",
        "Here's the content of /a.ts with line numbers:\n     1\tconst x = 1;\n     2\tconsole.log(x);",
      ),
      "standard",
    );
    expect(md).toContain("📄 `/a.ts`");
    expect(md).toContain("```");
    expect(md).toContain("const x = 1;");
    expect(md).not.toContain("Here's the content");
    expect(md).not.toContain("with line numbers");
  });
  test("standard mode caps long content with truncation marker", () => {
    const big =
      "Here's the content of /b.ts with line numbers:\n" +
      Array.from({ length: 100 }, (_, i) => `   ${i + 1}\tline${i + 1}`).join("\n");
    const md = formatKnownToolResult(result("view", big), "standard")!;
    expect(md).toContain("(생략됨");
  });
  test("full mode shows everything", () => {
    const big =
      "Here's the content of /b.ts with line numbers:\n" +
      Array.from({ length: 100 }, (_, i) => `   ${i + 1}\tline${i + 1}`).join("\n");
    const md = formatKnownToolResult(result("view", big), "full")!;
    expect(md).not.toContain("생략됨");
    expect(md).toContain("line100");
  });
});

describe("formatKnownToolResult — bash_tool", () => {
  test("renders returncode 0 with stdout", () => {
    const md = formatKnownToolResult(
      result("bash_tool", JSON.stringify({ returncode: 0, stdout: "hello", stderr: "" })),
      "standard",
    )!;
    expect(md).toContain("exit 0");
    expect(md).toContain("hello");
  });
  test("renders non-zero return with stderr", () => {
    const md = formatKnownToolResult(
      result("bash_tool", JSON.stringify({ returncode: 1, stdout: "", stderr: "boom" })),
      "standard",
    )!;
    expect(md).toContain("⚠️");
    expect(md).toContain("exit 1");
    expect(md).toContain("boom");
  });
  test("empty output shows brief marker", () => {
    const md = formatKnownToolResult(
      result("bash_tool", JSON.stringify({ returncode: 0, stdout: "", stderr: "" })),
      "standard",
    )!;
    expect(md).toBe("↩️ exit 0 (출력 없음)");
  });
});

describe("formatKnownToolResult — count summaries", () => {
  test("web_search counts knowledge items", () => {
    const items = Array.from({ length: 5 }, () => ({ type: "knowledge", text: "x" }));
    expect(formatKnownToolResult(result("web_search", items), "standard")).toBe("↩️ 검색 결과 5건");
  });
  test("present_files counts local_resource items", () => {
    const items = [
      { type: "local_resource", file_path: "/a" },
      { type: "local_resource", file_path: "/b" },
    ];
    expect(formatKnownToolResult(result("present_files", items), "standard")).toBe(
      "↩️ 2개 파일 표시 완료",
    );
  });
  test("recent_chats summarizes", () => {
    expect(formatKnownToolResult(result("recent_chats", "<chat>...</chat>"), "standard")).toBe(
      "↩️ 최근 대화 목록 조회 완료",
    );
  });
  test("conversation_search summarizes", () => {
    expect(
      formatKnownToolResult(result("conversation_search", "<chat>found</chat>"), "standard"),
    ).toBe("↩️ 이전 대화 검색 결과 반환됨");
  });
});

describe("formatKnownToolResult — str_replace", () => {
  test("success", () => {
    expect(formatKnownToolResult(result("str_replace", "ok"), "standard")).toBe("↩️ ✓ 수정됨");
  });
  test("error", () => {
    expect(
      formatKnownToolResult(result("str_replace", "File not found: /x", true), "standard"),
    ).toBe("⚠️ str_replace 실패: File not found: /x");
  });
});

describe("formatKnownToolResult — artifacts", () => {
  test("OK ack", () => {
    expect(formatKnownToolResult(result("artifacts", "OK"), "standard")).toBe("↩️ ✓ artifact");
  });
});

describe("formatKnownToolResult — web_fetch", () => {
  test("shows fetched size", () => {
    const md = formatKnownToolResult(result("web_fetch", "x".repeat(1234)), "standard")!;
    expect(md).toContain("↩️ 가져옴");
    expect(md).toContain("1234");
  });
});

describe("formatKnownToolResult — unknown", () => {
  test("returns null for unknown tool", () => {
    expect(formatKnownToolResult(result("totally_unknown", "x"), "standard")).toBeNull();
  });
});
