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
    const forceBroadcast = searchParams.get('forceBroadcast') === 'true';

    // Get current Philippine Time (PHT: UTC+8)
    const nowPht = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    const currentHour = nowPht.getHours();
    const todayDateStr = `${nowPht.getFullYear()}-${String(nowPht.getMonth() + 1).padStart(2, '0')}-${String(nowPht.getDate()).padStart(2, '0')}`;

    const adminDb = getAdminDb();
    if (!adminDb) {
      return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 });
    }

    // Reference to products/store_status (the source of truth for cart and admin)
    const storeStatusRef = adminDb.collection('products').doc('store_status');
    const storeStatusSnap = await storeStatusRef.get();
    const storeStatusData = storeStatusSnap.exists ? storeStatusSnap.data() : { isOpen: true };

    // Reference to settings/storeStatus (tracking broadcast dates to avoid duplicate spam)
    const broadcastSettingsRef = adminDb.collection('settings').doc('storeStatus');
    const broadcastSettingsSnap = await broadcastSettingsRef.get();
    const broadcastData = broadcastSettingsSnap.exists ? broadcastSettingsSnap.data() : {};

    let actionToRun = forcedAction;

    if (!actionToRun) {
      // Automatic reconciliation based on schedule (8:00 AM to 12:00 AM PHT)
      if (currentHour >= 8 && currentHour < 24) {
        // Scheduled: OPEN
        // If currently marked closed in Firestore, check if that close was from yesterday/prior to today's 8 AM
        if (!storeStatusData.isOpen) {
          const lastUpdated = storeStatusData.updatedAt ? new Date(storeStatusData.updatedAt) : null;
          let isFromPriorDayOrMorning = true;
          if (lastUpdated) {
            const lastUpdatedPht = new Date(lastUpdated.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
            const lastUpdatedDateStr = `${lastUpdatedPht.getFullYear()}-${String(lastUpdatedPht.getMonth() + 1).padStart(2, '0')}-${String(lastUpdatedPht.getDate()).padStart(2, '0')}`;
            // If updated today but before 8:00 AM, or updated on a previous date:
            if (lastUpdatedDateStr === todayDateStr && lastUpdatedPht.getHours() >= 8) {
              isFromPriorDayOrMorning = false;
            }
          }

          if (isFromPriorDayOrMorning) {
            actionToRun = 'open';
          }
        }
      } else {
        // Scheduled: CLOSED (between 12:00 AM midnight and 7:59 AM)
        // Only auto-close if the store was left open from yesterday before midnight
        if (storeStatusData.isOpen) {
          const lastUpdated = storeStatusData.updatedAt ? new Date(storeStatusData.updatedAt) : null;
          let isLeftOpenFromYesterday = false;
          if (lastUpdated) {
            const lastUpdatedPht = new Date(lastUpdated.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
            const lastUpdatedDateStr = `${lastUpdatedPht.getFullYear()}-${String(lastUpdatedPht.getMonth() + 1).padStart(2, '0')}-${String(lastUpdatedPht.getDate()).padStart(2, '0')}`;
            // If it was opened on a previous day, auto-close for the night
            if (lastUpdatedDateStr !== todayDateStr) {
              isLeftOpenFromYesterday = true;
            }
          }
          if (isLeftOpenFromYesterday) {
            actionToRun = 'close';
          }
        }
      }
    }

    if (!actionToRun) {
      return NextResponse.json({
        message: `Store status is already up to date for PHT hour ${currentHour}:00 (isOpen: ${storeStatusData.isOpen}).`,
        phtTime: nowPht.toLocaleString('en-US', { timeZone: 'Asia/Manila' }),
        isOpen: storeStatusData.isOpen
      });
    }

    const nextIsOpen = actionToRun === 'open';

    // 1. ALWAYS update products/store_status in Firestore
    await storeStatusRef.set({
      isOpen: nextIsOpen,
      lastAction: actionToRun,
      updatedAt: nowPht.toISOString()
    }, { merge: true });

    console.log(`🕒 Store Status synced to [${nextIsOpen ? 'OPEN' : 'CLOSED'}] via cron/reconcile.`);

    // 2. Check if broadcast push notification was already sent today for this action
    let pushResult = null;
    let pushSent = false;

    const alreadySentToday = actionToRun === 'open' 
      ? broadcastData.lastBroadcastOpenDate === todayDateStr
      : broadcastData.lastBroadcastCloseDate === todayDateStr;

    if (!alreadySentToday || forceBroadcast) {
      let heading = '';
      let content = '';

      if (actionToRun === 'open') {
        heading = 'We are OPEN! 🛵🍰';
        content = 'Bantayan Hive is now open and accepting orders! Treat yourself to delicious Tiramisu & Milkshakes.';
      } else {
        heading = 'Store Closed 🌙';
        content = 'Bantayan Hive is now closed for the day. We re-open tomorrow at 8:00 AM!';
      }

      pushResult = await sendPushNotification({
        heading,
        content,
        sendToAll: true,
        url: 'https://hive-bantayan-island.vercel.app',
      });

      pushSent = true;
      console.log(`📢 Push Notification sent [${actionToRun.toUpperCase()}]:`, pushResult);

      // Record broadcast date
      if (actionToRun === 'open') {
        await broadcastSettingsRef.set({ lastBroadcastOpenDate: todayDateStr, isOpen: true }, { merge: true });
      } else {
        await broadcastSettingsRef.set({ lastBroadcastCloseDate: todayDateStr, isOpen: false }, { merge: true });
      }
    } else {
      console.log(`ℹ️ [Store Hours] Push alert for [${actionToRun.toUpperCase()}] already sent for ${todayDateStr}.`);
    }

    return NextResponse.json({
      success: true,
      action: actionToRun,
      isOpen: nextIsOpen,
      todayDateStr,
      phtTime: nowPht.toLocaleString('en-US', { timeZone: 'Asia/Manila' }),
      pushSent,
      pushResult
    });
  } catch (error) {
    console.error('Store hours cron error:', error);
    return NextResponse.json({ error: error.message || String(error) }, { status: 500 });
  }
}
