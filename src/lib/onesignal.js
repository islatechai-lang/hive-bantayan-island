// OneSignal integration via Median.co JavaScript Bridge
// When running in a Median.co native app, the native OneSignal SDK handles push
// When running in browser, we gracefully degrade (no-op)

if (typeof window !== 'undefined') {
  // Global hook for Median JS Bridge notification opened/tapped event
  window.median_onesignal_opened = function(data) {
    console.log('🔔 OneSignal push tapped by user inside Median App:', data);
    const target = data?.targetUrl || data?.url || data?.custom?.a?.targetUrl || data?.custom?.a?.url;
    if (target) {
      // Navigate inside the app webview
      window.location.href = target;
    }
  };
  window.gonative_onesignal_opened = window.median_onesignal_opened;
}

export function isMedianApp() {
  if (typeof window === 'undefined') return false;
  return !!(window.median || window.gonative);
}

export function getMedianBridge() {
  if (typeof window === 'undefined') return null;
  return window.median || window.gonative || null;
}

export async function requestNotificationPermission() {
  const bridge = getMedianBridge();
  if (bridge?.onesignal) {
    try {
      if (typeof bridge.onesignal.requestPermission === 'function') {
        bridge.onesignal.requestPermission();
      } else if (typeof bridge.onesignal.register === 'function') {
        bridge.onesignal.register();
      }
      console.log('✅ OneSignal push permission requested via Median bridge');
      return true;
    } catch (e) {
      console.warn('OneSignal permission request failed:', e);
      return false;
    }
  } else if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'granted') {
    try {
      await Notification.requestPermission();
    } catch (_) {}
  }
  return false;
}

export async function setUserExternalId(userId) {
  if (!userId) return false;

  const attemptSet = () => {
    const bridge = getMedianBridge();
    if (bridge?.onesignal) {
      try {
        console.log('🔗 Setting OneSignal user ID on Median bridge:', userId);
        
        // 1. Median v5 SDK login method
        if (typeof bridge.onesignal.login === 'function') {
          try { bridge.onesignal.login(userId); } catch (_) {}
        }

        // 2. Median externalUserId string / object methods
        if (typeof bridge.onesignal.externalUserId === 'function') {
          try { bridge.onesignal.externalUserId(userId); } catch (_) {}
          try { bridge.onesignal.externalUserId({ externalId: userId }); } catch (_) {}
        }

        // 3. Median setExternalUserId method
        if (typeof bridge.onesignal.setExternalUserId === 'function') {
          try { bridge.onesignal.setExternalUserId(userId); } catch (_) {}
        }

        // 4. OneSignal User Aliases
        if (bridge.onesignal.user && typeof bridge.onesignal.user.addAlias === 'function') {
          try { bridge.onesignal.user.addAlias({ label: 'external_id', id: userId }); } catch (_) {}
        }

        return true;
      } catch (e) {
        console.warn('OneSignal setUserExternalId failed:', e);
        return false;
      }
    } else if (typeof window !== 'undefined' && window.OneSignal) {
      try {
        if (typeof window.OneSignal.login === 'function') {
          window.OneSignal.login(userId);
        }
      } catch (_) {}
      return true;
    }
    return false;
  };

  // Immediate attempt
  const success = attemptSet();

  // If bridge wasn't ready yet on immediate attempt, retry after bridge load (up to 3 times)
  if (!success && typeof window !== 'undefined') {
    [1000, 3000, 6000].forEach(delay => {
      setTimeout(() => {
        attemptSet();
      }, delay);
    });
  }

  return success;
}

export async function setUserTags(tags) {
  const bridge = getMedianBridge();
  if (bridge?.onesignal) {
    try {
      if (typeof bridge.onesignal.pushTags === 'function') {
        bridge.onesignal.pushTags(tags);
      }
      return true;
    } catch (e) {
      console.warn('OneSignal pushTags failed:', e);
      return false;
    }
  }
  return false;
}

// Server-side: push dispatcher targeted directly to customer user ID
// Note: We deliberately omit top-level web_url/app_url so Median native app keeps user INSIDE the app webview
export async function sendPushNotification({ heading, content, externalUserIds, url, sendToAll }) {
  const rawKey = process.env.ONESIGNAL_API_KEY;
  const rawAppId = process.env.ONESIGNAL_APP_ID || process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;

  if (!rawKey || !rawAppId) {
    console.warn('OneSignal API Key or App ID is missing in environment variables.');
    return { error: 'Missing ONESIGNAL_API_KEY or ONESIGNAL_APP_ID environment variables in Vercel' };
  }

  const apiKey = rawKey.trim();
  const appId = rawAppId.trim();
  const targetUrl = url || 'https://hive-bantayan-island.vercel.app/orders';
  const endpoint = 'https://api.onesignal.com/notifications';
  const targetUserId = (externalUserIds && externalUserIds.length > 0) ? externalUserIds[0] : null;

  // Custom data payload for Median native app internal webview navigation
  const dataPayload = {
    targetUrl: targetUrl,
    url: targetUrl,
  };

  const payload = (sendToAll || !targetUserId) ? {
    app_id: appId,
    headings: { en: heading },
    contents: { en: content },
    included_segments: ['Subscribed Users', 'Total Subscriptions'],
    target_channel: 'push',
    data: dataPayload,
  } : {
    app_id: appId,
    headings: { en: heading },
    contents: { en: content },
    include_aliases: {
      external_id: [targetUserId],
    },
    target_channel: 'push',
    data: dataPayload,
  };

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Key ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    console.log('OneSignal push response:', res.status, data);

    // If targeted external_id user wasn't registered in OneSignal yet, retry once with Subscribed Users segment
    if (res.ok && data?.errors && targetUserId) {
      console.warn('⚠️ User ID not found in OneSignal external_id alias. Retrying once with Subscribed Users segment...');
      const fallbackRes = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Authorization': `Key ${apiKey}`,
        },
        body: JSON.stringify({
          app_id: appId,
          headings: { en: heading },
          contents: { en: content },
          included_segments: ['Subscribed Users'],
          data: dataPayload,
        }),
      });
      const fallbackData = await fallbackRes.json();
      return { status: fallbackRes.status, ok: fallbackRes.ok, data: fallbackData, fallback: true };
    }

    return { status: res.status, ok: res.ok, data };
  } catch (err) {
    console.error('OneSignal push error:', err);
    return { error: err.message || String(err) };
  }
}
