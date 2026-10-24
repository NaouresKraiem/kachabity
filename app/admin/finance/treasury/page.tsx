"use client";

import { useState } from "react";
import dayjs from "dayjs";
import { Alert, Button, Card, Col, DatePicker, Form, Input, InputNumber, Modal, Popconfirm, Row, Segmented, Select, Space, Table, Tabs, Tag, Typography, Upload } from "antd";
import { DeleteOutlined, LinkOutlined, PlusOutlined, SwapOutlined, ThunderboltOutlined, UploadOutlined } from "@ant-design/icons";
import { message } from "@/components/admin/antd-app";
import { useAdminT } from "@/lib/admin-i18n";
import { TREASURY_CATEGORIES, TREASURY_CATEGORY_LABELS, type TreasuryCategory } from "@/lib/erp/constants";
import { Kpi, PageHeader } from "@/components/admin/erp/ui";
import { api, day, formatDate, formatMoney, useApi } from "@/components/admin/erp/erp-client";

const { Text } = Typography;

interface Treasury {
    balances: { cash: number; bank: number; carrier: number; open_tills: number };
    lines: { id: string; kind: string; date: string; account: string; amount: number; label: string; reference?: string | null; deletable?: boolean; category?: TreasuryCategory }[];
}

interface Bank {
    account: string;
    statement: { id: string; statement_date: string; label: string; amount: number; reference: string | null; matched_line_id: string | null; matched: { entry: { number: string | null; entry_date: string; label: string } | null } | null }[];
    unmatched_books: { id: string; label: string; debit: number; credit: number; entry: { number: string | null; entry_date: string; label: string; status: string } }[];
    balance_books: number;
    balance_statement: number;
}

const KIND_LABELS: Record<string, string> = { payment: "Order payment", remittance: "Delivery company payout", movement: "Movement", bill_payment: "Bill paid", ad_spend: "Ads" };

/** Parses a bank CSV export: date; label; amount (or debit; credit). Separators , or ; and dd/mm/yyyy or yyyy-mm-dd dates. */
function parseBankCsv(text: string) {
    const rows = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const sep = (rows[0]?.match(/;/g)?.length ?? 0) >= (rows[0]?.match(/,/g)?.length ?? 0) ? ";" : ",";
    const num = (s: string) => Number((s ?? "").replace(/\s/g, "").replace(/[^\d,.-]/g, "").replace(/,(\d{1,3})$/, ".$1").replace(/,/g, ""));
    const date = (s: string) => {
        const m = s.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
        if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
        const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);
        return iso ? iso[0] : null;
    };
    const out: { statement_date: string; label: string; amount: number }[] = [];
    for (const row of rows) {
        const cells = row.split(sep).map((c) => c.replace(/^"|"$/g, "").trim());
        const d = date(cells[0] ?? "");
        if (!d) continue; // header or blank
        let amount = cells.length >= 4 ? num(cells[3]) - num(cells[2]) : num(cells[2]);
        if (cells.length >= 4 && !cells[3] && cells[2]) amount = -num(cells[2]);
        if (!amount || Number.isNaN(amount)) continue;
        out.push({ statement_date: d, label: cells[1] ?? "", amount: Math.round(amount * 1000) / 1000 });
    }
    return out;
}

/**
 * Admin → Cash & bank. What is in the till and the bank, every money movement, money moved in or
 * out by hand (owner, loans, transfers), and the bank reconciliation against the bank's statement.
 */
