/* ═══════════════════════════════════════════════
   Play Gen — app.js
   Spotify PKCE OAuth + API Integration
   ───────────────────────────────────────────────
   ⚙️  DEVELOPER SETUP:
   1. Go to https://developer.spotify.com/dashboard
   2. Create an app and add this as a Redirect URI:
        file:///C:/Users/my/Desktop/playgen/index.html
      (or your actual local path / hosted URL)
   3. Paste your Client ID below:
   ═══════════════════════════════════════════════ */

const CLIENT_ID = '527bc50d121141e2b7b6e27336211312';

// ── State ─────────────────────────────────────────
const STATE = {
  accessToken: null,
  tokenExpiry: 0,
  selectedSong: null,
  currentTracks: [],
  userId: null,
  recentSearches: JSON.parse(localStorage.getItem('pg_recent') || '[]'),
};

const $ = id => document.getElementById(id);

// ── Init ──────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  // Check if CLIENT_ID has been set
  if (!CLIENT_ID || CLIENT_ID === 'YOUR_CLIENT_ID_HERE') {
    $('config-warning').classList.remove('hidden');
    $('login-btn').disabled = true;
    $('login-btn').style.opacity = '0.4';
    return;
  }

  // Handle OAuth callback
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const error = params.get('error');

  if (error) {
    cleanUrl();
    showLanding();
    showToast('Spotify login was cancelled.');
    return;
  }

  if (code) {
    await handleCallback(code);
    return;
  }

  // Check for existing session
  const savedToken = localStorage.getItem('pg_token');
  const savedExpiry = parseInt(localStorage.getItem('pg_expiry') || '0');

  if (savedToken && savedExpiry > Date.now()) {
    STATE.accessToken = savedToken;
    STATE.tokenExpiry = savedExpiry;
    showApp();
  } else {
    showLanding();
  }
});

// ── Routing ───────────────────────────────────────
function showLanding() {
  $('landing').classList.remove('hidden');
  $('app').classList.add('hidden');
}

function showApp() {
  $('landing').classList.add('hidden');
  $('app').classList.remove('hidden');
  fetchUserProfile();
  renderRecentSearches();
}

// ── PKCE Auth ─────────────────────────────────────
function getRedirectUri() {
  if (location.protocol === 'file:') {
    return location.href.split('?')[0].split('#')[0];
  }
  return location.origin + location.pathname;
}

async function initiateLogin() {
  if (!CLIENT_ID || CLIENT_ID === 'YOUR_CLIENT_ID_HERE') {
    showToast('Set CLIENT_ID in app.js first.');
    return;
  }

  const btn = $('login-btn');
  btn.disabled = true;
  btn.innerHTML = `<svg class="spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/></svg> Connecting...`;

  const verifier = generateVerifier(128);
  const challenge = await generateChallenge(verifier);
  sessionStorage.setItem('pg_verifier', verifier);

  const redirectUri = getRedirectUri();
  console.log('================================================');
  console.log('🚨 ADD THIS EXACT URL TO SPOTIFY REDIRECT URIs:');
  console.log(redirectUri);
  console.log('================================================');

  const authParams = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: getRedirectUri(),
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: 'user-read-private user-read-email playlist-modify-public',
    state: generateVerifier(16),
  });

  window.location.href = `https://accounts.spotify.com/authorize?${authParams}`;
}

async function handleCallback(code) {
  const verifier = sessionStorage.getItem('pg_verifier');
  if (!verifier) { showLanding(); return; }

  try {
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        grant_type: 'authorization_code',
        code,
        redirect_uri: getRedirectUri(),
        code_verifier: verifier,
      }),
    });

    if (!res.ok) throw new Error('Token exchange failed');
    const data = await res.json();

    STATE.accessToken = data.access_token;
    STATE.tokenExpiry = Date.now() + data.expires_in * 1000;

    localStorage.setItem('pg_token', data.access_token);
    localStorage.setItem('pg_expiry', STATE.tokenExpiry.toString());
    sessionStorage.removeItem('pg_verifier');
    cleanUrl();
    showApp();
  } catch (e) {
    cleanUrl();
    showLanding();
    showToast('Login failed. Check your Client ID & Redirect URI in the Spotify Dashboard.');
  }
}

function cleanUrl() {
  window.history.replaceState({}, '', location.pathname);
}

function logout() {
  localStorage.removeItem('pg_token');
  localStorage.removeItem('pg_expiry');
  STATE.accessToken = null;
  STATE.selectedSong = null;
  STATE.currentTracks = [];
  showLanding();
}

