import { Camera, Images, X } from "lucide-react";
import type { PhotoSource } from "../lib/photo";

type Props = {
  open: boolean;
  onClose: () => void;
  onChoose: (source: PhotoSource) => void;
};

export function PhotoSourceSheet({ open, onClose, onChoose }: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 mx-auto flex max-w-app animate-fade-in items-end bg-black/70 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add a photo"
        className="w-full animate-fade-up rounded-[2rem] border border-border bg-surface p-4 shadow-card"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-1 pb-3">
          <div>
            <p className="text-lg font-extrabold text-chalk">Add a photo</p>
            <p className="text-sm text-muted">Choose where it comes from.</p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-muted transition active:scale-95"
          >
            <X size={19} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onChoose("camera")}
            className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-3xl border border-accent/30 bg-accent/10 px-3 text-center text-accent transition active:scale-[0.98]"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-bg">
              <Camera size={23} strokeWidth={2.3} />
            </span>
            <span className="text-sm font-bold">Take photo</span>
          </button>
          <button
            type="button"
            onClick={() => onChoose("photos")}
            className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-3xl border border-border bg-surface-2 px-3 text-center text-chalk transition active:scale-[0.98]"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-surface text-muted">
              <Images size={23} strokeWidth={2.2} />
            </span>
            <span className="text-sm font-bold">Photo library</span>
          </button>
        </div>
      </div>
    </div>
  );
}
