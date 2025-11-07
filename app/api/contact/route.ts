import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { firstName, lastName, email, phone, message, locale } = body || {};

        if (!firstName || !lastName || !email || !message) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (!resend || !process.env.RESEND_FROM_EMAIL) {
            return NextResponse.json({ error: 'Email service not configured' }, { status: 500 });
        }

        const toEmail = process.env.CONTACT_TO_EMAIL || process.env.RESEND_FROM_EMAIL;
        const subjectByLocale: Record<string, string> = {
            en: 'New contact message',
            fr: 'Nouveau message de contact',
            ar: 'رسالة تواصل جديدة'
        };

        const html = `
            <div style="font-family: Arial, sans-serif;">
                <h2>${subjectByLocale[locale] || subjectByLocale.en}</h2>
                <p><strong>Name:</strong> ${firstName} ${lastName}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Phone:</strong> ${phone || '-'}
                <p><strong>Message:</strong></p>
                <p>${(message as string).replace(/\n/g, '<br/>')}</p>
            </div>
        `;

        const { error } = await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL!,
            to: toEmail!,
            subject: subjectByLocale[locale] || subjectByLocale.en,
            html
        });

        if (error) {
            return NextResponse.json({ error: error.message || 'Failed to send' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}


