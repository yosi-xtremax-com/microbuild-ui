/**
 * Utility functions for hooks
 */

// Re-export apiRequest from services which respects DaaS configuration
// This ensures hooks work in both Next.js (proxy mode) and Storybook (direct mode)
export { apiRequest } from '@buildpad/services';

// Re-export centralized new-item detection from @buildpad/utils
export { isNewItem, isExistingItem } from '@buildpad/utils';

/**
 * Check if the primary key is valid for API operations
 * Returns false for new/unsaved items (primaryKey is "+" or null/undefined)
 * @deprecated Use `isExistingItem()` from `@buildpad/utils` instead
 */
export function isValidPrimaryKey(primaryKey: string | number | null | undefined): primaryKey is string | number {
  if (primaryKey === null || primaryKey === undefined) return false;
  if (primaryKey === '+' || primaryKey === '%2B' || primaryKey === '') return false;
  return true;
}
