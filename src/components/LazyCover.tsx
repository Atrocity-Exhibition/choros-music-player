import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { usePlayerStore } from "../store/playerStore";
import { getCached, setCached } from "../lib/coverCache";

interface LazyCoverProps {
  songPath: string;
  className?: string;
  isRound?: boolean;
  fallbackIcon: React.ComponentType<{ className?: string }>;
}

export function LazyCover({ songPath, className = "", isRound = false, fallbackIcon: FallbackIcon }: LazyCoverProps) {
  const streamPort = usePlayerStore(s => s.streamPort);
  const containerRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Reset error/loaded state when song changes
  useEffect(() => {
    setLoaded(false);
    setHasError(false);
  }, [songPath]);

  // Intersection Observer — only load when scrolled into view
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [songPath]);

  const shape = isRound ? "rounded-full" : "rounded-xl";
  const baseClass = `w-full h-full overflow-hidden ${shape} ${className}`;

  if (!inView) {
    return (
      <div ref={containerRef} className={`${baseClass} bg-zinc-900/40 flex items-center justify-center`}>
        <RefreshCw className="w-3.5 h-3.5 text-zinc-700 animate-pulse" />
      </div>
    );
  }

  if (streamPort === null) {
    return (
      <div ref={containerRef} className={`${baseClass} bg-zinc-900/40 flex items-center justify-center`}>
        <RefreshCw className="w-3.5 h-3.5 text-zinc-600 animate-spin" />
      </div>
    );
  }

  if (hasError || !songPath) {
    return (
      <div
        ref={containerRef}
        className={`${baseClass} bg-gradient-to-br from-zinc-800 to-zinc-950 flex items-center justify-center`}
      >
        <FallbackIcon className={`text-zinc-600 ${isRound ? "w-6 h-6" : "w-8 h-8"}`} />
      </div>
    );
  }

  // Check cache first — avoids a flash on re-render
  const cached = getCached(songPath);
  if (cached === null) {
    return (
      <div
        ref={containerRef}
        className={`${baseClass} bg-gradient-to-br from-zinc-800 to-zinc-950 flex items-center justify-center`}
      >
        <FallbackIcon className={`text-zinc-600 ${isRound ? "w-6 h-6" : "w-8 h-8"}`} />
      </div>
    );
  }

  const src = cached ?? `http://127.0.0.1:${streamPort}/cover?path=${encodeURIComponent(songPath)}`;

  return (
    <div ref={containerRef} className={`${baseClass} relative bg-zinc-900`}>
      {!loaded && (
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center">
          <FallbackIcon className={`text-zinc-700 ${isRound ? "w-5 h-5" : "w-7 h-7"}`} />
        </div>
      )}
      <img
        src={src}
        alt=""
        className={`w-full h-full object-cover ${shape} transition-opacity duration-300 ${loaded ? "opacity-100 cover-loaded" : "opacity-0"}`}
        onLoad={() => {
          setCached(songPath, src);
          setLoaded(true);
        }}
        onError={() => {
          setCached(songPath, null);
          setHasError(true);
        }}
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}
