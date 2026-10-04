// Delivers a back-office notification as a desktop notification (Web Push) to every
// browser its recipient enabled. Called by the database (private.dispatch_push, via
// pg_net) for each new row in public.notifications, with the shared x-push-secret header.
//
// Secrets: PUSH_WEBHOOK_SECRET, VAPID_KEYS (JSON { publicKey, privateKey } as JWK),
// VAPID_SUBJECT (mailto:…). SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided.

import { createClient } from "npm:@supabase/supabase-js@2";
import * as webpush from "jsr:@negrel/webpush@^0.5.0";

type Lang = "en" | "fr" | "ar";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
});

let appServer: webpush.ApplicationServer | null = null;
async function getAppServer() {
    if (!appServer) {
        const vapidKeys = await webpush.importVapidKeys(JSON.parse(Deno.env.get("VAPID_KEYS")!), { extractable: false });
        appServer = await webpush.ApplicationServer.new({
            contactInformation: Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@kachabity.com",
            vapidKeys,
        });
    }
    return appServer;
}

const pick = (text: Record<string, string> | null, lang: Lang) => text?.[lang] || text?.en || "";

Deno.serve(async (req) => {
    if (req.method !== "POST" || req.headers.get("x-push-secret") !== Deno.env.get("PUSH_WEBHOOK_SECRET")) {
        return new Response("Forbidden", { status: 403 });
    }

    const { notification_id } = await req.json();
    const { data: notification, error } = await supabase
        .from("notifications")
        .select("id, recipient_id, kind, type, severity, title, body, url, created_at")
        .eq("id", notification_id)
        .is("deleted_at", null)
        .maybeSingle();
    if (error || !notification) return new Response("Not found", { status: 404 });

    const { data: subscriptions } = await supabase
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth, locale")
        .eq("user_id", notification.recipient_id)
        .is("deleted_at", null);

    const server = await getAppServer();
    let sent = 0;
    for (const sub of subscriptions ?? []) {
        const lang = (sub.locale as Lang) ?? "en";
        const payload = JSON.stringify({
            id: notification.id,
            title: pick(notification.title, lang),
            body: pick(notification.body, lang),
            url: notification.url ?? "/admin/notifications",
            severity: notification.severity,
            kind: notification.kind,
            lang,
        });
        try {
            await server
                .subscribe({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } })
                .pushTextMessage(payload, {
                    ttl: 24 * 60 * 60,
                    urgency: (notification.severity === "info" ? "normal" : "high") as webpush.Urgency,
                });
            sent += 1;
            await supabase.from("push_subscriptions").update({ last_success_at: new Date().toISOString(), last_error: null }).eq("id", sub.id);
        } catch (e) {
            const gone = e instanceof webpush.PushMessageError && (e.isGone() || e.response.status === 404);
            // An expired or revoked browser subscription is retired (soft delete).
            await supabase
                .from("push_subscriptions")
                .update({ last_error: String(e).slice(0, 500), ...(gone ? { deleted_at: new Date().toISOString() } : {}) })
                .eq("id", sub.id);
        }
    }

    return new Response(JSON.stringify({ sent }), { headers: { "Content-Type": "application/json" } });
});
