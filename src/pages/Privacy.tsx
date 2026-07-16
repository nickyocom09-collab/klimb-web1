import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

const UPDATED = "July 2026";
const EMAIL = "realklimb@gmail.com";

/** Plain-English privacy policy. Public route so it can be linked from the
 * App Store listing as well as from in-app Settings. */
export function Privacy() {
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
        <h1 className="text-xl font-extrabold text-chalk">Privacy Policy</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-5 pb-10">
        <p className="text-xs text-faint">Last updated {UPDATED}</p>

        <p className="mt-4 text-sm leading-relaxed text-chalk/90">
          Klimb is a personal climbing logbook. This policy explains what we
          collect, why, and the control you have over it. We keep it short
          because we keep the data minimal.
        </p>

        <Block title="What we collect">
          <li>
            <b>Account info</b> — your email, display name, and username, so you
            can log in and friends can find you.
          </li>
          <li>
            <b>Your climbing data</b> — the climbs, grades, notes, projects, and
            optional photos you choose to log.
          </li>
          <li>
            <b>Location</b> — when you check in or set a home gym, we read your
            device location <i>once</i> to confirm you're near that gym. It is
            used only for that distance check, in memory, and is never stored or
            put in a link.
          </li>
        </Block>

        <Block title="How we use it">
          <li>To run the app: show your logbook, stats, passport, and map.</li>
          <li>To let friends you add see your public activity.</li>
          <li>Nothing else — we don't sell your data or use it for ads.</li>
        </Block>

        <Block title="Who can see your data">
          <li>
            Your logs are private by default at the account level. Your profile,
            sends, and passport are only visible to others if your privacy
            setting is <b>Public</b> — switch to <b>Private</b> in Settings any
            time.
          </li>
          <li>
            We use Supabase to store data securely. We don't share it with
            advertisers or third-party trackers.
          </li>
        </Block>

        <Block title="Your controls">
          <li>
            <b>Delete your account</b> — Settings → Delete account removes your
            account and associated data. This can't be undone.
          </li>
          <li>Go Private any time to hide your profile from others.</li>
          <li>Location access can be turned off in your device settings.</li>
        </Block>

        <Block title="Children">
          <li>
            Klimb isn't directed at children under 13, and we don't knowingly
            collect their data.
          </li>
        </Block>

        <Block title="Contact">
          <li>
            Questions, or want your data removed? Email us at{" "}
            <a
              href={`mailto:${EMAIL}`}
              className="font-semibold text-accent underline"
            >
              {EMAIL}
            </a>
            .
          </li>
        </Block>

        <p className="mt-6 text-xs text-faint">
          We may update this policy as Klimb grows; we'll change the date above
          when we do.
        </p>
      </div>
    </div>
  );
}

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-accent">
        {title}
      </h2>
      <ul className="flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed text-chalk/90 marker:text-faint">
        {children}
      </ul>
    </section>
  );
}
