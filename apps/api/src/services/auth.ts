import { supabase } from '../db'

interface LoginResult {
  user?: unknown
  session?: unknown
  error?: string
}

interface RefreshResult {
  session?: unknown
  error?: string
}

export const authService = {
  async login(email: string, password: string): Promise<LoginResult> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return { error: error.message }
    }

    return {
      user: data.user,
      session: data.session,
    }
  },

  async refreshToken(refreshToken: string): Promise<RefreshResult> {
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    })

    if (error) {
      return { error: error.message }
    }

    return {
      session: data.session,
    }
  },

  async logout(): Promise<void> {
    await supabase.auth.signOut()
  },

  async getUser(token: string) {
    const { data, error } = await supabase.auth.getUser(token)

    if (error) {
      return { user: null, error: error.message }
    }

    return { user: data.user }
  },
}
