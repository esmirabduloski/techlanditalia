import { useState, useEffect } from "react";
import { Minus, Plus, Type } from "lucide-react";
import { Button } from "@/components/ui/button";

const FONT_SIZE_KEY = "techland-font-size";
const SIZES = [100, 112, 125] as const;

export function FontSizeWidget() {
  const [sizeIndex, setSizeIndex] = useState(() => {
    const saved = localStorage.getItem(FONT_SIZE_KEY);
    return saved ? SIZES.indexOf(Number(saved) as typeof SIZES[number]) : 0;
  });

  useEffect(() => {
    const size = SIZES[sizeIndex] ?? 100;
    document.documentElement.style.fontSize = `${size}%`;
    localStorage.setItem(FONT_SIZE_KEY, String(size));
  }, [sizeIndex]);

  const decrease = () => setSizeIndex((i) => Math.max(0, i - 1));
  const increase = () => setSizeIndex((i) => Math.min(SIZES.length - 1, i + 1));

  return (
    <div className="flex items-center gap-1" role="group" aria-label="Regola dimensione testo">
      <Button
        variant="ghost"
        size="icon"
        onClick={decrease}
        disabled={sizeIndex === 0}
        aria-label="Riduci dimensione testo"
        className="h-9 w-9"
      >
        <Minus className="h-4 w-4" />
      </Button>
      <Type className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      <Button
        variant="ghost"
        size="icon"
        onClick={increase}
        disabled={sizeIndex === SIZES.length - 1}
        aria-label="Aumenta dimensione testo"
        className="h-9 w-9"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
