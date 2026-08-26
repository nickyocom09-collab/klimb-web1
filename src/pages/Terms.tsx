import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const EFFECTIVE_DATE = "August 17, 2026";
const EMAIL = "realklimb@gmail.com";

/** Plain-language product terms and community rules. These supplement the
 * Apple Standard EULA linked below; they do not replace Apple's terms. */
export function Terms() {
  const navigate = useNavigate();

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
        <h1 className="text-xl font-extrabold text-chalk">Terms of Use</h1>
      </header>

      <main className="flex-1 overflow-y-auto px-5 pb-12 pt-5">
        <div className="rounded-3xl border border-accent/20 bg-accent/[0.06] p-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">
            Climb hard. Use good judgment.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-chalk/90">
            Klimb is a logbook and social tool—not climbing instruction,
            professional coaching, or a substitute for gym rules and qualified
            supervision.
          </p>
        </div>

        <p className="mt-5 text-xs text-faint">Effective {EFFECTIVE_DATE}</p>
        <p className="mt-3 text-sm leading-relaxed text-chalk/90">
          These terms govern your use of Klimb, operated by Nick Yocom. By
          creating an account or using the service, you agree to these terms and
          the Apple Standard End User License Agreement.
        </p>

        <LegalSection title="Who may use Klimb">
          <li>You must be at least 13 years old.</li>
          <li>
            Keep your login secure and provide accurate account information.
          </li>
          <li>
            You are responsible for activity performed through your account.
          </li>
        </LegalSection>

        <LegalSection title="Climbing safety">
          <li>
            Climbing involves serious risks, including injury or death. Follow
            your gym&apos;s rules, inspect equipment, and use qualified instruction
            and appropriate supervision.
          </li>
          <li>
            Grades, route details, stats, recaps, and content from other users
            can be incomplete or wrong. Do not rely on Klimb for safety-critical
            decisions.
          </li>
          <li>
            You remain responsible for deciding whether and how to climb.
          </li>
        </LegalSection>

        <LegalSection title="Your content">
          <li>
            You keep ownership of photos, notes, names, reactions, and other
            content you submit.
          </li>
          <li>
            You give Klimb a limited, non-exclusive license to host, process,
            display, and share that content only as needed to operate the
            service and honor the visibility choices you make.
          </li>
          <li>
            Only upload content you created or have permission to use. Do not
            post private information about another person without permission.
          </li>
          <li>
            Account deletion removes your account and personal uploads. Basic,
            de-identified route facts may remain so other climbers&apos; logbooks do
            not break.
          </li>
        </LegalSection>

        <LegalSection title="Community rules">
          <li>No harassment, threats, hate, sexual content, or bullying.</li>
          <li>No spam, impersonation, fraud, or misleading activity.</li>
          <li>No unlawful content or infringement of another person&apos;s rights.</li>
          <li>
            Use the in-app report and block controls when something is wrong.
            We may hide or remove content and restrict accounts that violate
            these rules.
          </li>
        </LegalSection>

        <LegalSection title="Copyright complaints">
          <li>
            If you believe content in Klimb infringes your copyright, email
            {" "}{EMAIL} with your contact information, identification of the
            copyrighted work and the material at issue, where the material
            appears, a good-faith statement, and a statement that your report is
            accurate and authorized.
          </li>
          <li>
            Klimb may remove reported material and may restrict or terminate
            accounts that repeatedly infringe other people&apos;s rights.
          </li>
        </LegalSection>

        <LegalSection title="Gym directory information">
          <li>
            Gym names, locations, route details, and availability can be
            incomplete, outdated, or user submitted. Verify important
            information with the gym directly.
          </li>
          <li>
            Listing a gym does not imply that the gym sponsors, endorses, or is
            affiliated with Klimb unless the app expressly says otherwise.
          </li>
        </LegalSection>

        <LegalSection title="Subscriptions and purchases">
          <li>
            Any Klimb Pro price, billing period, trial, and renewal terms are
            shown before purchase. Purchases are processed by Apple.
          </li>
          <li>
            Auto-renewable subscriptions continue until canceled through your
            Apple account. You can use Restore Purchases and Manage Subscription
            in Klimb.
          </li>
          <li>
            Deleting your Klimb account does not automatically cancel billing
            managed by Apple. Cancel the subscription separately if you do not
            want it to renew.
          </li>
        </LegalSection>

        <LegalSection title="Service changes and availability">
          <li>
            We may update, suspend, or discontinue features as Klimb develops.
            We do not promise uninterrupted or error-free availability.
          </li>
          <li>
            We may suspend access when reasonably necessary to protect users,
            the service, or comply with law.
          </li>
        </LegalSection>

        <LegalSection title="Disclaimers and responsibility">
          <li>
            To the extent permitted by law, Klimb is provided “as is” without
            warranties beyond those that cannot legally be excluded.
          </li>
          <li>
            To the extent permitted by law, Klimb and its operator are not
            responsible for indirect, incidental, or consequential losses. Your
            non-waivable consumer rights are not affected.
          </li>
        </LegalSection>

        <LegalSection title="Contact and changes">
          <li>
            We may update these terms as the service changes. Material updates
            will be identified by a new effective date and communicated when
            appropriate.
          </li>
          <li>
            Questions or reports: {" "}
            <a className="font-semibold text-accent underline" href={`mailto:${EMAIL}`}>
              {EMAIL}
            </a>
            .
          </li>
        </LegalSection>

        <div className="mt-8 rounded-2xl border border-border bg-surface p-4 text-sm leading-relaxed text-muted">
          These terms supplement Apple&apos;s{" "}
          <a
            className="font-semibold text-accent underline"
            href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/"
            target="_blank"
            rel="noreferrer"
          >
            Standard End User License Agreement
          </a>
          . If they conflict, Apple&apos;s Standard EULA controls to the extent
          required.
        </div>
      </main>
    </div>
  );
}

function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-7">
      <h2 className="text-sm font-black uppercase tracking-[0.14em] text-accent">
        {title}
      </h2>
      <ul className="mt-2 grid list-disc gap-2 pl-5 text-sm leading-relaxed text-chalk/85 marker:text-faint">
        {children}
      </ul>
    </section>
  );
}
