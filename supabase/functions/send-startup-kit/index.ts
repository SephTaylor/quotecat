// Edge function: send-startup-kit
//
// Sends the 90-Day Contractor Startup Kit as a welcome gift to any user who
// confirms their email (email/password signup) or signs up via OAuth (Apple
// or Google — those flows set `email_confirmed_at` immediately at row insert
// time, so the same trigger fires).
//
// Designed to be invoked by a Supabase Database Webhook configured on the
// auth.users table for UPDATE events, with a filter restricting fires to rows
// where `email_confirmed_at` transitioned from NULL to non-NULL.
//
// Auth: this function runs with verify_jwt=false so the database webhook can
// reach it without forging a user JWT. A shared secret (`STARTUP_KIT_WEBHOOK_
// SECRET`) is checked against the `x-webhook-secret` header for basic gating.
// Don't ship without the secret set — the function refuses to fire if the env
// var is missing.
//
// Idempotency: a `welcome_kit_sent_at` timestamp column on profiles guards
// against double-sends. See migration 029_add_welcome_kit_sent_at.sql.
//
// Deploy steps:
// 1. Apply migration 029 to add the welcome_kit_sent_at column to profiles
// 2. Set env vars in Supabase Functions dashboard (Functions → Secrets):
//    - RESEND_API_KEY (already configured for stripe-webhook; same value)
//    - STARTUP_KIT_WEBHOOK_SECRET (new — generate via `openssl rand -hex 32`)
// 3. Deploy: `npx supabase functions deploy send-startup-kit`
// 4. Configure Database Webhook in Supabase dashboard:
//    - Database → Webhooks → Create a new hook
//    - Name: send_startup_kit_on_email_confirm
//    - Table: auth.users
//    - Events: UPDATE
//    - HTTP Request:
//        Method: POST
//        URL: https://<project>.supabase.co/functions/v1/send-startup-kit
//        Headers: x-webhook-secret: <STARTUP_KIT_WEBHOOK_SECRET value>
//        HTTP Params: (leave default; webhook payload is the auth.users row)
// 5. Smoke test: create a new free account with a real email you control,
//    confirm the email arrives within ~30 seconds, click the kit link, verify
//    the attached PDF opens, then sign up again with the same email and
//    confirm no second send.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const WEBHOOK_SHARED_SECRET = Deno.env.get("STARTUP_KIT_WEBHOOK_SECRET");

const KIT_URL = "https://quotecat.ai/downloads/The-90-Day-Contractor-Startup-Kit.pdf";
const KIT_FILENAME = "The-90-Day-Contractor-Startup-Kit.pdf";
const FROM_ADDRESS = "QuoteCat <hello@quotecat.ai>";
const SUBJECT = "Welcome to QuoteCat — here's a thank-you on the house";
const FOUNDER_HOTLINE = "(844) 795-0278";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

function buildEmailHtml(): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #111111; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #111111; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #1a1a1a; border-radius: 16px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 32px; text-align: center;">
              <table cellpadding="0" cellspacing="0" style="margin: 0 auto 16px;">
                <tr>
                  <td><img src="https://quotecat.ai/qc-splash.png" alt="QuoteCat" width="50" height="50" style="display: block;"></td>
                  <td style="color: #ffffff; font-size: 22px; font-weight: 700; padding-left: 8px;">QuoteCat</td>
                </tr>
              </table>
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 800;">Welcome — here's a thank-you</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 20px; color: #ffffff; font-size: 16px; line-height: 1.6;">
                Hey —
              </p>
              <p style="margin: 0 0 20px; color: #ffffff; font-size: 16px; line-height: 1.6;">
                Thanks for trying QuoteCat. The 90-day Contractor Startup Kit is on us, no upgrade required.
              </p>
              <p style="margin: 0 0 24px; color: #d1d5db; font-size: 16px; line-height: 1.6;">
                Licensing, insurance, pricing, first customers — the stuff nobody told us when we started.
              </p>

              <!-- Kit Download Section -->
              <div style="background-color: rgba(249, 115, 22, 0.1); border: 1px solid rgba(249, 115, 22, 0.3); border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
                <p style="margin: 0 0 16px; color: #d1d5db; font-size: 14px; line-height: 1.5;">
                  The kit is attached to this email. Want a fresh copy later? Bookmark this link:
                </p>
                <a href="${KIT_URL}" style="display: inline-block; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: #000000; font-weight: 700; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-size: 14px;">
                  Download the Startup Kit
                </a>
              </div>

              <p style="margin: 24px 0 8px; color: #ffffff; font-size: 16px; line-height: 1.6;">
                — Seph
              </p>

              <p style="margin: 24px 0 0; padding: 16px; background-color: rgba(255, 255, 255, 0.04); border-radius: 8px; color: #9ca3af; font-size: 13px; line-height: 1.6;">
                <strong style="color: #f97316;">P.S.</strong> If you want to talk shop, text the founder line: <a href="sms:+18447950278" style="color: #f97316; text-decoration: none; font-weight: 600;">${FOUNDER_HOTLINE}</a>, Mon-Fri 9-5 ET. Real person, no bots.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; border-top: 1px solid rgba(255, 255, 255, 0.1); text-align: center;">
              <p style="margin: 0; color: #6b7280; font-size: 12px;">
                © 2026 QuoteCat. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

