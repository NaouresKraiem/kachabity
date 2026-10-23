"use client";

import { useEffect, useMemo, useState } from "react";
import dayjs, { type Dayjs } from "dayjs";
import { Alert, Button, Card, Col, DatePicker, Descriptions, Form, Input, InputNumber, Modal, Popconfirm, Row, Select, Space, Switch, Table, Tabs, Tag, Typography } from "antd";
import { CheckCircleOutlined, DeleteOutlined, DownloadOutlined, PlusOutlined, RollbackOutlined } from "@ant-design/icons";
import { message } from "@/components/admin/antd-app";
import { useAdminT } from "@/lib/admin-i18n";
import { useAdminRole } from "@/lib/admin-role-context";
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABELS, JOURNALS, JOURNAL_LABELS, type AccountType, type Journal } from "@/lib/erp/constants";
import { PageHeader } from "@/components/admin/erp/ui";
import { api, day, download, formatDate, formatMoney, useApi } from "@/components/admin/erp/erp-client";

const { Text } = Typography;

interface Line { id: string; account_code: string; label: string; debit: number; credit: number; partner_name: string | null; position: number }
interface Entry {
    id: string; journal: Journal; number: string | null; entry_date: string; label: string; source_type: string; status: "draft" | "posted";
    posted_at: string | null; posted_by_email: string | null; reversal_of: string | null; reversed_at: string | null; created_by_email: string | null; lines: Line[];
}
interface Account { code: string; name: string; name_en: string | null; name_ar: string | null; class: number; type: AccountType; is_active: boolean; is_system: boolean }

const SOURCE_LABELS: Record<string, string> = {
    order: "Sale delivered", order_payment: "Payment received", cod_remittance: "Delivery company payout", bill: "Bill",
    bill_payment: "Bill paid", treasury_movement: "Cash/bank movement", ad_spend: "Ad spend", sales_invoice: "Invoice",
    stock_variation: "Stock variation", manual: "Manual entry",
};

/**
 * Admin → Accounting (Tunisian SCE structure). The business writes its own entries: each
 * delivered sale, payment, payout, bill, cash or bank movement and ad spend lands here as a draft.
 * The accountant checks and validates them (numbered, then frozen), adds manual entries, books the
 * stock variation at period end, reads the reports, and exports everything for their software.
 */
export default function AccountingPage() {
    const { t } = useAdminT();
    return (
        <div>
            <PageHeader title={t("Accounting")} subtitle={t("Entries written automatically from sales, payments, bills and cash, checked and validated here.")} />
            <Tabs items={[
                { key: "journal", label: t("Journal"), children: <JournalTab /> },
                { key: "reports", label: t("Reports"), children: <ReportsTab /> },
                { key: "accounts", label: t("Chart of accounts"), children: <AccountsTab /> },
                { key: "settings", label: t("Settings"), children: <SettingsTab /> },
            ]} />
        </div>
    );
}

function useAccounts() {
    return useApi<Account[]>("/api/finance/accounts");
}

