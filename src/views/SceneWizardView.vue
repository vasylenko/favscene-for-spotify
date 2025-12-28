<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { getUserPlaylists, getAvailableDevices } from '@/services/spotify'
import { useScenes } from '@/composables/useScenes'
import { DEFAULT_VOLUME } from '@/types'
import type { SpotifyPlaylist, SpotifyDevice } from '@/types'

const router = useRouter()
const route = useRoute()
const { addScene, getScene, updateScene } = useScenes()

// Edit mode detection
const isEditMode = computed(() => route.path.startsWith('/edit/'))
const sceneId = computed(() => (isEditMode.value ? (route.params.id as string) : null))

type WizardStep = 'playlist' | 'device' | 'name'

const currentStep = ref<WizardStep>('playlist')
const isLoading = ref(false)
const error = ref<string | null>(null)

// Data
const playlists = ref<SpotifyPlaylist[]>([])
const devices = ref<SpotifyDevice[]>([])
const playlistSearch = ref('')

// Selections
const selectedPlaylist = ref<SpotifyPlaylist | null>(null)
const selectedDevice = ref<SpotifyDevice | null>(null)
const sceneName = ref('')
const sceneVolume = ref(DEFAULT_VOLUME)

const filteredPlaylists = computed(() => {
  if (!playlistSearch.value) return playlists.value
  const search = playlistSearch.value.toLowerCase()
  return playlists.value.filter((p) => p.name.toLowerCase().includes(search))
})

const canSave = computed(() => {
  return selectedPlaylist.value && selectedDevice.value && sceneName.value.trim()
})

onMounted(async () => {
  // In edit mode, load existing scene data
  if (isEditMode.value && sceneId.value) {
    const scene = getScene(sceneId.value)
    if (!scene) {
      // Scene no longer exists, redirect to home
      router.push('/')
      return
    }
    // Pre-fill wizard state with scene data
    selectedPlaylist.value = {
      id: scene.playlist.id,
      name: scene.playlist.name,
      uri: scene.playlist.uri,
      imageUrl: scene.playlist.imageUrl,
    }
    selectedDevice.value = {
      id: scene.device.id,
      name: scene.device.name,
      type: scene.device.type,
      is_active: false,
    }
    sceneName.value = scene.name
    sceneVolume.value = scene.volume ?? DEFAULT_VOLUME
  }
  await loadPlaylists()
})

async function loadPlaylists() {
  isLoading.value = true
  error.value = null
  try {
    playlists.value = await getUserPlaylists()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load playlists'
  } finally {
    isLoading.value = false
  }
}

