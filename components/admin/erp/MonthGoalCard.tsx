"use client";

import Link from "next/link";
import { Card, Col, Row, Tag, Typography } from "antd";
import { AimOutlined } from "@ant-design/icons";
import { useAdminT } from "@/lib/admin-i18n";
import { useAdminRole } from "@/lib/admin-role-context";
import { TargetBar } from "./charts";

const { Text } = Typography;

export interface MonthGoal {
    month?: string;
    goal: {
        target_revenue: number | null;
        target_orders: number | null;
        target_confirmed: number | null;
        target_delivered: number | null;
        target_gross_margin?: number | null;
        notes?: string | null;
    } | null;
    created: number;
    confirmed: number;
    delivered: number;
    delivered_revenue: number;
    gross_margin?: number;
    days_elapsed: number;
    days_in_month: number;
}

/**
 * The business's goal for the current month and where the team stands (Business overview and
 * My day). "On pace" compares each figure with the share of the month gone by.
 */
export default function MonthGoalCard({ goal: data, money }: { goal: MonthGoal; money: (n: number) => string }) {
    const { t } = useAdminT();
    const { isAdmin } = useAdminRole();
    const g = data.goal;
    if (!g) return null;
    const pace = data.days_in_month ? data.days_elapsed / data.days_in_month : 1;
    const items: { label: string; value: number; target: number | null | undefined; format?: (n: number) => string }[] = [
        { label: t("Delivered sales"), value: data.delivered_revenue, target: g.target_revenue, format: money },
        { label: t("Gross margin"), value: data.gross_margin ?? 0, target: g.target_gross_margin, format: money },
        { label: t("Orders taken"), value: data.created, target: g.target_orders },
        { label: t("Orders confirmed"), value: data.confirmed, target: g.target_confirmed },
        { label: t("Orders delivered"), value: data.delivered, target: g.target_delivered },
    ].filter((i) => i.target !== null && i.target !== undefined && (i.label !== t("Gross margin") || data.gross_margin !== undefined));
    const behind = items.filter((i) => i.value < Number(i.target) * pace).length;

    return (
        <Card
            size="small"
            style={{ marginBottom: 16 }}
            title={<span><AimOutlined /> {t("Goal of the month")}</span>}
            extra={
                <span>
                    <Tag color={behind ? "orange" : "green"}>{behind ? t("{count} behind pace", { count: behind }) : t("On pace")}</Tag>
                    <Text type="secondary" style={{ fontSize: 12 }}>{t("Day {day} of {days}", { day: data.days_elapsed, days: data.days_in_month })}</Text>
                    {isAdmin && <Link href="/admin/goals" style={{ marginInlineStart: 8 }}>{t("Objectives & commissions")}</Link>}
                </span>
            }
        >
            <Row gutter={[16, 12]}>
                {items.map((i) => (
                    <Col key={i.label} xs={12} md={8} lg={Math.max(4, Math.floor(24 / items.length))}>
                        <Text type="secondary" style={{ fontSize: 12 }}>{i.label}</Text>
                        <TargetBar value={i.value} target={Number(i.target)} format={i.format} />
                    </Col>
                ))}
            </Row>
            {g.notes && <Text type="secondary" style={{ display: "block", marginTop: 8 }}>{g.notes}</Text>}
        </Card>
    );
}
