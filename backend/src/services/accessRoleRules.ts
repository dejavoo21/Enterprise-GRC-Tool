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

export function isBuiltInPrivilegedRole(roleId: string): boolean {
  return roleId === 'super_admin' || roleId === 'tenant_admin';
}
