type InviteIdentity = {
  id: string;
  display_name: string;
  username: string | null;
};

const INVITE_ORIGIN = "https://klimb-privacy.vercel.app/add.html";

/** A normal HTTPS link stays tappable inside Messages on the same phone. The
 * landing page hands off to Klimb's native profile deeplink. */
export function friendInviteUrl(profileId: string): string {
  return `${INVITE_ORIGIN}?id=${encodeURIComponent(profileId)}`;
}

export function friendInviteText(person: InviteIdentity): string {
  // Keep the link inline. iMessage turns a bare URL on its own line into a
  // large rich attachment; inline it so the composer stays clean and tappable.
  return `Add me on Klimb! 🧗 ${friendInviteUrl(person.id)}`;
}
