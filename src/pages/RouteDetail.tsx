import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Bookmark,
  Check,
  ChevronLeft,
  Flag,
  Pencil,
  Trash2,
  Trophy,
  Zap,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { fetchRoute, type RouteWithStats } from "../lib/routes";
import { formatGrade, formatGymGrade } from "../lib/grades";
import { climbTypeLabel, holdHex } from "../lib/constants";
import { Button, CenterSpinner } from "../components/ui";
import { LogSheet } from "../components/LogSheet";
import type { SendType } from "../lib/database.types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * A climb's page: the photo, what climbers say it is, your log, and its
 * history. Read-only by design — once logged, nothing changes here unless
 * you hit "Edit log."
 */
export function RouteDetail() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const system = profile?.grade_system ?? "american";

  const [route, setRoute] = useState<RouteWithStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [myGrade, setMyGrade] = useState<number | null>(null);
  const [hasSent, setHasSent] = useState(false);
  const [mySendType, setMySendType] = useState<SendType | null>(null);
  const [myNote, setMyNote] = useState<string | null>(null);
  const [isProject, setIsProject] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!id || !profile) return;
    setLoading(true);
    const [r, { data: mine }, { data: mySend }, { data: bm }] =
      await Promise.all([
        fetchRoute(id),
        supabase
          .from("grades")
          .select("grade")
          .eq("route_id", id)
          .eq("user_id", profile.id)
          .maybeSingle(),
        supabase
          .from("sends")
          .select("send_type, note")
          .eq("route_id", id)
          .eq("user_id", profile.id)
          .maybeSingle(),
        supabase
          .from("bookmarks")
          .select("id")
          .eq("route_id", id)
          .eq("user_id", profile.id)
          .eq("kind", "project")
          .maybeSingle(),
      ]);
    setRoute(r);
    setMyGrade(mine?.grade ?? null);
    setHasSent(!!mySend && mySend.send_type !== "attempt");
    setMySendType(mySend?.send_type ?? null);
    setMyNote(mySend?.note ?? null);
    setIsProject(!!bm);
    setLoading(false);
  }, [id, profile]);

  useEffect(() => {
    load();
  }, [load]);

  // Topped (anchor with falls) → Sent (clean). One tap, no sheet.
  async function upgradeToSend() {
    if (!id || !profile) return;
    await supabase
      .from("sends")
      .update({ send_type: "send" })
      .eq("route_id", id)
      .eq("user_id", profile.id);
    load();
  }

  async function deleteLog() {
    if (!id || !profile) return;
    setDeleting(true);
    await supabase
      .from("sends")
      .delete()
      .eq("route_id", id)
      .eq("user_id", profile.id);
    navigate("/");
  }

  if (loading) {
    return (
      <div className="mx-auto flex h-full max-w-app flex-col bg-bg">
        <CenterSpinner />
      </div>
    );
  }

  if (!route) {
    return (
      <div className="mx-auto flex h-full max-w-app flex-col items-center justify-center gap-4 bg-bg px-8">
        <p className="text-faint">Climb not found.</p>
        <Button onClick={() => navigate("/")}>Back to logbook</Button>
      </div>
    );
  }

  const fmt = (g: number | null | undefined) =>
    formatGrade(g, route.climbing_type, system);

  return (
    <div className="mx-auto flex h-full max-w-app flex-col bg-bg">
      {/* Media */}
      <div className="relative">
        {route.video_url ? (
          <video
            src={route.video_url}
            poster={route.photo_url}
            className="aspect-[4/3] w-full bg-black object-cover"
            autoPlay
            muted
            loop
            playsInline
            controls
          />
        ) : (
          <img
            src={route.photo_url}
            alt={`${route.hold_color} route on ${route.wall_section}`}
            className="aspect-[4/3] w-full object-cover"
          />
        )}
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="absolute left-3 top-3 rounded-full bg-bg/70 p-2 text-chalk backdrop-blur"
        >
          <ChevronLeft size={22} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-10 pt-5">
        <div className="flex flex-col gap-5">
          {/* Identity */}
          <div>
            <div className="flex items-center gap-3">
              <span
                className="h-5 w-5 rounded-full border border-white/10"
                style={{ backgroundColor: holdHex(route.hold_color) }}
              />
              <div>
                <p className="text-lg font-bold text-chalk">{route.hold_color}</p>
                <p className="text-sm text-muted">
                  {route.wall_section} · {climbTypeLabel(route.climbing_type)}
                </p>
              </div>
            </div>
            <p className="mt-2 text-xs text-faint">
              {formatDate(route.created_at)}
            </p>
          </div>

          {/* Your grade vs the gym's grade */}
          <div className="flex gap-3">
            <div className="flex-1 rounded-2xl bg-surface px-4 py-3 shadow-card">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                Your grade
              </p>
              <p
                key={myGrade ?? -1}
                className="mt-0.5 animate-pop text-4xl font-extrabold leading-none tabular-nums text-accent"
              >
                {fmt(myGrade)}
              </p>
              <p className="mt-1.5 text-xs text-faint">
                {myGrade !== null ? "what it felt like" : "not graded yet"}
              </p>
            </div>
            {route.gym_grade !== null && route.gym_grade !== undefined ? (
              <div className="flex-1 rounded-2xl bg-surface px-4 py-3 shadow-card">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Gym says
                </p>
                <p className="mt-0.5 text-4xl font-extrabold leading-none tabular-nums text-chalk">
                  {formatGymGrade(
                    route.gym_grade,
                    route.climbing_type,
                    system,
                    route.gradingStyle,
                  )}
                </p>
                <p className="mt-1.5 text-xs text-faint">official grade</p>
              </div>
            ) : null}
          </div>

          {/* Your log — read-only until you hit Edit */}
          {hasSent ? (
            <div className="rounded-2xl bg-surface p-4 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-bold text-chalk">
                    {mySendType === "flash" ? (
                      <>
                        <Zap size={16} className="shrink-0 text-accent" /> You
                        flashed this
                      </>
                    ) : mySendType === "topped" ? (
                      <>
                        <Flag size={16} className="shrink-0 text-accent" /> You
                        topped this
                      </>
                    ) : (
                      <>
                        <Check size={16} className="shrink-0 text-accent" /> You
                        sent this
                      </>
                    )}
                  </p>
                  {myGrade !== null ? (
                    <p className="mt-1 text-xs text-muted">
                      Felt like{" "}
                      <span className="font-semibold text-chalk">
                        {fmt(myGrade)}
                      </span>
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => setConfirmDelete(true)}
                    aria-label="Delete this log"
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2 text-faint transition hover:text-wide"
                  >
                    <Trash2 size={16} />
                  </button>
                  <Button
                    variant="secondary"
                    className="h-9 px-4"
                    onClick={() => setLogOpen(true)}
                  >
                    <Pencil size={14} className="mr-1.5" /> Edit
                  </Button>
                </div>
              </div>
              {myNote ? (
                <p className="mt-3 border-t border-border/60 pt-3 text-sm italic text-muted">
                  "{myNote}"
                </p>
              ) : null}
              {mySendType === "topped" ? (
                <button
                  onClick={upgradeToSend}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-accent/10 py-2.5 text-sm font-bold text-accent transition hover:bg-accent/15 active:scale-[0.98]"
                >
                  <Check size={15} /> Sent it clean — upgrade to Sent
                </button>
              ) : null}
            </div>
          ) : isProject ? (
            <Button
              className="w-full"
              variant="secondary"
              onClick={() => navigate(`/project/${route.id}`)}
            >
              <Bookmark size={16} className="mr-2 text-accent" /> On your project
              board — open the journal
            </Button>
          ) : (
            <Button className="w-full" onClick={() => setLogOpen(true)}>
              <Trophy size={18} className="mr-2" /> Log this climb
            </Button>
          )}

        </div>
      </div>

      {/* Edit / first log — the unified sheet */}
      {logOpen && route ? (
        <LogSheet
          route={route}
          initialOutcome={
            hasSent ? mySendType : isProject ? "project" : null
          }
          onClose={() => setLogOpen(false)}
          onSaved={async () => {
            setLogOpen(false);
            await load();
          }}
        />
      ) : null}

      {/* Delete confirmation — spell out the consequences. */}
      {confirmDelete ? (
        <div
          className="fixed inset-0 z-40 mx-auto flex max-w-app animate-fade-in items-center justify-center bg-black/70 p-6 backdrop-blur-[2px]"
          onClick={() => !deleting && setConfirmDelete(false)}
        >
          <div
            className="w-full animate-pop rounded-3xl border border-border bg-surface p-5 shadow-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-wide/15">
              <Trash2 size={22} className="text-wide" />
            </div>
            <h2 className="text-lg font-extrabold text-chalk">
              Delete this climb?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              This removes it from your logbook, your stats, and your grade
              pyramid. If it's your only climb at this gym or country, that
              passport stamp goes away too. This can't be undone.
            </p>
            <div className="mt-5 flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                disabled={deleting}
                onClick={() => setConfirmDelete(false)}
              >
                Keep it
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                loading={deleting}
                onClick={deleteLog}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
