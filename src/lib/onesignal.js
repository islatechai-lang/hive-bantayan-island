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
      }
      return true;
    } catch (e) {
      console.warn('OneSignal permission request failed:', e);
      return false;
    }
  }
  return false;
}

export async function setUserExternalId(userId) {
  if (!userId) return false;
  const bridge = getMedianBridge();
  if (bridge?.onesignal) {
    try {
      if (typeof bridge.onesignal.externalUserId === 'function') {
        bridge.onesignal.externalUserId(userId);
      }
      if (typeof bridge.onesignal.setExternalUserId === 'function') {
        bridge.onesignal.setExternalUserId(userId);
      }
      console.log('OneSignal externalUserId registered:', userId);
      return true;
    } catch (e) {
      console.warn('OneSignal setExternalUserId failed:', e);
      return false;
    }
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
    return { error: 'Missing ONESIGNAL_API_KEY or ONESIGNAL_APP_ID' };
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
    ...(url && { url }),
  };

  try {
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Key ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    console.log('OneSignal push notification API result:', response.status, data);

    // Fallback attempt with Basic authorization format if Key header fails
    if (!response.ok && (data?.errors?.includes?.('Invalid authorization header') || response.status === 401)) {
      const fallbackRes = await fetch('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Authorization': `Basic ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });
      return fallbackRes.json();
    }

    return data;
  } catch (err) {
    console.error('Error sending OneSignal push notification:', err);
    return { error: err.message };
  }
}
