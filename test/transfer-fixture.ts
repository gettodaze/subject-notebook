import type { FileManager, Vault } from "obsidian";
import { TFile, TFolder, getFrontMatterInfo, parseYaml, stringifyYaml } from "./obsidian";

export class TransferFixture {
  readonly entries = new Map<string, TFile | TFolder>();
  readonly contents = new Map<TFile, string>();
  reads = 0;
  failRename = false;
  failAfterWrite = false;
  beforeUpdate: ((file: TFile) => void) | undefined;

  folder(path: string): TFolder {
    const existing = this.entries.get(path);
    if (existing instanceof TFolder) return existing;
    const separator = path.lastIndexOf("/");
    const parent = separator > 0 ? this.folder(path.slice(0, separator)) : undefined;
    const folder = new TFolder(path);
    this.entries.set(path, folder);
    parent?.children.push(folder);
    return folder;
  }

  file(path: string, content: string): TFile {
    const file = new TFile(path);
    this.entries.set(path, file);
    this.folder(path.slice(0, path.lastIndexOf("/"))).children.push(file);
    this.write(file, content);
    return file;
  }

  write(file: TFile, content: string): void {
    this.contents.set(file, content);
    file.stat.mtime += 1;
    file.stat.size = content.length;
  }

  fileAt(path: string): TFile {
    const file = this.entries.get(path);
    if (!(file instanceof TFile)) throw new Error(`Missing test file: ${path}`);
    return file;
  }

  text(path: string): string {
    return this.contents.get(this.fileAt(path)) ?? "";
  }

  get vault(): Vault {
    return {
      getAbstractFileByPath: (path: string): TFile | TFolder | undefined =>
        this.entries.get(path),
      getFolderByPath: (path: string): TFolder | null => {
        const item = this.entries.get(path);
        return item instanceof TFolder ? item : null;
      },
      getFileByPath: (path: string): TFile | null => {
        const item = this.entries.get(path);
        return item instanceof TFile ? item : null;
      },
      createFolder: async (path: string): Promise<TFolder> => this.folder(path),
      read: async (file: TFile): Promise<string> => {
        this.reads += 1;
        return this.contents.get(file) ?? "";
      },
    } as unknown as Vault;
  }

  get fileManager(): FileManager {
    return {
      renameFile: async (folder: TFolder, destination: string): Promise<void> =>
        this.rename(folder, destination),
      processFrontMatter: async (
        file: TFile,
        change: (metadata: Record<string, unknown>) => void,
      ): Promise<void> => {
        this.beforeUpdate?.(file);
        const content = this.contents.get(file) ?? "";
        const info = getFrontMatterInfo(content);
        const metadata = parseYaml(info.frontmatter) as Record<string, unknown>;
        change(metadata);
        this.write(
          file,
          `---\n${stringifyYaml(metadata)}---\n${content.slice(info.contentStart)}`,
        );
        if (this.failAfterWrite) {
          this.failAfterWrite = false;
          throw new Error("Post-write failure");
        }
      },
    } as unknown as FileManager;
  }

  private rename(folder: TFolder, destination: string): void {
    if (this.failRename) throw new Error("Rename failed");
    const previous = folder.path;
    const parent = this.folder(destination.slice(0, destination.lastIndexOf("/")));
    const oldParent = this.entries.get(previous.slice(0, previous.lastIndexOf("/")));
    if (oldParent instanceof TFolder)
      oldParent.children = oldParent.children.filter((child) => child !== folder);
    parent.children.push(folder);
    const moved = [...this.entries.entries()].filter(
      ([path]) => path === previous || path.startsWith(`${previous}/`),
    );
    for (const [path] of moved) this.entries.delete(path);
    for (const [path, item] of moved) {
      item.path = destination + path.slice(previous.length);
      this.entries.set(item.path, item);
    }
  }
}
