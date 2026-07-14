export type Role = 'admin' | 'salesperson'

export interface AuthProfile {
  id: string
  email: string
  role: Role
}
