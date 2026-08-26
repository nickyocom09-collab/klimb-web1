import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { ArrowLeft, Mail, RefreshCw } from "lucide-react";
import { supabase } from "../lib/supabase";
import { emailConfirmationRedirectUrl } from "../lib/deeplink";
import { Button, ErrorText } from "./ui";

const RESEND_SECONDS = 45;

export function EmailVerificationPending({
  email,
  onChangeEmail,
}: {
  email: string;
  onChangeEmail: () => void;
}) {
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = window.setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [seconds]);

  function openMail() {
    window.location.href = Capacitor.isNativePlatform() ? "message://" : "mailto:";
  }

  async function resend() {
    if (seconds > 0 || resending) return;
    setResending(true);
    setError(null);
    setMessage(null);
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: emailConfirmationRedirectUrl() },
    });
    setResending(false);
    if (resendError) {
      setError(resendError.message);
      return;
    }
    setMessage("A fresh verification email is on its way.");
    setSeconds(RESEND_SECONDS);
  }

  return (
    <div className="relative mx-auto flex min-h-full max-w-app flex-col overflow-hidden bg-[#07100b] px-6 pb-8 pt-10 text-[#f4f8f5]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            "radial-gradient(ellipse at 8% 8%, transparent 0 86px, rgba(95,240,146,.08) 87px 88px, transparent 89px 118px, rgba(95,240,146,.045) 119px 120px, transparent 121px), radial-gradient(ellipse at 94% 74%, transparent 0 104px, rgba(95,240,146,.07) 105px 106px, transparent 107px 150px, rgba(95,240,146,.04) 151px 152px, transparent 153px), radial-gradient(circle at 50% -8%, rgba(57,255,136,.17), transparent 38%)",
        }}
      />

      <button
        type="button"
        onClick={onChangeEmail}
        className="relative z-10 -ml-2 flex h-10 w-10 items-center justify-center rounded-full text-white/60 transition hover:bg-white/5 hover:text-white"
        aria-label="Back to signup"
      >
        <ArrowLeft size={22} />
      </button>

      <main className="relative z-10 flex flex-1 flex-col justify-center pb-8">
        <div className="animate-fade-up">
          <p className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.24em] text-[#70e99a]">
            One last move
          </p>
          <h1 className="max-w-[350px] font-[Georgia] text-[44px] font-bold leading-[0.98] tracking-[-0.045em] text-white">
            Check your inbox.
          </h1>
          <p className="mt-5 max-w-[380px] text-[16px] leading-7 text-[#a9b7ae]">
            We sent a verification link to:
          </p>
          <p className="mt-2 max-w-full overflow-hidden text-ellipsis whitespace-nowrap rounded-xl bg-white/[0.055] px-3 py-2 text-sm font-semibold text-[#f4f8f5]">
            {email}
          </p>
          <p className="mt-3 max-w-[380px] text-[16px] leading-7 text-[#a9b7ae]">
            Tap it to finish creating your Klimb account.
          </p>
        </div>

        <div className="mt-9 animate-fade-up rounded-[28px] border border-white/[0.08] bg-white/[0.045] p-5 shadow-[0_24px_70px_rgba(0,0,0,.25)] backdrop-blur-xl [animation-delay:90ms]">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#39ff88]/10 text-[#61e991]">
              <Mail size={21} />
            </span>
            <div>
              <p className="font-bold text-white">Open the email on this phone</p>
              <p className="mt-1 text-sm leading-5 text-[#84948a]">
                The button brings you straight back to Klimb. Check spam if it
                doesn&apos;t arrive in a minute.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex animate-fade-up flex-col gap-3 [animation-delay:150ms]">
          <Button onClick={openMail} className="w-full shadow-glow">
            <Mail size={18} className="mr-2" /> Open Mail
          </Button>
          <button
            type="button"
            onClick={() => void resend()}
            disabled={seconds > 0 || resending}
            className="flex h-12 items-center justify-center rounded-2xl border border-white/[0.09] bg-white/[0.04] px-5 text-sm font-semibold text-[#c3cec6] transition active:scale-[0.98] disabled:opacity-50"
          >
            <RefreshCw size={16} className={`mr-2 ${resending ? "animate-spin" : ""}`} />
            {resending
              ? "Sending…"
              : seconds > 0
                ? `Resend in ${seconds}s`
                : "Resend verification email"}
          </button>
          <ErrorText>{error}</ErrorText>
          {message ? (
            <p className="text-center text-sm font-medium text-[#70e99a]">{message}</p>
          ) : null}
        </div>
      </main>

      <button
        type="button"
        onClick={onChangeEmail}
        className="relative z-10 text-center text-sm text-[#76877d] underline decoration-white/15 underline-offset-4"
      >
        Wrong email? Go back and change it
      </button>
    </div>
  );
}
