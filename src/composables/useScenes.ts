import { ref } from 'vue'
import { fetchScenes as apiFetchScenes, saveScenes as apiSaveScenes } from '@/services/api'
import { logger } from '@/utils/logger'
import type { Scene } from '@/types'

const scenes = ref<Scene[]>([])
const isLoading = ref(false)
const syncError = ref<string | null>(null)

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
  } else {
    syncError.value = result.error || 'Failed to load scenes'
    logger.warn('Failed to fetch scenes from API:', result.error)
  }

  isLoading.value = false
}

/**
 * Clears all scenes (useful for logout)
 */
function clearScenes(): void {
  scenes.value = []
}

function generateId(): string {
  return crypto.randomUUID()
}

async function addScene(scene: Omit<Scene, 'id'>): Promise<Scene> {
  const newScene: Scene = {
    ...scene,
    id: generateId(),
  }
  scenes.value.push(newScene)
  await syncToApi()
  return newScene
}

function getScene(id: string): Scene | undefined {
  return scenes.value.find((s) => s.id === id)
}

async function updateScene(id: string, updates: Partial<Omit<Scene, 'id'>>): Promise<boolean> {
  const index = scenes.value.findIndex((s) => s.id === id)
  if (index === -1) return false

  scenes.value[index] = { ...scenes.value[index], ...updates }
  await syncToApi()
  return true
}

async function deleteScene(id: string): Promise<boolean> {
  const initialLength = scenes.value.length
  scenes.value = scenes.value.filter((s) => s.id !== id)
  if (scenes.value.length !== initialLength) {
    await syncToApi()
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
