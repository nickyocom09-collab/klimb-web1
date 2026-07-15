import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, ChevronLeft, Flag, MapPin, Zap } from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { fetchLogbook, DAY_MS, type LoggedItem } from "../lib/logstats";
import { communityGrade, formatGradeStyled } from "../lib/grades";
import { climbTypeLabel, holdHex } from "../lib/constants";
import { CenterSpinner } from "../components/ui";

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function groupLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Today";
  if (now.getTime() - d.getTime() < 7 * DAY_MS) return "This week";
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

/**
 * The COMPLETE logbook — every climb you've logged, at every gym. The home
 * (Sends) tab is scoped to the gym you're currently at; this is the whole
 * story, with each entry tagged by where you logged it.
 */
export function FullLogbook() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const system = profile?.grade_system ?? "american";
  const [logged, setLogged] = useState<LoggedItem[]>([]);
  const [gymNames, setGymNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    let active = true;
    (async () => {
      const book = await fetchLogbook(profile.id);
      const gymIds = [...new Set(book.logged.map((l) => l.route.gym_id))];
      const { data: gyms } = await supabase
        .from("gyms")
        .select("id, name")
        .in("id", gymIds.length ? gymIds : ["_none_"]);
      if (!active) return;
      setGymNames(new Map((gyms ?? []).map((g) => [g.id, g.name])));
      setLogged(book.logged.filter((l) => l.sendType !== "attempt"));
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [profile]);

  const groups = useMemo(() => {
    const out: { label: string; items: LoggedItem[] }[] = [];
    for (const item of logged) {
      const label = groupLabel(item.date);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(item);
      else out.push({ label, items: [item] });
    }
    return out;
  }, [logged]);

  const gymCount = useMemo(
    () => new Set(logged.map((l) => l.route.gym_id)).size,
    [logged],
  );

  return (
    <div className="mx-auto flex h-full max-w-app flex-col bg-bg">
      <header className="flex items-center gap-2 px-4 py-4">
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="rounded-full p-1 text-muted transition hover:text-chalk"
        >
          <ChevronLeft size={24} />
        </button>
        <div>
          <h1 className="text-xl font-extrabold text-chalk">Full logbook</h1>
          <p className="text-xs text-muted">
            {logged.length} climb{logged.length === 1 ? "" : "s"} ·{" "}
            {gymCount} gym{gymCount === 1 ? "" : "s"}
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-5 pb-8">
        {loading ? (
          <CenterSpinner />
        ) : logged.length === 0 ? (
          <p className="px-8 py-16 text-center text-faint">
            Nothing logged yet. Every climb you log — anywhere — shows up here.
          </p>
        ) : (
          <div className="flex flex-col gap-5">
            {groups.map((g) => (
              <section key={g.label}>
                <h2 className="mb-2 ml-1 text-sm font-semibold uppercase tracking-wide text-faint">
                  {g.label}
                </h2>
                <ul className="flex flex-col gap-2">
                  {g.items.map((item) => {
                    const grade = communityGrade(item.route.gradeValues);
                    const gym = gymNames.get(item.route.gym_id);
                    return (
                      <li key={`${item.route.id}-${item.date}`}>
                        <Link
                          to={`/route/${item.route.id}`}
                          className="flex items-center gap-3 rounded-2xl bg-surface p-3 shadow-card transition active:scale-[0.99]"
                        >
                          <img
                            src={item.route.photo_url}
                            alt=""
                            className="h-14 w-14 shrink-0 rounded-xl object-cover"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-2 font-semibold text-chalk">
                              <span
                                className="h-3 w-3 shrink-0 rounded-full border border-white/10"
                                style={{
                                  backgroundColor: holdHex(item.route.hold_color),
                                }}
                              />
                              <span className="truncate">
                                {item.route.hold_color} · {item.route.wall_section}
                              </span>
                            </p>
                            {gym ? (
                              <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted">
                                <MapPin size={11} className="shrink-0" /> {gym}
                              </p>
                            ) : null}
                            <div className="mt-1 flex items-center gap-2">
                              <span className="flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">
                                {item.sendType === "flash" ? (
                                  <>
                                    <Zap size={11} /> Flash
                                  </>
                                ) : item.sendType === "topped" ? (
                                  <>
                                    <Flag size={11} /> Topped
                                  </>
                                ) : (
                                  <>
                                    <Check size={11} /> Send
                                  </>
                                )}
                              </span>
                              <span className="text-xs text-faint">
                                {fmt(item.date)}
                              </span>
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-lg font-extrabold leading-none text-accent">
                              {formatGradeStyled(
                                grade,
                                item.route.climbing_type,
                                system,
                                item.route.gradingStyle,
                              )}
                            </p>
                            <p className="mt-0.5 text-[10px] text-faint">
                              {climbTypeLabel(item.route.climbing_type)}
                            </p>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
