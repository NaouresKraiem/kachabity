"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { App, Layout, Menu, Typography, Button, ConfigProvider } from "antd";
import { AntdAppBridge } from "@/components/admin/antd-app";
import { installAdminFetchCache } from "@/components/admin/admin-fetch-cache";
import type { MenuProps } from "antd";
import {
    DashboardOutlined,
    ShoppingOutlined,
    PlusOutlined,
    UnorderedListOutlined,
    MenuFoldOutlined,
    MenuUnfoldOutlined,
    AppstoreOutlined,
    ShoppingCartOutlined,
    PercentageOutlined,
    PlayCircleOutlined,
    LogoutOutlined,
    InboxOutlined,
    HistoryOutlined,
    ReloadOutlined,
    SettingOutlined,
    TeamOutlined,
    DatabaseOutlined,
} from "@ant-design/icons";
import { antdTheme } from "@/lib/antd-config";
import { createAdminBrowserClient } from "@/lib/supabase-browser";
import { AdminRoleProvider, useAdminRole } from "@/lib/admin-role-context";
import type { Permission } from "@/lib/admin-auth";
import { AdminI18nProvider, msg, useAdminT } from "@/lib/admin-i18n";
import AdminLanguageSwitcher from "@/components/admin/AdminLanguageSwitcher";
import enUS from "antd/locale/en_US";
import frFR from "antd/locale/fr_FR";
import arEG from "antd/locale/ar_EG";

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

type MenuItem = Required<MenuProps>["items"][number];

const menuItems: MenuItem[] = [
    {
        key: "/admin/dashboard",
        icon: <DashboardOutlined />,
        label: msg("Dashboard"),
    },
    {
        key: "products",
        icon: <ShoppingOutlined />,
        label: msg("Products"),
        children: [
            {
                key: "/admin/products",
                icon: <UnorderedListOutlined />,
                label: msg("List"),
            },
            {
                key: "/admin/products/new",
                icon: <PlusOutlined />,
                label: msg("Create"),
            },
        ],
    },
    {
        key: "categories",
        icon: <AppstoreOutlined />,
        label: msg("Categories"),
        children: [
            {
                key: "/admin/categories",
                icon: <UnorderedListOutlined />,
                label: msg("List"),
            },
            {
                key: "/admin/categories/new",
                icon: <PlusOutlined />,
                label: msg("Create"),
            },
        ],
    },
    {
        key: "/admin/orders",
        icon: <ShoppingCartOutlined />,
        label: msg("Orders"),
    },
    {
        key: "stock",
        icon: <DatabaseOutlined />,
        label: msg("Stock"),
        children: [
            {
                key: "/admin/stock",
                icon: <InboxOutlined />,
                label: msg("Inventory"),
            },
            {
                key: "/admin/stock/movements",
                icon: <HistoryOutlined />,
                label: msg("Movements"),
            },
            {
                key: "/admin/stock/restock",
                icon: <ReloadOutlined />,
                label: msg("Restock"),
            },
            {
                key: "/admin/stock/settings",
                icon: <SettingOutlined />,
                label: msg("Settings"),
            },
        ],
    },
    {
        key: "/admin/promotions",
        icon: <PercentageOutlined />,
        label: msg("Product Discounts"),
    },
    {
        key: "/admin/sale-banners",
        icon: <PercentageOutlined />,
        label: msg("Sale Banners"),
    },
    {
        key: "/admin/reels",
        icon: <PlayCircleOutlined />,
        label: msg("Video Reels"),
    },
    {
        key: "/admin/variants",
        icon: <AppstoreOutlined />,
        label: msg("Variants"),
    },
    {
        key: "/admin/team",
        icon: <TeamOutlined />,
        label: msg("Team"),
    },
    // {
    //     key: "/admin/sales",
    //     icon: <TagOutlined />,
    //     label: msg("Sales"),
    // },
    // {
    //     key: "/admin/customers",
    //     icon: <UserOutlined />,
    //     label: msg("Customers"),
    // },
    // {
    //     key: "/admin/analytics",
    //     icon: <BarChartOutlined />,
    //     label: msg("Analytics"),
    // },
    // {
    //     key: "/admin/notifications",
    //     icon: <BellOutlined />,
    //     label: msg("Notifications"),
    // },
    // {
    //     key: "/admin/settings",
    //     icon: <SettingOutlined />,
    //     label: msg("Settings"),
    // },
];

