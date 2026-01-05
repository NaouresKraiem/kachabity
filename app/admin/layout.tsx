"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Layout, Menu, Typography, Button, ConfigProvider } from "antd";
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
} from "@ant-design/icons";
import { antdTheme } from "@/lib/antd-config";

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

type MenuItem = Required<MenuProps>["items"][number];

const menuItems: MenuItem[] = [
    {
        key: "/admin/dashboard",
        icon: <DashboardOutlined />,
        label: "Dashboard",
    },
    {
        key: "products",
        icon: <ShoppingOutlined />,
        label: "Products",
        children: [
            {
                key: "/admin/products",
                icon: <UnorderedListOutlined />,
                label: "List",
            },
            {
                key: "/admin/products/new",
                icon: <PlusOutlined />,
                label: "Create",
            },
        ],
    },
    {
        key: "categories",
        icon: <AppstoreOutlined />,
        label: "Categories",
        children: [
            {
                key: "/admin/categories",
                icon: <UnorderedListOutlined />,
                label: "List",
            },
            {
                key: "/admin/categories/new",
                icon: <PlusOutlined />,
                label: "Create",
            },
        ],
    },
    {
        key: "/admin/orders",
        icon: <ShoppingCartOutlined />,
        label: "Orders",
    },
    {
        key: "/admin/promotions",
        icon: <PercentageOutlined />,
        label: "Product Discounts",
    },
    {
        key: "/admin/sale-banners",
        icon: <PercentageOutlined />,
        label: "Sale Banners",
    },
    {
        key: "/admin/reels",
        icon: <PlayCircleOutlined />,
        label: "Video Reels",
    },
    {
        key: "/admin/variants",
        icon: <AppstoreOutlined />,
        label: "Variants",
    },
    // {
    //     key: "/admin/sales",
    //     icon: <TagOutlined />,
    //     label: "Sales",
    // },
    // {
    //     key: "/admin/customers",
    //     icon: <UserOutlined />,
    //     label: "Customers",
    // },
    // {
    //     key: "/admin/analytics",
    //     icon: <BarChartOutlined />,
    //     label: "Analytics",
    // },
    // {
    //     key: "/admin/notifications",
    //     icon: <BellOutlined />,
    //     label: "Notifications",
    // },
    // {
    //     key: "/admin/settings",
    //     icon: <SettingOutlined />,
    //     label: "Settings",
    // },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const [collapsed, setCollapsed] = useState(false);

    const selectedKeys = useMemo(() => {
        if (pathname === "/admin/products" || pathname.startsWith("/admin/products/")) {
            return [pathname];
        }
        if (pathname === "/admin/categories" || pathname.startsWith("/admin/categories/")) {
            return [pathname];
        }
        return [pathname];
    }, [pathname]);

    const openKeys = useMemo(() => {
        if (pathname?.startsWith("/admin/products")) {
            return ["products"];
        }
        if (pathname?.startsWith("/admin/categories")) {
            return ["categories"];
        }
        return [];
    }, [pathname]);

    const handleMenuClick = ({ key }: { key: string }) => {
        console.log("Menu clicked:", key);
        if (key.startsWith("/")) {
            router.push(key);
        } else if (key === "products") {
            // If clicking on "Products" parent, navigate to products list
            router.push("/admin/products");
        } else if (key === "categories") {
            // If clicking on "Categories" parent, navigate to categories list
            router.push("/admin/categories");
        }
    };

    return (
        <ConfigProvider theme={antdTheme}>
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
                                    Kachabity
                                </Title>
                                <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 12 }}>
                                    Admin workspace
                                </div>
                            </div>
                        )}
                    </div>
                    <Menu
                        theme="dark"
                        mode="inline"
                        selectedKeys={selectedKeys}
                        openKeys={openKeys}
                        items={menuItems}
                        onClick={handleMenuClick}
                        onOpenChange={(keys) => {
                            // When submenu opens, if user clicked parent (not a child), navigate
                            const productsJustOpened = keys.includes("products") && !openKeys.includes("products");
                            const categoriesJustOpened = keys.includes("categories") && !openKeys.includes("categories");

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
                                Admin Panel
                            </Title>
                        </div>
                        <Button type="primary" href="/" target="_blank" style={{ background: "#7a3b2e", borderColor: "#7a3b2e" }}>
                            View Store
                        </Button>
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
        </ConfigProvider>
    );
}




