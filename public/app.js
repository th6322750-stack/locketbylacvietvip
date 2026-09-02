// ==========================================
// STATE MANAGEMENT & CONFIG
// ==========================================
let activeUsername = '';
let debounceTimer = null;

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  const usernameInput = document.getElementById('usernameInput');

  // Listen for username input with debounce
  usernameInput.addEventListener('input', (e) => {
    const rawVal = e.target.value.trim().replace(/^@/, '');
    if (debounceTimer) clearTimeout(debounceTimer);

    if (rawVal) {
      debounceTimer = setTimeout(() => {
        resolveUserProfile(rawVal);
      }, 350);
    } else {
      resetUserProfile();
    }
  });

  usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') startActivation();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
});

// ==========================================
// 1. RESOLVE USER PROFILE (REAL CDN & UID)
// ==========================================
async function resolveUserProfile(username) {
  const cleanName = username.trim().toLowerCase().replace(/^@/, '');
  if (!cleanName) {
    resetUserProfile();
    return;
  }

  activeUsername = cleanName;
  const avatarImg = document.getElementById('avatarImg');
  const displayName = document.getElementById('displayName');
  const uidText = document.getElementById('uidText');

  displayName.textContent = `@${cleanName}`;
  uidText.textContent = 'Đang kiểm tra ID...';

  try {
    const res = await fetch(`get_avatar.php?username=${encodeURIComponent(cleanName)}`);
    const data = await res.json();

    if (data.success && data.avatar_url) {
      avatarImg.src = data.avatar_url;
      displayName.textContent = `@${cleanName}`;

      if (data.uid) {
        uidText.textContent = `UID: ${data.uid}`;
      } else {
        uidText.textContent = `Target: @${cleanName} (CDN Verified)`;
      }
    } else {
      avatarImg.src = `https://api.dicebear.com/7.x/identicon/svg?seed=${cleanName}`;
      displayName.textContent = `@${cleanName}`;
      uidText.textContent = `Locket ID: @${cleanName}`;
    }
  } catch (err) {
    avatarImg.src = `https://api.dicebear.com/7.x/identicon/svg?seed=${cleanName}`;
    displayName.textContent = `@${cleanName}`;
    uidText.textContent = `Locket ID: @${cleanName}`;
  }
}

function resetUserProfile() {
  const avatarImg = document.getElementById('avatarImg');
  const displayName = document.getElementById('displayName');
  const uidText = document.getElementById('uidText');

  avatarImg.src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80';
  displayName.textContent = 'Locket User';
  uidText.textContent = 'Nhập Username để kiểm tra';
}

// ==========================================
// 2. ACTIVATION FLOW (100% IN-PAGE, NO REDIRECT)
// ==========================================
async function startActivation() {
  const usernameInput = document.getElementById('usernameInput');
  const username = usernameInput.value.trim().toLowerCase().replace(/^@/, '');

  if (!username) {
    showToast('⚠️ Vui lòng nhập Username Locket!');
    usernameInput.focus();
    return;
  }

  activeUsername = username;
  const btnSubmit = document.getElementById('btnSubmit');
  const btnSubmitText = document.getElementById('btnSubmitText');
  const queueBox = document.getElementById('queueBox');
  const queueStatusTitle = document.getElementById('queueStatusTitle');
  const queuePosText = document.getElementById('queuePosText');
  const queueSubText = document.getElementById('queueSubText');

  btnSubmit.disabled = true;
  btnSubmitText.textContent = 'ĐANG CẤP QUYỀN...';
  queueBox.style.display = 'block';
  queueStatusTitle.textContent = 'Đang gửi mã kích hoạt tới RevenueCat...';
  queuePosText.textContent = 'ĐANG XỬ LÝ';
  queueSubText.textContent = `Tài khoản: @${username}`;

  try {
    const res = await fetch('queue_api.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'join', username: activeUsername })
    });

    const data = await res.json();
    btnSubmit.disabled = false;
    btnSubmitText.textContent = 'BẤM NÂNG CẤP LOCKET GOLD';
    queueBox.style.display = 'none';

    if (data.success && data.user_status === 'success') {
      showModal(`
        <div style="color: #34d399; font-size: 52px; margin-bottom: 12px;">
          <i class="fa-solid fa-circle-check"></i>
        </div>
        <h3 style="font-size: 22px; font-weight: 900; color: #34d399; margin-bottom: 8px;">
          Nâng Cấp Locket Gold Thành Công!
        </h3>
        <p style="font-size: 14.5px; color: #cbd5e1; margin-bottom: 16px; line-height: 1.5;">
          Tài khoản <b>@${escapeHtml(activeUsername)}</b> đã được cấp quyền Gold thành công!
        </p>
        <div style="background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.35); border-radius: 14px; padding: 14px; margin-bottom: 20px; text-align: left; font-size: 13.5px; color: #cbd5e1; line-height: 1.6;">
          <div style="color: #34d399; font-weight: 800; margin-bottom: 6px;">
            <i class="fa-solid fa-bolt"></i> CÁCH SỬ DỤNG:
          </div>
          <div>1. Vuốt tắt hẳn ứng dụng <b>Locket</b> trên iPhone rồi mở lại.</div>
          <div>2. Tải và cài đặt file <b>LacVietMedia.mobileconfig</b> ở bên dưới để đóng băng bản quyền vĩnh viễn!</div>
        </div>
        <div style="display: flex; gap: 10px;">
          <a href="get_config.php" class="btn-gold-pill" style="min-height: 46px; font-size: 14.5px; text-decoration: none;">
            <i class="fa-solid fa-download"></i> Tải Profile DNS
          </a>
          <button class="btn-secondary" onclick="closeModal()" style="min-height: 46px; font-size: 14.5px;">
            Đóng
          </button>
        </div>
      `);
    } else {
      showModal(`
        <div style="color: #f87171; font-size: 46px; margin-bottom: 12px;">
          <i class="fa-solid fa-triangle-exclamation"></i>
        </div>
        <h3 style="font-size: 20px; font-weight: 900; color: #f87171; margin-bottom: 8px;">
          KÍCH HOẠT THẤT BẠI
        </h3>
        <p style="font-size: 14px; color: #cbd5e1; margin-bottom: 20px;">
          ${escapeHtml(data.message || 'Không tìm thấy UID tài khoản Locket hoặc tài khoản không tồn tại.')}
        </p>
        <button class="btn-gold-pill" onclick="closeModal()" style="min-height: 48px; font-size: 16px;">
          Thử Lại
        </button>
      `);
    }

  } catch (err) {
    btnSubmit.disabled = false;
    btnSubmitText.textContent = 'BẤM NÂNG CẤP LOCKET GOLD';
    queueBox.style.display = 'none';
    showToast('❌ Lỗi kết nối mạng tới máy chủ!');
  }
}

// ==========================================
// 3. UTILITY FUNCTIONS
// ==========================================
function showModal(htmlContent) {
  const overlay = document.getElementById('modalOverlay');
  const modalContent = document.getElementById('modalContent');
  modalContent.innerHTML = htmlContent;
  overlay.style.display = 'flex';
}

function closeModal() {
  const overlay = document.getElementById('modalOverlay');
  overlay.style.display = 'none';
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');
  toastMsg.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2500);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
