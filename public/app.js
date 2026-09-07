let currentTab = 'upgrade';
let currentMode = 'nodns'; // 'nodns'
let currentFormMode = 'single'; // 'single', 'bulk'

let allUsers = [];
let scannedUsers = [];
let selectedUids = new Set();
let editingUid = null;
let currentResolvedProfile = null;
let lookupTimer = null;

document.addEventListener('DOMContentLoaded', () => {
  checkAdminAuth();

  // Check URL param for tab
  const params = new URLSearchParams(window.location.search);
  const tabParam = params.get('tab');
  if (tabParam && ['upgrade', 'admin', 'scanner', 'dns', 'master', 'bot'].includes(tabParam)) {
    switchTab(tabParam);
  }

  loadAdminData();
  loadMasterInfo();
  loadAllBotData();
  checkExpiryHeartbeat();
});

function getAdminToken() {
  return sessionStorage.getItem('locket_admin_token') || 'MASTER_LACVIET_TOKEN_2026';
}

function authFetch(url, options = {}) {
  const token = getAdminToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return fetch(url, { ...options, headers });
}

function checkAdminAuth() {
  const isAuth = sessionStorage.getItem('locket_admin_auth');
  const token = sessionStorage.getItem('locket_admin_token');
  const lockOverlay = document.getElementById('adminLockOverlay');

  if (isAuth === 'true' && token) {
    if (lockOverlay) {
      lockOverlay.classList.remove('open');
      lockOverlay.style.display = 'none';
    }
  } else {
    if (lockOverlay) {
      lockOverlay.style.display = 'flex';
      lockOverlay.classList.add('open');
      const userInput = document.getElementById('adminUserInput');
      if (userInput) {
        userInput.value = '';
        userInput.focus();
      }
    }
  }
}

async function handleAdminLogin() {
  const userEl = document.getElementById('adminUserInput');
  const passEl = document.getElementById('adminPassInput');
  const btnEl = document.getElementById('btnAdminLogin');
  const errEl = document.getElementById('adminLoginError');

  const username = (userEl ? userEl.value : '').trim();
  const password = (passEl ? passEl.value : '').trim();

  if (!username || !password) {
    if (errEl) {
      errEl.innerText = 'Vui lòng nhập đầy đủ Tài khoản và Mật khẩu!';
      errEl.style.display = 'block';
    }
    return;
  }

  if (btnEl) {
    btnEl.disabled = true;
    btnEl.innerHTML = '<span>⏳ Đang xác thực...</span>';
  }
  if (errEl) errEl.style.display = 'none';

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (res.ok && data.success && data.token) {
      sessionStorage.setItem('locket_admin_auth', 'true');
      sessionStorage.setItem('locket_admin_token', data.token);
      sessionStorage.setItem('locket_admin_user', data.user || username);

      const lockOverlay = document.getElementById('adminLockOverlay');
      if (lockOverlay) {
        lockOverlay.classList.remove('open');
        lockOverlay.style.display = 'none';
      }

      showToast(`🔓 Xin chào Quản trị viên @${data.user}! Mở khóa thành công.`);
      loadAdminData();
      loadMasterInfo();
    } else {
      if (errEl) {
        errEl.innerText = data.error || 'Tài khoản hoặc mật khẩu không chính xác!';
        errEl.style.display = 'block';
      }
      if (passEl) {
        passEl.value = '';
        passEl.focus();
      }
    }
  } catch (err) {
    if (errEl) {
      errEl.innerText = 'Lỗi kết nối máy chủ: ' + err.message;
      errEl.style.display = 'block';
    }
  } finally {
    if (btnEl) {
      btnEl.disabled = false;
      btnEl.innerHTML = '<span>🔓 Xác Thực & Đăng Nhập</span>';
    }
  }
}

// ========================================================
// 1. NAVIGATION & TAB SWITCHING
// ========================================================
function switchTab(tabId) {
  currentTab = tabId;

  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.getElementById(`tab-btn-${tabId}`);
  if (activeBtn) activeBtn.classList.add('active');

  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  const activeContent = document.getElementById(`tab-content-${tabId}`);
  if (activeContent) activeContent.classList.add('active');

  if (tabId === 'admin') {
    loadAdminData();
  } else if (tabId === 'master') {
    loadMasterInfo();
  } else if (tabId === 'bot') {
    loadAllBotData();
  }
}

function selectUpgradeMode(mode) {
  currentMode = mode;

  document.querySelectorAll('.mode-card').forEach(card => card.classList.remove('active'));
  const card = document.getElementById(`mode-card-${mode}`);
  if (card) card.classList.add('active');

  const wsTitle = document.getElementById('workspaceTitle');
  const miniDns = document.getElementById('miniDnsSection');

  if (mode === '15s') {
    wsTitle.innerText = '🚀 Kích Hoạt Locket Gold (No-DNS 15s Video Ultra)';
    miniDns.style.display = 'none';
  } else if (mode === 'nodns') {
    wsTitle.innerText = '🟢 Kích Hoạt Locket Gold (No-DNS Chuẩn)';
    miniDns.style.display = 'none';
  } else if (mode === 'dns') {
    wsTitle.innerText = '🛡️ Kích Hoạt Qua Apple MobileConfig / DNS';
    miniDns.style.display = 'block';
  }
}

function toggleFormMode(fMode) {
  currentFormMode = fMode;
  const singleSec = document.getElementById('singleFormSection');
  const bulkSec = document.getElementById('bulkFormSection');
  const btnSingle = document.getElementById('btnSingleMode');
  const btnBulk = document.getElementById('btnBulkMode');

  if (fMode === 'single') {
    singleSec.style.display = 'block';
    bulkSec.style.display = 'none';
    btnSingle.classList.add('active');
    btnBulk.classList.remove('active');
  } else {
    singleSec.style.display = 'none';
    bulkSec.style.display = 'block';
    btnSingle.classList.remove('active');
    btnBulk.classList.add('active');
  }
}

// ========================================================
// 2. SMART PROFILE RESOLVER (AUTO CRAWL UID & AVATAR)
// ========================================================
function debounceLookup() {
  clearTimeout(lookupTimer);
  lookupTimer = setTimeout(() => {
    triggerManualLookup();
  }, 450);
}

async function triggerManualLookup() {
  const input = document.getElementById('inputSmartLookup').value.trim();
  if (!input) {
    document.getElementById('resolvedProfileBox').style.display = 'none';
    currentResolvedProfile = null;
    return;
  }

  try {
    const res = await fetch('/api/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input })
    });
    const data = await res.json();

    if (data.success && data.uid) {
      currentResolvedProfile = data;
      document.getElementById('inputUid').value = data.uid;
      document.getElementById('resolvedUsernameTxt').innerText = `@${data.username}`;
      document.getElementById('resolvedUidTxt').innerText = `UID: ${data.uid}`;
      document.getElementById('resolvedMsgTxt').innerText = data.message || 'Đã sẵn sàng kích hoạt StoreKit 2 receipt';
      document.getElementById('resolvedAvatarImg').src = data.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(data.username)}`;
      document.getElementById('resolvedProfileBox').style.display = 'flex';
      showToast(`Đã tìm thấy @${data.username}!`);
    } else {
      document.getElementById('resolvedProfileBox').style.display = 'none';
    }
  } catch (err) {
    console.warn('Lookup error:', err);
  }
}

// ========================================================
// 3. UPGRADE ACTIONS & BILL GENERATION
// ========================================================
async function executeSingleUpgrade() {
  const uid = document.getElementById('inputUid').value.trim();
  const rawInput = document.getElementById('inputSmartLookup').value.trim();
  const channel = document.getElementById('inputChannel').value;
  const price = document.getElementById('inputPrice').value;
  const payment_status = document.getElementById('inputPaymentStatus').value;
  const notes = document.getElementById('inputNotes').value.trim();
  const alertBox = document.getElementById('upgradeAlertBox');
  const btn = document.getElementById('btnSubmitSingle');

  if (!uid || uid.length < 10) {
    alertBox.className = 'alert-box error';
    alertBox.innerText = 'Vui lòng nhập hoặc dán UID Locket hợp lệ của khách hàng!';
    return;
  }

  let username = (currentResolvedProfile && currentResolvedProfile.username) || rawInput.replace(/^@/, '') || 'customer_' + uid.substring(0, 6);
  username = username.split('/')[username.split('/').length - 1].trim();

  btn.disabled = true;
  btn.innerHTML = `<span class="btn-icon">⏳</span><span>Đang gửi StoreKit 2 receipt...</span>`;
  alertBox.className = 'alert-box';
  alertBox.innerText = '';

  try {
    const res = await authFetch('/api/upgrade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        uid,
        mode: 'nodns',
        channel,
        price,
        payment_status,
        notes,
        avatar: (currentResolvedProfile && currentResolvedProfile.avatar) || ''
      })
    });

    const data = await res.json();
    if (data.success) {
      alertBox.className = 'alert-box success';
      alertBox.innerText = `🎉 ${data.message} Gói Gold đã kích hoạt thành công, hạn đến ${data.user.expires_date}!`;
      showToast(`Đã nạp Gold thành công cho @${data.user.username}!`);

      // Open VIP Warranty Bill Card Modal
      openBillModal(data.user);

      document.getElementById('inputSmartLookup').value = '';
      document.getElementById('inputUid').value = '';
      document.getElementById('resolvedProfileBox').style.display = 'none';
      currentResolvedProfile = null;
      loadAdminData();
    } else {
      alertBox.className = 'alert-box error';
      alertBox.innerText = 'Lỗi kích hoạt: ' + (data.error || 'Vui lòng kiểm tra lại UID.');
    }
  } catch (err) {
    alertBox.className = 'alert-box error';
    alertBox.innerText = 'Lỗi kết nối máy chủ: ' + err.message;
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<span class="btn-icon">⚡</span><span>KÍCH HOẠT LOCKET GOLD & TẠO BILL VIP</span>`;
  }
}

