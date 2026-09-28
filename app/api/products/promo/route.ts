import { NextResponse } from 'next/server';
import { getPromoProducts } from '@/lib/home-data';

export const dynamic = 'force-dynamic';

// Served from the Next.js data cache (tag "catalog", invalidated by admin edits).
export async function GET() {
    try {
        return NextResponse.json(await getPromoProducts());
    } catch {
        return NextResponse.json({ products: [] }, { status: 500 });
    }
}
