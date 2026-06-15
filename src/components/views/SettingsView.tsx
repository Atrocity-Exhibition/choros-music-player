import { FolderOpen, RefreshCw, Keyboard } from "lucide-react";
import { usePlayerStore } from "../../store/playerStore";

interface Props {
  isScanning: boolean;
  onScan: () => void;
}

const KEYBINDS: [string, string][] = [
  ["Space", "Play / Pause"],
  ["→", "Seek +5 s"],
  ["←", "Seek −5 s"],
  ["↑", "Volume +5%"],
  ["↓", "Volume −5%"],
  ["M", "Mute toggle"],
  ["S", "Shuffle toggle"],
  ["R", "Repeat cycle"],
];

export function SettingsView({ isScanning, onScan }: Props) {
  const currentFolder = usePlayerStore(s => s.currentFolder);
  const clearLibrary = usePlayerStore(s => s.clearLibrary);

  return (
    <div className="flex-1 overflow-y-auto animate-fade-in">
      <div className="max-w-xl flex flex-col gap-6 py-1">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">Settings</h2>
          <p className="text-xs text-zinc-600 mt-0.5 font-medium">Library management and keyboard shortcuts</p>
        </div>

        {/* Library section */}
        <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-5 flex flex-col gap-4">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Library</h3>

          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-zinc-600 font-medium">Scanned directory</p>
            <div className="bg-zinc-950/60 font-mono text-xs text-zinc-400 p-3 border border-zinc-900 rounded-xl select-all break-all leading-relaxed">
              {currentFolder ?? "No folder imported yet"}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={onScan}
              disabled={isScanning}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer transition disabled:opacity-50"
            >
              {isScanning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FolderOpen className="w-3.5 h-3.5" />}
              {isScanning ? "Scanning…" : "Change Directory"}
            </button>
            <button
              onClick={() => {
                if (confirm("Clear the entire library cache? This cannot be undone.")) {
                  clearLibrary();
                }
              }}
              className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/30 text-red-400 hover:text-red-300 rounded-xl text-xs font-semibold cursor-pointer transition"
            >
              Clear Library Cache
            </button>
          </div>
        </div>

        {/* Keyboard shortcuts */}
        <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Keyboard className="w-3.5 h-3.5 text-zinc-500" />
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Keyboard Shortcuts</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5">
            {KEYBINDS.map(([key, desc]) => (
              <div key={key} className="flex items-center justify-between py-1.5 border-b border-zinc-800/40 last:border-0">
                <span className="text-xs text-zinc-500 font-medium">{desc}</span>
                <kbd className="px-2 py-0.5 bg-zinc-950 border border-zinc-800/60 rounded-lg font-mono text-[10px] text-zinc-400">
                  {key}
                </kbd>
              </div>
            ))}
          </div>
        </div>

        {/* About */}
        <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-5">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">About</h3>
          <p className="text-xs text-zinc-600 leading-relaxed">
            Choros is an offline desktop music player built with Tauri + React.
            All metadata is read and written directly to your audio files using the lofty Rust library.
            No internet connection required.
          </p>
        </div>
      </div>
    </div>
  );
}
