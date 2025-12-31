<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSpotifyAuth } from '@/composables/useSpotifyAuth'
import { useScenes } from '@/composables/useScenes'
import { startPlayback, getAvailableDevices, setVolume } from '@/services/spotify'
import { validateConfig } from '@/config'
import { DEFAULT_VOLUME } from '@/types'
import type { Scene, SpotifyDevice } from '@/types'

const router = useRouter()
const { isAuthenticated, initiateLogin, clearAuth, user, isLoading: authLoading, validateSession } = useSpotifyAuth()
const { scenes, isLoading: scenesLoading, syncError, initializeScenes, deleteScene, clearScenes } = useScenes()

function logout() {
  isUserMenuOpen.value = false
  clearScenes()
  clearAuth()
}

// Validate session and fetch scenes from API on mount
onMounted(async () => {
  if (isAuthenticated.value) {
    const isValid = await validateSession()
    if (isValid) {
      await initializeScenes()
    }
  }
})

const actionMenuScene = ref<Scene | null>(null)
const deleteConfirmScene = ref<Scene | null>(null)
const isUserMenuOpen = ref(false)
const userMenuRef = ref<HTMLElement | null>(null)

function handleClickOutside(event: MouseEvent) {
  if (userMenuRef.value && !userMenuRef.value.contains(event.target as Node)) {
    isUserMenuOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

function openActionMenu(scene: Scene) {
  actionMenuScene.value = scene
}

function closeActionMenu() {
  actionMenuScene.value = null
}

function editScene(scene: Scene) {
  closeActionMenu()
  router.push(`/edit/${scene.id}`)
}

function confirmDelete(scene: Scene) {
  closeActionMenu()
  deleteConfirmScene.value = scene
}

function cancelDelete() {
  deleteConfirmScene.value = null
}

async function executeDelete() {
  if (deleteConfirmScene.value) {
    await deleteScene(deleteConfirmScene.value.id)
    deleteConfirmScene.value = null
  }
}

const configValid = validateConfig()
const playingSceneId = ref<string | null>(null)
const errorMessage = ref<string | null>(null)
const isDevicePickerOpen = ref(false)
const availableDevices = ref<SpotifyDevice[]>([])
const pendingScene = ref<Scene | null>(null)

const PLAYING_FEEDBACK_MS = 2000

async function handlePlaybackSuccess(volume: number, deviceId: string, onComplete?: () => void) {
  await setVolume(volume, deviceId)
  setTimeout(() => {
    playingSceneId.value = null
    onComplete?.()
  }, PLAYING_FEEDBACK_MS)
}

async function playScene(scene: Scene) {
  errorMessage.value = null
  playingSceneId.value = scene.id

  const result = await startPlayback(scene.playlist.uri, scene.device.id)

  if (result.success) {
    await handlePlaybackSuccess(scene.volume ?? DEFAULT_VOLUME, scene.device.id)
  } else if (result.error?.includes('not found') || result.error?.includes('offline')) {
    // Saved device went offline - offer alternative devices instead of failing
    pendingScene.value = scene
    try {
      availableDevices.value = await getAvailableDevices()
      if (availableDevices.value.length === 0) {
        errorMessage.value = 'No devices available. Open Spotify on a device first.'
        playingSceneId.value = null
      } else {
        isDevicePickerOpen.value = true
      }
    } catch {
      errorMessage.value = 'Failed to fetch devices'
      playingSceneId.value = null
    }
  } else {
    errorMessage.value = result.error || 'Playback failed'
    playingSceneId.value = null
  }
}

async function playOnDevice(device: SpotifyDevice) {
  if (!pendingScene.value) return

  isDevicePickerOpen.value = false
  const scene = pendingScene.value
  const result = await startPlayback(scene.playlist.uri, device.id)

  if (result.success) {
    await handlePlaybackSuccess(scene.volume ?? DEFAULT_VOLUME, device.id, () => {
      pendingScene.value = null
    })
  } else {
    errorMessage.value = result.error || 'Playback failed'
    playingSceneId.value = null
    pendingScene.value = null
  }
}

function cancelDevicePicker() {
  isDevicePickerOpen.value = false
  playingSceneId.value = null
  pendingScene.value = null
}
</script>

<template>
  <div class="min-h-screen p-4">
    <!-- Config error -->
    <div v-if="!configValid" class="flex items-center justify-center min-h-screen">
      <div class="text-center space-y-4 max-w-md">
        <div class="text-red-500 text-xl">Configuration Error</div>
        <p class="text-spotify-gray">
          Missing Spotify client ID. Create a <code class="bg-gray-800 px-1 rounded">.env</code> file with your
          credentials.
        </p>
        <p class="text-spotify-gray text-sm">
          See <code class="bg-gray-800 px-1 rounded">.env.example</code> for format.
        </p>
      </div>
    </div>

    <!-- Not authenticated -->
    <div v-else-if="!isAuthenticated" class="flex items-center justify-center min-h-screen">
      <div class="text-center space-y-6 max-w-md">
        <h1 class="text-3xl font-bold">FavScene for Spotify</h1>
        <p class="text-spotify-gray">One-tap launcher for your favorite playlists on preferred devices.</p>
        <button
          class="px-8 py-3 bg-spotify-green text-black font-semibold rounded-full hover:scale-105 transition-transform disabled:opacity-50"
          :disabled="authLoading"
          @click="initiateLogin"
        >
          Connect to Spotify
        </button>
      </div>
    </div>

    <!-- Authenticated -->
    <div v-else>
      <!-- Header -->
      <header class="flex items-center justify-between mb-6 max-w-5xl mx-auto">
        <h1 class="text-lg font-medium text-spotify-gray">FavScene</h1>
        <div ref="userMenuRef" class="relative">
          <button
            class="flex items-center gap-2 text-sm text-spotify-gray hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-white/5"
            @click.stop="isUserMenuOpen = !isUserMenuOpen"
          >
            <span>{{ user?.displayName }}</span>
            <span class="text-xs">▾</span>
          </button>
          <!-- User dropdown -->
          <div
            v-if="isUserMenuOpen"
            class="absolute right-0 top-full mt-1 bg-gray-800 rounded-lg shadow-xl py-1 min-w-32 z-50"
          >
            <button
              class="w-full px-4 py-2 text-left text-sm text-spotify-gray hover:text-white hover:bg-white/5 transition-colors"
              @click="logout()"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <!-- Error message -->
      <div
        v-if="errorMessage"
        class="mb-4 p-3 bg-red-900/30 border border-red-500 rounded-lg text-red-300 flex items-center justify-between"
      >
        <span>{{ errorMessage }}</span>
        <button class="text-red-300 hover:text-white" @click="errorMessage = null">&times;</button>
      </div>

      <!-- Sync error message -->
      <div
        v-if="syncError"
        class="mb-4 p-3 bg-yellow-900/30 border border-yellow-500 rounded-lg text-yellow-300 flex items-center justify-between"
      >
        <div class="flex-1">
          <div class="font-semibold">Sync Warning</div>
          <div class="text-sm">{{ syncError }}</div>
          <div class="text-xs mt-1 text-yellow-400">
            Changes are saved locally. Please check your connection and try again later.
          </div>
        </div>
        <button class="text-yellow-300 hover:text-white ml-3" @click="syncError = null">&times;</button>
      </div>

      <!-- Loading state -->
      <div v-if="scenesLoading" class="flex flex-col items-center justify-center py-20 text-center">
        <div
          class="w-12 h-12 border-4 border-spotify-green border-t-transparent rounded-full animate-spin mx-auto mb-4"
        />
        <p class="text-spotify-gray">Loading your scenes...</p>
      </div>

      <!-- Scene grid (always shown, includes + card) -->
      <div
        v-else
        class="grid gap-4 mx-auto"
        :class="
          scenes.length === 0
            ? 'grid-cols-1 max-w-48 min-h-[70vh] place-content-center'
            : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 max-w-5xl'
        "
      >
        <!-- Scene cards -->
        <div
          v-for="scene in scenes"
          :key="scene.id"
          role="button"
          tabindex="0"
          class="relative aspect-square rounded-xl overflow-hidden bg-gray-800 hover:scale-102 transition-transform active:scale-98 cursor-pointer"
          @click="playScene(scene)"
          @keydown.enter="playScene(scene)"
          @keydown.space.prevent="playScene(scene)"
        >
          <!-- Playlist image -->
          <img
            v-if="scene.playlist.imageUrl"
            :src="scene.playlist.imageUrl"
            :alt="scene.name"
            class="absolute inset-0 w-full h-full object-cover"
          />
          <div v-else class="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-900" />

          <!-- Overlay gradient -->
          <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

          <!-- Edit button -->
          <button
            class="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full bg-gray-900 text-white hover:bg-black/60 transition-colors text-white/70 hover:text-white"
            @click.stop="openActionMenu(scene)"
          >
            <span class="text-lg leading-none">&#8942;</span>
          </button>

          <!-- Scene info -->
          <div class="absolute bottom-0 left-0 right-0 p-3">
            <div class="font-semibold truncate">{{ scene.name }}</div>
            <div class="text-xs text-spotify-gray truncate">{{ scene.device.name }}</div>
          </div>

          <!-- Playing indicator -->
          <div
            v-if="playingSceneId === scene.id"
            class="absolute inset-0 bg-spotify-green/20 flex items-center justify-center"
          >
            <div class="bg-spotify-green text-black px-4 py-2 rounded-full font-semibold">Playing!</div>
          </div>
        </div>

        <!-- Add new scene card -->
        <button
          class="aspect-square rounded-xl border-2 border-dashed border-gray-700 hover:border-spotify-green flex flex-col items-center justify-center gap-2 transition-all hover:scale-102 active:scale-98 group"
          @click="router.push('/create')"
        >
          <span class="text-4xl text-gray-600 group-hover:text-spotify-green transition-colors">+</span>
          <span class="text-sm text-gray-600 group-hover:text-spotify-green transition-colors">New Scene</span>
        </button>
      </div>
    </div>

    <!-- Device picker modal -->
    <div
      v-if="isDevicePickerOpen"
      class="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
      @click.self="cancelDevicePicker"
    >
      <div class="bg-gray-900 rounded-xl p-6 max-w-sm w-full">
        <h2 class="text-lg font-semibold mb-2">Device Unavailable</h2>
        <p class="text-spotify-gray text-sm mb-4">Select another device to play on:</p>
        <div class="space-y-2">
          <button
            v-for="device in availableDevices"
            :key="device.id"
            class="w-full p-3 bg-gray-800 rounded-lg text-left hover:bg-gray-700 transition-colors"
            @click="playOnDevice(device)"
          >
            <div class="font-medium">{{ device.name }}</div>
            <div class="text-xs text-spotify-gray capitalize">{{ device.type }}</div>
          </button>
        </div>
        <button
          class="w-full mt-4 p-2 text-spotify-gray hover:text-white transition-colors"
          @click="cancelDevicePicker"
        >
          Cancel
        </button>
      </div>
    </div>

    <!-- Action menu modal -->
    <div
      v-if="actionMenuScene"
      class="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
      @click.self="closeActionMenu"
    >
      <div class="bg-gray-900 rounded-xl p-2 max-w-xs w-full">
        <button
          class="w-full p-4 text-left hover:bg-gray-800 rounded-lg transition-colors flex items-center gap-3"
          @click="editScene(actionMenuScene)"
        >
          <span>&#9998;</span>
          <span>Edit</span>
        </button>
        <button
          class="w-full p-4 text-left hover:bg-gray-800 rounded-lg transition-colors flex items-center gap-3 text-red-400"
          @click="confirmDelete(actionMenuScene)"
        >
          <span>&#128465;</span>
          <span>Delete</span>
        </button>
        <div class="border-t border-gray-700 my-2" />
        <button
          class="w-full p-4 text-center text-spotify-gray hover:text-white transition-colors rounded-lg"
          @click="closeActionMenu"
        >
          Cancel
        </button>
      </div>
    </div>

    <!-- Delete confirmation dialog -->
    <div
      v-if="deleteConfirmScene"
      class="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
      @click.self="cancelDelete"
    >
      <div class="bg-gray-900 rounded-xl p-6 max-w-sm w-full">
        <h2 class="text-lg font-semibold mb-2">Delete "{{ deleteConfirmScene.name }}"?</h2>
        <p class="text-spotify-gray text-sm mb-6">This cannot be undone.</p>
        <div class="flex gap-3">
          <button class="flex-1 p-3 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors" @click="cancelDelete">
            Cancel
          </button>
          <button
            class="flex-1 p-3 bg-red-600 rounded-lg hover:bg-red-500 transition-colors font-semibold"
            @click="executeDelete"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
