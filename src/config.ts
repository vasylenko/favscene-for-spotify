import { logger } from '@/utils/logger'

export const config = {
  spotify: {
    clientId: import.meta.env.VITE_SPOTIFY_CLIENT_ID || '',
    redirectUri: `${window.location.origin}/callback`,
    scopes: [
      'user-read-playback-state',
      'user-modify-playback-state',
      'user-read-private',
      'playlist-read-private',
      'playlist-read-collaborative',
    ],
  },
} as const

export function validateConfig(): boolean {
  if (!config.spotify.clientId) {
    logger.error('Missing VITE_SPOTIFY_CLIENT_ID environment variable')
    return false
  }
  return true
}