function buildEmailText(): string {
  return [
    "Hey —",
    "",
    "Thanks for trying QuoteCat. The 90-day Contractor Startup Kit is on us, no upgrade required.",
    "",
    "Licensing, insurance, pricing, first customers — the stuff nobody told us when we started.",
    "",
    `It's attached, and here's the link too if you ever want a fresh copy:`,
    KIT_URL,
    "",
    "— Seph",
    "",
    `P.S. If you want to talk shop, text the founder line: ${FOUNDER_HOTLINE}, Mon-Fri 9-5 ET. Real person, no bots.`,
    "",
    "—",
    "© 2026 QuoteCat. All rights reserved.",
  ].join("\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Required env vars — refuse to fire if anything is missing
  if (!RESEND_API_KEY) {
    console.error("send_startup_kit: RESEND_API_KEY not configured");
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!WEBHOOK_SHARED_SECRET) {
    console.error("send_startup_kit: STARTUP_KIT_WEBHOOK_SECRET not configured — refusing to fire");
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Verify shared secret
  const providedSecret = req.headers.get("x-webhook-secret");
  if (providedSecret !== WEBHOOK_SHARED_SECRET) {
    console.warn("send_startup_kit: rejected request — bad or missing x-webhook-secret");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Supabase Database Webhooks send: { type, table, schema, record, old_record }
  // record is the new row, old_record is the previous row (for UPDATE).
  // We also accept manual calls in the form { user_id, email } for ad-hoc resends.
  let userId: string | null = null;
  let email: string | null = null;
  let isConfirmationTransition = true;

  if (body.record && typeof body.record === "object") {
    const record = body.record as Record<string, unknown>;
    const oldRecord = (body.old_record as Record<string, unknown> | undefined) ?? null;
    userId = (record.id as string) ?? null;
    email = (record.email as string) ?? null;
    const newConfirmed = record.email_confirmed_at;
    const oldConfirmed = oldRecord?.email_confirmed_at ?? null;
    // Fire only when this update is the confirmation transition.
    // - newConfirmed must be truthy (email is now confirmed)
    // - oldConfirmed must be NULL/falsy (it wasn't confirmed before)
    isConfirmationTransition = Boolean(newConfirmed) && !oldConfirmed;
  } else {
    userId = (body.user_id as string) ?? null;
    email = (body.email as string) ?? null;
  }

  if (!userId || !email) {
    return new Response(JSON.stringify({ error: "Missing user_id or email" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!isConfirmationTransition) {
    return new Response(JSON.stringify({ skipped: "not_a_confirmation_transition" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Idempotency: don't double-send if already marked
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("welcome_kit_sent_at")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    console.error("send_startup_kit: failed to read profile", { user_id: userId, error: profileError.message });
    // Don't fail — the profile row may not yet exist if handle_new_user
    // hasn't fired. Continue and rely on the idempotency UPDATE at the end.
  }

  if (profile?.welcome_kit_sent_at) {
    console.log("send_startup_kit: already sent", { user_id: userId });
    return new Response(JSON.stringify({ skipped: "already_sent" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Send via Resend with attachment + link
  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: [email],
      subject: SUBJECT,
      html: buildEmailHtml(),
      text: buildEmailText(),
      attachments: [
        {
          filename: KIT_FILENAME,
          path: KIT_URL,
        },
      ],
    }),
  });

  if (!resendResponse.ok) {
    const errorText = await resendResponse.text();
    console.error("send_startup_kit: Resend API error", { user_id: userId, error: errorText });
    return new Response(JSON.stringify({ error: `Resend API error: ${errorText}` }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const resendResult = await resendResponse.json();

  // Mark sent. If the update fails (e.g. profile row doesn't exist yet), log
  // but don't fail — the email went out. The cost of an occasional double-
  // send if a race happens is tolerable; the cost of failing the email is
  // higher.
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ welcome_kit_sent_at: new Date().toISOString() })
    .eq("id", userId);

  if (updateError) {
    console.error("send_startup_kit: failed to mark sent", { user_id: userId, error: updateError.message });
  }

  console.log("send_startup_kit: email sent", {
    email,
    user_id: userId,
    resend_id: resendResult.id,
  });

  return new Response(
    JSON.stringify({ sent: true, resend_id: resendResult.id }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
