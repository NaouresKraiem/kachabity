import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { firstName, lastName, email, phone, message, locale } = body || {};

        if (!firstName || !lastName || !email || !message) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
            return NextResponse.json({ error: 'Email service not configured' }, { status: 500 });
        }

        // Create transporter with Gmail
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_APP_PASSWORD,
            },
        });

        const toEmail = process.env.CONTACT_TO_EMAIL || process.env.GMAIL_USER;
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

        await transporter.sendMail({
            from: process.env.GMAIL_USER,
            to: toEmail,
            subject: subjectByLocale[locale] || subjectByLocale.en,
            html,
        });

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error('Email error:', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}


