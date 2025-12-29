import { ref } from 'vue'
import { fetchScenes as apiFetchScenes, saveScenes as apiSaveScenes } from '@/services/api'
import { logger } from '@/utils/logger'
import type { Scene } from '@/types'

const STORAGE_KEY = 'favscene_spotify_data'

const scenes = ref<Scene[]>([])
const isLoading = ref(false)
const syncError = ref<string | null>(null)

/**
 * Loads scenes from localStorage cache
 */
function loadFromLocalStorage(): Scene[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

/**
 * Saves scenes to localStorage cache
 */
function saveToLocalStorage(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scenes.value))
  } catch (error) {
    logger.error('Failed to save to localStorage:', error)
  }
}

/**
 * Syncs scenes to API backend
 */
async function syncToApi(): Promise<void> {
  syncError.value = null
  const result = await apiSaveScenes(scenes.value)

  if (!result.success) {
    syncError.value = result.error || 'Failed to sync scenes'
    logger.error('Scene sync failed:', result.error)

    if (result.needsReauth) {
      // Token expired - user will be redirected to login by the app
      logger.warn('Session expired, reauth needed')
    }
  }
}

/**
 * Initializes scenes by fetching from API
 * Should be called after successful authentication
 */
async function initializeScenes(): Promise<void> {
  isLoading.value = true
  syncError.value = null

  const result = await apiFetchScenes()

  if (result.success && result.data) {
    scenes.value = result.data
    saveToLocalStorage()
  } else {
    syncError.value = result.error || 'Failed to load scenes'
    logger.warn('Failed to fetch scenes from API, using local cache:', result.error)
    // Fallback to localStorage cache
    scenes.value = loadFromLocalStorage()
  }

  isLoading.value = false
}

/**
 * Clears all scenes (useful for logout)
 */
function clearScenes(): void {
  scenes.value = []
  saveToLocalStorage()
}

function generateId(): string {
  return crypto.randomUUID()
}

function addScene(scene: Omit<Scene, 'id'>): Scene {
  const newScene: Scene = {
    ...scene,
    id: generateId(),
  }
  scenes.value.push(newScene)
  saveToLocalStorage()
  syncToApi() // Fire and forget - errors shown via syncError state
  return newScene
}

function getScene(id: string): Scene | undefined {
  return scenes.value.find((s) => s.id === id)
}

function updateScene(id: string, updates: Partial<Omit<Scene, 'id'>>): boolean {
  const index = scenes.value.findIndex((s) => s.id === id)
  if (index === -1) return false

  scenes.value[index] = { ...scenes.value[index], ...updates }
  saveToLocalStorage()
  syncToApi() // Fire and forget
  return true
}

function deleteScene(id: string): boolean {
  const initialLength = scenes.value.length
  scenes.value = scenes.value.filter((s) => s.id !== id)
  if (scenes.value.length !== initialLength) {
    saveToLocalStorage()
    syncToApi() // Fire and forget
    return true
  }
  return false
}

export function useScenes() {
  return {
    scenes,
    isLoading,
    syncError,
    initializeScenes,
    clearScenes,
    addScene,
    getScene,
    updateScene,
    deleteScene,
  }
}
