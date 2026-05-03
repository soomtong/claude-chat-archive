import type { ExportConversation, ExportMessage } from "../types.ts";

function messageHasContent(msg: ExportMessage): boolean {
  if (msg.text && msg.text.trim().length > 0) return true;
  if (msg.attachments && msg.attachments.length > 0) return true;
  if (msg.files && msg.files.length > 0) return true;
  for (const c of msg.content || []) {
    if (c.type === "text" || c.type === "thinking") {
      if (c.text && c.text.trim().length > 0) return true;
    } else if (c.type === "tool_use" || c.type === "tool_result") {
      return true;
    }
    // token_budget alone is not real content
  }
  return false;
}

export function isEmptyConversation(conv: ExportConversation): boolean {
  if (!conv.chat_messages || conv.chat_messages.length === 0) return true;
  return !conv.chat_messages.some(messageHasContent);
}