// ── PKCE Helpers ──────────────────────────────────
function generateVerifier(len) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => chars[b % chars.length]).join('');
}

async function generateChallenge(verifier) {
  const enc = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', enc);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

// ── Spotify API ───────────────────────────────────
async function spotifyFetch(path) {
  if (!STATE.accessToken || Date.now() > STATE.tokenExpiry) {
    logout();
    throw new Error('Session expired. Please log in again.');
  }
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${STATE.accessToken}` },
  });
  if (res.status === 401) { logout(); throw new Error('Unauthorized'); }
  if (!res.ok) throw new Error(`Spotify error ${res.status}`);
  return res.json();
}

async function fetchUserProfile() {
  try {
    const data = await spotifyFetch('/me');
    STATE.userId = data.id;
    $('user-avatar').src = data.images?.[0]?.url || generateAvatarUrl(data.display_name);
    $('user-name').textContent = data.display_name || 'User';
    $('user-profile').classList.remove('hidden');
  } catch { }
}

function generateAvatarUrl(name) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'U')}&background=1db954&color=fff&size=64`;
}

// ── Search & Autocomplete ─────────────────────────
let searchTimeout = null;

document.addEventListener('DOMContentLoaded', () => {
  const input = $('search-input');
  if (!input) return;

  input.addEventListener('input', e => {
    clearTimeout(searchTimeout);
    const q = e.target.value.trim();
    if (!q) { hideSuggestions(); return; }
    searchTimeout = setTimeout(() => fetchSuggestions(q), 350);
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleGenerate();
    if (e.key === 'Escape') hideSuggestions();
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('#search-container')) hideSuggestions();
  });
});

async function fetchSuggestions(q) {
  try {
    const data = await spotifyFetch(`/search?q=${encodeURIComponent(q)}&type=track&limit=6`);
    renderSuggestions(data.tracks?.items || []);
  } catch { }
}

function renderSuggestions(tracks) {
  const box = $('suggestions');
  if (!tracks.length) { hideSuggestions(); return; }
  box.innerHTML = tracks.map(t => `
    <div class="suggestion-item" onclick="selectSong('${t.id}','${esc(t.name)}','${esc(t.artists[0]?.name)}','${t.album?.images?.[1]?.url || t.album?.images?.[0]?.url || ''}')">
      <img class="suggestion-thumb" src="${t.album?.images?.[2]?.url || t.album?.images?.[0]?.url || ''}" alt="" loading="lazy" />
      <div class="suggestion-info">
        <div class="suggestion-name">${escHtml(t.name)}</div>
        <div class="suggestion-artist">${escHtml(t.artists.map(a => a.name).join(', '))} · ${escHtml(t.album?.name || '')}</div>
      </div>
      <div class="suggestion-duration">${msToMin(t.duration_ms)}</div>
    </div>`).join('');
  box.classList.remove('hidden');
}

function hideSuggestions() { $('suggestions')?.classList.add('hidden'); }

function selectSong(id, name, artist, img) {
  $('search-input').value = `${name} — ${artist}`;
  hideSuggestions();
  STATE.selectedSong = { id, name, artist, img };
}

async function handleGenerate() {
  const q = $('search-input').value.trim();
  if (!q && !STATE.selectedSong) { showToast('Enter a song name first'); return; }

  if (!STATE.selectedSong) {
    try {
      const data = await spotifyFetch(`/search?q=${encodeURIComponent(q)}&type=track&limit=1`);
      const track = data.tracks?.items?.[0];
      if (!track) { showError('No song found', `We couldn't find "${q}" on Spotify.`); return; }
      STATE.selectedSong = {
        id: track.id, name: track.name,
        artist: track.artists[0]?.name,
        img: track.album?.images?.[1]?.url || '',
        duration_ms: track.duration_ms,
      };
    } catch (e) {
      showError('Search failed', e.message); return;
    }
  }

  addRecentSearch(STATE.selectedSong.name);
  await generatePlaylist(STATE.selectedSong.id);
}

// ── Playlist Generation ───────────────────────────
async function generatePlaylist(trackId) {
  showResultsSection();
  showSkeletons(true);
  hideError();

  try {
    const track = await spotifyFetch(`/tracks/${trackId}`);
    const artistIds = track.artists.slice(0, 2).map(a => a.id);
    renderSeedCard(track);

    // Spotify deprecated /recommendations and /related-artists in Nov 2024 for new apps (returns 404).
    // We will build a fallback playlist using Artist Top Tracks, Genres, and Search.
    let recommendations = await buildFallbackPlaylist(artistIds, track.name);

    // Deduplicate
    const seen = new Set([trackId]);
    const unique = recommendations.filter(t => {
      if (seen.has(t.id)) return false;
      seen.add(t.id); return true;
    }).slice(0, 20);

    showSkeletons(false);
    renderPlaylist(unique, track);
  } catch (e) {
    showSkeletons(false);
    showError('Generation failed', e.message || 'Could not generate playlist. Please try again.');
  }
}

