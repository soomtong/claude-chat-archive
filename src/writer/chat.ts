import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Config, ExportConversation } from "../types.ts";
import { conversationFilename } from "../transform/filename.ts";
import { toYamlFrontmatter } from "../transform/frontmatter.ts";
import { renderMessage, type CreatedFile, type ExternalAttachment } from "../transform/message.ts";
import { writeExternalAttachment } from "./attachment.ts";
import { writeCreatedFile } from "./created.ts";

export interface ChatWriteStats {
  inline: number;
  external: number;
  missing: number;
  created: number;
}

export async function writeChat(
  conv: ExportConversation,
  cfg: Config,
  usedFilenames: Set<string>,
): Promise<ChatWriteStats> {
  const filename = conversationFilename(conv, usedFilenames);
  const chatsDir = join(cfg.outputDir, "chats");
  const attachmentsDir = join(cfg.outputDir, "attachments");
  const createdDir = join(cfg.outputDir, "created");

  const externalAttachments: ExternalAttachment[] = [];
  const createdFiles: CreatedFile[] = [];
  let inline = 0;
  let missing = 0;

  const blocks: string[] = [];
  for (const msg of conv.chat_messages) {
    const r = renderMessage(msg, cfg, conv.uuid);
    blocks.push(r.markdown);
    externalAttachments.push(...r.externalAttachments);
    createdFiles.push(...r.createdFiles);
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
    created_file_count: createdFiles.length,
    tags: ["claude-chat"],
    summary: conv.summary,
  });

  const heading = `# ${title}`;
  const document = `${fm}\n${heading}\n\n${blocks.join("\n\n")}\n`;

  const stats: ChatWriteStats = {
    inline,
    external: externalAttachments.length,
    missing,
    created: createdFiles.length,
  };

  if (cfg.dryRun) return stats;

  await mkdir(chatsDir, { recursive: true });
  await writeFile(join(chatsDir, filename), document, "utf8");
  for (const att of externalAttachments) {
    await writeExternalAttachment(attachmentsDir, att.chatUuid, att.fileName, att.content);
  }
  const usedCreatedNames = new Set<string>();
  for (const cf of createdFiles) {
    await writeCreatedFile(createdDir, cf.chatUuid, cf.fileName, cf.content, usedCreatedNames);
  }
  return stats;
}
