import { Play, SkipForward, ListPlus, Plus, Heart } from "lucide-react";
import type { Song } from "../store/playerStore";
import { usePlayerStore } from "../store/playerStore";
import { LazyCover } from "./LazyCover";
import { WaveformBars } from "./WaveformBars";
import { Music } from "lucide-react";

interface SongRowProps {
  song: Song;
  index: number;
  isCurrent: boolean;
  isPlaying: boolean;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onAddToPlaylist: () => void;
  formatTime: (s: number) => string;
  /** Optional right-side metadata column (e.g. album name) */
  rightCol?: React.ReactNode;
  /** Show track number instead of row index */
  showTrackNum?: boolean;
}

export function SongRow({
  song,
  index,
  isCurrent,
  isPlaying,
  onClick,
  onContextMenu,
  onAddToPlaylist,
  formatTime,
  rightCol,
  showTrackNum = false,
}: SongRowProps) {
  const { addToQueue, playNext, toggleFavourite, isFavourite } = usePlayerStore();
  const fav = isFavourite(song.path);

  const displayIndex = showTrackNum ? (song.track ?? index + 1) : index + 1;

  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={`group flex items-center gap-3 px-4 py-2.5 rounded-xl cursor-pointer transition-all duration-100 ${
        isCurrent
          ? "bg-white/[0.07] text-white"
          : "hover:bg-white/[0.04] text-zinc-400 hover:text-zinc-200"
      }`}
    >
      {/* Index / waveform */}
      <div className="w-7 flex-shrink-0 flex items-center justify-center">
        {isCurrent && isPlaying ? (
          <WaveformBars />
        ) : (
          <span className={`font-mono text-[11px] group-hover:hidden ${isCurrent ? "text-zinc-300" : "text-zinc-600"}`}>
            {displayIndex}
          </span>
        )}
        {(!isCurrent || !isPlaying) && (
          <Play className="w-3.5 h-3.5 fill-current text-zinc-300 hidden group-hover:block" />
        )}
      </div>

      {/* Thumbnail */}
      <div className="w-10 h-10 rounded-lg flex-shrink-0 border border-zinc-800/50 overflow-hidden">
        <LazyCover songPath={song.path} fallbackIcon={Music} />
      </div>

      {/* Title + artist */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold truncate leading-snug ${isCurrent ? "text-white" : ""}`}>
          {song.title}
        </p>
        <p className="text-[11px] text-zinc-600 group-hover:text-zinc-500 truncate mt-0.5 font-medium">
          {song.artist}
        </p>
      </div>

      {/* Optional right col (e.g. album) */}
      {rightCol && (
        <div className="hidden md:block text-xs text-zinc-600 truncate max-w-[140px]">
          {rightCol}
        </div>
      )}

      {/* Duration */}
      <span className="font-mono text-[11px] text-zinc-600 w-10 text-right flex-shrink-0">
        {formatTime(song.duration)}
      </span>

      {/* Action buttons — appear on hover */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button
          onClick={e => { e.stopPropagation(); playNext(song); }}
          className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-white transition cursor-pointer"
          title="Play Next"
        >
          <SkipForward className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={e => { e.stopPropagation(); addToQueue(song); }}
          className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-white transition cursor-pointer"
          title="Add to Queue"
        >
          <ListPlus className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={e => { e.stopPropagation(); onAddToPlaylist(); }}
          className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-white transition cursor-pointer"
          title="Add to Playlist"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={e => { e.stopPropagation(); toggleFavourite(song); }}
          className={`p-1.5 hover:bg-zinc-800 rounded-lg transition cursor-pointer ${
            fav ? "text-pink-400 hover:text-pink-300" : "text-zinc-500 hover:text-pink-400"
          }`}
          title={fav ? "Remove from Favourites" : "Add to Favourites"}
        >
          <Heart className={`w-3.5 h-3.5 ${fav ? "fill-current" : ""}`} />
        </button>
      </div>
    </div>
  );
}
