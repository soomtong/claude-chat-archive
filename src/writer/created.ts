import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { sanitizeFilename } from "../transform/filename.ts";

export async function writeCreatedFile(
  createdDir: string,
  chatUuid: string,
  fileName: string,
  content: string,
  used: Set<string>,
): Promise<string> {
  const safeUuid = sanitizeFilename(chatUuid);
  const safeFile = sanitizeFilename(fileName);

  let finalName = safeFile;
  let suffix = 2;
  while (used.has(`${safeUuid}/${finalName}`)) {
    const dot = safeFile.lastIndexOf(".");
    finalName =
      dot > 0
        ? `${safeFile.slice(0, dot)}-${suffix}${safeFile.slice(dot)}`
        : `${safeFile}-${suffix}`;
    suffix += 1;
  }
  used.add(`${safeUuid}/${finalName}`);

  const target = join(createdDir, safeUuid, finalName);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content, "utf8");
  return finalName;
}
