"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button, Card, Col, Form, InputNumber, Row, Typography } from "antd";
import { message } from "@/components/admin/antd-app";
import { useAdminT } from "@/lib/admin-i18n";
import { PageHeader } from "@/components/admin/erp/ui";
import { api, useApi } from "@/components/admin/erp/erp-client";

const { Text } = Typography;

interface Settings {
    sales?: { pending_alert_hours?: number; late_delivery_days?: number; duplicate_window_days?: number };
    pos?: { max_discount_percent?: number };
}

/**
 * Admin → Business settings (owners and admins): when alerts fire, how far back duplicates are
 * looked for, and the biggest discount staff can give. Accounting settings live in Accounting.
 */
export default function SettingsPage() {
    const { t } = useAdminT();
    const { data, loading, reload } = useApi<Settings>("/api/admin/erp-settings");
    const [form] = Form.useForm();
    useEffect(() => {
        if (data) form.setFieldsValue(data);
    }, [data, form]);

    const save = async () => {
        const values = await form.validateFields();
        try {
            await api("/api/admin/erp-settings", { method: "PUT", body: values });
            message.success(t("Saved"));
            reload();
        } catch (e) {
            message.error(t((e as Error).message));
        }
    };

    return (
        <div>
            <PageHeader title={t("Business settings")} subtitle={t("Rules for alerts, duplicates and discounts.")} extra={<Button type="primary" onClick={save}>{t("Save")}</Button>} />
            <Form form={form} layout="vertical">
                <Row gutter={[16, 16]}>
                    <Col xs={24} md={12}>
                        <Card title={t("Orders and alerts")} loading={loading}>
                            <Form.Item name={["sales", "pending_alert_hours"]} label={t("Alert when an order waits for confirmation longer than (hours)")}><InputNumber min={1} max={720} style={{ width: "100%" }} /></Form.Item>
                            <Form.Item name={["sales", "late_delivery_days"]} label={t("Alert when a parcel is not delivered after (days)")}><InputNumber min={1} max={60} style={{ width: "100%" }} /></Form.Item>
                            <Form.Item name={["sales", "duplicate_window_days"]} label={t("Look for duplicate orders over the last (days)")}><InputNumber min={1} max={365} style={{ width: "100%" }} /></Form.Item>
                            <Text type="secondary">{t("Alerts are checked every morning and also cover low stock, bills due and expiring documents.")}</Text>
                        </Card>
                    </Col>
                    <Col xs={24} md={12}>
                        <Card title={t("Discounts")} loading={loading}>
                            <Form.Item name={["pos", "max_discount_percent"]} label={t("Largest discount staff can give, at the till and on manual orders (%)")}><InputNumber min={0} max={100} style={{ width: "100%" }} /></Form.Item>
                            <Text type="secondary">{t("Owners and admins can give any discount.")}</Text>
                        </Card>
                        <Card title={t("Elsewhere")} style={{ marginTop: 16 }}>
                            <p><Link href="/admin/finance/accounting">{t("Accounting")}</Link> · {t("company details, VAT, stamp duty, accounts")}</p>
                            <p><Link href="/admin/stock/settings">{t("Stock settings")}</Link> · {t("locations (add one per shop or workshop)")}</p>
                            <p><Link href="/admin/team">{t("Team")}</Link> · {t("roles and permissions")}</p>
                        </Card>
                    </Col>
                </Row>
            </Form>
        </div>
    );
}
