"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, DatePicker, Select, Space, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs, { type Dayjs } from "dayjs";
import { message } from "@/components/admin/antd-app";
import { searchByText } from "@/components/admin/select-search";
import { msg, useAdminT } from "@/lib/admin-i18n";

const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;

interface ActivityRow {
    id: number;
    created_at: string;
    actor_id: string | null;
    actor_email: string | null;
    actor_role: string | null;
    source: "admin" | "database";
    action: string;
    entity: string;
    entity_id: string | null;
    label: string | null;
    changes: Record<string, unknown> | null;
}

interface Actor {
    actor_id: string;
    actor_email: string | null;
    entries: number;
}

// Table names (and "team_member") as people call them.
const ENTITY_LABELS: Record<string, string> = {
    products: msg("Product"),
    product_variants: msg("Variant"),
    categories: msg("Category"),
    colors: msg("Color"),
    sizes: msg("Size"),
    product_discounts: msg("Product discount"),
    promotions: msg("Sale banner"),
    reels: msg("Reel"),
    hero_sections: msg("Hero section"),
    small_cards: msg("Hero card"),
    orders: msg("Order"),
    site_settings: msg("Setting"),
    shipping_rates: msg("Shipping rate"),
    country_tax_rates: msg("Tax rate"),
    locations: msg("Location"),
    suppliers: msg("Supplier"),
    collections: msg("Collection"),
    product_costs: msg("Purchase cost"),
    stock_movements: msg("Stock movement"),
    landing_products: msg("Landing page pick"),
    reviews: msg("Review"),
    newsletter_subscribers: msg("Newsletter subscriber"),
    team_member: msg("Team member"),
    access: msg("Access"),
};

const ACTIONS: Record<string, { label: string; color: string }> = {
    create: { label: msg("Created"), color: "green" },
    update: { label: msg("Updated"), color: "blue" },
    delete: { label: msg("Deleted"), color: "red" },
    restore: { label: msg("Restored"), color: "gold" },
    purge: { label: msg("Erased for good"), color: "magenta" },
    remove_access: { label: msg("Access removed"), color: "orange" },
    access_denied: { label: msg("Blocked attempt"), color: "volcano" },
};

// Columns that only add noise when a row is created.
const HIDDEN_ON_CREATE = new Set(["id", "created_at", "updated_at", "deleted_at", "search_text", "search_name"]);

function formatValue(value: unknown): string {
    if (value === null || value === undefined) return "—";
    if (typeof value === "string") return value.length > 120 ? `${value.slice(0, 120)}…` : value;
    const text = JSON.stringify(value);
    return text.length > 120 ? `${text.slice(0, 120)}…` : text;
}

function isChange(value: unknown): value is { from: unknown; to: unknown } {
    return !!value && typeof value === "object" && "from" in value && "to" in value;
}

