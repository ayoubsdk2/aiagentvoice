import { useState } from "react";
import { Delete, ArrowUp, CornerDownLeft, Space } from "lucide-react";
import { cn } from "@/lib/utils";

const ROWS = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["z", "x", "c", "v", "b", "n", "m", ",", ".", "?"],
];

interface OnScreenKeyboardProps {
  onInsert: (text: string) => void;
  onBackspace: () => void;
}

export function OnScreenKeyboard({ onInsert, onBackspace }: OnScreenKeyboardProps) {
  const [shift, setShift] = useState(false);

  const press = (k: string) => {
    onInsert(shift ? k.toUpperCase() : k);
    if (shift) setShift(false);
  };

  return (
    <div className="rounded-lg border border-border/50 bg-secondary/40 p-2 sm:p-3 select-none">
      {ROWS.map((row, idx) => (
        <div key={idx} className="flex gap-1 sm:gap-1.5 justify-center mb-1 sm:mb-1.5 last:mb-0">
          {idx === 3 && (
            <button
              type="button"
              aria-label="Shift"
              onClick={() => setShift((s) => !s)}
              className={cn(
                "h-9 px-2 rounded-md text-xs font-bold border border-border/50 bg-background hover:bg-secondary",
                shift && "bg-[#f5c542]/20 border-[#f5c542]/60 text-[#f5c542]",
              )}
            >
              <ArrowUp size={14} />
            </button>
          )}
          {row.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => press(k)}
              className="h-9 w-7 sm:w-8 rounded-md text-xs sm:text-sm font-medium border border-border/50 bg-background hover:bg-[#f5c542]/10 hover:border-[#f5c542]/40 transition-colors"
            >
              {shift ? k.toUpperCase() : k}
            </button>
          ))}
          {idx === 3 && (
            <button
              type="button"
              aria-label="Backspace"
              onClick={onBackspace}
              className="h-9 px-2 rounded-md text-xs font-bold border border-border/50 bg-background hover:bg-destructive/20"
            >
              <Delete size={14} />
            </button>
          )}
        </div>
      ))}
      <div className="flex gap-1 sm:gap-1.5 justify-center">
        <button
          type="button"
          aria-label="Space"
          onClick={() => onInsert(" ")}
          className="h-9 flex-1 max-w-[280px] rounded-md text-xs font-medium border border-border/50 bg-background hover:bg-[#f5c542]/10 inline-flex items-center justify-center gap-2"
        >
          <Space size={14} /> space
        </button>
        <button
          type="button"
          aria-label="Enter"
          onClick={() => onInsert("\n")}
          className="h-9 px-3 rounded-md text-xs font-bold border border-border/50 bg-background hover:bg-secondary inline-flex items-center gap-1"
        >
          <CornerDownLeft size={14} />
        </button>
      </div>
    </div>
  );
}
