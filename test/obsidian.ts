// Test-only host boundary. Real pane/render behavior is covered in the disposable vault.
import { parse, stringify } from "yaml";

export function normalizePath(value: string): string {
  return value.replaceAll("\\", "/").replace(/\/{2,}/gu, "/");
}
export function parseYaml(value: string): unknown {
  return parse(value);
}
export function stringifyYaml(value: unknown): string {
  return stringify(value);
}

export class TFile {
  stat = { ctime: 0, mtime: 0, size: 0 };
  constructor(public path: string) {}
  get name(): string {
    return this.path.slice(this.path.lastIndexOf("/") + 1);
  }
  get extension(): string {
    return this.name.slice(this.name.lastIndexOf(".") + 1);
  }
}
export class TFolder {
  children: (TFile | TFolder)[] = [];
  constructor(public path: string) {}
  get name(): string {
    return this.path.slice(this.path.lastIndexOf("/") + 1);
  }
}
export class MarkdownView {}

export function getFrontMatterInfo(content: string): {
  exists: boolean;
  frontmatter: string;
  contentStart: number;
  from: number;
  to: number;
} {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u.exec(content);
  if (!match) return { exists: false, frontmatter: "", contentStart: 0, from: 0, to: 0 };
  const from = content.indexOf("\n") + 1;
  return {
    exists: true,
    frontmatter: match[1]!,
    contentStart: match[0].length,
    from,
    to: from + match[1]!.length,
  };
}
