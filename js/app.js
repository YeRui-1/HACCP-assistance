// 应用入口：页面路由、密码验证、语言切换
const App = (() => {
  const ADMIN_PASSWORD = 'admin123';
  let isAdmin = false;

  function getEl(id) { return document.getElementById(id); }

  function translatePage() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = I18n.t(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.placeholder = I18n.t(el.dataset.i18nPlaceholder);
    });
    getEl('htmlRoot').setAttribute('lang', I18n.getLang() === 'en' ? 'en' : 'zh-CN');
    const btnLang = getEl('btnLang');
    if (btnLang) btnLang.textContent = I18n.getLang() === 'zh' ? 'EN' : '中';
  }

  function toggleLang() {
    I18n.setLang(I18n.getLang() === 'zh' ? 'en' : 'zh');
    translatePage();
    const activePage = document.querySelector('.page.active');
    if (activePage) {
      if (activePage.id === 'questionnaire') Questionnaire.init();
      else if (activePage.id === 'results') Results.init();
      else if (activePage.id === 'admin') Admin.init();
      else if (activePage.id === 'home') updateLobbyStatus();
    }
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
      if (btnStart) btnStart.onclick = () => navigateTo('questionnaire');
      if (btnResults) btnResults.onclick = () => navigateTo('results');
      updateLobbyStatus();
    } else if (page === 'questionnaire') {
      translatePage();
      Questionnaire.init();
    } else if (page === 'results') {
      translatePage();
      Results.init();
    } else if (page === 'admin') {
      translatePage();
      Admin.init();
    }
  }

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

  function updateLobbyStatus() {
    const statusEl = getEl('cardStatus');
    if (!statusEl) return;
    const submitted = localStorage.getItem('haccp_submitted');
    if (submitted) {
      statusEl.innerHTML = `<span class="has-data">&#10003; ${I18n.t('lobby.status.hasData')}</span>`;
    } else {
      statusEl.innerHTML = `<span class="no-data">${I18n.t('lobby.status.noData')}</span>`;
    }
  }

  function init() {
    translatePage();
    getEl('btnAdmin').addEventListener('click', handleAdminClick);
    getEl('btnLang').addEventListener('click', toggleLang);
    getEl('btnPasswordConfirm').addEventListener('click', confirmPassword);
    getEl('btnPasswordCancel').addEventListener('click', hidePasswordModal);
    getEl('passwordInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') confirmPassword();
    });
    navigateTo('home');
  }

  return { init, navigateTo, exitAdmin, translatePage };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
