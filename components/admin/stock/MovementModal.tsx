"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal, Form, Select, InputNumber, Input, Button, Space, Alert, Typography } from "antd";
import { message } from "@/components/admin/antd-app";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { MOVEMENT_LABELS, MOVEMENT_TYPES, type MovementType } from "@/lib/stock";
import { apiJson, variantLabel, type InventoryRow, type StockLocation } from "./stock-client";
import VariantThumb from "./VariantThumb";
import { searchByText } from "@/components/admin/select-search";
import { useAdminT } from "@/lib/admin-i18n";

const { Text } = Typography;

const TYPE_HELP: Record<MovementType, string> = {
    restock: "Stock received from a supplier or workshop. Adds to the location.",
    return: "A customer brought items back. Adds to the location.",
    sale: "Sold outside the website (shop, phone). Removes from the location. Website orders deduct automatically.",
    adjustment: "Correct a count: use a positive number to add, negative to remove (damage, loss).",
    transfer: "Move stock from one location to another.",
};

export interface MovementPreset {
    type?: MovementType;
    locationId?: string;
    lines?: { variant_id: string; quantity: number }[];
    reference?: string;
}

interface MovementModalProps {
    open: boolean;
    onClose: () => void;
    onSaved: () => void;
    rows: InventoryRow[];
    locations: StockLocation[];
    preset?: MovementPreset | null;
}

interface Line {
    key: number;
    variant_id?: string;
    quantity: number | null;
}

let nextKey = 1;

