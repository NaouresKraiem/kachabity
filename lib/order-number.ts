import { randomBytes } from 'crypto';

/** Order numbers like ORD-MUV8AZRW-EE0B0878: a base-36 timestamp and 4 random bytes. Server-only. */
export function generateOrderNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = randomBytes(4).toString('hex').toUpperCase();
    return `ORD-${timestamp}-${random}`;
}