function JournalTab() {
    const { t, locale } = useAdminT();
    const [filters, setFilters] = useState<{ journal: string; status: string; range: [Dayjs, Dayjs] | null; q: string; account: string }>({ journal: "", status: "", range: [dayjs().startOf("month"), dayjs()], q: "", account: "" });
    const [page, setPage] = useState(1);
    const url = useMemo(() => {
        const qs = new URLSearchParams({ page: String(page), size: "50" });
        if (filters.journal) qs.set("journal", filters.journal);
        if (filters.status) qs.set("status", filters.status);
        if (filters.range) { qs.set("from", day(filters.range[0])); qs.set("to", day(filters.range[1])); }
        if (filters.q) qs.set("q", filters.q);
        if (filters.account) qs.set("account", filters.account);
        return `/api/finance/accounting?${qs}`;
    }, [filters, page]);
    const { data, loading, reload } = useApi<{ rows: Entry[]; total: number; drafts: number }>(url);
    const accounts = useAccounts();
    const [selected, setSelected] = useState<string[]>([]);
    const [editing, setEditing] = useState<Entry | "new" | null>(null);
    const [variationOpen, setVariationOpen] = useState(false);
    const [variationDate, setVariationDate] = useState<Dayjs>(dayjs().endOf("month"));
    const money = (n: number) => formatMoney(n, locale);
    const accountName = (code: string) => accounts.data?.find((a) => a.code === code)?.name ?? "";

    const post = async (body: Record<string, unknown>) => {
        try {
            const result = await api<{ posted: number }>("/api/finance/accounting", { method: "POST", body: { action: "post", ...body } });
            message.success(t("{count} entry(ies) validated", { count: result.posted }));
            setSelected([]);
            reload();
        } catch (e) {
            message.error(t((e as Error).message));
        }
    };
    const act = async (body: Record<string, unknown>, done: string) => {
        try {
            await api("/api/finance/accounting", { method: "POST", body });
            message.success(t(done));
            reload();
        } catch (e) {
            message.error(t((e as Error).message));
        }
    };
    const bookVariation = async () => {
        try {
            const result = await api<{ goods_change: number; materials_change: number }>("/api/finance/accounting", { method: "POST", body: { action: "stock_variation", date: day(variationDate) } });
            message.success(t("Stock variation booked: goods {goods}, raw materials {materials}", { goods: money(result.goods_change), materials: money(result.materials_change) }));
            setVariationOpen(false);
            reload();
        } catch (e) {
            message.error(t((e as Error).message));
        }
    };

    return (
        <>
            {!!data?.drafts && (
                <Alert type="warning" showIcon style={{ marginBottom: 16 }}
                    title={t("{count} entry(ies) waiting for validation.", { count: data.drafts })}
                    description={t("Check them, then validate: they get their number and can no longer change. Reports show validated entries unless you include drafts.")}
                    action={<Popconfirm title={t("Validate every draft?")} onConfirm={() => post({})}><Button type="primary">{t("Validate all")}</Button></Popconfirm>} />
            )}
            <Card>
                <Space wrap style={{ marginBottom: 12 }}>
                    <DatePicker.RangePicker value={filters.range} onChange={(r) => { setFilters({ ...filters, range: r && r[0] && r[1] ? [r[0], r[1]] : null }); setPage(1); }} format="DD/MM/YYYY" />
                    <Select value={filters.journal} onChange={(journal) => { setFilters({ ...filters, journal }); setPage(1); }} style={{ width: 160 }} options={[{ value: "", label: t("All journals") }, ...JOURNALS.map((j) => ({ value: j, label: `${j} · ${t(JOURNAL_LABELS[j])}` }))]} />
                    <Select value={filters.status} onChange={(status) => { setFilters({ ...filters, status }); setPage(1); }} style={{ width: 150 }} options={[{ value: "", label: t("All") }, { value: "draft", label: t("Drafts") }, { value: "posted", label: t("Validated") }]} />
                    <Input.Search allowClear placeholder={t("Account (e.g. 411)")} style={{ width: 170 }} onSearch={(account) => { setFilters({ ...filters, account }); setPage(1); }} />
                    <Input.Search allowClear placeholder={t("Label or number")} style={{ width: 200 }} onSearch={(q) => { setFilters({ ...filters, q }); setPage(1); }} />
                </Space>
                <Space wrap style={{ marginBottom: 12 }}>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing("new")}>{t("New entry")}</Button>
                    <Button icon={<CheckCircleOutlined />} disabled={!selected.length} onClick={() => post({ ids: selected })}>{t("Validate selected ({count})", { count: selected.length })}</Button>
                    <Button onClick={() => setVariationOpen(true)}>{t("Book stock variation")}</Button>
                </Space>
                <Table
                    rowKey="id"
                    size="small"
                    loading={loading}
                    dataSource={data?.rows ?? []}
                    scroll={{ x: "max-content" }}
                    rowSelection={{ selectedRowKeys: selected, onChange: (k) => setSelected(k as string[]), getCheckboxProps: (r) => ({ disabled: r.status !== "draft" }) }}
                    pagination={{ current: page, pageSize: 50, total: data?.total ?? 0, onChange: setPage, showSizeChanger: false }}
                    expandable={{
                        expandedRowRender: (entry) => (
                            <Table
                                size="small"
                                rowKey="id"
                                pagination={false}
                                dataSource={[...entry.lines].sort((a, b) => a.position - b.position)}
                                columns={[
                                    { title: t("Account"), dataIndex: "account_code", render: (v: string) => <span><b>{v}</b> {accountName(v)}</span> },
                                    { title: t("Label"), dataIndex: "label", render: (v: string, l) => <span>{v}{l.partner_name ? <Text type="secondary"> · {l.partner_name}</Text> : null}</span> },
                                    { title: t("Debit"), dataIndex: "debit", align: "right", render: (v: number) => (Number(v) ? money(v) : "") },
                                    { title: t("Credit"), dataIndex: "credit", align: "right", render: (v: number) => (Number(v) ? money(v) : "") },
                                ]}
                            />
                        ),
                    }}
                    columns={[
                        { title: t("Date"), dataIndex: "entry_date", render: (v: string) => formatDate(v, locale) },
                        { title: t("Journal"), dataIndex: "journal", render: (v: Journal) => <Tag>{v}</Tag> },
                        { title: t("Number"), dataIndex: "number", render: (v: string | null) => v ?? <Tag color="orange">{t("Draft")}</Tag> },
                        { title: t("Label"), dataIndex: "label", render: (v: string, r) => <span>{v}<div style={{ fontSize: 12, color: "#8c8c8c" }}>{t(SOURCE_LABELS[r.source_type] ?? r.source_type)}{r.reversed_at ? ` · ${t("Reversed")}` : ""}{r.reversal_of ? ` · ${t("Reversal")}` : ""}</div></span> },
                        { title: t("Amount"), key: "amount", align: "right", render: (_, r) => money(r.lines.reduce((s, l) => s + Number(l.debit), 0)) },
                        {
                            title: "", key: "a", render: (_, r) => (
                                <Space>
                                    {r.status === "draft" && r.source_type === "manual" && <Button size="small" onClick={() => setEditing(r)}>{t("Edit")}</Button>}
                                    {r.status === "draft" && <Popconfirm title={t("Discard this draft?")} onConfirm={() => act({ action: "discard", id: r.id }, "Draft discarded")}><Button size="small" type="text" danger icon={<DeleteOutlined />} aria-label={t("Discard")} /></Popconfirm>}
                                    {r.status === "posted" && !r.reversed_at && !r.reversal_of && <Popconfirm title={t("Reverse this entry?")} description={t("A reversing entry is written; the original stays.")} onConfirm={() => act({ action: "reverse", id: r.id }, "Entry reversed")}><Button size="small" icon={<RollbackOutlined />}>{t("Reverse")}</Button></Popconfirm>}
                                </Space>
                            ),
                        },
                    ]}
                />
            </Card>
            <EntryEditor entry={editing} accounts={accounts.data ?? []} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />
            <Modal open={variationOpen} title={t("Book stock variation")} onCancel={() => setVariationOpen(false)} onOk={bookVariation} okText={t("Book")} cancelText={t("Cancel")}>
                <p>{t("Purchases are expensed when billed. At the end of a period, this brings the stock accounts (37 goods, 31 raw materials) to the value of the stock at weighted average cost, through the stock variation accounts.")}</p>
                <DatePicker value={variationDate} onChange={(d) => d && setVariationDate(d)} format="DD/MM/YYYY" />
            </Modal>
        </>
    );
}