export default function MovementModal({ open, onClose, onSaved, rows, locations, preset }: MovementModalProps) {
    const { t } = useAdminT();
    const [form] = Form.useForm();
    const [lines, setLines] = useState<Line[]>([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const type: MovementType = Form.useWatch("type", form) ?? "restock";
    const locationId: string | undefined = Form.useWatch("location_id", form);

    useEffect(() => {
        if (!open) return;
        const online = locations.find((l) => l.sells_online) ?? locations[0];
        form.setFieldsValue({
            type: preset?.type ?? "restock",
            location_id: preset?.locationId ?? online?.id,
            to_location_id: undefined,
            reference: preset?.reference ?? "",
            note: "",
        });
        setLines(
            preset?.lines?.length
                ? preset.lines.map((l) => ({ key: nextKey++, variant_id: l.variant_id, quantity: l.quantity }))
                : [{ key: nextKey++, quantity: null }]
        );
        setError(null);
    }, [open, preset, locations, form]);

    const options = useMemo(
        () =>
            rows.map((r) => ({
                value: r.variant_id,
                searchtext: `${r.product_name} ${r.product_name_ar ?? ""} ${variantLabel(r)} ${r.sku ?? ""}`,
                label: (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <VariantThumb src={r.image} size={22} />
                        {`${r.product_name} · ${variantLabel(r)}${r.sku ? ` · ${r.sku}` : ""}`}
                    </span>
                ),
            })),
        [rows]
    );
    const rowById = useMemo(() => new Map(rows.map((r) => [r.variant_id, r])), [rows]);

    const updateLine = (key: number, patch: Partial<Line>) =>
        setLines((current) => current.map((l) => (l.key === key ? { ...l, ...patch } : l)));

    const submit = async () => {
        const values = await form.validateFields();
        const items = lines
            .filter((l) => l.variant_id && l.quantity)
            .map((l) => ({ variant_id: l.variant_id!, quantity: Number(l.quantity) }));
        if (items.length === 0) {
            setError("Add at least one item with a quantity.");
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const result = await apiJson<{ recorded: number }>("/api/stock/movements", {
                method: "POST",
                body: JSON.stringify({ ...values, items }),
            });
            message.success(t("Recorded {count} movement(s)", { count: result.recorded }));
            onSaved();
            onClose();
        } catch (e) {
            setError(t((e as Error).message));
        } finally {
            setSaving(false);
        }
    };

    const allowNegative = type === "adjustment";

    return (
        <Modal
            open={open}
            onCancel={onClose}
            title={t("Record stock movement")}
            width={760}
            destroyOnHidden
            footer={[
                <Button key="cancel" onClick={onClose}>{t("Cancel")}</Button>,
                <Button key="save" type="primary" loading={saving} onClick={submit}>{t("Record movement")}</Button>,
            ]}
        >
            <Form form={form} layout="vertical" requiredMark={false}>
                <Space size="middle" style={{ display: "flex" }} align="start" wrap>
                    <Form.Item name="type" label={t("Type")} style={{ minWidth: 180 }}>
                        <Select options={MOVEMENT_TYPES.map((type) => ({ value: type, label: t(MOVEMENT_LABELS[type]) }))} />
                    </Form.Item>
                    <Form.Item name="location_id" label={type === "transfer" ? t("From") : t("Location")} rules={[{ required: true }]} style={{ minWidth: 200 }}>
                        <Select options={locations.map((l) => ({ value: l.id, label: l.name + (l.sells_online ? " (online)" : "") }))} />
                    </Form.Item>
                    {type === "transfer" && (
                        <Form.Item
                            name="to_location_id"
                            label={t("To")}
                            rules={[{ required: true, message: t("Choose where the stock goes") }]}
                            style={{ minWidth: 200 }}
                        >
                            <Select
                                options={locations
                                    .filter((l) => l.id !== locationId)
                                    .map((l) => ({ value: l.id, label: l.name + (l.sells_online ? " (online)" : "") }))}
                            />
                        </Form.Item>
                    )}
                </Space>
                <Text type="secondary" style={{ display: "block", marginTop: -12, marginBottom: 16 }}>{t(TYPE_HELP[type])}</Text>

                <div style={{ marginBottom: 8, fontWeight: 500 }}>{t("Items")}</div>
                <Space orientation="vertical" style={{ width: "100%" }}>
                    {lines.map((line) => {
                        const row = line.variant_id ? rowById.get(line.variant_id) : undefined;
                        const here = row && locationId ? row.levels[locationId] ?? 0 : null;
                        return (
                            <Space key={line.key} style={{ display: "flex", paddingBottom: 8, borderBottom: "1px solid #f0f0f0" }} align="center" wrap>
                                <VariantThumb src={row?.image ?? null} size={40} />
                                <Select
                                    showSearch
                                    filterOption={searchByText}
                                    placeholder={t("Search product, color, size or SKU")}
                                    style={{ width: 400, maxWidth: "calc(100vw - 120px)", minWidth: 0 }}
                                    value={line.variant_id}
                                    options={options}
                                    onChange={(value) => updateLine(line.key, { variant_id: value })}
                                />
                                <InputNumber
                                    placeholder={t("Qty")}
                                    style={{ width: 100 }}
                                    precision={0}
                                    min={allowNegative ? undefined : 1}
                                    value={line.quantity}
                                    onChange={(value) => updateLine(line.key, { quantity: value })}
                                />
                                <Text type="secondary" style={{ width: 70, fontSize: 12 }}>{here !== null ? `${here} here` : ""}</Text>
                                <Button
                                    type="text"
                                    icon={<DeleteOutlined />}
                                    aria-label={t("Remove line")}
                                    disabled={lines.length === 1}
                                    onClick={() => setLines((current) => current.filter((l) => l.key !== line.key))}
                                />
                            </Space>
                        );
                    })}
                    <Button icon={<PlusOutlined />} onClick={() => setLines((current) => [...current, { key: nextKey++, quantity: null }])}>
                        {t("Add item")}
                    </Button>
                </Space>

                <Space size="middle" style={{ display: "flex", marginTop: 16 }} align="start" wrap>
                    <Form.Item name="reference" label={t("Reference")} style={{ minWidth: 220 }}>
                        <Input placeholder={t("Invoice, delivery note…")} maxLength={200} />
                    </Form.Item>
                    <Form.Item name="note" label={t("Note")} style={{ minWidth: 0, width: 380, maxWidth: "100%" }}>
                        <Input placeholder={t("Optional")} maxLength={1000} />
                    </Form.Item>
                </Space>
                {error && <Alert type="error" showIcon title={error} />}
            </Form>
        </Modal>
    );
}
