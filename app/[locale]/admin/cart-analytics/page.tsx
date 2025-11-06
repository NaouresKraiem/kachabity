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
    const [days, setDays] = useState(30);

    const fetchAnalytics = async () => {
        setLoading(true);
        try {
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
    }, [days]);

    // Calculate summary statistics
    const totalCarts = analytics.reduce((sum, day) => sum + (day.total_carts || 0), 0);
    const totalConverted = analytics.reduce((sum, day) => sum + (day.converted_carts || 0), 0);
    const totalAbandoned = analytics.reduce((sum, day) => sum + (day.abandoned_carts || 0), 0);
    const conversionRate = totalCarts > 0 ? ((totalConverted / totalCarts) * 100).toFixed(1) : '0';
    const avgCartValue = analytics.length > 0
        ? (analytics.reduce((sum, day) => sum + (day.avg_cart_value || 0), 0) / analytics.length).toFixed(2)
        : '0';

    const abandonedRevenue = abandonedCarts.reduce((sum, cart) => sum + (cart.estimated_value || 0), 0);

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Sticky Header */}
            <div className="sticky top-0 z-50 bg-white shadow-md">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex justify-between items-center">
                        <h1 className="text-3xl font-bold text-gray-900">
                            🛒 Cart Analytics Dashboard
                        </h1>
                        <div className="flex gap-4 items-center">
                            <select
                                value={days}
                                onChange={(e) => setDays(Number(e.target.value))}
                                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value={7}>Last 7 days</option>
                                <option value={30}>Last 30 days</option>
                                <option value={90}>Last 90 days</option>
                            </select>
                            <button
                                onClick={fetchAnalytics}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                            >
                                🔄 Refresh
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto p-6">

                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    </div>
                ) : (
                    <>
                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                            {/* Total Carts */}
                            <div className="bg-white rounded-lg shadow p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-gray-500 text-sm">Total Carts</p>
                                        <p className="text-3xl font-bold text-blue-600 mt-2">{totalCarts}</p>
                                    </div>
                                    <div className="text-4xl">🛒</div>
                                </div>
                            </div>

                            {/* Converted */}
                            <div className="bg-white rounded-lg shadow p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-gray-500 text-sm">Converted</p>
                                        <p className="text-3xl font-bold text-green-600 mt-2">{totalConverted}</p>
                                    </div>
                                    <div className="text-4xl">✅</div>
                                </div>
                            </div>

                            {/* Conversion Rate */}
                            <div className="bg-white rounded-lg shadow p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-gray-500 text-sm">Conversion Rate</p>
                                        <p className="text-3xl font-bold text-purple-600 mt-2">{conversionRate}%</p>
                                    </div>
                                    <div className="text-4xl">📈</div>
                                </div>
                            </div>

                            {/* Avg Cart Value */}
                            <div className="bg-white rounded-lg shadow p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-gray-500 text-sm">Avg Cart Value</p>
                                        <p className="text-3xl font-bold text-orange-600 mt-2">${avgCartValue}</p>
                                    </div>
                                    <div className="text-4xl">💰</div>
                                </div>
                            </div>
                        </div>

                        {/* Abandoned Carts Summary */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                            <div className="bg-white rounded-lg shadow p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-gray-500 text-sm">Abandoned Carts</p>
                                        <p className="text-3xl font-bold text-red-600 mt-2">{totalAbandoned}</p>
                                    </div>
                                    <div className="text-4xl">⚠️</div>
                                </div>
                            </div>

                            <div className="bg-white rounded-lg shadow p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-gray-500 text-sm">Abandoned Revenue</p>
                                        <p className="text-3xl font-bold text-orange-500 mt-2">${abandonedRevenue.toFixed(2)}</p>
                                        <p className="text-xs text-gray-500 mt-1">Potential revenue from abandoned carts</p>
                                    </div>
                                    <div className="text-4xl">💵</div>
                                </div>
                            </div>
                        </div>

                        {/* Daily Analytics Table */}
                        <div className="bg-white rounded-lg shadow mb-8">
                            <div className="px-6 py-4 border-b border-gray-200">
                                <h2 className="text-xl font-semibold text-gray-900">📊 Daily Cart Statistics</h2>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Date
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Total Carts
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Converted
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Abandoned
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Conversion Rate
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Avg Cart Value
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {analytics.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                                    No data available yet. Add some items to cart and complete a checkout to see analytics!
                                                </td>
                                            </tr>
                                        ) : (
                                            analytics.map((row, index) => {
                                                const rate = row.total_carts > 0
                                                    ? ((row.converted_carts / row.total_carts) * 100).toFixed(1)
                                                    : '0';
                                                return (
                                                    <tr key={index} className="hover:bg-gray-50">
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                            {formatDate(row.date)}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                            {row.total_carts}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                                                            {row.converted_carts}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">
                                                            {row.abandoned_carts}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-purple-600 font-medium">
                                                            {rate}%
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                            ${(row.avg_cart_value || 0).toFixed(2)}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Abandoned Carts Table */}
                        <div className="bg-white rounded-lg shadow">
                            <div className="px-6 py-4 border-b border-gray-200">
                                <h2 className="text-xl font-semibold text-gray-900">⚠️ Recent Abandoned Carts</h2>
                                <p className="text-sm text-gray-500 mt-1">
                                    These customers left items in their cart. Send them a recovery email to bring them back!
                                </p>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Last Activity
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Items
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Est. Value
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                User ID
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Action
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {abandonedCarts.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                                    No abandoned carts yet. Great job! 🎉
                                                </td>
                                            </tr>
                                        ) : (
                                            abandonedCarts.map((cart) => (
                                                <tr key={cart.id} className="hover:bg-gray-50">
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                        {formatTime(cart.last_activity_at)}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                        {cart.item_count}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-orange-600">
                                                        ${(cart.estimated_value || 0).toFixed(2)}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        {cart.user_id ? cart.user_id.substring(0, 8) + '...' : 'Guest'}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                        <button className="text-blue-600 hover:text-blue-800 font-medium">
                                                            📧 Send Recovery Email
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
