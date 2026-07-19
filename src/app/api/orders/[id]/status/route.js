import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { sendPushNotification } from '@/lib/onesignal';

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 });
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
        pushHeading = 'Driver Out for Delivery! 🛵';
        pushContent = 'Your cake/milkshake is on the way! Please keep your phone line open.';
        break;
      case 'delivered':
        pushHeading = 'Delivered successfully! Enjoy! 🍰';
        pushContent = 'Thank you for ordering with Hive Bantayan. Have a sweet day!';
        break;
      case 'cancelled':
        pushHeading = 'Order Cancelled';
        pushContent = 'Your order has been cancelled. Reach out if you have any questions.';
        break;
      default:
        pushContent = `Your order status changed to ${status}`;
    }

    try {
      // OneSignal Rest API push using customer's uid as target external alias id
      await sendPushNotification({
        heading: pushHeading,
        content: pushContent,
        externalUserIds: [orderData.userId],
        url: 'https://hive-bantayan-8598e.web.app/orders'
      });
      console.log(`Push notification sent to user: ${orderData.userId}`);
    } catch (pushError) {
      console.error('Failed to send push notification via OneSignal API:', pushError);
    }

    return NextResponse.json({ success: true, message: 'Status updated and notified' });
  } catch (error) {
    console.error('Update status API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