// Page entries become real links: Next.js prefetches them, so clicking switches pages instantly.
// Labels are translated here, at render time.
function withLinks(items: MenuItem[], t: (text: string) => string): MenuItem[] {
    return items.map((item) => {
        if (!item || !("key" in item)) return item;
        const key = String(item.key);
        const children = "children" in item && item.children ? withLinks(item.children as MenuItem[], t) : undefined;
        const label = "label" in item && typeof item.label === "string" ? t(item.label) : null;
        return {
            ...item,
            label: key.startsWith("/") ? <Link href={key}>{label}</Link> : label,
            ...(children ? { children } : {}),
        } as MenuItem;
    });
}

// Installed at module load, before any admin page effect fetches its lookup lists.
installAdminFetchCache();

// Permission each menu entry needs (middleware applies the same rules to the pages themselves).
const MENU_PERMISSIONS: Record<string, Permission | "admin"> = {
    products: "products",
    categories: "products",
    "/admin/variants": "products",
    "/admin/orders": "orders",
    stock: "stock",
    "/admin/promotions": "discounts",
    "/admin/sale-banners": "marketing",
    "/admin/reels": "marketing",
    "/admin/team": "admin",
};

function menuFor(isAdmin: boolean, permissions: Permission[], t: (text: string) => string): MenuItem[] {
    const linkedMenuItems = withLinks(menuItems, t);
    if (isAdmin) return linkedMenuItems;
    return linkedMenuItems.filter((item) => {
        const needed = item && "key" in item ? MENU_PERMISSIONS[String(item.key)] : undefined;
        return !needed || (needed !== "admin" && permissions.includes(needed));
    });
}

const ANTD_LOCALES = { en: enUS, fr: frFR, ar: arEG };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    return (
        <AdminI18nProvider>
            <AdminConfig>
                {pathname === "/admin/login" ? (
                    children
                ) : (
                    <AdminRoleProvider>
                        <AdminShell>{children}</AdminShell>
                    </AdminRoleProvider>
                )}
            </AdminConfig>
        </AdminI18nProvider>
    );
}

// antd theme, its built-in texts (pagination, OK/Cancel, dates) and direction follow the admin language.
function AdminConfig({ children }: { children: React.ReactNode }) {
    const { locale, dir } = useAdminT();
    return (
        <ConfigProvider theme={antdTheme} locale={ANTD_LOCALES[locale]} direction={dir}>
            <App>
                <AntdAppBridge />
                <div dir={dir} lang={locale}>{children}</div>
            </App>
        </ConfigProvider>
    );
}

