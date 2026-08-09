import { NextResponse } from 'next/server';
import { sendPushNotification } from '@/lib/onesignal';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { userId, sendToAll } = body;

    const heading = '⚡ Test Push Notification';
    const content = 'This is a test push notification from Bantayan Hive Admin!';

    const pushResult = await sendPushNotification({
      heading,
      content,
      externalUserIds: userId ? [userId] : undefined,
      sendToAll: sendToAll ?? true,
      url: 'https://bantayan-hive-island.vercel.app',
    });

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
