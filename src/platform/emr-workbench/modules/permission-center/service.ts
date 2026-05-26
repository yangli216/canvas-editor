export interface IPermissionCenterRole {
  id: string
  label: string
  description: string
  scopes: string[]
}

export interface IPermissionCenterAssignment {
  id: string
  scopeLabel: string
  owner: string
  roleId: string
  updatedAt: number
}

export interface IPermissionCenterViewModel {
  summary: {
    roleCount: number
    uniqueScopeCount: number
    publishRoleCount: number
    traceRoleCount: number
    assignmentCount: number
  }
  roles: Array<{
    id: string
    label: string
    description: string
    scopesText: string
    scopeCount: number
  }>
  assignments: Array<{
    id: string
    scopeLabel: string
    owner: string
    roleLabel: string
    nextRoleLabel: string
    updatedText: string
  }>
}

export function buildPermissionCenterViewModel(
  roles: IPermissionCenterRole[],
  assignments: IPermissionCenterAssignment[]
): IPermissionCenterViewModel {
  const uniqueScopes = new Set(roles.flatMap(role => role.scopes))
  const roleMap = new Map(roles.map(role => [role.id, role]))
  return {
    summary: {
      roleCount: roles.length,
      uniqueScopeCount: uniqueScopes.size,
      publishRoleCount: roles.filter(role =>
        role.scopes.includes('template.publish')
      ).length,
      traceRoleCount: roles.filter(role =>
        role.scopes.includes('document.trace.read')
      ).length,
      assignmentCount: assignments.length
    },
    roles: roles.map(role => ({
      id: role.id,
      label: role.label,
      description: role.description,
      scopesText: role.scopes.join(' / '),
      scopeCount: role.scopes.length
    })),
    assignments: assignments.map((assignment, index) => {
      const currentIndex = roles.findIndex(role => role.id === assignment.roleId)
      const nextRole = roles[(currentIndex + 1) % roles.length]
      const currentRole = roleMap.get(assignment.roleId) || roles[0]
      return {
        id: assignment.id,
        scopeLabel: assignment.scopeLabel,
        owner: assignment.owner,
        roleLabel: currentRole.label,
        nextRoleLabel: nextRole.label,
        updatedText: new Date(
          assignment.updatedAt || Date.now() - index * 3600_000
        ).toLocaleString()
      }
    })
  }
}