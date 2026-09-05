const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Prevent browser/proxy cache for all API routes
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// Master RevenueCat Configuration
const LOCKET_RC_KEY = 'appl_JngFETzdodyLmCREOlwTUtXdQik';
let MASTER_FETCH_TOKEN = "510002836840566";
let MASTER_EXPIRES_DATE = "2026-10-03T11:26:26Z";
let DEFAULT_PRICE = 50000; // 50.000 VND / acc

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const LOCAL_USERS_FILE = path.join(DATA_DIR, 'users.json');
const LOCAL_MASTERS_FILE = path.join(DATA_DIR, 'masters.json');
const LOCAL_SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// Initialize settings
if (!fs.existsSync(LOCAL_SETTINGS_FILE)) {
  fs.writeFileSync(LOCAL_SETTINGS_FILE, JSON.stringify({
    default_price: DEFAULT_PRICE,
    auto_scan_hours: 6,
    last_scan: null,
    expiring_soon_count: 0
  }, null, 2), 'utf8');
}

// -------------------------------------------------------------
// HELPER: GET LAN IP ADDRESS
// -------------------------------------------------------------
function getLanIp() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

// -------------------------------------------------------------
// HELPER: SYNC USERS ACROSS ALL DATA FILES
// -------------------------------------------------------------
function getAllUsersMap() {
  const paths = [
    LOCAL_USERS_FILE,
    path.join(__dirname, '..', 'locket-no-dns', 'data', 'users.json'),
    path.join(__dirname, '..', 'locket-no-dns-15s', 'data', 'users.json')
  ];

  const userMap = new Map();

  paths.forEach(filePath => {
    if (fs.existsSync(filePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        for (const [uid, u] of Object.entries(data)) {
          if (!userMap.has(uid)) {
            userMap.set(uid, {
              uid,
              customer_uid: uid,
              username: u.username || 'customer_' + uid.substring(0, 6),
              master_uid: u.master_uid || 'C2A5eSIG79UquwvohWpirajDTVx2',
              has_gold: u.has_gold !== false,
              video_15s: !!u.video_15s_unlocked,
              expires_date: u.expires_date || MASTER_EXPIRES_DATE,
              upgraded_at: u.upgraded_at || new Date().toISOString(),
              price: u.price || DEFAULT_PRICE,
              payment_status: u.payment_status || 'paid', // 'paid' | 'pending'
              channel: u.channel || 'zalo', // 'zalo' | 'facebook' | 'tiktok' | 'direct'
              avatar: u.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(u.username || uid)}&backgroundColor=f59e0b,fbbf24&textColor=ffffff&fontWeight=700`,
              notes: u.notes || ''
            });
          } else {
            const existing = userMap.get(uid);
            if (u.video_15s_unlocked) existing.video_15s = true;
            if (u.username && u.username !== 'N/A' && !existing.username.startsWith('customer_')) {
              existing.username = u.username;
            }
            if (u.avatar) existing.avatar = u.avatar;
            if (u.payment_status) existing.payment_status = u.payment_status;
            if (u.channel) existing.channel = u.channel;
          }
        }
      } catch (err) {
        console.error('Error reading:', filePath, err.message);
      }
    }
  });

  return userMap;
}

function saveUserToAllFiles(userObj) {
  const uid = userObj.customer_uid || userObj.uid;
  if (!uid) return;

  const targetFiles = [
    LOCAL_USERS_FILE,
    path.join(__dirname, '..', 'locket-no-dns', 'data', 'users.json'),
    path.join(__dirname, '..', 'locket-no-dns-15s', 'data', 'users.json')
  ];

  targetFiles.forEach(filePath => {
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      let users = {};
      if (fs.existsSync(filePath)) {
        users = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      }

      users[uid] = {
        username: userObj.username || 'customer_' + uid.substring(0, 6),
        customer_uid: uid,
        master_uid: userObj.master_uid || "C2A5eSIG79UquwvohWpirajDTVx2",
        has_gold: true,
        video_15s_unlocked: !!userObj.video_15s,
        expires_date: userObj.expires_date || MASTER_EXPIRES_DATE,
        upgraded_at: userObj.upgraded_at || new Date().toISOString(),
        price: userObj.price || DEFAULT_PRICE,
        payment_status: userObj.payment_status || 'paid',
        channel: userObj.channel || 'zalo',
        avatar: userObj.avatar || '',
        notes: userObj.notes || ''
      };

      fs.writeFileSync(filePath, JSON.stringify(users, null, 2), 'utf8');
    } catch (e) {
      console.error('Error writing user to:', filePath, e.message);
    }
  });
}

function deleteUserFromAllFiles(uid) {
  const targetFiles = [
    LOCAL_USERS_FILE,
    path.join(__dirname, '..', 'locket-no-dns', 'data', 'users.json'),
    path.join(__dirname, '..', 'locket-no-dns-15s', 'data', 'users.json')
  ];

  targetFiles.forEach(filePath => {
    try {
      if (fs.existsSync(filePath)) {
        const users = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (users[uid]) {
          delete users[uid];
          fs.writeFileSync(filePath, JSON.stringify(users, null, 2), 'utf8');
        }
      }
    } catch (e) {}
  });
}

// -------------------------------------------------------------
// SMART LOCKET PROFILE RESOLVER (CRAWLER & EXTRACTOR)
// -------------------------------------------------------------
function resolveLocketProfile(input) {
  return new Promise((resolve) => {
    if (!input || typeof input !== 'string') {
      return resolve({ success: false, message: 'Vui lòng nhập Link hoặc Username Locket' });
    }

    let clean = input.trim();
    const linkMatch = clean.match(/locket\.(?:cam|camera)(?:\/links)?\/([a-zA-Z0-9._-]+)/i);
    if (linkMatch) clean = linkMatch[1];
    clean = clean.replace(/^@/, '').trim();

    // Check if input is direct 28-char Firebase UID
    if (/^[a-zA-Z0-9_-]{28}$/.test(clean)) {
      return resolve({
        success: true,
        username: clean,
        uid: clean,
        avatar: `https://firebasestorage.googleapis.com/v0/b/locket-img/o/users%2F${clean}%2Fpublic%2Fprofile_pic.webp?alt=media`,
        message: 'Đã nhận diện trực tiếp chuỗi Firebase UID'
      });
    }

    // Scrape Locket Web Profile
    const options = {
      hostname: 'locket.cam',
      path: '/' + encodeURIComponent(clean),
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      }
    };

    const req = https.request(options, (res) => {
      let html = '';
      res.on('data', chunk => html += chunk);
      res.on('end', () => {
        const fullAvatarMatch = html.match(/src=([^\s>]+profile_pic[^\s>]+)/i) || html.match(/src=["']([^"']*profile_pic[^"']*)["']/i);
        const inviteMatch = html.match(/locket\.camera(?:\/|%2F)invites(?:\/|%2F)([a-zA-Z0-9_-]{28})/i) || html.match(/invites(?:\/|%2F)([a-zA-Z0-9_-]{28})/i);
        const uidMatch = html.match(/users(?:\/|%2F)([a-zA-Z0-9_-]{20,40})(?:\/|%2F)public/i);

        let uid = (inviteMatch ? inviteMatch[1] : null) || (uidMatch ? uidMatch[1] : null);
        let avatar = fullAvatarMatch ? fullAvatarMatch[1].replace(/["']/g, '') : null;

        if (!avatar && uid) {
          avatar = `https://firebasestorage.googleapis.com/v0/b/locket-img/o/users%2F${uid}%2Fpublic%2Fprofile_pic.webp?alt=media`;
        }
        if (!avatar) {
          avatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(clean)}&backgroundColor=f59e0b,fbbf24&textColor=ffffff&fontWeight=700`;
        }

        resolve({
          success: !!uid,
          username: clean,
          uid: uid || null,
          avatar: avatar,
          message: uid ? 'Tìm thấy UID và Avatar thành công!' : 'Không tìm thấy UID tự động từ web, vui lòng dán UID thủ công.'
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        success: false,
        username: clean,
        uid: null,
        avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(clean)}&backgroundColor=f59e0b,fbbf24&textColor=ffffff&fontWeight=700`,
        message: 'Lỗi mạng khi cào web: ' + err.message
      });
    });

    req.end();
  });
}

// -------------------------------------------------------------
// REVENUECAT INJECTION & VERIFICATION
// -------------------------------------------------------------
function injectToRevenueCat(uid, is15s = true) {
  return new Promise((resolve) => {
    const payload = {
      app_user_id: uid,
      fetch_token: MASTER_FETCH_TOKEN,
      price: 3.99,
      currency: "USD",
      is_restore: true,
      attributes: {
        "$storefront": { value: is15s ? "USA" : "VNM" },
        "$appVersion": { value: "1.144.0" },
        "platform": { value: "iOS" },
        "video_15s_enabled": { value: is15s ? "true" : "false" }
      }
    };

    const postData = JSON.stringify(payload);
    const options = {
      hostname: 'api.revenuecat.com',
      path: '/v1/receipts',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + LOCKET_RC_KEY,
        'Content-Type': 'application/json',
        'X-Platform': 'ios',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ success: res.statusCode >= 200 && res.statusCode < 300, statusCode: res.statusCode, data: json });
        } catch (e) {
          resolve({ success: false, statusCode: res.statusCode, error: body });
        }
      });
    });

    req.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });

    req.write(postData);
    req.end();
  });
}

