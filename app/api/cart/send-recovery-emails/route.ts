/**
 * Abandoned Cart Recovery Email API
 * 
 * POST /api/cart/send-recovery-emails - Trigger batch sending of recovery emails
 */

import { NextResponse } from 'next/server';
import { triggerAbandonedCartCampaign } from '@/lib/abandoned-cart-email';
import { createClient } from '@/lib/supabaseClient';

// Simple admin check
async function isAdmin() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return false;

    // TODO: Implement proper role-based access control
    return true;
}

export async function POST() {
    try {
        // Check if user is admin
        const adminAccess = await isAdmin();
        if (!adminAccess) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

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
            { error: 'Failed to send recovery emails' },
            { status: 500 }
        );
    }
}

