import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request) {
  try {
    const body = await request.json();
    const { title, category = 'request', notes = '', userName = '', userPhone = '', userId = null, guestId = null } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ success: false, error: 'Item name is required' }, { status: 400 });
    }

    if (!adminDb) {
      // If adminDb is not initialized, return success: false with clear message so client can handle
      return NextResponse.json({ 
        success: false, 
        error: 'Database admin service not configured' 
      }, { status: 503 });
    }

    const docRef = await adminDb.collection('suggestions').add({
      title: title.trim(),
      category,
      notes: notes.trim(),
      userName: userName.trim() || 'Customer',
      userPhone: userPhone.trim(),
      userId: userId || null,
      guestId: guestId || null,
      isGuest: !userId,
      status: 'new',
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, id: docRef.id });
  } catch (error) {
    console.error('Error creating suggestion in API:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    if (!adminDb) {
      return NextResponse.json({ success: true, suggestions: [] });
    }

    const snapshot = await adminDb
      .collection('suggestions')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();

    const suggestions = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
      };
    });

    return NextResponse.json({ success: true, suggestions });
  } catch (error) {
    console.error('Error fetching suggestions in API:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    if (!adminDb) {
      return NextResponse.json({ success: false, error: 'Database admin service not configured' }, { status: 503 });
    }

    const body = await request.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json({ success: false, error: 'ID and status are required' }, { status: 400 });
    }

    await adminDb.collection('suggestions').doc(id).update({
      status,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating suggestion:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    if (!adminDb) {
      return NextResponse.json({ success: false, error: 'Database admin service not configured' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
    }

    await adminDb.collection('suggestions').doc(id).delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting suggestion:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
