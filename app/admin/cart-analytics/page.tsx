"use client";

/**
 * Admin Dashboard - Cart Analytics
 * 
 * This page displays:
 * - Cart conversion rates
 * - Abandoned cart statistics
 * - Revenue insights
 * - Popular products in carts
 */

import { useEffect, useState } from 'react';
import { Card, Statistic, Row, Col, Table, Spin, DatePicker, Button } from 'antd';
import {
    ShoppingCartOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    DollarOutlined,
    ReloadOutlined
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';

const { RangePicker } = DatePicker;

interface CartAnalytics {
    date: string;
    total_carts: number;
    converted_carts: number;
    abandoned_carts: number;
    avg_items_per_cart: number;
    avg_cart_value: number;
}

interface CartItem {
    product_id: string;
    quantity: number;
    price: number;
}

interface AbandonedCart {
    id: string;
    user_id: string;
    last_activity_at: string;
    item_count: number;
    estimated_value: number;
    items: CartItem[];
}

export default function CartAnalyticsPage() {
    const [analytics, setAnalytics] = useState<CartAnalytics[]>([]);
    const [abandonedCarts, setAbandonedCarts] = useState<AbandonedCart[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
        dayjs().subtract(30, 'days'),
        dayjs()
    ]);

    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            const days = dateRange[1].diff(dateRange[0], 'days');

            // Fetch cart analytics
            const analyticsRes = await fetch(`/api/cart/analytics?days=${days}`);
            const analyticsData = await analyticsRes.json();

            // Fetch abandoned carts
            const abandonedRes = await fetch('/api/cart/analytics?type=abandoned&limit=20');
            const abandonedData = await abandonedRes.json();

            if (analyticsData.success) {
                setAnalytics(analyticsData.data || []);
            }

            if (abandonedData.success) {
                setAbandonedCarts(abandonedData.data || []);
            }
        } catch (error) {
            console.error('Error fetching analytics:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAnalytics();
    }, [dateRange]);

    // Calculate summary statistics
    const totalCarts = analytics.reduce((sum, day) => sum + (day.total_carts || 0), 0);
    const totalConverted = analytics.reduce((sum, day) => sum + (day.converted_carts || 0), 0);
    const totalAbandoned = analytics.reduce((sum, day) => sum + (day.abandoned_carts || 0), 0);
    const conversionRate = totalCarts > 0 ? ((totalConverted / totalCarts) * 100).toFixed(2) : '0';
    const avgCartValue = analytics.length > 0
        ? (analytics.reduce((sum, day) => sum + (day.avg_cart_value || 0), 0) / analytics.length).toFixed(2)
        : '0';

    const abandonedRevenue = abandonedCarts.reduce((sum, cart) => sum + (cart.estimated_value || 0), 0);

    // Table columns for daily analytics
    const analyticsColumns = [
        {
            title: 'Date',
            dataIndex: 'date',
            key: 'date',
            render: (date: string) => dayjs(date).format('MMM DD, YYYY'),
        },
        {
            title: 'Total Carts',
            dataIndex: 'total_carts',
            key: 'total_carts',
            sorter: (a: CartAnalytics, b: CartAnalytics) => a.total_carts - b.total_carts,
        },
        {
            title: 'Converted',
            dataIndex: 'converted_carts',
            key: 'converted_carts',
            sorter: (a: CartAnalytics, b: CartAnalytics) => a.converted_carts - b.converted_carts,
        },
        {
            title: 'Abandoned',
            dataIndex: 'abandoned_carts',
            key: 'abandoned_carts',
            sorter: (a: CartAnalytics, b: CartAnalytics) => a.abandoned_carts - b.abandoned_carts,
        },
        {
            title: 'Conversion Rate',
            key: 'conversion_rate',
            render: (record: CartAnalytics) => {
                const rate = record.total_carts > 0
                    ? ((record.converted_carts / record.total_carts) * 100).toFixed(1)
                    : '0';
                return `${rate}%`;
            },
            sorter: (a: CartAnalytics, b: CartAnalytics) => {
                const rateA = a.total_carts > 0 ? (a.converted_carts / a.total_carts) : 0;
                const rateB = b.total_carts > 0 ? (b.converted_carts / b.total_carts) : 0;
                return rateA - rateB;
            },
        },
        {
            title: 'Avg Cart Value',
            dataIndex: 'avg_cart_value',
            key: 'avg_cart_value',
            render: (value: number) => `$${(value || 0).toFixed(2)}`,
            sorter: (a: CartAnalytics, b: CartAnalytics) => (a.avg_cart_value || 0) - (b.avg_cart_value || 0),
        },
    ];

    // Table columns for abandoned carts
    const abandonedColumns = [
        {
            title: 'Last Activity',
            dataIndex: 'last_activity_at',
            key: 'last_activity_at',
            render: (date: string) => dayjs(date).format('MMM DD, HH:mm'),
            sorter: (a: AbandonedCart, b: AbandonedCart) =>
                dayjs(a.last_activity_at).unix() - dayjs(b.last_activity_at).unix(),
        },
        {
            title: 'Items',
            dataIndex: 'item_count',
            key: 'item_count',
            sorter: (a: AbandonedCart, b: AbandonedCart) => a.item_count - b.item_count,
        },
        {
            title: 'Est. Value',
            dataIndex: 'estimated_value',
            key: 'estimated_value',
            render: (value: number) => `$${(value || 0).toFixed(2)}`,
            sorter: (a: AbandonedCart, b: AbandonedCart) =>
                (a.estimated_value || 0) - (b.estimated_value || 0),
        },
        {
            title: 'User ID',
            dataIndex: 'user_id',
            key: 'user_id',
            render: (userId: string) => userId ? userId.substring(0, 8) + '...' : 'Guest',
        },
        {
            title: 'Action',
            key: 'action',
            render: () => (
                <Button type="link" size="small">
                    Send Recovery Email
                </Button>
            ),
        },
    ];

    return (
        <div style={{ padding: '24px', background: '#f0f2f5', minHeight: '100vh' }}>
            <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
                <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h1 style={{ fontSize: '28px', fontWeight: 'bold', margin: 0 }}>
                        🛒 Cart Analytics Dashboard
                    </h1>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <RangePicker
                            value={dateRange}
                            onChange={(dates) => {
                                if (dates && dates[0] && dates[1]) {
                                    setDateRange([dates[0], dates[1]]);
                                }
                            }}
                        />
                        <Button
                            icon={<ReloadOutlined />}
                            onClick={fetchAnalytics}
                        >
                            Refresh
                        </Button>
                    </div>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '100px 0' }}>
                        <Spin size="large" />
                    </div>
                ) : (
                    <>
                        {/* Summary Cards */}
                        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
                            <Col xs={24} sm={12} lg={6}>
                                <Card>
                                    <Statistic
                                        title="Total Carts"
                                        value={totalCarts}
                                        prefix={<ShoppingCartOutlined />}
                                        valueStyle={{ color: '#1890ff' }}
                                    />
                                </Card>
                            </Col>
                            <Col xs={24} sm={12} lg={6}>
                                <Card>
                                    <Statistic
                                        title="Converted"
                                        value={totalConverted}
                                        prefix={<CheckCircleOutlined />}
                                        valueStyle={{ color: '#52c41a' }}
                                    />
                                </Card>
                            </Col>
                            <Col xs={24} sm={12} lg={6}>
                                <Card>
                                    <Statistic
                                        title="Conversion Rate"
                                        value={conversionRate}
                                        suffix="%"
                                        valueStyle={{ color: '#722ed1' }}
                                    />
                                </Card>
                            </Col>
                            <Col xs={24} sm={12} lg={6}>
                                <Card>
                                    <Statistic
                                        title="Avg Cart Value"
                                        value={avgCartValue}
                                        prefix="$"
                                        valueStyle={{ color: '#fa8c16' }}
                                    />
                                </Card>
                            </Col>
                        </Row>

                        {/* Abandoned Carts Summary */}
                        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
                            <Col xs={24} sm={12}>
                                <Card>
                                    <Statistic
                                        title="Abandoned Carts"
                                        value={totalAbandoned}
                                        prefix={<CloseCircleOutlined />}
                                        valueStyle={{ color: '#ff4d4f' }}
                                    />
                                </Card>
                            </Col>
                            <Col xs={24} sm={12}>
                                <Card>
                                    <Statistic
                                        title="Abandoned Revenue"
                                        value={abandonedRevenue.toFixed(2)}
                                        prefix={<DollarOutlined />}
                                        valueStyle={{ color: '#ff7a45' }}
                                    />
                                    <p style={{ marginTop: '8px', color: '#666', fontSize: '12px' }}>
                                        Potential revenue from abandoned carts
                                    </p>
                                </Card>
                            </Col>
                        </Row>

                        {/* Daily Analytics Table */}
                        <Card
                            title="📊 Daily Cart Statistics"
                            style={{ marginBottom: '24px' }}
                        >
                            <Table
                                dataSource={analytics}
                                columns={analyticsColumns}
                                rowKey="date"
                                pagination={{ pageSize: 10 }}
                            />
                        </Card>

                        {/* Abandoned Carts Table */}
                        <Card title="⚠️ Recent Abandoned Carts (Last 24 hours)">
                            <p style={{ marginBottom: '16px', color: '#666' }}>
                                These customers left items in their cart. Send them a recovery email to bring them back!
                            </p>
                            <Table
                                dataSource={abandonedCarts}
                                columns={abandonedColumns}
                                rowKey="id"
                                pagination={{ pageSize: 10 }}
                            />
                        </Card>
                    </>
                )}
            </div>
        </div>
    );
}