async function loadDevices() {
  isLoading.value = true
  error.value = null
  try {
    devices.value = await getAvailableDevices()
    if (devices.value.length === 0) {
      error.value = 'No devices found. Open Spotify on a device first.'
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load devices'
  } finally {
    isLoading.value = false
  }
}

function selectPlaylist(playlist: SpotifyPlaylist) {
  selectedPlaylist.value = playlist
  currentStep.value = 'device'
  loadDevices()
}

function selectDevice(device: SpotifyDevice) {
  selectedDevice.value = device
  // Default scene name to playlist name (only in create mode or if name is empty)
  if (!isEditMode.value || !sceneName.value) {
    sceneName.value = selectedPlaylist.value?.name || ''
  }
  currentStep.value = 'name'
}

function goBack() {
  if (currentStep.value === 'device') {
    currentStep.value = 'playlist'
    selectedPlaylist.value = null
  } else if (currentStep.value === 'name') {
    currentStep.value = 'device'
    selectedDevice.value = null
  }
}

function saveScene() {
  if (!selectedPlaylist.value || !selectedDevice.value || !sceneName.value.trim()) {
    return
  }

  const sceneData = {
    name: sceneName.value.trim(),
    volume: sceneVolume.value,
    playlist: {
      id: selectedPlaylist.value.id,
      name: selectedPlaylist.value.name,
      uri: selectedPlaylist.value.uri,
      imageUrl: selectedPlaylist.value.imageUrl,
    },
    device: {
      id: selectedDevice.value.id,
      name: selectedDevice.value.name,
      type: selectedDevice.value.type,
    },
  }

  if (isEditMode.value && sceneId.value) {
    updateScene(sceneId.value, sceneData)
  } else {
    addScene(sceneData)
  }

  router.push('/')
}
</script>

<template>
  <div class="min-h-screen p-4">
    <!-- Header -->
    <header class="flex items-center gap-4 mb-6">
      <button
        class="p-2 hover:bg-gray-800 rounded-lg transition-colors"
        @click="currentStep === 'playlist' ? router.push('/') : goBack()"
      >
        <span class="text-xl">&larr;</span>
      </button>
      <h1 class="text-xl font-bold">{{ isEditMode ? 'Edit Scene' : 'Create Scene' }}</h1>
    </header>

    <!-- Progress indicator -->
    <div class="flex items-center gap-2 mb-6 max-w-lg mx-auto">
      <div
        class="flex-1 h-1 rounded-full"
        :class="currentStep === 'playlist' ? 'bg-spotify-green' : 'bg-gray-700'"
      />
      <div
        class="flex-1 h-1 rounded-full"
        :class="currentStep === 'device' ? 'bg-spotify-green' : currentStep === 'name' ? 'bg-gray-700' : 'bg-gray-700'"
        :style="{ background: currentStep !== 'playlist' ? '#1DB954' : undefined }"
      />
      <div
        class="flex-1 h-1 rounded-full"
        :class="currentStep === 'name' ? 'bg-spotify-green' : 'bg-gray-700'"
      />
    </div>

    <!-- Loading state -->
    <div v-if="isLoading" class="flex items-center justify-center py-20">
      <div class="w-10 h-10 border-4 border-spotify-green border-t-transparent rounded-full animate-spin" />
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="max-w-lg mx-auto">
      <div class="p-4 bg-red-900/30 border border-red-500 rounded-lg text-red-300 mb-4">
        {{ error }}
      </div>
      <button
        class="px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
        @click="currentStep === 'playlist' ? loadPlaylists() : loadDevices()"
      >
        Retry
      </button>
    </div>

    <!-- Step 1: Select Playlist -->
    <div v-else-if="currentStep === 'playlist'" class="max-w-lg mx-auto">
      <h2 class="text-lg text-spotify-gray mb-4">Select a playlist</h2>

      <!-- Search -->
      <input
        v-model="playlistSearch"
        type="text"
        placeholder="Search playlists..."
        class="w-full p-3 bg-gray-800 rounded-lg mb-4 outline-none focus:ring-2 focus:ring-spotify-green"
      />

      <!-- Playlist list -->
      <div class="space-y-2 max-h-[60vh] overflow-y-auto">
        <button
          v-for="playlist in filteredPlaylists"
          :key="playlist.id"
          class="w-full flex items-center gap-3 p-3 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
          @click="selectPlaylist(playlist)"
        >
          <img
            v-if="playlist.imageUrl"
            :src="playlist.imageUrl"
            :alt="playlist.name"
            class="w-12 h-12 rounded object-cover"
          />
          <div v-else class="w-12 h-12 rounded bg-gray-700" />
          <span class="truncate">{{ playlist.name }}</span>
        </button>
      </div>

      <p v-if="filteredPlaylists.length === 0" class="text-spotify-gray text-center py-8">
        No playlists found
      </p>
    </div>

    <!-- Step 2: Select Device -->
    <div v-else-if="currentStep === 'device'" class="max-w-lg mx-auto">
      <h2 class="text-lg text-spotify-gray mb-4">Select a device</h2>

      <!-- Selected playlist preview -->
      <div class="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg mb-4">
        <img
          v-if="selectedPlaylist?.imageUrl"
          :src="selectedPlaylist.imageUrl"
          :alt="selectedPlaylist.name"
          class="w-10 h-10 rounded"
        />
        <div v-else class="w-10 h-10 rounded bg-gray-700" />
        <span class="text-sm truncate">{{ selectedPlaylist?.name }}</span>
      </div>

      <!-- Device list -->
      <div class="space-y-2">
        <button
          v-for="device in devices"
          :key="device.id"
          class="w-full flex items-center gap-3 p-4 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
          @click="selectDevice(device)"
        >
          <div class="flex-1 text-left">
            <div class="font-medium">{{ device.name }}</div>
            <div class="text-xs text-spotify-gray capitalize">{{ device.type }}</div>
          </div>
          <div v-if="device.is_active" class="w-2 h-2 rounded-full bg-spotify-green" title="Active" />
        </button>
      </div>

      <p v-if="devices.length === 0 && !error" class="text-spotify-gray text-center py-8">
        No devices available
      </p>

      <button
        class="w-full mt-4 p-3 text-spotify-gray hover:text-white transition-colors border border-spotify-gray rounded-lg"
        @click="loadDevices"
      >
        Refresh devices
      </button>

      <p class="w-full mt-4 p-3 text-spotify-gray text-center">
        Don't see your device? Open Spotify on it first and play something briefly.
      </p>
    </div>

    <!-- Step 3: Name the Scene -->
    <div v-else-if="currentStep === 'name'" class="max-w-lg mx-auto">
      <h2 class="text-lg text-spotify-gray mb-4">Name your scene</h2>

      <!-- Preview -->
      <div class="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg mb-4">
        <img
          v-if="selectedPlaylist?.imageUrl"
          :src="selectedPlaylist.imageUrl"
          :alt="selectedPlaylist.name"
          class="w-10 h-10 rounded"
        />
        <div v-else class="w-10 h-10 rounded bg-gray-700" />
        <div class="flex-1 min-w-0">
          <div class="text-sm truncate">{{ selectedPlaylist?.name }}</div>
          <div class="text-xs text-spotify-gray truncate">on {{ selectedDevice?.name }}</div>
        </div>
      </div>

      <!-- Name input -->
      <input
        v-model="sceneName"
        type="text"
        placeholder="Scene name"
        class="w-full p-4 bg-gray-800 rounded-lg mb-6 outline-none focus:ring-2 focus:ring-spotify-green text-lg"
        @keyup.enter="canSave && saveScene()"
      />

      <!-- Volume slider -->
      <div class="mb-6">
        <div class="flex items-center justify-between mb-2">
          <label class="text-sm text-spotify-gray">Start volume</label>
          <span class="text-sm font-medium">{{ sceneVolume }}%</span>
        </div>
        <input
          v-model.number="sceneVolume"
          type="range"
          min="0"
          max="100"
          step="5"
          class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-spotify-green"
        />
        <div class="flex justify-between text-xs text-spotify-gray mt-1">
          <span>0%</span>
          <span>100%</span>
        </div>
      </div>

      <!-- Save button -->
      <button
        class="w-full p-4 bg-spotify-green text-black font-semibold rounded-full disabled:opacity-50 disabled:cursor-not-allowed hover:scale-102 transition-transform"
        :disabled="!canSave"
        @click="saveScene"
      >
        {{ isEditMode ? 'Save Changes' : 'Create Scene' }}
      </button>
    </div>
  </div>
</template>
