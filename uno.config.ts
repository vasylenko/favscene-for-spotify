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
  preflights: [
    {
      getCSS: () => `
        html, body {
          background-color: #121212;
        }
        body {
          padding-top: env(safe-area-inset-top);
          padding-bottom: env(safe-area-inset-bottom);
          padding-left: env(safe-area-inset-left);
          padding-right: env(safe-area-inset-right);
        }
      `,
    },
  ],
})
