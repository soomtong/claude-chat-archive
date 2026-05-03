import { test, expect, describe } from "bun:test";
import {
  renderAttachment,
  decideAttachmentPlacement,
} from "../../src/transform/attachment.ts";
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
    expect(decideAttachmentPlacement(att({ extracted_content: "" }), 4096)).toBe(
      "inline",
    );
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
    expect(md).toBe(
      "📎 [note.txt](../attachments/chat-uuid/note.txt) (100 bytes)",
    );
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
