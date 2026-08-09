import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { sendPushNotification } from '@/lib/onesignal';

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

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 });
    }

    const adminDb = getAdminDb();
    if (!adminDb) {
      return NextResponse.json({ error: 'Firebase Admin not configured' }, { status: 500 });
    }

    const orderRef = adminDb.collection('orders').doc(id);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const orderData = orderDoc.data();

    // Update Firestore
    await orderRef.update({
      status,
      updatedAt: new Date().toISOString()
    });

    // Notify customer via OneSignal
    let pushHeading = 'Order Update';
    let pushContent = '';

    switch (status) {
      case 'confirmed':
        pushHeading = 'Order Confirmed! 🎉';
        pushContent = `Hi ${orderData.userName}, your order has been accepted and is confirmed.`;
        break;
      case 'preparing':
        pushHeading = 'Preparing Your Sweet Treats! 👩‍🍳';
        pushContent = 'Our chefs are crafting your delicious order right now.';
        break;
      case 'out_for_delivery':
        pushHeading = 'Out for Delivery 🛵';
        pushContent = 'Your order is on the way! Please keep your phone line open.';
        break;
      case 'delivered':
        pushHeading = 'Delivered successfully! Enjoy! 🍰';
        pushContent = 'Thank you for ordering with Bantayan Hive. Have a sweet day!';
        break;
      case 'cancelled':
        pushHeading = 'Order Cancelled';
        pushContent = 'Your order has been cancelled. Reach out if you have any questions.';
        break;
      default:
        pushContent = `Your order status changed to ${status}`;
    }

    let pushResult = null;
    let pushErrorDetails = null;

    if (orderData.userId) {
      try {
        pushResult = await sendPushNotification({
          heading: pushHeading,
          content: pushContent,
          externalUserIds: [orderData.userId],
          url: `https://hive-bantayan-island.vercel.app/order-success/${id}`
        });
        console.log(`Push notification sent to user: ${orderData.userId}`, pushResult);
      } catch (pushError) {
        console.error('Failed to send push notification via OneSignal API:', pushError);
        pushErrorDetails = pushError.message || String(pushError);
      }
    } else {
      pushErrorDetails = 'Order document has no userId field';
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Status updated',
      targetUserId: orderData.userId || null,
      pushResult,
      pushError: pushErrorDetails
    });
  } catch (error) {
    console.error('Update status API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
