// =========================================================
// LOCKET GOLD AUTO-STOREFRONT ENGINE (v3.5 PRO)
// Real-time UID Scraper • VietQR Auto-Generator • 1-Touch Upgrade
// =========================================================

// Default Store Configuration
const STORE_CONFIG = {
  bank: {
    name: "VietinBank (Ngân Hàng Công Thương)",
    code: "ICB",
    accountNumber: "102668820501",
    accountName: "VIETINBANK",
  },
  packages: {
    'nodns-standard': {
      id: 'nodns-standard',
      name: 'No-DNS Chuẩn (Gold 1 Năm)',
      mode: 'nodns',
      price: 60000,
      badge: 'GÓI PHỔ BIẾN'
    },
    'nodns-15s': {
      id: 'nodns-15s',
      name: 'No-DNS 15s Video Ultra (Gói Hot)',
      mode: '15s',
      price: 89000,
      badge: '🔥 GÓI VIP BÁN CHẠY NHẤT'
    },
    'dns-cheap': {
      id: 'dns-cheap',
      name: 'Gói DNS / Shadowrocket',
      mode: 'dns',
      price: 35000,
      badge: 'TIẾT KIỆM'
    }
  }
};

let currentSelectedPkg = 'nodns-standard';
let appliedCoupon = null;
let resolvedCustomer = {
  username: '',
  uid: '',
  avatar: ''
};

// Initial setup on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  selectPackage('nodns-standard');
  startFloatingOrderTicker();

  // Enter key trigger for resolve
  const locketInput = document.getElementById('inputLocketCustomer');
  if (locketInput) {
    locketInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') resolveCustomerProfile();
    });
  }

  // Enter key trigger for coupon
  const couponInput = document.getElementById('inputCouponCode');
  if (couponInput) {
    couponInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') applyCouponCode();
    });
  }
});

// 1. SELECT PACKAGE & UPDATE VIETQR
function selectPackage(pkgId) {
  currentSelectedPkg = pkgId;
  const pkg = STORE_CONFIG.packages[pkgId];
  if (!pkg) return;

  // Highlight selected card
  document.querySelectorAll('.package-card').forEach(card => {
    card.classList.remove('selected');
    if (card.dataset.pkgId === pkgId) card.classList.add('selected');
  });

  // Update payment summary
  const pkgNameEl = document.getElementById('selectedPkgName');
  if (pkgNameEl) pkgNameEl.innerText = pkg.name;

  updatePaymentQR();
}

// 2. REAL-TIME SMART RESOLVER (Auto Scrapes Profile / UID)
async function resolveCustomerProfile() {
  const inputEl = document.getElementById('inputLocketCustomer');
  const btnEl = document.getElementById('btnResolveCustomer');
  const previewEl = document.getElementById('customerPreviewCard');
  
  const rawInput = inputEl ? inputEl.value.trim() : '';
  if (!rawInput) {
    alert('Vui lòng nhập Username hoặc Link Locket của bạn!');
    return;
  }

  btnEl.disabled = true;
  btnEl.innerHTML = '<span>⏳ Đang tìm...</span>';

  try {
    const res = await fetch('/api/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: rawInput })
    });

    const data = await res.json();
    if (data.success && data.uid) {
      resolvedCustomer = {
        username: data.username,
        uid: data.uid,
        avatar: data.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(data.username)}`
      };

      // Render Preview Card
      document.getElementById('previewAvatarImg').src = resolvedCustomer.avatar;
      document.getElementById('previewUsernameTxt').innerText = '@' + resolvedCustomer.username;
      document.getElementById('previewUidTxt').innerText = 'UID: ' + resolvedCustomer.uid;
      previewEl.style.display = 'flex';

      updatePaymentQR();
    } else {
      // Fallback: Use direct username
      let cleanName = rawInput.replace('@', '').trim();
      resolvedCustomer = {
        username: cleanName,
        uid: cleanName.length >= 20 ? cleanName : 'manual_' + Date.now(),
        avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanName)}&backgroundColor=f59e0b,fbbf24&textColor=ffffff&fontWeight=700`
      };

      document.getElementById('previewAvatarImg').src = resolvedCustomer.avatar;
      document.getElementById('previewUsernameTxt').innerText = '@' + resolvedCustomer.username;
      document.getElementById('previewUidTxt').innerText = 'Đã nhận diện Username. Sẵn sàng nạp!';
      previewEl.style.display = 'flex';

      updatePaymentQR();
    }
  } catch (err) {
    console.error('Resolve Error:', err);
    alert('Lỗi kết nối máy chủ khi cào thông tin: ' + err.message);
  } finally {
    btnEl.disabled = false;
    btnEl.innerHTML = '<span>🔍 Kiểm Tra</span>';
  }
}

