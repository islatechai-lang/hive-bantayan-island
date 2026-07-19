import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { products } from '@/lib/products';

export async function POST() {
  try {
    const batch = adminDb.batch();
    
    products.forEach((product) => {
      const docRef = adminDb.collection('products').doc(product.id);
      batch.set(docRef, {
        name: product.name,
        description: product.description,
        price: product.price,
        category: product.category,
        image: product.image,
        available: product.available,
        sortOrder: product.sortOrder,
      }, { merge: true });
    });

    await batch.commit();

    return NextResponse.json({ success: true, message: 'Products seeded successfully' });
  } catch (error) {
    console.error('Seeding error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
