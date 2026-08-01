import { createClient } from "npm:@supabase/supabase-js@2";
import { sendApns } from "../_shared/apns.ts";

type PushKind =
  | "friend_request"
  | "friend_accept"
  | "weekly_recap"
  | "streak_risk"
  | "inactivity";

type PushEvent = {
  id: string;
  user_id: string;
  kind: PushKind;
  title: string;
  body: string;
  link: string;
  data: Record<string, unknown>;
  dedupe_key: string;
  attempts: number;
};

type PushToken = {
  token: string;
  user_id: string;
  environment: "development" | "production";
};

type Preferences = {
  user_id: string;
  friend_requests: boolean;
  friend_accepts: boolean;
  weekly_recaps: boolean;
  streak_risk: boolean;
  inactivity: boolean;
};

const service = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

function enabled(
  preferences: Preferences | undefined,
  kind: PushKind,
): boolean {
  if (!preferences) return true;
  const keyByKind: Record<PushKind, keyof Preferences> = {
    friend_request: "friend_requests",
    friend_accept: "friend_accepts",
    weekly_recap: "weekly_recaps",
    streak_risk: "streak_risk",
    inactivity: "inactivity",
  };
  return preferences[keyByKind[kind]] !== false;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed." }, { status: 405 });
  }
  const expectedSecret = Deno.env.get("PUSH_DISPATCH_SECRET");
  const suppliedSecret = request.headers
    .get("Authorization")
    ?.replace(/^Bearer\s+/i, "");
  if (!expectedSecret || suppliedSecret !== expectedSecret) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { data: queued, error: queueError } = await service
      .from("push_events")
      .select("id,user_id,kind,title,body,link,data,dedupe_key,attempts")
      .is("processed_at", null)
      .lte("available_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(100);
    if (queueError) throw queueError;
    const events = (queued ?? []) as PushEvent[];
    if (events.length === 0) return Response.json({ processed: 0, sent: 0 });

    const userIds = [...new Set(events.map((event) => event.user_id))];
    const [
      { data: tokenRows, error: tokenError },
      { data: preferenceRows, error: preferenceError },
    ] = await Promise.all([
      service
        .from("push_tokens")
        .select("token,user_id,environment")
        .in("user_id", userIds)
        .eq("enabled", true),
      service
        .from("notification_preferences")
        .select(
          "user_id,friend_requests,friend_accepts,weekly_recaps,streak_risk,inactivity",
        )
        .in("user_id", userIds),
    ]);
    if (tokenError) throw tokenError;
    if (preferenceError) throw preferenceError;

    const tokensByUser = new Map<string, PushToken[]>();
    for (const token of (tokenRows ?? []) as PushToken[]) {
      const list = tokensByUser.get(token.user_id) ?? [];
      list.push(token);
      tokensByUser.set(token.user_id, list);
    }
    const preferencesByUser = new Map(
      ((preferenceRows ?? []) as Preferences[]).map((row) => [
        row.user_id,
        row,
      ]),
    );

    let sent = 0;
    let processed = 0;
    for (const event of events) {
      const tokens = tokensByUser.get(event.user_id) ?? [];
      if (
        !enabled(preferencesByUser.get(event.user_id), event.kind) ||
        tokens.length === 0
      ) {
        await service
          .from("push_events")
          .update({ processed_at: new Date().toISOString(), last_error: null })
          .eq("id", event.id);
        processed += 1;
        continue;
      }

      const results = await Promise.all(
        tokens.map(async (token) => ({
          token,
          result: await sendApns({
            token: token.token,
            environment: token.environment,
            title: event.title,
            body: event.body,
            kind: event.kind,
            link: event.link,
            data: event.data,
            collapseId: event.dedupe_key,
          }),
        })),
      );
      for (const { token, result } of results) {
        if (result.ok) sent += 1;
        if (result.permanentTokenFailure) {
          await service
            .from("push_tokens")
            .update({ enabled: false, updated_at: new Date().toISOString() })
            .eq("token", token.token);
        }
      }

      const success = results.some(({ result }) => result.ok);
      const errors = results
        .filter(({ result }) => !result.ok)
        .map(({ result }) => result.reason ?? `HTTP ${result.status}`)
        .join(", ");
      const attempts = event.attempts + 1;
      await service
        .from("push_events")
        .update({
          attempts,
          last_error: errors || null,
          processed_at:
            success || attempts >= 5 ? new Date().toISOString() : null,
          available_at:
            success || attempts >= 5
              ? new Date().toISOString()
              : new Date(
                  Date.now() + Math.min(60, attempts * 5) * 60_000,
                ).toISOString(),
        })
        .eq("id", event.id);
      if (success || attempts >= 5) processed += 1;
    }

    return Response.json({ processed, sent, queued: events.length });
  } catch (error) {
    console.error(error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Push dispatch failed.",
      },
      { status: 500 },
    );
  }
});
