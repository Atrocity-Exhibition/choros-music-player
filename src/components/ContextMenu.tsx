import { Play, ListMusic, Tag } from "lucide-react";
import type { Song } from "../store/playerStore";

interface ContextMenuProps {
  x: number;
  y: number;
  song: Song;
  onPlay: () => void;
  onAddToQueue: () => void;
  onEditMetadata: () => void;
  onClose: () => void;
}

export function ContextMenu({ x, y, song: _song, onPlay, onAddToQueue, onEditMetadata }: ContextMenuProps) {
  const items = [
    { icon: Play, label: "Play Now", action: onPlay, fill: true },
    { icon: ListMusic, label: "Add to Queue", action: onAddToQueue },
  ];

  return (
    <div
      className="fixed z-[200] animate-zoom-in"
      style={{ top: y, left: x }}
      onClick={e => e.stopPropagation()}
    >
      <div className="bg-zinc-900/95 border border-zinc-800/70 rounded-xl shadow-2xl p-1 backdrop-blur-md min-w-[176px]">
        {items.map(({ icon: Icon, label, action, fill }) => (
          <button
            key={label}
            onClick={action}
            className="w-full text-left px-3 py-2 text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800/70 rounded-lg transition flex items-center gap-2.5 cursor-pointer"
          >
            <Icon className={`w-3.5 h-3.5 text-zinc-400 ${fill ? "fill-current" : ""}`} />
            <span>{label}</span>
          </button>
        ))}
        <div className="my-1 border-t border-zinc-800/60" />
        <button
          onClick={onEditMetadata}
          className="w-full text-left px-3 py-2 text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800/70 rounded-lg transition flex items-center gap-2.5 cursor-pointer"
        >
          <Tag className="w-3.5 h-3.5 text-zinc-400" />
          <span>Edit Metadata</span>
        </button>
      </div>
    </div>
  );
}
