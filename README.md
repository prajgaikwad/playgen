# 🎵 Play Gen — AI Playlist Generator

Generate a perfect playlist from a single song using Spotify's music intelligence.

## ✨ Features

- 🔍 **Song Search** — Autocomplete powered by Spotify API
- 🎶 **Playlist Generation** — 20 similar tracks via Spotify Recommendations
- 🎵 **30s Previews** — Listen before you click
- 📋 **Copy Playlist** — Copy all song links to clipboard
- 🕐 **Recent Searches** — Quick access to past searches
- ⏱️ **Playlist Duration** — Total runtime calculated
- 🌑 **Dark Mode** — Premium neon-gradient UI

## 🚀 Quick Start (No Install Required)

This app runs directly in your browser — no Node.js or Python needed.

### Step 1 — Create a Spotify Developer App

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Log in and click **Create App**
3. Fill in any name and description
4. Set the **Redirect URI** to the URL you'll open the app from:
   - If opening the file directly: `file:///C:/Users/my/Desktop/playgen/index.html`
   - If serving locally: `http://localhost:5500` (or whatever your server uses)
5. Save and copy your **Client ID**

### Step 2 — Open the App

Just open `index.html` in your browser:

```
Double-click: C:\Users\my\Desktop\playgen\index.html
```

Or use VS Code Live Server for the best experience.

### Step 3 — Connect Spotify

1. Paste your **Client ID** in the setup screen
2. Click **Login with Spotify**
3. Authorize the app
4. Start generating playlists!

## 📁 File Structure

```
playgen/
├── index.html    # Main app HTML
├── style.css     # Premium dark UI styles
├── app.js        # Spotify PKCE OAuth + API logic
├── music.md      # Product requirements
└── README.md     # This file
```

## 🔐 How Authentication Works

This app uses **Spotify PKCE OAuth** — a secure, fully client-side authentication method:
- No backend server required
- Your credentials never leave your browser
- No client secret needed

## 🎨 Tech Stack

| Layer | Technology |
|-------|-----------|
| Structure | HTML5 |
| Styling | Vanilla CSS (glassmorphism + animations) |
| Logic | Vanilla JavaScript (ES2020+) |
| Auth | Spotify PKCE OAuth 2.0 |
| API | Spotify Web API |

## ⚙️ Troubleshooting

| Issue | Fix |
|-------|-----|
| "INVALID_CLIENT" error | Make sure Redirect URI in Spotify Dashboard matches exactly |
| No recommendations | Spotify's Recommendations API may be limited for new apps — the app auto-falls back to Related Artists |
| Login loop | Clear browser localStorage and try again |
| No previews | Spotify only provides previews for ~30% of tracks |
