import { useState, useMemo } from "react";
import { User } from "lucide-react";
import { usePlayerStore } from "../../store/playerStore";
import type { Song } from "../../store/playerStore";
import { LazyCover } from "../LazyCover";
import { HeroDetail } from "../HeroDetail";

interface Props {
  onContextMenu: (e: React.MouseEvent, song: Song) => void;
  onAddToPlaylist: (song: Song) => void;
  formatTime: (s: number) => string;
}

function sortSongs(songs: Song[]) {
  return [...songs].sort((a, b) => {
    const alA = a.album ?? "", alB = b.album ?? "";
    if (alA !== alB) return alA.localeCompare(alB);
    const dA = a.disk ?? 1, dB = b.disk ?? 1;
    if (dA !== dB) return dA - dB;
    return (a.track ?? 999) - (b.track ?? 999);
  });
}

export function AlbumArtistView({ onContextMenu, onAddToPlaylist, formatTime }: Props) {
  const { library, streamPort } = usePlayerStore();
  const [selected, setSelected] = useState<string | null>(null);

  // Group by albumArtist, fallback to artist
  const map = useMemo(() => {
    const m: Record<string, Song[]> = {};
    library.forEach(s => {
      const aa = s.albumArtist?.trim() || s.artist || "Unknown Artist";
      if (!m[aa]) m[aa] = [];
      m[aa].push(s);
    });
    return m;
  }, [library]);

  const sorted = Object.keys(map).sort();

  if (selected) {
    const songs = sortSongs(map[selected] ?? []);
    const albums = Array.from(new Set(songs.map(s => s.album))).filter(Boolean);
    return (
      <HeroDetail
        title={selected}
        subtitle={`${albums.length} album${albums.length !== 1 ? "s" : ""} · ${songs.length} tracks`}
        coverPath={songs[0]?.path ?? ""}
        songs={songs}
        onBack={() => setSelected(null)}
        onAddToPlaylist={onAddToPlaylist}
        onContextMenu={onContextMenu}
        formatTime={formatTime}
        streamPort={streamPort}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden gap-4 animate-fade-in">
      <div className="flex-shrink-0">
        <h2 className="text-xl font-extrabold text-white tracking-tight">Album Artist</h2>
        <p className="text-[11px] text-zinc-600 mt-0.5 font-medium">{sorted.length} album artists</p>
      </div>
      <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {sorted.map(aa => {
          const songs = map[aa];
          const albums = Array.from(new Set(songs.map(s => s.album))).filter(Boolean).length;
          return (
            <button key={aa} onClick={() => setSelected(aa)}
              className="bg-zinc-900/30 hover:bg-zinc-900/60 border border-zinc-800/40 hover:border-zinc-700/50 p-4 rounded-2xl cursor-pointer transition-all duration-200 flex flex-col items-center text-center group"
            >
              <div className="w-16 h-16 rounded-full mb-3 border border-zinc-800 group-hover:scale-105 transition-transform duration-200 overflow-hidden shadow-md">
                <LazyCover songPath={songs[0]?.path ?? ""} fallbackIcon={User} isRound />
              </div>
              <p className="font-semibold text-sm text-white truncate w-full group-hover:text-zinc-300 transition" title={aa}>{aa}</p>
              <p className="text-[11px] text-zinc-600 mt-0.5">{albums} album{albums !== 1 ? "s" : ""}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
