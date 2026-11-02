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

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    const adminDb = getAdminDb();
    if (!adminDb) {
      return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 });
    }

    const orderRef = adminDb.collection('orders').doc(id);
    const docSnap = await orderRef.get();

    if (!docSnap.exists) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const orderData = docSnap.data();

    // Safety check: Only allow deleting orders that are already completed ('delivered') or 'cancelled'
    const allowedStatuses = ['delivered', 'cancelled'];
    if (!allowedStatuses.includes(orderData.status)) {
      return NextResponse.json(
        { error: `Cannot delete an active order with status "${orderData.status}". Only delivered or cancelled orders can be removed.` },
        { status: 400 }
      );
    }

    await orderRef.delete();
    console.log(`🗑️ [Admin] Order #${id.slice(-6).toUpperCase()} permanently deleted from database.`);

    return NextResponse.json({
      success: true,
      message: `Order #${id.slice(-6).toUpperCase()} removed successfully.`,
      id
    });
  } catch (error) {
    console.error('Error deleting order:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete order' }, { status: 500 });
  }
}