async function executeBulkUpgrade() {
  const bulkText = document.getElementById('inputBulkText').value.trim();
  const alertBox = document.getElementById('upgradeAlertBox');
  const btn = document.getElementById('btnSubmitBulk');
  const price = document.getElementById('inputPrice') ? document.getElementById('inputPrice').value : 50000;
  const channel = document.getElementById('inputChannel') ? document.getElementById('inputChannel').value : 'zalo';

  if (!bulkText) {
    alertBox.className = 'alert-box error';
    alertBox.innerText = 'Vui lòng dán danh sách UID khách hàng!';
    return;
  }

  const lines = bulkText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const entries = lines.map(line => {
    if (line.includes(':')) {
      const parts = line.split(':');
      return { username: parts[0].trim(), uid: parts[1].trim() };
    }
    return { username: '', uid: line };
  });

  btn.disabled = true;
  btn.innerHTML = `<span class="btn-icon">⏳</span><span>Đang xử lý ${entries.length} tài khoản...</span>`;

  try {
    const res = await authFetch('/api/upgrade/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries, mode: 'nodns', price, channel })
    });


    const data = await res.json();
    if (data.success) {
      alertBox.className = 'alert-box success';
      alertBox.innerText = `🎉 Đã kích hoạt hoàn tất cho toàn bộ ${data.processed} tài khoản khách hàng!`;
      showToast(`Đã nạp thành công ${data.processed} tài khoản!`);
      document.getElementById('inputBulkText').value = '';
      loadAdminData();
    } else {
      alertBox.className = 'alert-box error';
      alertBox.innerText = 'Lỗi: ' + (data.error || 'Không thể xử lý hàng loạt');
    }
  } catch (err) {
    alertBox.className = 'alert-box error';
    alertBox.innerText = 'Lỗi kết nối máy chủ: ' + err.message;
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<span class="btn-icon">📦</span><span>XỬ LÝ NẠP HÀNG LOẠT</span>`;
  }
}

// ========================================================
// 4. VIP WARRANTY BILL MODAL & IMAGE EXPORT
// ========================================================
let activeBillUser = null;

function openBillModal(user) {
  activeBillUser = user;
  const is15s = !!user.video_15s;
  
  document.getElementById('billUsernameTxt').innerText = `@${user.username || 'Khách Hàng'}`;
  document.getElementById('billAvatarImg').src = user.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.username)}&backgroundColor=f59e0b,fbbf24&textColor=ffffff&fontWeight=700`;
  document.getElementById('billExpiryTxt').innerText = user.expires_date ? new Date(user.expires_date).toLocaleDateString('vi-VN') : '03/10/2026';
  document.getElementById('billTransIdTxt').innerText = '510002836840566';
  document.getElementById('billSerialTxt').innerText = `SN-510002836840566-${(user.uid || '').substring(0, 6)}`;

  // Dynamic Badge, Service, and Storefront based on Mode
  const badgeEl = document.getElementById('billStatusBadgeTxt');
  const serviceEl = document.getElementById('billServiceNameTxt');
  const storeEl = document.getElementById('billStorefrontTxt');

  if (is15s) {
    if (badgeEl) badgeEl.innerText = '🟢 15S VIDEO ULTRA UNLOCKED';
    if (serviceEl) serviceEl.innerText = 'Locket Gold 15s Video Ultra';
    if (storeEl) storeEl.innerText = 'United States (USA) / StoreKit 2';
  } else {
    if (badgeEl) badgeEl.innerText = '🟢 NO-DNS CHUẨN • FULL GOLD ACTIVE';
    if (serviceEl) serviceEl.innerText = 'Locket Gold Chuẩn (Không Cần DNS)';
    if (storeEl) storeEl.innerText = 'Vietnam (VNM) / StoreKit 2';
  }

  document.getElementById('billModal').classList.add('open');
}

function closeBillModal() {
  document.getElementById('billModal').classList.remove('open');
}

function copyBillMessage() {
  if (!activeBillUser) return;
  const username = activeBillUser.username || 'Bạn';
  const is15s = !!activeBillUser.video_15s;
  const expiry = activeBillUser.expires_date ? new Date(activeBillUser.expires_date).toLocaleDateString('vi-VN') : '03/10/2026';

  const serviceTitle = is15s 
    ? 'Locket Gold Lifetime + Mở khóa Video 15s Ultra (Storefront US)' 
    : 'Locket Gold Chuẩn No-DNS (Không Cài VPN/DNS, Dùng App Gốc 100%)';

  const noteMsg = is15s 
    ? 'Bạn chỉ cần vuốt tắt app Locket và mở lại, biểu tượng Gold và tính năng quay 15s sẽ tự động hiển thị ngay nhé!' 
    : 'Bạn chỉ cần vuốt tắt app Locket và mở lại là đã có Full tính năng Gold chính hãng, không cần cài DNS hay VPN gì cả nhé!';

  const msg = `🌟 XÁC NHẬN KÍCH HOẠT LOCKET GOLD THÀNH CÔNG! 🌟
👤 Tài khoản: @${username}
🎁 Gói dịch vụ: ${serviceTitle}
📅 Hạn bảo hành: ${expiry}
🔑 Mã giao dịch Apple Store: 510002836840566
⚙️ Hướng dẫn: ${noteMsg} Cảm ơn bạn đã tin tưởng ủng hộ dịch vụ ❤️`;

  copyText(msg, 'Đã copy lời nhắn gửi khách (Zalo/FB)!');
}

async function downloadBillCard() {
  const cardElement = document.getElementById('billCardElement');
  if (!cardElement) return;

  try {
    showToast('Đang tạo ảnh Bill HD...');
    if (typeof html2canvas !== 'undefined') {
      const canvas = await html2canvas(cardElement, {
        scale: 2,
        backgroundColor: '#0a0b10',
        useCORS: true
      });
      const link = document.createElement('a');
      link.download = `Bill_Locket_Gold_${activeBillUser ? activeBillUser.username : 'VIP'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      showToast('Đã tải xuống ảnh Bill VIP thành công!');
    } else {
      showToast('Đang tải thư viện ảnh, vui lòng thử lại sau 2 giây...');
    }
  } catch (err) {
    showToast('Lỗi khi tạo ảnh bill: ' + err.message);
  }
}

// ========================================================
// 5. ADMIN DATA & CRM MANAGEMENT
// ========================================================
async function loadAdminData(showToastMsg = false) {
  try {
    const res = await authFetch('/api/users');
    const data = await res.json();
    allUsers = data.users || [];

    // Update Counts & Revenue
    document.getElementById('adminTotalUsers').innerText = data.total || allUsers.length;
    document.getElementById('tabBadgeUserCount').innerText = data.total || allUsers.length;

    const formattedRev = (data.total_revenue || allUsers.length * 60000).toLocaleString('vi-VN') + ' đ';
    document.getElementById('adminTotalRevenue').innerText = formattedRev;

    const count15s = allUsers.filter(u => u.video_15s).length;
    if (document.getElementById('admin15sUsers')) {
      document.getElementById('admin15sUsers').innerText = data.total || allUsers.length;
    }

    renderAdminTable(allUsers);
    if (showToastMsg) showToast('Đã làm mới dữ liệu khách hàng!');

    // Real-time Auto Sync Polling every 5 seconds for both admins (kwang & lucifer)
    if (!window._adminRealtimeSyncTimer) {
      window._adminRealtimeSyncTimer = setInterval(() => {
        const lockOverlay = document.getElementById('adminLockOverlay');
        const isUnlocked = !lockOverlay || lockOverlay.style.display === 'none';
        if (isUnlocked && !editingUid) {
          loadAdminData(false);
        }
      }, 5000);
    }
  } catch (err) {
    console.error('Error loading users:', err);
  }
}

function renderAdminTable(users) {
  const tbody = document.getElementById('adminTableBody');
  if (!users || users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="text-center py-4">Không tìm thấy tài khoản nào.</td></tr>`;
    return;
  }

  tbody.innerHTML = users.map((u, idx) => {
    const isChecked = selectedUids.has(u.uid);
    const shortUid = (u.uid || '').substring(0, 10) + '...';
    const featureBadge = `<span class="tag-channel-pill" style="background: rgba(255,204,0,0.15); color: #ffcc00; border: 1px solid rgba(255,204,0,0.3); font-weight: 700;">No-DNS Chuẩn</span>`;

    const channelBadge = `<span class="tag-channel-pill">${u.channel || 'Zalo'}</span>`;
    const priceFormatted = (Number(u.price) || 60000).toLocaleString('vi-VN') + ' đ';
    const paymentBadge = u.payment_status === 'paid' 
      ? `<span class="badge-paid">Đã TT</span>` 
      : `<span class="badge-pending">Chờ TT</span>`;

    const expireFormatted = u.expires_date 
      ? new Date(u.expires_date).toLocaleDateString('vi-VN') 
      : '03/10/2026';

    return `
      <tr>
        <td>
          <input type="checkbox" class="row-checkbox" value="${u.uid}" ${isChecked ? 'checked' : ''} onchange="toggleSelectRow('${u.uid}', this.checked)">
        </td>
        <td style="color: var(--text-muted); font-weight: 600;">#${idx + 1}</td>
        <td>
          <strong>@${u.username || 'N/A'}</strong>
        </td>
        <td>
          <code class="uid-code" title="${u.uid || ''}">${shortUid}</code>
        </td>
        <td>${featureBadge}</td>
        <td>${channelBadge}</td>
        <td><span class="font-mono" style="font-size: 12px;">${priceFormatted}</span></td>
        <td>${paymentBadge}</td>
        <td><strong style="color: var(--gold-primary); font-size: 12px;">${expireFormatted}</strong></td>
        <td>
          <div style="display: flex; gap: 4px;">
            <button class="btn btn-sm btn-outline" onclick="openBillModalForUid('${u.uid}')">Bill</button>
            <button class="btn btn-sm btn-outline" onclick="copyText('${u.uid}', 'Đã copy UID!')">UID</button>
            <button class="btn btn-sm btn-glass" onclick="openEditModal('${u.uid}')">Sửa</button>
            <button class="btn btn-sm btn-outline" style="color: var(--danger-color); border-color: rgba(255,61,113,0.3);" onclick="deleteUser('${u.uid}', '${u.username}')">Xóa</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');


  updateBulkToolbar();
}

function filterAdminUsers() {
  const query = document.getElementById('adminSearchInput').value.trim().toLowerCase();
  const channelFilter = document.getElementById('adminFilterChannel').value;
  const statusFilter = document.getElementById('adminFilterStatus').value;

  let filtered = allUsers;

  if (channelFilter !== 'all') {
    filtered = filtered.filter(u => (u.channel || 'zalo') === channelFilter);
  }

  if (statusFilter !== 'all') {
    filtered = filtered.filter(u => (u.payment_status || 'paid') === statusFilter);
  }

  if (query) {
    filtered = filtered.filter(u => {
      const nameMatch = (u.username || '').toLowerCase().includes(query);
      const uidMatch = (u.uid || '').toLowerCase().includes(query);
      const notesMatch = (u.notes || '').toLowerCase().includes(query);
      return nameMatch || uidMatch || notesMatch;
    });
  }

  renderAdminTable(filtered);
}

// Multi-select Checkboxes & Bulk Actions
function toggleSelectAll(masterCb) {
  if (masterCb.checked) {
    allUsers.forEach(u => selectedUids.add(u.uid));
  } else {
    selectedUids.clear();
  }
  renderAdminTable(allUsers);
}

function toggleSelectRow(uid, checked) {
  if (checked) selectedUids.add(uid);
  else selectedUids.delete(uid);
  updateBulkToolbar();
}

function updateBulkToolbar() {
  const toolbar = document.getElementById('bulkActionsToolbar');
  const countTxt = document.getElementById('bulkSelectedText');
  if (selectedUids.size > 0) {
    toolbar.style.display = 'flex';
    countTxt.innerText = `Đã chọn ${selectedUids.size} tài khoản`;
  } else {
    toolbar.style.display = 'none';
  }
}

async function executeBulkAction(action) {
  const uids = Array.from(selectedUids);
  if (uids.length === 0) return;

  if (action === 'delete') {
    if (!confirm(`Anh có chắc muốn xóa ${uids.length} tài khoản đã chọn?`)) return;
  }

  try {
    const res = await authFetch('/api/users/bulk-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, uids })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message);
      selectedUids.clear();
      loadAdminData();
    }
  } catch (err) {
    showToast('Lỗi thao tác hàng loạt: ' + err.message);
  }
}

function openBillModalForUid(uid) {
  const user = allUsers.find(u => u.uid === uid);
  if (user) openBillModal(user);
}

// User Edit & Delete Handlers
function openEditModal(uid) {
  const user = allUsers.find(u => u.uid === uid);
  if (!user) return;

  editingUid = uid;
  document.getElementById('editUsername').value = user.username || '';
  document.getElementById('editUid').value = user.uid || '';
  document.getElementById('editChannel').value = user.channel || 'zalo';
  document.getElementById('editPrice').value = user.price || 50000;
  document.getElementById('editPaymentStatus').value = user.payment_status || 'paid';
  document.getElementById('editVideo15s').value = user.video_15s ? 'true' : 'false';
  document.getElementById('editNotes').value = user.notes || '';

  document.getElementById('editModal').classList.add('open');
}

function closeEditModal() {
  document.getElementById('editModal').classList.remove('open');
  editingUid = null;
}

async function saveEditedUser() {
  if (!editingUid) return;

  const username = document.getElementById('editUsername').value.trim();
  const channel = document.getElementById('editChannel').value;
  const price = document.getElementById('editPrice').value;
  const payment_status = document.getElementById('editPaymentStatus').value;
  const video_15s = document.getElementById('editVideo15s').value === 'true';
  const notes = document.getElementById('editNotes').value.trim();

  try {
    const res = await authFetch(`/api/users/${encodeURIComponent(editingUid)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, channel, price, payment_status, video_15s, notes })
    });

    const data = await res.json();
    if (data.success) {
      showToast('Đã lưu thông tin khách hàng!');
      closeEditModal();
      loadAdminData();
    }
  } catch (err) {
    showToast('Lỗi khi lưu: ' + err.message);
  }
}

