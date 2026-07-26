import { useEffect, useRef, useState } from "react";
import { Check, Move, X } from "lucide-react";

type Position = { x: number; y: number };

export function AvatarCropper({
  file,
  onCancel,
  onConfirm,
}: {
  file: File;
  onCancel: () => void;
  onConfirm: (file: File) => void;
}) {
  const [src, setSrc] = useState("");
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement>(null);
  const drag = useRef<{ x: number; y: number; position: Position } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function startDrag(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, position };
  }

  function move(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    const d = drag.current;
    setPosition({ x: d.position.x + e.clientX - d.x, y: d.position.y + e.clientY - d.y });
  }

  function crop() {
    const image = imageRef.current;
    if (!image) return;
    const size = 720;
    const scale = Math.max(size / image.naturalWidth, size / image.naturalHeight) * zoom;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    ctx.drawImage(image, (size - width) / 2 + position.x * 2, (size - height) / 2 + position.y * 2, width, height);
    canvas.toBlob((blob) => {
      if (blob) onConfirm(new File([blob], "avatar.jpg", { type: "image/jpeg" }));
    }, "image/jpeg", 0.92);
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/80 px-4 pb-5 backdrop-blur-sm sm:items-center sm:pb-0">
      <div className="w-full max-w-sm overflow-hidden rounded-[28px] border border-white/10 bg-[#111613] shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <h2 className="font-display text-lg font-bold text-chalk">Frame your photo</h2>
            <p className="mt-0.5 text-xs text-muted">Drag to reposition · pinch-free zoom below</p>
          </div>
          <button onClick={onCancel} className="rounded-full p-2 text-muted hover:bg-white/10 hover:text-chalk" aria-label="Cancel crop"><X size={19} /></button>
        </div>
        <div className="mx-5 overflow-hidden rounded-full border-2 border-accent/80 bg-black" style={{ aspectRatio: "1" }}>
          <div className="h-full w-full touch-none cursor-grab active:cursor-grabbing" onPointerDown={startDrag} onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
            {src ? <img ref={imageRef} src={src} alt="Crop preview" draggable={false} className="h-full w-full select-none object-contain" style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})` }} /> : null}
          </div>
        </div>
        <div className="px-5 pb-5 pt-4">
          <div className="mb-4 flex items-center gap-3 text-muted"><Move size={16} /><input aria-label="Zoom photo" type="range" min="1" max="3" step="0.01" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="h-1 flex-1 accent-accent" /></div>
          <button onClick={crop} className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 font-semibold text-bg"><Check size={18} /> Use this photo</button>
        </div>
      </div>
    </div>
  );
}
