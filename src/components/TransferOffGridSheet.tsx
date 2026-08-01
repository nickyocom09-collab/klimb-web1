import { useState } from "react";
import { ArrowRightLeft, X } from "lucide-react";
import { useAuth } from "../lib/auth";
import {
  transferOffGridLogs,
  type PersonalLogRow,
  type TransferResult,
} from "../lib/personalLogs";
import { Button } from "./ui";

/**
 * The one-tap transfer prompt. Offered when a real gym for this climber becomes
 * available (their suggested gym is approved, or they set a home gym) while they
 * still have off-grid climbs. Each climb moves in its own transaction, so a
 * failure only affects that climb; on a full move we retire off-grid mode and
 * adopt the gym as home.
 */
export function TransferOffGridSheet({
  open,
  gym,
  logs,
  onClose,
  onDone,
}: {
  open: boolean;
  gym: { id: string; name: string };
  logs: PersonalLogRow[];
  onClose: () => void;
  /** Called after the sheet closes following a transfer, so the parent can
   *  refresh its logbook (moved climbs drop out of the off-grid list). */
  onDone: () => void;
}) {
  const { updateProfile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TransferResult | null>(null);

  if (!open) return null;
  const n = logs.length;

  async function transfer() {
    setBusy(true);
    const res = await transferOffGridLogs(logs, gym.id);
    // A clean sweep retires off-grid mode: clear the waiting label and make the
    // gym home. A partial move leaves them off-grid so they can retry the rest.
    if (res.failed === 0) {
      await updateProfile({ offgrid_gym_label: null, home_gym_id: gym.id });
    }
    setResult(res);
    setBusy(false);
  }

  function close() {
    const transferred = !!result;
    setResult(null);
    onClose();
    if (transferred) onDone();
  }

  return (
    <div
      className="fixed inset-0 z-30 mx-auto flex max-w-app animate-fade-in items-end bg-black/70 p-4"
      onClick={close}
    >
      <div
        className="w-full animate-fade-up rounded-3xl border border-border bg-surface p-5 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-bold text-chalk">
            {result
              ? result.failed === 0
                ? "Moved in!"
                : "Almost there"
              : "Your gym is on Klimb"}
          </h3>
          <button
            onClick={close}
            aria-label="Close"
            className="rounded-full p-1 text-faint hover:text-chalk"
          >
            <X size={22} />
          </button>
        </div>

        {result ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted">
              {result.failed === 0 ? (
                <>
                  All {result.moved} climb{result.moved === 1 ? "" : "s"} moved
                  into <span className="font-semibold text-chalk">{gym.name}</span>{" "}
                  — with their original dates. They're normal logged climbs now.
                </>
              ) : (
                <>
                  Moved {result.moved} of {n}. {result.failed} couldn't be moved
                  — they're still safe in your off-grid logbook, so you can try
                  those again in a moment.
                </>
              )}
            </p>
            <Button className="w-full" onClick={close}>
              Done
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted">
              <span className="font-semibold text-chalk">{gym.name}</span> is on
              Klimb now. You have{" "}
              <span className="font-semibold text-chalk">{n}</span> climb
              {n === 1 ? "" : "s"} logged off-grid. Move{" "}
              {n === 1 ? "it" : "them"} in? Your original dates stay intact.
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={close}
                disabled={busy}
              >
                Not now
              </Button>
              <Button className="flex-1" loading={busy} onClick={transfer}>
                <ArrowRightLeft size={16} className="mr-2" />
                Transfer {n}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
