import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function ThirdPartyNotices() {
  const navigate = useNavigate();
  const [notices, setNotices] = useState("Loading notices…");

  useEffect(() => {
    let active = true;
    fetch("/third-party-notices.txt")
      .then((response) => {
        if (!response.ok) throw new Error("Notices are unavailable.");
        return response.text();
      })
      .then((text) => {
        if (active) setNotices(text);
      })
      .catch(() => {
        if (active) setNotices("Third-party notices could not be loaded.");
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="mx-auto flex h-full max-w-app flex-col bg-bg">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border/60 bg-bg/95 px-4 py-4 backdrop-blur">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="rounded-full p-1 text-muted transition hover:text-chalk"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-xl font-extrabold text-chalk">Open-source notices</h1>
      </header>
      <main className="flex-1 overflow-y-auto px-5 pb-12 pt-5">
        <p className="mb-4 text-sm leading-relaxed text-muted">
          Klimb is built with open-source software. The following notices and
          license terms belong to their respective authors.
        </p>
        <pre className="whitespace-pre-wrap break-words rounded-2xl border border-border bg-surface p-4 font-mono text-[11px] leading-relaxed text-chalk/80">
          {notices}
        </pre>
      </main>
    </div>
  );
}
