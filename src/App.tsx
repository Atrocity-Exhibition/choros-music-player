import { useEffect, useState, useRef } from "react";
import {
  Music,
  FolderOpen,
  Search,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Shuffle,
  Repeat,
  Volume2,
  VolumeX,
  Volume1,
  ListMusic,
  Settings as SettingsIcon,
  Trash2,
  Plus,
  Keyboard,
  Disc,
  RefreshCw,
  Folder,
  User,
  Library,
  Tag,
  History,
  X
} from "lucide-react";
import { usePlayerStore } from "./store/playerStore";
import type { Song } from "./store/playerStore";
import audio from "./lib/audio";

function App() {
  const {
    library,
    currentFolder,
    activeTab,
    searchQuery,
    queue,
    currentIndex,
    currentSong,
    currentCover,
    isLoadingCover,
    isPlaying,
    volume,
    isMuted,
    progress,
    duration,
    isShuffle,
    isRepeat,
    playbackError,
    selectAndScanFolder,
    scanFolder,
    clearLibrary,
    setSearchQuery,
    setActiveTab,
    playQueue,
    addToQueue,
    removeFromQueue,
    clearQueue,
    togglePlay,
    setVolume,
    toggleMute,
    setProgress,
    nextSong,
    prevSong,
    toggleShuffle,
    toggleRepeat,
    setPlaybackError,
    playlists,
    history,
    loadPlaylists,
    createPlaylist,
    deletePlaylist,
    addSongToPlaylist,
    removeSongFromPlaylist,
    loadHistory,
    recordSongPlayed,
    loadStreamPort,
  } = usePlayerStore();

  const [hoveredTrack, setHoveredTrack] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<string | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [selectedPlaylist, setSelectedPlaylist] = useState<string | null>(null);
  const [playlistMenuTrack, setPlaylistMenuTrack] = useState<Song | null>(null);
  const progressBarRef = useRef<HTMLInputElement>(null);
  const loggedRef = useRef<string | null>(null);

  // Sync playback state
  useEffect(() => {
    if (isPlaying) {
      audio.play().catch((err) => console.error("Playback failed:", err));
    } else {
      audio.pause();
    }
  }, [isPlaying, currentSong]);

  // Sync volume
  useEffect(() => {
    audio.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  // Load playlists, history, and local stream port on mount
  useEffect(() => {
    loadPlaylists();
    loadHistory();
    loadStreamPort();
  }, [loadPlaylists, loadHistory, loadStreamPort]);

  // Track 30-second playback trigger to log history
  useEffect(() => {
    if (!currentSong) {
      loggedRef.current = null;
      return;
    }
    if (loggedRef.current !== currentSong.path) {
      loggedRef.current = null;
    }
    if (loggedRef.current === null && progress >= Math.min(30, duration - 1) && duration > 0) {
      loggedRef.current = currentSong.path;
      recordSongPlayed(currentSong);
    }
  }, [progress, duration, currentSong, recordSongPlayed]);

  // Attach audio event listeners
  useEffect(() => {
    const handleTimeUpdate = () => {
      usePlayerStore.setState({ progress: audio.currentTime });
    };

    const handleDurationChange = () => {
      usePlayerStore.setState({ duration: audio.duration || 0 });
    };

    const handleEnded = () => {
      if (usePlayerStore.getState().isRepeat === "one") {
        audio.currentTime = 0;
        audio.play().catch((err) => console.error("Repeat failed:", err));
      } else {
        nextSong();
      }
    };

    const handleError = () => {
      const err = audio.error;
      let msg = "Unknown audio playback error";
      if (err) {
        switch (err.code) {
          case 1:
            msg = "Playback aborted by user or system";
            break;
          case 2:
            msg = "Network connectivity error occurred";
            break;
          case 3:
            msg = "Audio decoding failed (codec missing or file corrupt)";
            break;
          case 4:
            msg = "Format not supported or access denied (Tauri asset scope violation). Verify GStreamer plugins are installed.";
            break;
        }
        msg += ` (Code ${err.code})`;
      }
      setPlaybackError(msg);
      usePlayerStore.setState({ isPlaying: false });
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
    };
  }, [nextSong, setPlaybackError]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      switch (e.code) {
        case "Space":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          setProgress(Math.max(0, audio.currentTime - 5));
          break;
        case "ArrowRight":
          e.preventDefault();
          setProgress(Math.min(audio.duration || 0, audio.currentTime + 5));
          break;
        case "ArrowUp":
          e.preventDefault();
          setVolume(Math.min(1, volume + 0.05));
          break;
        case "ArrowDown":
          e.preventDefault();
          setVolume(Math.max(0, volume - 0.05));
          break;
        case "KeyM":
          e.preventDefault();
          toggleMute();
          break;
        case "KeyS":
          e.preventDefault();
          toggleShuffle();
          break;
        case "KeyR":
          e.preventDefault();
          toggleRepeat();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [togglePlay, setProgress, setVolume, toggleMute, toggleShuffle, toggleRepeat, volume]);

  const selectTab = (tab: typeof activeTab) => {
    setActiveTab(tab);
    setSelectedArtist(null);
    setSelectedAlbum(null);
    setSelectedGenre(null);
    setSelectedPlaylist(null);
  };

  const handleScan = async () => {
    if (isScanning) return;
    setIsScanning(true);
    try {
      await selectAndScanFolder();
    } finally {
      setIsScanning(false);
    }
  };

  const handleRescan = async () => {
    if (!currentFolder || isScanning) return;
    setIsScanning(true);
    try {
      await scanFolder(currentFolder);
    } catch (e) {
      console.error(e);
    } finally {
      setIsScanning(false);
    }
  };

  // Helper formatting function
  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs === Infinity) return "0:00";
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  // Filter library by search query
  const filteredLibrary = library.filter((song) => {
    const query = searchQuery.toLowerCase();
    return (
      song.title.toLowerCase().includes(query) ||
      song.artist.toLowerCase().includes(query) ||
      song.album.toLowerCase().includes(query)
    );
  });

  return (
    <div className="h-screen w-screen bg-zinc-950 text-zinc-100 flex flex-col overflow-hidden relative select-none">
      {/* Background Glows (Glassmorphism Aurora effect) */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl animate-pulse-slow pointer-events-none"></div>
      <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-fuchsia-600/10 rounded-full blur-3xl animate-pulse-slow pointer-events-none" style={{ animationDelay: "3s" }}></div>

      {/* Main Workspace layout */}
      <div className="flex-1 flex overflow-hidden z-10">
        
        {/* Sidebar */}
        <aside className="w-64 bg-zinc-900/60 border-r border-zinc-800/50 backdrop-blur-md flex flex-col p-6 gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Music className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white leading-none">Choros</h1>
              <span className="text-[10px] text-zinc-400 font-semibold tracking-widest uppercase">Offline Player</span>
            </div>
          </div>

          <div className="flex flex-col gap-1 overflow-y-auto pr-1">
            <button
              onClick={() => selectTab("library")}
              className={`flex items-center gap-3 px-4 py-2 rounded-xl transition text-sm font-medium ${
                activeTab === "library"
                  ? "bg-violet-600/20 text-violet-400 border border-violet-500/20 shadow-inner"
                  : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/40"
              }`}
            >
              <Music className="w-4 h-4" />
              <span>Songs</span>
            </button>
            <button
              onClick={() => selectTab("artists")}
              className={`flex items-center gap-3 px-4 py-2 rounded-xl transition text-sm font-medium ${
                activeTab === "artists"
                  ? "bg-violet-600/20 text-violet-400 border border-violet-500/20 shadow-inner"
                  : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/40"
              }`}
            >
              <User className="w-4 h-4" />
              <span>Artists</span>
            </button>
            <button
              onClick={() => selectTab("albums")}
              className={`flex items-center gap-3 px-4 py-2 rounded-xl transition text-sm font-medium ${
                activeTab === "albums"
                  ? "bg-violet-600/20 text-violet-400 border border-violet-500/20 shadow-inner"
                  : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/40"
              }`}
            >
              <Library className="w-4 h-4" />
              <span>Albums</span>
            </button>
            <button
              onClick={() => selectTab("genres")}
              className={`flex items-center gap-3 px-4 py-2 rounded-xl transition text-sm font-medium ${
                activeTab === "genres"
                  ? "bg-violet-600/20 text-violet-400 border border-violet-500/20 shadow-inner"
                  : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/40"
              }`}
            >
              <Tag className="w-4 h-4" />
              <span>Genres</span>
            </button>
            <button
              onClick={() => selectTab("playlists")}
              className={`flex items-center gap-3 px-4 py-2 rounded-xl transition text-sm font-medium ${
                activeTab === "playlists"
                  ? "bg-violet-600/20 text-violet-400 border border-violet-500/20 shadow-inner"
                  : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/40"
              }`}
            >
              <ListMusic className="w-4 h-4" />
              <span>Playlists</span>
            </button>
            <button
              onClick={() => selectTab("history")}
              className={`flex items-center gap-3 px-4 py-2 rounded-xl transition text-sm font-medium ${
                activeTab === "history"
                  ? "bg-violet-600/20 text-violet-400 border border-violet-500/20 shadow-inner"
                  : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/40"
              }`}
            >
              <History className="w-4 h-4" />
              <span>Play History</span>
            </button>
            <hr className="border-zinc-850 my-1" />
            <button
              onClick={() => selectTab("queue")}
              className={`flex items-center gap-3 px-4 py-2 rounded-xl transition text-sm font-medium relative ${
                activeTab === "queue"
                  ? "bg-violet-600/20 text-violet-400 border border-violet-500/20 shadow-inner"
                  : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/40"
              }`}
            >
              <ListMusic className="w-4 h-4" />
              <span>Play Queue</span>
              {queue.length > 0 && (
                <span className="absolute right-4 text-[10px] bg-violet-600 text-white font-bold px-1.5 py-0.5 rounded-full">
                  {queue.length}
                </span>
              )}
            </button>
            <button
              onClick={() => selectTab("settings")}
              className={`flex items-center gap-3 px-4 py-2 rounded-xl transition text-sm font-medium ${
                activeTab === "settings"
                  ? "bg-violet-600/20 text-violet-400 border border-violet-500/20 shadow-inner"
                  : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/40"
              }`}
            >
              <SettingsIcon className="w-4 h-4" />
              <span>Settings</span>
            </button>
          </div>

          <hr className="border-zinc-800/60" />

          {/* Folder import details */}
          <div className="flex-1 flex flex-col justify-end gap-3 text-xs text-zinc-400">
            {currentFolder ? (
              <div className="bg-zinc-950/40 border border-zinc-800/50 p-3.5 rounded-xl flex flex-col gap-2">
                <div className="flex items-center gap-2 text-zinc-300 font-medium">
                  <Folder className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
                  <span className="truncate">Active Library</span>
                </div>
                <p className="font-mono text-[10px] text-zinc-500 break-all leading-normal">
                  {currentFolder}
                </p>
                <div className="flex gap-2 mt-1">
                  <button
                    onClick={handleRescan}
                    disabled={isScanning}
                    className="flex-1 py-1.5 px-2 bg-zinc-800 hover:bg-zinc-700/80 rounded-lg flex items-center justify-center gap-1.5 text-[10px] font-semibold text-zinc-300 border border-zinc-700/30 transition disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${isScanning ? "animate-spin" : ""}`} />
                    <span>Rescan</span>
                  </button>
                  <button
                    onClick={handleScan}
                    disabled={isScanning}
                    className="py-1.5 px-2 bg-zinc-800 hover:bg-zinc-700/80 rounded-lg text-zinc-300 border border-zinc-700/30 transition disabled:opacity-50"
                    title="Change Folder"
                  >
                    <FolderOpen className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={handleScan}
                disabled={isScanning}
                className="w-full py-3 px-4 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-violet-500/25 transition duration-300 disabled:opacity-50 cursor-pointer"
              >
                <FolderOpen className="w-4 h-4" />
                <span>Import Folder</span>
              </button>
            )}
          </div>
        </aside>

        {/* Central Viewport */}
        <main className="flex-1 flex flex-col overflow-hidden bg-zinc-950/30">
          {library.length === 0 ? (
            // Empty Library Landing Page
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-lg mx-auto">
              <div className="w-20 h-20 rounded-3xl bg-zinc-900 border border-zinc-800/80 flex items-center justify-center mb-6 shadow-xl relative">
                <Disc className="w-10 h-10 text-violet-500 animate-pulse" />
                <div className="absolute inset-0 rounded-3xl bg-violet-500/5 blur-xl"></div>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Build your Music Library</h2>
              <p className="text-zinc-400 text-sm mb-8 leading-relaxed">
                Scan folders on your computer containing MP3s, FLACs, or AACs to organize them. Choros will extract the artists, tracks, and artwork instantly.
              </p>
              <button
                onClick={handleScan}
                disabled={isScanning}
                className="px-6 py-3 bg-white hover:bg-zinc-200 text-zinc-950 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-white/5 transition duration-300 cursor-pointer disabled:opacity-50"
              >
                <FolderOpen className="w-4 h-4" />
                {isScanning ? "Scanning Directory..." : "Select Local Music Folder"}
              </button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden p-8 gap-6">
              {playbackError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center justify-between text-xs transition duration-200">
                  <div className="flex flex-col gap-1 pr-4">
                    <span className="font-bold text-sm text-red-300">Playback Failed</span>
                    <span className="leading-relaxed">{playbackError}</span>
                  </div>
                  <button
                    onClick={() => setPlaybackError(null)}
                    className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/25 border border-red-500/20 hover:border-red-500/30 rounded-lg text-red-300 transition cursor-pointer font-semibold"
                  >
                    Dismiss
                  </button>
                </div>
              )}
              
              {/* Library Tab */}
              {activeTab === "library" && (
                <div className="flex-1 flex flex-col overflow-hidden gap-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-3xl font-extrabold text-white tracking-tight">Music Library</h2>
                      <p className="text-xs text-zinc-400 mt-1 font-medium">
                        Showing {filteredLibrary.length} of {library.length} songs
                      </p>
                    </div>

                    {/* Search Bar */}
                    <div className="relative w-full sm:w-72">
                      <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search songs, artists, albums..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-zinc-900/50 hover:bg-zinc-900/80 border border-zinc-800/80 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none transition text-white placeholder-zinc-500"
                      />
                    </div>
                  </div>

                  {/* Songs Table */}
                  <div className="flex-1 overflow-y-auto pr-1 border border-zinc-900/60 rounded-2xl bg-zinc-900/10 backdrop-blur-sm">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-900 text-[11px] font-bold text-zinc-500 tracking-wider uppercase">
                          <th className="py-3.5 px-4 w-12 text-center">#</th>
                          <th className="py-3.5 px-4">Title</th>
                          <th className="py-3.5 px-4 hidden md:table-cell">Album</th>
                          <th className="py-3.5 px-4 w-16 text-center">Length</th>
                          <th className="py-3.5 px-4 w-20 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-900/50">
                        {filteredLibrary.map((song, i) => {
                          const isCurrent = currentSong?.path === song.path;
                          return (
                            <tr
                              key={song.path}
                              onMouseEnter={() => setHoveredTrack(song.path)}
                              onMouseLeave={() => setHoveredTrack(null)}
                              onClick={() => playQueue(filteredLibrary, i)}
                              className={`group text-sm transition duration-150 cursor-pointer ${
                                isCurrent
                                  ? "bg-violet-600/10 text-violet-400 hover:bg-violet-600/15"
                                  : "hover:bg-zinc-900/35 text-zinc-300 hover:text-zinc-100"
                              }`}
                            >
                              {/* Index / Play Control Column */}
                              <td className="py-3.5 px-4 text-center font-medium font-mono text-xs">
                                {hoveredTrack === song.path ? (
                                  isCurrent && isPlaying ? (
                                    <Pause className="w-3.5 h-3.5 text-violet-400 mx-auto" />
                                  ) : (
                                    <Play className="w-3.5 h-3.5 text-zinc-300 group-hover:text-white mx-auto fill-current" />
                                  )
                                ) : isCurrent && isPlaying ? (
                                  // Waveform anim
                                  <div className="flex items-end justify-center gap-0.5 h-3 w-4 mx-auto">
                                    <div className="w-0.5 bg-violet-400 rounded-full animate-bounce-custom-1"></div>
                                    <div className="w-0.5 bg-violet-400 rounded-full animate-bounce-custom-2"></div>
                                    <div className="w-0.5 bg-violet-400 rounded-full animate-bounce-custom-3"></div>
                                  </div>
                                ) : (
                                  <span className="text-zinc-500">{i + 1}</span>
                                )}
                              </td>

                              {/* Title & Artist */}
                              <td className="py-3.5 px-4 min-w-[200px]">
                                <div className="font-semibold truncate max-w-[250px] sm:max-w-[320px]">
                                  {song.title}
                                </div>
                                <div className="text-xs text-zinc-400 group-hover:text-zinc-300 font-medium truncate mt-0.5 max-w-[250px]">
                                  {song.artist}
                                </div>
                              </td>

                              {/* Album */}
                              <td className="py-3.5 px-4 text-zinc-400 group-hover:text-zinc-300 hidden md:table-cell font-medium truncate max-w-[200px]">
                                {song.album}
                              </td>

                              {/* Duration */}
                              <td className="py-3.5 px-4 text-center font-mono text-xs text-zinc-400">
                                {formatTime(song.duration)}
                              </td>

                              {/* Actions Column */}
                              <td className="py-3.5 px-4 text-center">
                                <div className="flex justify-center gap-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      addToQueue(song);
                                    }}
                                    className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-white transition"
                                    title="Add to queue"
                                  >
                                    <ListMusic className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPlaylistMenuTrack(song);
                                    }}
                                    className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-white transition"
                                    title="Add to playlist"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Artists Tab */}
              {activeTab === "artists" && (
                <div className="flex-1 flex flex-col overflow-hidden gap-4 animate-in fade-in duration-150">
                  {!selectedArtist ? (
                    <>
                      <div>
                        <h2 className="text-3xl font-extrabold text-white tracking-tight">Artists</h2>
                        <p className="text-xs text-zinc-400 mt-1 font-medium">
                          Showing {Object.keys(library.reduce((acc, song) => {
                            const artist = song.artist || "Unknown Artist";
                            if (!acc[artist]) acc[artist] = [];
                            acc[artist].push(song);
                            return acc;
                          }, {} as Record<string, Song[]>)).length} artists in your library
                        </p>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {Object.keys(library.reduce((acc, song) => {
                          const artist = song.artist || "Unknown Artist";
                          if (!acc[artist]) acc[artist] = [];
                          acc[artist].push(song);
                          return acc;
                        }, {} as Record<string, Song[]>)).sort().map((artist) => {
                          const songs = library.filter(s => (s.artist || "Unknown Artist") === artist);
                          return (
                            <div
                              key={artist}
                              onClick={() => setSelectedArtist(artist)}
                              className="bg-zinc-900/30 hover:bg-zinc-900/60 border border-zinc-800/40 hover:border-violet-500/25 p-5 rounded-2xl cursor-pointer transition duration-300 flex flex-col items-center text-center group"
                            >
                              <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-violet-600/20 to-fuchsia-600/20 flex items-center justify-center mb-4 border border-zinc-800 group-hover:scale-105 transition duration-300 relative">
                                <User className="w-9 h-9 text-violet-400" />
                                <div className="absolute inset-0 rounded-full bg-violet-500/5 blur-md opacity-0 group-hover:opacity-100 transition duration-300"></div>
                              </div>
                              <h3 className="font-bold text-sm text-white truncate w-full group-hover:text-violet-400 transition">
                                {artist}
                              </h3>
                              <p className="text-xs text-zinc-500 font-medium mt-1">
                                {songs.length} {songs.length === 1 ? "track" : "tracks"}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    // Artist Detail View
                    <div className="flex-1 flex flex-col overflow-hidden gap-4 animate-in slide-in-from-left-4 duration-200">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setSelectedArtist(null)}
                          className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white transition cursor-pointer"
                        >
                          &larr; Back to Artists
                        </button>
                        <h2 className="text-2xl font-bold text-white truncate max-w-md">
                          {selectedArtist}
                        </h2>
                      </div>
                      
                      {/* Songs list by this artist */}
                      <div className="flex-1 overflow-y-auto pr-1 border border-zinc-900/60 rounded-2xl bg-zinc-900/10 backdrop-blur-sm">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-zinc-900 text-[11px] font-bold text-zinc-500 tracking-wider uppercase">
                              <th className="py-3.5 px-4 w-12 text-center">#</th>
                              <th className="py-3.5 px-4">Title</th>
                              <th className="py-3.5 px-4">Album</th>
                              <th className="py-3.5 px-4 w-16 text-center">Length</th>
                              <th className="py-3.5 px-4 w-20 text-center"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-900/50">
                            {library.filter(s => (s.artist || "Unknown Artist") === selectedArtist).map((song, i, arr) => {
                              const isCurrent = currentSong?.path === song.path;
                              return (
                                <tr
                                  key={song.path}
                                  onMouseEnter={() => setHoveredTrack(song.path)}
                                  onMouseLeave={() => setHoveredTrack(null)}
                                  onClick={() => playQueue(arr, i)}
                                  className={`group text-sm transition duration-150 cursor-pointer ${
                                    isCurrent
                                      ? "bg-violet-600/10 text-violet-400 hover:bg-violet-600/15"
                                      : "hover:bg-zinc-900/35 text-zinc-300 hover:text-zinc-100"
                                  }`}
                                >
                                  <td className="py-3.5 px-4 text-center font-medium font-mono text-xs">
                                    {hoveredTrack === song.path ? (
                                      isCurrent && isPlaying ? (
                                        <Pause className="w-3.5 h-3.5 text-violet-400 mx-auto" />
                                      ) : (
                                        <Play className="w-3.5 h-3.5 text-zinc-300 group-hover:text-white mx-auto fill-current" />
                                      )
                                    ) : isCurrent && isPlaying ? (
                                      <div className="flex items-end justify-center gap-0.5 h-3 w-4 mx-auto">
                                        <div className="w-0.5 bg-violet-400 rounded-full animate-bounce-custom-1"></div>
                                        <div className="w-0.5 bg-violet-400 rounded-full animate-bounce-custom-2"></div>
                                        <div className="w-0.5 bg-violet-400 rounded-full animate-bounce-custom-3"></div>
                                      </div>
                                    ) : (
                                      <span className="text-zinc-500">{i + 1}</span>
                                    )}
                                  </td>
                                  <td className="py-3.5 px-4 font-semibold truncate max-w-xs">{song.title}</td>
                                  <td className="py-3.5 px-4 text-zinc-400 group-hover:text-zinc-300 font-medium truncate max-w-xs">{song.album}</td>
                                  <td className="py-3.5 px-4 text-center font-mono text-xs text-zinc-400">{formatTime(song.duration)}</td>
                                  <td className="py-3.5 px-4 text-center">
                                    <div className="flex justify-center gap-1">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          addToQueue(song);
                                        }}
                                        className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-white transition"
                                        title="Add to queue"
                                      >
                                        <ListMusic className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setPlaylistMenuTrack(song);
                                        }}
                                        className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-white transition"
                                        title="Add to playlist"
                                      >
                                        <Plus className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Albums Tab */}
              {activeTab === "albums" && (
                <div className="flex-1 flex flex-col overflow-hidden gap-4 animate-in fade-in duration-150">
                  {!selectedAlbum ? (
                    <>
                      <div>
                        <h2 className="text-3xl font-extrabold text-white tracking-tight">Albums</h2>
                        <p className="text-xs text-zinc-400 mt-1 font-medium">
                          Showing {Object.keys(library.reduce((acc, song) => {
                            const album = song.album || "Unknown Album";
                            if (!acc[album]) acc[album] = [];
                            acc[album].push(song);
                            return acc;
                          }, {} as Record<string, Song[]>)).length} albums in your library
                        </p>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {Object.keys(library.reduce((acc, song) => {
                          const album = song.album || "Unknown Album";
                          if (!acc[album]) acc[album] = [];
                          acc[album].push(song);
                          return acc;
                        }, {} as Record<string, Song[]>)).sort().map((album) => {
                          const songs = library.filter(s => (s.album || "Unknown Album") === album);
                          const artist = songs[0]?.artist || "Unknown Artist";
                          return (
                            <div
                              key={album}
                              onClick={() => setSelectedAlbum(album)}
                              className="bg-zinc-900/30 hover:bg-zinc-900/60 border border-zinc-800/40 hover:border-violet-500/25 p-4 rounded-2xl cursor-pointer transition duration-300 flex flex-col group"
                            >
                              <div className="w-full aspect-square rounded-xl bg-gradient-to-tr from-violet-600/10 to-fuchsia-600/10 flex items-center justify-center mb-4 border border-zinc-800 group-hover:scale-102 transition duration-300 relative overflow-hidden shadow-md">
                                <Disc className="w-12 h-12 text-violet-400/80 group-hover:rotate-12 transition duration-550" />
                                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition duration-300 flex items-end p-3">
                                  <span className="text-[10px] text-white font-bold bg-violet-600/90 px-2 py-1 rounded-lg">
                                    {songs.length} tracks
                                  </span>
                                </div>
                              </div>
                              <h3 className="font-bold text-sm text-white truncate group-hover:text-violet-400 transition" title={album}>
                                {album}
                              </h3>
                              <p className="text-xs text-zinc-500 font-medium truncate mt-0.5" title={artist}>
                                {artist}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    // Album Detail View
                    <div className="flex-1 flex flex-col overflow-hidden gap-4 animate-in slide-in-from-left-4 duration-200">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setSelectedAlbum(null)}
                          className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white transition cursor-pointer"
                        >
                          &larr; Back to Albums
                        </button>
                        <h2 className="text-2xl font-bold text-white truncate max-w-md">
                          {selectedAlbum}
                        </h2>
                      </div>
                      
                      {/* Album Info & Songs */}
                      <div className="flex-1 overflow-y-auto pr-1 border border-zinc-900/60 rounded-2xl bg-zinc-900/10 backdrop-blur-sm">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-zinc-900 text-[11px] font-bold text-zinc-500 tracking-wider uppercase">
                              <th className="py-3.5 px-4 w-12 text-center">Track</th>
                              <th className="py-3.5 px-4">Title</th>
                              <th className="py-3.5 px-4">Artist</th>
                              <th className="py-3.5 px-4 w-16 text-center">Length</th>
                              <th className="py-3.5 px-4 w-20 text-center"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-900/50">
                            {library.filter(s => (s.album || "Unknown Album") === selectedAlbum).sort((a, b) => {
                              const trackA = a.track !== null && a.track !== undefined ? a.track : 999;
                              const trackB = b.track !== null && b.track !== undefined ? b.track : 999;
                              return trackA - trackB;
                            }).map((song, i, arr) => {
                              const isCurrent = currentSong?.path === song.path;
                              return (
                                <tr
                                  key={song.path}
                                  onMouseEnter={() => setHoveredTrack(song.path)}
                                  onMouseLeave={() => setHoveredTrack(null)}
                                  onClick={() => playQueue(arr, i)}
                                  className={`group text-sm transition duration-150 cursor-pointer ${
                                    isCurrent
                                      ? "bg-violet-600/10 text-violet-400 hover:bg-violet-600/15"
                                      : "hover:bg-zinc-900/35 text-zinc-300 hover:text-zinc-100"
                                  }`}
                                >
                                  <td className="py-3.5 px-4 text-center font-medium font-mono text-xs text-zinc-500">
                                    {hoveredTrack === song.path ? (
                                      isCurrent && isPlaying ? (
                                        <Pause className="w-3.5 h-3.5 text-violet-400 mx-auto" />
                                      ) : (
                                        <Play className="w-3.5 h-3.5 text-zinc-300 group-hover:text-white mx-auto fill-current" />
                                      )
                                    ) : isCurrent && isPlaying ? (
                                      <div className="flex items-end justify-center gap-0.5 h-3 w-4 mx-auto">
                                        <div className="w-0.5 bg-violet-400 rounded-full animate-bounce-custom-1"></div>
                                        <div className="w-0.5 bg-violet-400 rounded-full animate-bounce-custom-2"></div>
                                        <div className="w-0.5 bg-violet-400 rounded-full animate-bounce-custom-3"></div>
                                      </div>
                                    ) : (
                                      song.track !== null && song.track !== undefined ? song.track : i + 1
                                    )}
                                  </td>
                                  <td className="py-3.5 px-4 font-semibold truncate max-w-xs">{song.title}</td>
                                  <td className="py-3.5 px-4 text-zinc-400 group-hover:text-zinc-300 font-medium truncate max-w-xs">{song.artist}</td>
                                  <td className="py-3.5 px-4 text-center font-mono text-xs text-zinc-400">{formatTime(song.duration)}</td>
                                  <td className="py-3.5 px-4 text-center">
                                    <div className="flex justify-center gap-1">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          addToQueue(song);
                                        }}
                                        className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-white transition"
                                        title="Add to queue"
                                      >
                                        <ListMusic className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setPlaylistMenuTrack(song);
                                        }}
                                        className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-white transition"
                                        title="Add to playlist"
                                      >
                                        <Plus className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Genres Tab */}
              {activeTab === "genres" && (
                <div className="flex-1 flex flex-col overflow-hidden gap-4 animate-in fade-in duration-150">
                  {!selectedGenre ? (
                    <>
                      <div>
                        <h2 className="text-3xl font-extrabold text-white tracking-tight">Genres</h2>
                        <p className="text-xs text-zinc-400 mt-1 font-medium">
                          Showing {Object.keys(library.reduce((acc, song) => {
                            const genre = song.genre || "Unknown Genre";
                            if (!acc[genre]) acc[genre] = [];
                            acc[genre].push(song);
                            return acc;
                          }, {} as Record<string, Song[]>)).length} genres in your library
                        </p>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {Object.keys(library.reduce((acc, song) => {
                          const genre = song.genre || "Unknown Genre";
                          if (!acc[genre]) acc[genre] = [];
                          acc[genre].push(song);
                          return acc;
                        }, {} as Record<string, Song[]>)).sort().map((genre) => {
                          const songs = library.filter(s => (s.genre || "Unknown Genre") === genre);
                          return (
                            <div
                              key={genre}
                              onClick={() => setSelectedGenre(genre)}
                              className="bg-zinc-900/30 hover:bg-zinc-900/60 border border-zinc-800/40 hover:border-violet-500/25 p-5 rounded-2xl cursor-pointer transition duration-300 flex flex-col items-center text-center group"
                            >
                              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-violet-600/20 to-fuchsia-600/20 flex items-center justify-center mb-4 border border-zinc-800 group-hover:scale-105 transition duration-300">
                                <Tag className="w-7 h-7 text-violet-400" />
                              </div>
                              <h3 className="font-bold text-sm text-white truncate w-full group-hover:text-violet-400 transition">
                                {genre}
                              </h3>
                              <p className="text-xs text-zinc-500 font-medium mt-1">
                                {songs.length} {songs.length === 1 ? "track" : "tracks"}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    // Genre Detail View
                    <div className="flex-1 flex flex-col overflow-hidden gap-4 animate-in slide-in-from-left-4 duration-200">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setSelectedGenre(null)}
                          className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white transition cursor-pointer"
                        >
                          &larr; Back to Genres
                        </button>
                        <h2 className="text-2xl font-bold text-white truncate max-w-md">
                          {selectedGenre}
                        </h2>
                      </div>
                      
                      {/* Songs inside Genre */}
                      <div className="flex-1 overflow-y-auto pr-1 border border-zinc-900/60 rounded-2xl bg-zinc-900/10 backdrop-blur-sm">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-zinc-900 text-[11px] font-bold text-zinc-500 tracking-wider uppercase">
                              <th className="py-3.5 px-4 w-12 text-center">#</th>
                              <th className="py-3.5 px-4">Title</th>
                              <th className="py-3.5 px-4">Artist</th>
                              <th className="py-3.5 px-4">Album</th>
                              <th className="py-3.5 px-4 w-16 text-center">Length</th>
                              <th className="py-3.5 px-4 w-20 text-center"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-900/50">
                            {library.filter(s => (s.genre || "Unknown Genre") === selectedGenre).map((song, i, arr) => {
                              const isCurrent = currentSong?.path === song.path;
                              return (
                                <tr
                                  key={song.path}
                                  onMouseEnter={() => setHoveredTrack(song.path)}
                                  onMouseLeave={() => setHoveredTrack(null)}
                                  onClick={() => playQueue(arr, i)}
                                  className={`group text-sm transition duration-150 cursor-pointer ${
                                    isCurrent
                                      ? "bg-violet-600/10 text-violet-400 hover:bg-violet-600/15"
                                      : "hover:bg-zinc-900/35 text-zinc-300 hover:text-zinc-100"
                                  }`}
                                >
                                  <td className="py-3.5 px-4 text-center font-medium font-mono text-xs">
                                    {hoveredTrack === song.path ? (
                                      isCurrent && isPlaying ? (
                                        <Pause className="w-3.5 h-3.5 text-violet-400 mx-auto" />
                                      ) : (
                                        <Play className="w-3.5 h-3.5 text-zinc-300 group-hover:text-white mx-auto fill-current" />
                                      )
                                    ) : isCurrent && isPlaying ? (
                                      <div className="flex items-end justify-center gap-0.5 h-3 w-4 mx-auto">
                                        <div className="w-0.5 bg-violet-400 rounded-full animate-bounce-custom-1"></div>
                                        <div className="w-0.5 bg-violet-400 rounded-full animate-bounce-custom-2"></div>
                                        <div className="w-0.5 bg-violet-400 rounded-full animate-bounce-custom-3"></div>
                                      </div>
                                    ) : (
                                      <span className="text-zinc-500">{i + 1}</span>
                                    )}
                                  </td>
                                  <td className="py-3.5 px-4 font-semibold truncate max-w-xs">{song.title}</td>
                                  <td className="py-3.5 px-4 text-zinc-400 group-hover:text-zinc-300 font-medium truncate max-w-xs">{song.artist}</td>
                                  <td className="py-3.5 px-4 text-zinc-400 group-hover:text-zinc-300 font-medium truncate max-w-xs">{song.album}</td>
                                  <td className="py-3.5 px-4 text-center font-mono text-xs text-zinc-400">{formatTime(song.duration)}</td>
                                  <td className="py-3.5 px-4 text-center">
                                    <div className="flex justify-center gap-1">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          addToQueue(song);
                                        }}
                                        className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-white transition"
                                        title="Add to queue"
                                      >
                                        <ListMusic className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setPlaylistMenuTrack(song);
                                        }}
                                        className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-white transition"
                                        title="Add to playlist"
                                      >
                                        <Plus className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Playlists Tab */}
              {activeTab === "playlists" && (
                <div className="flex-1 flex flex-col overflow-hidden gap-4 animate-in fade-in duration-150">
                  {!selectedPlaylist ? (
                    <>
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-3xl font-extrabold text-white tracking-tight">Playlists</h2>
                          <p className="text-xs text-zinc-400 mt-1 font-medium">
                            Manage your personal audio playlists
                          </p>
                        </div>
                        
                        <button
                          onClick={() => {
                            const name = prompt("Enter playlist name:");
                            if (name && name.trim()) {
                              createPlaylist(name.trim());
                            }
                          }}
                          className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-semibold transition flex items-center gap-2 cursor-pointer shadow-lg shadow-violet-500/10"
                        >
                          <Plus className="w-4 h-4" />
                          <span>New Playlist</span>
                        </button>
                      </div>
                      
                      {Object.keys(playlists).length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 border border-dashed border-zinc-800 rounded-2xl text-center">
                          <ListMusic className="w-12 h-12 text-zinc-600 mb-4 animate-pulse" />
                          <h3 className="text-lg font-bold text-zinc-400">No Playlists</h3>
                          <p className="text-zinc-500 text-xs mt-1 max-w-xs leading-normal">
                            Click 'New Playlist' or use the add button on tracks to start organizing.
                          </p>
                        </div>
                      ) : (
                        <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                          {Object.keys(playlists).map((name) => {
                            const songs = playlists[name] || [];
                            return (
                              <div
                                key={name}
                                onClick={() => setSelectedPlaylist(name)}
                                className="bg-zinc-900/30 hover:bg-zinc-900/60 border border-zinc-800/40 hover:border-violet-500/25 p-5 rounded-2xl cursor-pointer transition duration-300 flex flex-col group relative"
                              >
                                <div className="w-full aspect-square rounded-xl bg-gradient-to-tr from-violet-600/15 to-fuchsia-600/15 flex items-center justify-center mb-4 border border-zinc-800 group-hover:scale-102 transition duration-300 relative shadow-inner">
                                  <ListMusic className="w-10 h-10 text-violet-400/80 group-hover:scale-110 transition duration-300" />
                                </div>
                                <h3 className="font-bold text-sm text-white truncate w-full group-hover:text-violet-400 transition" title={name}>
                                  {name}
                                </h3>
                                <p className="text-xs text-zinc-500 font-medium mt-1">
                                  {songs.length} {songs.length === 1 ? "track" : "tracks"}
                                </p>
                                
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (confirm(`Are you sure you want to delete playlist "${name}"?`)) {
                                      await deletePlaylist(name);
                                    }
                                  }}
                                  className="absolute top-3 right-3 p-1.5 bg-zinc-950/80 hover:bg-red-500/20 border border-zinc-800/40 hover:border-red-500/30 text-zinc-500 hover:text-red-400 rounded-lg transition duration-200 opacity-0 group-hover:opacity-100 cursor-pointer"
                                  title="Delete playlist"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  ) : (
                    // Playlist Detail View
                    <div className="flex-1 flex flex-col overflow-hidden gap-4 animate-in slide-in-from-left-4 duration-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setSelectedPlaylist(null)}
                            className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white transition cursor-pointer"
                          >
                            &larr; Back to Playlists
                          </button>
                          <h2 className="text-2xl font-bold text-white truncate max-w-md">
                            {selectedPlaylist}
                          </h2>
                        </div>
                        
                        {(playlists[selectedPlaylist] || []).length > 0 && (
                          <button
                            onClick={() => playQueue(playlists[selectedPlaylist!], 0)}
                            className="px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-semibold transition flex items-center gap-2 hover:shadow-lg hover:shadow-violet-500/25 duration-300 cursor-pointer"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>Play Playlist</span>
                          </button>
                        )}
                      </div>
                      
                      {/* Songs inside Playlist */}
                      {(playlists[selectedPlaylist] || []).length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 border border-dashed border-zinc-800 rounded-2xl text-center">
                          <Music className="w-12 h-12 text-zinc-600 mb-4" />
                          <h3 className="text-lg font-bold text-zinc-400">Playlist is empty</h3>
                          <p className="text-zinc-500 text-xs mt-1 max-w-xs leading-normal">
                            Go to 'Songs' or other tabs and click the '+' button to add songs here.
                          </p>
                        </div>
                      ) : (
                        <div className="flex-1 overflow-y-auto pr-1 border border-zinc-900/60 rounded-2xl bg-zinc-900/10 backdrop-blur-sm">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b border-zinc-900 text-[11px] font-bold text-zinc-500 tracking-wider uppercase">
                                <th className="py-3.5 px-4 w-12 text-center">#</th>
                                <th className="py-3.5 px-4">Title</th>
                                <th className="py-3.5 px-4">Artist</th>
                                <th className="py-3.5 px-4">Album</th>
                                <th className="py-3.5 px-4 w-16 text-center">Length</th>
                                <th className="py-3.5 px-4 w-12 text-center"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-900/50">
                              {(playlists[selectedPlaylist] || []).map((song, i) => {
                                const isCurrent = currentSong?.path === song.path;
                                return (
                                  <tr
                                    key={song.path}
                                    onMouseEnter={() => setHoveredTrack(song.path)}
                                    onMouseLeave={() => setHoveredTrack(null)}
                                    onClick={() => playQueue(playlists[selectedPlaylist!], i)}
                                    className={`group text-sm transition duration-150 cursor-pointer ${
                                      isCurrent
                                        ? "bg-violet-600/10 text-violet-400 hover:bg-violet-600/15"
                                        : "hover:bg-zinc-900/35 text-zinc-300 hover:text-zinc-100"
                                    }`}
                                  >
                                    <td className="py-3.5 px-4 text-center font-medium font-mono text-xs">
                                      {hoveredTrack === song.path ? (
                                        isCurrent && isPlaying ? (
                                          <Pause className="w-3.5 h-3.5 text-violet-400 mx-auto" />
                                        ) : (
                                          <Play className="w-3.5 h-3.5 text-zinc-300 group-hover:text-white mx-auto fill-current" />
                                        )
                                      ) : isCurrent && isPlaying ? (
                                        <div className="flex items-end justify-center gap-0.5 h-3 w-4 mx-auto">
                                          <div className="w-0.5 bg-violet-400 rounded-full animate-bounce-custom-1"></div>
                                          <div className="w-0.5 bg-violet-400 rounded-full animate-bounce-custom-2"></div>
                                          <div className="w-0.5 bg-violet-400 rounded-full animate-bounce-custom-3"></div>
                                        </div>
                                      ) : (
                                        <span className="text-zinc-500">{i + 1}</span>
                                      )}
                                    </td>
                                    <td className="py-3.5 px-4 font-semibold truncate max-w-xs">{song.title}</td>
                                    <td className="py-3.5 px-4 text-zinc-400 group-hover:text-zinc-300 font-medium truncate max-w-xs">{song.artist}</td>
                                    <td className="py-3.5 px-4 text-zinc-400 group-hover:text-zinc-300 font-medium truncate max-w-xs">{song.album}</td>
                                    <td className="py-3.5 px-4 text-center font-mono text-xs text-zinc-400">{formatTime(song.duration)}</td>
                                    <td className="py-3.5 px-4 text-center">
                                      <button
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          await removeSongFromPlaylist(selectedPlaylist!, song.path);
                                        }}
                                        className="p-1.5 hover:bg-zinc-850 rounded-lg text-zinc-500 hover:text-red-400 transition cursor-pointer"
                                        title="Remove from playlist"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* History Tab */}
              {activeTab === "history" && (
                <div className="flex-1 flex flex-col overflow-hidden gap-4 animate-in fade-in duration-150">
                  <div>
                    <h2 className="text-3xl font-extrabold text-white tracking-tight">Play History</h2>
                    <p className="text-xs text-zinc-400 mt-1 font-medium">
                      Your recent listening log (showing up to 500 tracks)
                    </p>
                  </div>
                  
                  {history.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 border border-dashed border-zinc-800 rounded-2xl text-center">
                      <History className="w-12 h-12 text-zinc-600 mb-4 animate-pulse" />
                      <h3 className="text-lg font-bold text-zinc-400">History is empty</h3>
                      <p className="text-zinc-500 text-xs mt-1 max-w-xs leading-normal">
                        Listen to songs for at least 30 seconds to record them in your listening log.
                      </p>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto pr-1 border border-zinc-900/60 rounded-2xl bg-zinc-900/10 backdrop-blur-sm">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-zinc-900 text-[11px] font-bold text-zinc-500 tracking-wider uppercase">
                            <th className="py-3.5 px-4 w-12 text-center">#</th>
                            <th className="py-3.5 px-4">Title</th>
                            <th className="py-3.5 px-4">Artist</th>
                            <th className="py-3.5 px-4 hidden md:table-cell">Album</th>
                            <th className="py-3.5 px-4 w-16 text-center">Length</th>
                            <th className="py-3.5 px-4 w-20 text-center"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-900/50">
                          {history.map((song, i) => {
                            const isCurrent = currentSong?.path === song.path;
                            return (
                              <tr
                                key={`${song.path}-${i}`}
                                onMouseEnter={() => setHoveredTrack(`${song.path}-${i}`)}
                                onMouseLeave={() => setHoveredTrack(null)}
                                onClick={() => playQueue([song], 0)}
                                className={`group text-sm transition duration-150 cursor-pointer ${
                                  isCurrent
                                    ? "bg-violet-600/10 text-violet-400 hover:bg-violet-600/15"
                                    : "hover:bg-zinc-900/35 text-zinc-300 hover:text-zinc-100"
                                }`}
                              >
                                <td className="py-3.5 px-4 text-center font-medium font-mono text-xs">
                                  {hoveredTrack === `${song.path}-${i}` ? (
                                    isCurrent && isPlaying ? (
                                      <Pause className="w-3.5 h-3.5 text-violet-400 mx-auto" />
                                    ) : (
                                      <Play className="w-3.5 h-3.5 text-zinc-300 group-hover:text-white mx-auto fill-current" />
                                    )
                                  ) : isCurrent && isPlaying ? (
                                    <div className="flex items-end justify-center gap-0.5 h-3 w-4 mx-auto">
                                      <div className="w-0.5 bg-violet-400 rounded-full animate-bounce-custom-1"></div>
                                      <div className="w-0.5 bg-violet-400 rounded-full animate-bounce-custom-2"></div>
                                      <div className="w-0.5 bg-violet-400 rounded-full animate-bounce-custom-3"></div>
                                    </div>
                                  ) : (
                                    <span className="text-zinc-500">{i + 1}</span>
                                  )}
                                </td>
                                <td className="py-3.5 px-4 font-semibold truncate max-w-xs">{song.title}</td>
                                <td className="py-3.5 px-4 text-zinc-400 group-hover:text-zinc-300 font-medium truncate max-w-xs">{song.artist}</td>
                                <td className="py-3.5 px-4 text-zinc-400 group-hover:text-zinc-300 hidden md:table-cell font-medium truncate max-w-xs">{song.album}</td>
                                <td className="py-3.5 px-4 text-center font-mono text-xs text-zinc-400">{formatTime(song.duration)}</td>
                                <td className="py-3.5 px-4 text-center">
                                  <div className="flex justify-center gap-1">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        addToQueue(song);
                                      }}
                                      className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-white transition"
                                      title="Add to queue"
                                    >
                                      <ListMusic className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setPlaylistMenuTrack(song);
                                      }}
                                      className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-white transition"
                                      title="Add to playlist"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Queue Tab */}
              {activeTab === "queue" && (
                <div className="flex-1 flex flex-col overflow-hidden gap-4 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-3xl font-extrabold text-white tracking-tight font-sans">Play Queue</h2>
                      <p className="text-xs text-zinc-400 mt-1 font-medium">
                        {queue.length} songs in queue
                      </p>
                    </div>

                    {queue.length > 0 && (
                      <button
                        onClick={clearQueue}
                        className="px-4 py-2 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/40 text-red-400 rounded-xl text-xs font-semibold transition flex items-center gap-2 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Clear Queue</span>
                      </button>
                    )}
                  </div>

                  {queue.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 border border-dashed border-zinc-800 rounded-2xl text-center">
                      <ListMusic className="w-12 h-12 text-zinc-600 mb-4 animate-pulse" />
                      <h3 className="text-lg font-bold text-zinc-400">Queue is empty</h3>
                      <p className="text-zinc-500 text-xs mt-1 max-w-xs leading-normal">
                        Go back to your Library and double click tracks to load them into the queue.
                      </p>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto border border-zinc-900/60 rounded-2xl bg-zinc-900/10 pr-1">
                      <div className="divide-y divide-zinc-900/50">
                        {queue.map((song, i) => {
                          const isCurrent = currentIndex === i;
                          return (
                            <div
                              key={`${song.path}-${i}`}
                              onClick={() => usePlayerStore.setState({ currentIndex: i, currentSong: song })}
                              className={`group flex items-center justify-between p-4 transition duration-150 cursor-pointer ${
                                isCurrent
                                  ? "bg-violet-600/10 text-violet-400"
                                  : "hover:bg-zinc-900/35 text-zinc-300 hover:text-zinc-100"
                              }`}
                            >
                              <div className="flex items-center gap-4 min-w-[200px]">
                                <span className="font-mono text-xs font-semibold text-zinc-500 w-6">
                                  {isCurrent && isPlaying ? (
                                    <div className="flex items-end gap-0.5 h-3 w-4">
                                      <div className="w-0.5 bg-violet-400 rounded-full animate-bounce-custom-1"></div>
                                      <div className="w-0.5 bg-violet-400 rounded-full animate-bounce-custom-2"></div>
                                      <div className="w-0.5 bg-violet-400 rounded-full animate-bounce-custom-3"></div>
                                    </div>
                                  ) : (
                                    i + 1
                                  )}
                                </span>
                                <div>
                                  <h4 className="font-semibold text-sm truncate max-w-[240px] sm:max-w-md">
                                    {song.title}
                                  </h4>
                                  <p className="text-xs text-zinc-400 font-medium mt-0.5">{song.artist}</p>
                                </div>
                              </div>

                              <div className="flex items-center gap-4">
                                <span className="font-mono text-xs text-zinc-400">{formatTime(song.duration)}</span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeFromQueue(i);
                                  }}
                                  className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-red-400 transition cursor-pointer"
                                  title="Remove from queue"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Settings Tab */}
              {activeTab === "settings" && (
                <div className="flex-1 overflow-y-auto max-w-2xl flex flex-col gap-6">
                  <div>
                    <h2 className="text-3xl font-extrabold text-white tracking-tight">Settings</h2>
                    <p className="text-xs text-zinc-400 mt-1 font-medium">Manage local caches, directories, and keyboard bindings</p>
                  </div>

                  <div className="bg-zinc-900/35 border border-zinc-800/80 rounded-2xl p-6 flex flex-col gap-4">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Library Administration</h3>
                    <div className="flex flex-col gap-2">
                      <p className="text-xs text-zinc-400 leading-normal">
                        Import folder path currently configured for scanning:
                      </p>
                      <div className="bg-zinc-950/50 font-mono text-xs p-3 border border-zinc-900 rounded-xl text-violet-400 break-all select-all">
                        {currentFolder || "No folder mapped yet."}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3 mt-2">
                      <button
                        onClick={handleScan}
                        disabled={isScanning}
                        className="px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 cursor-pointer"
                      >
                        Change Directory
                      </button>
                      <button
                        onClick={clearLibrary}
                        className="px-4 py-2.5 bg-red-600/10 hover:bg-red-600 border border-red-500/20 hover:border-red-500 text-red-400 hover:text-white rounded-xl text-xs font-bold transition cursor-pointer"
                      >
                        Clear Cache & Library
                      </button>
                    </div>
                  </div>

                  <div className="bg-zinc-900/35 border border-zinc-800/80 rounded-2xl p-6 flex flex-col gap-4">
                    <div className="flex items-center gap-2.5 text-white">
                      <Keyboard className="w-4 h-4 text-violet-400" />
                      <h3 className="text-sm font-bold uppercase tracking-wider">Keyboard Bindings</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                        <span className="text-xs text-zinc-400 font-medium">Play / Pause Toggle</span>
                        <kbd className="px-2 py-1 bg-zinc-950 border border-zinc-800 rounded font-mono text-[10px] text-zinc-300">Space</kbd>
                      </div>
                      <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                        <span className="text-xs text-zinc-400 font-medium">Seek Forward 5s</span>
                        <kbd className="px-2 py-1 bg-zinc-950 border border-zinc-800 rounded font-mono text-[10px] text-zinc-300">→</kbd>
                      </div>
                      <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                        <span className="text-xs text-zinc-400 font-medium">Seek Backward 5s</span>
                        <kbd className="px-2 py-1 bg-zinc-950 border border-zinc-800 rounded font-mono text-[10px] text-zinc-300">←</kbd>
                      </div>
                      <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                        <span className="text-xs text-zinc-400 font-medium">Volume Increment</span>
                        <kbd className="px-2 py-1 bg-zinc-950 border border-zinc-800 rounded font-mono text-[10px] text-zinc-300">↑</kbd>
                      </div>
                      <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                        <span className="text-xs text-zinc-400 font-medium">Volume Decrement</span>
                        <kbd className="px-2 py-1 bg-zinc-950 border border-zinc-800 rounded font-mono text-[10px] text-zinc-300">↓</kbd>
                      </div>
                      <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                        <span className="text-xs text-zinc-400 font-medium">Mute Toggle</span>
                        <kbd className="px-2 py-1 bg-zinc-950 border border-zinc-800 rounded font-mono text-[10px] text-zinc-300">M</kbd>
                      </div>
                      <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                        <span className="text-xs text-zinc-400 font-medium">Shuffle Toggle</span>
                        <kbd className="px-2 py-1 bg-zinc-950 border border-zinc-800 rounded font-mono text-[10px] text-zinc-300">S</kbd>
                      </div>
                      <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                        <span className="text-xs text-zinc-400 font-medium">Repeat Cycle</span>
                        <kbd className="px-2 py-1 bg-zinc-950 border border-zinc-800 rounded font-mono text-[10px] text-zinc-300">R</kbd>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {playlistMenuTrack && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in fade-in duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white">Add to Playlist</h3>
              <button
                onClick={() => setPlaylistMenuTrack(null)}
                className="p-1 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-zinc-400 truncate mb-4 font-medium">
              "{playlistMenuTrack.title}" by {playlistMenuTrack.artist}
            </p>
            
            <div className="flex flex-col gap-2 max-h-60 overflow-y-auto mb-4 pr-1">
              {Object.keys(playlists).length === 0 ? (
                <p className="text-xs text-zinc-500 py-4 text-center">No playlists created yet.</p>
              ) : (
                Object.keys(playlists).map((name) => (
                  <button
                    key={name}
                    onClick={async () => {
                      await addSongToPlaylist(name, playlistMenuTrack);
                      setPlaylistMenuTrack(null);
                    }}
                    className="w-full text-left p-3 hover:bg-zinc-850/60 border border-zinc-800/40 hover:border-violet-500/20 rounded-xl transition text-sm text-zinc-300 hover:text-white font-medium cursor-pointer"
                  >
                    {name}
                  </button>
                ))
              )}
            </div>
            
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const input = form.elements.namedItem("playlistName") as HTMLInputElement;
                const name = input.value.trim();
                if (name) {
                  await createPlaylist(name);
                  await addSongToPlaylist(name, playlistMenuTrack);
                  setPlaylistMenuTrack(null);
                }
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                name="playlistName"
                placeholder="Create & add to new playlist..."
                className="flex-1 bg-zinc-950 border border-zinc-800 focus:border-violet-500/50 rounded-xl px-3 py-2 text-xs text-white outline-none"
                required
              />
              <button
                type="submit"
                className="bg-violet-600 hover:bg-violet-500 text-white rounded-xl px-3.5 py-2 text-xs font-bold transition flex-shrink-0 cursor-pointer animate-none"
              >
                Add
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Persistent Audio Control Bar (Bottom) */}
      <footer className="h-24 bg-zinc-900/90 border-t border-zinc-800/80 backdrop-blur-lg flex items-center justify-between px-6 z-20">
        
        {/* Left: Track Information */}
        <div className="w-1/4 flex items-center gap-3.5">
          <div className="w-14 h-14 rounded-xl border border-zinc-800 bg-zinc-950 flex-shrink-0 overflow-hidden relative group">
            {currentCover ? (
              <img src={currentCover} alt="Cover art" className="w-full h-full object-cover" />
            ) : currentSong ? (
              // Vinyl fallback rotation animation
              <div className="w-full h-full bg-gradient-to-tr from-violet-600/30 to-fuchsia-600/30 flex items-center justify-center relative">
                <Disc className={`w-7 h-7 text-violet-400/80 ${isPlaying ? "animate-spin" : ""}`} style={{ animationDuration: "12s" }} />
                <div className="absolute w-2 h-2 rounded-full bg-zinc-950"></div>
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-600">
                <Music className="w-6 h-6" />
              </div>
            )}
            {isLoadingCover && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <RefreshCw className="w-4 h-4 text-violet-400 animate-spin" />
              </div>
            )}
          </div>

          <div className="min-w-0">
            {currentSong ? (
              <>
                <h3 className="text-sm font-semibold text-white truncate max-w-[150px] sm:max-w-[200px]" title={currentSong.title}>
                  {currentSong.title}
                </h3>
                <p className="text-xs text-zinc-400 font-medium truncate max-w-[150px] sm:max-w-[180px] mt-0.5" title={currentSong.artist}>
                  {currentSong.artist}
                </p>
              </>
            ) : (
              <>
                <h3 className="text-sm font-semibold text-zinc-500">Not Playing</h3>
                <p className="text-xs text-zinc-600 font-medium mt-0.5">Select a song to start</p>
              </>
            )}
          </div>
        </div>

        {/* Center: Playback Progress and Controls */}
        <div className="flex-1 max-w-xl flex flex-col items-center gap-2">
          
          {/* Audio Buttons */}
          <div className="flex items-center gap-5">
            <button
              onClick={toggleShuffle}
              className={`p-1.5 hover:bg-zinc-800 rounded-lg transition ${
                isShuffle ? "text-violet-400" : "text-zinc-500 hover:text-zinc-300"
              }`}
              title="Shuffle (S)"
            >
              <Shuffle className="w-4 h-4" />
            </button>
            
            <button
              onClick={prevSong}
              disabled={!currentSong}
              className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-zinc-300 disabled:opacity-30 disabled:hover:bg-transparent transition"
              title="Previous"
            >
              <SkipBack className="w-5 h-5 fill-current" />
            </button>

            <button
              onClick={togglePlay}
              className="w-10 h-10 rounded-full bg-white hover:bg-zinc-200 text-zinc-950 flex items-center justify-center hover:scale-105 transition shadow-lg shadow-white/5 active:scale-95 cursor-pointer"
              title="Play / Pause (Space)"
            >
              {isPlaying ? (
                <Pause className="w-4.5 h-4.5 fill-current text-zinc-950" />
              ) : (
                <Play className="w-4.5 h-4.5 fill-current text-zinc-950 ml-0.5" />
              )}
            </button>

            <button
              onClick={nextSong}
              disabled={!currentSong}
              className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-zinc-300 disabled:opacity-30 disabled:hover:bg-transparent transition"
              title="Next"
            >
              <SkipForward className="w-5 h-5 fill-current" />
            </button>

            <button
              onClick={toggleRepeat}
              className={`p-1.5 hover:bg-zinc-800 rounded-lg transition relative ${
                isRepeat !== "none" ? "text-violet-400" : "text-zinc-500 hover:text-zinc-300"
              }`}
              title={`Repeat: ${isRepeat} (R)`}
            >
              <Repeat className="w-4 h-4" />
              {isRepeat === "one" && (
                <span className="absolute -top-0.5 -right-0.5 text-[8px] bg-violet-600 text-white font-extrabold px-1 rounded-full scale-75">
                  1
                </span>
              )}
            </button>
          </div>

          {/* Progress Seek Bar */}
          <div className="w-full flex items-center gap-3 text-xs font-mono font-medium text-zinc-400">
            <span>{formatTime(progress)}</span>
            <input
              ref={progressBarRef}
              type="range"
              min={0}
              max={duration || 0}
              step={1}
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              disabled={!currentSong}
              className="flex-1"
            />
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Right: Volume and Queue shortcut */}
        <div className="w-1/4 flex items-center justify-end gap-4">
          <button
            onClick={() => setActiveTab(activeTab === "queue" ? "library" : "queue")}
            className={`p-2 rounded-xl transition ${
              activeTab === "queue"
                ? "bg-violet-600/15 text-violet-400 border border-violet-500/20"
                : "text-zinc-400 hover:text-white hover:bg-zinc-850"
            }`}
            title="Toggle Queue View"
          >
            <ListMusic className="w-4.5 h-4.5" />
          </button>

          <div className="flex items-center gap-2.5">
            <button
              onClick={toggleMute}
              className="p-1.5 text-zinc-400 hover:text-white transition"
              title="Mute / Unmute (M)"
            >
              {isMuted ? (
                <VolumeX className="w-4.5 h-4.5 text-red-400" />
              ) : volume < 0.4 ? (
                <Volume1 className="w-4.5 h-4.5" />
              ) : (
                <Volume2 className="w-4.5 h-4.5" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-24"
              title="Volume"
            />
          </div>
        </div>

      </footer>
    </div>
  );
}

export default App;
