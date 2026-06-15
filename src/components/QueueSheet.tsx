import { Trash2, ListMusic } from "lucide-react";
import { usePlayerStore } from "../store/playerStore";
import { WaveformBars } from "./WaveformBars";
import { BottomSheet } from "./BottomSheet";

interface QueueSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatTime(secs: number) {
  if (!isFinite(secs) || secs < 0) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

export function QueueSheet({ isOpen, onClose }: QueueSheetProps) {
  const { queue, currentIndex, isPlaying, clearQueue, removeFromQueue } = usePlayerStore();

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={`Queue · ${queue.length} tracks`} height="65vh">
      {queue.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full gap-3 text-zinc-700">
          <ListMusic className="w-10 h-10" />
          <p className="text-sm font-medium">Queue is empty</p>
        </div>
      ) : (
        <div className="h-full flex flex-col">
          <div className="flex-1 overflow-y-auto">
            {queue.map((song, i) => {
              const isCurrent = currentIndex === i;
              return (
                <div
                  key={`${song.path}-${i}`}
                  className={`group flex items-center gap-4 px-5 py-3 transition-colors duration-100 cursor-default ${
                    isCurrent ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
                  }`}
                >
                  <span className="w-5 flex-shrink-0 flex items-center justify-center">
                    {isCurrent && isPlaying
                      ? <WaveformBars />
                      : <span className="font-mono text-[11px] text-zinc-600">{i + 1}</span>}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate ${isCurrent ? "text-white" : "text-zinc-300"}`}>
                      {song.title}
                    </p>
                    <p className="text-xs text-zinc-600 truncate mt-0.5">{song.artist}</p>
                  </div>
                  <span className="font-mono text-[11px] text-zinc-600 flex-shrink-0">{formatTime(song.duration)}</span>
                  <button
                    onClick={e => { e.stopPropagation(); removeFromQueue(i); }}
                    className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-700 hover:text-red-400 transition opacity-0 group-hover:opacity-100 cursor-pointer flex-shrink-0"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 px-5 py-3 border-t border-zinc-800/50">
            <button
              onClick={clearQueue}
              className="text-xs font-semibold text-red-500/70 hover:text-red-400 transition cursor-pointer flex items-center gap-1.5"
            >
              <Trash2 className="w-3 h-3" /> Clear All
            </button>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
