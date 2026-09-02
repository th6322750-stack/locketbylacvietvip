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
  let cleanName = username.trim();
  const linkMatch = cleanName.match(/locket\.(?:cam|camera)(?:\/links)?\/([a-zA-Z0-9._-]+)/i);
  if (linkMatch) cleanName = linkMatch[1];
  cleanName = cleanName.replace(/^@/, '').trim();

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
    const res = await fetch(`/get_avatar.php?username=${encodeURIComponent(cleanName)}`);
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
  const rawVal = usernameInput.value.trim();

  if (!rawVal) {
    showToast('⚠️ Vui lòng nhập Username Locket!');
    usernameInput.focus();
    return;
  }

  let clean = rawVal;
  const linkMatch = rawVal.match(/locket\.(?:cam|camera)(?:\/links)?\/([a-zA-Z0-9._-]+)/i);
  if (linkMatch) clean = linkMatch[1];
  clean = clean.replace(/^@/, '').trim();

  activeUsername = clean;
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
  queueSubText.textContent = `Tài khoản: @${activeUsername}`;

  try {
    const res = await fetch('/queue_api.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'join', username: activeUsername })
    });

    const data = await res.json();
    btnSubmit.disabled = false;
    btnSubmitText.textContent = 'BẤM NÂNG CẤP LOCKET GOLD';
    queueBox.style.display = 'none';

    if (data.success && data.user_status === 'success') {
      const fullDnsUrl = window.location.origin ? (window.location.origin + '/LacVietMedia.mobileconfig') : 'https://locketbylacvietvip.vercel.app/LacVietMedia.mobileconfig';
      
      showModal(`
        <div style="color: #34d399; font-size: 48px; margin-bottom: 8px;">
          <i class="fa-solid fa-circle-check"></i>
        </div>
        <h3 style="font-size: 21px; font-weight: 900; color: #34d399; margin-bottom: 4px;">
          ✅ KÍCH HOẠT THÀNH CÔNG
        </h3>
        <div style="font-size: 14.5px; font-weight: 700; color: var(--gold-primary); margin-bottom: 14px;">
          📅 Plan: Gold (12T) • @${escapeHtml(activeUsername)}
        </div>

        <div style="background: rgba(15, 23, 42, 0.75); border: 1px solid rgba(251, 191, 36, 0.35); border-radius: 14px; padding: 14px; margin-bottom: 16px; text-align: left; font-size: 13.5px; color: #e2e8f0; line-height: 1.6;">
          <div style="color: #fbbf24; font-weight: 800; font-size: 14px; margin-bottom: 8px;">
            🛡️ HƯỚNG DẪN QUAN TRỌNG:
          </div>
          <div style="margin-bottom: 6px;">
            <b>1️⃣</b> Vào App Locket kiểm tra đã có Gold chưa.
          </div>
          <div style="margin-bottom: 8px;">
            <b>2️⃣</b> Nếu đã có, tiến hành <b>CÀI DNS NGAY</b> (trong 45s):
          </div>
          <div style="background: rgba(16, 185, 129, 0.12); border: 1px dashed rgba(52, 211, 153, 0.5); padding: 10px 12px; border-radius: 8px; margin-bottom: 8px;">
            <div style="word-break: break-all;">🍏 <b>iOS:</b> Bấm vào đây để cài 👉🏼 <a href="${fullDnsUrl}" target="_blank" style="color: #38bdf8; font-weight: 800; text-decoration: underline;">${fullDnsUrl}</a></div>
            <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">(Mở link bằng Safari ➔ Cho phép ➔ Cài đặt Profile)</div>
          </div>
          <div style="color: #f87171; font-weight: 700; font-size: 12.5px;">
            💡 Lưu ý: Bắt buộc cài DNS để không bị mất Gold!
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; gap: 8px;">
            <a href="${fullDnsUrl}" class="btn-gold-pill" style="min-height: 44px; font-size: 14px; text-decoration: none; flex: 1;">
              <i class="fa-solid fa-download"></i> CÀI DNS NGAY
            </a>
            <button class="btn-secondary" onclick="copyZaloText('${fullDnsUrl}', '${escapeHtml(activeUsername)}')" style="min-height: 44px; font-size: 14px; flex: 1; background: rgba(56, 189, 248, 0.15); border-color: rgba(56, 189, 248, 0.4); color: #38bdf8;">
              <i class="fa-solid fa-copy"></i> Copy Gửi Zalo
            </button>
          </div>
          <button class="btn-secondary" onclick="closeModal()" style="min-height: 40px; font-size: 13.5px; width: 100%;">
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
    console.error('[Activation Error]:', err);
    btnSubmit.disabled = false;
    btnSubmitText.textContent = 'BẤM NÂNG CẤP LOCKET GOLD';
    queueBox.style.display = 'none';
    showToast(`❌ Lỗi: ${err.message || 'Kết nối mạng tới máy chủ thất bại'}`);
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

function copyZaloText(dnsUrl, username) {
  const text = `✅ KÍCH HOẠT THÀNH CÔNG
📅 Plan: Gold (12T) • @${username}

🛡️ HƯỚNG DẪN QUAN TRỌNG:
1️⃣ Vào App Locket kiểm tra đã có Gold chưa.
2️⃣ Nếu đã có, tiến hành CÀI DNS NGAY (trong 45s):

🍏 iOS: Bấm vào đây để cài 👉🏼 ${dnsUrl}
(Mở link bằng Safari ➔ Cho phép ➔ Cài đặt Profile)

💡 Lưu ý: Bắt buộc cài DNS để không bị mất Gold!`;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('📋 Đã sao chép tin nhắn gửi Zalo!');
    }).catch(() => {
      fallbackCopy(text);
    });
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.left = "-999999px";
  textArea.style.top = "-999999px";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    document.execCommand('copy');
    showToast('📋 Đã sao chép tin nhắn gửi Zalo!');
  } catch (err) {
    showToast('⚠️ Vui lòng sao chép thủ công!');
  }
  document.body.removeChild(textArea);
}

function handleAvatarError(img) {
  if (!img) return;
  const name = activeUsername || 'Locket';
  img.onerror = null;
  img.src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=f59e0b,fbbf24&textColor=ffffff&fontWeight=700`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


