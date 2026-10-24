"use client";

import { useState } from "react";
import dayjs, { type Dayjs } from "dayjs";
import Link from "next/link";
import { Alert, Button, Card, Col, DatePicker, Empty, Form, Input, InputNumber, Modal, Popconfirm, Progress, Row, Select, Space, Table, Tag, Typography } from "antd";
import { AimOutlined, EditOutlined, MinusCircleOutlined, PlusOutlined, TrophyOutlined } from "@ant-design/icons";
import { message } from "@/components/admin/antd-app";
import { useAdminT } from "@/lib/admin-i18n";
import { Kpi, PageHeader } from "@/components/admin/erp/ui";
import { BarChart, BarList, TargetBar } from "@/components/admin/erp/charts";
import { api, formatMoney, useApi } from "@/components/admin/erp/erp-client";

const { Text } = Typography;

interface Goal {
    id: string;
    target_orders: number | null;
    target_confirmed: number | null;
    target_delivered: number | null;
    target_revenue: number | null;
    commission_type: "none" | "percent" | "per_order" | "tiers";
    commission_value: number;
    prize_tiers: Tier[];
}

/** Prize (TND) for reaching a number of delivered orders in the month. */
interface Tier {
    orders: number;
    prize: number;
}

interface Progress {
    user_id: string;
    email: string | null;
    role: string;
    goal: Goal | null;
    created: number;
    confirmed: number;
    delivered: number;
    delivered_revenue: number;
    commission: number;
    tier: Tier | null;
    next_tier: Tier | null;
    orders_to_next: number | null;
}

interface BusinessGoal {
    id: string;
    target_revenue: number | null;
    target_orders: number | null;
    target_confirmed: number | null;
    target_delivered: number | null;
    target_gross_margin: number | null;
    max_return_rate: number | null;
    ad_budget: number | null;
    notes: string | null;
}

interface Team {
    goal: BusinessGoal | null;
    created: number;
    confirmed: number;
    delivered: number;
    returned: number;
    delivered_revenue: number;
    gross_margin: number;
    ad_spend: number;
    return_rate: number | null;
    days_in_month: number;
    days_elapsed: number;
}

/**
 * Admin → Objectives & commissions (owners and admins). The month's goal for the whole business
 * (delivered sales, orders, margin, return rate, ad budget) with progress and pace, then each team
 * member's targets, progress and commission. Agents see theirs on My day.
 */
