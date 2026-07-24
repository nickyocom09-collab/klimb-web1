// Builds a branded, portrait "I climbed this" share card on a canvas — the
// same visual language as the weekly recap, but for a single logged climb.

export type ShareOutcome = "flash" | "send" | "topped" | "project";

export type ShareClimb = {
  routeId: string;
  photoUrl: string;
  /** Already-formatted grade, e.g. "V4" or "5.11a". */
  gradeText: string;
  outcome: ShareOutcome;
  /** "Boulder" | "Top Rope" | "Lead". */
  climbLabel: string;
  gymName?: string | null;
};

const OUTCOME_META: Record<ShareOutcome, { label: string; color: string }> = {
  flash: { label: "FLASHED", color: "#FFD166" },
  send: { label: "SENT", color: "#CED4DB" },
  topped: { label: "TOPPED", color: "#7CC5FF" },
  project: { label: "PROJECT", color: "#E4B363" },
};

const BG = "#0d100f";
const CHALK = "#F5F5F2";
const MUTED = "#9AA0A8";

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Draw `img` cover-style into the rect (x,y,w,h). */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const ir = img.width / img.height;
  const rr = w / h;
  let sw = img.width;
  let sh = img.height;
  let sx = 0;
  let sy = 0;
  if (ir > rr) {
    sw = img.height * rr;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / rr;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

export async function buildClimbCard(climb: ShareClimb): Promise<HTMLCanvasElement> {
  const W = 1080;
  const H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const meta = OUTCOME_META[climb.outcome];

  // Background
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // Photo across the top ~62%, cover-fit, fading into the background.
  const photoH = 1190;
  const img = await loadImage(climb.photoUrl);
  if (img) {
    drawCover(ctx, img, 0, 0, W, photoH);
  } else {
    ctx.fillStyle = "#1b1e1c";
    ctx.fillRect(0, 0, W, photoH);
  }
  const grad = ctx.createLinearGradient(0, photoH - 380, 0, photoH);
  grad.addColorStop(0, "rgba(13,16,15,0)");
  grad.addColorStop(1, BG);
  ctx.fillStyle = grad;
  ctx.fillRect(0, photoH - 380, W, 380);

  // Outcome pill
  ctx.font = "700 46px system-ui, -apple-system, sans-serif";
  const pillText = meta.label;
  const pillW = ctx.measureText(pillText).width + 80;
  const pillX = (W - pillW) / 2;
  const pillY = photoH - 40;
  ctx.fillStyle = meta.color;
  roundRect(ctx, pillX, pillY, pillW, 84, 42);
  ctx.fill();
  ctx.fillStyle = "#0d100f";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(pillText, W / 2, pillY + 45);

  // Big grade
  ctx.fillStyle = CHALK;
  ctx.font = "800 340px system-ui, -apple-system, sans-serif";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(climb.gradeText, W / 2, 1560);

  // Subline: climb type · gym
  ctx.fillStyle = MUTED;
  ctx.font = "500 44px system-ui, -apple-system, sans-serif";
  const sub = climb.gymName
    ? `${climb.climbLabel}  ·  ${climb.gymName}`
    : climb.climbLabel;
  ctx.fillText(sub, W / 2, 1640);

  // Footer brand: mountain glyph + KLIMB
  const cx = W / 2;
  const fy = 1810;
  ctx.strokeStyle = "#CED4DB";
  ctx.fillStyle = "#CED4DB";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(cx - 150, fy + 6);
  ctx.lineTo(cx - 118, fy - 36);
  ctx.lineTo(cx - 96, fy - 10);
  ctx.lineTo(cx - 74, fy - 44);
  ctx.lineTo(cx - 40, fy + 6);
  ctx.closePath();
  ctx.fill();
  ctx.font = "800 58px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "left";
  ctx.fillStyle = CHALK;
  ctx.fillText("KLIMB", cx - 18, fy + 4);

  return canvas;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
