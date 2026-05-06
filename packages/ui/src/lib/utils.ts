import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind class strings with conflict resolution.
 * Drop-in replacement for the conventional `cn` helper used by shadcn/ui.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
