/**
 * FavScene for Spotify - Cloudflare Worker
 *
 * Provides scene sync across browsers via KV storage.
 * Authentication: Validates Spotify access tokens, no token storage.
 * Access control: Users can only access their own scenes (keyed by Spotify user ID).
 * Privacy: Data encrypted with user ID as key - owner cannot bulk-decrypt.
 */

import { hashUserIdForKey, encrypt, decrypt, isEncrypted } from './crypto'

interface Env {
  FAVSCENE_USER_SCENES: KVNamespace
  ASSETS: Fetcher
}

interface Scene {
  id: string
  name: string
  volume: number
  playlist: {
    id: string
    name: string
    uri: string
    imageUrl: string | null
  }
  device: {
    id: string
    name: string
    type: string
  }
}

interface ScenesPayload {
  scenes: Scene[]
}

// CORS configuration for browser access
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
}

// Resource limits to prevent abuse
const MAX_SCENES = 50 // Sufficient for hobby use, prevents bloat
const MAX_BODY_SIZE = 50 * 1024 // 50KB - balances functionality vs storage cost

// KV storage namespace
const KV_KEY_PREFIX = 'scenes:' // Allows future multi-type storage (e.g., "settings:")

// HTTP status codes
const HTTP_OK = 200
const HTTP_BAD_REQUEST = 400
const HTTP_UNAUTHORIZED = 401
const HTTP_NOT_FOUND = 404
const HTTP_MOVED_PERMANENTLY = 301
const HTTP_METHOD_NOT_ALLOWED = 405
const HTTP_PAYLOAD_TOO_LARGE = 413
const HTTP_INTERNAL_ERROR = 500

// OAuth token format
const BEARER_PREFIX = 'Bearer '
const BEARER_PREFIX_LENGTH = BEARER_PREFIX.length

// Spotify API endpoint for token validation
const SPOTIFY_USER_PROFILE_URL = 'https://api.spotify.com/v1/me'

// Structured logging helper for Workers Logs
function log(event: string, data: Record<string, unknown> = {}) {
  console.log({ event, ...data })
}

async function validateSpotifyToken(token: string): Promise<string | null> {
  try {
    const response = await fetch(SPOTIFY_USER_PROFILE_URL, {
      headers: {
        Authorization: `${BEARER_PREFIX}${token}`,
      },
    })

    if (!response.ok) {
      log('auth_failed', { reason: 'spotify_rejected', status: response.status })
      return null
    }

    const data = (await response.json()) as { id: string }
    return data.id
  } catch (err) {
    log('auth_failed', { reason: 'spotify_error', error: String(err) })
    return null
  }
}

function buildKVKey(userId: string): string {
  return `${KV_KEY_PREFIX}${hashUserIdForKey(userId)}`
}

// Legacy key format for migration (pre-encryption)
function buildLegacyKVKey(userId: string): string {
  return `${KV_KEY_PREFIX}${userId}`
}

async function handleGetScenes(env: Env, userId: string): Promise<Response> {
  const userHash = hashUserIdForKey(userId)
  const kvKey = buildKVKey(userId)
  let stored = await env.FAVSCENE_USER_SCENES.get(kvKey)
  let usedLegacyKey = false

  // Migration: check legacy key if new key not found
  if (!stored) {
    const legacyKey = buildLegacyKVKey(userId)
    stored = await env.FAVSCENE_USER_SCENES.get(legacyKey)
    usedLegacyKey = !!stored
  }

  if (!stored) {
    log('scenes_get', { userHash, sceneCount: 0 })
    return jsonResponse({ scenes: [] })
  }

  try {
    // Handle both encrypted and legacy plaintext data
    const jsonString = isEncrypted(stored) ? decrypt(stored, userId) : stored
    const payload = JSON.parse(jsonString) as ScenesPayload
    log('scenes_get', { userHash, sceneCount: payload.scenes.length, usedLegacyKey })
    return jsonResponse(payload)
  } catch (err) {
    // Decryption or parse failure - data corrupted or wrong key
    log('scenes_get_error', { userHash, error: String(err) })
    return jsonResponse({ scenes: [] })
  }
}