async function deleteUser(uid, username) {
  if (!confirm(`Anh có chắc chắn muốn xóa tài khoản @${username} (${uid}) khỏi hệ thống?`)) return;

  try {
    const res = await authFetch(`/api/users/${encodeURIComponent(uid)}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast(`Đã xóa @${username}!`);
      loadAdminData();
    }
  } catch (err) {
    showToast('Lỗi khi xóa: ' + err.message);
  }
}

function exportData(format) {
  if (format === 'json') {
    const blob = new Blob([JSON.stringify(allUsers, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `locket_users_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    showToast('Đã tải xuống file JSON sao lưu!');
  } else if (format === 'csv') {
    let csv = 'STT,Username,UID,Kenh,DonGia,ThanhToan,Video15s,ExpiresDate,GhiChu\n';
    allUsers.forEach((u, i) => {
      csv += `${i + 1},"${u.username}","${u.uid}","${u.channel || 'zalo'}",${u.price || 50000},"${u.payment_status || 'paid'}",${u.video_15s ? '15s' : 'Gold'},"${u.expires_date}","${u.notes || ''}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `locket_customers_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    showToast('Đã xuất file CSV thành công!');
  }
}

// ========================================================
// 6. SCANNER TAB (LIVE REVENUECAT AUDIT)
// ========================================================
async function startRevenueCatScan() {
  const btn = document.getElementById('btnStartScan');
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="btn-icon">⏳</span><span>Đang quét API (${allUsers.length} tài khoản)...</span>`;

  document.getElementById('scannerSubtitle').innerText = '⏳ Đang xác thực chữ ký StoreKit 2 trực tiếp từ máy chủ RevenueCat...';

  try {
    const res = await authFetch('/api/scan-all');
    const data = await res.json();
    scannedUsers = data.results || [];

    document.getElementById('scanSummaryBar').style.display = 'grid';
    document.getElementById('scanLiveCount').innerText = data.liveCount;
    document.getElementById('scanDeadCount').innerText = data.deadCount;
    document.getElementById('scanTotalCount').innerText = data.total;

    document.getElementById('scannerSubtitle').innerText = `✅ Đã quét xong lúc ${new Date().toLocaleTimeString('vi-VN')} • ${data.liveCount}/${data.total} tài khoản SỐNG 100%`;

    renderScannerTable(scannedUsers);
    showToast(`Quét hoàn tất: ${data.liveCount}/${data.total} tài khoản SỐNG!`);
  } catch (err) {
    showToast('Lỗi khi quét API: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

function renderScannerTable(users) {
  const tbody = document.getElementById('scannerTableBody');
  if (!users || users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4">Chưa có dữ liệu quét.</td></tr>`;
    return;
  }

  tbody.innerHTML = users.map((u, idx) => {
    const isLive = !!u.is_live;
    const statusBadge = isLive 
      ? `<span class="badge-live">🟢 SỐNG (ACTIVE)</span>` 
      : `<span class="badge-dropped">🔴 ĐÃ RỤNG</span>`;

    const shortUid = (u.uid || '').substring(0, 10) + '...';
    const expireFormatted = u.expires_date 
      ? new Date(u.expires_date).toLocaleDateString('vi-VN') 
      : `<span style="color: var(--text-muted);">Không có</span>`;

    const daysLeftFormatted = isLive 
      ? `<span style="color: #10b981; font-weight: 600;">Còn ${u.days_left} ngày</span>`
      : `<span style="color: #ef4444; font-weight: 600;">Đã hết hạn</span>`;

    return `
      <tr>
        <td style="color: var(--text-muted); font-weight: 600;">#${idx + 1}</td>
        <td><strong>@${u.username || 'N/A'}</strong></td>
        <td><code class="uid-code" title="${u.uid}">${shortUid}</code></td>
        <td><code style="font-family: var(--font-mono); color: var(--gold-primary); font-size: 11px;">${u.gold_product || 'locket_199_1m'}</code></td>
        <td><strong>${expireFormatted}</strong></td>
        <td><small>${daysLeftFormatted}</small></td>
        <td><span class="tag-15s-pill">${u.store || 'App Store'}</span></td>
        <td>${statusBadge}</td>
      </tr>
    `;
  }).join('');
}

// ========================================================
// 7. MOBILE LAN ACCESS & QR CODE MODAL
// ========================================================
let mobileLanUrl = 'http://localhost:5000';

async function openMobileQrModal() {
  try {
    const res = await fetch('/api/network-info');
    const data = await res.json();
    mobileLanUrl = data.mobile_url || `http://${data.lan_ip}:${data.port}`;

    document.getElementById('mobileQrImg').src = data.qr_url;
    document.getElementById('mobileUrlTxt').innerText = mobileLanUrl;
    document.getElementById('mobileQrModal').classList.add('open');
  } catch (e) {
    showToast('Lỗi lấy IP mạng LAN');
  }
}

function closeMobileQrModal() {
  document.getElementById('mobileQrModal').classList.remove('open');
}

function copyMobileUrl() {
  copyText(mobileLanUrl, 'Đã copy link điện thoại!');
}

// ========================================================
// 8. MASTER VAULT & POOL MANAGEMENT
// ========================================================
let masterCountdownInterval = null;
let allMasterKeys = [];

async function loadMasterInfo(showToastMsg = false) {
  try {
    const res = await authFetch(`/api/masters?_t=${Date.now()}`);
    const data = await res.json();
    allMasterKeys = data.keys || [];

    document.getElementById('vaultTokenDisplay').innerText = data.active_token || '510002836840566';
    document.getElementById('vaultExpiryDisplay').innerText = data.expires_date || '2026-10-03T11:26:26Z';
    document.getElementById('adminMasterExpiry').innerText = '03/10/2026';

    startMasterCountdown(data.expires_date || '2026-10-03T11:26:26Z');
    renderMasterKeysTable(allMasterKeys, data.active_id);

    if (showToastMsg) showToast('Đã làm mới Kho Master Key!');
  } catch (err) {
    console.error('Error loading master keys:', err);
  }
}

function renderMasterKeysTable(keys, activeId) {
  const tbody = document.getElementById('masterKeysTableBody');
  if (!tbody) return;

  if (!keys || keys.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4">Chưa có Master Key nào trong kho.</td></tr>`;
    return;
  }

  tbody.innerHTML = keys.map((k, idx) => {
    const isActive = k.status === 'active' || k.id === activeId;
    const statusBadge = isActive 
      ? `<span class="badge-live">🟢 ĐANG SỬ DỤNG</span>` 
      : `<span class="badge-tag-15s" style="background: rgba(255,255,255,0.08); color: var(--text-secondary);">⚪ DỰ PHÒNG</span>`;

    const shortToken = (k.fetch_token || '').substring(0, 16) + '...';
    const expireFormatted = k.expires_date 
      ? new Date(k.expires_date).toLocaleDateString('vi-VN') 
      : '03/10/2026';

    const createdFormatted = k.created_at 
      ? new Date(k.created_at).toLocaleDateString('vi-VN') 
      : 'Hệ thống';

    return `
      <tr style="${isActive ? 'background: rgba(255,204,0,0.05);' : ''}" id="master_row_${k.id}">
        <td style="color: var(--text-muted); font-weight: 600;">#${idx + 1}</td>
        <td>
          <strong>${k.name || 'Master Node'}</strong>
          ${k.notes ? `<small style="display: block; color: var(--text-muted); font-size: 11px;">${k.notes}</small>` : ''}
        </td>
        <td><code class="uid-code" title="${k.fetch_token}">${shortToken}</code></td>
        <td><strong style="color: var(--gold-primary); font-size: 12px;">${expireFormatted}</strong></td>
        <td><small style="color: var(--text-muted);">${createdFormatted}</small></td>
        <td>${statusBadge}</td>
        <td>
          <div style="display: flex; gap: 4px;">
            ${!isActive ? `<button class="btn btn-sm btn-gold" onclick="activateMasterKey('${k.id}', '${k.name}')">⚡ Dùng Key Này</button>` : ''}
            <button class="btn btn-sm btn-glass" onclick="testSpecificKey('${k.fetch_token}')">🧪 Test</button>
            <button class="btn btn-sm btn-outline" onclick="copyText('${k.fetch_token}', 'Đã copy Token!')">Copy</button>
            ${keys.length > 1 ? `<button class="btn btn-sm btn-outline" style="color: var(--danger-color); border-color: rgba(255,61,113,0.3);" onclick="deleteMasterKey('${k.id}', '${k.name}')">🗑️</button>` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function submitAddNewMasterKey() {
  const name = document.getElementById('inputNewMasterName').value.trim();
  const token = document.getElementById('inputNewMasterToken').value.trim();
  const expiry = document.getElementById('inputNewMasterExpiry').value.trim();
  const setActive = document.getElementById('checkSetActiveImmediately').checked;
  const alertEl = document.getElementById('masterUpdateAlert');

  if (!token) {
    alertEl.className = 'alert-box error';
    alertEl.innerText = 'Vui lòng nhập Fetch Token / Transaction ID mới!';
    return;
  }

  try {
    const res = await authFetch('/api/masters/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name || 'Master Key Mới',
        fetch_token: token,
        expires_date: expiry || '2026-10-03T11:26:26Z',
        set_active: setActive
      })
    });

    const data = await res.json();
    if (data.success) {
      alertEl.className = 'alert-box success';
      alertEl.innerText = '✅ ' + data.message;
      showToast(data.message);
      document.getElementById('inputNewMasterName').value = '';
      document.getElementById('inputNewMasterToken').value = '';
      document.getElementById('inputNewMasterExpiry').value = '';
      await loadMasterInfo();
    } else {
      alertEl.className = 'alert-box error';
      alertEl.innerText = 'Lỗi: ' + (data.error || 'Không thể thêm Key');
    }
  } catch (err) {
    alertEl.className = 'alert-box error';
    alertEl.innerText = 'Lỗi kết nối: ' + err.message;
  }
}

async function activateMasterKey(keyId, keyName) {
  // Optimistic UI update
  allMasterKeys.forEach(k => k.status = (k.id === keyId ? 'active' : 'standby'));
  renderMasterKeysTable(allMasterKeys, keyId);

  try {
    const res = await authFetch(`/api/masters/activate/${encodeURIComponent(keyId)}`, {
      method: 'POST'
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Đã chuyển sang dùng "${keyName}"!`);
      await loadMasterInfo();
    } else {
      showToast('Lỗi: ' + data.error);
      await loadMasterInfo();
    }
  } catch (err) {
    showToast('Lỗi kích hoạt Key: ' + err.message);
    await loadMasterInfo();
  }
}

async function deleteMasterKey(keyId, keyName) {
  if (!confirm(`Anh có chắc chắn muốn xóa "${keyName}" khỏi Kho Khóa?`)) return;

  // Optimistic UI update: remove row immediately
  allMasterKeys = allMasterKeys.filter(k => k.id !== keyId);
  const activeKey = allMasterKeys.find(k => k.status === 'active') || allMasterKeys[0];
  renderMasterKeysTable(allMasterKeys, activeKey ? activeKey.id : null);

  try {
    const res = await authFetch(`/api/masters/${encodeURIComponent(keyId)}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Đã xóa "${keyName}"!`);
      await loadMasterInfo();
    } else {
      showToast('Lỗi: ' + data.error);
      await loadMasterInfo();
    }
  } catch (err) {
    showToast('Lỗi xóa Key: ' + err.message);
    await loadMasterInfo();
  }
}

