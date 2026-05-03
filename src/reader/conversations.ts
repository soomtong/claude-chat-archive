import { readFile } from "node:fs/promises";
import type { ExportConversation } from "../types.ts";

export async function loadConversations(
  path: string,
): Promise<ExportConversation[]> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (err) {
    throw new Error(
      `Failed to read conversations.json at ${path}: ${(err as Error).message}`,
    );
  }
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`conversations.json at ${path} is not an array`);
  }
  return parsed as ExportConversation[];
}
