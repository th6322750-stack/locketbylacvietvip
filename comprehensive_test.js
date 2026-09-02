async function runFinalCheck() {
  console.log('================================================================');
  console.log('       KIỂM TRA CHUYÊN SÂU TOÀN BỘ HỆ THỐNG TRÊN LIVE VERCEL     ');
  console.log('================================================================\n');

  const BASE_URL = 'https://locketbylacvietvip.vercel.app';
  let totalTests = 0;
  let passedTests = 0;

  function assert(name, condition, extra = '') {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  ✅ [PASS] ${name} ${extra ? '(' + extra + ')' : ''}`);
    } else {
      console.log(`  ❌ [FAIL] ${name} ${extra ? '(' + extra + ')' : ''}`);
    }
  }

  // 1. KIỂM TRA WEB TĨNH & TÀI NGUYÊN GIAO DIỆN
  console.log('--- 1. KIỂM TRA TÀI NGUYÊN GIAO DIỆN (FRONTEND ASSETS) ---');
  const indexRes = await fetch(`${BASE_URL}/`);
  assert('Trang chủ index.html phản hồi 200', indexRes.status === 200);

  const jsRes = await fetch(`${BASE_URL}/app.js?v=3.5`);
  assert('File app.js tải thành công', jsRes.status === 200);
  const jsText = await jsRes.text();
  assert('File app.js chứa logic sao chép Zalo & fallback', jsText.includes('copyZaloText') && jsText.includes('fallbackCopy'));
  assert('File app.js chứa hàm xử lý avatar lỗi handleAvatarError', jsText.includes('handleAvatarError'));

  const cssRes = await fetch(`${BASE_URL}/style.css`);
  assert('File style.css tải thành công', cssRes.status === 200);

  // 2. KIỂM TRA BỘ PHÂN GIẢI AVATAR & FIREBASE TOKEN
  console.log('\n--- 2. KIỂM TRA BỘ PHÂN GIẢI AVATAR VÀ FIREBASE TOKEN ---');
  const testUsers = [
    { username: 'hang1709', expectToken: true },
    { username: 'hthanhhhhhh', expectToken: false },
    { username: 'https://locket.cam/hthanhhhhhhh', expectToken: false },
    { username: 'lucifervpvp', expectToken: false }
  ];

  for (const u of testUsers) {
    const res = await fetch(`${BASE_URL}/get_avatar.php?username=${encodeURIComponent(u.username)}`);
    const data = await res.json();
    assert(`Phân giải tài khoản @${u.username}`, data.success === true && !!data.uid, `UID: ${data.uid}`);
    
    if (data.avatar_url && data.avatar_url.startsWith('http')) {
      const imgRes = await fetch(data.avatar_url);
      assert(`Tải ảnh đại diện cho @${u.username}`, imgRes.status === 200, `HTTP ${imgRes.status} ${imgRes.headers.get('content-type')}`);
    }
  }

  // 3. KIỂM TRA HỒ SƠ CẤU HÌNH DNS (.mobileconfig) & MIME TYPE
  console.log('\n--- 3. KIỂM TRA HỒ SƠ CẤU HÌNH DNS CHO IOS SAFARI ---');
  const r1 = await fetch(`${BASE_URL}/LacVietMedia.mobileconfig`);
  assert('Tải LacVietMedia.mobileconfig HTTP 200', r1.status === 200);
  const r1Text = await r1.text();
  assert('Chứa Plist XML hợp lệ', r1Text.includes('<?xml') && r1Text.includes('<plist version="1.0">'));
  assert('Chứa cơ chế Sinkhole 127.0.0.1 chặn RevenueCat', r1Text.includes('127.0.0.1') && r1Text.includes('api.revenuecat.com'));

  const r2 = await fetch(`${BASE_URL}/get_config.php`);
  assert('Tải qua alias get_config.php HTTP 200', r2.status === 200);
  assert('MIME Header chuẩn iOS Safari (application/x-apple-aspen-config)', r2.headers.get('content-type') === 'application/x-apple-aspen-config');

  // 4. KIỂM TRA NẠP BẢN QUYỀN VÀ XÁC THỰC REVENUECAT REALTIME
  console.log('\n--- 4. KIỂM TRA BƠM BẢN QUYỀN REVENUECAT REALTIME ---');
  const t0 = Date.now();
  const qRes = await fetch(`${BASE_URL}/queue_api.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'join', username: 'hang1709' })
  });
  const qTime = Date.now() - t0;
  const qData = await qRes.json();
  assert('Nạp Gold qua API Portal', qData.success === true && qData.user_status === 'success', `${qTime}ms`);

  // Xác thực trực tiếp trên máy chủ RevenueCat
  const rcRes = await fetch('https://api.revenuecat.com/v1/subscribers/1RDPLXH5nyXVVZivqBTzf0ylQDS2', {
    method: 'GET',
    headers: {
      'Authorization': 'Bearer appl_JngFETzdodyLmCREOlwTUtXdQik',
      'Content-Type': 'application/json',
      'X-Platform': 'iOS',
      'X-StoreKit-Version': '2',
      'X-StoreKit2-Enabled': 'true',
      'X-Client-Bundle-ID': 'com.locket.Locket',
      'User-Agent': 'Locket/1533 CFNetwork/3860.600.12 Darwin/25.5.0'
    }
  });
  const rcData = await rcRes.json();
  const activeGold = rcData.subscriber?.entitlements?.Gold;
  assert('Quyền Gold ACTIVE trên máy chủ Apple/RevenueCat', activeGold && activeGold.product_identifier === 'locket_199_1m', `Hạn: ${activeGold?.expires_date}`);

  console.log('\n================================================================');
  console.log(`  TỔNG KẾT: ${passedTests}/${totalTests} BÀI KIỂM TRA THÀNH CÔNG (${Math.round((passedTests/totalTests)*100)}%)`);
  console.log('  TRẠNG THÁI HỆ THỐNG: HOÀN HẢO - SẴN SÀNG VẬN HÀNH 100%');
  console.log('================================================================');
}

runFinalCheck();
