const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PREVIEW_PNG_BASE64 = "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";

function decodeBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
}

Deno.serve(async (request) => {
  const url = new URL(request.url);
  if (url.pathname.endsWith("/preview.png")) {
    // Supabase bundles TypeScript but not arbitrary sibling assets. Keep the
    // compact mark inline so the Messages preview route cannot fail at runtime.
    return new Response(decodeBase64(PREVIEW_PNG_BASE64), {
      headers: {
        "content-type": "image/png",
        "cache-control": "public, max-age=86400, immutable",
        "x-content-type-options": "nosniff",
      },
    });
  }
  const profileId = url.pathname.split("/").filter(Boolean).pop() ?? "";
  const valid = UUID_PATTERN.test(profileId);
  if (valid) {
    // Supabase's gateway intentionally serves function-generated HTML as
    // sandboxed text. Redirect both old QR codes and already-sent links to the
    // real HTTPS landing page instead of showing raw markup.
    return Response.redirect(
      `https://klimb-privacy.vercel.app/add.html?id=${encodeURIComponent(profileId)}`,
      302,
    );
  }
  let displayName = "A climber";
  let username: string | null = null;

  if (valid) {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (supabaseUrl && anonKey) {
      const profileResponse = await fetch(
        `${supabaseUrl}/rest/v1/profiles?id=eq.${profileId}&select=display_name,username&limit=1`,
        { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } },
      ).catch(() => null);
      if (profileResponse?.ok) {
        const profiles = await profileResponse.json().catch(() => []);
        displayName = profiles[0]?.display_name?.trim() || displayName;
        username = profiles[0]?.username?.trim() || null;
      }
    }
  }

  const safeName = escapeHtml(displayName);
  const safeHandle = username ? `@${escapeHtml(username)}` : "Klimb profile";
  const deepLink = valid ? `klimb://profile/${profileId}` : "";
  const title = valid ? `Add ${safeName} on Klimb` : "Klimb friend invite";
  const description = `${safeName} wants to Klimb with you.`;
  const previewUrl = `${url.origin}/functions/v1/add/preview.png`;

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#07100b"><title>${title}</title><meta name="description" content="${description}"><meta property="og:type" content="website"><meta property="og:site_name" content="Klimb"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:url" content="${url.href}"><meta property="og:image" content="${previewUrl}"><meta property="og:image:width" content="512"><meta property="og:image:height" content="512"><meta property="og:image:type" content="image/png"><meta name="twitter:card" content="summary"><meta name="twitter:title" content="${title}"><meta name="twitter:description" content="${description}"><meta name="twitter:image" content="${previewUrl}"><link rel="icon" href="${previewUrl}" type="image/png"><style>
:root{color-scheme:dark;font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif}*{box-sizing:border-box}body{margin:0;min-height:100svh;display:grid;place-items:center;overflow:hidden;color:#f4f8f5;background:#060a08}body:before{content:"";position:fixed;inset:-20%;background:radial-gradient(circle at 50% 18%,rgba(74,222,128,.22),transparent 31%),radial-gradient(circle at 15% 84%,rgba(255,255,255,.05),transparent 24%);pointer-events:none}.rings{position:fixed;width:520px;height:520px;top:-360px;left:50%;transform:translateX(-50%);border:1px solid rgba(130,240,167,.12);border-radius:50%;box-shadow:0 0 0 58px rgba(130,240,167,.025),0 0 0 116px rgba(130,240,167,.016)}main{position:relative;width:min(100% - 36px,420px);padding:38px 28px 26px;border:1px solid rgba(165,242,190,.14);border-radius:34px;text-align:center;background:linear-gradient(150deg,rgba(23,36,29,.94),rgba(10,16,12,.94));box-shadow:0 30px 90px rgba(0,0,0,.48);backdrop-filter:blur(18px)}.mark{width:72px;height:72px;margin:0 auto 24px;display:grid;place-items:center;border-radius:25px;color:#061009;background:linear-gradient(145deg,#a3f7be,#54e487);box-shadow:0 0 0 9px rgba(130,240,167,.07),0 16px 48px rgba(74,222,128,.2);font:900 36px/1 Georgia,serif}.eyebrow{margin:0 0 12px;color:#72e99a;font-size:11px;font-weight:800;letter-spacing:.22em;text-transform:uppercase}h1{margin:0;font:700 clamp(38px,11vw,52px)/.96 Georgia,"Times New Roman",serif;letter-spacing:-.045em}p{margin:16px auto 0;max-width:300px;color:#a6b6ac;font-size:15px;line-height:1.55}.handle{margin-top:9px;color:#72e99a;font-size:13px;font-weight:750}button{width:100%;margin-top:30px;border:0;border-radius:20px;padding:17px 20px;color:#07100b;background:linear-gradient(135deg,#6bea98,#43d979);box-shadow:0 15px 38px rgba(74,222,128,.18);font:800 17px/1.2 inherit;cursor:pointer}button:active{transform:scale(.985)}button:disabled{opacity:.45}small{display:block;margin-top:13px;color:#617168;font-size:11px}#status{min-height:20px;margin-top:14px;color:#86a08f;font-size:12px}
</style></head><body><div class="rings" aria-hidden="true"></div><main><div class="mark" aria-hidden="true">K</div><p class="eyebrow">Klimb together</p><h1>${valid ? `Add ${safeName}.` : "Invite unavailable."}</h1><p>${valid ? `${safeName} wants to Klimb with you. Open their profile, see your mutual friends, and decide if you want to add them.` : "This invite link is incomplete."}</p><div class="handle">${valid ? safeHandle : ""}</div><button id="open" type="button" ${valid ? "" : "disabled"}>Open in Klimb</button><small>Klimb must be installed on this iPhone.</small><div id="status" role="status"></div></main><script>const button=document.getElementById("open"),status=document.getElementById("status");button.addEventListener("click",()=>{if(button.disabled)return;status.textContent="Opening Klimb…";location.href=${JSON.stringify(deepLink)};setTimeout(()=>{status.textContent="If Klimb did not open, make sure it is installed."},1400)});</script></body></html>`;

  return new Response(html, {
    status: valid ? 200 : 400,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": valid ? "public, max-age=300" : "no-store",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
      "referrer-policy": "no-referrer",
      "permissions-policy": "camera=(), geolocation=(), microphone=()",
      "content-security-policy":
        "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    },
  });
});
