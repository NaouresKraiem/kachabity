import { theme } from 'antd';

// Custom theme configuration that works with Tailwind
export const antdTheme = {
    algorithm: theme.defaultAlgorithm,
    token: {
        // Primary colors that match your brand
        colorPrimary: '#7a3b2e',
        colorSuccess: '#52c41a',
        colorWarning: '#faad14',
        colorError: '#ff4d4f',
        colorInfo: '#1890ff',

        // Typography
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: 14,

        // Border radius to match Tailwind
        borderRadius: 8,

        // Spacing
        padding: 16,
        margin: 16,
    },
    components: {
        // Customize specific components
        Select: {
            borderRadius: 8,
        },
        Dropdown: {
            borderRadius: 8,
        },
        Button: {
            borderRadius: 8,
        },
    },

};

// Export the theme for use in components
export default antdTheme;
