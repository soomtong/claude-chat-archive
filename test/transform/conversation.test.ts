import { test, expect, describe } from "bun:test";
import { isEmptyConversation } from "../../src/transform/conversation.ts";
import type { ExportConversation, ExportMessage } from "../../src/types.ts";

const baseMsg: ExportMessage = {
  uuid: "m",
  text: "",
  sender: "human",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  content: [],
  attachments: [],
  files: [],
  parent_message_uuid: "00000000-0000-4000-8000-000000000000",
};

const conv = (msgs: ExportMessage[]): ExportConversation => ({
  uuid: "c",
  name: "",
  summary: "",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  account: { uuid: "x" },
  chat_messages: msgs,
});

describe("isEmptyConversation", () => {
  test("empty when no messages", () => {
    expect(isEmptyConversation(conv([]))).toBe(true);
  });

  test("empty when every message has blank text and blank content[].text", () => {
    expect(
      isEmptyConversation(
        conv([
          { ...baseMsg, content: [{ type: "text", text: "" }] },
          { ...baseMsg, sender: "assistant", content: [{ type: "text", text: "   " }] },
        ]),
      ),
    ).toBe(true);
  });

  test("not empty when any message has non-blank text", () => {
    expect(isEmptyConversation(conv([{ ...baseMsg, text: "hello" }]))).toBe(false);
  });

  test("not empty when content[].text has body", () => {
    expect(
      isEmptyConversation(conv([{ ...baseMsg, content: [{ type: "text", text: "hi" }] }])),
    ).toBe(false);
  });

  test("not empty when message has attachments", () => {
    expect(
      isEmptyConversation(
        conv([
          {
            ...baseMsg,
            attachments: [
              { file_name: "a.txt", file_size: 1, file_type: "txt", extracted_content: "" },
            ],
          },
        ]),
      ),
    ).toBe(false);
  });

  test("not empty when message has files (missing binaries)", () => {
    expect(
      isEmptyConversation(conv([{ ...baseMsg, files: [{ file_uuid: "u", file_name: "x" }] }])),
    ).toBe(false);
  });

  test("not empty when message has thinking text", () => {
    expect(
      isEmptyConversation(
        conv([
          {
            ...baseMsg,
            sender: "assistant",
            content: [{ type: "thinking", text: "reasoning..." }],
          },
        ]),
      ),
    ).toBe(false);
  });

  test("not empty when message has tool_use", () => {
    expect(
      isEmptyConversation(
        conv([
          {
            ...baseMsg,
            sender: "assistant",
            content: [{ type: "tool_use", name: "create_file", input: {} }],
          },
        ]),
      ),
    ).toBe(false);
  });

  test("not empty when message has tool_result", () => {
    expect(
      isEmptyConversation(
        conv([
          {
            ...baseMsg,
            sender: "assistant",
            content: [{ type: "tool_result", content: "ok" }],
          },
        ]),
      ),
    ).toBe(false);
  });

  test("token_budget alone does NOT count as content", () => {
    expect(
      isEmptyConversation(
        conv([
          {
            ...baseMsg,
            sender: "assistant",
            content: [{ type: "token_budget", budget: 1000 }],
          },
        ]),
      ),
    ).toBe(true);
  });
});
