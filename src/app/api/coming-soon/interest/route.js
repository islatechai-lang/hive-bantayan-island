import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request) {
  try {
    const body = await request.json();
    const { productId, productName, userId, userName, userPhone, guestId, action = 'add' } = body;

    if (!productId) {
      return NextResponse.json({ success: false, error: 'Product ID is required' }, { status: 400 });
    }

    const voterId = userId || guestId;
    if (!voterId) {
      return NextResponse.json({ success: false, error: 'User or Guest ID is required' }, { status: 400 });
    }

    const interestDocId = `${productId}_${voterId}`;
    const interestRef = adminDb.collection('product_interests').doc(interestDocId);
    const productRef = adminDb.collection('products').doc(productId);

    if (action === 'remove') {
      const existingInterest = await interestRef.get();
      if (existingInterest.exists) {
        await interestRef.delete();
        await productRef.update({
          interestCount: FieldValue.increment(-1),
        }).catch(() => {});
      }
      return NextResponse.json({ success: true, wanted: false });
    } else {
      // Add interest / vote
      await interestRef.set({
        productId,
        productName: productName || productId,
        userId: userId || null,
        userName: userName || 'Anonymous Foodie',
        userPhone: userPhone || '',
        guestId: guestId || null,
        isGuest: !userId,
        createdAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      await productRef.set({
        interestCount: FieldValue.increment(1),
      }, { merge: true });

      return NextResponse.json({ success: true, wanted: true });
    }
  } catch (error) {
    console.error('Error handling product interest:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');

    let query = adminDb.collection('product_interests');
    if (productId) {
      query = query.where('productId', '==', productId);
    }

    const snapshot = await query.orderBy('createdAt', 'desc').limit(100).get();
    const interests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return NextResponse.json({ success: true, interests });
  } catch (error) {
    console.error('Error fetching product interests:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
