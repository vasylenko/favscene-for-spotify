<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSpotifyAuth } from '@/composables/useSpotifyAuth'
import { useScenes } from '@/composables/useScenes'
import { startPlayback, getAvailableDevices, setVolume } from '@/services/spotify'
import { validateConfig } from '@/config'
import { DEFAULT_VOLUME } from '@/types'
import type { Scene, SpotifyDevice } from '@/types'

const router = useRouter()
const { isAuthenticated, initiateLogin, user, isLoading: authLoading } = useSpotifyAuth()
const { scenes, deleteScene } = useScenes()

// Edit/Delete menu state
const actionMenuScene = ref<Scene | null>(null)
const deleteConfirmScene = ref<Scene | null>(null)

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

function executeDelete() {
  if (deleteConfirmScene.value) {
    deleteScene(deleteConfirmScene.value.id)
    deleteConfirmScene.value = null
  }
}

const configValid = validateConfig()
const playingSceneId = ref<string | null>(null)
const errorMessage = ref<string | null>(null)
const showDevicePicker = ref(false)
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
    // Device not available, show device picker
    pendingScene.value = scene
    try {
      availableDevices.value = await getAvailableDevices()
      if (availableDevices.value.length === 0) {
        errorMessage.value = 'No devices available. Open Spotify on a device first.'
        playingSceneId.value = null
      } else {
        showDevicePicker.value = true
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

  showDevicePicker.value = false
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
  showDevicePicker.value = false
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
        <p class="text-spotify-gray text-sm">See <code class="bg-gray-800 px-1 rounded">.env.example</code> for format.</p>
      </div>
    </div>

    <!-- Not authenticated -->
    <div v-else-if="!isAuthenticated" class="flex items-center justify-center min-h-screen">
      <div class="text-center space-y-6 max-w-md">
        <h1 class="text-3xl font-bold">FavScene for Spotify</h1>
        <p class="text-spotify-gray">
          One-tap launcher for your favorite playlists on preferred devices.
        </p>
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
      <header class="flex items-center justify-between mb-6">
        <h1 class="text-xl font-bold">Your Spotify Scenes</h1>
        <div class="flex items-center gap-3">
          <span class="text-spotify-gray text-sm">{{ user?.displayName }}</span>
          <button
            class="px-4 py-2 bg-spotify-green text-black font-semibold rounded-full text-sm hover:scale-105 transition-transform"
            @click="router.push('/create')"
          >
            + New Scene
          </button>
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

      <!-- Empty state -->
      <div v-if="scenes.length === 0" class="flex flex-col items-center justify-center py-20 text-center">
        <p class="text-spotify-gray mb-4">No favorite scenes yet. Create your first one!</p>
        <button
          class="px-6 py-3 bg-spotify-green text-black font-semibold rounded-full hover:scale-105 transition-transform"
          @click="router.push('/create')"
        >
          Create First Scene
        </button>
      </div>

      <!-- Scene grid -->
      <div v-else class="grid grid-cols-2 gap-4 max-w-lg mx-auto">
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
            <div class="bg-spotify-green text-black px-4 py-2 rounded-full font-semibold">
              Playing!
            </div>
          </div>
        </div>
      </div>

      <!-- Help text -->
      <div v-if="scenes.length > 0" class="text-center text-sm text-spotify-gray mt-6 space-y-1">
        <p>Tap the scene picture to play</p>
        <p>Tap ⋮ (three dots icon) to edit or delete the scene</p>
      </div>
    </div>

    <!-- Device picker modal -->
    <div
      v-if="showDevicePicker"
      class="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
      @click.self="cancelDevicePicker"
    >
      <div class="bg-gray-900 rounded-xl p-6 max-w-sm w-full">
        <h2 class="text-lg font-semibold mb-2">Device Unavailable</h2>
        <p class="text-spotify-gray text-sm mb-4">
          Select another device to play on:
        </p>
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
        <p class="text-spotify-gray text-sm mb-6">
          This cannot be undone.
        </p>
        <div class="flex gap-3">
          <button
            class="flex-1 p-3 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
            @click="cancelDelete"
          >
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
