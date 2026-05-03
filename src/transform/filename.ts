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

export function conversationFilename(
  conv: ExportConversation,
  used: Set<string>,
): string {
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
