import { create } from "zustand";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import audio from "../lib/audio";

export interface Song {
  path: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  track: number | null;
  disk: number | null;
  duration: number;
  albumArtist: string | null;
  trackTotal: number | null;
  diskTotal: number | null;
  year: number | null;
  publisher: string | null;
  copyright: string | null;
  isrc: string | null;
}

export type ActiveTab =
  | "library" | "albums" | "artists" | "albumArtist"
  | "playlists" | "favourites" | "folders" | "settings" | "queue";

export interface PlayerState {
  // Library
  library: Song[];
  currentFolder: string | null;
  activeTab: ActiveTab;
  searchQuery: string;

  // Queue
  queue: Song[];
  currentIndex: number | null;
  currentSong: Song | null;
  currentCover: string | null;
  isLoadingCover: boolean;

  // Playback
  isPlaying: boolean;
  volume: number;
  previousVolume: number;
  isMuted: boolean;
  progress: number;
  duration: number;
  isShuffle: boolean;
  isRepeat: "none" | "all" | "one";
  playbackError: string | null;

  // Lyrics
  lyrics: string | null;
  isLoadingLyrics: boolean;

  // Playlists / History / Favourites
  playlists: Record<string, Song[]>;
  history: Song[];
  favourites: Song[];

  // Stream server
  streamPort: number | null;

  // ── Actions ──
  selectAndScanFolder: () => Promise<void>;
  scanFolder: (path: string) => Promise<void>;
  clearLibrary: () => void;
  setSearchQuery: (q: string) => void;
  setActiveTab: (tab: ActiveTab) => void;

  playSong: (song: Song) => Promise<void>;
  playQueue: (songs: Song[], startIndex: number) => Promise<void>;
  playNext: (song: Song) => void;
  addToQueue: (song: Song) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  togglePlay: () => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  setProgress: (p: number) => void;
  setDuration: (d: number) => void;
  nextSong: () => void;
  prevSong: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  setPlaybackError: (e: string | null) => void;

  loadPlaylists: () => Promise<void>;
  createPlaylist: (name: string) => Promise<void>;
  deletePlaylist: (name: string) => Promise<void>;
  addSongToPlaylist: (playlist: string, song: Song) => Promise<void>;

  loadHistory: () => Promise<void>;
  recordSongPlayed: (song: Song) => Promise<void>;

  loadFavourites: () => Promise<void>;
  toggleFavourite: (song: Song) => Promise<void>;
  isFavourite: (path: string) => boolean;

  loadLyrics: (path: string) => Promise<void>;
  loadStreamPort: () => Promise<void>;
  updateSongMetadata: (path: string, meta: Omit<Song, "path" | "duration">) => Promise<void>;
}

// ── Persistence helpers ───────────────────────────────────────
function loadLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}

const initialLibrary  = loadLS<Song[]>("choros_library", []);
const initialFolder   = localStorage.getItem("choros_folder") ?? null;
const initialShuffle  = loadLS<boolean>("choros_shuffle", false);
const initialRepeat   = loadLS<"none" | "all" | "one">("choros_repeat", "none");
const initialVolume   = loadLS<number>("choros_volume", 0.8);