async function testSpecificKey(token) {
  showToast('Đang test thử token với máy chủ Apple...');
  try {
    const res = await authFetch('/api/masters/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fetch_token: token })
    });
    const data = await res.json();
    if (data.success) {
      alert(data.message);
    } else {
      alert(data.message);
    }
  } catch (err) {
    showToast('Lỗi test key: ' + err.message);
  }
}

function startMasterCountdown(expiryStr) {
  clearInterval(masterCountdownInterval);
  const targetDate = new Date(expiryStr).getTime();

  function update() {
    const now = new Date().getTime();
    const diff = targetDate - now;

    if (diff <= 0) {
      if (document.getElementById('cdDays')) document.getElementById('cdDays').innerText = '00';
      if (document.getElementById('cdHours')) document.getElementById('cdHours').innerText = '00';
      if (document.getElementById('cdMins')) document.getElementById('cdMins').innerText = '00';
      if (document.getElementById('cdSecs')) document.getElementById('cdSecs').innerText = '00';
      if (document.getElementById('countdownBarFill')) document.getElementById('countdownBarFill').style.width = '0%';
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);

    const elDays = document.getElementById('cdDays');
    const elHours = document.getElementById('cdHours');
    const elMins = document.getElementById('cdMins');
    const elSecs = document.getElementById('cdSecs');

    if (elDays) elDays.innerText = String(days).padStart(2, '0');
    if (elHours) elHours.innerText = String(hours).padStart(2, '0');
    if (elMins) elMins.innerText = String(mins).padStart(2, '0');
    if (elSecs) elSecs.innerText = String(secs).padStart(2, '0');

    const totalDuration = 30 * 24 * 60 * 60 * 1000;
    const percentLeft = Math.min(100, Math.max(0, (diff / totalDuration) * 100));
    const bar = document.getElementById('countdownBarFill');
    if (bar) bar.style.width = percentLeft + '%';
  }

  update();
  masterCountdownInterval = setInterval(update, 1000);
}

async function testMasterTokenBeforeSave() {
  const token = document.getElementById('inputNewMasterToken').value.trim();
  const alertEl = document.getElementById('masterUpdateAlert');

  if (!token) {
    alertEl.className = 'alert-box error';
    alertEl.innerText = 'Vui lòng nhập Token trước khi bấm Test!';
    return;
  }

  alertEl.className = 'alert-box';
  alertEl.innerText = '⏳ Đang gửi request xác thực thử lên máy chủ RevenueCat...';
  alertEl.style.display = 'block';

  try {
    const res = await fetch('/api/masters/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fetch_token: token })
    });
    const data = await res.json();
    if (data.success) {
      alertEl.className = 'alert-box success';
      alertEl.innerText = data.message;
      showToast('Token hợp lệ!');
    } else {
      alertEl.className = 'alert-box error';
      alertEl.innerText = data.message;
    }
  } catch (err) {
    alertEl.className = 'alert-box error';
    alertEl.innerText = 'Lỗi kết nối: ' + err.message;
  }
}

function checkExpiryHeartbeat() {
  const now = new Date();
  const expiringSoon = allUsers.filter(u => {
    if (!u.expires_date) return false;
    const diffDays = (new Date(u.expires_date) - now) / (1000 * 60 * 60 * 24);
    return diffDays > 0 && diffDays <= 3;
  });

  const banner = document.getElementById('expiryAlertBanner');
  if (banner) {
    if (expiringSoon.length > 0) {
      banner.style.display = 'flex';
      document.getElementById('expiryAlertText').innerText = `⚠️ Cảnh báo: Có ${expiringSoon.length} tài khoản khách sắp hết hạn trong 3 ngày tới!`;
    } else {
      banner.style.display = 'none';
    }
  }
}

// ========================================================
// 9. UTILS & HELPERS
// ========================================================
async function pasteClipboardToUid() {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      document.getElementById('inputUid').value = text.trim();
      showToast('Đã dán UID từ Clipboard!');
    }
  } catch (e) {
    showToast('Vui lòng nhấn Ctrl+V để dán!');
  }
}

function copyDnsModuleUrl() {
  const url = document.getElementById('dnsModuleUrl').value;
  copyText(url, 'Đã copy URL Module Shadowrocket!');
}

