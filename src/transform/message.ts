import type { Config, ExportContent, ExportMessage, ContentMode } from "../types.ts";
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
