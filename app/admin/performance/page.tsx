"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dayjs, { type Dayjs } from "dayjs";
import { Breadcrumb, Card, Col, DatePicker, Progress, Row, Segmented, Statistic, Table, Tag, Tooltip, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { GlobalOutlined, UserOutlined } from "@ant-design/icons";
import { message } from "@/components/admin/antd-app";
import { DATE_LOCALES, useAdminT } from "@/lib/admin-i18n";

const { Title, Text } = Typography;

/** One agent's figures from GET /api/admin/performance (agent_id null: website orders). */
interface AgentRow {
    agent_id: string | null;
    agent_email: string | null;
    agent_role: string | null;
    orders: number;
    revenue: number;
    delivered: number;
    delivered_revenue: number;
    paid: number;
    in_progress: number;
    cancelled: number;
    returned: number;
    items: number;
    last_order_at: string | null;
}

type Period = "today" | "7d" | "30d" | "month" | "custom";

function periodRange(period: Period, custom: [Dayjs, Dayjs] | null): [Dayjs, Dayjs] {
    const now = dayjs();
    if (period === "today") return [now.startOf("day"), now.endOf("day")];
    if (period === "7d") return [now.subtract(6, "day").startOf("day"), now.endOf("day")];
    if (period === "month") return [now.startOf("month"), now.endOf("day")];
    if (period === "custom" && custom) return [custom[0].startOf("day"), custom[1].endOf("day")];
    return [now.subtract(29, "day").startOf("day"), now.endOf("day")];
}

/** Delivered out of the orders that are finished (delivered, returned or cancelled). */
const successRate = (row: Pick<AgentRow, "delivered" | "returned" | "cancelled">) => {
    const finished = row.delivered + row.returned + row.cancelled;
    return finished > 0 ? Math.round((row.delivered / finished) * 100) : null;
};

/**
 * Admin → Agent performance (owners and admins): orders each team member added in a period, their
 * value, and how they ended (delivered, returned, cancelled), next to the website's own orders.
 */
export default function AgentPerformancePage() {
    const { t, locale } = useAdminT();
    const [period, setPeriod] = useState<Period>("30d");
    const [custom, setCustom] = useState<[Dayjs, Dayjs] | null>(null);
    const [rows, setRows] = useState<AgentRow[]>([]);
    const [loading, setLoading] = useState(true);

    const [from, to] = useMemo(() => periodRange(period, custom), [period, custom]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch(`/api/admin/performance?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`);
            const result = await response.json();
            if (!result.success) throw new Error(result.error);
            setRows((result.data.rows as AgentRow[]).map((r) => ({ ...r, revenue: Number(r.revenue), delivered_revenue: Number(r.delivered_revenue) })));
        } catch (e) {
            message.error((e as Error).message);
        } finally {
            setLoading(false);
        }
    }, [from, to]);

    useEffect(() => {
        load();
    }, [load]);

    const agents = rows.filter((r) => r.agent_id);
    const totals = agents.reduce(
        (sum, r) => ({
            orders: sum.orders + r.orders,
            revenue: sum.revenue + r.revenue,
            delivered: sum.delivered + r.delivered,
            returned: sum.returned + r.returned,
            cancelled: sum.cancelled + r.cancelled,
        }),
        { orders: 0, revenue: 0, delivered: 0, returned: 0, cancelled: 0 }
    );
    const totalRate = successRate(totals);
    const formatTnd = (value: number) => `${Math.round(value).toLocaleString(DATE_LOCALES[locale])} TND`;

    const columns: ColumnsType<AgentRow> = [
        {
            title: t("Agent"),
            key: "agent",
            render: (_, row) =>
                row.agent_id ? (
                    <div>
                        <div style={{ fontWeight: 500 }}><UserOutlined style={{ marginInlineEnd: 6, color: "#8c8c8c" }} />{row.agent_email ?? t("Former team member")}</div>
                        {row.agent_role && <Tag style={{ marginTop: 4 }}>{t(row.agent_role.charAt(0).toUpperCase() + row.agent_role.slice(1))}</Tag>}
                    </div>
                ) : (
                    <Text type="secondary"><GlobalOutlined style={{ marginInlineEnd: 6 }} />{t("Website (customers)")}</Text>
                ),
        },
        {
            title: t("Orders"),
            dataIndex: "orders",
            key: "orders",
            sorter: (a, b) => a.orders - b.orders,
            defaultSortOrder: "descend",
            render: (value: number, row) => (
                <div>
                    <div style={{ fontWeight: 600 }}>{value}</div>
                    <Text type="secondary" style={{ fontSize: 12 }}>{t("{count} item(s)", { count: row.items })}</Text>
                </div>
            ),
        },
        {
            title: t("Sales value"),
            dataIndex: "revenue",
            key: "revenue",
            sorter: (a, b) => a.revenue - b.revenue,
            render: (value: number, row) => (
                <Tooltip title={t("Delivered: {amount}", { amount: formatTnd(row.delivered_revenue) })}>
                    <span>{formatTnd(value)}</span>
                </Tooltip>
            ),
        },
        {
            title: t("Delivered"),
            dataIndex: "delivered",
            key: "delivered",
            sorter: (a, b) => a.delivered - b.delivered,
            render: (value: number) => <Text style={{ color: "#389e0d", fontWeight: 500 }}>{value}</Text>,
        },
        {
            title: t("Returned"),
            dataIndex: "returned",
            key: "returned",
            sorter: (a, b) => a.returned - b.returned,
            render: (value: number) => <Text style={{ color: value ? "#cf1322" : undefined }}>{value}</Text>,
        },
        {
            title: t("Cancelled"),
            dataIndex: "cancelled",
            key: "cancelled",
            sorter: (a, b) => a.cancelled - b.cancelled,
        },
        {
            title: t("In progress"),
            dataIndex: "in_progress",
            key: "in_progress",
            sorter: (a, b) => a.in_progress - b.in_progress,
        },
        {
            title: <Tooltip title={t("Delivered out of the orders that are finished (delivered, returned or cancelled).")}>{t("Delivery rate")}</Tooltip>,
            key: "rate",
            sorter: (a, b) => (successRate(a) ?? -1) - (successRate(b) ?? -1),
            render: (_, row) => {
                const rate = successRate(row);
                return rate === null ? <Text type="secondary">—</Text> : (
                    <Progress percent={rate} size="small" style={{ minWidth: 110 }} strokeColor={rate >= 80 ? "#389e0d" : rate >= 50 ? "#d48806" : "#cf1322"} />
                );
            },
        },
        {
            title: t("Last order"),
            dataIndex: "last_order_at",
            key: "last_order_at",
            render: (value: string | null) => (value ? new Date(value).toLocaleDateString(DATE_LOCALES[locale], { dateStyle: "medium" }) : "—"),
        },
        {
            title: t("Action"),
            key: "action",
            render: (_, row) => (
                <Link href={`/admin/orders?added_by=${row.agent_id ?? "website"}`}>{t("See orders")}</Link>
            ),
        },
    ];

    return (
        <div>
            <Breadcrumb items={[{ title: <Link href="/admin/dashboard">{t("Dashboard")}</Link> }, { title: t("Agent performance") }]} />
            <div style={{ marginTop: 24, marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div>
                    <Title level={2} style={{ margin: 0, fontWeight: 600 }}>{t("Agent performance")}</Title>
                    <Text type="secondary">{t("Orders each team member added, and how they ended.")}</Text>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <div style={{ overflowX: "auto", maxWidth: "100%" }}>
                        <Segmented<Period>
                            value={period}
                            onChange={setPeriod}
                            options={[
                                { value: "today", label: t("Today") },
                                { value: "7d", label: t("7 days") },
                                { value: "30d", label: t("30 days") },
                                { value: "month", label: t("This month") },
                                { value: "custom", label: t("Custom") },
                            ]}
                        />
                    </div>
                    {period === "custom" && (
                        <DatePicker.RangePicker
                            value={custom}
                            onChange={(value) => setCustom(value && value[0] && value[1] ? [value[0], value[1]] : null)}
                            disabledDate={(d) => d.isAfter(dayjs().endOf("day"))}
                        />
                    )}
                </div>
            </div>

            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col xs={12} md={6}><Card><Statistic title={t("Orders added by agents")} value={totals.orders} loading={loading} /></Card></Col>
                <Col xs={12} md={6}><Card><Statistic title={t("Their sales value")} value={formatTnd(totals.revenue)} loading={loading} /></Card></Col>
                <Col xs={12} md={6}><Card><Statistic title={t("Delivery rate")} value={totalRate === null ? "—" : `${totalRate}%`} loading={loading} /></Card></Col>
                <Col xs={12} md={6}><Card><Statistic title={t("Returned")} value={totals.returned} loading={loading} valueStyle={{ color: totals.returned ? "#cf1322" : undefined }} /></Card></Col>
            </Row>

            <Card>
                <Table
                    rowKey={(row) => row.agent_id ?? "website"}
                    loading={loading}
                    dataSource={rows}
                    columns={columns}
                    pagination={false}
                    scroll={{ x: "max-content" }}
                    locale={{ emptyText: t("No orders in this period.") }}
                />
                <Text type="secondary" style={{ display: "block", marginTop: 12, fontSize: 12 }}>
                    {t("Agent orders are the ones entered in the admin (Delivery → New parcel with products). Validating a website order doesn't make it an agent order.")}
                </Text>
            </Card>
        </div>
    );
}