async function buildFallbackPlaylist(artistIds, seedTrackName) {
  const tracks = [];

  // 1. Get Top Tracks of the seed artists
  for (const aid of artistIds) {
    try {
      const top = await spotifyFetch(`/artists/${aid}/top-tracks?market=US`);
      if (top.tracks) tracks.push(...top.tracks.slice(0, 7));
    } catch { }
  }

  // 2. Fetch artist to get genres, then search by genre
  if (artistIds.length > 0) {
    try {
      const artistRes = await spotifyFetch(`/artists/${artistIds[0]}`);
      const genre = artistRes.genres?.[0];
      if (genre) {
        // Search tracks matching this genre and fetch more to ensure diversity
        const searchRes = await spotifyFetch(`/search?q=genre:%22${encodeURIComponent(genre)}%22&type=track&limit=30`);
        if (searchRes.tracks?.items) {
          // Filter out the seed artists to ensure we get OTHER artists in the same genre
          const otherArtists = searchRes.tracks.items.filter(t => 
            !t.artists.some(a => artistIds.includes(a.id))
          );
          tracks.push(...otherArtists.slice(0, 8));
        }
      }
    } catch { }
  }


  // Shuffle the tracks so it feels more like a recommendation list
  return tracks.sort(() => Math.random() - 0.5);
}

// ── Render ────────────────────────────────────────
function renderSeedCard(track) {
  const img = track.album?.images?.[1]?.url || track.album?.images?.[0]?.url || '';
  const artists = track.artists.map(a => a.name).join(', ');
  const url = track.external_urls?.spotify || '#';
  $('seed-card').innerHTML = `
    <img class="seed-img" src="${escHtml(img)}" alt="${escHtml(track.name)}" />
    <div class="seed-info">
      <div class="seed-label">✦ Seed Track</div>
      <div class="seed-name">${escHtml(track.name)}</div>
      <div class="seed-artist">${escHtml(artists)} · ${escHtml(track.album?.name || '')}</div>
    </div>
    <a class="seed-open" href="${url}" target="_blank" rel="noopener">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
      Open in Spotify
    </a>`;
}

function renderPlaylist(tracks, seedTrack) {
  const grid = $('playlist-grid');
  grid.innerHTML = '';
  let totalMs = seedTrack?.duration_ms || 0;

  tracks.forEach((t, i) => {
    totalMs += t.duration_ms || 0;
    const img = t.album?.images?.[1]?.url || t.album?.images?.[0]?.url || '';
    const artists = t.artists.map(a => a.name).join(', ');
    const url = t.external_urls?.spotify || '#';
    const preview = t.preview_url;

    const card = document.createElement('div');
    card.className = 'song-card';
    card.style.animationDelay = `${i * 40}ms`;
    card.innerHTML = `
      <div class="card-img-wrap">
        <img class="card-img" src="${escHtml(img)}" alt="${escHtml(t.name)}" loading="lazy" />
        <button class="card-play-btn" onclick="playPreview(event,'${esc(preview || '')}','${esc(url)}')" title="${preview ? 'Preview' : 'Open in Spotify'}">
          ${preview ? '▶' : '↗'}
        </button>
      </div>
      <div class="card-body">
        <div class="card-num">#${String(i + 1).padStart(2, '0')}</div>
        <div class="card-name" title="${escHtml(t.name)}">${escHtml(t.name)}</div>
        <div class="card-artist" title="${escHtml(artists)}">${escHtml(artists)}</div>
        <div class="card-footer">
          <span class="card-duration">${msToMin(t.duration_ms)}</span>
          <a class="card-spotify" href="${url}" target="_blank" rel="noopener" onclick="event.stopPropagation()">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
            Play
          </a>
        </div>
      </div>`;
    grid.appendChild(card);
  });

  $('playlist-title').textContent = `Based on "${seedTrack?.name || 'your song'}"`;
  $('playlist-subtitle').textContent = `${tracks.length} tracks · ${msToHoursMin(totalMs)}`;
  $('duration-display').textContent = `🎵 ${tracks.length} tracks · Total duration: ${msToHoursMin(totalMs)}`;
  $('playlist-footer').classList.remove('hidden');
  grid.classList.remove('hidden');
  STATE.currentTracks = tracks;
}