// 3. GENERATE DYNAMIC VIETQR (With Coupon Calculation)
function updatePaymentQR() {
  const pkg = STORE_CONFIG.packages[currentSelectedPkg] || { price: 60000 };
  const rawUsername = resolvedCustomer.username || (document.getElementById('inputLocketCustomer')?.value.trim().replace('@', '')) || 'KHACH';
  const cleanUsername = rawUsername.toUpperCase().replace(/[^A-Z0-9_.-]/g, '').substring(0, 15) || 'KHACH';
  const cleanTransferContent = `SEVQR LOCKET ${cleanUsername}`.trim();

  // Calculate final amount
  let discountAmount = 0;
  if (appliedCoupon) {
    if (appliedCoupon.type === 'percent') {
      discountAmount = Math.round((pkg.price * appliedCoupon.value) / 100);
    } else {
      discountAmount = Number(appliedCoupon.discount || appliedCoupon.value) || 0;
    }
  }
  discountAmount = Math.min(discountAmount, Math.max(0, pkg.price - 10000));
  const finalPrice = Math.max(10000, pkg.price - discountAmount);

  // Update summary UI
  const pkgPriceEl = document.getElementById('selectedPkgPrice');
  if (pkgPriceEl) {
    if (discountAmount > 0) {
      pkgPriceEl.innerHTML = `<span style="text-decoration: line-through; color: #94a3b8; font-size: 14px; margin-right: 6px;">${pkg.price.toLocaleString('vi-VN')} đ</span><span style="color: var(--gold-glow); font-size: 19px; font-weight: 800;">${finalPrice.toLocaleString('vi-VN')} đ</span>`;
    } else {
      pkgPriceEl.innerHTML = `<span style="color: var(--gold-glow); font-size: 19px; font-weight: 800;">${pkg.price.toLocaleString('vi-VN')} đ</span>`;
    }
  }

  // Update discount detail row
  const discountRow = document.getElementById('discountDetailRow');
  const discountVal = document.getElementById('discountDetailVal');
  if (discountRow && discountVal) {
    if (discountAmount > 0) {
      discountRow.style.display = 'flex';
      discountVal.innerText = `-${discountAmount.toLocaleString('vi-VN')} đ (${appliedCoupon?.code || ''})`;
    } else {
      discountRow.style.display = 'none';
    }
  }

  // Update transfer content displays
  const contentEl = document.getElementById('transferContentTxt');
  if (contentEl) contentEl.innerText = cleanTransferContent;

  const bankAccEl = document.getElementById('bankAccTxt');
  if (bankAccEl) bankAccEl.innerText = STORE_CONFIG.bank.accountNumber;

  const bankNameEl = document.getElementById('bankNameTxt');
  if (bankNameEl) bankNameEl.innerText = STORE_CONFIG.bank.name;

  const bankOwnerEl = document.getElementById('bankOwnerTxt');
  if (bankOwnerEl) bankOwnerEl.innerText = STORE_CONFIG.bank.accountName;

  // VietQR QuickLink format with VietinBank & SEVQR & dynamic finalPrice
  const qrUrl = `https://img.vietqr.io/image/${STORE_CONFIG.bank.code}-${STORE_CONFIG.bank.accountNumber}-compact2.png?amount=${finalPrice}&addInfo=${encodeURIComponent(cleanTransferContent)}`;

  const qrImg = document.getElementById('vietQrImage');
  if (qrImg) {
    qrImg.src = qrUrl;
  }
}