function AdminShell({ children }: { children: React.ReactNode }) {
    const { t } = useAdminT();
    const pathname = usePathname();
    const { role, email, isAdmin, permissions } = useAdminRole();
    const items = useMemo(() => menuFor(isAdmin, permissions, t), [isAdmin, permissions, t]);
    const router = useRouter();
    const [collapsed, setCollapsed] = useState(false);
    // Highlight the clicked entry immediately instead of waiting for navigation to finish.
    const [pendingKey, setPendingKey] = useState<string | null>(null);
    useEffect(() => setPendingKey(null), [pathname]);

    const selectedKeys = useMemo(() => [pendingKey ?? pathname], [pendingKey, pathname]);

    const openKeys = useMemo(() => {
        if (pathname?.startsWith("/admin/products")) {
            return ["products"];
        }
        if (pathname?.startsWith("/admin/categories")) {
            return ["categories"];
        }
        if (pathname?.startsWith("/admin/stock")) {
            return ["stock"];
        }
        return [];
    }, [pathname]);

    const handleMenuClick = ({ key }: { key: string }) => {
        if (key.startsWith("/")) {
            setPendingKey(key); // the <Link> in the label does the navigation
        } else if (key === "products") {
            // If clicking on "Products" parent, navigate to products list
            router.push("/admin/products");
        } else if (key === "categories") {
            // If clicking on "Categories" parent, navigate to categories list
            router.push("/admin/categories");
        } else if (key === "stock") {
            router.push("/admin/stock");
        }
    };

    const handleSignOut = async () => {
        await createAdminBrowserClient().auth.signOut();
        router.replace("/admin/login");
        router.refresh();
    };

    return (
            <Layout style={{ minHeight: "100vh" }}>
                <Sider
                    collapsible
                    collapsed={collapsed}
                    onCollapse={setCollapsed}
                    breakpoint="lg"
                    width={250}
                    theme="dark"
                    style={{
                        background: "#050f1f",
                    }}
                >
                    <div
                        style={{
                            height: 64,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: collapsed ? "center" : "flex-start",
                            paddingLeft: collapsed ? 0 : 24,
                            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                        }}
                    >
                        {collapsed ? (
                            <div
                                style={{
                                    width: 32,
                                    height: 32,
                                    background: "linear-gradient(135deg, #ff9f7b 0%, #a13c24 100%)",
                                    borderRadius: 8,
                                }}
                            />
                        ) : (
                            <div>
                                <Title level={4} style={{ margin: 0, color: "#fff", fontWeight: 600, letterSpacing: 0.5 }}>
                                    {t("Kachabity")}
                                </Title>
                                <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 12 }}>
                                    {t("Admin workspace")}
                                </div>
                            </div>
                        )}
                    </div>
                    <Menu
                        theme="dark"
                        mode="inline"
                        selectedKeys={selectedKeys}
                        openKeys={openKeys}
                        // Until permissions load, only unrestricted entries show, so nothing flashes and disappears.
                        items={items}
                        onClick={handleMenuClick}
                        onOpenChange={(keys) => {
                            // When submenu opens, if user clicked parent (not a child), navigate
                            const productsJustOpened = keys.includes("products") && !openKeys.includes("products");
                            const categoriesJustOpened = keys.includes("categories") && !openKeys.includes("categories");
                            const stockJustOpened = keys.includes("stock") && !openKeys.includes("stock");
                            if (stockJustOpened) {
                                setTimeout(() => {
                                    if (!pathname?.startsWith("/admin/stock")) router.push("/admin/stock");
                                }, 50);
                            }

                            if (productsJustOpened) {
                                // Small delay to check if a child was actually clicked
                                setTimeout(() => {
                                    // If we're still not on a products page, navigate to list
                                    if (pathname !== "/admin/products" && pathname !== "/admin/products/new") {
                                        router.push("/admin/products");
                                    }
                                }, 50);
                            }

                            if (categoriesJustOpened) {
                                // Small delay to check if a child was actually clicked
                                setTimeout(() => {
                                    // If we're still not on a categories page, navigate to list
                                    if (pathname !== "/admin/categories" && pathname !== "/admin/categories/new") {
                                        router.push("/admin/categories");
                                    }
                                }, 50);
                            }
                        }}
                        style={{
                            borderRight: 0,
                            height: "calc(100vh - 64px)",
                            background: "#050f1f",
                        }}
                    />
                </Sider>
                <Layout>
                    <Header
                        style={{
                            background: "#fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "0 24px",
                            boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                            height: 64,
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                            <Button
                                type="text"
                                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                                onClick={() => setCollapsed((prev) => !prev)}
                            />
                            <Title level={4} style={{ margin: 0, fontWeight: 600, color: "#1c1d27" }}>
                                {t("Admin Panel")}
                            </Title>
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <AdminLanguageSwitcher />
                            {role && (
                                <span style={{ color: "#6b7280", fontSize: 13, marginInlineEnd: 8 }}>
                                    {email} · {role === "admin" ? t("Admin") : t("Staff")}
                                </span>
                            )}
                            <Button type="primary" href="/" target="_blank" style={{ background: "#7a3b2e", borderColor: "#7a3b2e" }}>
                                {t("View Store")}
                            </Button>
                            <Button icon={<LogoutOutlined />} onClick={handleSignOut}>
                                {t("Sign out")}
                            </Button>
                        </div>
                    </Header>
                    <Content
                        style={{
                            padding: "32px 32px 48px",
                            background: "#f5f6fa",
                            minHeight: "calc(100vh - 64px)",
                        }}
                    >
                        <div style={{ maxWidth: 1320, margin: "0 auto" }}>{children}</div>
                    </Content>
                </Layout>
            </Layout>
    );
}




