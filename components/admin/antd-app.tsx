"use client";

import { useEffect } from "react";
import { App } from "antd";
import type { MessageInstance } from "antd/es/message/interface";

/**
 * antd's static `message.*` can't read the theme from ConfigProvider (and warns about it).
 * The admin layout renders <App><AntdAppBridge /></App>; the bridge captures the
 * context-aware instance, and admin code imports `message` from here instead of "antd".
 *
 * The instance lives on globalThis so it survives this module being re-evaluated (Fast
 * Refresh in dev). Calls made before the bridge has mounted are queued, never sent to the
 * static API.
 */
type MessageMethod = "success" | "error" | "warning" | "info" | "loading";
type Pending = { method: MessageMethod; args: Parameters<MessageInstance[MessageMethod]> };

const store = globalThis as typeof globalThis & {
    __adminMessage?: MessageInstance;
    __adminMessageQueue?: Pending[];
};

export function AntdAppBridge() {
    const instance = App.useApp().message;
    store.__adminMessage = instance;
    useEffect(() => {
        store.__adminMessage = instance;
        const queued = store.__adminMessageQueue ?? [];
        store.__adminMessageQueue = [];
        for (const { method, args } of queued) (instance[method] as (...a: typeof args) => unknown)(...args);
    }, [instance]);
    return null;
}

function call<M extends MessageMethod>(method: M) {
    return (...args: Parameters<MessageInstance[M]>) => {
        const instance = store.__adminMessage;
        if (instance) return (instance[method] as (...a: typeof args) => unknown)(...args);
        (store.__adminMessageQueue ??= []).push({ method, args } as Pending);
    };
}

export const message = {
    success: call("success"),
    error: call("error"),
    warning: call("warning"),
    info: call("info"),
    loading: call("loading"),
};
