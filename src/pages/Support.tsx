import { useNavigate } from "react-router-dom";
import { ChevronLeft, Mail } from "lucide-react";

const EMAIL = "realklimb@gmail.com";

/** App Store "Support URL" destination. Public route, no auth required, so
 * Apple's review team and users can reach it directly from the listing. */
export function Support() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto flex h-full max-w-app flex-col bg-bg">
      <header className="sticky top-0 z-10 flex items-center gap-2 bg-bg/95 px-4 py-4 backdrop-blur">
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="rounded-full p-1 text-muted transition hover:text-chalk"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-xl font-extrabold text-chalk">Support</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-5 pb-10">
        <p className="text-sm leading-relaxed text-chalk/90">
          Need help with Klimb, found a bug, or have an idea for a feature?
          Reach out — every message gets read.
        </p>

        <a
          href={`mailto:${EMAIL}?subject=Klimb%20support`}
          className="mt-6 flex items-center justify-center gap-2 rounded-2xl bg-accent py-3 text-sm font-bold text-bg transition active:scale-[0.99]"
        >
          <Mail size={16} /> {EMAIL}
        </a>

        <div className="mt-8 flex flex-col gap-4">
          <div>
            <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-accent">
              Common questions
            </h2>
          </div>

          <div>
            <p className="text-sm font-semibold text-chalk">
              How do I delete my account?
            </p>
            <p className="mt-1 text-sm text-muted">
              Open Settings in the app and tap Delete account at the bottom.
              This permanently removes your profile, sends, projects, grades,
              and notes.
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold text-chalk">
              I forgot my password.
            </p>
            <p className="mt-1 text-sm text-muted">
              On the login screen, tap "Forgot password?" and follow the
              emailed link to set a new one.
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold text-chalk">
              My gym isn't in Klimb yet.
            </p>
            <p className="mt-1 text-sm text-muted">
              You can suggest a gym right from the app — it goes into review
              and gets added once approved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
