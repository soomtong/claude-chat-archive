import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { sanitizeFilename } from "../transform/filename.ts";

export async function writeExternalAttachment(
  attachmentsDir: string,
  chatUuid: string,
  fileName: string,
  content: string,
): Promise<void> {
  const safeUuid = sanitizeFilename(chatUuid);
  const safeFile = sanitizeFilename(fileName);
  const target = join(attachmentsDir, safeUuid, safeFile);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content, "utf8");
}
