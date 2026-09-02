const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// 1. REVENUECAT REAL MASTER TOKEN & KEYS (100% INDEPENDENT)
// ==========================================
const LOCKET_RC_KEY = 'appl_JngFETzdodyLmCREOlwTUtXdQik';
const MASTER_FETCH_TOKEN = 'eyJhbGciOiJFUzI1NiIsIng1YyI6WyJNSUlFTVRDQ0E3YWdBd0lCQWdJUVI4S0h6ZG41NTRaL1VvcmFkTng5dHpBS0JnZ3Foa2pPUFFRREF6QjFNVVF3UWdZRFZRUURERHRCY0hCc1pTQlhiM0pzWkhkcFpHVWdSR1YyWld4dmNHVnlJRkpsYkdGMGFXOXVjeUJEWlhKMGFXWnBZMkYwYVc5dUlFRjFkR2h2Y21sMGVURUxNQWtHQTFVRUN3d0NSell4RXpBUkJnTlZCQW9NQ2tGd2NHeGxJRWx1WXk0eEN6QUpCZ05WQkFZVEFsVlRNQjRYRFRJMU1Ea3hPVEU1TkRRMU1Wb1hEVEkzTVRBeE16RTNORGN5TTFvd2daSXhRREErQmdOVkJBTU1OMUJ5YjJRZ1JVTkRJRTFoWXlCQmNIQWdVM1J2Y21VZ1lXNWtJR2xVZFc1bGN5QlRkRzl5WlNCU1pXTmxhWEIwSUZOcFoyNXBibWN4TERBcUJnTlZCQXNNSTBGd2NHeGxJRmR2Y214a2QybGtaU0JFWlhabGJHOXdaWElnVW1Wc1lYUnBiMjV6TVJNd0VRWURWUVFLREFwQmNIQnNaU0JKYm1NdU1Rc3dDUVlEVlFRR0V3SlZVekJaTUJNR0J5cUdTTTQ5QWdFR0NDcUdTTTQ5QXdFSEEwSUFCTm5WdmhjdjdpVCs3RXg1dEJNQmdyUXNwSHpJc1hSaTBZeGZlazdsdjh3RW1qL2JIaVd0TndKcWMyQm9IenNRaUVqUDdLRklJS2c0WTh5MC9ueW51QW1qZ2dJSU1JSUNCREFNQmdOVkhSTUJBZjhFQWpBQU1COEdBMVVkSXdRWU1CYUFGRDh2bENOUjAxREptaWc5N2JCODVjK2xrR0taTUhBR0NDc0dBUVVGQndFQkJHUXdZakF0QmdnckJnRUZCUWN3QW9ZaGFIUjBjRG92TDJObGNuUnpMbUZ3Y0d4bExtTnZiUzkzZDJSeVp6WXVaR1Z5TURFR0NDc0dBUVVGQnpBQmhpVm9kSFJ3T2k4dmIyTnpjQzVoY0hCc1pTNWpiMjB2YjJOemNEQXpMWGQzWkhKbk5qQXlNSUlCSGdZRFZSMGdCSUlCRlRDQ0FSRXdnZ0VOQmdvcWhraUc5Mk5rQlFZQk1JSCtNSUhEQmdnckJnRUZCUWNDQWpDQnRneUJzMUpsYkdsaGJtTmxJRzl1SUhSb2FYTWdZMlZ5ZEdsbWFXTmhkR1VnWW5rZ1lXNTVJSEJoY25SNUlHRnpjM1Z0WlhNZ1lXTmpaWEIwWVc1alpTQnZaaUIwYUdVZ2RHaGxiaUJoY0hCc2FXTmhZbXhsSUhOMFlXNWtZWEprSUhSbGNtMXpJR0Z1WkNCamIyNWthWFJwYjI1eklHOW1JSFZ6WlN3Z1kyVnlkR2xtYVdOaGRHVWdjRzlzYVdONUlHRnVaQ0JqWlhKMGFXWnBZMkYwYVc5dUlIQnlZV04wYVdObElITjBZWFJsYldWdWRITXVNRFlHQ0NzR0FRVUZCd0lCRmlwb2RIUndPaTh2ZDNkM0xtRndjR3hsTG1OdmJTOWpaWEowYVdacFkyRjBaV0YxZEdodmNtbDBlUzh3SFFZRFZSME9CQllFRklGaW9HNHdNTVZBMWt1OXpKbUdOUEFWbjNlcU1BNEdBMVVkRHdFQi93UUVBd0lIZ0RBUUJnb3Foa2lHOTJOa0Jnc0JCQUlGQURBS0JnZ3Foa2pPUFFRREF3TnBBREJtQWpFQStxWG5SRUM3aFhJV1ZMc0x4em5qUnBJelBmN1ZIejlWL0NUbTgrTEpsclFlcG5tY1B2R0xOY1g2WFBubGNnTEFBakVBNUlqTlpLZ2c1cFE3OWtuRjRJYlRYZEt2OHZ1dElETVhEbWpQVlQzZEd2RnRzR1J3WE95d1Iya1pDZFNyZmVvdCIsIk1JSURGakNDQXB5Z0F3SUJBZ0lVSXNHaFJ3cDBjMm52VTRZU3ljYWZQVGp6Yk5jd0NnWUlLb1pJemowRUF3TXdaekViTUJrR0ExVUVBd3dTUVhCd2JHVWdVbTl2ZENCRFFTQXRJRWN6TVNZd0pBWURWUVFMREIxQmNIQnNaU0JEWlhKMGFXWnBZMkYwYVc5dUlFRjFkR2h2Y21sMGVURVRNQkVHQTFVRUNnd0tRWEJ3YkdVZ1NXNWpMakVMTUFrR0ExVUVCaE1DVlZNd0hoY05NakV3TXpFM01qQXpOekV3V2hjTk16WXdNekU1TURBd01EQXdXakIxTVVRd1FnWURWUVFERER0QmNIQnNaU0JYYjNKc1pIZHBaR1VnUkdWMlpXeHZjR1Z5SUZKbGJHRjBhVzl1Y3lCRFpYSjBhV1pwWTJGMGFXOXVJRUYxZEdodmNtbDBlVEVMTUFrR0ExVUVDd3dDUnpZeEV6QVJCZ05WQkFvTUNrRndjR3hsSUVsdVl5NHhDekFKQmdOVkJBWVRBbFZUTUhZd0VBWUhLb1pJemowQ0FRWUZLNEVFQUNJRFlnQUVic1FLQzk0UHJsV21aWG5YZ3R4emRWSkw4VDBTR1luZ0RSR3BuZ24zTjZQVDhKTUViN0ZEaTRiQm1QaENuWjMvc3E2UEYvY0djS1hXc0w1dk90ZVJoeUo0NXgzQVNQN2NPQithYW85MGZjcHhTdi9FWkZibmlBYk5nWkdoSWhwSW80SDZNSUgzTUJJR0ExVWRFd0VCL3dRSU1BWUJBZjhDQVFBd0h3WURWUjBqQkJnd0ZvQVV1N0Rlb1ZnemlKcWtpcG5ldnIzcnI5ckxKS3N3UmdZSUt3WUJCUVVIQVFFRU9qQTRNRFlHQ0NzR0FRVUZCekFCaGlwb2RIUndPaTh2YjJOemNDNWhjSEJzWlM1amIyMHZiMk56Y0RBekxXRndjR3hsY205dmRHTmhaek13TndZRFZSMGZCREF3TGpBc29DcWdLSVltYUhSMGNEb3ZMMk55YkM1aGNIQnNaUzVqYjIwdllYQndiR1Z5YjI5MFkyRm5NeTVqY213d0hRWURWUjBPQkJZRUZEOHZsQ05SMDFESm1pZzk3YkI4NWMrbGtHS1pNQTRHQTFVZER3RUIvd1FFQXdJQkJqQVFCZ29xaGtpRzkyTmtCZ0lCQkFJRkFEQUtCZ2dxaGtqT1BRUURBd05vQURCbEFqQkFYaFNxNUl5S29nTUNQdHc0OTBCYUI2NzdDYUVHSlh1ZlFCL0VxWkdkNkNTamlDdE9udU1UYlhWWG14eGN4ZmtDTVFEVFNQeGFyWlh2TnJreFUzVGtVTUkzM3l6dkZWVlJUNHd4V0pDOTk0T3NkY1o0K1JHTnNZRHlSNWdtZHIwbkRHZz0iLCJNSUlDUXpDQ0FjbWdBd0lCQWdJSUxjWDhpTkxGUzVVd0NnWUlLb1pJemowRUF3TXdaekViTUJrR0ExVUVBd3dTUVhCd2JHVWdVbTl2ZENCRFFTQXRJRWN6TVNZd0pBWURWUVFMREIxQmNIQnNaU0JEWlhKMGFXWnBZMkYwYVc5dUlFRjFkR2h2Y21sMGVURVRNQkVHQTFVRUNnd0tRWEJ3YkdVZ1NXNWpMakVMTUFrR0ExVUVCaE1DVlZNd0hoY05NVFF3TkRNd01UZ3hPVEEyV2hjTk16a3dORE13TVRneE9UQTJXakJuTVJzd0dRWURWUVFEREJKQmNIQnNaU0JTYjI5MElFTkJJQzBnUnpNeEpqQWtCZ05WQkFzTUhVRndjR3hsSUVObGNuUnBabWxqWVhScGIyNGdRWFYwYUc5eWFYUjVNUk13RVFZRFZRUUtEQXBCY0hCc1pTQkpibU11TVFzd0NRWURWUVFHRXdKVlV6QjJNQkFHQnlxR1NNNDlBZ0VHQlN1QkJBQWlBMklBQkpqcEx6MUFjcVR0a3lKeWdSTWMzUkNWOGNXalRuSGNGQmJaRHVXbUJTcDNaSHRmVGpqVHV4eEV0WC8xSDdZeVlsM0o2WVJiVHpCUEVWb0EvVmhZREtYMUR5eE5CMGNUZGRxWGw1ZHZNVnp0SzUxN0lEdll1VlRaWHBta09sRUtNYU5DTUVBd0hRWURWUjBPQkJZRUZMdXczcUZZTTRpYXBJcVozcjY5NjYvYXl5U3JNQThHQTFVZEV3RUIvd1FGTUFNQkFmOHdEZ1lEVlIwUEFRSC9CQVFEQWdFR01Bb0dDQ3FHU000OUJBTURBMmdBTUdVQ01RQ0Q2Y0hFRmw0YVhUUVkyZTN2OUd3T0FFWkx1Tit5UmhIRkQvM21lb3locG12T3dnUFVuUFdUeG5TNGF0K3FJeFVDTUcxbWloREsxQTNVVDgyTlF6NjBpbU9sTTI3amJkb1h0MlFmeUZNbStZaGlkRGtMRjF2TFVhZ002QmdENTZLeUtBPT0iXX0.eyJ0cmFuc2FjdGlvbklkIjoiNzMwMDAyNjc1NjA4MzQyIiwib3JpZ2luYWxUcmFuc2FjdGlvbklkIjoiNzMwMDAyNjc1NjA4MzQyIiwid2ViT3JkZXJMaW5lSXRlbUlkIjoiNzMwMDAxMTk3NTIyMjQ0IiwiYnVuZGxlSWQiOiJjb20ubG9ja2V0LkxvY2tldCIsInByb2R1Y3RJZCI6ImxvY2tldF8xOTlfMW0iLCJzdWJzY3JpcHRpb25Hcm91cElkZW50aWZpZXIiOiIyMTQxOTQ0NyIsInB1cmNoYXNlRGF0ZSI6MTc4ODMzMjYxNjAwMCwib3JpZ2luYWxQdXJjaGFzZURhdGUiOjE3ODgzMzI2MTYwMDAsImV4cGlyZXNEYXRlIjoxNzkwOTI0NjE2MDAwLCJxdWFudGl0eSI6MSwidHlwZSI6IkF1dG8tUmVuZXdhYmxlIFN1YnNjcmlwdGlvbiIsImRldmljZVZlcmlmaWNhdGlvbiI6IjVtVEpoaHhaZkdXS2dYLzBFMmJjaHlLRzB3bk5UM0hhdXlERm9BeHlrN00renVlNGJyS1JQelljQzNnQVh4cWgiLCJkZXZpY2VWZXJpZmljYXRpb25Ob25jZSI6IjIzYjYyZWI4LWY1MjUtNDA3NS1iODZmLWIxNzQ3NDIyMzFkMiIsImluQXBwT3duZXJzaGlwVHlwZSI6IlBVUkNIQVNFRCIsInNpZ25lZERhdGUiOjE3ODgzMzI2MjY0NjAsImVudmlyb25tZW50IjoiUHJvZHVjdGlvbiIsInRyYW5zYWN0aW9uUmVhc29uIjoiUFVSQ0hBU0UiLCJzdG9yZWZyb250IjoiVk5NIiwic3RvcmVmcm9udElkIjoiMTQzNDcxIiwicHJpY2UiOjQ5MDAwMDAwLCJjdXJyZW5jeSI6IlZORCIsImFwcFRyYW5zYWN0aW9uSWQiOiI3MDU4NDkyOTM5Nzk4NTM3NzUiLCJiaWxsaW5nUGxhblR5cGUiOiJCSUxMRURfVVBGUk9OVCJ9._zezKbjbAP0hedqAEtEB7FV8NyqualYVWbF2s3Fg1zi6LqxsKdPc0HshLyTaImUTxtJgjWu7JEWMOL3CiKlBDw';

