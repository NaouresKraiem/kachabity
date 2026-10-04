"use client";

/**
 * Desktop notifications (Web Push) for the admin: registers /admin-sw.js, asks the
 * browser's permission and registers the subscription with /api/admin/notifications/push.
 * The notifications themselves are sent by the send-push Edge Function, so they arrive
 * even when no admin tab is open (as long as the browser is running).
 */

export type DesktopState = "unsupported" | "denied" | "off" | "on";

const SW_URL = "/admin-sw.js";
const SW_SCOPE = "/admin/";

export function desktopSupported(): boolean {
    return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function registration(): Promise<ServiceWorkerRegistration> {
    const existing = await navigator.serviceWorker.getRegistration(SW_SCOPE);
    return existing ?? navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE });
}

export async function getDesktopState(): Promise<DesktopState> {
    if (!desktopSupported()) return "unsupported";
    if (Notification.permission === "denied") return "denied";
    const reg = await navigator.serviceWorker.getRegistration(SW_SCOPE);
    const subscription = await reg?.pushManager.getSubscription();
    return subscription && Notification.permission === "granted" ? "on" : "off";
}

function keyBytes(base64Url: string): Uint8Array<ArrayBuffer> {
    const base64 = (base64Url + "=".repeat((4 - (base64Url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(base64);
    const bytes = new Uint8Array(new ArrayBuffer(raw.length));
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return bytes;
}

async function save(subscription: PushSubscription, locale: string) {
    const response = await fetch("/api/admin/notifications/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON(), locale }),
    });
    const result = await response.json();
    if (!result.success) throw new Error(result.error || "Could not save the subscription");
}

/** Asks permission (must run from a click) and registers this browser. */
export async function enableDesktop(locale: string): Promise<DesktopState> {
    if (!desktopSupported()) return "unsupported";
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return permission === "denied" ? "denied" : "off";

    const keyResponse = await fetch("/api/admin/notifications/push");
    const { data } = await keyResponse.json();
    if (!data?.publicKey) throw new Error("Desktop notifications are not configured on the server");

    const reg = await registration();
    await navigator.serviceWorker.ready;
    const subscription =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(data.publicKey) }));
    await save(subscription, locale);
    return "on";
}

export async function disableDesktop(): Promise<DesktopState> {
    const reg = await navigator.serviceWorker.getRegistration(SW_SCOPE);
    const subscription = await reg?.pushManager.getSubscription();
    if (subscription) {
        await fetch("/api/admin/notifications/push", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
    }
    return "off";
}

/** Keeps the server's copy current (language changes, a renewed subscription). */
export async function refreshDesktop(locale: string): Promise<void> {
    if (!desktopSupported() || Notification.permission !== "granted") return;
    const reg = await navigator.serviceWorker.getRegistration(SW_SCOPE);
    const subscription = await reg?.pushManager.getSubscription();
    if (subscription) await save(subscription, locale);
}