export default function GoalsPage() {
    const { t, locale } = useAdminT();
    const [month, setMonth] = useState<Dayjs>(dayjs().startOf("month"));
    const { data, loading, reload } = useApi<{ month: string; rows: Progress[]; team: Team; daily: { date: string; delivered: number; revenue: number }[]; analytics_start: string | null }>(`/api/admin/goals?month=${month.format("YYYY-MM")}`);
    const [editing, setEditing] = useState<Progress | null>(null);
    const [teamOpen, setTeamOpen] = useState(false);
    const [form] = Form.useForm();
    const [teamForm] = Form.useForm();
    const commissionType = Form.useWatch("commission_type", form);
    const money = (n: number) => formatMoney(n, locale, 0);
    const rows = data?.rows ?? [];
    const team = data?.team;
    const goal = team?.goal ?? null;
    const totalCommission = rows.reduce((s, r) => s + r.commission, 0);
    const sumAgents = (key: "target_orders" | "target_confirmed" | "target_delivered" | "target_revenue") =>
        rows.reduce((s, r) => s + Number(r.goal?.[key] ?? 0), 0);
    // Expected share of the goal by today (only for the current month).
    const pace = team && team.days_in_month ? team.days_elapsed / team.days_in_month : 1;
    const isCurrent = month.isSame(dayjs(), "month");

    const open = (row: Progress) => {
        form.resetFields();
        form.setFieldsValue({ commission_type: "none", commission_value: 0, repeat_months: 0, ...(row.goal ?? {}), prize_tiers: row.goal?.prize_tiers?.length ? row.goal.prize_tiers : [{ orders: undefined, prize: undefined }] });
        setEditing(row);
    };

    const save = async () => {
        const values = await form.validateFields();
        try {
            const prize_tiers = values.commission_type === "tiers" ? (values.prize_tiers ?? []).filter((t: Tier) => t?.orders && t.prize !== undefined && t.prize !== null) : [];
            await api("/api/admin/goals", { method: "POST", body: { ...values, prize_tiers, user_id: editing!.user_id, month: month.format("YYYY-MM") } });
            message.success(t("Objective saved"));
            setEditing(null);
            reload();
        } catch (e) {
            message.error(t((e as Error).message));
        }
    };

    const openTeam = () => {
        teamForm.resetFields();
        if (goal) teamForm.setFieldsValue(goal);
        setTeamOpen(true);
    };

    const saveTeam = async () => {
        const values = await teamForm.validateFields();
        try {
            await api("/api/admin/goals", { method: "PUT", body: { ...values, month: month.format("YYYY-MM") } });
            message.success(t("Goal of the month saved"));
            setTeamOpen(false);
            reload();
        } catch (e) {
            message.error(t((e as Error).message));
        }
    };

    const removeTeam = async () => {
        if (!goal) return;
        await api(`/api/admin/goals?business_id=${goal.id}`, { method: "DELETE" }).catch((e) => message.error(t((e as Error).message)));
        reload();
    };

    /** One goal line: value against target, and whether the month is on pace. */
    const GoalLine = ({ label, value, target, format, lowerIsBetter }: { label: string; value: number; target: number | null | undefined; format?: (n: number) => string; lowerIsBetter?: boolean }) => {
        const fmt = format ?? ((n: number) => String(Math.round(n * 10) / 10));
        if (target === null || target === undefined) return null;
        const pct = target > 0 ? Math.round((value / target) * 100) : 0;
        const onPace = lowerIsBetter ? value <= target : !isCurrent || value >= target * pace;
        return (
            <div style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <Text>{label}</Text>
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>
                        <b>{fmt(value)}</b> / {fmt(target)}{" "}
                        <Tag color={onPace ? "green" : "orange"} style={{ marginInlineStart: 6 }}>{lowerIsBetter ? (onPace ? t("Within limit") : t("Above limit")) : onPace ? (pct >= 100 ? t("Reached") : t("On pace")) : t("Behind")}</Tag>
                    </span>
                </div>
                {!lowerIsBetter && <Progress percent={Math.min(100, pct)} showInfo={false} size="small" strokeColor={pct >= 100 ? "#389e0d" : onPace ? "#2a78d6" : "#d48806"} />}
                {!lowerIsBetter && isCurrent && pct < 100 && team && team.days_elapsed < team.days_in_month && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        {t("{amount} to go: {perDay} a day for the {days} day(s) left", {
                            amount: fmt(target - value),
                            perDay: fmt((target - value) / Math.max(1, team.days_in_month - team.days_elapsed)),
                            days: team.days_in_month - team.days_elapsed,
                        })}
                    </Text>
                )}
            </div>
        );
    };

    return (
        <div>
            <PageHeader
                title={t("Objectives & commissions")}
                subtitle={t("The month's goal for the business, and each team member's targets, progress and commission.")}
                extra={<DatePicker picker="month" value={month} onChange={(m) => m && setMonth(m.startOf("month"))} allowClear={false} />}
            />

            {data?.analytics_start && (
                <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                    title={t("Figures count from {date} (analytics reset).", { date: dayjs(data.analytics_start).format("DD/MM/YYYY") })}
                    action={<Link href="/admin/settings">{t("Change")}</Link>}
                />
            )}

            <Card
                title={<span><AimOutlined /> {t("Goal of the month · {month}", { month: month.format("MM/YYYY") })}</span>}
                loading={loading}
                style={{ marginBottom: 16 }}
                extra={
                    <>
                        <Button type="primary" icon={<EditOutlined />} onClick={openTeam}>{goal ? t("Edit goal") : t("Set the month's goal")}</Button>
                        {goal && <Popconfirm title={t("Remove this month's goal?")} onConfirm={removeTeam}><Button type="text" danger style={{ marginInlineStart: 8 }}>{t("Remove")}</Button></Popconfirm>}
                    </>
                }
            >
                {!goal ? (
                    <Empty description={t("No goal for this month yet. Set targets for delivered sales, orders and margin, then follow the team's progress here.")} />
                ) : team && (
                    <Row gutter={[24, 0]}>
                        <Col xs={24} lg={12}>
                            <GoalLine label={t("Delivered sales")} value={team.delivered_revenue} target={goal.target_revenue} format={money} />
                            <GoalLine label={t("Gross margin")} value={team.gross_margin} target={goal.target_gross_margin} format={money} />
                            <GoalLine label={t("Ad spend")} value={team.ad_spend} target={goal.ad_budget} format={money} lowerIsBetter />
                            <GoalLine label={t("Return rate")} value={team.return_rate ?? 0} target={goal.max_return_rate} format={(n) => `${Math.round(n * 10) / 10}%`} lowerIsBetter />
                        </Col>
                        <Col xs={24} lg={12}>
                            <GoalLine label={t("Orders taken")} value={team.created} target={goal.target_orders} />
                            <GoalLine label={t("Orders confirmed")} value={team.confirmed} target={goal.target_confirmed} />
                            <GoalLine label={t("Orders delivered")} value={team.delivered} target={goal.target_delivered} />
                            {isCurrent && <Text type="secondary" style={{ fontSize: 12 }}>{t("Day {day} of {days}: on pace means at least {percent}% of each target by now.", { day: team.days_elapsed, days: team.days_in_month, percent: Math.round(pace * 100) })}</Text>}
                        </Col>
                        {goal.notes && <Col xs={24}><Alert type="info" showIcon title={goal.notes} /></Col>}
                    </Row>
                )}
            </Card>

            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col xs={12} md={6}><Kpi title={t("Orders taken")} value={team?.created ?? 0} loading={loading} sub={t("{count} by the team", { count: rows.reduce((s, r) => s + r.created, 0) })} /></Col>
                <Col xs={12} md={6}><Kpi title={t("Confirmed")} value={team?.confirmed ?? 0} loading={loading} /></Col>
                <Col xs={12} md={6}><Kpi title={t("Delivered sales")} value={money(team?.delivered_revenue ?? 0)} loading={loading} sub={t("{amount} by the team", { amount: money(rows.reduce((s, r) => s + r.delivered_revenue, 0)) })} /></Col>
                <Col xs={12} md={6}><Kpi title={t("Commissions due")} value={money(totalCommission)} loading={loading} hint={t("Computed on delivered orders only.")} /></Col>
            </Row>

            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col xs={24} lg={14}>
                    <Card title={t("Orders delivered per day")} loading={loading} style={{ height: "100%" }}>
                        <BarChart
                            data={(data?.daily ?? []).map((d) => ({
                                label: d.date.slice(8),
                                value: d.delivered,
                                tooltip: t("{date}: {count} delivered · {amount}", { date: dayjs(d.date).format("DD/MM"), count: d.delivered, amount: money(d.revenue) }),
                            }))}
                            emptyText={t("No delivered orders this month yet.")}
                        />
                    </Card>
                </Col>
                <Col xs={24} lg={10}>
                    <Card title={<span><TrophyOutlined /> {t("Prizes and commissions to pay")}</span>} loading={loading} style={{ height: "100%" }}>
                        {rows.some((r) => r.commission > 0) ? (
                            <BarList
                                format={money}
                                rows={rows.filter((r) => r.commission > 0).sort((a, b) => b.commission - a.commission).map((r) => ({
                                    key: r.user_id,
                                    label: r.email ?? r.user_id,
                                    value: r.commission,
                                    sub: r.tier ? t("Tier {orders} orders reached", { orders: r.tier.orders }) : undefined,
                                }))}
                            />
                        ) : (
                            <Empty description={t("Nothing earned yet this month.")} />
                        )}
                        {rows.some((r) => r.next_tier) && (
                            <div style={{ marginTop: 16 }}>
                                <Text strong>{t("Next prizes")}</Text>
                                {rows.filter((r) => r.next_tier).map((r) => (
                                    <div key={r.user_id} style={{ marginTop: 8 }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                                            <Text>{r.email ?? r.user_id}</Text>
                                            <Text type="secondary">{t("{count} more for {amount}", { count: r.orders_to_next ?? 0, amount: money(r.next_tier!.prize) })}</Text>
                                        </div>
                                        <Progress percent={Math.min(100, Math.round((r.delivered / r.next_tier!.orders) * 100))} size="small" format={() => `${r.delivered}/${r.next_tier!.orders}`} />
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                </Col>
            </Row>

            <Card title={t("Team members")}>
                {goal && (sumAgents("target_revenue") > 0 || sumAgents("target_orders") > 0) && (
                    <Alert
                        type={goal.target_revenue && sumAgents("target_revenue") < Number(goal.target_revenue) ? "warning" : "info"}
                        showIcon
                        style={{ marginBottom: 12 }}
                        title={t("Members' targets add up to {revenue} of delivered sales and {orders} orders (business goal: {goalRevenue}, {goalOrders}). Website orders nobody handles count only in the business goal.", {
                            revenue: money(sumAgents("target_revenue")),
                            orders: sumAgents("target_orders"),
                            goalRevenue: goal.target_revenue ? money(Number(goal.target_revenue)) : "—",
                            goalOrders: goal.target_orders ?? "—",
                        })}
                    />
                )}
                <Table
                    rowKey="user_id"
                    loading={loading}
                    dataSource={rows}
                    scroll={{ x: "max-content" }}
                    pagination={false}
                    columns={[
                        { title: t("Agent"), dataIndex: "email", render: (v: string | null, r) => <span>{v ?? r.user_id} <Tag>{t(r.role.charAt(0).toUpperCase() + r.role.slice(1))}</Tag></span> },
                        { title: t("Taken"), key: "c", render: (_, r) => <TargetBar value={r.created} target={r.goal?.target_orders} /> },
                        { title: t("Confirmed"), key: "cf", render: (_, r) => <TargetBar value={r.confirmed} target={r.goal?.target_confirmed} /> },
                        { title: t("Delivered"), key: "d", render: (_, r) => <TargetBar value={r.delivered} target={r.goal?.target_delivered} /> },
                        { title: t("Delivered sales"), key: "r", render: (_, r) => <TargetBar value={r.delivered_revenue} target={r.goal?.target_revenue} format={money} /> },
                        {
                            title: t("Share of the month"), key: "share", align: "right",
                            render: (_, r) => (team && team.delivered_revenue > 0 ? `${Math.round((r.delivered_revenue / team.delivered_revenue) * 100)}%` : "—"),
                        },
                        {
                            title: t("Commission"), key: "cm", align: "right", render: (_, r) => !r.goal || r.goal.commission_type === "none" ? <Text type="secondary">—</Text> : (
                                <span><b>{formatMoney(r.commission, locale)}</b><div style={{ fontSize: 12, color: "#8c8c8c" }}>{
                                    r.goal.commission_type === "percent" ? t("{value}% of delivered sales", { value: Number(r.goal.commission_value) })
                                    : r.goal.commission_type === "per_order" ? t("{value} TND per delivered order", { value: Number(r.goal.commission_value) })
                                    : r.next_tier ? t("{count} more delivered for {amount}", { count: r.orders_to_next ?? 0, amount: money(r.next_tier.prize) })
                                    : r.tier ? t("Top tier reached") : t("Prizes by delivered orders")
                                }</div></span>
                            ),
                        },
                        { title: "", key: "e", render: (_, r) => <Button size="small" icon={<EditOutlined />} onClick={() => open(r)}>{r.goal ? t("Edit") : t("Set objective")}</Button> },
                    ]}
                />
            </Card>

            <Modal open={teamOpen} title={t("Goal of the month · {month}", { month: month.format("MM/YYYY") })} onCancel={() => setTeamOpen(false)} onOk={saveTeam} okText={t("Save")} cancelText={t("Cancel")} forceRender width={620}>
                <Text type="secondary">{t("Leave a field empty to not follow it.")}</Text>
                <Form form={teamForm} layout="vertical" style={{ marginTop: 12 }}>
                    <Row gutter={12}>
                        <Col span={12}><Form.Item name="target_revenue" label={t("Delivered sales (TND)")}><InputNumber min={0} style={{ width: "100%" }} /></Form.Item></Col>
                        <Col span={12}><Form.Item name="target_gross_margin" label={t("Gross margin (TND)")}><InputNumber min={0} style={{ width: "100%" }} /></Form.Item></Col>
                        <Col span={8}><Form.Item name="target_orders" label={t("Orders taken")}><InputNumber min={0} style={{ width: "100%" }} /></Form.Item></Col>
                        <Col span={8}><Form.Item name="target_confirmed" label={t("Orders confirmed")}><InputNumber min={0} style={{ width: "100%" }} /></Form.Item></Col>
                        <Col span={8}><Form.Item name="target_delivered" label={t("Orders delivered")}><InputNumber min={0} style={{ width: "100%" }} /></Form.Item></Col>
                        <Col span={12}><Form.Item name="max_return_rate" label={t("Highest return rate (%)")}><InputNumber min={0} max={100} style={{ width: "100%" }} /></Form.Item></Col>
                        <Col span={12}><Form.Item name="ad_budget" label={t("Ad budget (TND)")}><InputNumber min={0} style={{ width: "100%" }} /></Form.Item></Col>
                        <Col span={24}><Form.Item name="notes" label={t("Notes for the team")}><Input.TextArea rows={2} maxLength={1000} /></Form.Item></Col>
                    </Row>
                </Form>
            </Modal>

            <Modal open={!!editing} title={t("Objective of {who} for {month}", { who: editing?.email ?? "", month: month.format("MM/YYYY") })} onCancel={() => setEditing(null)} onOk={save} okText={t("Save")} cancelText={t("Cancel")} forceRender>
                <Form form={form} layout="vertical">
                    <Row gutter={12}>
                        <Col span={12}><Form.Item name="target_orders" label={t("Orders taken")}><InputNumber min={0} style={{ width: "100%" }} /></Form.Item></Col>
                        <Col span={12}><Form.Item name="target_confirmed" label={t("Orders confirmed")}><InputNumber min={0} style={{ width: "100%" }} /></Form.Item></Col>
                        <Col span={12}><Form.Item name="target_delivered" label={t("Orders delivered")}><InputNumber min={0} style={{ width: "100%" }} /></Form.Item></Col>
                        <Col span={12}><Form.Item name="target_revenue" label={t("Delivered sales (TND)")}><InputNumber min={0} style={{ width: "100%" }} /></Form.Item></Col>
                        <Col span={12}>
                            <Form.Item name="commission_type" label={t("Commission")}>
                                <Select options={[{ value: "none", label: t("None") }, { value: "percent", label: t("% of delivered sales") }, { value: "per_order", label: t("Amount per delivered order") }, { value: "tiers", label: t("Prizes by number of delivered orders") }]} />
                            </Form.Item>
                        </Col>
                        {commissionType === "percent" || commissionType === "per_order" ? (
                            <Col span={12}><Form.Item name="commission_value" label={commissionType === "percent" ? t("Percent of delivered sales") : t("TND per delivered order")}><InputNumber min={0} precision={3} style={{ width: "100%" }} /></Form.Item></Col>
                        ) : <Col span={12} />}
                        {commissionType === "tiers" && (
                            <Col span={24}>
                                <Text type="secondary">{t("The agent earns the prize of the highest tier reached with orders delivered in the month.")}</Text>
                                <Form.List name="prize_tiers">
                                    {(fields, { add, remove }) => (
                                        <div style={{ marginTop: 8 }}>
                                            {fields.map((field) => (
                                                <Space key={field.key} align="baseline" wrap style={{ display: "flex" }}>
                                                    {/* InputNumber in Space.Compact needs a noStyle Form.Item; errors show on the outer one. */}
                                                    <Form.Item>
                                                        <Space.Compact>
                                                            <Form.Item noStyle name={[field.name, "orders"]} rules={[{ required: true, message: t("Required") }]}>
                                                                <InputNumber min={1} precision={0} placeholder="50" aria-label={t("orders")} />
                                                            </Form.Item>
                                                            <Button disabled>{t("orders")}</Button>
                                                        </Space.Compact>
                                                    </Form.Item>
                                                    <Text>→</Text>
                                                    <Form.Item>
                                                        <Space.Compact>
                                                            <Form.Item noStyle name={[field.name, "prize"]} rules={[{ required: true, message: t("Required") }]}>
                                                                <InputNumber min={0} precision={3} placeholder="100" aria-label="TND" />
                                                            </Form.Item>
                                                            <Button disabled>TND</Button>
                                                        </Space.Compact>
                                                    </Form.Item>
                                                    {fields.length > 1 && <MinusCircleOutlined onClick={() => remove(field.name)} aria-label={t("Remove")} />}
                                                </Space>
                                            ))}
                                            {fields.length < 10 && <Button type="dashed" icon={<PlusOutlined />} onClick={() => add()}>{t("Add a tier")}</Button>}
                                        </div>
                                    )}
                                </Form.List>
                            </Col>
                        )}
                        <Col span={24}><Form.Item name="repeat_months" label={t("Also for the next months")}><InputNumber min={0} max={11} style={{ width: "100%" }} /></Form.Item></Col>
                    </Row>
                </Form>
            </Modal>
        </div>
    );
}