function EntryEditor({ entry, accounts, onClose, onSaved }: { entry: Entry | "new" | null; accounts: Account[]; onClose: () => void; onSaved: () => void }) {
    const { t, locale } = useAdminT();
    const [head, setHead] = useState<{ journal: Journal; date: Dayjs; label: string }>({ journal: "OD", date: dayjs(), label: "" });
    const [lines, setLines] = useState<{ account?: string; label: string; debit: number | null; credit: number | null }[]>([]);
    useEffect(() => {
        if (!entry) return;
        if (entry === "new") {
            setHead({ journal: "OD", date: dayjs(), label: "" });
            setLines([{ label: "", debit: null, credit: null }, { label: "", debit: null, credit: null }]);
        } else {
            setHead({ journal: entry.journal, date: dayjs(entry.entry_date), label: entry.label });
            setLines(entry.lines.map((l) => ({ account: l.account_code, label: l.label, debit: Number(l.debit) || null, credit: Number(l.credit) || null })));
        }
    }, [entry]);
    const debit = lines.reduce((s, l) => s + (l.debit ?? 0), 0);
    const credit = lines.reduce((s, l) => s + (l.credit ?? 0), 0);
    const balanced = Math.abs(debit - credit) < 0.0005 && debit > 0;
    const update = (i: number, patch: Partial<(typeof lines)[number]>) => setLines((list) => list.map((l, j) => (j === i ? { ...l, ...patch } : l)));

    const save = async () => {
        try {
            await api("/api/finance/accounting", {
                method: "POST",
                body: {
                    action: "save",
                    ...(entry && entry !== "new" ? { id: entry.id } : {}),
                    journal: head.journal,
                    entry_date: day(head.date),
                    label: head.label,
                    lines: lines.filter((l) => l.account && (l.debit || l.credit)).map((l) => ({ account: l.account, label: l.label || head.label, debit: l.debit ?? 0, credit: l.credit ?? 0 })),
                },
            });
            message.success(t("Entry saved as draft"));
            onSaved();
        } catch (e) {
            message.error(t((e as Error).message));
        }
    };

    return (
        <Modal open={!!entry} title={entry === "new" ? t("New entry") : t("Edit entry")} width={860} onCancel={onClose} onOk={save} okText={t("Save draft")} cancelText={t("Cancel")} okButtonProps={{ disabled: !balanced || !head.label }} forceRender>
            <Space wrap style={{ marginBottom: 12 }}>
                <Select value={head.journal} onChange={(journal) => setHead({ ...head, journal })} style={{ width: 170 }} options={JOURNALS.map((j) => ({ value: j, label: `${j} · ${t(JOURNAL_LABELS[j])}` }))} />
                <DatePicker value={head.date} onChange={(d) => d && setHead({ ...head, date: d })} format="DD/MM/YYYY" />
                <Input placeholder={t("Label")} value={head.label} onChange={(e) => setHead({ ...head, label: e.target.value })} style={{ width: 360 }} />
            </Space>
            {lines.map((l, i) => (
                <Space key={i} style={{ display: "flex", marginBottom: 6 }} wrap>
                    <Select showSearch optionFilterProp="label" placeholder={t("Account")} value={l.account} onChange={(account) => update(i, { account })} style={{ width: 260 }}
                        options={accounts.filter((a) => a.is_active).map((a) => ({ value: a.code, label: `${a.code} ${a.name}` }))} />
                    <Input placeholder={t("Label")} value={l.label} onChange={(e) => update(i, { label: e.target.value })} style={{ width: 220 }} />
                    <InputNumber placeholder={t("Debit")} min={0} precision={3} value={l.debit} onChange={(v) => update(i, { debit: v === null ? null : Number(v), credit: v ? null : l.credit })} style={{ width: 120 }} />
                    <InputNumber placeholder={t("Credit")} min={0} precision={3} value={l.credit} onChange={(v) => update(i, { credit: v === null ? null : Number(v), debit: v ? null : l.debit })} style={{ width: 120 }} />
                    <Button type="text" danger icon={<DeleteOutlined />} disabled={lines.length <= 2} onClick={() => setLines((list) => list.filter((_, j) => j !== i))} aria-label={t("Remove line")} />
                </Space>
            ))}
            <Button icon={<PlusOutlined />} onClick={() => setLines((list) => [...list, { label: "", debit: Math.max(0, credit - debit) || null, credit: Math.max(0, debit - credit) || null }])}>{t("Add line")}</Button>
            <div style={{ marginTop: 12 }}>
                {t("Debit")}: <b>{formatMoney(debit, locale)}</b> · {t("Credit")}: <b>{formatMoney(credit, locale)}</b> · {balanced ? <Tag color="green">{t("Balanced")}</Tag> : <Tag color="red">{t("Difference: {amount}", { amount: formatMoney(debit - credit, locale) })}</Tag>}
            </div>
        </Modal>
    );
}

