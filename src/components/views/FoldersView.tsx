import { useState, useMemo } from "react";
import { Folder, FolderOpen, ChevronRight, ChevronDown, Music } from "lucide-react";
import { usePlayerStore } from "../../store/playerStore";
import type { Song } from "../../store/playerStore";
import { SongRow } from "../SongRow";

interface Props {
  onContextMenu: (e: React.MouseEvent, song: Song) => void;
  onAddToPlaylist: (song: Song) => void;
  formatTime: (s: number) => string;
}

interface FolderNode {
  name: string;
  path: string;
  songs: Song[];
  children: FolderNode[];
}

function buildTree(songs: Song[], rootFolder: string): FolderNode {
  const nodeMap = new Map<string, FolderNode>();

  // Seed root
  nodeMap.set(rootFolder, { name: rootFolder.split("/").pop() || rootFolder, path: rootFolder, songs: [], children: [] });

  for (const song of songs) {
    const dir = song.path.substring(0, song.path.lastIndexOf("/"));
    const parts = dir.startsWith(rootFolder)
      ? dir.slice(rootFolder.length).split("/").filter(Boolean)
      : [];

    let curPath = rootFolder;
    for (const part of parts) {
      const parentPath = curPath;
      curPath = `${curPath}/${part}`;
      if (!nodeMap.has(curPath)) {
        const node: FolderNode = { name: part, path: curPath, songs: [], children: [] };
        nodeMap.set(curPath, node);
        const parent = nodeMap.get(parentPath);
        if (parent) parent.children.push(node);
      }
    }

    const dirNode = nodeMap.get(dir);
    if (dirNode) dirNode.songs.push(song);
    else {
      const root = nodeMap.get(rootFolder);
      if (root) root.songs.push(song);
    }
  }

  return nodeMap.get(rootFolder)!;
}

function FolderItem({
  node,
  depth = 0,
  onContextMenu,
  onAddToPlaylist,
  formatTime,
  currentSong,
  isPlaying,
  playQueue,
}: {
  node: FolderNode;
  depth?: number;
  onContextMenu: (e: React.MouseEvent, song: Song) => void;
  onAddToPlaylist: (song: Song) => void;
  formatTime: (s: number) => string;
  currentSong: Song | null;
  isPlaying: boolean;
  playQueue: (songs: Song[], i: number) => void;
}) {
  const [open, setOpen] = useState(depth === 0);
  const hasChildren = node.children.length > 0;
  const hasSongs = node.songs.length > 0;

  if (!hasChildren && !hasSongs) return null;

  return (
    <div>
      {/* Folder header (not shown for root) */}
      {depth > 0 && (
        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-2 py-2 px-3 hover:bg-zinc-900/40 rounded-xl w-full text-left cursor-pointer transition group"
          style={{ paddingLeft: `${depth * 12 + 12}px` }}
        >
          {open ? <FolderOpen className="w-4 h-4 text-zinc-500 flex-shrink-0" /> : <Folder className="w-4 h-4 text-zinc-600 flex-shrink-0" />}
          <span className={`text-sm font-semibold truncate flex-1 ${open ? "text-zinc-300" : "text-zinc-500 group-hover:text-zinc-300"}`}>
            {node.name}
          </span>
          <span className="text-[10px] text-zinc-700 font-mono">
            {node.songs.length > 0 ? `${node.songs.length} track${node.songs.length !== 1 ? "s" : ""}` : ""}
          </span>
          {open ? <ChevronDown className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" />}
        </button>
      )}

      {open && (
        <div>
          {/* Songs in this folder */}
          {hasSongs && (
            <div className="flex flex-col gap-0.5 mb-1" style={{ paddingLeft: depth > 0 ? `${depth * 12}px` : "0" }}>
              {node.songs.map((song, i) => (
                <SongRow
                  key={song.path}
                  song={song}
                  index={i}
                  isCurrent={currentSong?.path === song.path}
                  isPlaying={isPlaying}
                  onClick={() => playQueue(node.songs, i)}
                  onContextMenu={e => onContextMenu(e, song)}
                  onAddToPlaylist={() => onAddToPlaylist(song)}
                  formatTime={formatTime}
                />
              ))}
            </div>
          )}
          {/* Child folders */}
          {node.children.map(child => (
            <FolderItem
              key={child.path}
              node={child}
              depth={depth + 1}
              onContextMenu={onContextMenu}
              onAddToPlaylist={onAddToPlaylist}
              formatTime={formatTime}
              currentSong={currentSong}
              isPlaying={isPlaying}
              playQueue={playQueue}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FoldersView({ onContextMenu, onAddToPlaylist, formatTime }: Props) {
  const library = usePlayerStore(s => s.library);
  const currentFolder = usePlayerStore(s => s.currentFolder);
  const currentSong = usePlayerStore(s => s.currentSong);
  const isPlaying = usePlayerStore(s => s.isPlaying);
  const playQueue = usePlayerStore(s => s.playQueue);

  const tree = useMemo(() => {
    if (!currentFolder || library.length === 0) return null;
    return buildTree(library, currentFolder);
  }, [library, currentFolder]);

  if (!tree) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-zinc-700">
        <Music className="w-12 h-12" />
        <p className="text-sm font-medium">No library loaded</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden gap-4 animate-fade-in">
      <div className="flex-shrink-0">
        <h2 className="text-xl font-extrabold text-white tracking-tight">Folders</h2>
        <p className="text-[11px] text-zinc-600 mt-0.5 font-mono truncate">{currentFolder}</p>
      </div>
      <div className="flex-1 overflow-y-auto pr-1">
        <FolderItem
          node={tree}
          depth={0}
          onContextMenu={onContextMenu}
          onAddToPlaylist={onAddToPlaylist}
          formatTime={formatTime}
          currentSong={currentSong}
          isPlaying={isPlaying}
          playQueue={playQueue}
        />
      </div>
    </div>
  );
}
