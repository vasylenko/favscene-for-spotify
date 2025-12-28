<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useSpotifyAuth } from '@/composables/useSpotifyAuth'

const router = useRouter()
const route = useRoute()
const { handleCallback, isLoading, error } = useSpotifyAuth()

onMounted(async () => {
  // Check for error from Spotify (e.g., user denied access)
  const errorParam = route.query.error as string | undefined
  if (errorParam) {
    error.value = `Spotify authorization failed: ${errorParam}`
    return
  }

  // SDK detects callback params (code) automatically
  const success = await handleCallback()
  if (success) {
    router.replace('/')
  }
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4">
    <div class="text-center">
      <div v-if="isLoading" class="space-y-4">
        <div class="w-12 h-12 border-4 border-spotify-green border-t-transparent rounded-full animate-spin mx-auto" />
        <p class="text-spotify-gray">Connecting to Spotify...</p>
      </div>

      <div v-else-if="error" class="space-y-4">
        <div class="text-red-500 text-xl">Authentication Failed</div>
        <p class="text-spotify-gray">{{ error }}</p>
        <button
          class="mt-4 px-6 py-2 bg-spotify-green text-black font-semibold rounded-full hover:scale-105 transition-transform"
          @click="$router.replace('/')"
        >
          Try Again
        </button>
      </div>
    </div>
  </div>
</template>
