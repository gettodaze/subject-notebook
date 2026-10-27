export const DEFAULT_REPOSITORY = "gettodaze/subject-notebook";
export const EXTERNAL_TARGET = "_blank";
export const EXTERNAL_FEATURES = "noopener,noreferrer";
const GITHUB_ORIGIN = "https://github.com";
const NEW_ISSUE_PATH = "issues/new";
const OWNER_PATTERN = /^[a-z\d](?:[a-z\d-]*[a-z\d])?$/iu;
const REPOSITORY_PATTERN = /^[a-z\d._-]+$/iu;

export function newIssueUrl(repository: string): string {
  const value = repository.trim();
  if (!value)
    throw new Error(
      "Set a GitHub repository in Subject Notebook settings to report an issue.",
    );
  const url = new URL(value.includes("://") ? value : `${GITHUB_ORIGIN}/${value}`);
  if (
    url.origin !== GITHUB_ORIGIN ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error("Use a GitHub repository URL or owner/repository.");
  }
  const segments = url.pathname
    .replace(/\/$/u, "")
    .replace(/\.git$/u, "")
    .split("/")
    .slice(1);
  const [owner, name] = segments;
  if (
    segments.length !== 2 ||
    !owner ||
    !name ||
    !OWNER_PATTERN.test(owner) ||
    !REPOSITORY_PATTERN.test(name) ||
    name === "." ||
    name === ".."
  ) {
    throw new Error("Use a GitHub repository URL or owner/repository.");
  }
  return `${GITHUB_ORIGIN}/${owner}/${name}/${NEW_ISSUE_PATH}`;
}
