"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Card, Col, Row } from "antd";
import { BankOutlined, CheckSquareOutlined, ContactsOutlined, FundOutlined, PlusOutlined, ShopOutlined, ShoppingOutlined } from "@ant-design/icons";
import { useAdminT } from "@/lib/admin-i18n";
import { useAdminRole } from "@/lib/admin-role-context";

/** Shortcuts at the top of the dashboard, for what each person can do. */
export default function QuickLinks() {
    const { t } = useAdminT();
    const { can, isOwner, loading } = useAdminRole();
    if (loading) return null;
    const links: { href: string; icon: ReactNode; title: string; text: string; show: boolean }[] = [
        { href: "/admin/overview", icon: <FundOutlined />, title: t("Business overview"), text: t("Sales, margins, cash and debts"), show: isOwner },
        { href: "/admin/my-work", icon: <CheckSquareOutlined />, title: t("My day"), text: t("Orders to confirm and follow-ups"), show: can("orders") || can("customers") },
        { href: "/admin/orders/new", icon: <PlusOutlined />, title: t("New order"), text: t("Facebook, Instagram, WhatsApp, phone"), show: can("orders") },
        { href: "/admin/customers", icon: <ContactsOutlined />, title: t("Customers"), text: t("Pipeline and conversations"), show: can("customers") },
        { href: "/admin/pos", icon: <ShopOutlined />, title: t("Point of sale"), text: t("Sell in the shop"), show: can("pos") },
        { href: "/admin/purchasing", icon: <ShoppingOutlined />, title: t("Purchase orders"), text: t("Buy and receive goods"), show: can("purchasing") },
        { href: "/admin/finance/treasury", icon: <BankOutlined />, title: t("Cash & bank"), text: t("Money in and out"), show: can("finance") },
    ];
    const shown = links.filter((l) => l.show);
    if (!shown.length) return null;
    return (
        <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
            {shown.map((l) => (
                <Col key={l.href} xs={12} md={8} xl={Math.max(4, Math.floor(24 / shown.length))}>
                    <Link href={l.href}>
                        <Card hoverable size="small" style={{ height: "100%" }}>
                            <div style={{ fontSize: 20, color: "#7a3b2e" }}>{l.icon}</div>
                            <div style={{ fontWeight: 600, marginTop: 4 }}>{l.title}</div>
                            <div style={{ fontSize: 12, color: "#8c8c8c" }}>{l.text}</div>
                        </Card>
                    </Link>
                </Col>
            ))}
        </Row>
    );
}
