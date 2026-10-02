/**
 * fetch for Supabase clients that retries when the connection could not be opened at all
 * (DNS failure, connect timeout, connection refused). In that case nothing reached Supabase,
 * so retrying is safe for writes too. Requests that did reach the server are never retried
 * here, so a write is never applied twice.
 *
 * Flaky networks (DNS hiccups, NAT64 routes timing out) otherwise surface as random
 * "TypeError: fetch failed" 500s in the admin and at checkout.
 */
const CONNECT_ERROR_CODES = new Set(['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'UND_ERR_CONNECT_TIMEOUT', 'ENETUNREACH', 'EHOSTUNREACH']);
const ATTEMPTS = 3;

function isConnectError(error: unknown): boolean {
    let cause = (error as { cause?: unknown })?.cause;
    for (let depth = 0; cause && depth < 4; depth++) {
        const code = (cause as { code?: string }).code;
        if (code && CONNECT_ERROR_CODES.has(code)) return true;
        cause = (cause as { cause?: unknown }).cause;
    }
    return false;
}

export const resilientFetch: typeof fetch = async (input, init) => {
    for (let attempt = 1; ; attempt++) {
        try {
            return await fetch(input, init);
        } catch (error) {
            if (attempt >= ATTEMPTS || !isConnectError(error) || init?.signal?.aborted) throw error;
            await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
        }
    }
};
