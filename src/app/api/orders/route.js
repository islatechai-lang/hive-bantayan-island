import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const orderData = await request.json();
    const { paymentMethod, gcashReceiptUrl, total, orderId: incomingOrderId } = orderData;

    // Set initial status based on payment type
    let finalStatus = 'preparing';
    let aiVerificationResult = null;

    if (paymentMethod === 'cod') {
      finalStatus = 'preparing';
    } else if (paymentMethod === 'gcash' && gcashReceiptUrl) {
      const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      
      if (apiKey) {
        try {
          const imageRes = await fetch(gcashReceiptUrl);
          if (imageRes.ok) {
            const arrayBuffer = await imageRes.arrayBuffer();
            const base64Image = Buffer.from(arrayBuffer).toString('base64');
            const mimeType = imageRes.headers.get('content-type') || 'image/png';

            const todayStr = new Date().toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric'
            });

            const geminiPrompt = `
              You are an AI assistant for a cake delivery shop in Bantayan Island called Bantayan Hive.
              Your task is to analyze the attached GCash receipt image and verify if it is valid for this order.

              Order Total: ₱${total}
              Our GCash Account Number: 09454320799

              Please analyze the receipt screenshot and check:
              1. Is it a valid GCash payment transaction receipt?
              2. Does the transaction amount sent match the Order Total (₱${total})? (Must meet or exceed it)
              3. Is it sent to the correct GCash mobile number (09454320799) or account name (AL****H M** G.)?
              4. Is the date of the transaction recent (today is ${todayStr})?

              You must return a JSON response with exactly these keys:
              {
                "valid": true or false,
                "reason": "Short explanation of validation results",
                "extractedAmount": 0,
                "extractedRefNo": "reference number string",
                "extractedRecipient": "name or number string"
              }
            `;

            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
            const geminiRes = await fetch(geminiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      { text: geminiPrompt },
                      {
                        inlineData: {
                          mimeType: mimeType,
                          data: base64Image
                        }
                      }
                    ]
                  }
                ],
                generationConfig: {
                  responseMimeType: 'application/json'
                }
              })
            });

            if (geminiRes.ok) {
              const geminiData = await geminiRes.json();
              const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
              
              if (responseText) {
                const parsedResult = JSON.parse(responseText.trim());
                aiVerificationResult = parsedResult;
                finalStatus = 'preparing';
              }
            } else {
              console.error('Gemini API returned error code:', geminiRes.status);
            }
          }
        } catch (aiError) {
          console.error('Error during AI receipt verification:', aiError);
        }
      }
    }

    // Try optional server-side Firestore write if adminDb is available
    let orderId = incomingOrderId || 'ORDER_' + Date.now();
    try {
      const { adminDb } = require('../../../lib/firebase-admin');
      if (!incomingOrderId && adminDb) {
        const docRef = await adminDb.collection('orders').add({
          ...orderData,
          status: finalStatus,
          aiVerification: aiVerificationResult,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        orderId = docRef.id;
      }
    } catch (adminErr) {
      console.warn('Firebase Admin DB write skipped (handled client-side):', adminErr.message);
    }

    const shortId = orderId ? orderId.slice(-6).toUpperCase() : 'NEW';

    // Send email alert to Admin via Resend API
    const rawResendKey = process.env.RESEND_API_KEY;
    const resendApiKey = rawResendKey ? rawResendKey.trim() : undefined;
    const notificationEmail = (process.env.NOTIFICATION_EMAIL || 'princederder44@gmail.com').trim();
    const fromEmail = (process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev').trim();

    if (resendApiKey) {
      try {
        const itemsListHtml = (orderData.items || [])
          .map(i => `<li><strong>${i.quantity}x</strong> ${i.name} — ₱${i.price * i.quantity}</li>`)
          .join('');

        const resendFrom = fromEmail.includes('<') ? fromEmail : `Bantayan Hive Orders <${fromEmail}>`;

        console.log(`Sending Resend email to ${notificationEmail} from ${resendFrom}...`);

        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: resendFrom,
            to: [notificationEmail],
            subject: `🚨 NEW ORDER #${shortId} - ₱${total || 0} (${(paymentMethod || 'COD').toUpperCase()})`,
            html: `
              <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 12px;">
                <h2 style="color: #EB687E; margin-top: 0;">🍰 New Order Received on Bantayan Hive!</h2>
                <p><strong>Order ID:</strong> #${shortId}</p>
                <p><strong>Customer Name:</strong> ${orderData.userName || 'Customer'}</p>
                <p><strong>Phone:</strong> ${orderData.userPhone || 'N/A'}</p>
                <p><strong>Delivery Address:</strong> ${orderData.address || 'Live GPS Location'}</p>
                <p><strong>Payment Method:</strong> ${(paymentMethod || 'COD').toUpperCase()}</p>
                <p><strong>Total Amount:</strong> <span style="font-size: 1.2rem; color: #EB687E; font-weight: bold;">₱${total || 0}</span></p>
                ${orderData.riderNote ? `<p><strong>Note for Rider:</strong> <em>${orderData.riderNote}</em></p>` : ''}
                
                <h3 style="border-bottom: 1px solid #ddd; padding-bottom: 8px;">Items Ordered:</h3>
                <ul style="line-height: 1.6;">${itemsListHtml}</ul>

                <br/>
                <a href="https://hive-bantayan-island.vercel.app/admin" style="display: inline-block; background: #EB687E; color: white; padding: 12px 24px; text-decoration: none; border-radius: 20px; font-weight: bold;">Open Admin Dashboard 🛵</a>
              </div>
            `
          })
        });

        const resendData = await resendRes.json();
        console.log('Resend email API response status:', resendRes.status, resendData);

        if (!resendRes.ok) {
          console.error('Resend API returned non-200 status:', resendRes.status, resendData);
        }
      } catch (emailErr) {
        console.error('Failed to send Resend email alert:', emailErr);
      }
    } else {
      console.warn('RESEND_API_KEY is missing or empty. Email notification skipped.');
    }

    return NextResponse.json({
      success: true,
      orderId: orderId,
      status: finalStatus,
      aiVerification: aiVerificationResult
    });
  } catch (error) {
    console.error('Create order API top-level error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 200 });
  }
}
