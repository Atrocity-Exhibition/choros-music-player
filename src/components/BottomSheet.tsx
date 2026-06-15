import { useEffect, useRef } from "react";
import { X } from "lucide-react";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  height?: string;
}

export function BottomSheet({ isOpen, onClose, title, children, height = "60vh" }: BottomSheetProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 z-50 flex flex-col justify-end"
      onClick={e => { if (e.target === overlayRef.current) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] animate-fade-in" />

      {/* Sheet */}
      <div
        className="relative bg-zinc-900/98 border-t border-zinc-800/60 rounded-t-2xl shadow-2xl animate-sheet-up flex flex-col overflow-hidden"
        style={{ height }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle + header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 flex-shrink-0">
          <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-8 h-1 bg-zinc-700 rounded-full" />
          <h3 className="text-sm font-bold text-white mt-1">{title}</h3>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
