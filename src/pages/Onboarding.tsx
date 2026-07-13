import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Search,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { Button, CenterSpinner, Input } from "../components/ui";
import { US_STATES, STATE_NAME } from "../lib/states";
import type { GymRow } from "../lib/database.types";

type Step = "name" | "gym";

export function Onboarding() {
  const { profile, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("name");
  const [name, setName] = useState(profile?.display_name ?? "");
  // Username is captured up front so friends-by-username works from day one.
  const [uname, setUname] = useState(profile?.username ?? "");
  const [unameTouched, setUnameTouched] = useState(!!profile?.username);
  const [unameErr, setUnameErr] = useState<string | null>(null);
  const [checkingUname, setCheckingUname] = useState(false);
  const [gymId, setGymId] = useState<string | null>(
    profile?.home_gym_id ?? null,
  );
  const [gyms, setGyms] = useState<GymRow[]>([]);
  const [query, setQuery] = useState("");
  const [gymsLoading, setGymsLoading] = useState(true);
  const [finishing, setFinishing] = useState(false);
  // Which state's gyms are open. null = showing the list of all states.
  const [openState, setOpenState] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase
      .from("gyms")
      .select("*")
      .eq("status", "approved")
      .order("name")
      .then(({ data }) => {
        if (!active) return;
        setGyms(data ?? []);
        setGymsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const q = query.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!q) return [];
    return gyms.filter((g) =>
      [g.name, g.city, g.state, g.brand]
        .filter(Boolean)
        .some((f) => f!.toLowerCase().includes(q)),
    );
  }, [gyms, q]);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const g of gyms) {
      const k = g.state?.trim();
      if (k) m[k] = (m[k] ?? 0) + 1;
    }
    return m;
  }, [gyms]);

  const stateGyms = useMemo(
    () => (openState ? gyms.filter((g) => g.state?.trim() === openState) : []),
    [gyms, openState],
  );

  const stepOrder: Step[] = ["name", "gym"];
  function goBack() {
    const i = stepOrder.indexOf(step);
    if (i > 0) setStep(stepOrder[i - 1]);
  }

  function renderGym(gym: GymRow) {
    const selected = gym.id === gymId;
    return (
      <li key={gym.id}>
        <button
          onClick={() => setGymId(gym.id)}
          className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition ${
            selected
              ? "border-accent bg-surface-2"
              : "border-border bg-surface hover:border-faint"
          }`}
        >
          <div>
            <p className="font-semibold text-chalk">{gym.name}</p>
            {gym.city || gym.state ? (
              <p className="mt-0.5 flex items-center gap-1 text-sm text-muted">
                <MapPin size={13} />
                {[gym.city, gym.state].filter(Boolean).join(", ")}
              </p>
            ) : null}
          </div>
          {selected ? (
            <Check size={20} className="text-accent" />
          ) : (
            <ChevronRight size={18} className="text-faint" />
          )}
        </button>
      </li>
    );
  }

  function suggestUsername(display: string): string {
    return display
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 20);
  }

  const normalizedUname = uname.trim().replace(/^@/, "").toLowerCase();

  // Validate + availability-check the username, then move on to gym picking.
  async function submitIdentity() {
    setUnameErr(null);
    if (normalizedUname.length < 3) {
      setUnameErr("Usernames need at least 3 characters.");
      return;
    }
    if (!/^[a-z0-9_]+$/.test(normalizedUname)) {
      setUnameErr("Use letters, numbers, and underscores only.");
      return;
    }
    setCheckingUname(true);
    const { data: taken } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", normalizedUname)
      .neq("id", profile?.id ?? "")
      .maybeSingle();
    setCheckingUname(false);
    if (taken) {
      setUnameErr("That username is taken — try another.");
      return;
    }
    setStep("gym");
  }

  // End onboarding straight in the app.
  async function finish(dest: "/log" | "/") {
    setFinishing(true);
    const { error } = await updateProfile({
      display_name: name.trim() || "Climber",
      username: normalizedUname,
      home_gym_id: gymId,
      onboarded: true,
    });
    setFinishing(false);
    if (error) {
      // Almost certainly a username race — send them back to pick another.
      setUnameErr("That username just got taken — try another.");
      setStep("name");
      return;
    }
    navigate(dest, { replace: true });
  }

  return (
    <div className="mx-auto flex h-full max-w-app flex-col bg-bg">
      {/* Back button + progress dots */}
      <div className="relative flex items-center justify-center px-3 pt-6">
        {stepOrder.indexOf(step) > 0 ? (
          <button
            onClick={goBack}
            aria-label="Back"
            className="absolute left-2 rounded-full p-1 text-muted transition hover:text-chalk"
          >
            <ChevronLeft size={24} />
          </button>
        ) : null}
        <div className="flex gap-2">
          {stepOrder.map((s) => (
            <span
              key={s}
              className={`h-1.5 w-1.5 rounded-full transition ${
                s === step ? "w-6 bg-accent" : "bg-border"
              }`}
            />
          ))}
        </div>
      </div>

      {step === "name" ? (
        <div className="flex flex-1 flex-col px-6 pt-10">
          <h1 className="text-2xl font-extrabold text-chalk">
            What should we call you?
          </h1>
          <p className="mt-1 text-muted">
            This is the name other climbers will see.
          </p>
          <div className="mt-6 flex flex-col gap-4">
            <Input
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                // Keep the username suggestion in sync until they edit it.
                if (!unameTouched) setUname(suggestUsername(e.target.value));
              }}
              placeholder="Your name or handle"
              maxLength={30}
            />
            <div>
              <Input
                label="Username"
                value={uname}
                onChange={(e) => {
                  setUname(e.target.value);
                  setUnameTouched(true);
                  setUnameErr(null);
                }}
                placeholder="username"
                autoCapitalize="none"
                autoCorrect="off"
                maxLength={20}
              />
              <p className="ml-1 mt-2 text-xs text-faint">
                Friends find you by @username — you can change it later in
                Settings.
              </p>
              {unameErr ? (
                <p className="ml-1 mt-1 text-xs text-wide">{unameErr}</p>
              ) : null}
            </div>
          </div>
          <div className="mt-auto pb-8">
            <Button
              className="w-full"
              disabled={name.trim().length === 0 || normalizedUname.length === 0}
              loading={checkingUname}
              onClick={submitIdentity}
            >
              Continue
            </Button>
          </div>
        </div>
      ) : null}

      {step === "gym" ? (
        <div className="flex flex-1 flex-col px-6 pt-10">
          {openState ? (
            <button
              onClick={() => setOpenState(null)}
              className="-ml-1 mb-2 flex w-fit items-center gap-1 rounded-full py-1 pr-2 text-sm font-semibold text-muted transition hover:text-chalk"
            >
              <ChevronLeft size={18} /> All states
            </button>
          ) : null}
          <h1 className="text-2xl font-extrabold text-chalk">
            {openState
              ? STATE_NAME[openState] ?? openState
              : "Pick your home gym"}
          </h1>
          <p className="mt-1 text-muted">
            {openState
              ? "Choose your gym. You can switch anytime."
              : "Pick your state, then your home gym."}
          </p>
          <div className="relative mt-5">
            <Search
              size={18}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-faint"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search gym, city, or brand"
              className="h-12 w-full rounded-2xl border border-border bg-surface-2 pl-11 pr-4 text-chalk placeholder:text-faint outline-none focus:border-accent"
            />
          </div>

          <div className="-mx-6 mt-3 flex-1 overflow-y-auto px-6">
            {gymsLoading ? (
              <CenterSpinner />
            ) : q ? (
              searchResults.length === 0 ? (
                <p className="mt-8 text-center text-faint">No gyms found.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {searchResults.map(renderGym)}
                </ul>
              )
            ) : openState ? (
              stateGyms.length === 0 ? (
                <p className="mt-8 text-center text-faint">
                  No gyms here yet.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {stateGyms.map(renderGym)}
                </ul>
              )
            ) : (
              <ul className="flex flex-col gap-2">
                {US_STATES.map((s) => {
                  const n = counts[s.code] ?? 0;
                  return (
                    <li key={s.code}>
                      <button
                        onClick={() => setOpenState(s.code)}
                        className="flex w-full items-center justify-between rounded-2xl border border-border bg-surface p-4 text-left transition hover:border-faint"
                      >
                        <span className="font-semibold text-chalk">
                          {s.name}
                        </span>
                        <span className="flex items-center gap-2">
                          <span
                            className={`text-xs font-semibold ${
                              n > 0 ? "text-accent" : "text-faint"
                            }`}
                          >
                            {n > 0 ? `${n} ${n === 1 ? "gym" : "gyms"}` : "—"}
                          </span>
                          <ChevronRight size={18} className="text-faint" />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="flex flex-col gap-2 py-6">
            <Button
              className="w-full"
              disabled={!gymId}
              loading={finishing}
              onClick={() => finish("/log")}
            >
              Log my first climb
            </Button>
            <Button
              variant="secondary"
              className="w-full"
              disabled={!gymId || finishing}
              onClick={() => finish("/")}
            >
              Browse my gym first
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
