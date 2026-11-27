export function validateRoleCreateInput(input: unknown): string | null {
  if (!input || typeof input !== 'object') return 'Role details are required.';
  const value = input as Record<string, unknown>;
  if (typeof value.name !== 'string' || !value.name.trim()) return 'Role name is required.';
  if (value.name.trim().length > 100) return 'Role name must be 100 characters or fewer.';
  if (typeof value.description !== 'string' || !value.description.trim()) return 'Role description is required.';
  if (value.description.trim().length > 500) return 'Role description must be 500 characters or fewer.';
  if (value.inheritedFrom != null && (typeof value.inheritedFrom !== 'string' || !value.inheritedFrom.trim())) return 'Inherited role is invalid.';
  return null;
}

export function validateRoleUpdateInput(input: unknown): string | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return 'Role updates are required.';
  const value = input as Record<string, unknown>;
  const keys = Object.keys(value);
  if (!keys.length) return 'At least one role field must be updated.';
  if (keys.some((key) => key !== 'name' && key !== 'description')) {
    return 'Only the role name and description can be updated here.';
  }
  if (value.name !== undefined) {
    if (typeof value.name !== 'string' || !value.name.trim()) return 'Role name is required.';
    if (value.name.trim().length > 100) return 'Role name must be 100 characters or fewer.';
  }
  if (value.description !== undefined) {
    if (typeof value.description !== 'string' || !value.description.trim()) return 'Role description is required.';
    if (value.description.trim().length > 500) return 'Role description must be 500 characters or fewer.';
  }
  return null;
}

export function validateUserStatusUpdateInput(input: unknown): string | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return 'User status details are required.';
  const value = input as Record<string, unknown>;
  if (value.status !== 'active' && value.status !== 'suspended') {
    return 'User status must be active or suspended. Use the revoke-access workflow to revoke access.';
  }
  if (typeof value.notes !== 'string' || !value.notes.trim()) return 'A status change reason is required.';
  if (value.notes.trim().length > 500) return 'Status change reason must be 500 characters or fewer.';
  return null;
}

export function isBuiltInPrivilegedRole(roleId: string): boolean {
  return roleId === 'super_admin' || roleId === 'tenant_admin';
}