function queryRevenueCatLive(uid) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.revenuecat.com',
      path: '/v1/subscribers/' + encodeURIComponent(uid),
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + LOCKET_RC_KEY,
        'X-Platform': 'ios',
        'User-Agent': 'Locket/1.144.0 (iPhone; iOS 18.0; Scale/3.00)'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          const sub = json.subscriber;
          if (!sub) {
            return resolve({ uid, is_live: false, status: 'NO_DATA', expires_date: null, days_left: 0 });
          }

          const gold = sub.entitlements && sub.entitlements.Gold;
          const now = new Date();
          const expiresDate = gold ? gold.expires_date : null;
          const isLive = !!(gold && (!expiresDate || new Date(expiresDate) > now));

          let daysLeft = 0;
          if (expiresDate) {
            const diff = new Date(expiresDate).getTime() - now.getTime();
            daysLeft = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
          }

          let subKey = sub.subscriptions ? Object.keys(sub.subscriptions)[0] : null;
          let subObj = subKey ? sub.subscriptions[subKey] : null;

          resolve({
            uid,
            is_live: isLive,
            status: isLive ? 'ACTIVE' : 'DROPPED',
            gold_product: (gold && gold.product_identifier) || subKey || 'locket_199_1m',
            expires_date: expiresDate || (subObj && subObj.expires_date) || MASTER_EXPIRES_DATE,
            purchase_date: (gold && gold.purchase_date) || (subObj && subObj.purchase_date) || null,
            days_left: daysLeft,
            store: (gold && gold.store) || (subObj && subObj.store) || 'app_store'
          });
        } catch (e) {
          resolve({ uid, is_live: false, status: 'PARSE_ERROR', error: e.message });
        }
      });
    });

    req.on('error', (err) => {
      resolve({ uid, is_live: false, status: 'NET_ERROR', error: err.message });
    });

    req.end();
  });
}

