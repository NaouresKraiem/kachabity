"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Alert, Breadcrumb, Button, Card, Input, Modal, Popconfirm, Segmented, Space, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { BarcodeOutlined, DeleteOutlined, PlusOutlined, PrinterOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { message } from "@/components/admin/antd-app";
import { useAdminRole } from "@/lib/admin-role-context";
import { DATE_LOCALES, useAdminT } from "@/lib/admin-i18n";
import { statusInfo, type StatusGroup } from "@/lib/colissimo-data";
import DeliveryStatusTag from "@/components/admin/delivery/DeliveryStatusTag";
import SendParcelModal from "@/components/admin/delivery/SendParcelModal";
import { deliveryApi, type Delivery, type DeliveryList, type RefreshResult } from "@/components/admin/delivery/delivery-api";

const { Title, Text } = Typography;

type Filter = "all" | StatusGroup;

/**
 * Admin → Delivery: the parcels sent to Colissimo from the orders (or added by barcode), with
 * their live status. Colissimo's API can't list an account's parcels, so parcels created on its
 * website appear here once added by barcode.
 */
export default function DeliveryPage() {
    const { t, locale } = useAdminT();
    const canDelete = useAdminRole().can("delete");
    const [data, setData] = useState<DeliveryList | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState<Filter>("all");
    const [search, setSearch] = useState("");
    const [selected, setSelected] = useState<string[]>([]);
    const [importOpen, setImportOpen] = useState(false);
    const [barcode, setBarcode] = useState("");
    const [importing, setImporting] = useState(false);
    const [newOpen, setNewOpen] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            setData(await deliveryApi<DeliveryList>());
        } catch (e) {
            message.error((e as Error).message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const refreshStatuses = async (ids?: string[]) => {
        setRefreshing(true);
        try {
            const result = await deliveryApi<RefreshResult>({ method: "POST", body: { action: "refresh", ids } });
            if (result.failures.length) {
                message.warning(t("{count} parcel(s) couldn't be checked: {error}", { count: result.failures.length, error: result.failures[0].error }));
            }
            message.success(t("Checked {checked} parcel(s), {changed} changed", { checked: result.checked, changed: result.changed }));
            await load();
        } catch (e) {
            message.error((e as Error).message);
        } finally {
            setRefreshing(false);
        }
    };

    const importParcel = async () => {
        setImporting(true);
        try {
            await deliveryApi({ method: "POST", body: { action: "import", barcode: barcode.trim() } });
            message.success(t("Parcel {barcode} added", { barcode }));
            setImportOpen(false);
            setBarcode("");
            await load();
        } catch (e) {
            message.error((e as Error).message);
        } finally {
            setImporting(false);
        }
    };

    const remove = async (ids: string[]) => {
        try {
            await deliveryApi({ method: "DELETE", query: `ids=${ids.join(",")}` });
            message.success(t("Removed {count} parcel(s) from the list", { count: ids.length }));
            setSelected([]);
            await load();
        } catch (e) {
            message.error((e as Error).message);
        }
    };

    const rows = useMemo(() => {
        const term = search.trim().toLowerCase();
        return (data?.rows ?? []).filter((row) => {
            if (filter !== "all" && statusInfo(row.status).group !== filter) return false;
            if (!term) return true;
            const customer = row.order ? `${row.order.customer_first_name} ${row.order.customer_last_name}` : "";
            return [row.barcode, row.recipient_name, row.phone, row.governorate, row.city, row.order?.order_number, customer]
                .some((value) => value?.toLowerCase().includes(term));
        });
    }, [data, filter, search]);

    const counts = useMemo(() => {
        const result: Record<Filter, number> = { all: 0, pending: 0, moving: 0, delivered: 0, returned: 0, problem: 0 };
        for (const row of data?.rows ?? []) {
            result.all += 1;
            result[statusInfo(row.status).group] += 1;
        }
        return result;
    }, [data]);

    const formatDate = (date: string | null) => (date ? new Date(date).toLocaleString(DATE_LOCALES[locale], { dateStyle: "short", timeStyle: "short" }) : "—");

    const columns: ColumnsType<Delivery> = [
        {
            title: t("Barcode"),
            dataIndex: "barcode",
            key: "barcode",
            render: (value: string | null) => (value ? <Text copyable style={{ fontFamily: "monospace" }}>{value}</Text> : "—"),
        },
        {
            title: t("Order"),
            key: "order",
            render: (_, row) =>
                row.order ? (
                    <Link href={`/admin/orders/${row.order.id}`} style={{ fontFamily: "monospace" }}>{row.order.order_number}</Link>
                ) : (
                    <Text type="secondary">{t("Not linked")}</Text>
                ),
        },
        {
            title: t("Customer"),
            key: "customer",
            render: (_, row) => (
                <div>
                    <div style={{ fontWeight: 500 }}>{row.recipient_name || (row.order ? `${row.order.customer_first_name} ${row.order.customer_last_name}` : "—")}</div>
                    {row.phone && <Text type="secondary" style={{ fontSize: 12 }}>{row.phone}</Text>}
                </div>
            ),
        },
        {
            title: t("Destination"),
            key: "destination",
            render: (_, row) => [row.city, row.governorate].filter(Boolean).join(", ") || "—",
        },
        {
            title: t("Cash to collect"),
            dataIndex: "cod_amount",
            key: "cod_amount",
            render: (value: number | null) => (value != null ? `${Number(value)} TND` : "—"),
        },
        {
            title: t("Status"),
            key: "status",
            render: (_, row) => <DeliveryStatusTag status={row.status} reason={row.status_reason} />,
        },
        {
            title: t("Last change"),
            key: "status_changed_at",
            sorter: (a, b) => new Date(a.status_changed_at ?? a.created_at).getTime() - new Date(b.status_changed_at ?? b.created_at).getTime(),
            render: (_, row) => formatDate(row.status_changed_at ?? row.created_at),
        },
        {
            title: t("Action"),
            key: "action",
            render: (_, row) => (
                <Space size={4} wrap>
                    {row.label_url && (
                        <Button type="link" size="small" icon={<PrinterOutlined />} href={row.label_url} target="_blank" rel="noopener noreferrer">{t("Slip")}</Button>
                    )}
                    {row.barcode && (
                        <Button type="link" size="small" icon={<ReloadOutlined />} onClick={() => refreshStatuses([row.id])}>{t("Check")}</Button>
                    )}
                    {canDelete && (
                        <Popconfirm
                            title={t("Remove this parcel from the list?")}
                            description={t("It stays at Colissimo: cancel it on their website if needed. The order can then be sent again.")}
                            okText={t("Remove")}
                            cancelText={t("Cancel")}
                            onConfirm={() => remove([row.id])}
                        >
                            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                    )}
                </Space>
            ),
        },
    ];

    const filterLabel = (label: string, key: Filter) => `${t(label)} (${counts[key]})`;

    return (
        <div>
            <Breadcrumb items={[{ title: <Link href="/admin/dashboard">{t("Dashboard")}</Link> }, { title: t("Delivery") }]} />
            <div style={{ marginTop: 24, marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div>
                    <Title level={2} style={{ margin: 0, fontWeight: 600 }}>{t("Delivery (Colissimo)")}</Title>
                    <Text type="secondary">{t("Your Colissimo parcels and their status. Create one here, or send an order from its page.")}</Text>
                </div>
                <Space wrap>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        disabled={!data?.configured.add}
                        onClick={() => setNewOpen(true)}
                        style={{ background: "#7a3b2e", borderColor: "#7a3b2e" }}
                    >
                        {t("New parcel")}
                    </Button>
                    <Button icon={<BarcodeOutlined />} disabled={!data?.configured.tracking} onClick={() => setImportOpen(true)}>{t("Add by barcode")}</Button>
                    <Button
                        icon={<ReloadOutlined />}
                        loading={refreshing}
                        disabled={!data?.configured.tracking}
                        onClick={() => refreshStatuses()}
                    >
                        {t("Refresh statuses")}
                    </Button>
                </Space>
            </div>

            {data && (!data.configured.add || !data.configured.tracking) && (
                <Alert
                    type="warning"
                    showIcon
                    style={{ marginBottom: 16 }}
                    title={t("Colissimo isn't connected yet")}
                    description={t("Add COLISSIMO_ADD_TOKEN and COLISSIMO_TRACKING_TOKEN (from your Colissimo account, Paramètres → APIs) to the server environment.")}
                />
            )}

            <Card>
                <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
                    <div style={{ overflowX: "auto" }}>
                        <Segmented<Filter>
                            value={filter}
                            onChange={setFilter}
                            options={[
                                { value: "all", label: filterLabel("All", "all") },
                                { value: "pending", label: filterLabel("Waiting for pickup", "pending") },
                                { value: "moving", label: filterLabel("On the way", "moving") },
                                { value: "delivered", label: filterLabel("Delivered", "delivered") },
                                { value: "returned", label: filterLabel("Returns", "returned") },
                                { value: "problem", label: filterLabel("To check", "problem") },
                            ]}
                        />
                    </div>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                        <Input
                            allowClear
                            prefix={<SearchOutlined />}
                            placeholder={t("Search barcode, order, customer, phone, city")}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={{ maxWidth: 360 }}
                        />
                        {canDelete && selected.length > 0 && (
                            <Popconfirm
                                title={t("Remove {count} parcel(s) from the list?", { count: selected.length })}
                                okText={t("Remove")}
                                cancelText={t("Cancel")}
                                onConfirm={() => remove(selected)}
                            >
                                <Button danger icon={<DeleteOutlined />}>{t("Remove ({count})", { count: selected.length })}</Button>
                            </Popconfirm>
                        )}
                    </div>
                    <Table
                        rowKey="id"
                        loading={loading}
                        dataSource={rows}
                        columns={columns}
                        rowSelection={canDelete ? { selectedRowKeys: selected, onChange: (keys) => setSelected(keys as string[]) } : undefined}
                        pagination={{ pageSize: 25, showSizeChanger: false }}
                        scroll={{ x: "max-content" }}
                        locale={{ emptyText: t("No parcels yet. Click “New parcel”, or open an order and click “Send to Colissimo”.") }}
                    />
                </Space>
            </Card>

            <SendParcelModal
                open={newOpen}
                onClose={() => setNewOpen(false)}
                onSent={() => {
                    setNewOpen(false);
                    load();
                }}
            />

            <Modal
                open={importOpen}
                title={t("Add a parcel by barcode")}
                okText={t("Add")}
                cancelText={t("Cancel")}
                onOk={importParcel}
                onCancel={() => setImportOpen(false)}
                confirmLoading={importing}
                okButtonProps={{ disabled: barcode.length < 6 }}
            >
                <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
                    {t("For parcels created on Colissimo's website. To link one to an order, add it from the order's page.")}
                </Text>
                <Input placeholder={t("Colissimo barcode")} inputMode="numeric" value={barcode} onChange={(e) => setBarcode(e.target.value.replace(/\D/g, ""))} onPressEnter={importParcel} />
            </Modal>
        </div>
    );
}
