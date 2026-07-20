import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Lazy-init Firebase Admin only when this route is called
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
    const { orderId, gcashReceiptUrl, total } = await request.json();

    if (!orderId || !gcashReceiptUrl) {
      return NextResponse.json({ error: 'Missing orderId or receipt URL' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
    }

    // Fetch image and convert to base64
    const imageRes = await fetch(gcashReceiptUrl);
    if (!imageRes.ok) {
      return NextResponse.json({ error: 'Could not fetch receipt image' }, { status: 400 });
    }

    const arrayBuffer = await imageRes.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = imageRes.headers.get('content-type') || 'image/png';

    const todayStr = new Date().toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric'
    });

    const geminiPrompt = `You are an AI assistant for a cake delivery shop called Hive Bantayan.
Analyze this GCash receipt screenshot and verify if it is valid for this order.

Order Total: ₱${total}
Our GCash Number: 09454320799

Check:
1. Is it a valid GCash payment receipt?
2. Does the amount match or exceed ₱${total}?
3. Is it sent to 09454320799 or account name AL****H M** G.?
4. Is the date recent (today is ${todayStr})?

Return JSON only:
{"valid": true/false, "reason": "short explanation"}`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: geminiPrompt },
            { inlineData: { mimeType, data: base64Image } }
          ]
        }],
        generationConfig: { responseMimeType: 'application/json' }
      })
    });

    let aiResult = null;
    let newStatus = 'pending';

    if (geminiRes.ok) {
      const geminiData = await geminiRes.json();
      const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
      if (responseText) {
        aiResult = JSON.parse(responseText.trim());
        newStatus = aiResult.valid === true ? 'preparing' : 'pending';
      }
    }

    // Try to update Firestore via Admin SDK
    const adminDb = getAdminDb();
    if (adminDb) {
      await adminDb.collection('orders').doc(orderId).update({
        aiVerification: aiResult,
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
    }

    return NextResponse.json({ success: true, aiVerification: aiResult, status: newStatus });
  } catch (error) {
    console.error('Verify receipt error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