// -------------------------------------------------------------
// API ROUTES
// -------------------------------------------------------------

// 1. Network Info (Mobile LAN & QR Code)
app.get('/api/network-info', (req, res) => {
  const lanIp = getLanIp();
  const mobileUrl = `http://${lanIp}:${PORT}`;
  res.json({
    lan_ip: lanIp,
    port: PORT,
    local_url: `http://localhost:${PORT}`,
    mobile_url: mobileUrl,
    qr_url: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(mobileUrl)}&color=ffcc00&bgcolor=141620`
  });
});

// 2. Smart Profile Resolver
app.all(['/api/resolve', '/api/resolve-locket-profile'], async (req, res) => {
  const input = req.body?.input || req.query?.input || '';
  const result = await resolveLocketProfile(input);
  res.json(result);
});

// 2b. Single User RevenueCat Live Scanner
app.get('/api/revenuecat-check/:uid', async (req, res) => {
  const uid = req.params.uid;
  const rc = await queryRevenueCatLive(uid);
  res.json(rc);
});

// 3. Get All Users (with Financial CRM Stats)
app.get('/api/users', (req, res) => {
  const userMap = getAllUsersMap();
  const users = Array.from(userMap.values());

  let totalRevenue = 0;
  let paidRevenue = 0;
  let pendingRevenue = 0;

  users.forEach(u => {
    const p = Number(u.price) || DEFAULT_PRICE;
    totalRevenue += p;
    if (u.payment_status === 'paid') paidRevenue += p;
    else pendingRevenue += p;
  });

  res.json({
    total: users.length,
    total_revenue: totalRevenue,
    paid_revenue: paidRevenue,
    pending_revenue: pendingRevenue,
    users
  });
});

// 4. Scan All Live API
app.get('/api/scan-all', async (req, res) => {
  const userMap = getAllUsersMap();
  const users = Array.from(userMap.values());
  const scanResults = [];

  for (let i = 0; i < users.length; i += 5) {
    const batch = users.slice(i, i + 5);
    const promises = batch.map(async (u) => {
      const rc = await queryRevenueCatLive(u.uid);
      return { ...u, ...rc };
    });
    scanResults.push(...(await Promise.all(promises)));
  }

  const liveCount = scanResults.filter(r => r.is_live).length;
  const deadCount = scanResults.filter(r => !r.is_live).length;
  const expiringSoon = scanResults.filter(r => r.days_left > 0 && r.days_left <= 3).length;

  res.json({
    timestamp: new Date().toISOString(),
    total: scanResults.length,
    liveCount,
    deadCount,
    expiringSoon,
    results: scanResults
  });
});

// 5. Fast Upgrade (Single)
app.post('/api/upgrade', async (req, res) => {
  const { username, uid, mode = '15s', price = DEFAULT_PRICE, payment_status = 'paid', channel = 'zalo', notes = '', avatar = '' } = req.body;
  if (!uid || typeof uid !== 'string' || uid.trim().length < 10) {
    return res.status(400).json({ success: false, error: 'UID Locket không hợp lệ!' });
  }

  const cleanUid = uid.trim();
  const cleanUsername = (username || 'customer_' + cleanUid.substring(0, 6)).trim().replace('@', '');
  const is15s = mode === '15s' || mode === 'nodns15s';

  // Inject to RevenueCat
  const injectRes = await injectToRevenueCat(cleanUid, is15s);

  // Save record
  const userObj = {
    username: cleanUsername,
    customer_uid: cleanUid,
    uid: cleanUid,
    master_uid: "C2A5eSIG79UquwvohWpirajDTVx2",
    has_gold: true,
    video_15s: is15s,
    expires_date: MASTER_EXPIRES_DATE,
    upgraded_at: new Date().toISOString(),
    price: Number(price) || DEFAULT_PRICE,
    payment_status,
    channel,
    avatar: avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanUsername)}&backgroundColor=f59e0b,fbbf24&textColor=ffffff&fontWeight=700`,
    notes
  };

  saveUserToAllFiles(userObj);

  res.json({
    success: true,
    message: `Đã nâng cấp thành công Locket Gold cho @${cleanUsername}!`,
    user: userObj,
    rc_result: injectRes
  });
});

