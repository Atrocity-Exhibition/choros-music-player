import { useState, useMemo } from "react";
import { Disc } from "lucide-react";
import { usePlayerStore } from "../../store/playerStore";
import type { Song } from "../../store/playerStore";
import { LazyCover } from "../LazyCover";
import { HeroDetail } from "../HeroDetail";

interface Props {
  onContextMenu: (e: React.MouseEvent, song: Song) => void;
  onAddToPlaylist: (song: Song) => void;
  formatTime: (s: number) => string;
}

function sortAlbumSongs(songs: Song[]) {
  return [...songs].sort((a, b) => {
    const dA = a.disk ?? 1, dB = b.disk ?? 1;
    if (dA !== dB) return dA - dB;
    return (a.track ?? 999) - (b.track ?? 999);
  });
}

export function AlbumsView({ onContextMenu, onAddToPlaylist, formatTime }: Props) {
  const { library, streamPort } = usePlayerStore();
  const [selected, setSelected] = useState<string | null>(null);

  const albumsMap = useMemo(() => {
    const map: Record<string, Song[]> = {};
    library.forEach(s => {
      const al = s.album || "Unknown Album";
      if (!map[al]) map[al] = [];
      map[al].push(s);
    });
    return map;
  }, [library]);

  const sorted = Object.keys(albumsMap).sort();

  if (selected) {
    const songs = sortAlbumSongs(albumsMap[selected] ?? []);
    const artist = songs[0]?.albumArtist || songs[0]?.artist || "Unknown Artist";
    const year = songs[0]?.year;
    return (
      <HeroDetail
        title={selected}
        subtitle={artist}
        meta={[year, `${songs.length} tracks`].filter(Boolean).join(" · ")}
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
        <h2 className="text-xl font-extrabold text-white tracking-tight">Albums</h2>
        <p className="text-[11px] text-zinc-600 mt-0.5 font-medium">{sorted.length} albums</p>
      </div>
      <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {sorted.map(album => {
          const songs = albumsMap[album];
          const artist = songs[0]?.albumArtist || songs[0]?.artist || "Unknown Artist";
          const year = songs[0]?.year;
          return (
            <button key={album} onClick={() => setSelected(album)}
              className="bg-zinc-900/30 hover:bg-zinc-900/60 border border-zinc-800/40 hover:border-zinc-700/50 p-3 rounded-2xl cursor-pointer transition-all duration-200 flex flex-col group text-left"
            >
              <div className="w-full aspect-square rounded-xl mb-3 border border-zinc-800/40 relative overflow-hidden shadow-md group-hover:scale-[1.02] transition-transform duration-200">
                <LazyCover songPath={songs[0]?.path ?? ""} fallbackIcon={Disc} />
              </div>
              <p className="font-semibold text-sm text-white truncate group-hover:text-zinc-300 transition leading-snug" title={album}>{album}</p>
              <p className="text-[11px] text-zinc-600 truncate mt-0.5">{artist}{year ? ` · ${year}` : ""}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