// 3b. COUPON / DISCOUNT ENGINE
async function applyCouponCode() {
  const inputEl = document.getElementById('inputCouponCode');
  const btnEl = document.getElementById('btnApplyCoupon');
  const msgEl = document.getElementById('couponMessage');
  const appliedWrapEl = document.getElementById('appliedCouponWrap');

  const code = (inputEl ? inputEl.value : '').trim();
  if (!code) {
    if (msgEl) {
      msgEl.className = 'coupon-message error';
      msgEl.innerText = 'Vui lòng nhập mã giảm giá!';
      msgEl.style.display = 'block';
    }
    return;
  }

  const pkg = STORE_CONFIG.packages[currentSelectedPkg] || { price: 60000 };

  if (btnEl) {
    btnEl.disabled = true;
    btnEl.innerText = '⏳ Đang kiểm tra...';
  }

  try {
    const res = await fetch('/api/coupons/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code, price: pkg.price })
    });

    const data = await res.json();
    if (data.success && data.valid && data.coupon) {
      appliedCoupon = data.coupon;

      if (msgEl) {
        msgEl.className = 'coupon-message success';
        msgEl.innerText = `✓ ${data.message || 'Áp dụng mã thành công!'}`;
        msgEl.style.display = 'block';
      }

      if (appliedWrapEl) {
        document.getElementById('appliedCouponCodeTxt').innerText = appliedCoupon.code;
        document.getElementById('appliedCouponDiscountTxt').innerText = `-${appliedCoupon.discount.toLocaleString('vi-VN')} đ`;
        appliedWrapEl.style.display = 'flex';
      }

      if (inputEl) inputEl.value = '';
      updatePaymentQR();
      showToast(`Đã áp dụng mã ${appliedCoupon.code}: -${appliedCoupon.discount.toLocaleString('vi-VN')}đ`);
    } else {
      appliedCoupon = null;
      if (msgEl) {
        msgEl.className = 'coupon-message error';
        msgEl.innerText = data.message || 'Mã giảm giá không hợp lệ!';
        msgEl.style.display = 'block';
      }
      if (appliedWrapEl) appliedWrapEl.style.display = 'none';
      updatePaymentQR();
    }
  } catch (err) {
    if (msgEl) {
      msgEl.className = 'coupon-message error';
      msgEl.innerText = 'Lỗi kết nối máy chủ: ' + err.message;
      msgEl.style.display = 'block';
    }
  } finally {
    if (btnEl) {
      btnEl.disabled = false;
      btnEl.innerText = 'Áp Dụng';
    }
  }
}

function removeCouponCode() {
  appliedCoupon = null;
  const msgEl = document.getElementById('couponMessage');
  const appliedWrapEl = document.getElementById('appliedCouponWrap');
  if (msgEl) msgEl.style.display = 'none';
  if (appliedWrapEl) appliedWrapEl.style.display = 'none';
  updatePaymentQR();
  showToast('Đã hủy mã giảm giá');
}

