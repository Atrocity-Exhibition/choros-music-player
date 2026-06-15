import { ListMusic, Trash2 } from "lucide-react";
import { usePlayerStore } from "../../store/playerStore";
import type { Song } from "../../store/playerStore";
import { SongRow } from "../SongRow";

interface Props {
  onContextMenu: (e: React.MouseEvent, song: Song) => void;
  onAddToPlaylist: (song: Song) => void;
  formatTime: (s: number) => string;
}

export function QueueView({ onContextMenu, onAddToPlaylist, formatTime }: Props) {
  const { queue, currentIndex, isPlaying, clearQueue, playQueue } = usePlayerStore();

  return (
    <div className="flex-1 flex flex-col overflow-hidden gap-4 animate-fade-in">
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-tight">Play Queue</h2>
          <p className="text-[11px] text-zinc-600 mt-0.5 font-medium">{queue.length} tracks</p>
        </div>
        {queue.length > 0 && (
          <button
            onClick={clearQueue}
            className="px-3 py-2 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/40 text-red-500/60 hover:text-red-400 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition"
          >
            <Trash2 className="w-3.5 h-3.5" /> Clear
          </button>
        )}
      </div>

      {queue.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 border border-dashed border-zinc-800/60 rounded-2xl text-zinc-700">
          <ListMusic className="w-12 h-12" />
          <p className="text-base font-bold">Queue is empty</p>
          <p className="text-sm text-zinc-600">Use ↑ on any track or the player action buttons</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto flex flex-col gap-0.5 pr-1">
          {queue.map((song, i) => (
            <SongRow
              key={`${song.path}-${i}`}
              song={song}
              index={i}
              isCurrent={currentIndex === i}
              isPlaying={isPlaying && currentIndex === i}
              onClick={() => playQueue(queue, i)}
              onContextMenu={e => onContextMenu(e, song)}
              onAddToPlaylist={() => onAddToPlaylist(song)}
              formatTime={formatTime}
            />
          ))}
        </div>
      )}
    </div>
  );
}