// 6. Bulk Fast Upgrade
app.post('/api/upgrade/bulk', async (req, res) => {
  const { entries, mode = '15s', price = DEFAULT_PRICE, channel = 'zalo' } = req.body;
  if (!entries || !Array.isArray(entries)) {
    return res.status(400).json({ success: false, error: 'Danh sách không hợp lệ' });
  }

  const results = [];
  for (const item of entries) {
    const cleanUid = (item.uid || '').trim();
    if (cleanUid.length >= 10) {
      const cleanUsername = (item.username || 'customer_' + cleanUid.substring(0, 6)).trim().replace('@', '');
      const is15s = mode === '15s' || mode === 'nodns15s';
      await injectToRevenueCat(cleanUid, is15s);

      const userObj = {
        username: cleanUsername,
        customer_uid: cleanUid,
        uid: cleanUid,
        master_uid: "C2A5eSIG79UquwvohWpirajDTVx2",
        has_gold: true,
        video_15s: is15s,
        expires_date: MASTER_EXPIRES_DATE,
        upgraded_at: new Date().toISOString(),
        price: Number(price) || DEFAULT_PRICE,
        payment_status: 'paid',
        channel: channel || 'zalo'
      };
      saveUserToAllFiles(userObj);
      results.push(userObj);
    }
  }

  res.json({ success: true, processed: results.length, users: results });
});

