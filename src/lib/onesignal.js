// OneSignal integration via Median.co JavaScript Bridge
// When running in a Median.co native app, the native OneSignal SDK handles push
// When running in browser, we gracefully degrade (no-op)

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
  const bridge = getMedianBridge();
  if (bridge?.onesignal) {
    try {
      console.log('🔗 Registering OneSignal user ID with Median bridge:', userId);
      // Median v5 SDK login method
      if (typeof bridge.onesignal.login === 'function') {
        bridge.onesignal.login(userId);
      }
      // Median externalUserId methods
      if (typeof bridge.onesignal.externalUserId === 'function') {
        try { bridge.onesignal.externalUserId(userId); } catch (_) {}
        try { bridge.onesignal.externalUserId({ externalId: userId }); } catch (_) {}
      }
      if (typeof bridge.onesignal.setExternalUserId === 'function') {
        try { bridge.onesignal.setExternalUserId(userId); } catch (_) {}
      }
      return true;
    } catch (e) {
      console.warn('OneSignal setExternalUserId failed:', e);
      return false;
    }
  } else if (typeof window !== 'undefined' && window.OneSignal) {
    try {
      if (typeof window.OneSignal.login === 'function') {
        window.OneSignal.login(userId);
      }
    } catch (_) {}
  }
  return false;
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

// Server-side: send push notification via OneSignal REST API
export async function sendPushNotification({ heading, content, externalUserIds, url }) {
  const rawKey = process.env.ONESIGNAL_API_KEY;
  const rawAppId = process.env.ONESIGNAL_APP_ID;

  const apiKey = rawKey ? rawKey.trim() : undefined;
  const appId = rawAppId ? rawAppId.trim() : undefined;

  if (!apiKey || !appId) {
    console.warn('OneSignal API Key or App ID is missing in environment variables.');
    return { error: 'Missing ONESIGNAL_API_KEY or ONESIGNAL_APP_ID env vars' };
  }

  const payload = {
    app_id: appId,
    headings: { en: heading },
    contents: { en: content },
    include_external_user_ids: externalUserIds,
    include_aliases: {
      external_id: externalUserIds,
    },
    target_channel: 'push',
    channel_for_external_user_ids: 'push',
    ...(url && { url }),
  };

  try {
    // Attempt 1: Authorization: Key header format
    let response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Key ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    let data = await response.json();
    console.log('OneSignal push API (Key auth) status:', response.status, data);

    // Attempt 2: Authorization: Basic header fallback if Key header is rejected
    if (!response.ok && (response.status === 401 || data?.errors?.includes?.('Invalid authorization header'))) {
      console.log('Retrying OneSignal push API with Basic auth header...');
      response = await fetch('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Authorization': `Basic ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });
      data = await response.json();
      console.log('OneSignal push API (Basic auth) status:', response.status, data);
    }

    return {
      status: response.status,
      ok: response.ok,
      data,
    };
  } catch (err) {
    console.error('Error sending OneSignal push notification:', err);
    return { error: err.message || String(err) };
  }
}
