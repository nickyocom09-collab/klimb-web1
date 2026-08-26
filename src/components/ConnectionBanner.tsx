import { useEffect, useState } from "react";
import { CloudOff, SignalLow } from "lucide-react";

type ConnectionState = "online" | "weak" | "offline";

type NetworkInformation = {
  effectiveType?: "slow-2g" | "2g" | "3g" | "4g";
  rtt?: number;
  downlink?: number;
  addEventListener?: (type: "change", listener: () => void) => void;
  removeEventListener?: (type: "change", listener: () => void) => void;
};

function connectionInfo(): NetworkInformation | undefined {
  return (navigator as Navigator & { connection?: NetworkInformation }).connection;
}

function browserSignal(): ConnectionState {
  if (!navigator.onLine) return "offline";
  const connection = connectionInfo();
  if (
    connection?.effectiveType === "slow-2g" ||
    connection?.effectiveType === "2g" ||
    (connection?.rtt ?? 0) > 900 ||
    ((connection?.downlink ?? 10) > 0 && (connection?.downlink ?? 10) < 0.5)
  ) {
    return "weak";
  }
  return "online";
}

/** Quiet global connectivity feedback. A Supabase health ping catches weak
 * Wi-Fi where iOS still reports the device as technically online. */
export function ConnectionBanner() {
  const [state, setState] = useState<ConnectionState>(browserSignal);

  useEffect(() => {
    let active = true;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

    const check = async () => {
      const signal = browserSignal();
      if (signal === "offline" || !supabaseUrl) {
        if (active) setState(signal);
        return;
      }
      const started = performance.now();
      try {
        const response = await fetch(`${supabaseUrl}/auth/v1/health`, {
          cache: "no-store",
          headers: supabaseAnonKey ? { apikey: supabaseAnonKey } : undefined,
          signal: AbortSignal.timeout(5000),
        });
        const elapsed = performance.now() - started;
        if (active) setState(!response.ok || elapsed > 2500 ? "weak" : signal);
      } catch {
        if (active) setState(navigator.onLine ? "weak" : "offline");
      }
    };

    const onConnectionChange = () => void check();
    const connection = connectionInfo();
    window.addEventListener("online", onConnectionChange);
    window.addEventListener("offline", onConnectionChange);
    connection?.addEventListener?.("change", onConnectionChange);
    const interval = window.setInterval(check, 30_000);
    void check();

    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("online", onConnectionChange);
      window.removeEventListener("offline", onConnectionChange);
      connection?.removeEventListener?.("change", onConnectionChange);
    };
  }, []);

  if (state === "online") return null;
  const offline = state === "offline";
  const Icon = offline ? CloudOff : SignalLow;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] z-[70] mx-auto flex max-w-app justify-center px-4">
      <div
        role="status"
        className={`flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-bold shadow-2xl backdrop-blur-xl ${
          offline
            ? "border-wide/35 bg-wide/90 text-white"
            : "border-[#d7ad64]/40 bg-[#2b2317]/95 text-[#f2cf8f]"
        }`}
      >
        <Icon size={14} /> {offline ? "Offline — reconnect to save changes" : "Weak connection — Klimb is retrying"}
      </div>
    </div>
  );
}