function copyText(text, msg) {
  navigator.clipboard.writeText(text);
  showToast(msg || 'Đã copy vào Clipboard!');
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.innerText = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// ========================================================
// 10. UNIFIED BOT TELEGRAM SHOP & COMPLETE CRM (Shared Neon DB)
// ========================================================
let allBotOrders = [];
let allBotProducts = [];
let allBotCategories = [];
let allBotUsers = [];
let allBotExpenses = [];
let allBotCoupons = [];
let activeStockProductId = null;
let debounceUserTimer = null;
let debounceOrderTimer = null;

function switchBotSubTab(subTabName, btnEl) {
  // Update button active state
  document.querySelectorAll('.bot-subtab-btn').forEach(btn => btn.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');

  // Hide all subpanels and activate target
  document.querySelectorAll('.bot-subpanel').forEach(panel => panel.classList.remove('active'));
  const cap = subTabName.charAt(0).toUpperCase() + subTabName.slice(1);
  const target = document.getElementById(`botSubPanel${cap}`);
  if (target) target.classList.add('active');

  // Trigger lazy loading
  if (subTabName === 'overview') loadBotOverviewData();
  else if (subTabName === 'products') loadBotProducts();
  else if (subTabName === 'categories') loadBotCategories();
  else if (subTabName === 'users') loadBotUsers();
  else if (subTabName === 'orders') loadBotOrders();
  else if (subTabName === 'expenses') loadBotExpenses();
  else if (subTabName === 'broadcast') loadBotBroadcastInfo();
  else if (subTabName === 'coupons') loadBotCoupons();
}

async function loadAllBotData(showFeedback = false) {
  await Promise.all([
    loadBotOverviewData(),
    loadBotProducts(),
    loadBotCategories(),
    loadBotUsers(),
    loadBotOrders(),
    loadBotExpenses(),
    loadBotCoupons()
  ]);
  if (showFeedback) {
    showToast('✅ Đã đồng bộ toàn bộ dữ liệu Shop & Bot từ Neon DB!');
  }
}

// ---- Overview Data ----
async function loadBotOverviewData() {
  try {
    const res = await authFetch('/api/bot/overview');
    if (!res.ok) return;
    const data = await res.json();
    if (!data.success || !data.metrics) return;

    const m = data.metrics;
    // Format helpers
    const fmt = (n) => Number(n || 0).toLocaleString('vi-VN') + ' đ';
    const num = (n) => Number(n || 0).toLocaleString('vi-VN');

    // Revenue
    if (document.getElementById('botRevToday')) document.getElementById('botRevToday').innerText = fmt(m.revenue_today);
    if (document.getElementById('botRevMonth')) document.getElementById('botRevMonth').innerText = fmt(m.revenue_month);
    if (document.getElementById('botRevTotal')) document.getElementById('botRevTotal').innerText = fmt(m.revenue);

    // Expenses
    if (document.getElementById('botExpToday')) document.getElementById('botExpToday').innerText = fmt(m.expense_today);
    if (document.getElementById('botExpMonth')) document.getElementById('botExpMonth').innerText = fmt(m.expense_month);
    if (document.getElementById('botExpTotal')) document.getElementById('botExpTotal').innerText = fmt(m.expense);

    // Profit
    if (document.getElementById('botProfitToday')) document.getElementById('botProfitToday').innerText = fmt(m.profit_today);
    if (document.getElementById('botProfitMonth')) document.getElementById('botProfitMonth').innerText = fmt(m.profit_month);
    if (document.getElementById('botProfitTotal')) document.getElementById('botProfitTotal').innerText = fmt(m.profit);

    // Stock
    if (document.getElementById('botAvailStock')) document.getElementById('botAvailStock').innerText = num(m.available_stock);
    if (document.getElementById('botSoldToday')) document.getElementById('botSoldToday').innerText = num(m.sold_today);

    // Users & Wallet
    if (document.getElementById('botUserCount')) document.getElementById('botUserCount').innerText = num(m.users_count);
    if (document.getElementById('botWalletTotal')) document.getElementById('botWalletTotal').innerText = fmt(m.total_wallet_balance);
    if (document.getElementById('botBroadcastAudienceCount')) document.getElementById('botBroadcastAudienceCount').innerText = `${num(m.users_count)} người dùng`;

    // Orders
    if (document.getElementById('botOrderToday')) document.getElementById('botOrderToday').innerText = num(m.orders_today);
    if (document.getElementById('botOrderTotal')) document.getElementById('botOrderTotal').innerText = num(m.orders_count);

    // Badge in top nav
    const badgeEl = document.getElementById('tabBadgeBotOrderCount');
    if (badgeEl) badgeEl.innerText = m.orders_count || 0;

    // Recent orders table in overview
    renderRecentOrders(data.recent_orders || []);
  } catch (err) {
    console.error('loadBotOverviewData error:', err);
  }
}

function renderRecentOrders(orders) {
  const tbody = document.getElementById('botRecentOrdersTableBody');
  if (!tbody) return;

  if (!orders || orders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4" style="color: var(--text-muted);">Chưa có đơn hàng nào phát sinh.</td></tr>`;
    return;
  }

  tbody.innerHTML = orders.map(o => {
    const timeStr = o.created_at ? new Date(o.created_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '--';
    let badgeClass = 'badge-pending';
    let statusText = o.status;
    if (o.status === 'COMPLETED') { badgeClass = 'badge-paid'; statusText = '🟢 Hoàn tất'; }
    else if (o.status === 'REFUNDED') { badgeClass = 'badge-expired'; statusText = '↩️ Đã hoàn'; }
    else if (o.status === 'FAILED') { badgeClass = 'badge-expired'; statusText = '🔴 Thất bại'; }

    return `
      <tr>
        <td><strong class="font-mono text-gold">${escapeHtml(o.payment_ref || '#' + o.id)}</strong></td>
        <td><strong>${o.tg_username ? '@' + escapeHtml(o.tg_username) : escapeHtml(o.tg_full_name || 'Khách')}</strong></td>
        <td>${escapeHtml(o.product_name || '--')}</td>
        <td class="font-mono text-gold" style="font-weight: 700;">${Number(o.final_price || 0).toLocaleString('vi-VN')} đ</td>
        <td><span class="badge ${badgeClass}">${statusText}</span></td>
        <td style="font-size: 12px; color: var(--text-secondary);">${timeStr}</td>
      </tr>
    `;
  }).join('');
}

// ---- Products Management ----
async function loadBotProducts() {
  try {
    const res = await authFetch('/api/bot/products');
    if (!res.ok) return;
    const data = await res.json();
    if (data.success) {
      allBotProducts = data.products || [];
      renderBotProducts(allBotProducts);
    }
  } catch (err) {
    console.error('loadBotProducts error:', err);
  }
}

function renderBotProducts(products) {
  const tbody = document.getElementById('botProductsTableBody');
  if (!tbody) return;

  if (!products || products.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4" style="color: var(--text-secondary);">Chưa có sản phẩm nào.</td></tr>`;
    return;
  }

  tbody.innerHTML = products.map((p, idx) => {
    const isLocket = p.delivery_type && p.delivery_type.toLowerCase().includes('locket');
    const stockText = isLocket ? '⚡ Không giới hạn' : (p.stock === -1 ? '♾️ Vô hạn' : `${p.stock} item(s)`);
    const statusBadge = p.is_active 
      ? '<span class="badge badge-paid">🟢 Đang bán</span>' 
      : '<span class="badge badge-expired">🔴 Ẩn</span>';

    return `
      <tr>
        <td class="font-mono">${idx + 1}</td>
        <td>
          <div style="font-weight: 700; color: var(--text-primary);">${escapeHtml(p.name)}</div>
          ${p.description ? `<small style="color: var(--text-muted); font-size: 11px;">${escapeHtml(p.description.slice(0, 60))}${p.description.length > 60 ? '...' : ''}</small>` : ''}
        </td>
        <td>
          <span>${escapeHtml(p.category_emoji || '📦')} ${escapeHtml(p.category_name || 'Chung')}</span>
        </td>
        <td>
          <span class="font-mono text-gold" style="font-weight: 700;">${Number(p.price).toLocaleString('vi-VN')} đ</span>
        </td>
        <td>
          ${isLocket ? '<span class="mode-tag tag-gold" style="font-size: 11px;">⚡ Locket Gold No-DNS</span>' : `<span class="badge badge-purple">${escapeHtml(p.delivery_type)}</span>`}
        </td>
        <td><span class="font-mono">${stockText}</span></td>
        <td>${statusBadge}</td>
        <td style="text-align: right; white-space: nowrap;">
          <div style="display: inline-flex; gap: 6px; justify-content: flex-end;">
            <button class="btn btn-xs btn-gold" onclick="openEditBotProductModal(${p.id})">✏️ Sửa giá</button>
            ${p.delivery_type === 'STOCK' ? `
              <button class="btn btn-xs btn-glass" onclick="openFillStockModal(${p.id})">📦 Fill hàng</button>
            ` : ''}
            <button class="btn btn-xs btn-glass" onclick="toggleProductActive(${p.id}, ${Boolean(p.is_active)})">
              ${p.is_active ? 'Ẩn' : 'Hiện'}
            </button>
            <button class="btn btn-xs" style="color: #ef4444;" onclick="deleteBotProduct(${p.id})">🗑 Xóa</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function deleteBotProduct(id) {
  if (!confirm('Anh có chắc muốn xoá sản phẩm này khỏi shop? (Nếu đã có đơn hàng, sản phẩm sẽ tự động được ẩn để bảo tồn lịch sử kế toán)')) return;
  try {
    const res = await authFetch(`/api/bot/products/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast(data.message || 'Đã xoá sản phẩm');
      loadBotProducts();
      loadBotOverviewData();
    } else {
      showToast('Lỗi: ' + data.error);
    }
  } catch (err) {
    showToast('Lỗi xoá sản phẩm: ' + err.message);
  }
}

// ---- Product Edit Modal ----
async function openEditBotProductModal(id) {
  const product = allBotProducts.find(p => p.id === id);
  if (!product) return;

  document.getElementById('botEditProdId').value = product.id;
  document.getElementById('botEditProdName').value = product.name || '';
  document.getElementById('botEditProdPrice').value = parseInt(product.price, 10) || 0;
  document.getElementById('botEditProdDesc').value = product.description || '';
  document.getElementById('botEditProdActive').value = String(Boolean(product.is_active));

  try {
    const res = await authFetch('/api/bot/categories');
    const data = await res.json();
    const select = document.getElementById('botEditProdCategory');
    if (data.success && data.categories) {
      select.innerHTML = data.categories.map(c => `
        <option value="${c.id}" ${c.id === product.category_id || c.name === product.category_name ? 'selected' : ''}>${escapeHtml(c.name)}</option>
      `).join('');
    }
  } catch (err) {
    console.warn('Load categories error:', err);
  }

  const modal = document.getElementById('botEditProductModal');
  if (modal) modal.classList.add('active');
}

function closeBotEditModal() {
  const modal = document.getElementById('botEditProductModal');
  if (modal) modal.classList.remove('active');
}

async function saveBotProductEdit() {
  const id = document.getElementById('botEditProdId').value;
  const name = document.getElementById('botEditProdName').value.trim();
  const price = parseInt(document.getElementById('botEditProdPrice').value, 10);
  const category_id = parseInt(document.getElementById('botEditProdCategory').value, 10);
  const is_active = document.getElementById('botEditProdActive').value === 'true';
  const description = document.getElementById('botEditProdDesc').value.trim();

  if (!name || isNaN(price) || price < 0) {
    showToast('Vui lòng nhập tên và giá hợp lệ!');
    return;
  }

  try {
    const res = await authFetch(`/api/bot/products/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, price, category_id, is_active, description })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Đã lưu thay đổi sản phẩm thành công!');
      closeBotEditModal();
      loadBotProducts();
      loadBotOverviewData();
    } else {
      showToast('Lỗi: ' + (data.error || 'Không thể lưu'));
    }
  } catch (err) {
    showToast('Lỗi mạng: ' + err.message);
  }
}

async function toggleProductActive(id, currentActive) {
  try {
    const res = await authFetch(`/api/bot/products/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !currentActive })
    });
    const data = await res.json();
    if (data.success) {
      showToast(currentActive ? 'Đã ẩn sản phẩm khỏi bot' : 'Đã bật bán sản phẩm!');
      loadBotProducts();
    }
  } catch (err) {
    showToast('Lỗi: ' + err.message);
  }
}