// ── Audio Preview ─────────────────────────────────
let currentAudio = null;
function playPreview(e, previewUrl, spotifyUrl) {
  e.stopPropagation();
  if (!previewUrl) { window.open(spotifyUrl, '_blank'); return; }
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  const audio = new Audio(previewUrl);
  audio.volume = 0.7;
  audio.play();
  currentAudio = audio;
  audio.onended = () => { currentAudio = null; };
  showToast('Playing 30s preview ♪');
}

// ── Copy & Export Playlist ────────────────────────
async function exportToSpotify() {
  if (!STATE.currentTracks?.length || !STATE.userId) return;
  const btn = $('export-btn');
  const originalText = btn.innerHTML;
  btn.innerHTML = 'Saving...';
  btn.disabled = true;

  try {
    // 1. Create a new playlist
    const playlistName = `Play Gen: ${STATE.selectedSong?.name || 'Mix'}`;
    const createRes = await fetch(`https://api.spotify.com/v1/users/${STATE.userId}/playlists`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STATE.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: playlistName,
        description: 'Generated by Play Gen (AI Playlist Generator)',
        public: true
      })
    });
    
    if (!createRes.ok) throw new Error('Failed to create playlist');
    const playlist = await createRes.json();

    // 2. Add tracks to the playlist
    const uris = STATE.currentTracks.map(t => t.uri);
    await fetch(`https://api.spotify.com/v1/playlists/${playlist.id}/tracks`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STATE.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ uris })
    });

    showToast('✓ Playlist saved to your Spotify account!');
    setTimeout(() => window.open(playlist.external_urls.spotify, '_blank'), 1500);
  } catch (e) {
    showToast('Failed to save playlist. Check permissions.');
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

async function copyPlaylist() {
  if (!STATE.currentTracks?.length) return;
  const links = STATE.currentTracks.map((t, i) =>
    `${i + 1}. ${t.name} — ${t.artists.map(a => a.name).join(', ')}\n   ${t.external_urls?.spotify || ''}`
  ).join('\n\n');
  try {
    await navigator.clipboard.writeText(links);
    showToast('✓ Playlist copied to clipboard!');
  } catch { showToast('Copy failed. Try manually.'); }
}

// ── Recent Searches ───────────────────────────────
function addRecentSearch(name) {
  const r = STATE.recentSearches;
  const idx = r.indexOf(name);
  if (idx !== -1) r.splice(idx, 1);
  r.unshift(name);
  STATE.recentSearches = r.slice(0, 5);
  localStorage.setItem('pg_recent', JSON.stringify(STATE.recentSearches));
  renderRecentSearches();
}

function renderRecentSearches() {
  const r = STATE.recentSearches;
  if (!r.length) { $('recent-searches')?.classList.add('hidden'); return; }
  $('recent-chips').innerHTML = r.map(name =>
    `<button class="recent-chip" onclick="searchFromRecent('${esc(name)}')">${escHtml(name)}</button>`
  ).join('');
  $('recent-searches')?.classList.remove('hidden');
}

async function searchFromRecent(name) {
  $('search-input').value = name;
  STATE.selectedSong = null;
  await handleGenerate();
}

// ── UI Helpers ────────────────────────────────────
function showResultsSection() {
  $('hero').classList.add('hidden');
  $('results').classList.remove('hidden');
  $('error-state').classList.add('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showSkeletons(show) {
  $('skeleton-grid').classList.toggle('hidden', !show);
  $('playlist-grid').classList.toggle('hidden', show);
  $('playlist-footer').classList.add('hidden');
}

function showError(title, msg) {
  $('error-title').textContent = title;
  $('error-message').textContent = msg;
  $('error-state').classList.remove('hidden');
  $('results').classList.add('hidden');
}
function hideError() { $('error-state').classList.add('hidden'); }

function resetApp() {
  STATE.selectedSong = null;
  $('search-input').value = '';
  $('results').classList.add('hidden');
  $('error-state').classList.add('hidden');
  $('hero').classList.remove('hidden');
  $('playlist-grid').innerHTML = '';
  $('playlist-footer').classList.add('hidden');
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

let toastTimer = null;
function showToast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 3000);
}

// ── Formatters ────────────────────────────────────
function msToMin(ms) {
  if (!ms) return '—';
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
function msToHoursMin(ms) {
  const m = Math.round(ms / 60000);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} hr ${m % 60} min`;
}
function esc(s) { return (s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;'); }
function escHtml(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
