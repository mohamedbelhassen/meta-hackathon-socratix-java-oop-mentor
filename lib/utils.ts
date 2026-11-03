export { cn } from "cn";

/**
 * Formats a lab's code and title for display in dropdown selectors without duplicating prefixes.
 * e.g., if code is "TP10" and title is "TP 10 — Lab 10: Advanced Interfaces...", returns:
 * "TP 10 — Lab 10: Advanced Interfaces..." instead of "TP10 - TP 10 — Lab 10:..."
 */
export function formatLabOptionLabel(code?: string, title?: string): string {
  if (!code && !title) return 'Lab';
  if (!code) return title || 'Lab';
  if (!title) return code;

  const trimmedTitle = title.trim();
  const trimmedCode = code.trim();

  // Normalize code and title (remove spaces, punctuation, lowercase)
  const normCode = trimmedCode.replace(/[\s\-_]+/g, '').toLowerCase();
  const normTitle = trimmedTitle.replace(/[\s\-_—:]+/g, '').toLowerCase();

  // If title already starts with the code (e.g. "TP10", "TP 10", "tp-10")
  if (normTitle.startsWith(normCode)) {
    return trimmedTitle;
  }

  // Check if title starts with "TP X" or "Lab X" matching the code's numeric suffix
  const codeNum = trimmedCode.match(/\d+/)?.[0];
  const titleNum = trimmedTitle.match(/^(?:tp|lab)\s*(\d+)/i)?.[1];
  if (codeNum && titleNum && codeNum === titleNum) {
    return trimmedTitle;
  }

  return `${trimmedCode} — ${trimmedTitle}`;
}

/**
 * Checks if the Hackathon Jury sandbox / bypass mode is enabled.
 * Default is true for Hackathon evaluation. Set NEXT_PUBLIC_ENABLE_JURY_SANDBOX="false"
 * in production or during classroom teaching to enforce strict authentication and hide demo PINs.
 */
export function isJurySandboxEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_JURY_SANDBOX !== 'false';
}

/**
 * Returns the configured GitHub repository URL with fallback.
 */
export function getGithubRepoUrl(): string {
  return (
    process.env.NEXT_PUBLIC_GITHUB_REPO_URL ||
    'https://github.com/mohamedbelhassen/meta-hackathon-socratix-java-oop-mentor'
  );
}

