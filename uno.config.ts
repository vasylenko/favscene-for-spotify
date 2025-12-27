import { defineConfig, presetWind4 } from 'unocss'

export default defineConfig({
  presets: [
    presetWind4(),
  ],
  theme: {
    colors: {
      spotify: {
        green: '#1ED760',
        black: '#121212',
        white: '#FFFFFF',
        gray: '#B3B3B3',
      },
    },
  },
})