export default function TreasuryPage() {
    const { t, locale } = useAdminT();
    const [account, setAccount] = useState<"" | "cash" | "bank">("");
    const treasury = useApi<Treasury>(`/api/finance/treasury${account ? `?account=${account}` : ""}`);
    const bank = useApi<Bank>("/api/finance/bank");
    const [moving, setMoving] = useState<"movement" | "transfer" | null>(null);
    const [form] = Form.useForm();
    const [lineForm] = Form.useForm();
    const [addLine, setAddLine] = useState(false);
    const [matching, setMatching] = useState<string | null>(null);
    const money = (n: number) => formatMoney(n, locale);
    const b = treasury.data?.balances;

    const save = async () => {
        const values = await form.validateFields();
        try {
            await api("/api/finance/treasury", {
                method: "POST",
                body: moving === "transfer"
                    ? { kind: "transfer", from: values.from, amount: values.amount, occurred_on: day(values.occurred_on), label: values.label }
                    : { kind: "movement", account: values.account, direction: values.direction, amount: values.amount, category: values.category, occurred_on: day(values.occurred_on), label: values.label, reference: values.reference },
            });
            setMoving(null);
            treasury.reload();
            bank.reload();
        } catch (e) {
            message.error(t((e as Error).message));
        }
    };

    const remove = async (id: string) => {
        try {
            await api(`/api/finance/treasury?id=${id}`, { method: "DELETE" });
            treasury.reload();
        } catch (e) {
            message.error(t((e as Error).message));
        }
    };

    const importCsv = async (file: File) => {
        const lines = parseBankCsv(await file.text());
        if (!lines.length) {
            message.error(t("No lines found. Expected columns: date; label; amount (or debit; credit)."));
            return false;
        }
        try {
            const result = await api<{ imported: number; matched: number }>("/api/finance/bank", { method: "POST", body: { batch: file.name, lines } });
            message.success(t("{imported} line(s) imported, {matched} matched automatically", result));
            bank.reload();
        } catch (e) {
            message.error(t((e as Error).message));
        }
        return false;
    };

    const bankAction = async (body: Record<string, unknown>) => {
        try {
            const result = await api<{ matched?: number }>("/api/finance/bank", { method: "PATCH", body });
            if (result?.matched !== undefined) message.success(t("{count} line(s) matched", { count: result.matched }));
            setMatching(null);
            bank.reload();
        } catch (e) {
            message.error(t((e as Error).message));
        }
    };

    const saveLine = async () => {
        const values = await lineForm.validateFields();
        try {
            await api("/api/finance/bank", { method: "POST", body: { lines: [{ statement_date: day(values.statement_date), label: values.label, amount: values.amount }] } });
            setAddLine(false);
            bank.reload();
        } catch (e) {
            message.error(t((e as Error).message));
        }
    };

    const unmatchedStatement = (bank.data?.statement ?? []).filter((s) => !s.matched_line_id);
    const matchTarget = bank.data?.statement.find((s) => s.id === matching);

    return (
        <div>
            <PageHeader
                title={t("Cash & bank")}
                subtitle={t("Where the money is, and every movement in and out.")}
                extra={
                    <>
                        <Button icon={<SwapOutlined />} onClick={() => { form.resetFields(); form.setFieldsValue({ from: "cash", occurred_on: dayjs() }); setMoving("transfer"); }}>{t("Transfer cash ↔ bank")}</Button>
                        <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); form.setFieldsValue({ account: "bank", direction: "in", category: "owner_contribution", occurred_on: dayjs() }); setMoving("movement"); }}>{t("Money in / out")}</Button>
                    </>
                }
            />
            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col xs={12} md={6}><Kpi title={t("Cash register")} value={money(b?.cash ?? 0)} loading={treasury.loading} hint={t("Cash taken at the till and by hand, minus cash paid out. Starting floats are not included.")} /></Col>
                <Col xs={12} md={6}><Kpi title={t("Bank")} value={money(b?.bank ?? 0)} loading={treasury.loading} /></Col>
                <Col xs={12} md={6}><Kpi title={t("Held by the delivery company")} value={money(b?.carrier ?? 0)} loading={treasury.loading} /></Col>
                <Col xs={12} md={6}><Kpi title={t("Total available")} value={money((b?.cash ?? 0) + (b?.bank ?? 0) + (b?.carrier ?? 0))} loading={treasury.loading} /></Col>
            </Row>
            <Tabs items={[
                {
                    key: "movements",
                    label: t("Movements"),
                    children: (
                        <Card>
                            <Segmented value={account} onChange={setAccount} style={{ marginBottom: 12 }} options={[{ value: "", label: t("Both") }, { value: "cash", label: t("Cash register") }, { value: "bank", label: t("Bank") }]} />
                            <Table
                                rowKey={(r) => `${r.kind}:${r.id}`}
                                loading={treasury.loading}
                                dataSource={treasury.data?.lines ?? []}
                                scroll={{ x: "max-content" }}
                                pagination={{ pageSize: 50 }}
                                columns={[
                                    { title: t("Date"), dataIndex: "date", render: (v: string) => formatDate(v, locale) },
                                    { title: t("Where"), dataIndex: "account", render: (v: string) => <Tag>{t(v === "cash" ? "Cash register" : "Bank")}</Tag> },
                                    { title: t("What"), key: "w", render: (_, r) => <span>{r.category ? t(TREASURY_CATEGORY_LABELS[r.category]) : t(KIND_LABELS[r.kind] ?? r.kind)}<div style={{ fontSize: 12, color: "#8c8c8c" }}>{r.label}</div></span> },
                                    { title: t("Amount"), dataIndex: "amount", align: "right", render: (v: number) => <span style={{ color: v < 0 ? "#cf1322" : "#389e0d", fontVariantNumeric: "tabular-nums" }}>{v > 0 ? "+" : ""}{money(v)}</span> },
                                    { title: "", key: "x", render: (_, r) => r.deletable && <Popconfirm title={t("Remove this movement?")} onConfirm={() => remove(r.id)}><Button size="small" type="text" danger icon={<DeleteOutlined />} aria-label={t("Remove")} /></Popconfirm> },
                                ]}
                            />
                        </Card>
                    ),
                },
                {
                    key: "bank",
                    label: t("Bank reconciliation"),
                    children: (
                        <>
                            <Alert type="info" showIcon style={{ marginBottom: 16 }}
                                title={t("Import the bank's statement (CSV) and match each line with the books. What stays unmatched is what to check.")}
                                description={t("Balance in the books: {books} · on the statement lines: {statement}", { books: money(bank.data?.balance_books ?? 0), statement: money(bank.data?.balance_statement ?? 0) })} />
                            <Space style={{ marginBottom: 16 }} wrap>
                                <Upload accept=".csv,text/csv" showUploadList={false} beforeUpload={importCsv}><Button icon={<UploadOutlined />}>{t("Import statement CSV")}</Button></Upload>
                                <Button icon={<PlusOutlined />} onClick={() => { lineForm.resetFields(); lineForm.setFieldsValue({ statement_date: dayjs() }); setAddLine(true); }}>{t("Add a line")}</Button>
                                <Button icon={<ThunderboltOutlined />} onClick={() => bankAction({ action: "auto", days: 5 })}>{t("Match automatically")}</Button>
                            </Space>
                            <Row gutter={[16, 16]}>
                                <Col xs={24} xl={12}>
                                    <Card title={t("Statement lines")} size="small">
                                        <Table size="small" rowKey="id" loading={bank.loading} dataSource={bank.data?.statement ?? []} pagination={{ pageSize: 20 }} scroll={{ x: "max-content" }}
                                            columns={[
                                                { title: t("Date"), dataIndex: "statement_date", render: (v: string) => formatDate(v, locale) },
                                                { title: t("Label"), dataIndex: "label" },
                                                { title: t("Amount"), dataIndex: "amount", align: "right", render: (v: number) => <span style={{ color: v < 0 ? "#cf1322" : undefined }}>{money(v)}</span> },
                                                {
                                                    title: "", key: "m", render: (_, s) => s.matched_line_id
                                                        ? <Tag color="green" closable onClose={(e) => { e.preventDefault(); bankAction({ action: "unmatch", statement_id: s.id }); }}>{s.matched?.entry?.number ?? t("Matched")}</Tag>
                                                        : <Button size="small" icon={<LinkOutlined />} onClick={() => setMatching(s.id)}>{t("Match")}</Button>,
                                                },
                                            ]} />
                                    </Card>
                                </Col>
                                <Col xs={24} xl={12}>
                                    <Card title={t("Bank lines in the books not on the statement")} size="small">
                                        <Table size="small" rowKey="id" loading={bank.loading} dataSource={bank.data?.unmatched_books ?? []} pagination={{ pageSize: 20 }} scroll={{ x: "max-content" }}
                                            columns={[
                                                { title: t("Date"), key: "d", render: (_, l) => formatDate(l.entry.entry_date, locale) },
                                                { title: t("Entry"), key: "e", render: (_, l) => <span>{l.entry.number ?? <Tag>{t("Draft")}</Tag>} {l.label || l.entry.label}</span> },
                                                { title: t("Amount"), key: "a", align: "right", render: (_, l) => money(Number(l.debit) - Number(l.credit)) },
                                            ]} />
                                    </Card>
                                </Col>
                            </Row>
                            <Text type="secondary">{t("{count} statement line(s) not matched yet.", { count: unmatchedStatement.length })}</Text>
                        </>
                    ),
                },
            ]} />

            <Modal open={moving !== null} title={moving === "transfer" ? t("Transfer cash ↔ bank") : t("Money in / out")} onCancel={() => setMoving(null)} onOk={save} okText={t("Save")} cancelText={t("Cancel")} forceRender>
                <Form form={form} layout="vertical">
                    {moving === "transfer" ? (
                        <Form.Item name="from" label={t("Direction")}><Select options={[{ value: "cash", label: t("From the till to the bank (deposit)") }, { value: "bank", label: t("From the bank to the till (withdrawal)") }]} /></Form.Item>
                    ) : (
                        <Row gutter={12}>
                            <Col span={12}><Form.Item name="account" label={t("Where")}><Select options={[{ value: "bank", label: t("Bank") }, { value: "cash", label: t("Cash register") }]} /></Form.Item></Col>
                            <Col span={12}><Form.Item name="direction" label={t("In or out")}><Select options={[{ value: "in", label: t("Money in") }, { value: "out", label: t("Money out") }]} /></Form.Item></Col>
                            <Col span={24}><Form.Item name="category" label={t("What is it?")}><Select options={TREASURY_CATEGORIES.filter((c) => c !== "transfer" && c !== "pos_difference").map((c) => ({ value: c, label: t(TREASURY_CATEGORY_LABELS[c]) }))} /></Form.Item></Col>
                        </Row>
                    )}
                    <Form.Item name="amount" label={t("Amount")} rules={[{ required: true }]}><InputNumber min={0.001} precision={3} style={{ width: "100%" }} suffix="TND" /></Form.Item>
                    <Form.Item name="occurred_on" label={t("Date")} rules={[{ required: true }]}><DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" /></Form.Item>
                    <Form.Item name="label" label={t("Description")} rules={moving === "movement" ? [{ required: true }] : []}><Input /></Form.Item>
                    {moving === "movement" && <Form.Item name="reference" label={t("Reference")}><Input /></Form.Item>}
                </Form>
            </Modal>

            <Modal open={addLine} title={t("Add a statement line")} onCancel={() => setAddLine(false)} onOk={saveLine} okText={t("Save")} cancelText={t("Cancel")} forceRender>
                <Form form={lineForm} layout="vertical">
                    <Form.Item name="statement_date" label={t("Date")} rules={[{ required: true }]}><DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" /></Form.Item>
                    <Form.Item name="label" label={t("Label")}><Input /></Form.Item>
                    <Form.Item name="amount" label={t("Amount (negative for money out)")} rules={[{ required: true }]}><InputNumber precision={3} style={{ width: "100%" }} /></Form.Item>
                </Form>
            </Modal>

            <Modal open={!!matching} title={t("Match with a line of the books")} onCancel={() => setMatching(null)} footer={null} width={720} forceRender>
                {matchTarget && <p>{formatDate(matchTarget.statement_date, locale)} · {matchTarget.label} · <b>{money(matchTarget.amount)}</b></p>}
                <Table size="small" rowKey="id" pagination={{ pageSize: 10 }}
                    dataSource={(bank.data?.unmatched_books ?? []).slice().sort((x, y) => Math.abs(Number(x.debit) - Number(x.credit) - (matchTarget?.amount ?? 0)) - Math.abs(Number(y.debit) - Number(y.credit) - (matchTarget?.amount ?? 0)))}
                    columns={[
                        { title: t("Date"), key: "d", render: (_, l) => formatDate(l.entry.entry_date, locale) },
                        { title: t("Entry"), key: "e", render: (_, l) => l.label || l.entry.label },
                        { title: t("Amount"), key: "a", render: (_, l) => { const v = Number(l.debit) - Number(l.credit); return <span style={{ fontWeight: matchTarget && Math.abs(v - matchTarget.amount) < 0.0005 ? 700 : 400 }}>{money(v)}</span>; } },
                        { title: "", key: "x", render: (_, l) => <Button size="small" type="primary" onClick={() => bankAction({ action: "match", statement_id: matching, line_id: l.id })}>{t("Match")}</Button> },
                    ]} />
            </Modal>
        </div>
    );
}
