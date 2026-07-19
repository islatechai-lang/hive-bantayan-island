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
      bridge.onesignal.requestPermission();
      return true;
    } catch (e) {
      console.warn('OneSignal permission request failed:', e);
      return false;
    }
  }
  return false;
}

export async function setUserExternalId(userId) {
  const bridge = getMedianBridge();
  if (bridge?.onesignal) {
    try {
      bridge.onesignal.externalUserId(userId);
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
      bridge.onesignal.pushTags(tags);
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
  const response = await fetch('https://api.onesignal.com/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Key ${process.env.ONESIGNAL_API_KEY}`,
    },
    body: JSON.stringify({
      app_id: process.env.ONESIGNAL_APP_ID,
      headings: { en: heading },
      contents: { en: content },
      include_aliases: {
        external_id: externalUserIds,
      },
      target_channel: 'push',
      ...(url && { url }),
    }),
  });

  return response.json();
}
