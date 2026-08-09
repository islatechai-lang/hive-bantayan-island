import { NextResponse } from 'next/server';
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
    const { orderId, gcashReceiptUrl } = await request.json();

    if (!orderId || !gcashReceiptUrl) {
      return NextResponse.json({ error: 'Missing orderId or receipt URL' }, { status: 400 });
    }

    // Update Firestore order document with attached receipt for manual Admin review
    const adminDb = getAdminDb();
    if (adminDb) {
      await adminDb.collection('orders').doc(orderId).update({
        gcashReceiptUrl,
        receiptUploadedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    return NextResponse.json({
      success: true,
      message: 'GCash receipt attached successfully for manual admin review',
      status: 'pending'
    });
  } catch (error) {
    console.error('Attach receipt error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
