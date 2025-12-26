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
    authUrl: 'https://accounts.spotify.com/authorize',
    tokenUrl: 'https://accounts.spotify.com/api/token',
    apiBaseUrl: 'https://api.spotify.com/v1',
  },
} as const

export function validateConfig(): boolean {
  if (!config.spotify.clientId) {
    console.error('Missing VITE_SPOTIFY_CLIENT_ID environment variable')
    return false
  }
  return true
}