// ---- Fill Stock Modal ----
async function openFillStockModal(id) {
  const product = allBotProducts.find(p => p.id === id);
  if (!product) return;

  activeStockProductId = id;
  document.getElementById('botFillStockProdId').value = product.id;
  document.getElementById('botFillStockSubtitle').innerText = `Mặt hàng: ${product.name} • Đơn giá: ${Number(product.price).toLocaleString('vi-VN')} đ • Tồn kho: ${product.stock}`;
  document.getElementById('botFillStockLines').value = '';
  document.getElementById('botFillStockBroadcast').checked = true;

  const modal = document.getElementById('botFillStockModal');
  if (modal) modal.classList.add('active');

  await refreshCurrentStockList();
}

function closeBotFillStockModal() {
  activeStockProductId = null;
  const modal = document.getElementById('botFillStockModal');
  if (modal) modal.classList.remove('active');
}

async function refreshCurrentStockList() {
  if (!activeStockProductId) return;
  const tbody = document.getElementById('botStockItemsTableBody');
  const countBadge = document.getElementById('botStockCurrentCount');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="4" class="text-center py-2">Đang tải danh sách kho...</td></tr>`;

  try {
    const res = await authFetch(`/api/bot/products/${activeStockProductId}/stock`);
    const data = await res.json();
    if (data.success && data.stock_items) {
      countBadge.innerText = data.stock_items.length;
      if (data.stock_items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center py-2" style="color: var(--text-muted);">Kho hiện đang trống. Hãy dán tài khoản vào ô trên để fill hàng!</td></tr>`;
        return;
      }
      tbody.innerHTML = data.stock_items.map((item, idx) => `
        <tr>
          <td class="font-mono">${idx + 1}</td>
          <td class="font-mono" style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${escapeHtml(item.content)}
          </td>
          <td>${new Date(item.createdAt).toLocaleDateString('vi-VN')}</td>
          <td>
            <button class="btn btn-xs" style="color: #ef4444;" onclick="deleteStockItem(${item.id})">🗑 Xóa</button>
          </td>
        </tr>
      `).join('');
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center py-2" style="color: #ef4444;">Lỗi tải kho: ${err.message}</td></tr>`;
  }
}

async function submitBotFillStock() {
  const id = activeStockProductId;
  if (!id) return;

  const lines = document.getElementById('botFillStockLines').value.trim();
  const broadcast = document.getElementById('botFillStockBroadcast').checked;

  if (!lines) {
    showToast('Vui lòng dán ít nhất 1 dòng tài khoản / key!');
    return;
  }

  try {
    const res = await authFetch(`/api/bot/products/${id}/stock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lines, broadcast })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`🎉 ${data.message}`);
      document.getElementById('botFillStockLines').value = '';
      await refreshCurrentStockList();
      loadBotProducts();
      loadBotOverviewData();
    } else {
      showToast('Lỗi: ' + (data.error || 'Không thể nạp kho'));
    }
  } catch (err) {
    showToast('Lỗi nạp kho: ' + err.message);
  }
}

async function deleteStockItem(stockId) {
  if (!confirm('Anh có chắc muốn xoá dòng tài khoản này khỏi kho?')) return;
  try {
    const res = await authFetch(`/api/bot/stock/${stockId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('Đã xoá dòng khỏi kho');
      await refreshCurrentStockList();
      loadBotProducts();
      loadBotOverviewData();
    }
  } catch (err) {
    showToast('Lỗi xoá: ' + err.message);
  }
}

// ---- Add Product Modal ----
async function openAddBotProductModal() {
  document.getElementById('botNewProdName').value = '';
  document.getElementById('botNewProdPrice').value = '';
  document.getElementById('botNewProdDesc').value = '';

  try {
    const res = await authFetch('/api/bot/categories');
    const data = await res.json();
    const select = document.getElementById('botNewProdCategory');
    if (data.success && data.categories) {
      select.innerHTML = data.categories.map(c => `
        <option value="${c.id}">${escapeHtml(c.name)}</option>
      `).join('');
    }
  } catch (err) {
    console.warn('Load categories error:', err);
  }

  const modal = document.getElementById('botAddProductModal');
  if (modal) modal.classList.add('active');
}

function closeBotAddProductModal() {
  const modal = document.getElementById('botAddProductModal');
  if (modal) modal.classList.remove('active');
}

async function submitBotAddProduct() {
  const name = document.getElementById('botNewProdName').value.trim();
  const category_id = parseInt(document.getElementById('botNewProdCategory').value, 10);
  const price = parseInt(document.getElementById('botNewProdPrice').value, 10);
  const type = document.getElementById('botNewProdType').value;
  const description = document.getElementById('botNewProdDesc').value.trim();

  if (!name || isNaN(price) || price < 0 || !category_id) {
    showToast('Vui lòng nhập đầy đủ tên, giá và chọn danh mục!');
    return;
  }

  try {
    const res = await authFetch('/api/bot/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, category_id, price, type, description })
    });
    const data = await res.json();
    if (data.success) {
      showToast('🎉 Đã thêm mặt hàng mới thành công!');
      closeBotAddProductModal();
      loadBotProducts();
      loadBotOverviewData();
    } else {
      showToast('Lỗi: ' + (data.error || 'Không thể tạo'));
    }
  } catch (err) {
    showToast('Lỗi: ' + err.message);
  }
}

// ---- Categories Management ----
async function loadBotCategories() {
  try {
    const res = await authFetch('/api/bot/categories');
    if (!res.ok) return;
    const data = await res.json();
    if (data.success) {
      allBotCategories = data.categories || [];
      renderBotCategories(allBotCategories);
    }
  } catch (err) {
    console.error('loadBotCategories error:', err);
  }
}

function renderBotCategories(categories) {
  const tbody = document.getElementById('botCategoriesTableBody');
  if (!tbody) return;

  if (!categories || categories.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4" style="color: var(--text-muted);">Chưa có danh mục nào.</td></tr>`;
    return;
  }

  tbody.innerHTML = categories.map((c) => `
    <tr>
      <td class="font-mono text-gold">#${c.id}</td>
      <td><strong>${escapeHtml(c.name)}</strong></td>
      <td><span class="badge badge-purple">${c.product_count || 0} sản phẩm</span></td>
      <td>${c.sortOrder || 0}</td>
      <td>${c.isActive ? '<span class="badge badge-paid">🟢 Hoạt động</span>' : '<span class="badge badge-expired">🔴 Ẩn</span>'}</td>
      <td style="text-align: right;">
        <div style="display: inline-flex; gap: 6px; justify-content: flex-end;">
          <button class="btn btn-xs" style="color: #ef4444;" onclick="deleteCategory(${c.id})">🗑 Xóa</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function openAddCategoryModal() {
  document.getElementById('botNewCatName').value = '';
  const modal = document.getElementById('botAddCategoryModal');
  if (modal) modal.classList.add('active');
}

function closeBotAddCategoryModal() {
  const modal = document.getElementById('botAddCategoryModal');
  if (modal) modal.classList.remove('active');
}

async function submitBotAddCategory() {
  const name = document.getElementById('botNewCatName').value.trim();
  if (!name) {
    showToast('Vui lòng nhập tên danh mục!');
    return;
  }

  try {
    const res = await authFetch('/api/bot/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Đã tạo danh mục mới!');
      closeBotAddCategoryModal();
      loadBotCategories();
    } else {
      showToast('Lỗi: ' + data.error);
    }
  } catch (err) {
    showToast('Lỗi tạo danh mục: ' + err.message);
  }
}

async function deleteCategory(id) {
  if (!confirm('Anh có chắc muốn xoá danh mục này? (Chỉ xoá được nếu danh mục không chứa sản phẩm nào)')) return;
  try {
    const res = await authFetch(`/api/bot/categories/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('Đã xoá danh mục');
      loadBotCategories();
    } else {
      showToast('Lỗi: ' + data.error);
    }
  } catch (err) {
    showToast('Lỗi xoá danh mục: ' + err.message);
  }
}

