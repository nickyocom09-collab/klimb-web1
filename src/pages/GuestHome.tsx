import { useNavigate } from "react-router-dom";
import { MapPin, Mountain, Users } from "lucide-react";
import { Button } from "../components/ui";

/**
 * First-launch landing for signed-out users. Instead of dropping people on a
 * login form, we welcome them and let them look around — the login prompt only
 * appears when they choose to log a climb (or tap "I have an account").
 */
export function GuestHome() {
  const navigate = useNavigate();

  return (
    <div className="mx-auto flex h-full max-w-app flex-col justify-between bg-bg px-6 pb-10 pt-16">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-accent/10">
          <Mountain size={40} className="text-accent" />
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight text-chalk">Klimb</h1>
        <p className="mt-3 max-w-xs text-base text-muted">
          The community grade for every route at your gym. Log your sends, track
          your projects, and see what the crowd thinks a climb really goes at.
        </p>

        <div className="mt-10 flex w-full max-w-xs flex-col gap-4 text-left">
          <Feature
            icon={Mountain}
            title="Log every climb"
            sub="Sends, flashes, and projects — your whole logbook in one place."
          />
          <Feature
            icon={Users}
            title="Community grades"
            sub="See what real climbers think each route is graded."
          />
          <Feature
            icon={MapPin}
            title="Your home gym"
            sub="Gyms worldwide, with more added every week."
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Button className="w-full" onClick={() => navigate("/signup")}>
          Get started
        </Button>
        <button
          onClick={() => navigate("/login")}
          className="py-1 text-center text-sm font-semibold text-muted transition hover:text-chalk"
        >
          I already have an account
        </button>
      </div>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  sub,
}: {
  icon: typeof Mountain;
  title: string;
  sub: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2">
        <Icon size={18} className="text-accent" />
      </div>
      <div>
        <p className="text-sm font-bold text-chalk">{title}</p>
        <p className="text-xs text-muted">{sub}</p>
      </div>
    </div>
  );
}
