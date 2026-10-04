import { NextRequest, NextResponse } from 'next/server';
import supabase from '@/lib/supabase-admin';
import { getAdminActor } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

// POST sends the signed-in user a test notification (in the admin and on their PCs).
export async function POST(request: NextRequest) {
    const { userId } = getAdminActor(request.headers);
    if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const { error } = await supabase.from('notifications').insert({
        recipient_id: userId,
        kind: 'system',
        type: 'test',
        severity: 'info',
        title: { en: 'Notifications are working', fr: 'Les notifications fonctionnent', ar: 'الإشعارات تعمل' },
        body: {
            en: 'You will be notified here and on this computer.',
            fr: 'Vous serez averti ici et sur cet ordinateur.',
            ar: 'ستصلك الإشعارات هنا وعلى هذا الحاسوب.',
        },
        url: '/admin/notifications',
    });
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
