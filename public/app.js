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
  // Check URL param for tab
  const params = new URLSearchParams(window.location.search);
  const tabParam = params.get('tab');
  if (tabParam && ['upgrade', 'admin', 'scanner', 'dns', 'master'].includes(tabParam)) {
    switchTab(tabParam);
  }

  loadAdminData();
  loadMasterInfo();
  checkExpiryHeartbeat();
});

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
    const res = await fetch('/api/upgrade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        uid,
        mode: currentMode,
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
    const res = await fetch('/api/upgrade/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries, mode: currentMode, price, channel })
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
    const res = await fetch('/api/users');
    const data = await res.json();
    allUsers = data.users || [];

    // Update Counts & Revenue
    document.getElementById('adminTotalUsers').innerText = data.total || allUsers.length;
    document.getElementById('tabBadgeUserCount').innerText = data.total || allUsers.length;

    const formattedRev = (data.total_revenue || allUsers.length * 50000).toLocaleString('vi-VN') + ' đ';
    document.getElementById('adminTotalRevenue').innerText = formattedRev;

    const count15s = allUsers.filter(u => u.video_15s).length;
    document.getElementById('admin15sUsers').innerText = count15s;

    renderAdminTable(allUsers);
    if (showToastMsg) showToast('Đã làm mới dữ liệu khách hàng!');
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
    const featureBadge = u.video_15s 
      ? `<span class="tag-15s-pill">15s Video</span>` 
      : `<span class="tag-15s-pill" style="background: rgba(255,204,0,0.15); color: #ffcc00;">Gold</span>`;

    const channelBadge = `<span class="tag-channel-pill">${u.channel || 'Zalo'}</span>`;
    const priceFormatted = (Number(u.price) || 50000).toLocaleString('vi-VN') + ' đ';
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
    const res = await fetch('/api/users/bulk-action', {
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
    const res = await fetch(`/api/users/${encodeURIComponent(editingUid)}`, {
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
    const res = await fetch(`/api/users/${encodeURIComponent(uid)}`, { method: 'DELETE' });
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
    const res = await fetch('/api/scan-all');
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
    const res = await fetch(`/api/masters?_t=${Date.now()}`, { cache: 'no-store' });
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
    const res = await fetch('/api/masters/add', {
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
    const res = await fetch(`/api/masters/activate/${encodeURIComponent(keyId)}`, {
      method: 'POST',
      headers: { 'Cache-Control': 'no-cache' }
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
    const res = await fetch(`/api/masters/${encodeURIComponent(keyId)}`, {
      method: 'DELETE',
      headers: { 'Cache-Control': 'no-cache' }
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
    const res = await fetch('/api/masters/test', {
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