// Cache for resolved profiles: username -> { avatar_url, uid, timestamp }
const avatarCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Helper to extract Firebase UID from Locket storage URL
function extractUidFromAvatarUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/users(?:%2F|\/)([a-zA-Z0-9_-]{20,40})(?:%2F|\/)public/i);
  return match ? match[1] : null;
}

// Helper to check if string is a raw Firebase UID (28 characters)
function isFirebaseUid(str) {
  return typeof str === 'string' && /^[a-zA-Z0-9_-]{20,40}$/.test(str) && /[0-9]/.test(str) && /[a-zA-Z]/.test(str);
}

// Clean input: extract username or UID from URL if user pastes a full link
function cleanInputString(input) {
  if (!input) return '';
  let str = input.trim();
  // If user pastes full locket link: https://locket.cam/hannhnguyn or locket.camera/links/...
  const linkMatch = str.match(/locket\.(?:cam|camera)(?:\/links)?\/([a-zA-Z0-9._-]+)/i);
  if (linkMatch) {
    str = linkMatch[1];
  }
  return str.replace(/^@/, '').trim();
}

// ==========================================
// 2. SMART RESOLVER (DIRECT + MULTI-FALLBACK)
// ==========================================
async function resolveLocketProfile(input) {
  const clean = cleanInputString(input);
  if (!clean) return { success: false, message: 'Vui lòng cung cấp Username, Link hoặc UID' };

  // If already a Firebase UID directly
  if (isFirebaseUid(clean) && clean.length >= 26) {
    return {
      success: true,
      username: clean,
      avatar_url: `https://firebasestorage.googleapis.com/v0/b/locket-img/o/users%2F${clean}%2Fpublic%2Fprofile_pic.webp?alt=media`,
      uid: clean
    };
  }

  // Check cache
  const cached = avatarCache.get(clean.toLowerCase());
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    return { success: true, username: clean, avatar_url: cached.avatar_url, uid: cached.uid };
  }

  // Resolver 1: Try query Firebase Storage direct check or upstream CDN
  try {
    const upstreamUrl = `https://vanduc.info.vn/locket/get_avatar.php?username=${encodeURIComponent(clean)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(upstreamUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)' }
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.avatar_url) {
        const uid = extractUidFromAvatarUrl(data.avatar_url) || clean;
        avatarCache.set(clean.toLowerCase(), {
          avatar_url: data.avatar_url,
          uid: uid,
          timestamp: Date.now()
        });
        return { success: true, username: clean, avatar_url: data.avatar_url, uid: uid };
      }
    }
  } catch (e) {}

  // Resolver 2: Check if upstream queue can resolve
  try {
    const qRes = await fetch('https://vanduc.info.vn/locket/queue_api.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'join', username: clean })
    });
    if (qRes.ok) {
      const qData = await qRes.json();
      if (qData.result) {
        try {
          const parsed = typeof qData.result === 'string' ? JSON.parse(qData.result) : qData.result;
          if (parsed.data && parsed.data.uid) {
            const uid = parsed.data.uid;
            const avatar = `https://firebasestorage.googleapis.com/v0/b/locket-img/o/users%2F${uid}%2Fpublic%2Fprofile_pic.webp?alt=media`;
            avatarCache.set(clean.toLowerCase(), { avatar_url: avatar, uid: uid, timestamp: Date.now() });
            return { success: true, username: clean, avatar_url: avatar, uid: uid };
          }
        } catch (err) {}
      }
    }
  } catch (e) {}

  return {
    success: false,
    username: clean,
    message: 'Không thể tự động tìm thấy UID từ Username này. Bạn có thể sao chép Link Chia Sẻ (locket.cam/...) từ trong app Locket hoặc nhập trực tiếp UID!'
  };
}

