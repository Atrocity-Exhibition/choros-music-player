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
}

interface PlayerState {
  // Library & Navigation
  library: Song[];
  currentFolder: string | null;
  activeTab: "library" | "queue" | "settings" | "artists" | "albums" | "genres" | "playlists" | "history";
  searchQuery: string;

  // Queue State
  queue: Song[];
  currentIndex: number | null;
  currentSong: Song | null;
  currentCover: string | null;
  isLoadingCover: boolean;

  // Playback Control States
  isPlaying: boolean;
  volume: number;
  previousVolume: number; // For unmuting
  isMuted: boolean;
  progress: number;
  duration: number;
  isShuffle: boolean;
  isRepeat: "none" | "all" | "one";
  playbackError: string | null;

  // Playlist & History State
  playlists: Record<string, Song[]>;
  history: Song[];
  streamPort: number | null;

  // Actions
  selectAndScanFolder: () => Promise<void>;
  scanFolder: (path: string) => Promise<void>;
  clearLibrary: () => void;
  setSearchQuery: (query: string) => void;
  setActiveTab: (tab: "library" | "queue" | "settings" | "artists" | "albums" | "genres" | "playlists" | "history") => void;

  // Playback actions
  playSong: (song: Song) => Promise<void>;
  playQueue: (songs: Song[], startIndex: number) => Promise<void>;
  addToQueue: (song: Song) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  togglePlay: () => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setProgress: (progress: number) => void;
  setDuration: (duration: number) => void;
  nextSong: () => void;
  prevSong: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  setPlaybackError: (error: string | null) => void;

  // Playlist & History Actions
  loadPlaylists: () => Promise<void>;
  createPlaylist: (name: string) => Promise<void>;
  deletePlaylist: (name: string) => Promise<void>;
  addSongToPlaylist: (playlistName: string, song: Song) => Promise<void>;
  removeSongFromPlaylist: (playlistName: string, songPath: string) => Promise<void>;
  loadHistory: () => Promise<void>;
  recordSongPlayed: (song: Song) => Promise<void>;
  loadStreamPort: () => Promise<void>;
}

// Initial state from localStorage
const savedLibrary = localStorage.getItem("choros_library");
const savedFolder = localStorage.getItem("choros_folder");

const initialLibrary: Song[] = savedLibrary ? JSON.parse(savedLibrary) : [];
const initialFolder: string | null = savedFolder || null;

