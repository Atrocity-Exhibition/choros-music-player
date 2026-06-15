import { useCallback, useEffect, useRef, useState } from "react";
import { FolderOpen, RefreshCw, Disc, X } from "lucide-react";
import { usePlayerStore } from "./store/playerStore";
import type { Song } from "./store/playerStore";
import audio from "./lib/audio";

// Layout
import { Sidebar } from "./components/Sidebar";
import { PlayerPanel } from "./components/PlayerPanel";

// Overlays
import { ContextMenu } from "./components/ContextMenu";
import { MetadataEditor } from "./components/MetadataEditor";
import { PlaylistSheet } from "./components/PlaylistSheet";
import { QueueSheet } from "./components/QueueSheet";

// Views
import { LibraryView } from "./components/views/LibraryView";
import { ArtistsView } from "./components/views/ArtistsView";
import { AlbumsView } from "./components/views/AlbumsView";
import { AlbumArtistView } from "./components/views/AlbumArtistView";
import { PlaylistsView } from "./components/views/PlaylistsView";
import { FavouritesView } from "./components/views/FavouritesView";
import { FoldersView } from "./components/views/FoldersView";
import { QueueView } from "./components/views/QueueView";
import { SettingsView } from "./components/views/SettingsView";

function formatTime(secs: number): string {
  if (!isFinite(secs) || secs < 0) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

export default function App() {
  const library = usePlayerStore(s => s.library);
  const currentFolder = usePlayerStore(s => s.currentFolder);
  const activeTab = usePlayerStore(s => s.activeTab);
  const currentSong = usePlayerStore(s => s.currentSong);
  const currentCover = usePlayerStore(s => s.currentCover);
  const isLoadingCover = usePlayerStore(s => s.isLoadingCover);
  const isPlaying = usePlayerStore(s => s.isPlaying);
  const volume = usePlayerStore(s => s.volume);
  const isMuted = usePlayerStore(s => s.isMuted);
  const isShuffle = usePlayerStore(s => s.isShuffle);
  const isRepeat = usePlayerStore(s => s.isRepeat);
  const playbackError = usePlayerStore(s => s.playbackError);
  const lyrics = usePlayerStore(s => s.lyrics);
  const isLoadingLyrics = usePlayerStore(s => s.isLoadingLyrics);

  const setActiveTab = usePlayerStore(s => s.setActiveTab);
  const setPlaybackError = usePlayerStore(s => s.setPlaybackError);
  const selectAndScanFolder = usePlayerStore(s => s.selectAndScanFolder);
  const scanFolder = usePlayerStore(s => s.scanFolder);
  const playSong = usePlayerStore(s => s.playSong);
  const addToQueue = usePlayerStore(s => s.addToQueue);
  const playNext = usePlayerStore(s => s.playNext);
  const togglePlay = usePlayerStore(s => s.togglePlay);
  const setVolume = usePlayerStore(s => s.setVolume);
  const toggleMute = usePlayerStore(s => s.toggleMute);
  const setProgress = usePlayerStore(s => s.setProgress);
  const nextSong = usePlayerStore(s => s.nextSong);
  const prevSong = usePlayerStore(s => s.prevSong);
  const toggleShuffle = usePlayerStore(s => s.toggleShuffle);
  const toggleRepeat = usePlayerStore(s => s.toggleRepeat);
  const loadPlaylists = usePlayerStore(s => s.loadPlaylists);
  const loadHistory = usePlayerStore(s => s.loadHistory);
  const loadFavourites = usePlayerStore(s => s.loadFavourites);
  const loadStreamPort = usePlayerStore(s => s.loadStreamPort);
  const toggleFavourite = usePlayerStore(s => s.toggleFavourite);
  const isFavourite = usePlayerStore(s => s.isFavourite);

  // ── UI state ──
  const [isScanning, setIsScanning]         = useState(false);
  const [contextMenu, setContextMenu]       = useState<{ x: number; y: number; song: Song } | null>(null);
  const [editingSong, setEditingSong]       = useState<Song | null>(null);
  const [playlistSong, setPlaylistSong]     = useState<Song | null>(null);
  const [queueSheetOpen, setQueueSheetOpen] = useState(false);
  const [playlistSheetOpen, setPlaylistSheetOpen] = useState(false);
  const [playerExpanded, setPlayerExpanded] = useState(false);
  const [playerFullscreen, setPlayerFullscreen] = useState(false);
  const loggedRef = useRef<string | null>(null);

  // ── Bootstrap ──
  useEffect(() => {
    loadPlaylists();
    loadHistory();
    loadFavourites();
    loadStreamPort();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Audio event listeners ──
  useEffect(() => {
    const onTime     = () => usePlayerStore.setState({ progress: audio.currentTime });
    const onDuration = () => usePlayerStore.setState({ duration: audio.duration || 0 });
    const onEnded    = () => {
      if (usePlayerStore.getState().isRepeat === "one") {
        audio.currentTime = 0; audio.play().catch(console.error);
      } else nextSong();
    };
    const onError = () => {
      const err = audio.error;
      const msgs: Record<number, string> = { 1: "Aborted", 2: "Network error", 3: "Decoding failed", 4: "Format unsupported" };
      setPlaybackError((err ? msgs[err.code] ?? "Unknown error" : "Unknown error") + (err ? ` (code ${err.code})` : ""));
      usePlayerStore.setState({ isPlaying: false });
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("durationchange", onDuration);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("durationchange", onDuration);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [nextSong, setPlaybackError]);

  // Sync play/pause
  useEffect(() => {
    if (isPlaying) audio.play().catch(console.error);
    else audio.pause();
  }, [isPlaying, currentSong]);

  useEffect(() => { audio.volume = isMuted ? 0 : volume; }, [volume, isMuted]);

  // History: record after 30 s
  useEffect(() => {
    if (!currentSong) { loggedRef.current = null; return; }
    if (loggedRef.current !== currentSong.path) loggedRef.current = null;
    const checkHistory = () => {
      if (!loggedRef.current && audio.currentTime >= Math.min(30, audio.duration - 1) && audio.duration > 0) {
        loggedRef.current = currentSong.path;
        usePlayerStore.getState().recordSongPlayed(currentSong);
      }
    };
    audio.addEventListener("timeupdate", checkHistory);
    return () => audio.removeEventListener("timeupdate", checkHistory);
  }, [currentSong]);

  // ── Global keyboard shortcuts ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      switch (e.code) {
        case "Space":     e.preventDefault(); togglePlay(); break;
        case "ArrowLeft": e.preventDefault(); setProgress(Math.max(0, audio.currentTime - 5)); break;
        case "ArrowRight":e.preventDefault(); setProgress(Math.min(audio.duration || 0, audio.currentTime + 5)); break;
        case "ArrowUp":   e.preventDefault(); setVolume(Math.min(1, volume + 0.05)); break;
        case "ArrowDown": e.preventDefault(); setVolume(Math.max(0, volume - 0.05)); break;
        case "KeyM": e.preventDefault(); toggleMute(); break;
        case "KeyS": e.preventDefault(); toggleShuffle(); break;
        case "KeyR": e.preventDefault(); toggleRepeat(); break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, setProgress, setVolume, volume, toggleMute, toggleShuffle, toggleRepeat]);

  // Prevent browser zoom globally (wheel, keyboard, gestures)
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) e.preventDefault();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "+" || e.key === "-" || e.key === "=" || e.key === "0" || e.code === "Equal" || e.code === "Minus" || e.code === "Digit0")
      ) {
        e.preventDefault();
      }
    };
    const handleTouch = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };
    const handleGesture = (e: Event) => {
      e.preventDefault();
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    window.addEventListener("touchmove", handleTouch, { passive: false });
    window.addEventListener("gesturestart", handleGesture);
    window.addEventListener("gesturechange", handleGesture);

    return () => {
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
      window.removeEventListener("touchmove", handleTouch);
      window.removeEventListener("gesturestart", handleGesture);
      window.removeEventListener("gesturechange", handleGesture);
    };
  }, []);

  // Close context menu on click outside
  useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  // ── Handlers ──
  const handleImport = useCallback(async () => {
    if (isScanning) return;
    setIsScanning(true);
    try { await selectAndScanFolder(); } finally { setIsScanning(false); }
  }, [isScanning, selectAndScanFolder]);

  const handleRescan = useCallback(async () => {
    if (!currentFolder || isScanning) return;
    setIsScanning(true);
    try { await scanFolder(currentFolder); } catch(e) { console.error(e); } finally { setIsScanning(false); }
  }, [currentFolder, isScanning, scanFolder]);

  const handleContextMenu = useCallback((e: React.MouseEvent, song: Song) => {
    e.preventDefault(); e.stopPropagation();
    const x = Math.min(e.clientX, window.innerWidth - 200);
    const y = Math.min(e.clientY, window.innerHeight - 130);
    setContextMenu({ x, y, song });
  }, []);

  const sharedProps = {
    onContextMenu: handleContextMenu,
    onAddToPlaylist: (song: Song) => { setPlaylistSong(song); setPlaylistSheetOpen(true); },
    formatTime,
  };

  const favSong = currentSong ? isFavourite(currentSong.path) : false;

  // ─── EMPTY LIBRARY LANDING ───────────────────────────────
  if (library.length === 0) {
    return (
      <div className="h-screen w-screen bg-zinc-950 text-zinc-100 flex items-center justify-center overflow-hidden select-none">
        <div className="flex flex-col items-center text-center max-w-sm gap-6 z-10">
          <div className="w-20 h-20 rounded-3xl bg-zinc-900 border border-zinc-800/60 flex items-center justify-center shadow-2xl">
            <Disc className="w-9 h-9 text-zinc-500 animate-pulse" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Music Player</h1>
            <p className="text-sm text-zinc-600 mt-2 leading-relaxed">
              Import a folder with MP3, FLAC, M4A, OGG, or WAV files.
            </p>
          </div>
          <button
            onClick={handleImport}
            disabled={isScanning}
            className="px-6 py-3 bg-white hover:bg-zinc-100 text-zinc-950 rounded-2xl font-bold flex items-center gap-2.5 shadow-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-60 cursor-pointer"
          >
            {isScanning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FolderOpen className="w-4 h-4" />}
            {isScanning ? "Scanning…" : "Select Music Folder"}
          </button>
        </div>
      </div>
    );
  }

  // ─── MAIN 3-COLUMN LAYOUT ────────────────────────────────
  return (
    <div className="h-screen w-screen bg-zinc-950 text-zinc-100 flex overflow-hidden select-none">
      {/* Left — Sidebar */}
      <Sidebar
        activeTab={activeTab}
        currentFolder={currentFolder}
        isScanning={isScanning}
        onSelectTab={setActiveTab}
        onImportFolder={handleImport}
        onRescan={handleRescan}
      />

      {/* Center — Library content */}
      <main className="flex-1 min-w-0 flex flex-col relative overflow-hidden">
        {/* Playback error */}
        {playbackError && (
          <div className="flex-shrink-0 mx-5 mt-4 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2.5 rounded-xl flex items-center justify-between text-xs animate-slide-up">
            <div>
              <span className="font-bold text-red-300 block mb-0.5">Playback Failed</span>
              {playbackError}
            </div>
            <button onClick={() => setPlaybackError(null)} className="p-1 hover:bg-red-500/20 rounded-lg transition cursor-pointer ml-3 flex-shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* View */}
        <div className="flex-1 overflow-hidden flex flex-col px-5 pt-5 pb-3">
          {activeTab === "library"     && <LibraryView     {...sharedProps} />}
          {activeTab === "albums"      && <AlbumsView       {...sharedProps} />}
          {activeTab === "artists"     && <ArtistsView      {...sharedProps} />}
          {activeTab === "albumArtist" && <AlbumArtistView  {...sharedProps} />}
          {activeTab === "playlists"   && <PlaylistsView    {...sharedProps} />}
          {activeTab === "favourites"  && <FavouritesView   {...sharedProps} />}
          {activeTab === "folders"     && <FoldersView      {...sharedProps} />}
          {activeTab === "queue"       && <QueueView        {...sharedProps} />}
          {activeTab === "settings"    && (
            <SettingsView isScanning={isScanning} onScan={handleImport} />
          )}
        </div>

        {/* Bottom sheets — scoped inside center area */}
        <QueueSheet isOpen={queueSheetOpen} onClose={() => setQueueSheetOpen(false)} />
        <PlaylistSheet
          isOpen={playlistSheetOpen}
          song={playlistSong}
          onClose={() => { setPlaylistSheetOpen(false); setPlaylistSong(null); }}
        />

        {/* Global library scanning overlay */}
        {isScanning && (
          <div className="absolute inset-0 bg-zinc-950/95 z-45 flex flex-col items-center justify-center gap-4 animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800/60 flex items-center justify-center shadow-2xl">
              <RefreshCw className="w-6 h-6 text-zinc-400 animate-spin" />
            </div>
            <div className="text-center">
              <h3 className="text-sm font-bold text-white tracking-wide">Scanning Library</h3>
              <p className="text-[11px] text-zinc-500 mt-1">Reading audio files and extracting metadata...</p>
            </div>
          </div>
        )}
      </main>

      {/* Right — Player panel */}
      <PlayerPanel
        currentSong={currentSong}
        currentCover={currentCover}
        isLoadingCover={isLoadingCover}
        isPlaying={isPlaying}
        volume={volume}
        isMuted={isMuted}
        isShuffle={isShuffle}
        isRepeat={isRepeat}
        lyrics={lyrics}
        isLoadingLyrics={isLoadingLyrics}
        isFavourite={favSong}
        onTogglePlay={togglePlay}
        onPrev={prevSong}
        onNext={nextSong}
        onToggleShuffle={toggleShuffle}
        onToggleRepeat={toggleRepeat}
        onToggleMute={toggleMute}
        onSetVolume={setVolume}
        onSeek={setProgress}
        onToggleFav={() => { if (currentSong) toggleFavourite(currentSong); }}
        onPlayNext={() => { if (currentSong) playNext(currentSong); }}
        onOpenQueue={() => setQueueSheetOpen(true)}
        onOpenPlaylist={() => { if (currentSong) { setPlaylistSong(currentSong); setPlaylistSheetOpen(true); } }}
        formatTime={formatTime}
        isExpanded={playerExpanded}
        onToggleExpand={() => setPlayerExpanded(v => !v)}
        isFullscreen={playerFullscreen}
        onToggleFullscreen={() => setPlayerFullscreen(v => !v)}
      />

      {/* ── Overlays ── */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          song={contextMenu.song}
          onPlay={() => { playSong(contextMenu.song); setContextMenu(null); }}
          onAddToQueue={() => { addToQueue(contextMenu.song); setContextMenu(null); }}
          onEditMetadata={() => { setEditingSong(contextMenu.song); setContextMenu(null); }}
          onClose={() => setContextMenu(null)}
        />
      )}
      {editingSong && (
        <MetadataEditor song={editingSong} onClose={() => setEditingSong(null)} />
      )}
    </div>
  );
}