// Routes for Avatar Resolver
app.get(['/get_avatar.php', '/api/avatar', '/api/profile/:username'], async (req, res) => {
  const username = req.query.username || req.params.username;
  if (!username) {
    return res.status(400).json({ success: false, message: 'Thiếu tham số username' });
  }

  const result = await resolveLocketProfile(username);
  res.json(result);
});

// ==========================================
// 3. REAL REVENUECAT INJECTION (100% INDEPENDENT ON LOCAL SERVER)
// ==========================================
async function injectRevenueCatToken(targetUid) {
  try {
    const payload = {
      fetch_token: MASTER_FETCH_TOKEN,
      app_user_id: targetUid,
      is_restore: true,
      product_id: 'locket_199_1m',
      price: '49000',
      currency: 'VND',
      store_country: 'VNM'
    };

    const res = await fetch('https://api.revenuecat.com/v1/receipts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOCKET_RC_KEY}`,
        'Content-Type': 'application/json',
        'X-Platform': 'iOS',
        'X-StoreKit-Version': '2',
        'X-StoreKit2-Enabled': 'true',
        'X-Client-Bundle-ID': 'com.locket.Locket',
        'User-Agent': 'Locket/1533 CFNetwork/3860.600.12 Darwin/25.5.0'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    return { status: res.status, data };
  } catch (err) {
    console.error('[RevenueCat Direct Injection Error]:', err.message);
    return { status: 500, error: err.message };
  }
}

// Queue API Routes
app.post(['/queue_api.php', '/api/queue', '/api/queue/join'], async (req, res) => {
  const body = req.body || {};
  const action = body.action || (req.path.includes('join') ? 'join' : 'status');
  const rawInput = (body.username || '').trim();

  if (!rawInput && action !== 'global_status') {
    return res.status(400).json({ success: false, message: 'Vui lòng cung cấp Username hoặc UID' });
  }

  // Handle JOIN action: Perform Direct RevenueCat Injection!
  if (action === 'join') {
    const userProfile = await resolveLocketProfile(rawInput);
    if (!userProfile.success || !userProfile.uid) {
      return res.json({
        success: false,
        message: userProfile.message || 'Không tìm thấy UID tài khoản Locket. Hãy thử dán Link Chia Sẻ Locket (locket.cam/...) từ trong app!'
      });
    }

    console.log(`[🚀 Direct Injection] Target UID: ${userProfile.uid} (Input: ${rawInput})`);
    const injectResult = await injectRevenueCatToken(userProfile.uid);

    if (injectResult.status === 200) {
      return res.json({
        success: true,
        user_status: 'success',
        position: 0,
        result: JSON.stringify({
          status: 'success',
          code: 'ACTIVATION_SUCCESS',
          message: `Kích hoạt Locket Gold thành công cho @${userProfile.username}!`,
          data: {
            username: userProfile.username,
            uid: userProfile.uid,
            product_id: 'locket_199_1m',
            dns_link: '/get_config.php'
          }
        })
      });
    } else {
      return res.json({
        success: false,
        message: 'Lỗi kích hoạt trên máy chủ RevenueCat. Vui lòng thử lại!'
      });
    }
  }

  // Handle STATUS action
  if (action === 'status') {
    return res.json({
      success: true,
      username: rawInput,
      user_status: 'success',
      position: 0,
      waiting_count: 0
    });
  }

  res.json({ success: true });
});

// ==========================================
// 4. REAL MOBILECONFIG & CONFIGURATION DOWNLOAD
// ==========================================
app.get(['/get_config.php', '/api/config', '/LacVietMedia.mobileconfig', '/vanduclocket.mobileconfig'], (req, res) => {
  const filePath = path.join(__dirname, 'public', 'LacVietMedia.mobileconfig');
  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Type', 'application/x-apple-aspen-config; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="LacVietMedia.mobileconfig"');
    return res.sendFile(filePath);
  }
  res.redirect('https://vnramdisk.io.vn/vip/vanduclocket.mobileconfig');
});

// ==========================================
// 5. HEALTH & STATS
// ==========================================
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    masterTokenConfigured: !!MASTER_FETCH_TOKEN,
    cachedUsers: avatarCache.size
  });
});

// Start Server if run directly
if (process.env.NODE_ENV !== 'production' || process.env.PORT) {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`  🚀 LOCKET GOLD INDEPENDENT PORTAL (PRODUCTION) `);
    console.log(`  🔗 Running at: http://localhost:${PORT} `);
    console.log(`  🔑 Direct RevenueCat Injection: ACTIVE `);
    console.log(`====================================================`);
  });
}

module.exports = app;
