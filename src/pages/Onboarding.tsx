import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Camera,
  Check,
  ChevronRight,
  MapPin,
  Mountain,
  Search,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { Button, CenterSpinner, Input } from "../components/ui";
import type { GymRow } from "../lib/database.types";

type Step = "welcome" | "name" | "gym" | "how";

export function Onboarding() {
  const { profile, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("welcome");
  const [name, setName] = useState(profile?.display_name ?? "");
  const [gymId, setGymId] = useState<string | null>(
    profile?.home_gym_id ?? null,
  );
  const [gyms, setGyms] = useState<GymRow[]>([]);
  const [query, setQuery] = useState("");
  const [gymsLoading, setGymsLoading] = useState(true);
  const [finishing, setFinishing] = useState(false);

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return gyms;
    return gyms.filter((g) =>
      [g.name, g.city, g.state, g.brand]
        .filter(Boolean)
        .some((f) => f!.toLowerCase().includes(q)),
    );
  }, [gyms, query]);

  async function finish() {
    setFinishing(true);
    await updateProfile({
      display_name: name.trim() || "Climber",
      home_gym_id: gymId,
      onboarded: true,
    });
    setFinishing(false);
    navigate("/", { replace: true });
  }

  return (
    <div className="mx-auto flex h-full max-w-app flex-col border-x border-border bg-bg">
      {/* Progress dots */}
      <div className="flex justify-center gap-2 px-5 pt-6">
        {(["welcome", "name", "gym", "how"] as Step[]).map((s) => (
          <span
            key={s}
            className={`h-1.5 w-1.5 rounded-full transition ${
              s === step ? "w-6 bg-accent" : "bg-border"
            }`}
          />
        ))}
      </div>

      {step === "welcome" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 px-8 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-accent/10">
            <Mountain size={40} className="text-accent" />
          </div>
          <h1 className="text-3xl font-extrabold text-chalk">
            Welcome to Klimb
          </h1>
          <p className="max-w-xs text-muted">
            See what your gym thinks a route is graded, log your sends, and share
            beta — all in one place.
          </p>
          <Button className="mt-2 w-full" onClick={() => setStep("name")}>
            Get started
          </Button>
        </div>
      ) : null}

      {step === "name" ? (
        <div className="flex flex-1 flex-col px-6 pt-10">
          <h1 className="text-2xl font-extrabold text-chalk">
            What should we call you?
          </h1>
          <p className="mt-1 text-muted">
            This is the name other climbers will see.
          </p>
          <div className="mt-6">
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name or handle"
              maxLength={30}
            />
          </div>
          <div className="mt-auto pb-8">
            <Button
              className="w-full"
              disabled={name.trim().length === 0}
              onClick={() => setStep("gym")}
            >
              Continue
            </Button>
          </div>
        </div>
      ) : null}

      {step === "gym" ? (
        <div className="flex flex-1 flex-col px-6 pt-10">
          <h1 className="text-2xl font-extrabold text-chalk">
            Pick your home gym
          </h1>
          <p className="mt-1 text-muted">
            We'll show you its routes first. You can switch anytime.
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
            ) : (
              <ul className="flex flex-col gap-2">
                {filtered.map((gym) => {
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
                })}
              </ul>
            )}
          </div>

          <div className="py-6">
            <Button
              className="w-full"
              disabled={!gymId}
              onClick={() => setStep("how")}
            >
              Continue
            </Button>
          </div>
        </div>
      ) : null}

      {step === "how" ? (
        <div className="flex flex-1 flex-col px-6 pt-10">
          <h1 className="text-2xl font-extrabold text-chalk">How Klimb works</h1>
          <div className="mt-6 flex flex-col gap-5">
            <HowRow
              Icon={Camera}
              title="Snap a route"
              body="Add a photo of any boulder or rope route at your gym."
            />
            <HowRow
              Icon={TrendingUp}
              title="Grade it together"
              body="Everyone submits a grade — the community average is what you see."
            />
            <HowRow
              Icon={Check}
              title="Log your sends"
              body="Your send history sticks around even after a route is reset."
            />
          </div>
          <div className="mt-auto pb-8">
            <Button
              className="w-full"
              loading={finishing}
              onClick={finish}
            >
              Start climbing
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function HowRow({
  Icon,
  title,
  body,
}: {
  Icon: typeof Camera;
  title: string;
  body: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent">
        <Icon size={20} />
      </span>
      <div>
        <p className="font-semibold text-chalk">{title}</p>
        <p className="mt-0.5 text-sm text-muted">{body}</p>
      </div>
    </div>
  );
}
