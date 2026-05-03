import { test, expect, describe } from "bun:test";
import {
  sanitizeFilename,
  conversationFilename,
} from "../../src/transform/filename.ts";
import type { ExportConversation } from "../../src/types.ts";

describe("sanitizeFilename", () => {
  test("preserves Korean characters", () => {
    expect(sanitizeFilename("프로그래밍 강의")).toBe("프로그래밍 강의");
  });
  test("replaces filesystem-forbidden chars with underscore", () => {
    expect(sanitizeFilename('a/b\\c:d*e?f"g<h>i|j')).toBe(
      "a_b_c_d_e_f_g_h_i_j",
    );
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
    expect(f.length).toBeLessThanOrEqual(11 + 80 + 3);
  });
});
