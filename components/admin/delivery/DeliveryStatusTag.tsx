"use client";

import { Tag, Tooltip } from "antd";
import { useAdminT } from "@/lib/admin-i18n";
import { statusInfo } from "@/lib/colissimo-data";

/** Colissimo status as a coloured tag; the original Colissimo wording and reason show on hover. */
export default function DeliveryStatusTag({ status, reason }: { status: string; reason?: string | null }) {
    const { t } = useAdminT();
    const info = statusInfo(status);
    const tip = [status !== "sending" ? `Colissimo: ${status}` : null, reason].filter(Boolean).join(" — ");
    return (
        <Tooltip title={tip || undefined}>
            <Tag color={info.color} style={{ marginInlineEnd: 0 }}>{t(info.label)}</Tag>
        </Tooltip>
    );
}
