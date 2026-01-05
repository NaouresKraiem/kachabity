/**
 * Abandoned Cart Recovery Email API
 * 
 * POST /api/cart/send-recovery-emails - Trigger batch sending of recovery emails
 */

import { NextRequest, NextResponse } from 'next/server';
import { triggerAbandonedCartCampaign } from '@/lib/abandoned-cart-email';

export async function POST(request: NextRequest) {
    try {
        // Trigger the abandoned cart email campaign
        const result = await triggerAbandonedCartCampaign();

        return NextResponse.json({
            success: true,
            message: `Sent ${result.sent} emails, ${result.failed} failed`,
            sent: result.sent,
            failed: result.failed,
        });
    } catch (error) {
        console.error('Error sending recovery emails:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to send recovery emails' },
            { status: 500 }
        );
    }
}

