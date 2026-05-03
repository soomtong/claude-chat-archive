import type { ExportAttachment, ExportFile } from "../types.ts";

export type Placement = "inline" | "external";

export function decideAttachmentPlacement(
  a: ExportAttachment,
  thresholdBytes: number,
): Placement {
  return a.extracted_content.length >= thresholdBytes ? "external" : "inline";
}

function safeName(a: ExportAttachment): string {
  if (a.file_name && a.file_name.trim().length > 0) return a.file_name;
  return `attachment.${a.file_type || "txt"}`;
}

export function renderAttachment(
  a: ExportAttachment,
  placement: Placement,
  chatUuid: string,
  attachmentsRelDir: string,
): string {
  const name = safeName(a);
  if (placement === "external") {
    return `📎 [${name}](${attachmentsRelDir}/${chatUuid}/${name}) (${a.file_size} bytes)`;
  }
  const body = a.extracted_content
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
  return `> [!file]- 📎 ${name} (${a.file_size} bytes)\n${body}`;
}

export function renderMissingFile(f: ExportFile): string {
  const label = f.file_name?.trim() || f.file_uuid;
  return `📎 [missing] ${label}`;
}
