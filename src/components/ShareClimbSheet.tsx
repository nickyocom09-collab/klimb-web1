import { useEffect, useState } from "react";
import { Camera, Check, MessageCircle, Share2, X } from "lucide-react";
import { useAuth } from "../lib/auth";
import { fetchFriends, type FriendProfile } from "../lib/friends";
import { sendClimbToFriend } from "../lib/climbShares";
import { buildClimbCard, type ShareClimb } from "../lib/shareCard";
import {
  shareCanvasToInstagram,
  shareCanvasToMessages,
  shareCanvasViaSheet,
} from "../lib/share";
import { Spinner } from "./ui";

const VERB: Record<ShareClimb["outcome"], string> = {
  flash: "flashed",
  send: "sent",
  topped: "topped",
  project: "am projecting",
};

/**
 * Share one logged climb: a branded card out to Instagram / Messages / the OS
 * share sheet, or straight to a Klimb friend in-app.
 */
export function ShareClimbSheet({
  climb,
  onClose,
}: {
  climb: ShareClimb;
  onClose: () => void;
}) {
  const { profile } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [friends, setFriends] = useState<FriendProfile[] | null>(null);
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());

  const shareText = `I ${VERB[climb.outcome]} ${climb.gradeText}${
    climb.gymName ? ` at ${climb.gymName}` : ""
  } 🧗 — logged on Klimb`;

  useEffect(() => {
    if (!profile) return;
    fetchFriends(profile.id).then(setFriends);
  }, [profile]);

  async function toInstagram() {
    setBusy("ig");
    const card = await buildClimbCard(climb);
    const handled = await shareCanvasToInstagram(card);
    if (!handled) {
      await shareCanvasViaSheet(card, {
        filename: "klimb-climb.png",
        title: "My Klimb send",
        text: shareText,
        onFallback: setPreview,
      });
    }
    setBusy(null);
  }

  async function toMessages() {
    setBusy("msg");
    const card = await buildClimbCard(climb);
    const handled = await shareCanvasToMessages(card, shareText);
    if (!handled) {
      await shareCanvasViaSheet(card, {
        filename: "klimb-climb.png",
        title: "My Klimb send",
        text: shareText,
        onFallback: setPreview,
      });
    }
    setBusy(null);
  }

  async function toSheet() {
    setBusy("more");
    const card = await buildClimbCard(climb);
    await shareCanvasViaSheet(card, {
      filename: "klimb-climb.png",
      title: "My Klimb send",
      text: shareText,
      onFallback: setPreview,
    });
    setBusy(null);
  }

  async function toFriend(f: FriendProfile) {
    if (!profile || sentTo.has(f.id)) return;
    setBusy(`f-${f.id}`);
    try {
      await sendClimbToFriend(climb.routeId, profile.id, f.id);
      setSentTo((s) => new Set(s).add(f.id));
    } catch {
      /* ignore — leave the row tappable to retry */
    }
    setBusy(null);
  }

  return (
    <div
      className="fixed inset-0 z-40 mx-auto flex max-w-app animate-fade-in items-end bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full animate-fade-up rounded-3xl border border-border bg-surface p-5 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-chalk">Share this climb</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-muted transition hover:text-chalk"
          >
            <X size={18} />
          </button>
        </div>

        {/* External targets */}
        <div className="grid grid-cols-3 gap-2.5">
          <Target
            icon={Camera}
            label="Instagram"
            loading={busy === "ig"}
            onClick={toInstagram}
          />
          <Target
            icon={MessageCircle}
            label="Messages"
            loading={busy === "msg"}
            onClick={toMessages}
          />
          <Target icon={Share2} label="More" loading={busy === "more"} onClick={toSheet} />
        </div>

        {/* Send to a Klimb friend */}
        <div className="mt-6">
          <p className="mb-2 ml-1 text-sm font-semibold text-chalk">
            Send to a Klimb friend
          </p>
          {friends === null ? (
            <div className="flex justify-center py-6">
              <Spinner className="text-accent" />
            </div>
          ) : friends.length === 0 ? (
            <p className="rounded-2xl bg-surface-2 px-4 py-4 text-sm text-muted">
              Add friends on Klimb and you can send your climbs straight to them.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {friends.map((f) => {
                const sent = sentTo.has(f.id);
                return (
                  <button
                    key={f.id}
                    onClick={() => toFriend(f)}
                    disabled={sent || busy === `f-${f.id}`}
                    className="flex items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition hover:bg-surface-2 disabled:opacity-100"
                  >
                    <Avatar f={f} />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-chalk">
                      {f.display_name}
                    </span>
                    {busy === `f-${f.id}` ? (
                      <Spinner className="text-accent" />
                    ) : sent ? (
                      <span className="flex items-center gap-1 text-sm font-semibold text-accent">
                        <Check size={16} /> Sent
                      </span>
                    ) : (
                      <span className="text-sm font-semibold text-muted">Send</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Web fallback: preview the card so the user can save it manually. */}
      {preview ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-6"
          onClick={() => setPreview(null)}
        >
          <div className="flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
            <img src={preview} alt="Climb card" className="max-h-[70vh] rounded-2xl" />
            <p className="text-sm text-chalk/80">Press and hold the image to save or share it.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Target({
  icon: Icon,
  label,
  loading,
  onClick,
}: {
  icon: typeof Share2;
  label: string;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface-2 py-4 text-muted transition hover:text-chalk disabled:opacity-60"
    >
      {loading ? <Spinner className="text-accent" /> : <Icon size={24} className="text-accent" />}
      <span className="text-xs font-semibold">{label}</span>
    </button>
  );
}

function Avatar({ f }: { f: FriendProfile }) {
  if (f.avatar_url) {
    return (
      <img
        src={f.avatar_url}
        alt={f.display_name}
        className="h-9 w-9 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-bold uppercase text-accent">
      {f.display_name.charAt(0)}
    </span>
  );
}
