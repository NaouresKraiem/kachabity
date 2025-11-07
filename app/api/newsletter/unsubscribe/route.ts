import { NextRequest, NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const email = searchParams.get('email');

        if (!email) {
            return new NextResponse(
                `<html>
                    <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                        <h1 style="color: #842E1B;">Invalid Request</h1>
                        <p>No email address provided.</p>
                    </body>
                </html>`,
                { status: 400, headers: { 'Content-Type': 'text/html' } }
            );
        }

        const { error } = await supabase
            .from('newsletter_subscribers')
            .update({
                status: 'unsubscribed',
                unsubscribed_at: new Date().toISOString()
            })
            .eq('email', email.toLowerCase());

        if (error) throw error;

        return new NextResponse(
            `<html>
                <head>
                    <title>Unsubscribed - Kachabity</title>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            text-align: center;
                            padding: 50px;
                            background-color: #f9f9f9;
                        }
                        .container {
                            max-width: 600px;
                            margin: 0 auto;
                            background: white;
                            padding: 40px;
                            border-radius: 10px;
                            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                        }
                        h1 { color: #842E1B; margin-bottom: 20px; }
                        p { color: #666; line-height: 1.6; font-size: 16px; }
                        a {
                            display: inline-block;
                            margin-top: 20px;
                            padding: 12px 30px;
                            background-color: #842E1B;
                            color: white;
                            text-decoration: none;
                            border-radius: 8px;
                        }
                        a:hover { background-color: #6b2516; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>Successfully Unsubscribed 👋</h1>
                        <p>You have been unsubscribed from our newsletter.</p>
                        <p>We're sorry to see you go! If you change your mind, you can always resubscribe from our website.</p>
                        <a href="${process.env.NEXT_PUBLIC_SITE_URL || '/'}">Return to Kachabity</a>
                    </div>
                </body>
            </html>`,
            { status: 200, headers: { 'Content-Type': 'text/html' } }
        );

    } catch (error) {
        console.error('Newsletter unsubscribe error:', error);
        return new NextResponse(
            `<html>
                <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                    <h1 style="color: #842E1B;">Error</h1>
                    <p>Failed to unsubscribe. Please try again later.</p>
                </body>
            </html>`,
            { status: 500, headers: { 'Content-Type': 'text/html' } }
        );
    }
}