// ---- Users & Wallet Management ----
function debounceFilterBotUsers() {
  clearTimeout(debounceUserTimer);
  debounceUserTimer = setTimeout(loadBotUsers, 300);
}

async function loadBotUsers() {
  const search = document.getElementById('botUserSearchInput')?.value || '';
  try {
    const res = await authFetch(`/api/bot/users?search=${encodeURIComponent(search)}`);
    if (!res.ok) return;
    const data = await res.json();
    if (data.success) {
      allBotUsers = data.users || [];
      renderBotUsers(allBotUsers);
    }
  } catch (err) {
    console.error('loadBotUsers error:', err);
  }
}

function renderBotUsers(users) {
  const tbody = document.getElementById('botUsersTableBody');
  if (!tbody) return;

  if (!users || users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4" style="color: var(--text-muted);">Không tìm thấy khách hàng nào.</td></tr>`;
    return;
  }

  tbody.innerHTML = users.map(u => {
    const isBanned = Boolean(u.isBanned);
    return `
      <tr>
        <td class="font-mono text-gold">${escapeHtml(u.telegramId)}</td>
        <td>
          <div><strong>${u.username ? '@' + escapeHtml(u.username) : escapeHtml(u.firstName || 'Khách')}</strong></div>
          ${u.firstName && u.username ? `<small style="color: var(--text-muted); font-size: 11px;">${escapeHtml(u.firstName)}</small>` : ''}
        </td>
        <td><strong class="font-mono text-gold">${Number(u.balance || 0).toLocaleString('vi-VN')} đ</strong></td>
        <td>${u.order_count || 0} đơn</td>
        <td class="font-mono">${Number(u.total_spent || 0).toLocaleString('vi-VN')} đ</td>
        <td>${isBanned ? '<span class="badge badge-expired">🚫 Bị khóa</span>' : '<span class="badge badge-paid">🟢 Hoạt động</span>'}</td>
        <td style="text-align: right; white-space: nowrap;">
          <div style="display: inline-flex; gap: 6px; justify-content: flex-end;">
            <button class="btn btn-xs btn-gold" onclick="openAdjustBalanceModal('${escapeHtml(u.telegramId)}', '${escapeHtml(u.username || u.firstName || '')}', ${u.balance || 0})">💵 Nạp / Trừ ví</button>
            <button class="btn btn-xs btn-glass" onclick="toggleBanUser('${escapeHtml(u.telegramId)}', ${isBanned})">${isBanned ? 'Mở khóa' : 'Khóa'}</button>
            <button class="btn btn-xs btn-glass" onclick="viewUserHistory('${escapeHtml(u.telegramId)}')">📜 Lịch sử</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function openAdjustBalanceModal(telegramId, name, balance) {
  document.getElementById('botAdjustTelegramId').value = telegramId;
  document.getElementById('botAdjustUserInfo').innerText = `Khách hàng: @${name || telegramId} • Số dư hiện tại: ${Number(balance).toLocaleString('vi-VN')} đ`;
  document.getElementById('botAdjustAmount').value = '';
  document.getElementById('botAdjustNote').value = '';

  const modal = document.getElementById('botAdjustBalanceModal');
  if (modal) modal.classList.add('active');
}

function closeBotAdjustBalanceModal() {
  const modal = document.getElementById('botAdjustBalanceModal');
  if (modal) modal.classList.remove('active');
}

async function submitBotAdjustBalance() {
  const telegramId = document.getElementById('botAdjustTelegramId').value;
  const amount = parseInt(document.getElementById('botAdjustAmount').value, 10);
  const note = document.getElementById('botAdjustNote').value.trim();

  if (!amount || isNaN(amount)) {
    showToast('Vui lòng nhập số tiền hợp lệ (+ để nạp, - để trừ)');
    return;
  }

  try {
    const res = await authFetch(`/api/bot/users/${encodeURIComponent(telegramId)}/adjust-balance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, note })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`✅ ${data.message}`);
      closeBotAdjustBalanceModal();
      loadBotUsers();
      loadBotOverviewData();
    } else {
      showToast('Lỗi: ' + (data.error || 'Không thể điều chỉnh số dư'));
    }
  } catch (err) {
    showToast('Lỗi: ' + err.message);
  }
}

async function toggleBanUser(telegramId, isBanned) {
  const action = isBanned ? 'mở khóa' : 'khóa';
  if (!confirm(`Anh có chắc chắn muốn ${action} tài khoản Telegram ${telegramId}?`)) return;

  try {
    const res = await authFetch(`/api/bot/users/${encodeURIComponent(telegramId)}/ban`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isBanned: !isBanned })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message);
      loadBotUsers();
    } else {
      showToast('Lỗi: ' + data.error);
    }
  } catch (err) {
    showToast('Lỗi: ' + err.message);
  }
}

async function viewUserHistory(telegramId) {
  const modal = document.getElementById('botUserHistoryModal');
  if (modal) modal.classList.add('active');

  document.getElementById('botUserHistoryTitle').innerText = `📜 Lịch Sử Giao Dịch: ${telegramId}`;
  document.getElementById('botUserTxTableBody').innerHTML = `<tr><td colspan="5" class="text-center py-2">Đang tải lịch sử ví...</td></tr>`;
  document.getElementById('botUserOrdersTableBody').innerHTML = `<tr><td colspan="5" class="text-center py-2">Đang tải đơn hàng...</td></tr>`;

  try {
    const res = await authFetch(`/api/bot/users/${encodeURIComponent(telegramId)}`);
    const data = await res.json();
    if (data.success) {
      const u = data.user;
      document.getElementById('botUserHistorySubtitle').innerText = `${u.username ? '@' + u.username : u.firstName} • Số dư: ${Number(u.balance).toLocaleString('vi-VN')} đ`;

      // Render transactions
      const txBody = document.getElementById('botUserTxTableBody');
      if (!data.transactions || data.transactions.length === 0) {
        txBody.innerHTML = `<tr><td colspan="5" class="text-center py-2" style="color: var(--text-muted);">Chưa có biến động số dư.</td></tr>`;
      } else {
        txBody.innerHTML = data.transactions.map(t => `
          <tr>
            <td><span class="badge ${t.amount > 0 ? 'badge-paid' : 'badge-expired'}">${escapeHtml(t.type)}</span></td>
            <td class="font-mono" style="font-weight: 700; color: ${t.amount > 0 ? '#4ade80' : '#f87171'};">
              ${t.amount > 0 ? '+' : ''}${Number(t.amount).toLocaleString('vi-VN')} đ
            </td>
            <td class="font-mono">${Number(t.balanceAfter).toLocaleString('vi-VN')} đ</td>
            <td>${escapeHtml(t.note || '--')}</td>
            <td>${new Date(t.createdAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</td>
          </tr>
        `).join('');
      }

      // Render orders
      const ordBody = document.getElementById('botUserOrdersTableBody');
      if (!data.orders || data.orders.length === 0) {
        ordBody.innerHTML = `<tr><td colspan="5" class="text-center py-2" style="color: var(--text-muted);">Chưa có đơn hàng nào.</td></tr>`;
      } else {
        ordBody.innerHTML = data.orders.map(o => `
          <tr>
            <td class="font-mono text-gold">#${o.id}</td>
            <td>${escapeHtml(o.product_name || '--')}</td>
            <td class="font-mono text-gold">${Number(o.totalPrice).toLocaleString('vi-VN')} đ</td>
            <td><span class="badge ${o.status === 'COMPLETED' ? 'badge-paid' : 'badge-pending'}">${escapeHtml(o.status)}</span></td>
            <td>${new Date(o.createdAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</td>
          </tr>
        `).join('');
      }
    }
  } catch (err) {
    showToast('Lỗi tải lịch sử: ' + err.message);
  }
}

function closeBotUserHistoryModal() {
  const modal = document.getElementById('botUserHistoryModal');
  if (modal) modal.classList.remove('active');
}

// ---- Orders Management ----
function debounceFilterBotOrders() {
  clearTimeout(debounceOrderTimer);
  debounceOrderTimer = setTimeout(loadBotOrders, 300);
}

async function loadBotOrders() {
  const range = document.getElementById('botOrderFilterRange')?.value || 'all';
  const status = document.getElementById('botOrderFilterStatus')?.value || 'all';
  const search = document.getElementById('botOrderSearchInput')?.value || '';

  try {
    const res = await authFetch(`/api/bot/orders?range=${range}&status=${status}&search=${encodeURIComponent(search)}`);
    if (!res.ok) return;
    const data = await res.json();
    if (data.success) {
      allBotOrders = data.orders || [];
      renderBotOrdersTable(allBotOrders);
    }
  } catch (err) {
    console.error('loadBotOrders error:', err);
  }
}

