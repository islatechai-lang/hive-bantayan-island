import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(request) {
  return handleCleanGhostUsers();
}

export async function POST(request) {
  return handleCleanGhostUsers();
}

async function handleCleanGhostUsers() {
  try {
    if (!adminDb) {
      return NextResponse.json({ error: 'Firebase Admin not configured' }, { status: 500 });
    }

    const usersSnap = await adminDb.collection('users').get();
    const batch = adminDb.batch();
    const deletedUsers = [];

    usersSnap.forEach((docSnap) => {
      const data = docSnap.data();
      // Identify ghost / anonymous users:
      // Real customers always have a phone number (e.g. +639153573191) from phone OTP login.
      // Ghost users created by admin/rider anonymous logins have phone === null or no phone.
      const isGhost = !data.phone || data.phone === null || data.name === 'Sweet Tooth Customer' && !data.phone;
      
      if (isGhost) {
        batch.delete(docSnap.ref);
        deletedUsers.push({
          uid: docSnap.id,
          name: data.name || 'Unknown',
          phone: data.phone || null,
          createdAt: data.createdAt || null
        });
      }
    });

    if (deletedUsers.length > 0) {
      await batch.commit();
      console.log(`🧹 Cleaned up ${deletedUsers.length} ghost/anonymous user doc(s) from database:`, deletedUsers);
    }

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${deletedUsers.length} ghost user record(s).`,
      cleanedCount: deletedUsers.length,
      deletedUsers
    });
  } catch (error) {
    console.error('Error cleaning ghost users:', error);
    return NextResponse.json({ error: error.message || 'Failed to clean ghost users' }, { status: 500 });
  }
}
