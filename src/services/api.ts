/**
 * API client for scene sync with Cloudflare Worker backend
 */

import { config } from '@/config'
import { getSpotifyApi } from '@/services/spotify'
import { logger } from '@/utils/logger'
import type { Scene } from '@/types'

export interface ApiResult<T> {
  success: boolean
  data?: T
  error?: string
  needsReauth?: boolean // True if 401 - token invalid/expired
}

interface ScenesResponse {
  scenes: Scene[]
}

interface SaveResponse {
  ok: boolean
}

/**
 * Gets current Spotify access token from SDK
 */
async function getAccessToken(): Promise<string | null> {
  try {
    const sdk = getSpotifyApi()
    const token = await sdk.getAccessToken()
    return token?.access_token || null
  } catch (error) {
    logger.error('Failed to get access token:', error)
    return null
  }
}

/**
 * Fetches scenes from API
 */
export async function fetchScenes(): Promise<ApiResult<Scene[]>> {
  const token = await getAccessToken()
  if (!token) {
    return {
      success: false,
      error: 'Not authenticated',
      needsReauth: true,
    }
  }

  try {
    const response = await fetch(`${config.api.baseUrl}/api/scenes`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })

    if (response.status === 401) {
      return {
        success: false,
        error: 'Session expired',
        needsReauth: true,
      }
    }

    if (!response.ok) {
      const errorText = await response.text()
      logger.error('Failed to fetch scenes:', errorText)
      return {
        success: false,
        error: `Server error: ${response.status}`,
      }
    }

    const data = (await response.json()) as ScenesResponse
    return {
      success: true,
      data: data.scenes,
    }
  } catch (error) {
    logger.error('Network error fetching scenes:', error)
    return {
      success: false,
      error: 'Cannot connect to sync service. Please check your internet connection.',
    }
  }
}

/**
 * Saves scenes to API
 */
export async function saveScenes(scenes: Scene[]): Promise<ApiResult<void>> {
  const token = await getAccessToken()
  if (!token) {
    return {
      success: false,
      error: 'Not authenticated',
      needsReauth: true,
    }
  }

  try {
    const response = await fetch(`${config.api.baseUrl}/api/scenes`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ scenes }),
    })

    if (response.status === 401) {
      return {
        success: false,
        error: 'Session expired',
        needsReauth: true,
      }
    }

    if (!response.ok) {
      const errorText = await response.text()
      logger.error('Failed to save scenes:', errorText)
      return {
        success: false,
        error: `Server error: ${response.status}`,
      }
    }

    const data = (await response.json()) as SaveResponse
    if (!data.ok) {
      return {
        success: false,
        error: 'Failed to save scenes',
      }
    }

    return {
      success: true,
    }
  } catch (error) {
    logger.error('Network error saving scenes:', error)
    return {
      success: false,
      error: 'Cannot connect to sync service. Please check your internet connection.',
    }
  }
}
