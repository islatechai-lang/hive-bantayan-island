import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(request) {
  try {
    const orderData = await request.json();
    const { paymentMethod, gcashReceiptUrl, total } = orderData;

    // Set initial status based on payment type
    let finalStatus = 'pending';
    let aiVerificationResult = null;

    if (paymentMethod === 'cod') {
      // COD orders bypass approval and go straight to preparing
      finalStatus = 'preparing';
    } else if (paymentMethod === 'gcash' && gcashReceiptUrl) {
      const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      
      if (apiKey) {
        try {
          // Fetch image from Supabase Storage and convert to base64
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

            // Prompt Gemini for invoice audit
            const geminiPrompt = `
              You are an AI assistant for a cake delivery shop in Bantayan Island called Hive Bantayan.
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

            // Call Gemini API using fetch (works out-of-the-box in Next.js Server Components)
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

                if (parsedResult.valid === true) {
                  finalStatus = 'preparing';
                } else {
                  finalStatus = 'pending'; // Flagged for manual review
                }
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

    // Write final order doc to Firestore
    const finalOrderData = {
      ...orderData,
      status: finalStatus,
      aiVerification: aiVerificationResult,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const docRef = await adminDb.collection('orders').add(finalOrderData);

    // Send email alert to Admin via Resend API
    const resendApiKey = process.env.RESEND_API_KEY;
    const notificationEmail = process.env.NOTIFICATION_EMAIL || 'princederder44@gmail.com';
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

    if (resendApiKey) {
      try {
        const itemsListHtml = (orderData.items || [])
          .map(i => `<li><strong>${i.quantity}x</strong> ${i.name} — ₱${i.price * i.quantity}</li>`)
          .join('');

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: `Hive Orders <${fromEmail}>`,
            to: [notificationEmail],
            subject: `🚨 NEW ORDER # ${docRef.id.slice(-6).toUpperCase()} - ₱${total} (${paymentMethod.toUpperCase()})`,
            html: `
              <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                <h2 style="color: #EB687E;">🍰 New Order Received on Hive Bantayan!</h2>
                <p><strong>Customer Name:</strong> ${orderData.userName || 'Customer'}</p>
                <p><strong>Phone:</strong> ${orderData.userPhone || 'N/A'}</p>
                <p><strong>Delivery Address:</strong> ${orderData.address || 'N/A'}</p>
                <p><strong>Payment Method:</strong> ${paymentMethod.toUpperCase()}</p>
                <p><strong>Total Amount:</strong> ₱${total}</p>
                ${orderData.riderNote ? `<p><strong>Note for Rider:</strong> <em>${orderData.riderNote}</em></p>` : ''}
                
                <h3>Items:</h3>
                <ul>${itemsListHtml}</ul>

                <br/>
                <a href="https://hive-bantayan-8598e.web.app/admin" style="background: #EB687E; color: white; padding: 10px 20px; text-decoration: none; border-radius: 20px; font-weight: bold;">Open Admin Dashboard</a>
              </div>
            `
          })
        });
        console.log('Resend email notification sent successfully to:', notificationEmail);
      } catch (emailErr) {
        console.error('Failed to send Resend email alert:', emailErr);
      }
    }

    return NextResponse.json({
      success: true,
      orderId: docRef.id,
      status: finalStatus,
      aiVerification: aiVerificationResult
    });
  } catch (error) {
    console.error('Create order API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
