import { NextRequest, NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';
import nodemailer from 'nodemailer';

export async function POST(request: NextRequest) {
    try {
        const { email } = await request.json();

        if (!email || !email.includes('@')) {
            return NextResponse.json(
                { error: 'Valid email is required' },
                { status: 400 }
            );
        }

        const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '';
        const userAgent = request.headers.get('user-agent') || '';
        const referrer = request.headers.get('referer') || '';

        const { data: existing } = await supabase
            .from('newsletter_subscribers')
            .select('email, status')
            .eq('email', email.toLowerCase())
            .single();

        if (existing) {
            if (existing.status === 'active') {
                return NextResponse.json(
                    { message: 'You are already subscribed to our newsletter' },
                    { status: 200 }
                );
            } else if (existing.status === 'unsubscribed') {
                const { error: updateError } = await supabase
                    .from('newsletter_subscribers')
                    .update({
                        status: 'active',
                        subscribed_at: new Date().toISOString(),
                        unsubscribed_at: null
                    })
                    .eq('email', email.toLowerCase());

                if (updateError) throw updateError;
            }
        } else {
            const { error: insertError } = await supabase
                .from('newsletter_subscribers')
                .insert({
                    email: email.toLowerCase(),
                    status: 'active',
                    ip_address: ip,
                    user_agent: userAgent,
                    referrer: referrer
                });

            if (insertError) throw insertError;
        }

        if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
            try {
                const transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        user: process.env.GMAIL_USER,
                        pass: process.env.GMAIL_APP_PASSWORD,
                    },
                });

                console.log('Gmail User:', process.env.GMAIL_USER);
                console.log('Sending welcome email to:', email);
                
                await transporter.sendMail({
                    from: process.env.GMAIL_USER,
                    to: email,
                    subject: 'Welcome to Kachabity Newsletter! 🎉',
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                            <h1 style="color: #842E1B; text-align: center;">Welcome to Kachabity! 🎉</h1>
                            <p style="font-size: 16px; color: #333; line-height: 1.6;">
                                Thank you for subscribing to our newsletter!
                            </p>
                            <p style="font-size: 16px; color: #333; line-height: 1.6;">
                                You'll now receive exclusive updates on:
                            </p>
                            <ul style="font-size: 16px; color: #333; line-height: 1.8;">
                                <li>New handcrafted products</li>
                                <li>Special discounts and promotions</li>
                                <li>Traditional Tunisian crafts stories</li>
                                <li>Early access to sales</li>
                            </ul>
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://kachabity.com'}" 
                                   style="background-color: #842E1B; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; display: inline-block;">
                                    Shop Now
                                </a>
                            </div>
                            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                            <p style="font-size: 12px; color: #999; text-align: center;">
                                Not interested anymore? 
                                <a href="${process.env.NEXT_PUBLIC_SITE_URL}/api/newsletter/unsubscribe?email=${email}" 
                                   style="color: #842E1B;">Unsubscribe</a>
                            </p>
                        </div>
                    `,
                });
            } catch (emailError) {
                console.error('Error sending welcome email:', emailError);
            }
        }

        return NextResponse.json(
            { message: 'Successfully subscribed to newsletter!' },
            { status: 200 }
        );

    } catch (error) {
        console.error('Newsletter subscription error:', error);
        return NextResponse.json(
            { error: 'Failed to subscribe. Please try again later.' },
            { status: 500 }
        );
    }
}

