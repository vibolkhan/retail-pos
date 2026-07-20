// 'manager' has the same access as 'admin' everywhere in this app today —
// there's no separate user/role-management page to distinguish them on yet.
export type Role = 'admin' | 'manager' | 'salesperson'

export interface AuthProfile {
  id: string
  email: string
  role: Role
}
