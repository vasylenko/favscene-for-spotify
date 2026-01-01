import { SpotifyApi } from '@spotify/web-api-ts-sdk'
import { config } from '@/config'
import type { SpotifyPlaylist, SpotifyDevice, SpotifyUser } from '@/types'

let sdk: SpotifyApi | null = null

export function getSpotifyApi(): SpotifyApi {
  if (!sdk) {
    sdk = SpotifyApi.withUserAuthorization(config.spotify.clientId, config.spotify.redirectUri, [
      ...config.spotify.scopes,
    ])
  }
  return sdk
}

export async function getUserPlaylists(): Promise<SpotifyPlaylist[]> {
  const api = getSpotifyApi()
  // Use Map to deduplicate - Spotify API can return duplicates due to "DJ" phantom playlist
  // See: https://community.spotify.com/t5/Spotify-for-Developers/Get-Current-User-s-Playlists-returns-incorrect-data-when-DJ-is/td-p/6019721
  const playlistMap = new Map<string, SpotifyPlaylist>()
  let offset = 0
  const limit = 50
  let expectedTotal = 0

  while (true) {
    const page = await api.currentUser.playlists.playlists(limit, offset)

    if (offset === 0) {
      expectedTotal = page.total
    }

    // Filter out null items - API can return null for unavailable playlists
    // See: https://community.spotify.com/t5/Spotify-for-Developers/null-values-when-using-quot-Get-Current-User-s-Playlists-quot/td-p/6549968
    for (const item of page.items) {
      if (item && item.id) {
        playlistMap.set(item.id, {
          id: item.id,
          name: item.name,
          uri: item.uri,
          imageUrl: item.images?.[0]?.url || null,
        })
      }
    }

    if (!page.next) break
    offset += limit
  }

  const playlists = Array.from(playlistMap.values())

  // Log discrepancy for debugging (DJ phantom can cause total mismatch)
  if (playlists.length !== expectedTotal) {
    console.debug(`[Spotify] Fetched ${playlists.length} playlists (API reported total: ${expectedTotal})`)
  }

  return playlists
}

export async function getAvailableDevices(): Promise<SpotifyDevice[]> {
  const api = getSpotifyApi()
  const response = await api.player.getAvailableDevices()

  return response.devices.map((device) => ({
    id: device.id || '',
    name: device.name,
    type: device.type,
    is_active: device.is_active,
  }))
}

export async function startPlayback(
  contextUri: string,
  deviceId: string
): Promise<{ success: boolean; error?: string }> {
  const api = getSpotifyApi()

  try {
    await api.player.startResumePlayback(deviceId, contextUri)
    return { success: true }
  } catch (err: unknown) {
    // SDK throws Error with message like: "Unrecognised response code: 404 - . Body: {...}"
    const message = err instanceof Error ? err.message : String(err)

    if (message.includes('404') || message.toLowerCase().includes('not found')) {
      return { success: false, error: 'Device not found or offline' }
    }
    if (message.includes('403') || message.toLowerCase().includes('premium')) {
      return { success: false, error: 'Playback restricted - Premium required' }
    }

    return { success: false, error: 'Playback failed' }
  }
}

export async function setVolume(
  volumePercent: number,
  deviceId: string
): Promise<{ success: boolean; error?: string }> {
  const api = getSpotifyApi()
  const volume = Math.max(0, Math.min(100, Math.round(volumePercent)))

  try {
    await api.player.setPlaybackVolume(volume, deviceId)
    return { success: true }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)

    if (message.includes('403')) {
      return { success: false, error: 'Device does not support volume control' }
    }
    if (message.includes('404')) {
      return { success: false, error: 'Device not found' }
    }

    return { success: false, error: 'Failed to set volume' }
  }
}

export async function getCurrentUserProfile(): Promise<SpotifyUser | null> {
  const api = getSpotifyApi()

  try {
    const profile = await api.currentUser.profile()
    return {
      id: profile.id,
      displayName: profile.display_name || profile.id,
      imageUrl: profile.images?.[0]?.url || null,
    }
  } catch {
    return null
  }
}
