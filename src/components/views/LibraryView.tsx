import { Search, Music } from "lucide-react";
import { usePlayerStore } from "../../store/playerStore";
import type { Song } from "../../store/playerStore";
import { SongRow } from "../SongRow";

interface Props {
  onContextMenu: (e: React.MouseEvent, song: Song) => void;
  onAddToPlaylist: (song: Song) => void;
  formatTime: (s: number) => string;
}

export function LibraryView({ onContextMenu, onAddToPlaylist, formatTime }: Props) {
  const library = usePlayerStore(s => s.library);
  const searchQuery = usePlayerStore(s => s.searchQuery);
  const setSearchQuery = usePlayerStore(s => s.setSearchQuery);
  const currentSong = usePlayerStore(s => s.currentSong);
  const isPlaying = usePlayerStore(s => s.isPlaying);
  const playQueue = usePlayerStore(s => s.playQueue);

  const q = searchQuery.toLowerCase();
  const filtered = q
    ? library.filter(s =>
        s.title.toLowerCase().includes(q) ||
        s.artist.toLowerCase().includes(q) ||
        s.album.toLowerCase().includes(q)
      )
    : library;

  return (
    <div className="flex-1 flex flex-col overflow-hidden gap-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-shrink-0">
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-tight">All Songs</h2>
          <p className="text-[11px] text-zinc-600 mt-0.5 font-medium">
            {filtered.length !== library.length
              ? `${filtered.length} of ${library.length} tracks`
              : `${library.length} tracks`}
          </p>
        </div>
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-zinc-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800/60 focus:border-zinc-700/60 rounded-xl pl-9 pr-4 py-2 text-sm text-white outline-none transition placeholder:text-zinc-700 w-52"
          />
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-zinc-700">
          <Music className="w-10 h-10" />
          <p className="text-sm font-medium">No tracks found</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto flex flex-col gap-0.5 pr-1">
          {filtered.map((song, i) => (
            <SongRow
              key={song.path}
              song={song}
              index={i}
              isCurrent={currentSong?.path === song.path}
              isPlaying={isPlaying}
              onClick={() => playQueue(filtered, i)}
              onContextMenu={e => onContextMenu(e, song)}
              onAddToPlaylist={() => onAddToPlaylist(song)}
              formatTime={formatTime}
              rightCol={song.album}
            />
          ))}
        </div>
      )}
    </div>
  );
}
