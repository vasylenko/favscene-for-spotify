/**
 * API client for scene sync with Cloudflare Worker backend
 */

import { config } from '@/config'
import { getSpotifyApi } from '@/services/spotify'
import { logger } from '@/utils/logger'
import type { Scene } from '@/types'

// HTTP status codes
const HTTP_UNAUTHORIZED = 401

// OAuth token format
const BEARER_PREFIX = 'Bearer '

// User-facing error messages
const ERROR_NOT_AUTHENTICATED = 'Not authenticated'
const ERROR_SESSION_EXPIRED = 'Session expired'
const ERROR_NETWORK_UNAVAILABLE = 'Cannot connect to sync service. Please check your internet connection.'
const ERROR_SAVE_FAILED = 'Failed to save scenes'

export interface ApiResult<T> {
  success: boolean
  data?: T
  error?: string
  needsReauth?: boolean // Signals frontend to redirect to login flow
}

interface ScenesResponse {
  scenes: Scene[]
}

interface SaveResponse {
  ok: boolean
}

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

function createAuthHeaders(token: string): Record<string, string> {
  return {
    Authorization: `${BEARER_PREFIX}${token}`,
  }
}

function handleUnauthorizedResponse(): ApiResult<never> {
  return {
    success: false,
    error: ERROR_SESSION_EXPIRED,
    needsReauth: true, // Triggers re-authentication flow
  }
}

function handleNetworkError(error: unknown, operation: string): ApiResult<never> {
  logger.error(`Network error ${operation}:`, error)
  return {
    success: false,
    error: ERROR_NETWORK_UNAVAILABLE,
  }
}

export async function fetchScenes(): Promise<ApiResult<Scene[]>> {
  const token = await getAccessToken()
  if (!token) {
    return {
      success: false,
      error: ERROR_NOT_AUTHENTICATED,
      needsReauth: true,
    }
  }

  try {
    const response = await fetch(`${config.api.baseUrl}/api/scenes`, {
      method: 'GET',
      headers: createAuthHeaders(token),
    })

    if (response.status === HTTP_UNAUTHORIZED) {
      return handleUnauthorizedResponse()
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
    return handleNetworkError(error, 'fetching scenes')
  }
}

export async function saveScenes(scenes: Scene[]): Promise<ApiResult<void>> {
  const token = await getAccessToken()
  if (!token) {
    return {
      success: false,
      error: ERROR_NOT_AUTHENTICATED,
      needsReauth: true,
    }
  }

  try {
    const response = await fetch(`${config.api.baseUrl}/api/scenes`, {
      method: 'PUT',
      headers: {
        ...createAuthHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ scenes }),
    })

    if (response.status === HTTP_UNAUTHORIZED) {
      return handleUnauthorizedResponse()
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
        error: ERROR_SAVE_FAILED,
      }
    }

    return {
      success: true,
    }
  } catch (error) {
    return handleNetworkError(error, 'saving scenes')
  }
}