function ReportsTab() {
    const { t, locale } = useAdminT();
    const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().startOf("year"), dayjs()]);
    const [report, setReport] = useState<"trial" | "income" | "balance" | "vat" | "ledger">("income");
    const [drafts, setDrafts] = useState(false);
    const [account, setAccount] = useState<string | undefined>();
    const accounts = useAccounts();
    const qs = `from=${day(range[0])}&to=${day(range[1])}${drafts ? "&drafts=1" : ""}`;
    const { data, loading } = useApi<any>(report === "ledger" && !account ? null : `/api/finance/reports?report=${report}&${qs}${report === "ledger" ? `&account=${account}` : ""}`);
    const money = (n: number) => formatMoney(n, locale);

    return (
        <Card>
            <Space wrap style={{ marginBottom: 16 }}>
                <Select value={report} onChange={setReport} style={{ width: 220 }} options={[
                    { value: "income", label: t("Income statement") },
                    { value: "balance", label: t("Balance sheet") },
                    { value: "trial", label: t("Trial balance") },
                    { value: "ledger", label: t("General ledger") },
                    { value: "vat", label: t("VAT") },
                ]} />
                <DatePicker.RangePicker value={range} onChange={(r) => r && r[0] && r[1] && setRange([r[0], r[1]])} format="DD/MM/YYYY" />
                {report === "ledger" && <Select showSearch optionFilterProp="label" placeholder={t("Account")} value={account} onChange={setAccount} style={{ width: 260 }} options={(accounts.data ?? []).map((a) => ({ value: a.code, label: `${a.code} ${a.name}` }))} />}
                <span><Switch size="small" checked={drafts} onChange={setDrafts} /> {t("Include drafts")}</span>
                <Button icon={<DownloadOutlined />} onClick={() => download(`/api/finance/reports?report=export&${qs}`)}>{t("Export entries (CSV)")}</Button>
            </Space>

            {report === "trial" && (
                <Table size="small" rowKey="account_code" loading={loading} dataSource={data?.rows ?? []} pagination={false} scroll={{ x: "max-content" }}
                    summary={() => data && (
                        <Table.Summary.Row>
                            <Table.Summary.Cell index={0} colSpan={3}><b>{t("Total")}</b></Table.Summary.Cell>
                            <Table.Summary.Cell index={3} align="right"><b>{money(data.totals.debit)}</b></Table.Summary.Cell>
                            <Table.Summary.Cell index={4} align="right"><b>{money(data.totals.credit)}</b></Table.Summary.Cell>
                            <Table.Summary.Cell index={5} />
                        </Table.Summary.Row>
                    )}
                    columns={[
                        { title: t("Account"), dataIndex: "account_code" },
                        { title: t("Name"), dataIndex: "account_name" },
                        { title: t("Opening balance"), dataIndex: "opening", align: "right", render: money },
                        { title: t("Debit"), dataIndex: "debit", align: "right", render: money },
                        { title: t("Credit"), dataIndex: "credit", align: "right", render: money },
                        { title: t("Closing balance"), dataIndex: "closing", align: "right", render: (v: number) => <b>{money(v)}</b> },
                    ]} />
            )}

            {report === "income" && data && (
                <Row gutter={[16, 16]}>
                    <Col xs={24} md={12}>
                        <Card size="small" title={t("Income")}>
                            {data.income.map((r: { code: string; name: string; amount: number }) => <ReportLine key={r.code} label={`${r.code} ${r.name}`} value={money(r.amount)} />)}
                            <ReportLine label={t("Total income")} value={money(data.total_income)} strong />
                        </Card>
                    </Col>
                    <Col xs={24} md={12}>
                        <Card size="small" title={t("Expenses")}>
                            {data.expenses.map((r: { code: string; name: string; amount: number }) => <ReportLine key={r.code} label={`${r.code} ${r.name}`} value={money(r.amount)} />)}
                            <ReportLine label={t("Total expenses")} value={money(data.total_expenses)} strong />
                        </Card>
                    </Col>
                    <Col xs={24}>
                        <Alert type={data.result >= 0 ? "success" : "error"} showIcon title={data.result >= 0 ? t("Profit: {amount}", { amount: money(data.result) }) : t("Loss: {amount}", { amount: money(-data.result) })} />
                    </Col>
                </Row>
            )}

            {report === "balance" && data && (
                <Row gutter={[16, 16]}>
                    <Col xs={24} md={12}>
                        <Card size="small" title={t("Assets")}>
                            {data.assets.map((r: { code: string; name: string; amount: number }) => <ReportLine key={r.code} label={`${r.code} ${r.name}`} value={money(r.amount)} />)}
                            <ReportLine label={t("Total assets")} value={money(data.total_assets)} strong />
                        </Card>
                    </Col>
                    <Col xs={24} md={12}>
                        <Card size="small" title={t("Equity and liabilities")}>
                            {data.liabilities.map((r: { code: string; name: string; amount: number }) => <ReportLine key={r.code} label={`${r.code} ${r.name}`} value={money(r.amount)} />)}
                            <ReportLine label={t("Result of the period")} value={money(data.result)} />
                            <ReportLine label={t("Total equity and liabilities")} value={money(data.total_liabilities_and_equity)} strong />
                        </Card>
                    </Col>
                    <Col xs={24}><Text type="secondary">{t("Balances at {date}, since the books started.", { date: formatDate(day(range[1]), locale) })}</Text></Col>
                </Row>
            )}

            {report === "vat" && (
                <Table size="small" rowKey="month" loading={loading} dataSource={data ?? []} pagination={false}
                    columns={[
                        { title: t("Month"), dataIndex: "month", render: (v: string) => dayjs(v).format("MM/YYYY") },
                        { title: t("VAT collected"), dataIndex: "collected", align: "right", render: money },
                        { title: t("VAT deductible"), dataIndex: "deductible", align: "right", render: money },
                        { title: t("VAT to pay"), dataIndex: "due", align: "right", render: (v: number) => <b style={{ color: v < 0 ? "#389e0d" : undefined }}>{v < 0 ? t("Credit {amount}", { amount: money(-v) }) : money(v)}</b> },
                    ]} />
            )}

            {report === "ledger" && (account ? (
                <>
                    <Descriptions size="small" style={{ marginBottom: 8 }}>
                        <Descriptions.Item label={t("Opening balance")}>{money(data?.opening ?? 0)}</Descriptions.Item>
                        <Descriptions.Item label={t("Closing balance")}>{money(data?.closing ?? 0)}</Descriptions.Item>
                    </Descriptions>
                    <Table size="small" rowKey="id" loading={loading} dataSource={data?.lines ?? []} pagination={{ pageSize: 100 }} scroll={{ x: "max-content" }}
                        columns={[
                            { title: t("Date"), key: "d", render: (_, l: any) => formatDate(l.entry.entry_date, locale) },
                            { title: t("Number"), key: "n", render: (_, l: any) => l.entry.number ?? <Tag color="orange">{t("Draft")}</Tag> },
                            { title: t("Label"), key: "l", render: (_, l: any) => `${l.label || l.entry.label}${l.partner_name ? ` · ${l.partner_name}` : ""}` },
                            { title: t("Debit"), dataIndex: "debit", align: "right", render: (v: number) => (Number(v) ? money(v) : "") },
                            { title: t("Credit"), dataIndex: "credit", align: "right", render: (v: number) => (Number(v) ? money(v) : "") },
                            { title: t("Balance"), dataIndex: "balance", align: "right", render: money },
                        ]} />
                </>
            ) : <Text type="secondary">{t("Choose an account.")}</Text>)}
        </Card>
    );
}

