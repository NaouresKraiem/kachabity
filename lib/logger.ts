// Development-only logging utility
// console.log statements won't appear in production builds

const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = {
    log: (...args: any[]) => {
        if (isDevelopment) {
            console.log(...args);
        }
    },

    error: (...args: any[]) => {
        if (isDevelopment) {
            console.error(...args);
        }
    },

    warn: (...args: any[]) => {
        if (isDevelopment) {
            console.warn(...args);
        }
    },

    info: (...args: any[]) => {
        if (isDevelopment) {
            console.info(...args);
        }
    },

    debug: (...args: any[]) => {
        if (isDevelopment) {
            console.debug(...args);
        }
    }
};

// Always log errors in production (for monitoring)
export const logError = (error: any, context?: string) => {
    if (context) {
        console.error(`[${context}]`, error);
    } else {
        console.error(error);
    }

    // In production, you could send errors to a monitoring service
    // Example: Sentry.captureException(error);
};

