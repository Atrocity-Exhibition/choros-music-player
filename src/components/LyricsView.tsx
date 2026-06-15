import { Music2 } from "lucide-react";

interface LyricsViewProps {
  lyrics: string | null;
  isLoading: boolean;
}

export function LyricsView({ lyrics, isLoading }: LyricsViewProps) {
  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-zinc-600">
          <Music2 className="w-8 h-8 animate-pulse" />
          <p className="text-xs font-medium">Loading lyrics…</p>
        </div>
      </div>
    );
  }

  if (!lyrics) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-zinc-700">
          <Music2 className="w-8 h-8" />
          <p className="text-xs font-semibold">No lyrics available</p>
          <p className="text-[10px] text-zinc-800 text-center leading-relaxed max-w-[180px]">
            Embed lyrics in the file's USLT or LYRICS tag to display them here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-y-auto px-4 py-2 animate-flip-in">
      <pre className="text-sm text-zinc-300 leading-7 whitespace-pre-wrap font-sans text-center select-text">
        {lyrics}
      </pre>
    </div>
  );
}
