// OneSignal integration via Median.co JavaScript Bridge
// When running in a Median.co native app, the native OneSignal SDK handles push
// When running in browser, we gracefully degrade (no-op)

if (typeof window !== 'undefined') {
  // Global hook for Median JS Bridge notification opened/tapped event
  window.median_onesignal_opened = function(data) {
    console.log('🔔 OneSignal push tapped by user:', data);
    const target = data?.url || data?.web_url || data?.app_url || data?.targetUrl;
    if (target) {
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
        console.log('🔗 Setting OneSignal user ID & tags on Median bridge:', userId);
        
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

        // 5. OneSignal Tags (user_id) for filter targeting fallback
        try {
          if (typeof bridge.onesignal.sendTag === 'function') bridge.onesignal.sendTag('user_id', userId);
          if (typeof bridge.onesignal.pushTags === 'function') bridge.onesignal.pushTags({ user_id: userId });
          if (bridge.onesignal.user && typeof bridge.onesignal.user.addTag === 'function') bridge.onesignal.user.addTag('user_id', userId);
          if (bridge.onesignal.user && typeof bridge.onesignal.user.addTags === 'function') bridge.onesignal.user.addTags({ user_id: userId });
        } catch (_) {}

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

// Server-side: send push notification via OneSignal REST API targeted specifically to user
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
  
  // Helper to make fetch request trying 'Key' header first, then 'Bearer' header
  const sendRequest = async (payload) => {
    const authHeaders = [`Key ${apiKey}`, `Bearer ${apiKey}`];
    let lastRes = null;
    let lastData = null;

    for (const authHeader of authHeaders) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Authorization': authHeader,
          },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        lastRes = res;
        lastData = data;
        if (res.ok) break;
      } catch (err) {
        console.warn('OneSignal request error:', err);
      }
    }

    return { res: lastRes, data: lastData };
  };

  const targetUserId = (externalUserIds && externalUserIds.length > 0) ? externalUserIds[0] : null;

  // STEP 1: If sendToAll is explicitly requested or no targetUserId, send to Subscribed Users / Total Subscriptions segments
  if (sendToAll || !targetUserId) {
    const { res, data } = await sendRequest({
      app_id: appId,
      headings: { en: heading },
      contents: { en: content },
      included_segments: ['Subscribed Users', 'Total Subscriptions'],
      web_url: targetUrl,
      app_url: targetUrl,
      data: { url: targetUrl, targetUrl },
    });
    return { status: res?.status, ok: res?.ok, data };
  }

  // STEP 2: Try OneSignal v5 include_aliases format ALONE
  const { res: aliasRes, data: aliasData } = await sendRequest({
    app_id: appId,
    headings: { en: heading },
    contents: { en: content },
    include_aliases: {
      external_id: [targetUserId],
    },
    target_channel: 'push',
    web_url: targetUrl,
    app_url: targetUrl,
    data: { url: targetUrl, targetUrl },
  });

  const aliasSuccess = aliasRes?.ok && aliasData?.id && !aliasData?.errors;
  if (aliasSuccess) {
    console.log(`✅ OneSignal push delivered via include_aliases:`, aliasData);
    return { status: aliasRes.status, ok: true, method: 'include_aliases', data: aliasData };
  }

  // STEP 3: Try OneSignal v3/v4 include_external_user_ids ALONE
  const { res: extRes, data: extData } = await sendRequest({
    app_id: appId,
    headings: { en: heading },
    contents: { en: content },
    include_external_user_ids: [targetUserId],
    channel_for_external_user_ids: 'push',
    web_url: targetUrl,
    app_url: targetUrl,
    data: { url: targetUrl, targetUrl },
  });

  const extSuccess = extRes?.ok && extData?.id && !extData?.errors;
  if (extSuccess) {
    console.log(`✅ OneSignal push delivered via include_external_user_ids:`, extData);
    return { status: extRes.status, ok: true, method: 'include_external_user_ids', data: extData };
  }

  // STEP 4: Try OneSignal tag filter (user_id = targetUserId) ALONE
  const { res: tagRes, data: tagData } = await sendRequest({
    app_id: appId,
    headings: { en: heading },
    contents: { en: content },
    filters: [
      { field: 'tag', key: 'user_id', relation: '=', value: targetUserId }
    ],
    web_url: targetUrl,
    app_url: targetUrl,
    data: { url: targetUrl, targetUrl },
  });

  const tagSuccess = tagRes?.ok && tagData?.id && !tagData?.errors;
  if (tagSuccess) {
    console.log(`✅ OneSignal push delivered via tag filter:`, tagData);
    return { status: tagRes.status, ok: true, method: 'tag_filter', data: tagData };
  }

  // STEP 5: Segment Fallback (so active app users always get notified if user ID isn't registered yet)
  console.warn(`⚠️ User ID '${targetUserId}' not directly found on targeted methods. Triggering single segment fallback...`);
  const { res: segRes, data: segData } = await sendRequest({
    app_id: appId,
    headings: { en: heading },
    contents: { en: content },
    included_segments: ['Subscribed Users'],
    web_url: targetUrl,
    app_url: targetUrl,
    data: { url: targetUrl, targetUrl },
  });

  return {
    status: segRes?.status,
    ok: segRes?.ok,
    method: 'segment_fallback',
    data: segData,
  };
}
