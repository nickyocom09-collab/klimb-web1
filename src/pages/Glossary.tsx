import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, ChevronDown, ChevronLeft, Search } from "lucide-react";
import { GLOSSARY, GLOSSARY_CATEGORIES } from "../lib/glossary";

// The climber's dictionary: ~100 terms, searchable, tap to reveal the
// definition. Lives under Settings so new climbers can decode gym-speak.
export function Glossary() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      q
        ? GLOSSARY.filter(
            (t) =>
              t.term.toLowerCase().includes(q) ||
              t.def.toLowerCase().includes(q),
          )
        : GLOSSARY,
    [q],
  );

  function toggle(term: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(term)) next.delete(term);
      else next.add(term);
      return next;
    });
  }

  return (
    <div className="mx-auto flex h-full max-w-app flex-col border-x border-border bg-bg">
      <header className="flex items-center gap-2 border-b border-border px-3 py-4">
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="rounded-full p-1 text-muted hover:text-chalk"
        >
          <ChevronLeft size={24} />
        </button>
        <div>
          <h1 className="flex items-center gap-2 text-xl font-extrabold text-chalk">
            <BookOpen size={20} className="text-accent" /> Climber's dictionary
          </h1>
          <p className="text-xs text-muted">
            {GLOSSARY.length} terms of gym-speak, decoded
          </p>
        </div>
      </header>

      <div className="px-5 py-3">
        <div className="relative">
          <Search
            size={18}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-faint"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a term (crimp, beta, dyno…)"
            className="h-12 w-full rounded-2xl border border-border bg-surface-2 pl-11 pr-4 text-chalk placeholder:text-faint outline-none focus:border-accent"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-8">
        {filtered.length === 0 ? (
          <p className="py-16 text-center text-faint">
            No terms match "{query}".
          </p>
        ) : (
          GLOSSARY_CATEGORIES.map((cat) => {
            const terms = filtered.filter((t) => t.category === cat);
            if (terms.length === 0) return null;
            return (
              <section key={cat} className="mb-5">
                <h2 className="mb-2 ml-1 text-sm font-semibold uppercase tracking-wide text-faint">
                  {cat}
                </h2>
                <ul className="flex flex-col gap-1.5">
                  {terms.map((t) => {
                    const isOpen = open.has(t.term) || q.length > 0;
                    return (
                      <li key={t.term}>
                        <button
                          onClick={() => toggle(t.term)}
                          className="w-full rounded-2xl bg-surface px-4 py-3 text-left shadow-card transition active:scale-[0.995]"
                        >
                          <span className="flex items-center justify-between">
                            <span className="font-semibold text-chalk">
                              {t.term}
                            </span>
                            <ChevronDown
                              size={16}
                              className={`text-faint transition-transform ${
                                isOpen ? "rotate-180" : ""
                              }`}
                            />
                          </span>
                          {isOpen ? (
                            <span className="mt-1.5 block animate-fade-in text-sm leading-relaxed text-muted">
                              {t.def}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
