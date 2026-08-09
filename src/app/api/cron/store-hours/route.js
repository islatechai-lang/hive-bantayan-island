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

export async function GET(request) {
  return handleStoreHoursCron(request);
}

export async function POST(request) {
  return handleStoreHoursCron(request);
}

async function handleStoreHoursCron(request) {
  try {
    const { searchParams } = new URL(request.url);
    const forcedAction = searchParams.get('action'); // 'open' | 'close' | null

    // Get current Philippine Time (PHT: UTC+8)
    const nowPht = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    const currentHour = nowPht.getHours();
    const todayDateStr = nowPht.toISOString().split('T')[0]; // YYYY-MM-DD

    let actionToRun = forcedAction;
    if (!actionToRun) {
      if (currentHour >= 8 && currentHour < 12) {
        actionToRun = 'open';
      } else if (currentHour === 0 || currentHour >= 23) {
        actionToRun = 'close';
      } else {
        return NextResponse.json({
          message: `Current PHT hour is ${currentHour}:00. No scheduled open/close transition required.`,
          phtTime: nowPht.toLocaleString('en-US', { timeZone: 'Asia/Manila' })
        });
      }
    }

    const adminDb = getAdminDb();
    if (adminDb && !forcedAction) {
      const settingsRef = adminDb.collection('settings').doc('storeStatus');
      const docSnap = await settingsRef.get();
      const settingsData = docSnap.exists ? docSnap.data() : {};

      if (actionToRun === 'open' && settingsData.lastBroadcastOpenDate === todayDateStr) {
        return NextResponse.json({
          message: `Store OPEN broadcast already sent for today (${todayDateStr})`,
          alreadySent: true
        });
      }

      if (actionToRun === 'close' && settingsData.lastBroadcastCloseDate === todayDateStr) {
        return NextResponse.json({
          message: `Store CLOSED broadcast already sent for today (${todayDateStr})`,
          alreadySent: true
        });
      }

      // Update last broadcast date in Firestore
      if (actionToRun === 'open') {
        await settingsRef.set({ lastBroadcastOpenDate: todayDateStr, isOpen: true }, { merge: true });
      } else if (actionToRun === 'close') {
        await settingsRef.set({ lastBroadcastCloseDate: todayDateStr, isOpen: false }, { merge: true });
      }
    }

    let heading = '';
    let content = '';

    if (actionToRun === 'open') {
      heading = 'We are OPEN! 🛵🍰';
      content = 'Bantayan Hive is now open and accepting orders! Treat yourself to delicious Tiramisu & Milkshakes.';
    } else {
      heading = 'Store Closed 🌙';
      content = 'Bantayan Hive is now closed for the day. We re-open tomorrow at 8:00 AM!';
    }

    const pushResult = await sendPushNotification({
      heading,
      content,
      sendToAll: true,
      url: 'https://hive-bantayan-island.vercel.app',
    });

    console.log(`⏰ Automated Cron Broadcast [${actionToRun.toUpperCase()}]:`, pushResult);

    return NextResponse.json({
      success: true,
      action: actionToRun,
      todayDateStr,
      phtTime: nowPht.toLocaleString('en-US', { timeZone: 'Asia/Manila' }),
      pushResult,
    });
  } catch (error) {
    console.error('Store hours cron error:', error);
    return NextResponse.json({ error: error.message || String(error) }, { status: 500 });
  }
}