// 4. SUBMIT ORDER & INSTANT ACTIVATION (1-Touch)
async function submitCustomerOrder() {
  const rawInput = document.getElementById('inputLocketCustomer')?.value.trim();
  if (!rawInput && !resolvedCustomer.uid) {
    alert('Vui lòng nhập Username hoặc Link Locket trước khi kích hoạt!');
    document.getElementById('inputLocketCustomer')?.focus();
    return;
  }

  const pkg = STORE_CONFIG.packages[currentSelectedPkg];
  const uid = resolvedCustomer.uid || rawInput;
  const username = resolvedCustomer.username || rawInput.replace('@', '');
  const avatar = resolvedCustomer.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(username)}`;

  const submitBtn = document.getElementById('btnSubmitOrder');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span>⚡ Đang gửi lệnh kích hoạt lên Apple...</span>';

  let discountAmount = 0;
  if (appliedCoupon) {
    if (appliedCoupon.type === 'percent') {
      discountAmount = Math.round((pkg.price * appliedCoupon.value) / 100);
    } else {
      discountAmount = Number(appliedCoupon.discount || appliedCoupon.value) || 0;
    }
  }
  discountAmount = Math.min(discountAmount, Math.max(0, pkg.price - 10000));
  const finalPrice = Math.max(10000, pkg.price - discountAmount);

  try {
    const res = await fetch('/api/upgrade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: username,
        uid: uid,
        mode: pkg.mode,
        price: finalPrice,
        payment_status: 'paid',
        channel: 'website_store',
        avatar: avatar,
        notes: `Khách đặt gói ${pkg.name}${appliedCoupon ? ` [Mã KM: ${appliedCoupon.code} (-${discountAmount.toLocaleString('vi-VN')}đ)]` : ''}`
      })
    });

    const data = await res.json();
    if (data.success) {
      showSuccessCelebration(data.user || { username, uid, mode: pkg.mode, price: pkg.price });
    } else {
      alert('Lỗi kích hoạt: ' + (data.error || 'Vui lòng liên hệ CSKH để được hỗ trợ ngay!'));
    }
  } catch (err) {
    alert('Lỗi kết nối máy chủ: ' + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<span>🚀 Tôi Đã Chuyển Khoản • Kích Hoạt Ngay</span>';
  }
}

// 5. SUCCESS CELEBRATION & WARRANTY CARD
function showSuccessCelebration(user) {
  // Fire Confetti
  triggerConfetti();

  // Populate Modal
  document.getElementById('modalSuccessUser').innerText = '@' + (user.username || 'Khách Hàng');
  document.getElementById('modalSuccessPkg').innerText = user.video_15s ? 'No-DNS 15s Video Ultra' : 'No-DNS Chuẩn (Gold 1 Năm)';
  
  const modal = document.getElementById('successModal');
  modal.classList.add('open');
}

function closeSuccessModal() {
  document.getElementById('successModal').classList.remove('open');
}

// 6. COPY HELPER
function copyText(text, msg = 'Đã sao chép vào bộ nhớ tạm!') {
  navigator.clipboard.writeText(text).then(() => {
    showToast(msg);
  }).catch(() => {
    prompt('Copy nội dung này:', text);
  });
}

function copyTransferContent() {
  const content = document.getElementById('transferContentTxt')?.innerText;
  if (content) copyText(content, 'Đã copy nội dung chuyển khoản!');
}

function copyBankAcc() {
  copyText(STORE_CONFIG.bank.accountNumber, 'Đã copy số tài khoản!');
}

// 7. TOAST NOTIFICATION HELPER
function showToast(msg) {
  let toast = document.getElementById('storeToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'storeToast';
    toast.style.cssText = 'position:fixed;top:20px;right:20px;background:#f59e0b;color:#000;padding:12px 20px;border-radius:12px;font-weight:700;font-size:14px;z-index:9999;box-shadow:0 10px 25px rgba(0,0,0,0.5);transition:all 0.3s ease;';
    document.body.appendChild(toast);
  }
  toast.innerText = msg;
  toast.style.opacity = '1';
  toast.style.transform = 'translateY(0)';
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-20px)';
  }, 2500);
}

// 8. LIVE FLOATING ORDER TICKER (Simulated + Live activity)
const RECENT_CUSTOMERS = [
  { u: 'nguyenquynhanh', pkg: 'No-DNS 15s Video Ultra', time: '1 phút trước' },
  { u: 'hang1709', pkg: 'No-DNS Chuẩn (Gold 1 Năm)', time: '3 phút trước' },
  { u: 'luciferismeeee', pkg: 'No-DNS 15s Video Ultra', time: '5 phút trước' },
  { u: 'longtran04', pkg: 'No-DNS 15s Video Ultra', time: '8 phút trước' },
  { u: 'linh_0810', pkg: 'No-DNS 15s Video Ultra', time: '10 phút trước' },
  { u: 'anhtuyetxikg', pkg: 'No-DNS Chuẩn (Gold 1 Năm)', time: '12 phút trước' }
];

function startFloatingOrderTicker() {
  const toastEl = document.getElementById('floatingOrderToast');
  if (!toastEl) return;

  let index = 0;
  setInterval(() => {
    const item = RECENT_CUSTOMERS[index % RECENT_CUSTOMERS.length];
    document.getElementById('tickerAvatar').src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(item.u)}&backgroundColor=f59e0b,fbbf24&textColor=ffffff&fontWeight=700`;
    document.getElementById('tickerUser').innerText = '@' + item.u;
    document.getElementById('tickerPkg').innerText = item.pkg;
    document.getElementById('tickerTime').innerText = item.time;

    toastEl.classList.add('show');
    setTimeout(() => {
      toastEl.classList.remove('show');
    }, 4500);

    index++;
  }, 9000);
}

// 9. SIMPLE CONFETTI EFFECT
function triggerConfetti() {
  const colors = ['#f59e0b', '#fbbf24', '#a855f7', '#ec4899', '#10b981', '#3b82f6'];
  for (let i = 0; i < 60; i++) {
    const confetti = document.createElement('div');
    confetti.style.cssText = `
      position: fixed;
      top: -10px;
      left: ${Math.random() * 100}vw;
      width: ${Math.random() * 10 + 6}px;
      height: ${Math.random() * 6 + 4}px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      opacity: 0.9;
      transform: rotate(${Math.random() * 360}deg);
      z-index: 10000;
      pointer-events: none;
      border-radius: 2px;
      transition: transform 3.5s cubic-bezier(0.25, 1, 0.5, 1), top 3.5s ease-in, opacity 3.5s ease-out;
    `;
    document.body.appendChild(confetti);

    setTimeout(() => {
      confetti.style.top = '105vh';
      confetti.style.transform = `rotate(${Math.random() * 720}deg) translateX(${Math.random() * 200 - 100}px)`;
      confetti.style.opacity = '0';
    }, 50);

    setTimeout(() => {
      confetti.remove();
    }, 3800);
  }
}
