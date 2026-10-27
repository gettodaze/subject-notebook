const H2_PREFIX = "## ";
const FRONTMATTER_DELIMITER = "---";
const NEWLINE = "\n";
const WINDOWS_NEWLINE = "\r\n";

export function localDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function hasDailyHeading(content: string, date: string): boolean {
  let frontmatter = false;
  let fence: string | null = null;
  const lines = content.split(/\r?\n/u);
  for (const [index, line] of lines.entries()) {
    if (index === 0 && line.replace(/^\uFEFF/u, "") === FRONTMATTER_DELIMITER) {
      frontmatter = true;
      continue;
    }
    if (frontmatter) {
      if (line === FRONTMATTER_DELIMITER) frontmatter = false;
      continue;
    }
    const marker = /^ {0,3}(`{3,}|~{3,})/u.exec(line)?.[1];
    if (marker && !fence) {
      fence = marker;
      continue;
    }
    if (fence) {
      if (closesFence(line, fence)) fence = null;
      continue;
    }
    if (line === `${H2_PREFIX}${date}`) return true;
  }
  return false;
}

function closesFence(line: string, fence: string): boolean {
  const marker = /^ {0,3}(`{3,}|~{3,})\s*$/u.exec(line)?.[1];
  return marker !== undefined && marker[0] === fence[0] && marker.length >= fence.length;
}

export function dailySuffix(content: string, date: string): string {
  if (hasDailyHeading(content, date)) return "";
  const newline = content.includes(WINDOWS_NEWLINE) ? WINDOWS_NEWLINE : NEWLINE;
  const separation =
    !content || content.endsWith(newline + newline)
      ? ""
      : content.endsWith(newline)
        ? newline
        : newline + newline;
  return `${separation}${H2_PREFIX}${date}${newline}${newline}`;
}
