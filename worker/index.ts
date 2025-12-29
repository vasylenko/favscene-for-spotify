/**
 * FavScene for Spotify - Cloudflare Worker
 *
 * Provides scene sync across browsers via KV storage.
 * Authentication: Validates Spotify access tokens, no token storage.
 * Access control: Users can only access their own scenes (keyed by Spotify user ID).
 */

interface Env {
  SCENES_KV: KVNamespace
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

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
}

const MAX_BODY_SIZE = 50 * 1024 // 50KB limit
const MAX_SCENES = 50 // Max scenes per user

/**
 * Validates Spotify access token and returns user ID
 */
async function validateSpotifyToken(token: string): Promise<string | null> {
  try {
    const response = await fetch('https://api.spotify.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json() as { id: string }
    return data.id
  } catch {
    return null
  }
}

/**
 * Builds KV key for user's scenes
 */
function buildKVKey(userId: string): string {
  return `scenes:${userId}`
}

/**
 * Handles GET /api/scenes - Fetch user's scenes
 */
async function handleGetScenes(env: Env, userId: string): Promise<Response> {
  const kvKey = buildKVKey(userId)
  const stored = await env.SCENES_KV.get(kvKey)

  if (!stored) {
    return jsonResponse({ scenes: [] })
  }

  try {
    const payload = JSON.parse(stored) as ScenesPayload
    return jsonResponse(payload)
  } catch {
    // Corrupted data, return empty
    return jsonResponse({ scenes: [] })
  }
}

/**
 * Handles PUT /api/scenes - Save user's scenes
 */
async function handlePutScenes(
  env: Env,
  userId: string,
  request: Request
): Promise<Response> {
  // Check body size before reading
  const contentLength = request.headers.get('content-length')
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
    return jsonResponse(
      { error: 'Payload too large. Maximum 50KB allowed.' },
      413
    )
  }

  let body: string
  try {
    body = await request.text()
  } catch {
    return jsonResponse({ error: 'Failed to read request body' }, 400)
  }

  // Additional size check after reading
  if (body.length > MAX_BODY_SIZE) {
    return jsonResponse(
      { error: 'Payload too large. Maximum 50KB allowed.' },
      413
    )
  }

  // Parse and validate payload
  let payload: ScenesPayload
  try {
    payload = JSON.parse(body) as ScenesPayload
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  if (!payload.scenes || !Array.isArray(payload.scenes)) {
    return jsonResponse({ error: 'Invalid payload structure' }, 400)
  }

  if (payload.scenes.length > MAX_SCENES) {
    return jsonResponse(
      { error: `Maximum ${MAX_SCENES} scenes allowed` },
      400
    )
  }

  // Save to KV
  const kvKey = buildKVKey(userId)
  try {
    await env.SCENES_KV.put(kvKey, JSON.stringify(payload))
    return jsonResponse({ ok: true })
  } catch {
    return jsonResponse({ error: 'Failed to save scenes' }, 500)
  }
}

/**
 * Main request handler
 */
async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: CORS_HEADERS,
    })
  }

  // Handle API routes
  if (url.pathname === '/api/scenes') {
    // Extract and validate token
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Missing or invalid Authorization header' }, 401)
    }

    const token = authHeader.slice(7) // Remove 'Bearer ' prefix
    const userId = await validateSpotifyToken(token)

    if (!userId) {
      return jsonResponse({ error: 'Invalid or expired token' }, 401)
    }

    // Route by method
    if (request.method === 'GET') {
      return handleGetScenes(env, userId)
    }

    if (request.method === 'PUT') {
      return handlePutScenes(env, userId, request)
    }

    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  // Not an API route - return 404
  return jsonResponse({ error: 'Not found' }, 404)
}

/**
 * Helper to create JSON responses with CORS headers
 */
function jsonResponse(data: unknown, status = 200): Response {
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
      return jsonResponse(
        { error: 'Internal server error' },
        500
      )
    }
  },
}