export const usePlayerStore = create<PlayerState>((set, get) => ({
  library: initialLibrary,
  currentFolder: initialFolder,
  activeTab: "library",
  searchQuery: "",
  queue: [],
  currentIndex: null,
  currentSong: null,
  currentCover: null,
  isLoadingCover: false,
  isPlaying: false,
  volume: initialVolume,
  previousVolume: initialVolume,
  isMuted: false,
  progress: 0,
  duration: 0,
  isShuffle: initialShuffle,
  isRepeat: initialRepeat,
  playbackError: null,
  lyrics: null,
  isLoadingLyrics: false,
  playlists: {},
  history: [],
  favourites: [],
  streamPort: null,

  selectAndScanFolder: async () => {
    try {
      const selected: string | null = await invoke("select_folder");
      if (selected) await get().scanFolder(selected);
    } catch (e) { console.error(e); }
  },

  scanFolder: async path => {
    const songs: Song[] = await invoke("scan_folder", { folderPath: path });
    set({ library: songs, currentFolder: path });
    localStorage.setItem("choros_library", JSON.stringify(songs));
    localStorage.setItem("choros_folder", path);
  },

  clearLibrary: () => {
    audio.pause(); audio.src = "";
    set({ library: [], currentFolder: null, queue: [], currentIndex: null,
      currentSong: null, currentCover: null, isPlaying: false, progress: 0, duration: 0 });
    localStorage.removeItem("choros_library");
    localStorage.removeItem("choros_folder");
  },

  setSearchQuery: q => set({ searchQuery: q }),
  setActiveTab: tab => set({ activeTab: tab }),

  playSong: async song => {
    set({ playbackError: null, lyrics: null });
    const { streamPort } = get();
    const src = streamPort
      ? `http://127.0.0.1:${streamPort}/stream?path=${encodeURIComponent(song.path)}`
      : convertFileSrc(song.path);

    audio.src = src;
    set({ currentSong: song, isPlaying: true, isLoadingCover: true, currentCover: null, isLoadingLyrics: true });

    try { await audio.play(); } catch (e) {
      set({ isPlaying: false, isLoadingCover: false, isLoadingLyrics: false });
      throw e;
    }

    // Load cover
    invoke<string | null>("get_cover_art", { songPath: song.path })
      .then(cover => { if (get().currentSong?.path === song.path) set({ currentCover: cover, isLoadingCover: false }); })
      .catch(() => { if (get().currentSong?.path === song.path) set({ isLoadingCover: false }); });

    // Load lyrics
    get().loadLyrics(song.path);
  },

  playQueue: async (songs, startIndex) => {
    set({ queue: songs, currentIndex: startIndex });
    if (songs[startIndex]) await get().playSong(songs[startIndex]);
  },

  playNext: song => {
    const { queue, currentIndex } = get();
    const insertAt = currentIndex !== null ? currentIndex + 1 : queue.length;
    const newQueue = [...queue];
    newQueue.splice(insertAt, 0, song);
    set({ queue: newQueue });
  },

  addToQueue: song => set(s => ({ queue: [...s.queue, song] })),

  removeFromQueue: index => {
    const { queue, currentIndex } = get();
    const newQ = queue.filter((_, i) => i !== index);
    let newIdx = currentIndex;
    if (currentIndex !== null) {
      if (currentIndex === index) {
        newIdx = newQ.length > 0 ? Math.min(currentIndex, newQ.length - 1) : null;
        set({ queue: newQ, currentIndex: newIdx });
        if (newIdx !== null) get().playSong(newQ[newIdx]);
        else { audio.pause(); audio.src = ""; set({ currentSong: null, isPlaying: false, progress: 0, duration: 0, currentCover: null }); }
        return;
      } else if (currentIndex > index) newIdx = currentIndex - 1;
    }
    set({ queue: newQ, currentIndex: newIdx });
  },

  clearQueue: () => {
    audio.pause(); audio.src = "";
    set({ queue: [], currentIndex: null, currentSong: null, currentCover: null, isPlaying: false, progress: 0, duration: 0 });
  },

  togglePlay: () => {
    if (!get().currentSong) {
      const lib = get().library;
      if (lib.length > 0) get().playQueue(lib, 0);
      return;
    }
    if (get().isPlaying) { audio.pause(); set({ isPlaying: false }); }
    else { audio.play().catch(console.error); set({ isPlaying: true }); }
  },

  setVolume: v => {
    audio.volume = v;
    set({ volume: v, isMuted: v === 0 });
    localStorage.setItem("choros_volume", JSON.stringify(v));
  },

  toggleMute: () => {
    const { isMuted, volume, previousVolume } = get();
    if (isMuted) { const v = previousVolume > 0 ? previousVolume : 0.8; audio.volume = v; set({ isMuted: false, volume: v }); }
    else { audio.volume = 0; set({ isMuted: true, previousVolume: volume, volume: 0 }); }
  },

  setProgress: p => { if (!isNaN(p)) { audio.currentTime = p; set({ progress: p }); } },
  setDuration: d => { if (!isNaN(d)) set({ duration: d }); },

  nextSong: () => {
    const { queue, currentIndex, isShuffle, isRepeat } = get();
    if (!queue.length || currentIndex === null) return;
    let next = isShuffle ? Math.floor(Math.random() * queue.length) : currentIndex + 1;
    if (next >= queue.length) {
      if (isRepeat === "all") next = 0;
      else { audio.pause(); set({ isPlaying: false, progress: 0 }); return; }
    }
    set({ currentIndex: next });
    get().playSong(queue[next]);
  },

  prevSong: () => {
    const { queue, currentIndex, isShuffle, progress } = get();
    if (!queue.length || currentIndex === null) return;
    if (progress > 3) { audio.currentTime = 0; set({ progress: 0 }); return; }
    let prev = isShuffle ? Math.floor(Math.random() * queue.length) : currentIndex - 1;
    if (prev < 0) prev = queue.length - 1;
    set({ currentIndex: prev });
    get().playSong(queue[prev]);
  },

  toggleShuffle: () => {
    const v = !get().isShuffle; set({ isShuffle: v });
    localStorage.setItem("choros_shuffle", JSON.stringify(v));
  },

  toggleRepeat: () => {
    const cur = get().isRepeat;
    const next = cur === "none" ? "all" : cur === "all" ? "one" : "none";
    set({ isRepeat: next });
    localStorage.setItem("choros_repeat", JSON.stringify(next));
  },

  setPlaybackError: e => set({ playbackError: e }),

  loadPlaylists: async () => {
    try {
      const list: { name: string; songs: Song[] }[] = await invoke("get_playlists");
      const map: Record<string, Song[]> = {};
      list.forEach(p => { map[p.name] = p.songs; });
      set({ playlists: map });
    } catch (e) { console.error(e); }
  },

  createPlaylist: async name => {
    const { playlists } = get();
    if (playlists[name]) return;
    await invoke("save_playlist", { name, songs: [] });
    set({ playlists: { ...playlists, [name]: [] } });
  },

  deletePlaylist: async name => {
    const { playlists } = get();
    await invoke("delete_playlist", { name });
    const np = { ...playlists }; delete np[name]; set({ playlists: np });
  },

  addSongToPlaylist: async (playlistName, song) => {
    const { playlists } = get();
    const current = playlists[playlistName] ?? [];
    if (current.some(s => s.path === song.path)) return;
    const updated = [...current, song];
    await invoke("save_playlist", { name: playlistName, songs: updated });
    set({ playlists: { ...playlists, [playlistName]: updated } });
  },

  loadHistory: async () => {
    try { const h: Song[] = await invoke("get_history"); set({ history: h }); }
    catch (e) { console.error(e); }
  },

  recordSongPlayed: async song => {
    const { history } = get();
    const updated = [song, ...history.filter(s => s.path !== song.path)].slice(0, 500);
    try { await invoke("save_history", { history: updated }); set({ history: updated }); }
    catch (e) { console.error(e); }
  },

  loadFavourites: async () => {
    try { const f: Song[] = await invoke("get_favourites"); set({ favourites: f }); }
    catch (e) { console.error(e); }
  },

  toggleFavourite: async song => {
    const { favourites } = get();
    const exists = favourites.some(s => s.path === song.path);
    const updated = exists ? favourites.filter(s => s.path !== song.path) : [song, ...favourites];
    set({ favourites: updated });
    try { await invoke("save_favourites", { songs: updated }); }
    catch (e) { console.error(e); set({ favourites }); }
  },

  isFavourite: path => get().favourites.some(s => s.path === path),

  loadLyrics: async path => {
    set({ isLoadingLyrics: true, lyrics: null });
    try {
      const lyr: string | null = await invoke("get_lyrics", { songPath: path });
      if (get().currentSong?.path === path) set({ lyrics: lyr, isLoadingLyrics: false });
    } catch {
      if (get().currentSong?.path === path) set({ lyrics: null, isLoadingLyrics: false });
    }
  },

  loadStreamPort: async () => {
    try { const port: number = await invoke("get_stream_port"); set({ streamPort: port }); }
    catch (e) { console.error(e); }
  },

  updateSongMetadata: async (songPath, metadata) => {
    await invoke("update_metadata", { path: songPath, ...metadata });
    const patch = (s: Song): Song => s.path === songPath ? { ...s, ...metadata } : s;
    const updatedLib = get().library.map(patch);
    set({ library: updatedLib });
    localStorage.setItem("choros_library", JSON.stringify(updatedLib));
    const { currentSong, queue } = get();
    if (currentSong?.path === songPath) set({ currentSong: patch(currentSong) });
    set({ queue: queue.map(patch) });
  },
}));
