# FavScene for Spotify

One-tap launcher for your favorite Spotify playlists on preferred devices.

## Status

⚠️ **Active development — MVP phase.** Features may change, and you might encounter rough edges. Feedback is very welcome!

## The Problem

Playing a specific playlist on a specific device through Spotify takes too many taps: tap-tap-tap to find the playlist, tap to open it, tap the device picker, select the device, adjust volume. Every. Single. Time.

Siri does not solve this either.

## The Solution

**Scenes.** A scene is a saved combination of music + device + volume. Tap once, music plays.

Example: "Morning Coffee" scene = Jazz playlist on kitchen Google Home speaker at 40% volume.

## How It Works

1. Login directly with your Spotify **Premium** account 
2. Create scenes by picking playlist + device
3. Tap a scene tile to start playback instantly

No account creation needed — just your Spotify login. The app is a simple bridge between you and Spotify.


## Design Philosophy

- **One-tap playback** - The main action should be instant
- **No clutter** - Only features that serve the core use case
- **Graceful failures** - Devices go offline; the app handles it smoothly
- **Syncs across devices** - Your scenes are available on any browser where you log in. Data is stored encrypted and contains only your playlist/device preferences — nothing sensitive. 

## Requirements

- **Spotify Premium account** required for playback control — this is a Spotify API limitation, unfortunately.
- Modern browser, desktop or mobile (Chrome, Firefox, Safari, Edge)

## Built With

Vue.js • TypeScript • Spotify Web API • Hosted on Cloudflare Workers