async function handlePutScenes(env: Env, userId: string, request: Request): Promise<Response> {
  // Defense-in-depth: check content-length header before reading body
  const contentLength = request.headers.get('content-length')
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
    return jsonResponse({ error: 'Payload too large. Maximum 50KB allowed.' }, HTTP_PAYLOAD_TOO_LARGE)
  }

  let body: string
  try {
    body = await request.text()
  } catch {
    return jsonResponse({ error: 'Failed to read request body' }, HTTP_BAD_REQUEST)
  }

  // Second check: content-length can be spoofed, verify actual size
  if (body.length > MAX_BODY_SIZE) {
    return jsonResponse({ error: 'Payload too large. Maximum 50KB allowed.' }, HTTP_PAYLOAD_TOO_LARGE)
  }

  let payload: ScenesPayload
  try {
    payload = JSON.parse(body) as ScenesPayload
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, HTTP_BAD_REQUEST)
  }

  if (!payload.scenes || !Array.isArray(payload.scenes)) {
    return jsonResponse({ error: 'Invalid payload structure' }, HTTP_BAD_REQUEST)
  }

  if (payload.scenes.length > MAX_SCENES) {
    return jsonResponse({ error: `Maximum ${MAX_SCENES} scenes allowed` }, HTTP_BAD_REQUEST)
  }

  const userHash = hashUserIdForKey(userId)
  const kvKey = buildKVKey(userId)
  try {
    const encrypted = encrypt(JSON.stringify(payload), userId)
    await env.FAVSCENE_USER_SCENES.put(kvKey, encrypted)
    log('scenes_put', { userHash, sceneCount: payload.scenes.length })
    return jsonResponse({ ok: true })
  } catch (err) {
    log('scenes_put_error', { userHash, error: String(err) })
    return jsonResponse({ error: 'Failed to save scenes' }, HTTP_INTERNAL_ERROR)
  }
}

async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)

  // Only handle /api/* routes - pass everything else to static assets
  if (!url.pathname.startsWith('/api/')) {
    return env.ASSETS.fetch(request)
  }

  // CORS preflight must be handled before HTTPS redirect
  // (browsers reject redirects for preflight requests per CORS spec)
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: HTTP_OK,
      headers: CORS_HEADERS,
    })
  }

  // Enforce HTTPS for API routes (skip in dev where Wrangler runs on HTTP)
  if (url.protocol === 'http:' && url.hostname !== 'localhost') {
    url.protocol = 'https:'
    return Response.redirect(url.toString(), HTTP_MOVED_PERMANENTLY)
  }

  if (url.pathname === '/api/scenes') {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith(BEARER_PREFIX)) {
      log('auth_failed', { reason: 'missing_header' })
      return jsonResponse({ error: 'Missing or invalid Authorization header' }, HTTP_UNAUTHORIZED)
    }

    const token = authHeader.slice(BEARER_PREFIX_LENGTH)

    // Derive user_id from token - prevents cross-user data access
    const userId = await validateSpotifyToken(token)

    if (!userId) {
      return jsonResponse({ error: 'Invalid or expired token' }, HTTP_UNAUTHORIZED)
    }

    log('auth_success', { userHash: hashUserIdForKey(userId) })

    if (request.method === 'GET') {
      return handleGetScenes(env, userId)
    }

    if (request.method === 'PUT') {
      return handlePutScenes(env, userId, request)
    }

    return jsonResponse({ error: 'Method not allowed' }, HTTP_METHOD_NOT_ALLOWED)
  }

  return jsonResponse({ error: 'Not found' }, HTTP_NOT_FOUND)
}

function jsonResponse(data: unknown, status = HTTP_OK): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
  })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await handleRequest(request, env)
    } catch (error) {
      console.error('Worker error:', error)
      return jsonResponse({ error: 'Internal server error' }, HTTP_INTERNAL_ERROR)
    }
  },
}
