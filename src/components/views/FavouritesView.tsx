import { Heart } from "lucide-react";
import { usePlayerStore } from "../../store/playerStore";
import type { Song } from "../../store/playerStore";
import { SongRow } from "../SongRow";

interface Props {
  onContextMenu: (e: React.MouseEvent, song: Song) => void;
  onAddToPlaylist: (song: Song) => void;
  formatTime: (s: number) => string;
}

export function FavouritesView({ onContextMenu, onAddToPlaylist, formatTime }: Props) {
  const { favourites, currentSong, isPlaying, playQueue } = usePlayerStore();

  return (
    <div className="flex-1 flex flex-col overflow-hidden gap-4 animate-fade-in">
      <div className="flex-shrink-0">
        <h2 className="text-xl font-extrabold text-white tracking-tight">Favourites</h2>
        <p className="text-[11px] text-zinc-600 mt-0.5 font-medium">{favourites.length} tracks</p>
      </div>

      {favourites.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 border border-dashed border-zinc-800/60 rounded-2xl text-zinc-700">
          <Heart className="w-12 h-12" />
          <p className="text-base font-bold">No favourites yet</p>
          <p className="text-sm text-zinc-600">Tap the ♥ on any track to add it here</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto flex flex-col gap-0.5 pr-1">
          {favourites.map((song, i) => (
            <SongRow
              key={song.path}
              song={song}
              index={i}
              isCurrent={currentSong?.path === song.path}
              isPlaying={isPlaying}
              onClick={() => playQueue(favourites, i)}
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
