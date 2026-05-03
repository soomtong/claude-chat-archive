export type FrontmatterValue =
  | string
  | number
  | boolean
  | string[]
  | null
  | undefined;

// Leading characters that have special YAML meaning and force quoting.
const LEADING_SPECIAL = /^[\-?:,\[\]{}#&*!|>'"%@`]/;
// Substrings that force quoting wherever they appear.
const NEEDS_QUOTE_ANYWHERE = /: |#( |$)/;

function renderScalar(value: string | number | boolean): string {
  if (typeof value === "boolean" || typeof value === "number") {
    return String(value);
  }
  if (value.includes("\n")) {
    const indented = value
      .split("\n")
      .map((line) => `  ${line}`)
      .join("\n");
    return `|\n${indented}`;
  }
  const needsQuotes =
    LEADING_SPECIAL.test(value) ||
    NEEDS_QUOTE_ANYWHERE.test(value) ||
    value.includes('"') ||
    value !== value.trim() ||
    value === "";
  if (needsQuotes) {
    const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `"${escaped}"`;
  }
  return value;
}

function renderArray(values: string[]): string {
  if (values.length === 0) return "[]";
  return `[${values.join(", ")}]`;
}

export function toYamlFrontmatter(
  fields: Record<string, FrontmatterValue>,
): string {
  const lines: string[] = ["---"];
  for (const [key, value] of Object.entries(fields)) {
    if (value === null || value === undefined) continue;
    if (typeof value === "string" && value === "") continue;
    if (Array.isArray(value)) {
      lines.push(`${key}: ${renderArray(value)}`);
    } else {
      lines.push(`${key}: ${renderScalar(value)}`);
    }
  }
  lines.push("---", "");
  return lines.join("\n");
}
