// 应用入口：页面路由、密码验证、语言切换、用户认证
const App = (() => {
  const ADMIN_PASSWORD = 'admin123';
  let isAdmin = false;
  let currentUser = null;

  const API_BASE = '';  // 空字符串表示同源请求

  function getEl(id) { return document.getElementById(id); }

  function translatePage() {
    // HTML title
    const titleEl = document.querySelector('title[data-i18n]');
    if (titleEl) titleEl.textContent = I18n.t(titleEl.dataset.i18n);
    // Elements with data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = I18n.t(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.placeholder = I18n.t(el.dataset.i18nPlaceholder);
    });
    getEl('htmlRoot').setAttribute('lang', I18n.getLang() === 'en' ? 'en' : 'zh-CN');
    const btnLang = getEl('btnLang');
    if (btnLang) btnLang.textContent = I18n.getLang() === 'zh' ? 'EN' : I18n.getLang() === 'en' ? '中' : 'EN';
  }

  function toggleLang() {
    I18n.setLang(I18n.getLang() === 'zh' ? 'en' : 'zh');
    translatePage();
    const activePage = document.querySelector('.page.active');
    if (activePage) {
      if (activePage.id === 'questionnaire') {
        Questionnaire15min.init();
      } else if (activePage.id === 'results') Results.init();
      else if (activePage.id === 'admin') Admin.init();
      else if (activePage.id === 'home') updateLobbyStatus();
    }
    // 刷新认证按钮文本
    updateAuthButton();
  }

  function navigateTo(page) {
    if (page === 'admin' && !isAdmin) {
      showPasswordModal();
      return;
    }

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    getEl(page).classList.add('active');

    if (page === 'home') {
      translatePage();
      const btnStart = getEl('btnStart');
      const btnResults = getEl('btnGoResults');
      const btnProfile = getEl('btnGoProfile');
      const btnRecords = getEl('btnGoRecords');
      if (btnStart) btnStart.onclick = () => navigateTo('questionnaire');
      if (btnResults) btnResults.onclick = () => navigateTo('results');
      if (btnProfile) btnProfile.onclick = () => navigateTo('profile');
      if (btnRecords) btnRecords.onclick = () => navigateTo('records');
      updateLobbyStatus();
    } else if (page === 'profile') {
      translatePage();
      Profile.init();
    } else if (page === 'questionnaire') {
      translatePage();
      Questionnaire15min.init();
    } else if (page === 'hazardWorksheet') {
      translatePage();
      if (window.Questionnaire15min && Questionnaire15min.showHazardWorksheet) {
        Questionnaire15min.showHazardWorksheet();
      }
    } else if (page === 'results') {
      translatePage();
      Results.init();
    } else if (page === 'verification') {
      translatePage();
      if (typeof Verification !== 'undefined') Verification.init();
    } else if (page === 'records') {
      translatePage();
      if (typeof Records !== 'undefined') Records.init();
    } else if (page === 'admin') {
      translatePage();
      Admin.init();
    }
  }

  // ===== 密码验证（管理员） =====
  function showPasswordModal() {
    const modal = getEl('passwordModal');
    const input = getEl('passwordInput');
    const error = getEl('passwordError');
    translatePage();
    modal.classList.add('show');
    input.value = '';
    error.style.display = 'none';
    input.focus();
  }

  function hidePasswordModal() {
    getEl('passwordModal').classList.remove('show');
  }

  function confirmPassword() {
    const input = getEl('passwordInput');
    const error = getEl('passwordError');
    if (input.value === ADMIN_PASSWORD) {
      isAdmin = true;
      hidePasswordModal();
      getEl('btnAdmin').textContent = I18n.t('nav.exitAdmin');
      getEl('btnAdmin').classList.add('is-admin');
      navigateTo('admin');
    } else {
      error.style.display = 'block';
      input.value = '';
      input.focus();
    }
  }

  function exitAdmin() {
    isAdmin = false;
    getEl('btnAdmin').textContent = I18n.t('nav.admin');
    getEl('btnAdmin').classList.remove('is-admin');
    navigateTo('home');
  }

  function handleAdminClick() {
    if (isAdmin) {
      exitAdmin();
    } else {
      if (getEl('admin').classList.contains('active')) return;
      showPasswordModal();
    }
  }

  // ===== 用户认证 =====

  function getToken() {
    try { return localStorage.getItem('haccp_token'); } catch (e) { return null; }
  }

  function setToken(token) {
    try { localStorage.setItem('haccp_token', token); } catch (e) { /* ignore */ }
  }

  function clearToken() {
    try { localStorage.removeItem('haccp_token'); } catch (e) { /* ignore */ }
  }

  async function updateAuthButton() {
    const btn = getEl('btnAuth');
    if (!btn) return;
    if (currentUser) {
      btn.textContent = `${currentUser.username} | ${I18n.t('auth.logout')}`;
      btn.className = 'btn-header logged-in';
      btn.style.display = '';
      btn.onclick = handleLogout;
    } else {
      btn.textContent = I18n.t('auth.login');
      btn.className = 'btn-header';
      btn.style.display = '';
      btn.onclick = showLoginModal;
    }
  }

  function showLoginModal() {
    const modal = getEl('loginModal');
    getEl('loginUsername').value = '';
    getEl('loginPassword').value = '';
    getEl('loginError').style.display = 'none';
    translatePage();
    modal.classList.add('show');
    setTimeout(() => getEl('loginUsername').focus(), 100);
  }

  function hideLoginModal() {
    getEl('loginModal').classList.remove('show');
  }

  function showRegisterModal() {
    hideLoginModal();
    const modal = getEl('registerModal');
    getEl('registerUsername').value = '';
    getEl('registerCompany').value = '';
    getEl('registerPassword').value = '';
    getEl('registerConfirmPassword').value = '';
    getEl('registerError').style.display = 'none';
    translatePage();
    modal.classList.add('show');
    setTimeout(() => getEl('registerUsername').focus(), 100);
  }

  function hideRegisterModal() {
    getEl('registerModal').classList.remove('show');
  }

  function showLoginFromRegister() {
    hideRegisterModal();
    showLoginModal();
  }

  function setLoading(btnId, loading) {
    const btn = getEl(btnId);
    if (!btn) return;
    if (loading) {
      btn.disabled = true;
      btn.dataset.originalText = btn.textContent;
      btn.textContent = I18n.t('auth.loading');
    } else {
      btn.disabled = false;
      if (btn.dataset.originalText) btn.textContent = btn.dataset.originalText;
    }
  }

  async function handleRegister() {
    const username = getEl('registerUsername').value.trim();
    const company = getEl('registerCompany').value.trim();
    const password = getEl('registerPassword').value;
    const confirm = getEl('registerConfirmPassword').value;
    const errorEl = getEl('registerError');

    // 前端校验
    if (username.length < 2 || username.length > 50) {
      errorEl.textContent = I18n.t('auth.usernameError');
      errorEl.style.display = 'block';
      return;
    }
    if (!company) {
      errorEl.textContent = I18n.t('auth.companyNameError');
      errorEl.style.display = 'block';
      return;
    }
    if (password.length < 6) {
      errorEl.textContent = I18n.t('auth.passwordError');
      errorEl.style.display = 'block';
      return;
    }
    if (password !== confirm) {
      errorEl.textContent = I18n.t('auth.passwordMismatch');
      errorEl.style.display = 'block';
      return;
    }

    errorEl.style.display = 'none';
    setLoading('btnRegisterConfirm', true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, company_name: company, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        errorEl.textContent = data.detail || I18n.t('auth.registerSuccess');
        errorEl.style.display = 'block';
        setLoading('btnRegisterConfirm', false);
        return;
      }

      // 注册成功，保存 token 和用户信息
      setToken(data.token);
      currentUser = data.user;
      hideRegisterModal();
      updateAuthButton();
      alert(I18n.t('auth.registerSuccess'));
    } catch (e) {
      errorEl.textContent = 'Network error';
      errorEl.style.display = 'block';
    }
    setLoading('btnRegisterConfirm', false);
  }

  async function handleLogin() {
    const username = getEl('loginUsername').value.trim();
    const password = getEl('loginPassword').value;
    const errorEl = getEl('loginError');

    if (!username || !password) {
      errorEl.textContent = I18n.t('auth.username') + ' / ' + I18n.t('auth.password') + ' ' + I18n.t('q.required');
      errorEl.style.display = 'block';
      return;
    }

    errorEl.style.display = 'none';
    setLoading('btnLoginConfirm', true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        errorEl.textContent = data.detail || '登录失败';
        errorEl.style.display = 'block';
        setLoading('btnLoginConfirm', false);
        return;
      }

      // 登录成功
      setToken(data.token);
      currentUser = data.user;
      hideLoginModal();
      updateAuthButton();
    } catch (e) {
      errorEl.textContent = 'Network error';
      errorEl.style.display = 'block';
    }
    setLoading('btnLoginConfirm', false);
  }

  function handleLogout() {
    if (!confirm(I18n.t('auth.logout') + '?')) return;
    currentUser = null;
    clearToken();
    updateAuthButton();
    if (isAdmin) exitAdmin();
  }

  async function checkAuth() {
    const token = getToken();
    if (!token) {
      updateAuthButton();
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        currentUser = data.user;
      } else {
        clearToken();
        currentUser = null;
      }
    } catch (e) {
      // 后端未启动时不报错，只是不显示用户信息
      currentUser = null;
    }
    updateAuthButton();
  }

  function updateLobbyStatus() {
    const statusEl = getEl('cardStatus');
    if (!statusEl) return;
    const submitted = localStorage.getItem('haccp_submitted');
    if (submitted) {
      statusEl.innerHTML = `<span class="has-data">&#10003; ${I18n.t('lobby.status.hasData')}</span>`;
    } else {
      statusEl.innerHTML = `<span class="no-data">${I18n.t('lobby.status.noData')}</span>`;
    }
    
    // 更新验证程序按钮状态
    updateVerificationBtn();
  }

  // ===== 验证程序独立入口 =====
  function updateVerificationBtn() {
    const btn = getEl('btnVerification');
    if (!btn) return;
    const submitted = localStorage.getItem('haccp_submitted');
    if (!submitted) {
      btn.style.display = 'none';
      return;
    }
    btn.style.display = '';
    try {
      const raw = localStorage.getItem('haccp_15min_data');
      if (raw) {
        const data = JSON.parse(raw);
        if (data.verificationSubmitted) {
          btn.textContent = '✅ ' + I18n.t('nav.verificationDone');
          btn.className = 'btn-header logged-in';
        } else {
          btn.textContent = '🔐 ' + I18n.t('nav.verification');
          btn.className = 'btn-header';
        }
      } else {
        btn.textContent = '🔐 ' + I18n.t('nav.verification');
        btn.className = 'btn-header';
      }
    } catch(e) {
      btn.textContent = '🔐 ' + I18n.t('nav.verification');
      btn.className = 'btn-header';
    }
  }

  function navigateToVerification() {
    navigateTo('verification');
  }

  // ===== 24小时定时提醒 =====
  const VERIFICATION_REMINDER_KEY = 'haccp_verification_reminder_time';
  const VERIFICATION_REMINDER_INTERVAL = 24 * 60 * 60 * 1000; // 24小时

  function checkVerificationReminder() {
    const submitted = localStorage.getItem('haccp_submitted');
    if (!submitted) return; // 未提交计划书，不提醒

    try {
      const raw = localStorage.getItem('haccp_15min_data');
      if (!raw) return;
      const data = JSON.parse(raw);
      // 如果验证程序已提交，不提醒
      if (data.verificationSubmitted) {
        clearVerificationReminder();
        return;
      }
    } catch(e) { return; }

    // 检查上次提醒时间
    var lastReminder = 0;
    try { lastReminder = parseInt(localStorage.getItem(VERIFICATION_REMINDER_KEY)) || 0; } catch(e) {}
    var now = Date.now();
    
    if (now - lastReminder >= VERIFICATION_REMINDER_INTERVAL) {
      // 需要提醒
      showVerificationReminder();
      try { localStorage.setItem(VERIFICATION_REMINDER_KEY, String(now)); } catch(e) {}
    }
  }

  function showVerificationReminder() {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.display = 'flex';
    overlay.innerHTML = '<div class="modal-box" style="text-align:center;">' +
      '<div style="font-size:48px;margin-bottom:12px;">⏰</div>' +
      '<h3 style="margin-bottom:8px;">HACCP验证程序提醒</h3>' +
      '<p style="font-size:14px;color:var(--gray-500);margin-bottom:20px;">您的HACCP计划书已创建完成，但验证程序尚未填写并提交。<br>请尽快完成HACCP验证程序，以确保体系的有效运行。</p>' +
      '<div style="display:flex;gap:10px;justify-content:center;">' +
        '<button class="btn btn-primary" id="reminderGoBtn" style="padding:10px 24px;">📝 去填写验证程序</button>' +
        '<button class="btn btn-secondary" id="reminderLaterBtn" style="padding:10px 24px;">稍后提醒</button>' +
      '</div>' +
    '</div>';
    document.body.appendChild(overlay);

    document.getElementById('reminderGoBtn').addEventListener('click', function() {
      overlay.remove();
      navigateToVerification();
    });

    document.getElementById('reminderLaterBtn').addEventListener('click', function() {
      overlay.remove();
    });

    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) overlay.remove();
    });
  }

  function clearVerificationReminder() {
    try { localStorage.removeItem(VERIFICATION_REMINDER_KEY); } catch(e) {}
  }

  // 初始化24小时定时器（页面加载后启动）
  function startVerificationReminderTimer() {
    // 立即检查一次
    checkVerificationReminder();
    // 每隔1小时检查一次
    setInterval(checkVerificationReminder, 60 * 60 * 1000);
  }

  function init() {
    translatePage();

    // 管理员
    getEl('btnAdmin').addEventListener('click', handleAdminClick);
    getEl('btnLang').addEventListener('click', toggleLang);
    getEl('btnPasswordConfirm').addEventListener('click', confirmPassword);
    getEl('btnPasswordCancel').addEventListener('click', hidePasswordModal);
    getEl('passwordInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') confirmPassword();
    });

    // 登录
    getEl('btnLoginConfirm').addEventListener('click', handleLogin);
    getEl('btnLoginCancel').addEventListener('click', hideLoginModal);
    getEl('loginPassword').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleLogin();
    });
    getEl('btnSwitchToRegister').addEventListener('click', (e) => {
      e.preventDefault();
      showRegisterModal();
    });

    // 注册
    getEl('btnRegisterConfirm').addEventListener('click', handleRegister);
    getEl('btnRegisterCancel').addEventListener('click', hideRegisterModal);
    getEl('registerConfirmPassword').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleRegister();
    });
    getEl('btnSwitchToLogin').addEventListener('click', (e) => {
      e.preventDefault();
      showLoginFromRegister();
    });

    // 点击弹窗外部关闭
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.classList.remove('show');
        }
      });
    });

    // 验证程序按钮
    const btnV = getEl('btnVerification');
    if (btnV) btnV.addEventListener('click', navigateToVerification);

    // 检查登录状态
    checkAuth();
    navigateTo('home');
    
    // 启动24小时验证程序定时提醒
    startVerificationReminderTimer();
  }

  return { init, navigateTo, exitAdmin, translatePage, updateVerificationBtn, navigateToVerification };
})();

document.addEventListener('DOMContentLoaded', () => App.init());