export const usePlayerStore = create<PlayerState>((set, get) => ({
  // Library & Navigation
  library: initialLibrary,
  currentFolder: initialFolder,
  activeTab: "library",
  searchQuery: "",

  // Queue State
  queue: [],
  currentIndex: null,
  currentSong: null,
  currentCover: null,
  isLoadingCover: false,

  // Playback Control States
  isPlaying: false,
  volume: 0.8,
  previousVolume: 0.8,
  isMuted: false,
  progress: 0,
  duration: 0,
  isShuffle: false,
  isRepeat: "none",
  playbackError: null,

  // Playlist & History State
  playlists: {},
  history: [],
  streamPort: null,

  // Actions
  selectAndScanFolder: async () => {
    try {
      const selected: string | null = await invoke("select_folder");
      if (selected) {
        await get().scanFolder(selected);
      }
    } catch (e) {
      console.error("Failed to select or scan folder:", e);
    }
  },

  scanFolder: async (path) => {
    try {
      const songs: Song[] = await invoke("scan_folder", { folderPath: path });
      set({ library: songs, currentFolder: path });
      localStorage.setItem("choros_library", JSON.stringify(songs));
      localStorage.setItem("choros_folder", path);
    } catch (e) {
      console.error("Failed to scan folder:", e);
      throw e;
    }
  },

  clearLibrary: () => {
    set({ library: [], currentFolder: null, queue: [], currentIndex: null, currentSong: null, currentCover: null, playbackError: null });
    localStorage.removeItem("choros_library");
    localStorage.removeItem("choros_folder");
    audio.pause();
    audio.src = "";
    set({ isPlaying: false, progress: 0, duration: 0 });
  },

  setSearchQuery: (query) => set({ searchQuery: query }),
  setActiveTab: (tab) => set({ activeTab: tab }),

  // Playback actions
  playSong: async (song) => {
    try {
      set({ playbackError: null });
      
      const { streamPort } = get();
      const assetUrl = streamPort 
        ? `http://127.0.0.1:${streamPort}/stream?path=${encodeURIComponent(song.path)}` 
        : convertFileSrc(song.path);
        
      audio.src = assetUrl;

      set({
        currentSong: song,
        isPlaying: true,
        isLoadingCover: true,
        currentCover: null,
      });

      await audio.play();

      // Fetch cover art in the background
      const coverUrl: string | null = await invoke("get_cover_art", { songPath: song.path });
      if (get().currentSong?.path === song.path) {
        set({ currentCover: coverUrl, isLoadingCover: false });
      }
    } catch (e) {
      console.error("Error starting song playback:", e);
      set({ 
        isPlaying: false, 
        playbackError: e instanceof Error ? e.message : "Failed to load audio source" 
      });
      if (get().currentSong?.path === song.path) {
        set({ isLoadingCover: false });
      }
    }
  },

  playQueue: async (songs, startIndex) => {
    set({ queue: songs, currentIndex: startIndex });
    if (songs.length > 0 && startIndex >= 0 && startIndex < songs.length) {
      await get().playSong(songs[startIndex]);
    }
  },

  addToQueue: (song) => {
    const { queue } = get();
    // Avoid duplicates if desired, or just append
    set({ queue: [...queue, song] });
  },

  removeFromQueue: (index) => {
    const { queue, currentIndex } = get();
    const newQueue = queue.filter((_, i) => i !== index);
    
    let newIndex = currentIndex;
    if (currentIndex !== null) {
      if (currentIndex === index) {
        // Current playing song was removed
        newIndex = newQueue.length > 0 ? Math.min(currentIndex, newQueue.length - 1) : null;
        set({ queue: newQueue, currentIndex: newIndex });
        if (newIndex !== null) {
          get().playSong(newQueue[newIndex]);
        } else {
          audio.pause();
          audio.src = "";
          set({ currentSong: null, isPlaying: false, progress: 0, duration: 0, currentCover: null });
        }
        return;
      } else if (currentIndex > index) {
        newIndex = currentIndex - 1;
      }
    }
    set({ queue: newQueue, currentIndex: newIndex });
  },

  clearQueue: () => {
    set({ queue: [], currentIndex: null, currentSong: null, currentCover: null, isPlaying: false });
    audio.pause();
    audio.src = "";
  },

  togglePlay: () => {
    if (!get().currentSong) {
      // If nothing is playing, play first song from library if available
      const { library } = get();
      if (library.length > 0) {
        get().playQueue(library, 0);
      }
      return;
    }

    if (get().isPlaying) {
      audio.pause();
      set({ isPlaying: false });
    } else {
      audio.play().catch(err => console.error("Playback failed", err));
      set({ isPlaying: true });
    }
  },

  setVolume: (volume) => {
    audio.volume = volume;
    set({ volume, isMuted: volume === 0 });
  },

  toggleMute: () => {
    const { isMuted, volume, previousVolume } = get();
    if (isMuted) {
      const restoreVol = previousVolume > 0 ? previousVolume : 0.8;
      audio.volume = restoreVol;
      set({ isMuted: false, volume: restoreVol });
    } else {
      set({ isMuted: true, previousVolume: volume, volume: 0 });
      audio.volume = 0;
    }
  },

  setProgress: (progress) => {
    if (!isNaN(progress)) {
      audio.currentTime = progress;
      set({ progress });
    }
  },

  setDuration: (duration) => {
    if (!isNaN(duration)) {
      set({ duration });
    }
  },

  nextSong: () => {
    const { queue, currentIndex, isShuffle, isRepeat } = get();
    if (queue.length === 0 || currentIndex === null) return;

    let nextIndex: number;

    if (isShuffle) {
      nextIndex = Math.floor(Math.random() * queue.length);
    } else {
      nextIndex = currentIndex + 1;
      if (nextIndex >= queue.length) {
        if (isRepeat === "all") {
          nextIndex = 0;
        } else {
          // Stop playback at end of queue
          audio.pause();
          set({ isPlaying: false, progress: 0 });
          return;
        }
      }
    }

    set({ currentIndex: nextIndex });
    get().playSong(queue[nextIndex]);
  },

  prevSong: () => {
    const { queue, currentIndex, isShuffle, progress } = get();
    if (queue.length === 0 || currentIndex === null) return;

    if (progress > 3) {
      audio.currentTime = 0;
      set({ progress: 0 });
      return;
    }

    let prevIndex: number;

    if (isShuffle) {
      prevIndex = Math.floor(Math.random() * queue.length);
    } else {
      prevIndex = currentIndex - 1;
      if (prevIndex < 0) {
        prevIndex = queue.length - 1;
      }
    }

    set({ currentIndex: prevIndex });
    get().playSong(queue[prevIndex]);
  },

  toggleShuffle: () => set((state) => ({ isShuffle: !state.isShuffle })),

  toggleRepeat: () => {
    const { isRepeat } = get();
    let nextRepeat: "none" | "all" | "one" = "none";
    if (isRepeat === "none") nextRepeat = "all";
    else if (isRepeat === "all") nextRepeat = "one";
    set({ isRepeat: nextRepeat });
  },

  setPlaybackError: (error) => set({ playbackError: error }),

  loadPlaylists: async () => {
    try {
      const playlistsList: { name: string; songs: Song[] }[] = await invoke("get_playlists");
      const playlistsMap: Record<string, Song[]> = {};
      for (const p of playlistsList) {
        playlistsMap[p.name] = p.songs;
      }
      set({ playlists: playlistsMap });
    } catch (e) {
      console.error("Failed to load playlists:", e);
    }
  },

  createPlaylist: async (name) => {
    const { playlists } = get();
    if (playlists[name]) return;
    try {
      await invoke("save_playlist", { name, songs: [] });
      set({ playlists: { ...playlists, [name]: [] } });
    } catch (e) {
      console.error("Failed to create playlist:", e);
    }
  },

  deletePlaylist: async (name) => {
    const { playlists } = get();
    try {
      await invoke("delete_playlist", { name });
      const newPlaylists = { ...playlists };
      delete newPlaylists[name];
      set({ playlists: newPlaylists });
    } catch (e) {
      console.error("Failed to delete playlist:", e);
    }
  },

  addSongToPlaylist: async (playlistName, song) => {
    const { playlists } = get();
    const currentPlaylistSongs = playlists[playlistName] || [];
    if (currentPlaylistSongs.some((s) => s.path === song.path)) {
      return;
    }
    const updatedSongs = [...currentPlaylistSongs, song];
    try {
      await invoke("save_playlist", { name: playlistName, songs: updatedSongs });
      set({
        playlists: {
          ...playlists,
          [playlistName]: updatedSongs,
        },
      });
    } catch (e) {
      console.error("Failed to add song to playlist:", e);
    }
  },

  removeSongFromPlaylist: async (playlistName, songPath) => {
    const { playlists } = get();
    const currentPlaylistSongs = playlists[playlistName] || [];
    const updatedSongs = currentPlaylistSongs.filter((s) => s.path !== songPath);
    try {
      await invoke("save_playlist", { name: playlistName, songs: updatedSongs });
      set({
        playlists: {
          ...playlists,
          [playlistName]: updatedSongs,
        },
      });
    } catch (e) {
      console.error("Failed to remove song from playlist:", e);
    }
  },

  loadHistory: async () => {
    try {
      const historySongs: Song[] = await invoke("get_history");
      set({ history: historySongs });
    } catch (e) {
      console.error("Failed to load history:", e);
    }
  },

  recordSongPlayed: async (song) => {
    const { history } = get();
    const filtered = history.filter((s) => s.path !== song.path);
    const updatedHistory = [song, ...filtered].slice(0, 500);
    try {
      await invoke("save_history", { history: updatedHistory });
      set({ history: updatedHistory });
    } catch (e) {
      console.error("Failed to record play history:", e);
    }
  },

  loadStreamPort: async () => {
    try {
      const port: number = await invoke("get_stream_port");
      set({ streamPort: port });
    } catch (e) {
      console.error("Failed to load stream port:", e);
    }
  },
}));