function renderBotOrdersTable(orders) {
  const tbody = document.getElementById('botOrdersTableBody');
  if (!tbody) return;

  if (!orders || orders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4" style="color: var(--text-muted);">Không tìm thấy đơn hàng nào phù hợp.</td></tr>`;
    return;
  }

  tbody.innerHTML = orders.map(o => {
    const timeStr = o.created_at ? new Date(o.created_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '--';
    let badgeClass = 'badge-pending';
    let statusText = o.status;
    const isCompleted = o.status === 'COMPLETED';

    if (isCompleted) { badgeClass = 'badge-paid'; statusText = '🟢 Hoàn tất'; }
    else if (o.status === 'REFUNDED') { badgeClass = 'badge-expired'; statusText = '↩️ Đã hoàn'; }
    else if (o.status === 'FAILED') { badgeClass = 'badge-expired'; statusText = '🔴 Thất bại'; }

    return `
      <tr>
        <td><strong class="font-mono text-gold">${escapeHtml(o.payment_ref || '#' + o.id)}</strong></td>
        <td>
          <div><strong>${o.tg_username ? '@' + escapeHtml(o.tg_username) : escapeHtml(o.tg_full_name || 'Khách')}</strong></div>
          <small class="font-mono" style="color: var(--text-muted); font-size: 11px;">ID: ${o.telegram_id || '--'}</small>
        </td>
        <td>
          <div><strong>${escapeHtml(o.product_name || '--')}</strong></div>
          ${o.locket_username ? `<span class="mode-tag tag-gold" style="font-size: 10px;">⚡ @${escapeHtml(o.locket_username)}</span>` : ''}
        </td>
        <td>${Number(o.unit_price || 0).toLocaleString('vi-VN')} đ (x${o.quantity})</td>
        <td class="font-mono text-gold" style="font-weight: 700;">${Number(o.final_price || 0).toLocaleString('vi-VN')} đ</td>
        <td><span class="badge ${badgeClass}">${statusText}</span></td>
        <td style="font-size: 12px; color: var(--text-secondary);">${timeStr}</td>
        <td style="text-align: right; white-space: nowrap;">
          <div style="display: inline-flex; gap: 6px; justify-content: flex-end;">
            ${isCompleted ? `
              <button class="btn btn-xs" style="color: #f59e0b;" onclick="refundBotOrder(${o.id})">↩️ Hoàn tiền</button>
            ` : ''}
            ${o.locket_username ? `
              <button class="btn btn-xs btn-gold" onclick="fillLocketUpgradeFromBot('${escapeHtml(o.locket_username)}')">⚡ Nạp Locket</button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function refundBotOrder(orderId) {
  if (!confirm(`Anh có chắc muốn hoàn tiền cho đơn hàng #${orderId}? Số tiền sẽ được cộng trực tiếp lại vào ví khách hàng!`)) return;

  try {
    const res = await authFetch(`/api/bot/orders/${orderId}/refund`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast(`✅ ${data.message}`);
      loadBotOrders();
      loadBotOverviewData();
      loadBotUsers();
    } else {
      showToast('Lỗi: ' + data.error);
    }
  } catch (err) {
    showToast('Lỗi hoàn tiền: ' + err.message);
  }
}

// ---- Expenses Management (Sổ Chi) ----
async function loadBotExpenses() {
  try {
    const res = await authFetch('/api/bot/expenses');
    if (!res.ok) return;
    const data = await res.json();
    if (data.success) {
      allBotExpenses = data.expenses || [];
      renderBotExpenses(allBotExpenses);
    }
  } catch (err) {
    console.error('loadBotExpenses error:', err);
  }
}

function renderBotExpenses(expenses) {
  const tbody = document.getElementById('botExpensesTableBody');
  if (!tbody) return;

  if (!expenses || expenses.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4" style="color: var(--text-muted);">Chưa có khoản chi nào được ghi nhận.</td></tr>`;
    return;
  }

  tbody.innerHTML = expenses.map((e, idx) => `
    <tr>
      <td class="font-mono">${idx + 1}</td>
      <td><strong>${escapeHtml(e.note)}</strong></td>
      <td class="font-mono" style="font-weight: 700; color: #f87171;">-${Number(e.amount).toLocaleString('vi-VN')} đ</td>
      <td>${new Date(e.createdAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</td>
      <td style="text-align: right;">
        <button class="btn btn-xs" style="color: #ef4444;" onclick="deleteExpense(${e.id})">🗑 Xóa</button>
      </td>
    </tr>
  `).join('');
}

async function submitAddExpense() {
  const amount = parseInt(document.getElementById('botNewExpenseAmount').value, 10);
  const note = document.getElementById('botNewExpenseNote').value.trim();

  if (!amount || isNaN(amount) || amount <= 0 || !note) {
    showToast('Vui lòng nhập số tiền chi và nội dung ghi chú!');
    return;
  }

  try {
    const res = await authFetch('/api/bot/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, note })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Đã ghi chi phí thành công!');
      document.getElementById('botNewExpenseAmount').value = '';
      document.getElementById('botNewExpenseNote').value = '';
      loadBotExpenses();
      loadBotOverviewData();
    } else {
      showToast('Lỗi: ' + data.error);
    }
  } catch (err) {
    showToast('Lỗi ghi chi: ' + err.message);
  }
}

async function deleteExpense(id) {
  if (!confirm('Anh có chắc muốn xoá khoản chi này?')) return;
  try {
    const res = await authFetch(`/api/bot/expenses/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('Đã xoá khoản chi');
      loadBotExpenses();
      loadBotOverviewData();
    } else {
      showToast('Lỗi: ' + data.error);
    }
  } catch (err) {
    showToast('Lỗi: ' + err.message);
  }
}

// ---- Broadcast Notification ----
async function loadBotBroadcastInfo() {
  try {
    const res = await authFetch('/api/bot/overview');
    const data = await res.json();
    if (data.success && data.metrics) {
      const el = document.getElementById('botBroadcastAudienceCount');
      if (el) el.innerText = `${Number(data.metrics.users_count || 0).toLocaleString('vi-VN')} người dùng`;
    }
  } catch (err) {
    console.warn('loadBotBroadcastInfo error:', err);
  }
}

async function submitBotBroadcast() {
  const content = document.getElementById('botBroadcastContent').value.trim();
  const alertEl = document.getElementById('botBroadcastAlert');
  const btn = document.getElementById('btnSendBroadcast');

  if (!content) {
    showToast('Vui lòng soạn nội dung thông báo trước khi gửi!');
    return;
  }

  if (!confirm('Anh có chắc chắn muốn gửi thông báo này tới TOÀN BỘ khách hàng trên bot Telegram @Kwshopremium_bot?')) return;

  btn.disabled = true;
  btn.innerText = '⏳ Đang phát thông báo hàng loạt...';
  alertEl.style.display = 'block';
  alertEl.className = 'alert-box';
  alertEl.innerText = 'Đang phát sóng tin nhắn đến toàn bộ khách hàng trên Telegram...';

  try {
    const res = await authFetch('/api/bot/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
    const data = await res.json();
    if (data.success) {
      alertEl.className = 'alert-box success';
      alertEl.innerText = `🎉 ${data.message}`;
      showToast('Đã gửi broadcast thành công!');
    } else {
      alertEl.className = 'alert-box error';
      alertEl.innerText = 'Lỗi gửi broadcast: ' + (data.error || 'Thất bại');
    }
  } catch (err) {
    alertEl.className = 'alert-box error';
    alertEl.innerText = 'Lỗi mạng: ' + err.message;
  } finally {
    btn.disabled = false;
    btn.innerText = '📤 Gửi Thông Báo Tức Thì';
  }
}

// ---- Coupons Management ----
async function loadBotCoupons() {
  try {
    const res = await authFetch('/api/bot/coupons');
    if (!res.ok) return;
    const data = await res.json();
    if (data.success) {
      allBotCoupons = data.coupons || [];
      renderBotCoupons(allBotCoupons);
    }
  } catch (err) {
    console.error('loadBotCoupons error:', err);
  }
}

function renderBotCoupons(coupons) {
  const tbody = document.getElementById('botCouponsTableBody');
  if (!tbody) return;

  if (!coupons || coupons.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4" style="color: var(--text-muted);">Chưa có mã giảm giá nào.</td></tr>`;
    return;
  }

  tbody.innerHTML = coupons.map((c, idx) => `
    <tr>
      <td class="font-mono">${idx + 1}</td>
      <td><strong class="font-mono text-gold" style="font-size: 13px;">${escapeHtml(c.code)}</strong></td>
      <td><span class="badge badge-paid" style="font-size: 12px; font-weight: 700;">-${c.discountPercent}%</span></td>
      <td>${c.isActive ? '<span class="badge badge-paid">🟢 Đang áp dụng</span>' : '<span class="badge badge-expired">🔴 Hết hạn</span>'}</td>
      <td>${new Date(c.createdAt).toLocaleDateString('vi-VN')}</td>
      <td style="text-align: right;">
        <button class="btn btn-xs" style="color: #ef4444;" onclick="deleteCoupon(${c.id})">🗑 Xóa</button>
      </td>
    </tr>
  `).join('');
}

async function submitAddCoupon() {
  const code = document.getElementById('botNewCouponCode').value.trim();
  const discountPercent = parseInt(document.getElementById('botNewCouponPercent').value, 10);

  if (!code || isNaN(discountPercent) || discountPercent < 1 || discountPercent > 100) {
    showToast('Vui lòng nhập mã coupon và % giảm từ 1 đến 100!');
    return;
  }

  try {
    const res = await authFetch('/api/bot/coupons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, discountPercent })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Đã tạo mã giảm giá thành công!');
      document.getElementById('botNewCouponCode').value = '';
      document.getElementById('botNewCouponPercent').value = '';
      loadBotCoupons();
    } else {
      showToast('Lỗi: ' + data.error);
    }
  } catch (err) {
    showToast('Lỗi tạo mã: ' + err.message);
  }
}

async function deleteCoupon(id) {
  if (!confirm('Anh có chắc muốn xoá mã giảm giá này?')) return;
  try {
    const res = await authFetch(`/api/bot/coupons/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('Đã xoá mã giảm giá');
      loadBotCoupons();
    } else {
      showToast('Lỗi: ' + data.error);
    }
  } catch (err) {
    showToast('Lỗi xoá mã: ' + err.message);
  }
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function fillLocketUpgradeFromBot(username) {
  switchTab('upgrade');
  const inputLookup = document.getElementById('inputSmartLookup');
  if (inputLookup) {
    inputLookup.value = username;
    triggerManualLookup();
  }
}


