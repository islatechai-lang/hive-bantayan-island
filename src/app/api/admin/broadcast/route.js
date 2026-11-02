import { NextResponse } from 'next/server';
import { sendPushNotification } from '@/lib/onesignal';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function getAdminDb() {
  const key = process.env.FIREBASE_PRIVATE_KEY;
  if (!key) return null;

  let cleaned = key.trim();
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.substring(1, cleaned.length - 1);
  }
  if (cleaned.startsWith("'") && cleaned.endsWith("'")) {
    cleaned = cleaned.substring(1, cleaned.length - 1);
  }
  cleaned = cleaned.replace(/\\n/g, '\n');

  const app = !getApps().length
    ? initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: cleaned,
        }),
      })
    : getApps()[0];

  return getFirestore(app);
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { type, heading: customHeading, content: customContent } = body;

    let heading = '';
    let content = '';

    if (type === 'restock') {
      heading = 'Fresh Stock Available! 🍰🥤';
      content = 'Our delicious Tiramisu & Milkshakes are freshly restocked! Place your order now!';
    } else if (type === 'open') {
      heading = 'We are OPEN! 🛵🍰';
      content = 'Bantayan Hive is now open and accepting orders! Treat yourself today.';
    } else if (type === 'closed') {
      heading = 'Store Closed 🌙';
      content = 'Bantayan Hive is now closed for the day. We re-open tomorrow at 8:00 AM!';
    } else if (type === 'custom') {
      heading = customHeading || 'Bantayan Hive Update 📣';
      content = customContent || 'Check out our latest menu items!';
    } else {
      return NextResponse.json({ error: 'Invalid broadcast type' }, { status: 400 });
    }

    // 1. Immediately update Firestore store_status if opening or closing
    if (type === 'open' || type === 'closed') {
      try {
        const adminDb = getAdminDb();
        if (adminDb) {
          const nowPht = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
          await adminDb.collection('products').doc('store_status').set({
            isOpen: type === 'open',
            lastAction: type,
            updatedAt: nowPht.toISOString(),
          }, { merge: true });
          console.log(`✅ [Broadcast API] products/store_status updated to isOpen: ${type === 'open'}`);
        }
      } catch (dbErr) {
        console.error('Error updating store_status in broadcast API:', dbErr);
      }
    }

    // 2. Dispatch OneSignal push notification
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