function ReportLine({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
    return (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "4px 0", borderTop: strong ? "1px solid #f0f0f0" : undefined, fontWeight: strong ? 600 : 400 }}>
            <span>{label}</span>
            <span style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{value}</span>
        </div>
    );
}

function AccountsTab() {
    const { t } = useAdminT();
    const { data, loading, reload } = useAccounts();
    const [editing, setEditing] = useState<Account | "new" | null>(null);
    const [form] = Form.useForm();
    const save = async () => {
        const values = await form.validateFields();
        try {
            await api("/api/finance/accounts", { method: editing === "new" ? "POST" : "PUT", body: values });
            setEditing(null);
            reload();
        } catch (e) {
            message.error(t((e as Error).message));
        }
    };
    const remove = async (code: string) => {
        try {
            await api(`/api/finance/accounts?code=${code}`, { method: "DELETE" });
            reload();
        } catch (e) {
            message.error(t((e as Error).message));
        }
    };
    return (
        <Card extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); form.setFieldsValue({ type: "expense", is_active: true }); setEditing("new"); }}>{t("New account")}</Button>}
            title={t("Accounts follow the Tunisian SCE structure. Have your accountant review them.")}>
            <Table size="small" rowKey="code" loading={loading} dataSource={data ?? []} pagination={false} scroll={{ x: "max-content" }}
                columns={[
                    { title: t("Code"), dataIndex: "code", render: (v: string) => <b>{v}</b> },
                    { title: t("Name"), dataIndex: "name", render: (v: string, r) => <span>{v}<div style={{ fontSize: 12, color: "#8c8c8c" }}>{[r.name_en, r.name_ar].filter(Boolean).join(" · ")}</div></span> },
                    { title: t("Class"), dataIndex: "class" },
                    { title: t("Type"), dataIndex: "type", render: (v: AccountType) => t(ACCOUNT_TYPE_LABELS[v]) },
                    { title: "", key: "s", render: (_, r) => <Space>{r.is_system && <Tag color="blue">{t("Used automatically")}</Tag>}{!r.is_active && <Tag>{t("Inactive")}</Tag>}</Space> },
                    {
                        title: "", key: "a", render: (_, r) => (
                            <Space>
                                <Button size="small" onClick={() => { form.resetFields(); form.setFieldsValue(r); setEditing(r); }}>{t("Edit")}</Button>
                                {!r.is_system && <Popconfirm title={t("Remove this account?")} onConfirm={() => remove(r.code)}><Button size="small" type="text" danger icon={<DeleteOutlined />} aria-label={t("Remove")} /></Popconfirm>}
                            </Space>
                        ),
                    },
                ]} />
            <Modal open={editing !== null} title={editing === "new" ? t("New account") : t("Edit account")} onCancel={() => setEditing(null)} onOk={save} okText={t("Save")} cancelText={t("Cancel")} forceRender>
                <Form form={form} layout="vertical">
                    <Form.Item name="code" label={t("Code")} rules={[{ required: true, pattern: /^[1-7][0-9A-Za-z]{0,9}$/, message: t("Codes start with the class (1-7)") }]}><Input disabled={editing !== "new"} /></Form.Item>
                    <Form.Item name="name" label={t("Name (French)")} rules={[{ required: true }]}><Input /></Form.Item>
                    <Form.Item name="name_en" label={t("Name (English)")}><Input /></Form.Item>
                    <Form.Item name="name_ar" label={t("Name (Arabic)")}><Input dir="rtl" /></Form.Item>
                    <Form.Item name="type" label={t("Type")}><Select options={ACCOUNT_TYPES.map((a) => ({ value: a, label: t(ACCOUNT_TYPE_LABELS[a]) }))} /></Form.Item>
                    <Form.Item name="is_active" label={t("Active")} valuePropName="checked"><Switch /></Form.Item>
                </Form>
            </Modal>
        </Card>
    );
}

