import { findCanonicalProtectedPath } from '@/domain/systems/dnd5e-2014';
import type { CharacterSheetRecord } from './types';

export interface SheetAccessContext {
  isGm: boolean;
  canEdit: boolean;
  editableFields: readonly string[];
  authorizedOverrideFields: readonly string[];
}

export function buildSheetAccessContext(
  character: Pick<CharacterSheetRecord, 'canEdit' | 'editableFields' | 'authorizedOverrideFields'>,
  isGm: boolean
): SheetAccessContext {
  return {
    isGm,
    canEdit: isGm || character.canEdit,
    editableFields: character.editableFields,
    authorizedOverrideFields: character.authorizedOverrideFields,
  };
}

function matchesEditablePath(fieldPath: string, list: readonly string[]): boolean {
  const set = new Set(list);
  if (set.has('*') || set.has(fieldPath)) return true;
  if (fieldPath === 'generalInfo.name' && set.has('name')) return true;
  if (fieldPath === 'name' && (set.has('generalInfo.name') || set.has('generalInfo'))) {
    return true;
  }
  const parts = fieldPath.split('.');
  for (let i = parts.length - 1; i >= 1; i--) {
    if (set.has(parts.slice(0, i).join('.'))) {
      return true;
    }
  }
  return false;
}

export function isProtectedSheetField(fieldPath: string): boolean {
  return findCanonicalProtectedPath(fieldPath) !== null;
}

/**
 * Mirrors server `evaluatePlayerFieldAccess` decisions purely for UI control state.
 * The server always re-evaluates and enforces every permission independently on PATCH.
 */
export function canEditSheetField(fieldPath: string, access: SheetAccessContext): boolean {
  if (!access.canEdit) {
    return false;
  }
  if (access.isGm || access.editableFields.includes('*')) {
    return true;
  }

  const protectedCanonical = findCanonicalProtectedPath(fieldPath);
  if (protectedCanonical !== null) {
    const authSet = new Set(access.authorizedOverrideFields);
    return authSet.has(protectedCanonical) || authSet.has(fieldPath);
  }

  return matchesEditablePath(fieldPath, access.editableFields);
}
