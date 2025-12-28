import { ref, computed } from 'vue'
import { getSpotifyApi, getCurrentUserProfile } from '@/services/spotify'
import type { SpotifyUser } from '@/types'

const STORAGE_KEY_USER = 'spotify_user'

const user = ref<SpotifyUser | null>(loadUser())
const isLoading = ref(false)
const error = ref<string | null>(null)

function loadUser(): SpotifyUser | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_USER)
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

function saveUser(newUser: SpotifyUser): void {
  user.value = newUser
  localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(newUser))
}

function clearUser(): void {
  user.value = null
  localStorage.removeItem(STORAGE_KEY_USER)
}

async function initiateLogin(): Promise<void> {
  isLoading.value = true
  error.value = null

  try {
    const sdk = getSpotifyApi()
    await sdk.authenticate()
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Login failed'
  } finally {
    isLoading.value = false
  }
}

async function handleCallback(): Promise<boolean> {
  isLoading.value = true
  error.value = null

  try {
    const sdk = getSpotifyApi()
    const response = await sdk.authenticate()

    if (!response.authenticated) {
      error.value = 'Authentication failed'
      return false
    }

    const profile = await getCurrentUserProfile()
    if (profile) {
      saveUser(profile)
    }

    return true
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Authentication failed'
    return false
  } finally {
    isLoading.value = false
  }
}

function clearAuth(): void {
  const sdk = getSpotifyApi()
  sdk.logOut()
  clearUser()
}

export function useSpotifyAuth() {
  const isAuthenticated = computed(() => !!user.value)

  return {
    isAuthenticated,
    isLoading,
    error,
    user,
    initiateLogin,
    handleCallback,
    clearAuth,
  }
}