const ACCOUNT_ROLES: [string, string][] = [
    ["customers", "Customers"], ["carrier", "Delivery company (cash on delivery)"], ["suppliers", "Suppliers"], ["cash", "Cash register"],
    ["bank", "Bank"], ["transfer", "Internal transfers"], ["sales", "Sales"], ["shipping_income", "Shipping charged"], ["vat_collected", "VAT collected"],
    ["vat_deductible", "VAT deductible"], ["stamp", "Stamp duty"], ["delivery_fees", "Delivery fees"], ["advertising", "Advertising"],
    ["stock", "Stock of goods"], ["stock_variation", "Change in stock of goods"], ["materials", "Raw materials"], ["materials_variation", "Change in raw materials"],
    ["owner", "Owner's account"], ["loan", "Loans"], ["other_income", "Other income"], ["other_expense", "Other expenses"],
];

function SettingsTab() {
    const { t } = useAdminT();
    const { isAdmin } = useAdminRole();
    const { data, loading, reload } = useApi<{ value: any }>("/api/finance/accounts?settings=1");
    const accounts = useAccounts();
    const [form] = Form.useForm();
    useEffect(() => {
        if (data?.value) form.setFieldsValue({ ...data.value, start_date: data.value.start_date ? dayjs(data.value.start_date) : null });
    }, [data, form]);

    const save = async () => {
        const values = await form.validateFields();
        try {
            await api("/api/finance/accounts", { method: "PATCH", body: { ...values, start_date: values.start_date ? day(values.start_date) : undefined } });
            message.success(t("Saved"));
            reload();
        } catch (e) {
            message.error(t((e as Error).message));
        }
    };

    return (
        <Card loading={loading} extra={<Button type="primary" onClick={save}>{t("Save")}</Button>}>
            <Form form={form} layout="vertical">
                <Row gutter={16}>
                    <Col xs={24} md={12}>
                        <Text strong>{t("Company (printed on invoices and receipts)")}</Text>
                        <Form.Item name={["company", "name"]} label={t("Name")}><Input /></Form.Item>
                        <Form.Item name={["company", "tax_id"]} label={t("Tax ID (matricule fiscal)")}><Input /></Form.Item>
                        <Form.Item name={["company", "rc"]} label={t("Trade register (RC)")}><Input /></Form.Item>
                        <Form.Item name={["company", "address"]} label={t("Address")}><Input /></Form.Item>
                        <Form.Item name={["company", "phone"]} label={t("Phone")}><Input /></Form.Item>
                        <Form.Item name={["company", "email"]} label={t("Email")}><Input /></Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                        <Text strong>{t("Rules")}</Text>
                        <Form.Item name="start_date" label={t("Books start on")} tooltip={t("Events before this date create no entries.")}><DatePicker format="DD/MM/YYYY" disabled={!isAdmin} style={{ width: "100%" }} /></Form.Item>
                        <Form.Item name="vat_registered" label={t("Subject to VAT")} valuePropName="checked"><Switch /></Form.Item>
                        <Form.Item name="sales_vat_rate" label={t("VAT rate included in shop prices (%)")}><InputNumber min={0} max={100} style={{ width: "100%" }} /></Form.Item>
                        <Form.Item name="invoice_stamp" label={t("Stamp duty added to invoices (TND)")} tooltip={t("Timbre fiscal, e.g. 1.000. Leave 0 if your accountant handles it otherwise.")}><InputNumber min={0} precision={3} style={{ width: "100%" }} /></Form.Item>
                        <Form.Item name="auto_post" label={t("Validate automatic entries immediately")} valuePropName="checked" tooltip={t("Off: they wait as drafts for the accountant to check.")}><Switch /></Form.Item>
                        <Text type="secondary">{t("Stock valuation: weighted average cost (CMUP).")}</Text>
                    </Col>
                    <Col xs={24}>
                        <Text strong style={{ display: "block", margin: "16px 0 8px" }}>{t("Accounts used by automatic entries")}</Text>
                        <Row gutter={12}>
                            {ACCOUNT_ROLES.map(([key, label]) => (
                                <Col xs={24} md={12} lg={8} key={key}>
                                    <Form.Item name={["accounts", key]} label={t(label)}>
                                        <Select showSearch optionFilterProp="label" options={(accounts.data ?? []).map((a) => ({ value: a.code, label: `${a.code} ${a.name}` }))} />
                                    </Form.Item>
                                </Col>
                            ))}
                        </Row>
                    </Col>
                </Row>
            </Form>
        </Card>
    );
}
