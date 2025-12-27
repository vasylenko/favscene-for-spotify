# FavScene for Spotify

One-tap launcher for your favorite Spotify playlists on preferred devices.

## The Problem

Playing a specific playlist on a specific device through Spotify takes too many taps: tap-tap-tap to find the playlist, tap to open it, tap the device picker, select the device, adjust volume. Every. Single. Time.

## The Solution

**Scenes.** A scene is a saved combination of music + device + volume. Tap once, music plays.

Example: "Morning Coffee" scene = Jazz playlist on kitchen Google Home speaker at 40% volume.

## How It Works

1. You login dirctly to your Spotify **Premium** account 
2. Create scenes by picking playlist + device
3. Tap a scene tile to start playback instantly

No account creation, no backend servers. Your data stays in your browser, the app is just a mediator between you and Spotify.

## Design Philosophy

- **One-tap playback** - The main action should be instant
- **No clutter** - Only features that serve the core use case
- **Graceful failures** - Devices go offline; the app handles it smoothly
- **Your data, your browser** - No tracking, no analytics, no sync (yet; but I have a plan to add cross-browser sync)

## Status

**Active development. Currently in MVP phase.**

## Requirements

- Spotify Premium account (required for playback control - this is a Spotify API limitation)
- Modern browser, desktop or mobile (Chrome, Firefox, Safari, Edge)
