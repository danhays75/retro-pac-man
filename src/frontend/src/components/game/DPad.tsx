import type { Direction } from "@/types/game";
/**
 * DPad — on-screen directional pad overlay for touch devices.
 *
 * Renders a neon-styled cross of four cardinal buttons (up/down/left/right)
 * that call `onDirection` on press. Buttons use pointer events (not click)
 * so they respond instantly to touch and work with mouse for accessibility.
 * Each button has a visible focus ring and a 44px minimum hit target.
 *
 * The D-pad is purely a control surface — it does not own state. The parent
 * wires `onDirection` to the same `setDirection` / `queueDirection` channel
 * the keyboard listener uses, so all input flows through one path.
 */
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
} from "lucide-react";
import { useCallback, useState } from "react";

export interface DPadProps {
  /** Called with the pressed cardinal direction. */
  onDirection: (dir: Direction) => void;
  /** Optional: highlight the currently active direction. */
  activeDirection?: Direction;
}

type Cardinal = Exclude<Direction, "none">;
const DIRS: Array<{ dir: Cardinal; label: string; icon: typeof ChevronUp }> = [
  { dir: "up", label: "Move up", icon: ChevronUp },
  { dir: "left", label: "Move left", icon: ChevronLeft },
  { dir: "down", label: "Move down", icon: ChevronDown },
  { dir: "right", label: "Move right", icon: ChevronRight },
];

export function DPad({ onDirection, activeDirection = "none" }: DPadProps) {
  const [pressed, setPressed] = useState<Cardinal | null>(null);

  const handlePress = useCallback(
    (dir: Cardinal) => {
      setPressed(dir);
      onDirection(dir);
    },
    [onDirection],
  );

  const handleRelease = useCallback(() => setPressed(null), []);

  return (
    <fieldset
      className="grid grid-cols-3 grid-rows-3 gap-1.5"
      aria-label="Directional pad"
      data-ocid="game.dpad.section"
      // Touch-action none prevents the browser from interpreting D-pad
      // presses as scrolls/gestures while still allowing the page to scroll
      // elsewhere.
      style={{ touchAction: "none" }}
    >
      {DIRS.map(({ dir, label, icon: Icon }) => {
        const isActive = pressed === dir || activeDirection === dir;
        const gridPos =
          dir === "up"
            ? { gridColumn: 2, gridRow: 1 }
            : dir === "left"
              ? { gridColumn: 1, gridRow: 2 }
              : dir === "down"
                ? { gridColumn: 2, gridRow: 3 }
                : { gridColumn: 3, gridRow: 2 };
        return (
          <button
            key={dir}
            type="button"
            aria-label={label}
            data-ocid={`game.dpad.${dir}`}
            onPointerDown={(e) => {
              e.preventDefault();
              handlePress(dir);
            }}
            onPointerUp={handleRelease}
            onPointerLeave={handleRelease}
            onPointerCancel={handleRelease}
            className={[
              "flex h-12 w-12 items-center justify-center rounded-sm border transition-smooth",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? "border-primary bg-primary/20 text-primary shadow-neon-yellow"
                : "border-secondary/40 bg-secondary/10 text-secondary/80 hover:bg-secondary/20 hover:text-secondary",
            ].join(" ")}
            style={gridPos}
          >
            <Icon className="h-6 w-6" aria-hidden />
          </button>
        );
      })}
    </fieldset>
  );
}
