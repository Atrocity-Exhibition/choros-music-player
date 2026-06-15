import { useState } from "react";
import { Plus, ListMusic } from "lucide-react";
import { usePlayerStore } from "../store/playerStore";
import type { Song } from "../store/playerStore";
import { BottomSheet } from "./BottomSheet";

interface PlaylistSheetProps {
  isOpen: boolean;
  song: Song | null;
  onClose: () => void;
}

export function PlaylistSheet({ isOpen, song, onClose }: PlaylistSheetProps) {
  const playlists = usePlayerStore(s => s.playlists);
  const createPlaylist = usePlayerStore(s => s.createPlaylist);
  const addSongToPlaylist = usePlayerStore(s => s.addSongToPlaylist);
  const [newName, setNewName] = useState("");

  if (!song) return null;

  const names = Object.keys(playlists).sort();

  const handleAdd = async (name: string) => {
    await addSongToPlaylist(name, song);
    onClose();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    await createPlaylist(name);
    await addSongToPlaylist(name, song);
    setNewName("");
    onClose();
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Add to Playlist" height="55vh">
      <div className="h-full flex flex-col px-5 gap-3 pb-4">
        {/* Song preview */}
        <p className="text-xs text-zinc-500 truncate">
          <span className="text-zinc-300 font-medium">{song.title}</span> — {song.artist}
        </p>

        {/* Existing playlists */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 min-h-0">
          {names.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-zinc-700">
              <ListMusic className="w-8 h-8" />
              <p className="text-xs">No playlists yet — create one below</p>
            </div>
          ) : (
            names.map(name => (
              <button
                key={name}
                onClick={() => handleAdd(name)}
                className="w-full text-left px-4 py-3 hover:bg-zinc-800/60 border border-zinc-800/30 hover:border-zinc-700/50 rounded-xl text-sm text-zinc-300 hover:text-white font-medium transition cursor-pointer flex items-center justify-between group"
              >
                <span>{name}</span>
                <span className="text-xs text-zinc-600 group-hover:text-zinc-500">
                  {playlists[name]?.length ?? 0} tracks
                </span>
              </button>
            ))
          )}
        </div>

        {/* Create new */}
        <form onSubmit={handleCreate} className="flex gap-2 flex-shrink-0 border-t border-zinc-800/40 pt-3">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="New playlist name…"
            className="flex-1 bg-zinc-950 border border-zinc-800 focus:border-zinc-600 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-700"
          />
          <button
            type="submit"
            disabled={!newName.trim()}
            className="px-4 py-2.5 bg-white hover:bg-zinc-200 text-zinc-950 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-40 transition"
          >
            <Plus className="w-3.5 h-3.5" /> Create
          </button>
        </form>
      </div>
    </BottomSheet>
  );
}
