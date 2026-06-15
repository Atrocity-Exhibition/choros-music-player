import { useState } from "react";
import { X, RefreshCw } from "lucide-react";
import type { Song } from "../store/playerStore";
import { usePlayerStore } from "../store/playerStore";

interface MetadataEditorProps {
  song: Song;
  onClose: () => void;
}

type EditableFields = Omit<Song, "path" | "duration">;

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  "bg-zinc-950 border border-zinc-800/80 focus:border-zinc-600/80 focus:ring-1 focus:ring-zinc-700/30 rounded-xl px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-700";

export function MetadataEditor({ song, onClose }: MetadataEditorProps) {
  const updateSongMetadata = usePlayerStore(s => s.updateSongMetadata);

  const [fields, setFields] = useState<EditableFields>({
    title: song.title ?? "",
    artist: song.artist ?? "",
    album: song.album ?? "",
    genre: song.genre ?? "",
    albumArtist: song.albumArtist ?? "",
    publisher: song.publisher ?? "",
    copyright: song.copyright ?? "",
    isrc: song.isrc ?? "",
    track: song.track,
    trackTotal: song.trackTotal,
    disk: song.disk,
    diskTotal: song.diskTotal,
    year: song.year,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setStr = (key: keyof EditableFields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFields(prev => ({ ...prev, [key]: e.target.value }));

  const setNum = (key: keyof EditableFields) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    const parsed = parseInt(v, 10);
    setFields(prev => ({ ...prev, [key]: v === "" || isNaN(parsed) || parsed < 0 ? null : parsed }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await updateSongMetadata(song.path, fields);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save metadata");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 animate-fade-in">
      <div className="bg-zinc-900 border border-zinc-800/70 rounded-2xl w-full max-w-2xl shadow-2xl animate-slide-up flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4 flex-shrink-0 border-b border-zinc-800/60">
          <div>
            <h3 className="text-base font-bold text-white">Edit Track Metadata</h3>
            <p className="text-[11px] text-zinc-500 font-mono mt-1 truncate max-w-md" title={song.path}>
              {song.path.split("/").pop()}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
            {/* Track Info */}
            <div>
              <h4 className="text-[10px] text-zinc-600 font-bold tracking-widest uppercase mb-3">
                Track Information
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Title">
                  <input className={inputClass} value={fields.title} onChange={setStr("title")} required />
                </Field>
                <Field label="Artist">
                  <input className={inputClass} value={fields.artist} onChange={setStr("artist")} required />
                </Field>
                <Field label="Album Artist">
                  <input className={inputClass} value={fields.albumArtist ?? ""} onChange={setStr("albumArtist")} placeholder="Same as artist" />
                </Field>
                <Field label="Album">
                  <input className={inputClass} value={fields.album} onChange={setStr("album")} required />
                </Field>
                <Field label="Genre">
                  <input className={inputClass} value={fields.genre} onChange={setStr("genre")} />
                </Field>
              </div>
            </div>

            <div className="border-t border-zinc-800/40" />

            {/* Numbering */}
            <div>
              <h4 className="text-[10px] text-zinc-600 font-bold tracking-widest uppercase mb-3">
                Release &amp; Indexing
              </h4>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                {(
                  [
                    ["Track #", "track"],
                    ["Track Total", "trackTotal"],
                    ["Disc #", "disk"],
                    ["Disc Total", "diskTotal"],
                    ["Year", "year"],
                  ] as [string, keyof EditableFields][]
                ).map(([label, key]) => (
                  <Field key={key} label={label}>
                    <input
                      className={inputClass}
                      type="number"
                      min={0}
                      value={fields[key] ?? ""}
                      onChange={setNum(key)}
                    />
                  </Field>
                ))}
              </div>
            </div>

            <div className="border-t border-zinc-800/40" />

            {/* Publishing */}
            <div>
              <h4 className="text-[10px] text-zinc-600 font-bold tracking-widest uppercase mb-3">
                Publishing &amp; Identifiers
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Publisher / Label">
                  <input className={inputClass} value={fields.publisher ?? ""} onChange={setStr("publisher")} />
                </Field>
                <Field label="Copyright">
                  <input className={inputClass} value={fields.copyright ?? ""} onChange={setStr("copyright")} />
                </Field>
                <Field label="ISRC">
                  <input className={inputClass} value={fields.isrc ?? ""} onChange={setStr("isrc")} placeholder="XX-XXX-YY-NNNNN" />
                </Field>
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                {error}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 p-6 pt-4 border-t border-zinc-800/60 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white transition cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-white hover:bg-zinc-200 text-zinc-950 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
