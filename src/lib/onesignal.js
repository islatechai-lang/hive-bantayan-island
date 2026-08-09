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
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Authorization': `Bearer ${apiKey}`,
  };

  const targetUserId = (externalUserIds && externalUserIds.length > 0) ? externalUserIds[0] : null;

  // STEP 1: If sendToAll is explicitly requested or no targetUserId, send to Subscribed Users segment
  if (sendToAll || !targetUserId) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          app_id: appId,
          headings: { en: heading },
          contents: { en: content },
          included_segments: ['Subscribed Users'],
          url: targetUrl,
          web_url: targetUrl,
          app_url: targetUrl,
          data: { url: targetUrl, targetUrl },
          target_channel: 'push',
        }),
      });
      const data = await res.json();
      return { status: res.status, ok: res.ok, data };
    } catch (err) {
      return { error: err.message || String(err) };
    }
  }

  // STEP 2: Try targeted delivery via external_id alias / include_external_user_ids
  try {
    const payloadExternalId = {
      app_id: appId,
      headings: { en: heading },
      contents: { en: content },
      include_aliases: {
        external_id: [targetUserId],
      },
      include_external_user_ids: [targetUserId],
      url: targetUrl,
      web_url: targetUrl,
      app_url: targetUrl,
      data: { url: targetUrl, targetUrl },
      target_channel: 'push',
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payloadExternalId),
    });

    const data = await res.json();
    console.log(`OneSignal external_id push attempt result:`, res.status, data);

    const recipients = data?.recipients || 0;
    if (res.ok && recipients > 0) {
      return { status: res.status, ok: true, method: 'external_id', recipients, data };
    }

    // STEP 3: If external_id matched 0 recipients, try tag targeting (user_id tag)
    console.warn(`⚠️ external_id '${targetUserId}' reached 0 recipients. Trying user_id tag filter...`);
    const payloadTag = {
      app_id: appId,
      headings: { en: heading },
      contents: { en: content },
      filters: [
        { field: 'tag', key: 'user_id', relation: '=', value: targetUserId }
      ],
      url: targetUrl,
      web_url: targetUrl,
      app_url: targetUrl,
      data: { url: targetUrl, targetUrl },
      target_channel: 'push',
    };

    const tagRes = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payloadTag),
    });

    const tagData = await tagRes.json();
    console.log(`OneSignal tag filter push attempt result:`, tagRes.status, tagData);

    const tagRecipients = tagData?.recipients || 0;
    if (tagRes.ok && tagRecipients > 0) {
      return { status: tagRes.status, ok: true, method: 'tag_filter', recipients: tagRecipients, data: tagData };
    }

    // STEP 4: Fallback to Subscribed Users segment if device registration hasn't attached user ID yet
    console.warn(`⚠️ Target user ID '${targetUserId}' not indexed in OneSignal yet. Triggering segment fallback...`);
    const fallbackRes = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        app_id: appId,
        headings: { en: heading },
        contents: { en: content },
        included_segments: ['Subscribed Users'],
        url: targetUrl,
        web_url: targetUrl,
        app_url: targetUrl,
        data: { url: targetUrl, targetUrl },
        target_channel: 'push',
      }),
    });
    const fallbackData = await fallbackRes.json();
    return {
      status: fallbackRes.status,
      ok: fallbackRes.ok,
      method: 'segment_fallback',
      recipients: fallbackData?.recipients || 0,
      data: fallbackData,
    };
  } catch (err) {
    console.error('OneSignal targeted push error:', err);
    return { error: err.message || String(err) };
  }
}
