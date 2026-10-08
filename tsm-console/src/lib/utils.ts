/**
 * shadcn-style className merge helper (no tailwind-merge runtime required).
 * Keeps TSM dependency surface small while matching shadcn component patterns.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