// 7. Bulk Admin Actions (Multi-select)
app.post('/api/users/bulk-action', async (req, res) => {
  const { action, uids = [] } = req.body;
  if (!Array.isArray(uids) || uids.length === 0) {
    return res.status(400).json({ success: false, error: 'Chưa chọn tài khoản nào' });
  }

  const userMap = getAllUsersMap();

  if (action === 'delete') {
    uids.forEach(uid => deleteUserFromAllFiles(uid));
    return res.json({ success: true, message: `Đã xóa ${uids.length} tài khoản!` });
  }

  if (action === 'mark_paid') {
    uids.forEach(uid => {
      const u = userMap.get(uid);
      if (u) {
        u.payment_status = 'paid';
        saveUserToAllFiles(u);
      }
    });
    return res.json({ success: true, message: `Đã đánh dấu đã thanh toán cho ${uids.length} tài khoản!` });
  }

  if (action === 're_upgrade') {
    for (const uid of uids) {
      const u = userMap.get(uid);
      if (u) {
        await injectToRevenueCat(uid, !!u.video_15s);
        u.upgraded_at = new Date().toISOString();
        u.expires_date = MASTER_EXPIRES_DATE;
        saveUserToAllFiles(u);
      }
    }
    return res.json({ success: true, message: `Đã gia hạn thành công cho ${uids.length} tài khoản!` });
  }

  res.status(400).json({ success: false, error: 'Hành động không hợp lệ' });
});

// 8. Delete Single User
app.delete('/api/users/:uid', (req, res) => {
  const uid = req.params.uid;
  deleteUserFromAllFiles(uid);
  res.json({ success: true, message: 'Đã xóa tài khoản khỏi hệ thống!', uid });
});

// 9. Update Single User
app.put('/api/users/:uid', (req, res) => {
  const uid = req.params.uid;
  const userMap = getAllUsersMap();
  const existing = userMap.get(uid) || { uid, customer_uid: uid };
  const updated = { ...existing, ...req.body, uid, customer_uid: uid };
  saveUserToAllFiles(updated);
  res.json({ success: true, user: updated });
});

// -------------------------------------------------------------
// HELPER: LOAD & SYNC MASTER KEYS POOL
// -------------------------------------------------------------
function loadMasterData() {
  let masterData = {
    active_id: "MASTER_01",
    active_token: MASTER_FETCH_TOKEN,
    expires_date: MASTER_EXPIRES_DATE,
    keys: [
      {
        id: "MASTER_01",
        name: "Master Node 01 (StoreKit 2 Gold Active)",
        fetch_token: MASTER_FETCH_TOKEN,
        expires_date: MASTER_EXPIRES_DATE,
        status: "active",
        created_at: new Date().toISOString(),
        notes: "StoreKit 2 Master Key đang hoạt động ổn định"
      }
    ]
  };

  if (fs.existsSync(LOCAL_MASTERS_FILE)) {
    try {
      const d = JSON.parse(fs.readFileSync(LOCAL_MASTERS_FILE, 'utf8'));
      if (d.keys && Array.isArray(d.keys)) {
        masterData = d;
        if (d.active_token) MASTER_FETCH_TOKEN = d.active_token;
        if (d.expires_date) MASTER_EXPIRES_DATE = d.expires_date;
      } else if (d.active_token) {
        masterData.active_token = d.active_token;
        masterData.expires_date = d.expires_date || MASTER_EXPIRES_DATE;
        masterData.keys[0].fetch_token = d.active_token;
        masterData.keys[0].expires_date = d.expires_date || MASTER_EXPIRES_DATE;
      }
    } catch (e) {}
  }

  return masterData;
}

function saveMasterData(masterData) {
  try {
    fs.writeFileSync(LOCAL_MASTERS_FILE, JSON.stringify(masterData, null, 2), 'utf8');

    // Also sync to other folders
    const paths = [
      path.join(__dirname, '..', 'locket-no-dns', 'data', 'masters.json'),
      path.join(__dirname, '..', 'locket-no-dns-15s', 'data', 'masters.json')
    ];
    paths.forEach(p => {
      try {
        if (fs.existsSync(path.dirname(p))) {
          fs.writeFileSync(p, JSON.stringify(masterData.keys || [masterData], null, 2), 'utf8');
        }
      } catch (e) {}
    });
  } catch (err) {
    console.error('Error saving master data:', err.message);
  }
}

