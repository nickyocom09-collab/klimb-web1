import { supabase } from "./supabase";

export const TERMS_VERSION = "2026-08-17";
export const PRIVACY_VERSION = "2026-08-17";

const PENDING_LEGAL_ACCEPTANCE_KEY = "klimb.pending-legal-acceptance";

type PendingLegalAcceptance = {
  termsVersion: string;
  privacyVersion: string;
  age13Confirmed: true;
  acceptedAt: string;
};

/**
 * Save the user's affirmative click before an OAuth redirect or verification
 * email. The authenticated RPC turns it into a server-timestamped,
 * append-only record after the session is established.
 */
export function rememberLegalAcceptance() {
  const acceptance: PendingLegalAcceptance = {
    termsVersion: TERMS_VERSION,
    privacyVersion: PRIVACY_VERSION,
    age13Confirmed: true,
    acceptedAt: new Date().toISOString(),
  };
  localStorage.setItem(
    PENDING_LEGAL_ACCEPTANCE_KEY,
    JSON.stringify(acceptance),
  );
  return acceptance;
}

export function clearPendingLegalAcceptance() {
  localStorage.removeItem(PENDING_LEGAL_ACCEPTANCE_KEY);
}

export async function flushPendingLegalAcceptance() {
  const raw = localStorage.getItem(PENDING_LEGAL_ACCEPTANCE_KEY);
  if (!raw) return;

  let acceptance: PendingLegalAcceptance;
  try {
    acceptance = JSON.parse(raw) as PendingLegalAcceptance;
  } catch {
    clearPendingLegalAcceptance();
    return;
  }

  if (
    acceptance.termsVersion !== TERMS_VERSION ||
    acceptance.privacyVersion !== PRIVACY_VERSION ||
    acceptance.age13Confirmed !== true
  ) {
    clearPendingLegalAcceptance();
    return;
  }

  const { error } = await supabase.rpc("accept_current_legal_terms", {
    p_terms_version: TERMS_VERSION,
    p_privacy_version: PRIVACY_VERSION,
    p_age_13_confirmed: true,
  });
  if (!error) clearPendingLegalAcceptance();
}
