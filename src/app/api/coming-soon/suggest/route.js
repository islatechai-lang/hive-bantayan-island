import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request) {
  try {
    const body = await request.json();
    const { title, category = 'shake', notes = '', userName = '', userPhone = '', userId = null, guestId = null } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ success: false, error: 'Suggestion title is required' }, { status: 400 });
    }

    const docRef = await adminDb.collection('suggestions').add({
      title: title.trim(),
      category,
      notes: notes.trim(),
      userName: userName.trim() || 'Anonymous Island Guest',
      userPhone: userPhone.trim(),
      userId: userId || null,
      guestId: guestId || null,
      isGuest: !userId,
      status: 'new', // new | reviewed | planned | archived
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, id: docRef.id });
  } catch (error) {
    console.error('Error creating suggestion:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(request) {
  try {
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
    console.error('Error fetching suggestions:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
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
