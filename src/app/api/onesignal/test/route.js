import { NextResponse } from 'next/server';
import { sendPushNotification } from '@/lib/onesignal';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { userId, sendToAll } = body;

    const heading = '⚡ Test Push Notification';
    const content = 'This is a test push notification from Bantayan Hive Admin!';

    let pushResult;

    if (sendToAll) {
      const rawKey = process.env.ONESIGNAL_API_KEY;
      const rawAppId = process.env.ONESIGNAL_APP_ID || process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;

      if (!rawKey || !rawAppId) {
        return NextResponse.json({
          error: 'ONESIGNAL_API_KEY or ONESIGNAL_APP_ID is missing in Vercel environment variables',
          envCheck: {
            hasAppId: !!rawAppId,
            hasApiKey: !!rawKey,
          }
        }, { status: 400 });
      }

      const apiKey = rawKey.trim();
      const appId = rawAppId.trim();

      const response = await fetch('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Authorization': `Key ${apiKey}`,
        },
        body: JSON.stringify({
          app_id: appId,
          included_segments: ['Subscribed Users'],
          headings: { en: heading },
          contents: { en: content },
          url: 'https://bantayan-hive-island.vercel.app',
        }),
      });

      const data = await response.json();
      pushResult = { status: response.status, ok: response.ok, data };
    } else {
      pushResult = await sendPushNotification({
        heading,
        content,
        externalUserIds: userId ? [userId] : undefined,
        url: 'https://bantayan-hive-island.vercel.app',
      });
    }

    return NextResponse.json({
      success: true,
      pushResult,
      envCheck: {
        hasAppId: !!(process.env.ONESIGNAL_APP_ID || process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID),
        hasApiKey: !!process.env.ONESIGNAL_API_KEY,
      }
    });
  } catch (error) {
    console.error('Test push error:', error);
    return NextResponse.json({ error: error.message || String(error) }, { status: 500 });
  }
}