// -------------------------------------------------------------
// 10. MASTER KEY POOL API ROUTES
// -------------------------------------------------------------
app.get('/api/masters', (req, res) => {
  const masterData = loadMasterData();
  res.json({
    active_id: masterData.active_id,
    active_token: masterData.active_token || MASTER_FETCH_TOKEN,
    expires_date: masterData.expires_date || MASTER_EXPIRES_DATE,
    api_key: LOCKET_RC_KEY,
    keys: masterData.keys || []
  });
});

app.post('/api/masters/add', (req, res) => {
  const { name, fetch_token, expires_date, notes = '', set_active = false } = req.body;
  if (!fetch_token || fetch_token.trim().length < 5) {
    return res.status(400).json({ success: false, error: 'Mã Fetch Token / Transaction ID không hợp lệ!' });
  }

  const masterData = loadMasterData();
  const cleanToken = fetch_token.trim();
  const cleanName = (name || 'Master Key ' + (masterData.keys.length + 1)).trim();
  const cleanExpiry = (expires_date || '2026-10-03T11:26:26Z').trim();
  const newId = 'MASTER_' + String(Date.now()).slice(-4);

  const newKey = {
    id: newId,
    name: cleanName,
    fetch_token: cleanToken,
    expires_date: cleanExpiry,
    status: set_active ? 'active' : 'standby',
    created_at: new Date().toISOString(),
    notes: notes.trim()
  };

  if (set_active) {
    masterData.keys.forEach(k => k.status = 'standby');
    masterData.active_id = newId;
    masterData.active_token = cleanToken;
    masterData.expires_date = cleanExpiry;
    MASTER_FETCH_TOKEN = cleanToken;
    MASTER_EXPIRES_DATE = cleanExpiry;
  }

  masterData.keys.unshift(newKey);
  saveMasterData(masterData);

  res.json({
    success: true,
    message: `Đã thêm thành công Key "${cleanName}" vào Kho Khóa!`,
    key: newKey,
    masterData
  });
});

app.post('/api/masters/activate/:id', (req, res) => {
  const keyId = req.params.id;
  const masterData = loadMasterData();
  const targetKey = masterData.keys.find(k => k.id === keyId);

  if (!targetKey) {
    return res.status(404).json({ success: false, error: 'Không tìm thấy Key này trong kho!' });
  }

  masterData.keys.forEach(k => k.status = (k.id === keyId ? 'active' : 'standby'));
  masterData.active_id = targetKey.id;
  masterData.active_token = targetKey.fetch_token;
  masterData.expires_date = targetKey.expires_date || MASTER_EXPIRES_DATE;

  MASTER_FETCH_TOKEN = targetKey.fetch_token;
  MASTER_EXPIRES_DATE = targetKey.expires_date || MASTER_EXPIRES_DATE;

  saveMasterData(masterData);

  res.json({
    success: true,
    message: `Đã kích hoạt "${targetKey.name}" làm Master Key chính thành công!`,
    active_key: targetKey
  });
});

app.delete('/api/masters/:id', (req, res) => {
  const keyId = req.params.id;
  const masterData = loadMasterData();

  if (masterData.keys.length <= 1) {
    return res.status(400).json({ success: false, error: 'Không thể xóa khi trong kho chỉ còn đúng 1 Key duy nhất!' });
  }

  const idx = masterData.keys.findIndex(k => k.id === keyId);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: 'Không tìm thấy Key để xóa!' });
  }

  const deletedKey = masterData.keys.splice(idx, 1)[0];

  // If deleted the active key, activate the first remaining key
  if (masterData.active_id === keyId && masterData.keys.length > 0) {
    masterData.keys[0].status = 'active';
    masterData.active_id = masterData.keys[0].id;
    masterData.active_token = masterData.keys[0].fetch_token;
    masterData.expires_date = masterData.keys[0].expires_date;
    MASTER_FETCH_TOKEN = masterData.keys[0].fetch_token;
    MASTER_EXPIRES_DATE = masterData.keys[0].expires_date;
  }

  saveMasterData(masterData);

  res.json({
    success: true,
    message: `Đã xóa "${deletedKey.name}" khỏi Kho Khóa!`,
    deletedId: keyId
  });
});

