import {
  Music, Disc, User, ListMusic,
  Heart, Folder, Settings,
  FolderOpen, RefreshCw,
} from "lucide-react";
import type { ActiveTab } from "../store/playerStore";

interface NavItem {
  id: ActiveTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV: NavItem[] = [
  { id: "library",     label: "All Songs",    icon: Music },
  { id: "albums",      label: "Albums",       icon: Disc },
  { id: "artists",     label: "Artists",      icon: User },
  { id: "albumArtist", label: "Album Artist", icon: User },
  { id: "playlists",   label: "Playlists",    icon: ListMusic },
  { id: "favourites",  label: "Favourites",   icon: Heart },
  { id: "queue",       label: "Queue",        icon: ListMusic },
  { id: "folders",     label: "Folders",      icon: Folder },
];

interface SidebarProps {
  activeTab: ActiveTab;
  currentFolder: string | null;
  isScanning: boolean;
  onSelectTab: (tab: ActiveTab) => void;
  onImportFolder: () => void;
  onRescan: () => void;
}

export function Sidebar({
  activeTab, currentFolder, isScanning,
  onSelectTab, onImportFolder, onRescan,
}: SidebarProps) {
  const btn = (item: NavItem) => {
    const active = activeTab === item.id;
    return (
      <button
        key={item.id}
        onClick={() => onSelectTab(item.id)}
        className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer w-full text-left ${
          active
            ? "bg-zinc-800/80 text-white"
            : "text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/30"
        }`}
      >
        <item.icon className={`w-4 h-4 flex-shrink-0 ${item.id === "favourites" && active ? "fill-pink-400 text-pink-400" : ""}`} />
        <span>{item.label}</span>
      </button>
    );
  };

  return (
    <aside className="w-52 flex-shrink-0 flex flex-col bg-zinc-950 border-r border-zinc-800/40 py-3">
      {/* Nav items */}
      <nav className="flex flex-col gap-0.5 px-3 flex-1">
        {NAV.map(btn)}
      </nav>

      {/* Folder block */}
      <div className="px-3 mt-2 mb-1">
        {currentFolder ? (
          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-3 flex flex-col gap-2">
            <p className="font-mono text-[9px] text-zinc-700 break-all leading-relaxed" title={currentFolder}>
              {currentFolder.length > 45 ? "…" + currentFolder.slice(-44) : currentFolder}
            </p>
            <div className="flex gap-1">
              <button
                onClick={onRescan}
                disabled={isScanning}
                className="flex-1 py-1.5 bg-zinc-800 hover:bg-zinc-700/80 rounded-lg flex items-center justify-center gap-1 text-[10px] font-semibold text-zinc-400 hover:text-white transition disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${isScanning ? "animate-spin" : ""}`} />
                Rescan
              </button>
              <button
                onClick={onImportFolder}
                disabled={isScanning}
                className="py-1.5 px-2 bg-zinc-800 hover:bg-zinc-700/80 rounded-lg text-zinc-400 hover:text-white transition disabled:opacity-50 cursor-pointer"
                title="Change folder"
              >
                <FolderOpen className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={onImportFolder}
            disabled={isScanning}
            className="w-full py-2.5 px-3 bg-zinc-100 hover:bg-white text-zinc-950 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 shadow-lg shadow-white/5"
          >
            {isScanning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FolderOpen className="w-3.5 h-3.5" />}
            {isScanning ? "Scanning…" : "Import Folder"}
          </button>
        )}
      </div>

      {/* Settings — pinned at bottom, no divider */}
      <nav className="px-3">
        {btn({ id: "settings", label: "Settings", icon: Settings })}
      </nav>
    </aside>
  );
}
