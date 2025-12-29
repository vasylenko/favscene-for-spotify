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
  api: {
    // Base URL for scene sync API (Cloudflare Worker)
    // Production: empty string (same origin - frontend and API on same domain)
    // Local dev: set VITE_API_BASE_URL to deployed worker or http://localhost:8787
    baseUrl: import.meta.env.VITE_API_BASE_URL || '',
  },
} as const

export function validateConfig(): boolean {
  if (!config.spotify.clientId) {
    logger.error('Missing VITE_SPOTIFY_CLIENT_ID environment variable')
    return false
  }
  return true
}
