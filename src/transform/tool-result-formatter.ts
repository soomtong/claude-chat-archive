import type { ContentMode, ExportContent } from "../types.ts";

const VIEW_MAX_LINES_STANDARD = 30;
const CREATED_FILE_PATTERN = /File created successfully:\s*(\S+)/;
const VIEW_HEADER_PATTERN = /^Here's the content of (\S+) with line numbers:\n/;

export function shouldSkipToolResult(content: ExportContent): boolean {
  const name = content.name ?? "";
  return /^ask_user_input(_v\d+)?$/.test(name);
}

interface TextItem {
  type?: string;
  text?: string;
}

function firstTextString(content: ExportContent): string | null {
  const arr = content.content;
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const first = arr[0] as TextItem;
  if (typeof first?.text === "string") return first.text;
  return null;
}

function errorBlock(name: string, body: string | null): string {
  const detail = body ? body.split("\n")[0]!.slice(0, 200) : "(상세 없음)";
  return `⚠️ ${name} 실패: ${detail}`;
}

function formatCreateFile(content: ExportContent): string {
  const text = firstTextString(content) ?? "";
  const m = text.match(CREATED_FILE_PATTERN);
  if (m) return `↩️ ✓ 파일 생성: \`${m[1]}\``;
  return `↩️ ${text || "(빈 응답)"}`;
}

function formatView(content: ExportContent, mode: ContentMode): string | null {
  const text = firstTextString(content);
  if (!text) return null;

  const headerMatch = text.match(VIEW_HEADER_PATTERN);
  const path = headerMatch ? headerMatch[1] : null;
  const body = headerMatch ? text.slice(headerMatch[0].length) : text;

  const lines = body.split("\n");
  let shown = lines;
  let truncationNote = "";
  if (mode !== "full" && lines.length > VIEW_MAX_LINES_STANDARD) {
    shown = lines.slice(0, VIEW_MAX_LINES_STANDARD);
    truncationNote = `\n(생략됨 — 총 ${lines.length}줄 중 ${VIEW_MAX_LINES_STANDARD}줄 표시)`;
  }

  const heading = path ? `📄 \`${path}\` (${lines.length}줄)` : `📄 (${lines.length}줄)`;
  return `${heading}\n\n\`\`\`\n${shown.join("\n")}\n\`\`\`${truncationNote}`;
}

interface BashOutput {
  returncode?: number;
  stdout?: string;
  stderr?: string;
}

function formatBash(content: ExportContent): string | null {
  const text = firstTextString(content);
  if (!text) return null;
  let parsed: BashOutput | null = null;
  try {
    parsed = JSON.parse(text) as BashOutput;
  } catch {
    return null;
  }
  const code = parsed.returncode ?? 0;
  const stdout = (parsed.stdout ?? "").trim();
  const stderr = (parsed.stderr ?? "").trim();
  const prefix = code === 0 ? "↩️" : "⚠️";

  if (!stdout && !stderr) return `↩️ exit ${code} (출력 없음)`;
  const blocks: string[] = [`${prefix} exit ${code}`];
  if (stdout) blocks.push("```", stdout, "```");
  if (stderr) blocks.push("```", `[stderr]\n${stderr}`, "```");
  return blocks.join("\n");
}

function formatWebSearch(content: ExportContent): string {
  const arr = Array.isArray(content.content) ? content.content : [];
  return `↩️ 검색 결과 ${arr.length}건`;
}

function formatPresentFiles(content: ExportContent): string {
  const arr = Array.isArray(content.content) ? content.content : [];
  return `↩️ ${arr.length}개 파일 표시 완료`;
}

function formatRecentChats(): string {
  return `↩️ 최근 대화 목록 조회 완료`;
}

function formatConversationSearch(): string {
  return `↩️ 이전 대화 검색 결과 반환됨`;
}

function formatStrReplace(content: ExportContent): string {
  if (content.is_error) return errorBlock("str_replace", firstTextString(content));
  return `↩️ ✓ 수정됨`;
}

function formatArtifacts(): string {
  return `↩️ ✓ artifact`;
}

function formatWebFetch(content: ExportContent): string | null {
  const text = firstTextString(content);
  if (text === null) return null;
  return `↩️ 가져옴 (${text.length}자)`;
}

export function formatKnownToolResult(content: ExportContent, mode: ContentMode): string | null {
  const name = content.name ?? "";

  if (content.is_error) {
    if (name === "str_replace") return formatStrReplace(content);
    if (name === "create_file") return errorBlock("create_file", firstTextString(content));
  }

  switch (name) {
    case "create_file":
      return formatCreateFile(content);
    case "view":
      return formatView(content, mode);
    case "bash_tool":
    case "bash":
      return formatBash(content);
    case "web_search":
      return formatWebSearch(content);
    case "present_files":
      return formatPresentFiles(content);
    case "recent_chats":
      return formatRecentChats();
    case "conversation_search":
      return formatConversationSearch();
    case "str_replace":
      return formatStrReplace(content);
    case "artifacts":
      return formatArtifacts();
    case "web_fetch":
      return formatWebFetch(content);
    default:
      return null;
  }
}
