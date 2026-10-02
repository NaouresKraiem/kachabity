"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, Col, Row, Statistic, Tag, Typography, Skeleton } from "antd";
import dayjs from "dayjs";
import { MOVEMENT_LABELS, type MovementType } from "@/lib/stock";
import MovementChart, { type DailyStat } from "./MovementChart";
import { apiJson, MOVEMENT_COLORS } from "./stock-client";
import { useAdminT } from "@/lib/admin-i18n";

const { Text } = Typography;

interface Overview {
    units: number;
    low_stock: number;
    out_of_stock: number;
    untracked_products: number;
    stock_value: number | null;
    daily: DailyStat[];
    recent: { id: string; type: MovementType; quantity: number; product_name: string; sku: string; created_at: string; locations: { name: string } | null }[];
}

/** Stock section of the admin dashboard. */
export default function StockOverview() {
    const { t } = useAdminT();
    const [data, setData] = useState<Overview | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        apiJson<Overview>("/api/stock/overview").then(setData).catch((e) => setError(e.message));
    }, []);

    if (error) return <Card style={{ marginBottom: 24 }}><Text type="danger">{t("Stock overview unavailable: {error}", { error })}</Text></Card>;
    if (!data) return <Card style={{ marginBottom: 24 }}><Skeleton active /></Card>;

    const span = data.stock_value !== null ? 5 : 6;

    return (
        <div style={{ marginBottom: 24 }}>
            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col xs={12} lg={span}><Card><Statistic title={t("Units in stock")} value={data.units} /></Card></Col>
                <Col xs={12} lg={span}>
                    <Link href="/admin/stock/restock"><Card hoverable><Statistic title={t("Low stock variants")} value={data.low_stock} styles={{ content: { color: data.low_stock ? "#d48806" : undefined } }} /></Card></Link>
                </Col>
                <Col xs={12} lg={span}>
                    <Link href="/admin/stock/restock"><Card hoverable><Statistic title={t("Out of stock variants")} value={data.out_of_stock} styles={{ content: { color: data.out_of_stock ? "#cf1322" : undefined } }} /></Card></Link>
                </Col>
                <Col xs={12} lg={span}>
                    <Link href="/admin/stock"><Card hoverable><Statistic title={t("Products not counted yet")} value={data.untracked_products} /></Card></Link>
                </Col>
                {data.stock_value !== null && (
                    <Col xs={24} lg={4}><Card><Statistic title={t("Stock value at cost")} value={data.stock_value} precision={0} suffix="TND" /></Card></Col>
                )}
            </Row>
            <Row gutter={[16, 16]}>
                <Col xs={24} lg={16}>
                    <Card title={t("Stock movement, last 30 days")}>
                        <MovementChart data={data.daily} />
                    </Card>
                </Col>
                <Col xs={24} lg={8}>
                    <Card title={t("Latest movements")} extra={<Link href="/admin/stock/movements">{t("View all")}</Link>} styles={{ body: { paddingTop: 8 } }}>
                        {data.recent.length === 0 ? (
                            <Text type="secondary">{t("No movements yet. Record a count or a delivery from Inventory.")}</Text>
                        ) : (
                            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                                {data.recent.map((m, i) => (
                                    <li
                                        key={m.id}
                                        style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: i ? "1px solid #f0f0f0" : undefined }}
                                    >
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.product_name}</div>
                                            <div style={{ fontSize: 12, color: "#8c8c8c" }}>
                                                <Tag color={MOVEMENT_COLORS[m.type]} style={{ fontSize: 11 }}>{t(MOVEMENT_LABELS[m.type])}</Tag>
                                                {m.locations?.name} · {dayjs(m.created_at).format("DD MMM HH:mm")}
                                            </div>
                                        </div>
                                        <strong style={{ color: m.quantity > 0 ? "#389e0d" : "#cf1322" }}>{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</strong>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>
                </Col>
            </Row>
        </div>
    );
}
