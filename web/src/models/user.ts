export interface Role {
  id: number
  name: string
}

export interface UserInfo {
  username?: string
  current_login_at?: string | null
  update_datetime?: string
  last_login_ip?: string
  first_name: string
  last_name: string
  id: number
  current_login_ip?: string | null
  active?: boolean
  email?: string
  login_count?: number | null
  confirmed_at?: string | null
  last_login_at?: string | null
  create_datetime?: string | null
  roles?: Role[]
}

export type UserDialogType = false | 'login' | 'register' | 'sendreset' | 'reset' | 'editProfile'
