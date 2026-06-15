import { Play, Shuffle, ChevronLeft, SkipForward, ListPlus, Plus, Heart } from "lucide-react";
import type { Song } from "../store/playerStore";
import { usePlayerStore } from "../store/playerStore";
import { WaveformBars } from "./WaveformBars";

interface HeroDetailProps {
  /** The entity name shown in the hero (album / artist / etc.) */
  title: string;
  subtitle: string;
  meta?: string; // e.g. "2021 · 12 tracks"
  coverPath: string; // path to a song in this group for cover lookup
  songs: Song[];
  onBack: () => void;
  onAddToPlaylist: (song: Song) => void;
  onContextMenu: (e: React.MouseEvent, song: Song) => void;
  formatTime: (s: number) => string;
  streamPort: number | null;
}

function formatTime(s: number) {
  if (!isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec < 10 ? "0" : ""}${sec}`;
}

export function HeroDetail({
  title,
  subtitle,
  meta,
  coverPath,
  songs,
  onBack,
  onAddToPlaylist,
  onContextMenu,
  streamPort,
}: HeroDetailProps) {
  const { currentSong, isPlaying, playQueue, addToQueue, playNext, toggleFavourite, isFavourite } = usePlayerStore();

  const coverUrl = streamPort && coverPath
    ? `http://127.0.0.1:${streamPort}/cover?path=${encodeURIComponent(coverPath)}`
    : null;

  return (
    <div className="flex-1 flex flex-col overflow-hidden animate-fade-in">
      {/* ── Hero header ── */}
      <div className="relative flex-shrink-0 h-52 overflow-hidden">
        {/* Blurred background */}
        {coverUrl && (
          <img
            src={coverUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover blur-2xl scale-110 opacity-40 select-none pointer-events-none"
            aria-hidden
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/30 via-zinc-950/60 to-zinc-950" />

        {/* Content */}
        <div className="relative z-10 h-full flex items-end gap-5 px-6 pb-5">
          {/* Cover art */}
          <div className="w-32 h-32 rounded-2xl border border-white/10 overflow-hidden flex-shrink-0 shadow-2xl">
            {coverUrl ? (
              <img src={coverUrl} alt={title} className="w-full h-full object-cover cover-loaded" />
            ) : (
              <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                <span className="text-4xl">🎵</span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 pb-1">
            <button
              onClick={onBack}
              className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 font-semibold mb-2 transition cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Back
            </button>
            <h1 className="text-2xl font-extrabold text-white tracking-tight truncate leading-tight" title={title}>
              {title}
            </h1>
            {subtitle && <p className="text-sm text-zinc-400 font-medium mt-1 truncate">{subtitle}</p>}
            {meta && <p className="text-xs text-zinc-600 font-medium mt-1">{meta}</p>}

            {/* Buttons */}
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => playQueue(songs, 0)}
                className="px-5 py-2 bg-white hover:bg-zinc-100 text-zinc-950 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg transition-all hover:scale-105 active:scale-95"
              >
                <Play className="w-3.5 h-3.5 fill-current" /> Play All
              </button>
              <button
                onClick={() => {
                  const shuffled = [...songs].sort(() => Math.random() - 0.5);
                  playQueue(shuffled, 0);
                }}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition"
              >
                <Shuffle className="w-3.5 h-3.5" /> Shuffle
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Track list ── */}
      <div className="flex-1 overflow-y-auto px-6 py-3">
        <div className="flex flex-col gap-0.5">
          {songs.map((song, i) => {
            const isCurrent = currentSong?.path === song.path;
            const fav = isFavourite(song.path);
            const trackNum = song.track ?? i + 1;

            return (
              <div
                key={song.path}
                onClick={() => playQueue(songs, i)}
                onContextMenu={e => onContextMenu(e, song)}
                className={`group flex items-center gap-4 px-3 py-2.5 rounded-xl cursor-pointer transition-colors duration-100 ${
                  isCurrent
                    ? "bg-white/[0.07] text-white"
                    : "hover:bg-white/[0.04] text-zinc-500 hover:text-zinc-200"
                }`}
              >
                {/* Track number / waveform */}
                <div className="w-8 flex-shrink-0 text-center">
                  {isCurrent && isPlaying ? (
                    <WaveformBars className="mx-auto" />
                  ) : (
                    <>
                      <span className={`font-mono text-xs group-hover:hidden ${isCurrent ? "text-zinc-300" : "text-zinc-600"}`}>
                        {String(trackNum).padStart(2, "0")}
                      </span>
                      <Play className="w-3.5 h-3.5 fill-current text-zinc-300 hidden group-hover:block mx-auto" />
                    </>
                  )}
                </div>

                {/* Title */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold truncate ${isCurrent ? "text-white" : ""}`}>
                    {song.title}
                  </p>
                  {song.artist !== subtitle && (
                    <p className="text-[11px] text-zinc-600 truncate mt-0.5">{song.artist}</p>
                  )}
                </div>

                {/* Duration */}
                <span className="font-mono text-[11px] text-zinc-600 w-10 text-right flex-shrink-0">
                  {formatTime(song.duration)}
                </span>

                {/* Hover actions */}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button onClick={e => { e.stopPropagation(); playNext(song); }} className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-white transition cursor-pointer" title="Play Next">
                    <SkipForward className="w-3 h-3" />
                  </button>
                  <button onClick={e => { e.stopPropagation(); addToQueue(song); }} className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-white transition cursor-pointer" title="Add to Queue">
                    <ListPlus className="w-3 h-3" />
                  </button>
                  <button onClick={e => { e.stopPropagation(); onAddToPlaylist(song); }} className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-white transition cursor-pointer" title="Add to Playlist">
                    <Plus className="w-3 h-3" />
                  </button>
                  <button onClick={e => { e.stopPropagation(); toggleFavourite(song); }} className={`p-1.5 hover:bg-zinc-800 rounded-lg transition cursor-pointer ${fav ? "text-pink-400" : "text-zinc-500 hover:text-pink-400"}`} title="Favourite">
                    <Heart className={`w-3 h-3 ${fav ? "fill-current" : ""}`} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