export default function ActivityPage() {
    const { t } = useAdminT();
    const [rows, setRows] = useState<ActivityRow[]>([]);
    const [actors, setActors] = useState<Actor[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [actor, setActor] = useState<string>();
    const [ready, setReady] = useState(false);
    const [entity, setEntity] = useState<string>();
    const [action, setAction] = useState<string>();
    const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
            if (actor) params.set("actor", actor);
            if (entity) params.set("entity", entity);
            if (action) params.set("action", action);
            if (range?.[0]) params.set("from", range[0].startOf("day").toISOString());
            if (range?.[1]) params.set("to", range[1].endOf("day").toISOString());
            const response = await fetch(`/api/admin/activity?${params}`);
            const result = await response.json();
            if (!result.success) throw new Error(result.error);
            setRows(result.data.rows);
            setTotal(result.data.total);
            setActors(result.data.actors);
        } catch (error) {
            console.error("Error loading activity:", error);
            message.error(t("Failed to load the activity history"));
        } finally {
            setLoading(false);
        }
    }, [page, pageSize, actor, entity, action, range, t]);

    // ?actor= comes from the Team page's "Activity" link. Read on mount (useSearchParams would
    // need a Suspense boundary), before the first load.
    useEffect(() => {
        setActor(new URLSearchParams(window.location.search).get("actor") ?? undefined);
        setReady(true);
    }, []);

    useEffect(() => {
        if (ready) load();
    }, [ready, load]);

    // Any filter change starts again from the first page.
    const filter = <T,>(set: (value: T) => void) => (value: T) => {
        set(value);
        setPage(1);
    };

    const columns: ColumnsType<ActivityRow> = [
        {
            title: t("Date"),
            dataIndex: "created_at",
            width: 170,
            render: (date: string) => dayjs(date).format("DD MMM YYYY HH:mm:ss"),
        },
        {
            title: t("User"),
            key: "actor",
            render: (_, row) =>
                row.source === "database" ? (
                    <Text type="secondary">{t("Database (direct edit)")}</Text>
                ) : (
                    <>
                        {row.actor_email ?? row.actor_id}
                        {row.actor_role && <Tag style={{ marginInlineStart: 8 }}>{t(row.actor_role === "owner" ? "Owner" : row.actor_role === "admin" ? "Admin" : "Staff")}</Tag>}
                    </>
                ),
        },
        {
            title: t("Action"),
            dataIndex: "action",
            width: 140,
            render: (value: string) => {
                const info = ACTIONS[value];
                return <Tag color={info?.color}>{info ? t(info.label) : value}</Tag>;
            },
        },
        {
            title: t("What"),
            dataIndex: "entity",
            render: (value: string) => (ENTITY_LABELS[value] ? t(ENTITY_LABELS[value]) : value),
        },
        {
            title: t("Item"),
            key: "label",
            render: (_, row) => row.label ?? <Text type="secondary">{row.entity_id}</Text>,
        },
    ];

    const renderChanges = (row: ActivityRow) => {
        const entries = Object.entries(row.changes ?? {}).filter(([key, value]) =>
            isChange(value) || !(row.action === "create" && HIDDEN_ON_CREATE.has(key)));
        if (entries.length === 0) return <Text type="secondary">{t("No details")}</Text>;
        return (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                    <tr>
                        <th style={{ textAlign: "start", padding: 4, width: 200 }}>{t("Field")}</th>
                        <th style={{ textAlign: "start", padding: 4 }}>{t("Before")}</th>
                        <th style={{ textAlign: "start", padding: 4 }}>{t("After")}</th>
                    </tr>
                </thead>
                <tbody>
                    {entries.map(([key, value]) => (
                        <tr key={key} style={{ borderTop: "1px solid #f0f0f0" }}>
                            <td style={{ padding: 4 }}><Text code>{key}</Text></td>
                            <td style={{ padding: 4 }}>{isChange(value) ? formatValue(value.from) : "—"}</td>
                            <td style={{ padding: 4 }}>{formatValue(isChange(value) ? value.to : value)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    };

    return (
        <div style={{ padding: 24 }}>
            <Title level={2} style={{ marginTop: 0 }}>{t("Activity")}</Title>
            <Paragraph type="secondary">
                {t("Every change made in the back office, with who made it and what changed. This history can't be edited or deleted.")}
            </Paragraph>

            <Card>
                <Space wrap style={{ marginBottom: 16 }}>
                    <Select
                        showSearch
                        allowClear
                        style={{ minWidth: 260 }}
                        placeholder={t("All users")}
                        value={actor}
                        onChange={filter(setActor)}
                        filterOption={searchByText}
                        options={[
                            ...actors.map((a) => ({
                                value: a.actor_id,
                                label: `${a.actor_email ?? a.actor_id} (${a.entries})`,
                                searchtext: a.actor_email ?? a.actor_id,
                            })),
                            { value: "database", label: t("Database (direct edit)"), searchtext: "database" },
                        ]}
                    />
                    <Select
                        showSearch
                        allowClear
                        style={{ minWidth: 200 }}
                        placeholder={t("Everything")}
                        value={entity}
                        onChange={filter(setEntity)}
                        filterOption={searchByText}
                        options={Object.entries(ENTITY_LABELS).map(([value, label]) => ({ value, label: t(label), searchtext: t(label) }))}
                    />
                    <Select
                        allowClear
                        style={{ minWidth: 160 }}
                        placeholder={t("All actions")}
                        value={action}
                        onChange={filter(setAction)}
                        options={Object.entries(ACTIONS).map(([value, info]) => ({ value, label: t(info.label) }))}
                    />
                    <RangePicker value={range} onChange={filter(setRange)} />
                </Space>

                <Table
                    rowKey="id"
                    size="middle"
                    loading={loading}
                    columns={columns}
                    dataSource={rows}
                    expandable={{ expandedRowRender: renderChanges }}
                    pagination={{
                        current: page,
                        pageSize,
                        total,
                        showSizeChanger: true,
                        pageSizeOptions: [25, 50, 100, 200],
                        onChange: (nextPage, nextSize) => {
                            setPage(nextSize !== pageSize ? 1 : nextPage);
                            setPageSize(nextSize);
                        },
                    }}
                    scroll={{ x: 800 }}
                />
            </Card>
        </div>
    );
}
