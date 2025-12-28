export interface SpotifyPlaylist {
  id: string
  name: string
  uri: string
  imageUrl: string | null
}

export interface SpotifyDevice {
  id: string
  name: string
  type: string
  is_active: boolean
}

export interface Scene {
  id: string
  name: string
  volume: number // 0-100, percentage
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

export const DEFAULT_VOLUME = 15

export interface SpotifyUser {
  id: string
  displayName: string
  imageUrl: string | null
}
