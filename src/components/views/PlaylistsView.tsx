import { useState } from "react";
import { Plus, Trash2, ListMusic } from "lucide-react";
import { usePlayerStore } from "../../store/playerStore";
import type { Song } from "../../store/playerStore";
import { LazyCover } from "../LazyCover";
import { HeroDetail } from "../HeroDetail";

interface Props {
  onContextMenu: (e: React.MouseEvent, song: Song) => void;
  onAddToPlaylist: (song: Song) => void;
  formatTime: (s: number) => string;
}

export function PlaylistsView({ onContextMenu, onAddToPlaylist, formatTime }: Props) {
  const { playlists, streamPort, createPlaylist, deletePlaylist } = usePlayerStore();
  const [selected, setSelected] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  const names = Object.keys(playlists).sort();

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    createPlaylist(name);
    setNewName("");
  };

  if (selected && playlists[selected] !== undefined) {
    const songs = playlists[selected] ?? [];
    return (
      <HeroDetail
        title={selected}
        subtitle={`${songs.length} track${songs.length !== 1 ? "s" : ""}`}
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
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-tight">Playlists</h2>
          <p className="text-[11px] text-zinc-600 mt-0.5 font-medium">{names.length} playlists</p>
        </div>
        <form onSubmit={handleCreate} className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="New playlist…"
            className="bg-zinc-900/60 border border-zinc-800/60 focus:border-zinc-700/60 rounded-xl px-3 py-2 text-sm text-white outline-none transition placeholder:text-zinc-700 w-36"
          />
          <button type="submit" disabled={!newName.trim()}
            className="px-3 py-2 bg-white hover:bg-zinc-200 text-zinc-950 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-40 transition"
          >
            <Plus className="w-3.5 h-3.5" /> Create
          </button>
        </form>
      </div>

      {names.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 border border-dashed border-zinc-800/60 rounded-2xl text-zinc-700">
          <ListMusic className="w-12 h-12" />
          <p className="text-base font-bold">No playlists yet</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {names.map(name => {
            const songs = playlists[name] ?? [];
            return (
              <div key={name} onClick={() => setSelected(name)}
                className="bg-zinc-900/30 hover:bg-zinc-900/60 border border-zinc-800/40 hover:border-zinc-700/50 p-3 rounded-2xl cursor-pointer transition-all duration-200 flex flex-col group relative"
              >
                <div className="w-full aspect-square rounded-xl mb-3 border border-zinc-800/40 relative overflow-hidden shadow-md group-hover:scale-[1.02] transition-transform duration-200">
                  {songs.length > 0
                    ? <LazyCover songPath={songs[0].path} fallbackIcon={ListMusic} />
                    : <div className="w-full h-full bg-zinc-900 flex items-center justify-center"><ListMusic className="w-8 h-8 text-zinc-600" /></div>}
                </div>
                <p className="font-semibold text-sm text-white truncate group-hover:text-zinc-300 transition" title={name}>{name}</p>
                <p className="text-[11px] text-zinc-600 mt-0.5">{songs.length} tracks</p>
                <button
                  onClick={async e => {
                    e.stopPropagation();
                    if (confirm(`Delete "${name}"?`)) { if (selected === name) setSelected(null); await deletePlaylist(name); }
                  }}
                  className="absolute top-2.5 right-2.5 p-1.5 bg-zinc-950/80 hover:bg-red-500/20 border border-zinc-800/40 hover:border-red-500/30 text-zinc-600 hover:text-red-400 rounded-lg transition opacity-0 group-hover:opacity-100 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
