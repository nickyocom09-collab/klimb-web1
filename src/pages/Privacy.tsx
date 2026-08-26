import { ChevronLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

const EFFECTIVE_DATE = "August 17, 2026";
const EMAIL = "realklimb@gmail.com";

/** Public, plain-language privacy notice kept in sync with public/privacy.html. */
export function Privacy() {
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
        <h1 className="text-xl font-extrabold text-chalk">Privacy Policy</h1>
      </header>

      <main className="flex-1 overflow-y-auto px-5 pb-12 pt-5">
        <div className="rounded-3xl border border-accent/20 bg-accent/[0.06] p-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">
            The short version
          </p>
          <p className="mt-2 text-sm leading-relaxed text-chalk/90">
            Klimb uses your data to run your logbook, stats, social features,
            purchases, and notifications. We do not sell personal information,
            run third-party ads, or track you across other companies&apos; apps.
          </p>
        </div>

        <p className="mt-5 text-xs text-faint">Effective {EFFECTIVE_DATE}</p>
        <p className="mt-3 text-sm leading-relaxed text-chalk/90">
          Klimb is a personal climbing logbook operated by Nick Yocom. This
          policy explains what the app collects, why it is used, where it goes,
          how long it is kept, and the choices available to you.
        </p>

        <PolicySection title="Information you provide">
          <li>
            <b>Account and profile:</b> email address, display name, username,
            optional avatar and bio, authentication provider identifier, home
            or visiting gym, and app preferences.
          </li>
          <li>
            <b>Climbing and social content:</b> routes, grades, outcomes,
            attempts, ratings, notes, projects, comments, reactions, friend
            relationships, reports, and photos or videos you choose to upload.
          </li>
          <li>
            <b>Support:</b> information you send when contacting Klimb by email
            or social media.
          </li>
        </PolicySection>

        <PolicySection title="Information used when features run">
          <li>
            <b>Location:</b> when you set or change a gym, start a gym visit, or
            make the first verified log at a gym, Klimb reads your device
            location to check whether you are within 30 miles. The comparison
            happens in memory. Klimb does not store device coordinates or a
            location history and does not use background location.
          </li>
          <li>
            <b>Notifications:</b> with permission, Klimb stores an Apple push
            token, platform, time zone, and notification preferences.
          </li>
          <li>
            <b>Purchases:</b> Apple provides product and transaction
            identifiers, entitlement status, trial or renewal dates, and
            environment so Klimb can verify Pro access. Klimb does not receive
            your payment-card details.
          </li>
          <li>
            <b>Service and security data:</b> authentication tokens are stored
            on your device. Hosting and authentication providers may process
            basic network and diagnostic information, such as IP address,
            request time, and errors, to deliver and secure the service.
          </li>
        </PolicySection>

        <PolicySection title="How Klimb uses information">
          <li>Provide accounts, logbooks, stats, recaps, and gym features.</li>
          <li>Apply your profile, post, friend-list, and notes visibility choices.</li>
          <li>Process friend requests, reactions, sharing, reports, and blocks.</li>
          <li>Verify purchases and deliver notifications you enable.</li>
          <li>Prevent abuse, troubleshoot problems, and provide support.</li>
        </PolicySection>

        <PolicySection title="Legal bases for processing">
          <li>
            Klimb processes account, logbook, social, and purchase-entitlement
            information as needed to provide the service you request and carry
            out these Terms.
          </li>
          <li>
            Device permissions, including notifications and location, are used
            only when you choose or enable the related feature and can be
            withdrawn in iOS Settings.
          </li>
          <li>
            Security, fraud prevention, moderation, support, and service
            improvement rely on Klimb&apos;s legitimate interests in operating a
            safe and reliable service, balanced against user rights.
          </li>
          <li>
            Information may also be processed when necessary to comply with a
            legal obligation or protect a person&apos;s vital interests.
          </li>
        </PolicySection>

        <PolicySection title="Who receives information">
          <li>
            <b>Supabase:</b> database hosting, authentication, storage, and
            server functions.
          </li>
          <li>
            <b>Apple:</b> Sign in with Apple, StoreKit purchases, App Store
            subscription management, and Apple Push Notification service.
          </li>
          <li>
            <b>Google:</b> account authentication only when you choose Continue
            with Google.
          </li>
          <li>
            <b>Apps you choose:</b> when you intentionally share through
            Messages, Instagram, or the iOS share sheet, the selected app
            receives the content you chose to send under its own privacy terms.
          </li>
          <li>
            <b>Other Klimb users:</b> profile and climbing content is shown only
            as described by the app&apos;s visibility controls. Reports are private.
          </li>
          <li>
            <b>Legal and safety:</b> information may be preserved or disclosed
            when reasonably necessary to comply with law, enforce terms, or
            protect people and the service.
          </li>
        </PolicySection>

        <p className="mt-3 rounded-2xl border border-border bg-surface p-4 text-sm leading-relaxed text-muted">
          Service providers are expected to protect personal information
          consistently with this policy and applicable law and may process it
          only to provide their services to Klimb.
        </p>
        <p className="mt-2 px-1 text-xs leading-relaxed text-faint">
          AI note: Klimb does not currently send personal information or user
          content to a third-party generative-AI provider.
        </p>

        <PolicySection title="Public and private content">
          <li>
            Account controls determine whether sends, projects, notes, and your
            friend list appear to other users. Individual climbs can also be
            excluded from your profile.
          </li>
          <li>
            Avatar and route media are delivered using media URLs. A route
            photo can be visible with the shared route even when that climb is
            excluded from your profile. Do not upload confidential images.
          </li>
          <li>
            Videos added to the community video library are visible to signed-in
            Klimb users by default. You can remove your video from the library
            at any time. Blocking is also applied to library visibility.
          </li>
          <li>
            Sharing outside Klimb is always initiated by you. Once sent to
            another app or person, their handling of that copy is outside
            Klimb&apos;s control.
          </li>
        </PolicySection>

        <PolicySection title="Retention and deletion">
          <li>
            Account, logbook, social, notification, and entitlement data is
            generally kept while your account is active or as needed to provide
            the service.
          </li>
          <li>
            Profile → Settings → Delete account permanently removes your
            account, personal logbook, social records, text content, avatars,
            and uploaded route media. Basic de-identified route facts—such as
            gym, hold color, climbing type, and grade—may remain so another
            user&apos;s historical log does not break.
          </li>
          <li>
            Limited records may be retained when required for fraud prevention,
            security, legal compliance, or resolving a dispute. Apple keeps its
            own purchase records under Apple&apos;s policies.
          </li>
          <li>
            Deleting a Klimb account does not cancel an Apple subscription. Use
            Manage Subscription before deletion if you do not want it to renew.
          </li>
        </PolicySection>

        <PolicySection title="Your choices">
          <li>Edit account information and visibility controls in Settings.</li>
          <li>Withdraw location, camera, photo, or notification permission in iOS Settings.</li>
          <li>Block users and report objectionable users or route content.</li>
          <li>
            Request access, correction, or deletion by using in-app controls or
            emailing {EMAIL}. We may need to verify the request.
          </li>
          <li>
            Depending on where you live, you may also request a portable copy,
            restriction of processing, or object to certain processing; withdraw
            consent where consent is the basis; and complain to your local data
            protection authority.
          </li>
        </PolicySection>

        <PolicySection title="International processing">
          <li>
            Klimb is operated in the United States. If you use it elsewhere,
            information may be processed in the United States and in locations
            where the service providers listed above operate.
          </li>
          <li>
            Where applicable law requires it, Klimb relies on legally recognized
            safeguards offered by those providers for international transfers.
          </li>
        </PolicySection>

        <PolicySection title="Tracking and advertising">
          <li>
            Klimb does not sell or share personal information for behavioral
            advertising and does not use third-party advertising trackers.
          </li>
          <li>
            Because Klimb does not track people across unaffiliated services,
            browser “Do Not Track” signals do not change app behavior. Platform
            privacy permissions are respected.
          </li>
        </PolicySection>

        <PolicySection title="Children">
          <li>
            Klimb is a general-audience service for people age 13 and older. It
            is not directed to children under 13, and we do not knowingly
            collect their personal information. Contact us if you believe a
            child under 13 created an account.
          </li>
        </PolicySection>

        <PolicySection title="Security and changes">
          <li>
            Klimb uses encrypted network connections, authentication, and
            database and storage access controls. No system can guarantee
            absolute security.
          </li>
          <li>
            Material policy changes will be identified by a new effective date
            and communicated in the app when appropriate.
          </li>
        </PolicySection>

        <PolicySection title="Contact">
          <li>
            Privacy requests and questions: {" "}
            <a className="font-semibold text-accent underline" href={`mailto:${EMAIL}`}>
              {EMAIL}
            </a>
            .
          </li>
        </PolicySection>

        <div className="mt-8 flex items-center justify-center gap-5 text-xs font-semibold text-muted">
          <Link to="/terms" className="underline">Terms of Use</Link>
          <Link to="/support" className="underline">Support</Link>
        </div>
      </main>
    </div>
  );
}

function PolicySection({
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
