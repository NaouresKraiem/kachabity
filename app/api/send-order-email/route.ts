import { NextRequest, NextResponse } from 'next/server';
import { sendOrderConfirmationEmail } from '@/lib/order-confirmation-email';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { order, orderItems, customerName } = body;

        if (!order || !orderItems || !customerName) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        const result = await sendOrderConfirmationEmail({
            order,
            orderItems,
            customerName
        });

        if (!result.success) {
            return NextResponse.json(
                { error: 'Failed to send email', details: result.error },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true, data: result.data });
    } catch (error) {
        console.error('Error in send-order-email API:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

