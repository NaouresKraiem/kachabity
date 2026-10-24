"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import dayjs, { type Dayjs } from "dayjs";
import { Breadcrumb, Card, DatePicker, Segmented, Select, Statistic, Tag, Tooltip, Typography } from "antd";
import { InfoCircleOutlined } from "@ant-design/icons";
import { useAdminT } from "@/lib/admin-i18n";
import { CHANNEL_COLORS, CHANNEL_LABELS, type Channel } from "@/lib/erp/constants";
import { api, periodRange, type Period } from "./erp-client";

const { Title, Text } = Typography;

/** Breadcrumb, title, one-line explanation and actions, like the other admin pages. */
export function PageHeader({ title, subtitle, crumbs = [], extra }: { title: string; subtitle?: ReactNode; crumbs?: { title: string; href?: string }[]; extra?: ReactNode }) {
    const { t } = useAdminT();
    return (
        <>
            <Breadcrumb
                items={[{ title: <Link href="/admin/dashboard">{t("Dashboard")}</Link> }, ...crumbs.map((c) => ({ title: c.href ? <Link href={c.href}>{c.title}</Link> : c.title })), { title }]}
            />
            <div style={{ marginTop: 20, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                    <Title level={2} style={{ margin: 0, fontWeight: 600 }}>{title}</Title>
                    {subtitle && <Text type="secondary">{subtitle}</Text>}
                </div>
                {extra && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>{extra}</div>}
            </div>
        </>
    );
}

/** A figure with an optional explanation (tooltip) and a small line under it. */
export function Kpi({ title, value, hint, sub, color, loading, prefix }: { title: string; value: ReactNode; hint?: string; sub?: ReactNode; color?: string; loading?: boolean; prefix?: ReactNode }) {
    return (
        <Card styles={{ body: { padding: 16 } }} style={{ height: "100%" }}>
            <Statistic
                title={
                    <span>
                        {title}
                        {hint && (
                            <Tooltip title={hint}>
                                <InfoCircleOutlined style={{ marginInlineStart: 6, color: "#8c8c8c" }} />
                            </Tooltip>
                        )}
                    </span>
                }
                value={value as string | number}
                loading={loading}
                prefix={prefix}
                styles={{ content: { color, fontSize: 22 } }}
            />
            {sub && <div style={{ marginTop: 4, fontSize: 12, color: "#8c8c8c" }}>{sub}</div>}
        </Card>
    );
}

export function ChannelTag({ channel }: { channel: string | null | undefined }) {
    const { t } = useAdminT();
    if (!channel) return null;
    const key = channel as Channel;
    return <Tag color={CHANNEL_COLORS[key] ?? "default"}>{t(CHANNEL_LABELS[key] ?? channel)}</Tag>;
}

/** Period selector (today, 7 days, 30 days, this month, last month, this year, custom). */
export function PeriodFilter({ value, onChange }: { value: { period: Period; custom: [Dayjs, Dayjs] | null }; onChange: (v: { period: Period; custom: [Dayjs, Dayjs] | null }) => void }) {
    const { t } = useAdminT();
    return (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", minWidth: 0, maxWidth: "100%" }}>
            <div style={{ overflowX: "auto", maxWidth: "100%", minWidth: 0 }}>
                <Segmented<Period>
                    value={value.period}
                    onChange={(period) => onChange({ ...value, period })}
                    options={[
                        { value: "today", label: t("Today") },
                        { value: "7d", label: t("7 days") },
                        { value: "30d", label: t("30 days") },
                        { value: "month", label: t("This month") },
                        { value: "last_month", label: t("Last month") },
                        { value: "year", label: t("This year") },
                        { value: "custom", label: t("Custom") },
                    ]}
                />
            </div>
            {value.period === "custom" && (
                <DatePicker.RangePicker
                    value={value.custom}
                    onChange={(range) => onChange({ ...value, custom: range && range[0] && range[1] ? [range[0], range[1]] : null })}
                    disabledDate={(d) => d.isAfter(dayjs().endOf("day"))}
                />
            )}
        </div>
    );
}

export function usePeriod(initial: Period = "30d") {
    const [value, setValue] = useState<{ period: Period; custom: [Dayjs, Dayjs] | null }>({ period: initial, custom: null });
    const [from, to] = periodRange(value.period, value.custom);
    return { value, setValue, from, to };
}

export interface StaffMember {
    user_id: string;
    email: string | null;
    role: string;
    permissions: string[];
}

let teamCache: Promise<StaffMember[]> | null = null;

/** Team members for "assign to" pickers (cached for the visit). */
export function useTeam() {
    const [team, setTeam] = useState<StaffMember[]>([]);
    useEffect(() => {
        teamCache ??= api<StaffMember[]>("/api/admin/staff").catch(() => {
            teamCache = null;
            return [];
        });
        let alive = true;
        teamCache.then((rows) => alive && setTeam(rows));
        return () => {
            alive = false;
        };
    }, []);
    return team;
}

/** Select of team members (value: user id; null option "Nobody"). */
export function AgentSelect({ value, onChange, allowNobody = true, placeholder, style, filter }: {
    value?: string | null;
    onChange?: (value: string | null) => void;
    allowNobody?: boolean;
    placeholder?: string;
    style?: React.CSSProperties;
    filter?: (m: StaffMember) => boolean;
}) {
    const { t } = useAdminT();
    const team = useTeam();
    return (
        <Select
            value={value ?? (allowNobody ? "" : undefined)}
            onChange={(v) => onChange?.(v || null)}
            placeholder={placeholder ?? t("Agent")}
            style={{ minWidth: 200, ...style }}
            showSearch
            optionFilterProp="label"
            options={[
                ...(allowNobody ? [{ value: "", label: t("Nobody") }] : []),
                ...team.filter((m) => !filter || filter(m)).map((m) => ({ value: m.user_id, label: m.email ?? m.user_id })),
            ]}
        />
    );
}

export interface CampaignOption {
    id: string;
    name: string;
    platform: string;
}

/** Select of active campaigns. */
export function CampaignSelect({ value, onChange, style }: { value?: string | null; onChange?: (value: string | null) => void; style?: React.CSSProperties }) {
    const { t } = useAdminT();
    const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
    useEffect(() => {
        api<CampaignOption[]>("/api/marketing/campaigns?active=1").then(setCampaigns).catch(() => setCampaigns([]));
    }, []);
    return (
        <Select
            value={value ?? ""}
            onChange={(v) => onChange?.(v || null)}
            style={{ minWidth: 200, ...style }}
            showSearch
            optionFilterProp="label"
            options={[{ value: "", label: t("No campaign") }, ...campaigns.map((c) => ({ value: c.id, label: c.name }))]}
        />
    );
}

/**
 * One row of a short list (avatar, title, description, actions on the end side, extra under them).
 * Replaces antd's deprecated List / List.Item / List.Item.Meta for the small lists in the admin.
 */
export function ListRow({ avatar, title, description, actions, extra, children }: {
    avatar?: ReactNode;
    title?: ReactNode;
    description?: ReactNode;
    actions?: ReactNode[];
    extra?: ReactNode;
    children?: ReactNode;
}) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid #f0f0f0", flexWrap: "wrap" }}>
            {avatar && <div style={{ flexShrink: 0 }}>{avatar}</div>}
            <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                {title && <div style={{ fontWeight: 500, marginBottom: description ? 2 : 0 }}>{title}</div>}
                {description && <div style={{ color: "#8c8c8c", fontSize: 13 }}>{description}</div>}
                {children}
            </div>
            {(actions?.length || extra) && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    {extra}
                    {actions}
                </div>
            )}
        </div>
    );
}

/** Small grey explanation paragraph. */
export function Help({ children }: { children: ReactNode }) {
    return <Text type="secondary" style={{ display: "block", fontSize: 13, marginBottom: 12 }}>{children}</Text>;
}
