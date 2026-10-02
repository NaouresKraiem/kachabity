"use client";

import { useMemo, useState } from "react";
import { Table, InputNumber, Button, Space, Tag, Tooltip, Switch, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { STATUS_LABELS } from "@/lib/stock";
import { message } from "@/components/admin/antd-app";
import VariantThumb from "./VariantThumb";
import { apiJson, STATUS_COLORS, variantLabel, type InventoryRow, type StockLocation } from "./stock-client";
import { useAdminT } from "@/lib/admin-i18n";

const { Text } = Typography;

interface ProductVariantsPanelProps {
    variants: InventoryRow[];
    locations: StockLocation[];
    onSaved: () => void;
}

/**
 * The variants of one product with their stock per location, editable in place. Saving records
 * the differences as stock adjustments in one transaction, so the history stays complete.
 */
export default function ProductVariantsPanel({ variants, locations, onSaved }: ProductVariantsPanelProps) {
    const { t } = useAdminT();
    // Edited quantities keyed by `${variantId}:${locationId}`.
    const [edits, setEdits] = useState<Record<string, number>>({});
    const [saving, setSaving] = useState(false);
    const [tracking, setTracking] = useState(false);
    const tracked = variants[0]?.stock_tracked ?? false;
    const productId = variants[0]?.product_id;

    const key = (variantId: string, locationId: string) => `${variantId}:${locationId}`;
    const valueOf = (v: InventoryRow, locationId: string) => edits[key(v.variant_id, locationId)] ?? v.levels[locationId] ?? 0;
    const changes = useMemo(
        () =>
            Object.entries(edits).filter(([k, qty]) => {
                const [variantId, locationId] = k.split(":");
                const row = variants.find((v) => v.variant_id === variantId);
                return row && (row.levels[locationId] ?? 0) !== qty;
            }),
        [edits, variants]
    );

    const save = async () => {
        if (changes.length === 0) return;
        setSaving(true);
        try {
            // One request for every location: all changes are saved together or not at all.
            const items = changes.map(([k, quantity]) => {
                const [variant_id, location_id] = k.split(":");
                return { variant_id, location_id, quantity };
            });
            await apiJson("/api/stock/movements", {
                method: "POST",
                body: JSON.stringify({ type: "count", location_id: items[0].location_id, items, reference: "Stock count" }),
            });
            message.success(t("Stock updated ({count})", { count: changes.length }));
            setEdits({});
            onSaved();
        } catch (e) {
            message.error(t((e as Error).message));
        } finally {
            setSaving(false);
        }
    };

    const toggleTracking = async (next: boolean) => {
        if (!productId) return;
        setTracking(true);
        try {
            await apiJson("/api/stock/tracking", { method: "PUT", body: JSON.stringify({ product_ids: [productId], tracked: next }) });
            message.success(next ? t("The website now follows this product's stock") : t("Stock tracking switched off: the product stays orderable"));
            onSaved();
        } catch (e) {
            message.error(t((e as Error).message));
        } finally {
            setTracking(false);
        }
    };

    const columns: ColumnsType<InventoryRow> = [
        {
            title: t("Variant"),
            key: "variant",
            render: (_, v) => (
                <Space>
                    <VariantThumb src={v.image} size={48} />
                    <div>
                        <Space size={6}>
                            {v.color_hex && <span style={{ display: "inline-block", width: 12, height: 12, borderRadius: 6, background: v.color_hex, border: "1px solid #ddd" }} />}
                            <strong>{variantLabel(v)}</strong>
                        </Space>
                        <div><Text type="secondary" style={{ fontSize: 12 }}>{v.sku}</Text></div>
                    </div>
                </Space>
            ),
        },
        ...locations.map((l) => ({
            title: l.sells_online ? `${l.name} (online)` : l.name,
            key: l.id,
            width: 170,
            render: (_: unknown, v: InventoryRow) => {
                const current = v.levels[l.id] ?? 0;
                const value = valueOf(v, l.id);
                const changed = value !== current;
                return (
                    <Space size={4}>
                        <InputNumber
                            min={0}
                            precision={0}
                            value={value}
                            style={{ width: 90, borderColor: changed ? "#d48806" : undefined }}
                            onChange={(next) => setEdits((e) => ({ ...e, [key(v.variant_id, l.id)]: next ?? 0 }))}
                            aria-label={t("{variant} at {location}", { variant: variantLabel(v), location: l.name })}
                        />
                        {changed && <Text type="secondary" style={{ fontSize: 12 }}>{t("was {count}", { count: current })}</Text>}
                    </Space>
                );
            },
        })),
        {
            title: t("Status"),
            key: "status",
            width: 130,
            render: (_, v) => (
                <Tooltip title={v.stock_tracked ? t("Reorder point: {count}", { count: v.reorder_point }) : undefined}>
                    <Tag color={STATUS_COLORS[v.status]}>{t(STATUS_LABELS[v.status])}</Tag>
                </Tooltip>
            ),
        },
    ];

    return (
        <div style={{ padding: "4px 0 8px" }}>
            <Table rowKey="variant_id" size="small" pagination={false} columns={columns} dataSource={variants} scroll={{ x: "max-content" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, gap: 12, flexWrap: "wrap" }}>
                <Space>
                    <Switch checked={tracked} loading={tracking} onChange={toggleTracking} />
                    <Text>
                        {t("Track on website")}
                        <Text type="secondary" style={{ marginInlineStart: 8, fontSize: 12 }}>
                            {tracked ? t("The shop shows this stock and stops selling at zero.") : t("Off: always orderable. Switch on once the stock is counted.")}
                        </Text>
                    </Text>
                </Space>
                <Space>
                    {changes.length > 0 && <Button onClick={() => setEdits({})} disabled={saving}>{t("Discard")}</Button>}
                    <Button type="primary" loading={saving} disabled={changes.length === 0} onClick={save}>
                        {changes.length > 0 ? t("Save changes ({count})", { count: changes.length }) : t("Save changes")}
                    </Button>
                </Space>
            </div>
        </div>
    );
}
