import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Play, Trash2, Video, X } from "lucide-react";
import { ProBadge } from "../components/ProBadge";
import { CenterSpinner } from "../components/ui";
import { useAuth } from "../lib/auth";
import { climbTypeLabel } from "../lib/constants";
import type { Database } from "../lib/database.types";
import { useEntitlements } from "../lib/entitlements";
import { routeLabel } from "../lib/routeLabel";
import { supabase } from "../lib/supabase";

type VideoRow = Database["public"]["Tables"]["climb_videos"]["Row"];
type RouteSummary = {
  id: string;
  gym_id: string;
  name: string | null;
  hold_color: string;
  climbing_type: "boulder" | "toprope" | "lead";
};
type LibraryVideo = VideoRow & {
  route: RouteSummary | null;
  gymName: string | null;
  signedUrl: string;
};

function VideoPlayer({ src }: { src: string }) {
  return (
    <video
      src={src}
      controls
      autoPlay
      playsInline
      preload="metadata"
      controlsList="nodownload"
      disablePictureInPicture
      onContextMenu={(event) => event.preventDefault()}
      className="h-full w-full bg-black object-contain"
    />
  );
}

export function VideoLibrary() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { hasProAccess } = useEntitlements();
  const [videos, setVideos] = useState<LibraryVideo[]>([]);
  const [openVideo, setOpenVideo] = useState<LibraryVideo | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!profile) return;
    setLoading(true);
    setError(null);
    const { data: rows, error: videoError } = await supabase
      .from("climb_videos")
      .select("*")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (videoError) {
      setError("Your video library couldn't load. Check your connection and try again.");
      setLoading(false);
      return;
    }

    const videoRows = (rows ?? []) as VideoRow[];
    const routeIds = [...new Set(videoRows.map((video) => video.route_id))];
    const [{ data: routeRows }, { data: signedRows }] = await Promise.all([
      routeIds.length
        ? supabase.from("routes").select("id, gym_id, name, hold_color, climbing_type").in("id", routeIds)
        : Promise.resolve({ data: [] as RouteSummary[] }),
      videoRows.length
        ? supabase.storage.from("climb-videos").createSignedUrls(videoRows.map((video) => video.storage_path), 60 * 60)
        : Promise.resolve({ data: [] as { path: string; signedUrl: string }[] }),
    ]);
    const routes = (routeRows ?? []) as RouteSummary[];
    const gymIds = [...new Set(routes.map((route) => route.gym_id))];
    const { data: gymRows } = gymIds.length
      ? await supabase.from("gyms").select("id, name").in("id", gymIds)
      : { data: [] as { id: string; name: string }[] };
    const routeMap = new Map(routes.map((route) => [route.id, route]));
    const gymMap = new Map((gymRows ?? []).map((gym) => [gym.id, gym.name]));
    const signedMap = new Map((signedRows ?? []).filter((item) => item.signedUrl).map((item) => [item.path, item.signedUrl]));

    setVideos(videoRows.flatMap((video) => {
      const signedUrl = signedMap.get(video.storage_path);
      if (!signedUrl) return [];
      const route = routeMap.get(video.route_id) ?? null;
      return [{
        ...video,
        route,
        gymName: route ? gymMap.get(route.gym_id) ?? null : null,
        signedUrl,
      }];
    }));
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // Reload only when the signed-in account changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  async function remove(video: LibraryVideo) {
    if (!profile || !window.confirm("Remove this video from your library?")) return;
    setBusyId(video.id);
    const { error: storageError } = await supabase.storage.from("climb-videos").remove([video.storage_path]);
    if (!storageError) {
      await supabase.from("climb_videos").delete().eq("id", video.id).eq("user_id", profile.id);
      setVideos((current) => current.filter((item) => item.id !== video.id));
    } else {
      setError("That video couldn't be removed. Try again.");
    }
    setBusyId(null);
  }

  return (
    <div className="min-h-full bg-bg pb-12 pt-safe">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-bg/90 px-5 pb-4 pt-3 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => navigate(-1)} aria-label="Back" className="grid h-11 w-11 place-items-center rounded-full border border-border bg-surface text-chalk"><ArrowLeft size={21} /></button>
          <ProBadge />
          <div className="h-11 w-11" />
        </div>
        <h1 className="mt-5 text-3xl font-black tracking-[-0.04em] text-chalk">Your video library</h1>
        <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted">Clips you attach while logging live here with the Klimb they belong to.</p>
      </header>

      <main className="grid gap-4 px-5 pt-5">
        {error ? <p role="alert" className="rounded-2xl border border-wide/20 bg-wide/5 px-4 py-3 text-sm text-wide">{error}</p> : null}
        {loading ? <CenterSpinner /> : null}
        {!loading && videos.length === 0 ? (
          <section className="rounded-3xl border border-border bg-surface px-6 py-12 text-center shadow-card">
            <Video size={32} className="mx-auto text-accent" />
            <h2 className="mt-3 font-extrabold text-chalk">Your first clip starts with a Klimb</h2>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-muted">
              {hasProAccess ? "Choose a video the next time you log. It will appear here automatically." : "Klimb Pro lets you attach a video while logging and keeps every clip organized here."}
            </p>
            {!hasProAccess ? (
              <button type="button" onClick={() => navigate("/upgrade")} className="mt-5 rounded-full bg-accent px-5 py-3 text-sm font-extrabold text-bg">
                See Klimb Pro
              </button>
            ) : null}
          </section>
        ) : null}

        {videos.map((video) => {
          const label = video.route ? routeLabel(video.route) : "Klimb";
          return (
            <article key={video.id} className="overflow-hidden rounded-3xl border border-border bg-surface shadow-card">
              <button type="button" onClick={() => setOpenVideo(video)} className="group relative block aspect-[4/5] w-full overflow-hidden bg-black text-left">
                <video src={video.signedUrl} muted playsInline preload="metadata" className="pointer-events-none h-full w-full object-cover" />
                <span className="absolute inset-0 grid place-items-center bg-black/10"><span className="grid h-14 w-14 place-items-center rounded-full border border-white/25 bg-black/55 text-white backdrop-blur"><Play size={23} fill="currentColor" /></span></span>
              </button>
              <div className="flex items-start gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-extrabold text-chalk">{label}</p>
                  <p className="mt-0.5 break-words text-xs text-muted">{video.gymName ?? "Your Klimb"}{video.route ? ` · ${climbTypeLabel(video.route.climbing_type)}` : ""}</p>
                  <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.15em] text-faint">{new Date(video.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</p>
                </div>
                <button type="button" disabled={busyId === video.id} onClick={() => void remove(video)} aria-label="Delete video" className="rounded-full p-2 text-faint transition active:text-wide disabled:opacity-40"><Trash2 size={17} /></button>
              </div>
              <button type="button" disabled={!video.route} onClick={() => video.route && navigate(`/route/${video.route.id}`)} className="flex w-full items-center justify-center border-t border-border px-4 py-3.5 text-sm font-extrabold text-accent transition active:bg-accent/5 disabled:text-faint">See Klimb</button>
            </article>
          );
        })}
      </main>

      {openVideo ? (
        <div className="fixed inset-0 z-[100] flex flex-col bg-black pt-safe">
          <div className="flex justify-end p-4"><button type="button" onClick={() => setOpenVideo(null)} aria-label="Done" className="grid h-11 w-11 place-items-center rounded-full bg-white text-black"><X size={21} /></button></div>
          <div className="min-h-0 flex-1"><VideoPlayer src={openVideo.signedUrl} /></div>
        </div>
      ) : null}
    </div>
  );
}