app.post('/api/masters/test', async (req, res) => {
  const { fetch_token } = req.body;
  if (!fetch_token) {
    return res.status(400).json({ success: false, error: 'Chưa nhập Fetch Token để kiểm tra!' });
  }

  // Test token with a test payload to RevenueCat
  const testPayload = {
    app_user_id: "test_master_check_" + Date.now(),
    fetch_token: fetch_token.trim(),
    price: 3.99,
    currency: "USD",
    is_restore: true
  };

  const postData = JSON.stringify(testPayload);
  const options = {
    hostname: 'api.revenuecat.com',
    path: '/v1/receipts',
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + LOCKET_RC_KEY,
      'Content-Type': 'application/json',
      'X-Platform': 'ios',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const reqRc = https.request(options, (resRc) => {
    let body = '';
    resRc.on('data', c => body += c);
    resRc.on('end', () => {
      try {
        const json = JSON.parse(body);
        if (resRc.statusCode >= 200 && resRc.statusCode < 300) {
          res.json({ success: true, message: '🟢 Token HỢP LỆ và phản hồi tốt từ Apple/RevenueCat!', data: json });
        } else {
          res.json({ success: false, message: '🔴 Token không hợp lệ hoặc đã hết hạn trên Apple.', data: json });
        }
      } catch (e) {
        res.json({ success: false, message: 'Lỗi parse dữ liệu từ RevenueCat: ' + body });
      }
    });
  });

  reqRc.on('error', (err) => {
    res.status(500).json({ success: false, error: 'Lỗi kết nối: ' + err.message });
  });

  reqRc.write(postData);
  reqRc.end();
});

// 11. System Full Backup Export
app.get('/api/backup', (req, res) => {
  const userMap = getAllUsersMap();
  const users = Array.from(userMap.values());
  const masterData = loadMasterData();

  const backupData = {
    exported_at: new Date().toISOString(),
    system_version: "3.5 PRO",
    master_key: {
      active_token: MASTER_FETCH_TOKEN,
      expires_date: MASTER_EXPIRES_DATE,
      api_key: LOCKET_RC_KEY,
      pool: masterData.keys
    },
    total_users: users.length,
    users
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="Locket_Master_Backup_${new Date().toISOString().slice(0, 10)}.json"`);
  res.send(JSON.stringify(backupData, null, 2));
});

// 11. Profile & Module Downloads
app.get(['/get_config.php', '/api/config', '/LacVietMedia.mobileconfig', '/vanduclocket.mobileconfig'], (req, res) => {
  const filePath = path.join(__dirname, 'public', 'LacVietMedia.mobileconfig');
  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Type', 'application/x-apple-aspen-config');
    res.setHeader('Content-Disposition', 'attachment; filename="LacVietMedia.mobileconfig"');
    return res.sendFile(filePath);
  }
  res.redirect('https://vnramdisk.io.vn/vip/vanduclocket.mobileconfig');
});

app.get(['/locket.sgmodule', '/module.sgmodule'], (req, res) => {
  const filePath = path.join(__dirname, 'public', 'locket.sgmodule');
  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.sendFile(filePath);
  }
  res.send('#!name=Locket Gold\n[MITM]\nhostname = %APPEND% api.revenuecat.com');
});

// Start Server
if (process.env.NODE_ENV !== 'production' || process.env.PORT) {
  app.listen(PORT, () => {
    const lanIp = getLanIp();
    console.log('======================================================');
    console.log(`🌟 LOCKET GOLD UNIFIED MASTER HUB v3.5 (PRO EDITION)`);
    console.log(`👉 Bảng Điều Khiển Máy Tính: http://localhost:${PORT}`);
    console.log(`📱 Điều Khiển Qua Điện Thoại: http://${lanIp}:${PORT}`);
    console.log('======================================================');
  });
}

module.exports = app;
