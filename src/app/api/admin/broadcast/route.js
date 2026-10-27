import { NextResponse } from 'next/server';
import { sendPushNotification } from '@/lib/onesignal';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(request) {
  try {
    const body = await request.json();
    const { type, heading: customHeading, content: customContent } = body;

    let heading = '';
    let content = '';

    if (type === 'restock') {
      heading = 'Fresh Stock Available! 🍰🥤';
      content = 'Our delicious Tiramisu & Milkshakes are freshly restocked! Place your order now!';
    } else if (type === 'open') {
      heading = 'We are OPEN! 🛵🍰';
      content = 'Bantayan Hive is now open and accepting orders! Treat yourself today.';

      if (adminDb) {
        await adminDb.collection('settings').doc('storeStatus').set({
          isOpen: true,
          lastAction: 'open',
          updatedAt: new Date(),
        }, { merge: true });
      }
    } else if (type === 'closed') {
      heading = 'Store Closed 🌙';
      content = 'Bantayan Hive is now closed for the day. We re-open tomorrow at 8:00 AM!';

      if (adminDb) {
        await adminDb.collection('settings').doc('storeStatus').set({
          isOpen: false,
          lastAction: 'closed',
          updatedAt: new Date(),
        }, { merge: true });
      }
    } else if (type === 'custom') {
      heading = customHeading || 'Bantayan Hive Update 📣';
      content = customContent || 'Check out our latest menu items!';
    } else {
      return NextResponse.json({ error: 'Invalid broadcast type' }, { status: 400 });
    }

    const pushResult = await sendPushNotification({
      heading,
      content,
      sendToAll: true,
      url: 'https://hive-bantayan-island.vercel.app',
    });

    console.log(`📢 Broadcast [${type}] sent to all users:`, pushResult);

    return NextResponse.json({
      success: true,
      type,
      heading,
      content,
      pushResult,
    });
  } catch (error) {
    console.error('Broadcast API error:', error);
    return NextResponse.json({ error: error.message || String(error) }, { status: 500 });
  }
}
