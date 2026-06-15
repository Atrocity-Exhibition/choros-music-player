import { useState, useCallback } from "react";
import {
  Play, Pause, SkipBack, SkipForward,
  Shuffle, Repeat, Volume2, VolumeX, Volume1,
  ListMusic, Plus, Heart, SkipForward as PlayNextIcon,
  Maximize2, Minimize2, Disc,
} from "lucide-react";
import type { Song } from "../store/playerStore";
import { usePlayerStore } from "../store/playerStore";
import { LyricsView } from "./LyricsView";

interface PlayerPanelProps {
  currentSong: Song | null;
  currentCover: string | null;
  isLoadingCover: boolean;
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  isShuffle: boolean;
  isRepeat: "none" | "all" | "one";
  lyrics: string | null;
  isLoadingLyrics: boolean;
  isFavourite: boolean;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onToggleShuffle: () => void;
  onToggleRepeat: () => void;
  onToggleMute: () => void;
  onSetVolume: (v: number) => void;
  onSeek: (v: number) => void;
  onToggleFav: () => void;
  onPlayNext: () => void;
  onOpenQueue: () => void;
  onOpenPlaylist: () => void;
  formatTime: (s: number) => string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

export function PlayerPanel({
  currentSong, currentCover, isLoadingCover,
  isPlaying, volume, isMuted,
  isShuffle, isRepeat, lyrics, isLoadingLyrics,
  isFavourite,
  onTogglePlay, onPrev, onNext,
  onToggleShuffle, onToggleRepeat, onToggleMute, onSetVolume, onSeek,
  onToggleFav, onPlayNext, onOpenQueue, onOpenPlaylist,
  formatTime, isExpanded, onToggleExpand, isFullscreen, onToggleFullscreen,
}: PlayerPanelProps) {
  const [showLyrics, setShowLyrics] = useState(false);
  const progress = usePlayerStore(s => s.progress);
  const duration = usePlayerStore(s => s.duration);

  // Reset lyrics view when song changes
  const handleSongClick = useCallback(() => {
    if (currentSong) setShowLyrics(v => !v);
  }, [currentSong]);

  const progressPct = duration > 0 ? (progress / duration) * 100 : 0;
  const volPct = isMuted ? 0 : volume * 100;

  const panelClass = isFullscreen
    ? "fixed inset-0 z-[60] flex flex-col bg-zinc-950"
    : `flex flex-col border-l border-zinc-800/40 bg-zinc-950 ${
        isExpanded ? "w-[400px]" : "w-72"
      } flex-shrink-0`;

  return (
    <aside className={panelClass}>
      {/* Top toolbar */}
      <div className="flex items-center justify-end gap-1 px-4 pt-3 pb-0 flex-shrink-0">
        <button onClick={onToggleExpand} className="p-1.5 hover:bg-zinc-800/60 rounded-lg text-zinc-700 hover:text-zinc-400 transition cursor-pointer" title="Expand panel">
          {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
        <button onClick={onToggleFullscreen} className="p-1.5 hover:bg-zinc-800/60 rounded-lg text-zinc-700 hover:text-zinc-400 transition cursor-pointer" title="Fullscreen">
          {isFullscreen ? <Minimize2 className="w-4 h-4 text-zinc-400" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Art / Lyrics square */}
      <div className="px-4 pt-2 flex-shrink-0">
        <div
          onClick={handleSongClick}
          className={`relative w-full overflow-hidden rounded-2xl border border-zinc-800/40 shadow-2xl cursor-pointer group ${isFullscreen ? "h-72" : ""}`}
          style={{ aspectRatio: isFullscreen ? undefined : "1 / 1" }}
          title={currentSong ? (showLyrics ? "Show cover" : "Show lyrics") : ""}
        >
          {/* Cover */}
          {currentCover && !showLyrics ? (
            <img
              src={currentCover}
              alt={currentSong?.title}
              className="w-full h-full object-cover cover-loaded"
            />
          ) : !showLyrics ? (
            <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
              <Disc className={`text-zinc-700 ${isExpanded ? "w-16 h-16" : "w-12 h-12"} ${isPlaying ? "animate-spin-slow" : ""}`} />
              <div className="absolute w-4 h-4 rounded-full bg-zinc-950" />
            </div>
          ) : null}

          {/* Lyrics overlay */}
          {showLyrics && (
            <div className="absolute inset-0 bg-zinc-900 flex">
              <LyricsView lyrics={lyrics} isLoading={isLoadingLyrics} />
            </div>
          )}

          {/* Hover hint */}
          {currentSong && !isLoadingCover && (
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <span className="text-[10px] font-semibold text-white/0 group-hover:text-white/60 transition-colors">
                {showLyrics ? "Show Cover" : "Show Lyrics"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Scrollable controls area */}
      <div className="flex-1 overflow-y-auto flex flex-col px-4 py-4 gap-4 min-h-0">
        {/* Track info */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className={`font-bold text-white truncate leading-snug ${isExpanded ? "text-lg" : "text-base"}`} title={currentSong?.title}>
              {currentSong?.title ?? "Not Playing"}
            </h3>
            <p className="text-xs text-zinc-500 font-medium truncate mt-0.5" title={currentSong?.artist}>
              {currentSong?.artist ?? "Select a track"}
            </p>
            {currentSong?.album && (
              <p className="text-[11px] text-zinc-700 truncate mt-0.5">{currentSong.album}</p>
            )}
          </div>
          {/* Fav */}
          <button
            onClick={onToggleFav}
            disabled={!currentSong}
            className={`p-2 rounded-xl transition cursor-pointer disabled:opacity-30 flex-shrink-0 ${
              isFavourite
                ? "text-pink-400 hover:text-pink-300 bg-pink-500/10"
                : "text-zinc-700 hover:text-pink-400 hover:bg-zinc-800/60"
            }`}
            title={isFavourite ? "Remove from Favourites" : "Add to Favourites"}
          >
            <Heart className={`w-4 h-4 ${isFavourite ? "fill-current" : ""}`} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="flex flex-col gap-1.5">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.5}
            value={progress}
            onChange={e => onSeek(Number(e.target.value))}
            disabled={!currentSong}
            className="w-full"
            style={{
              background: `linear-gradient(to right, rgba(255,255,255,0.75) ${progressPct}%, rgba(255,255,255,0.07) ${progressPct}%)`,
            }}
          />
          <div className="flex justify-between font-mono text-[10px] text-zinc-700">
            <span>{formatTime(progress)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between gap-1">
          <button onClick={onToggleShuffle} title="Shuffle" className={`p-2 rounded-xl transition cursor-pointer ${isShuffle ? "text-white bg-zinc-800/60" : "text-zinc-600 hover:text-zinc-300"}`}>
            <Shuffle className="w-4 h-4" />
          </button>

          <button onClick={onPrev} disabled={!currentSong} className="p-2 text-zinc-400 hover:text-white disabled:opacity-30 transition cursor-pointer">
            <SkipBack className="w-5 h-5 fill-current" />
          </button>

          <button
            onClick={onTogglePlay}
            className="w-12 h-12 rounded-full bg-white hover:bg-zinc-100 text-zinc-950 flex items-center justify-center shadow-xl shadow-white/10 transition-transform active:scale-95 cursor-pointer flex-shrink-0"
          >
            {isPlaying
              ? <Pause className="w-5 h-5 fill-current" />
              : <Play className="w-5 h-5 fill-current ml-0.5" />}
          </button>

          <button onClick={onNext} disabled={!currentSong} className="p-2 text-zinc-400 hover:text-white disabled:opacity-30 transition cursor-pointer">
            <SkipForward className="w-5 h-5 fill-current" />
          </button>

          <button onClick={onToggleRepeat} title={`Repeat: ${isRepeat}`} className={`relative p-2 rounded-xl transition cursor-pointer ${isRepeat !== "none" ? "text-white bg-zinc-800/60" : "text-zinc-600 hover:text-zinc-300"}`}>
            <Repeat className="w-4 h-4" />
            {isRepeat === "one" && (
              <span className="absolute -top-0.5 -right-0.5 text-[7px] bg-white text-zinc-950 font-black w-3 h-3 rounded-full flex items-center justify-center leading-none">1</span>
            )}
          </button>
        </div>

        {/* Volume */}
        <div className="flex items-center gap-2.5">
          <button onClick={onToggleMute} className="text-zinc-600 hover:text-zinc-300 transition cursor-pointer flex-shrink-0">
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" />
              : volume < 0.4 ? <Volume1 className="w-4 h-4" />
              : <Volume2 className="w-4 h-4" />}
          </button>
          <input
            type="range"
            min={0} max={1} step={0.01}
            value={isMuted ? 0 : volume}
            onChange={e => onSetVolume(Number(e.target.value))}
            className="flex-1"
            style={{
              background: `linear-gradient(to right, rgba(255,255,255,0.65) ${volPct}%, rgba(255,255,255,0.07) ${volPct}%)`,
            }}
          />
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: ListMusic, label: "Queue", action: onOpenQueue },
            { icon: Plus, label: "Playlist", action: onOpenPlaylist },
            { icon: PlayNextIcon, label: "Play Next", action: onPlayNext },
          ].map(({ icon: Icon, label, action }) => (
            <button
              key={label}
              onClick={action}
              disabled={!currentSong}
              className="flex flex-col items-center gap-1.5 py-2.5 bg-zinc-900/60 hover:bg-zinc-800/60 border border-zinc-800/40 hover:border-zinc-700/50 rounded-xl text-zinc-500 hover:text-zinc-300 transition disabled:opacity-30 cursor-pointer"
            >
              <Icon className="w-4 h-4" />
              <span className="text-[9px] font-semibold tracking-wide">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
