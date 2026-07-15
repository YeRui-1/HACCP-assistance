// 验证程序独立模块 - 计划书提交后的验证程序填写
const Verification = (() => {
  function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&').replace(/"/g, '"').replace(/</g, '<').replace(/>/g, '>');
  }

  function getContainer() {
    return document.getElementById('verificationContainer');
  }

  // ===== 从 HACCP 计划书加载数据 =====
  function loadPlanData() {
    try {
      const raw = localStorage.getItem('haccp_15min_data');
      if (raw) return JSON.parse(raw);
    } catch(e) { console.warn('Failed to read or parse localStorage haccp_15min_data:', e); }
    return null;
  }

  function savePlanData(data) {
    try { localStorage.setItem('haccp_15min_data', JSON.stringify(data)); } catch(e) { console.warn('Failed to write localStorage haccp_15min_data:', e); }
    // 同步到后端（静默，不阻塞）
    syncPlanToBackend(data);
  }

  function syncPlanToBackend(data) {
    var planId = null;
    try { planId = localStorage.getItem('haccp_current_plan_id'); } catch(e) { console.warn('Failed to read localStorage haccp_current_plan_id:', e); }
    if (planId) {
      var token = null;
      try { token = localStorage.getItem('haccp_token'); } catch(e) { console.warn('Failed to read localStorage haccp_token:', e); }
      if (token) {
        fetch('/api/plans/' + planId, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
          body: JSON.stringify({ content: data })
        }).catch(function(err) { console.warn('Failed to sync plan data to backend:', err); });
      }
    }
  }

  function init() {
    const container = getContainer();
    if (!container) return;
    var data = loadPlanData();
    if (!data) {
      container.innerHTML = '<a class="back-link" href="javascript:App.navigateTo(\'home\')">← ' + I18n.t('nav.back') + '</a>' +
        '<div class="empty-state"><div class="empty-icon">🔐</div><h3>' + I18n.t('ver.empty.title') + '</h3><p>' + I18n.t('ver.empty.desc') + '</p></div>';
      return;
    }
    container.innerHTML = `
      <a class="back-link" href="javascript:App.navigateTo('home')">← ${I18n.t('nav.back')}</a>
      <div class="q15-header">
        <h1>🔐 ${I18n.t('ver.pageTitle')}</h1>
        <p class="q15-desc">${I18n.t('ver.pageDesc')}</p>
      </div>
      <div id="verificationContent"></div>
    `;
    renderVerification(data);
    bindEvents(data);
  }

  function renderVerification(data) {
    var content = document.getElementById('verificationContent');
    if (!content) return;

    if (typeof data.verification !== 'object') data.verification = { basis: '', frequency: '', personnel: '', content: '', result: '', record: '' };
    if (!Array.isArray(data.verificationExtraItems)) data.verificationExtraItems = [];

    var ver = data.verification;
    var submitted = data.verificationSubmitted || false;

    var fieldLabels = [
      { key: 'basis', label: I18n.t('ver.fieldBasis'), hint: I18n.t('ver.fieldBasisHint') },
      { key: 'frequency', label: I18n.t('ver.fieldFrequency'), hint: I18n.t('ver.fieldFrequencyHint') },
      { key: 'personnel', label: I18n.t('ver.fieldPersonnel'), hint: I18n.t('ver.fieldPersonnelHint') },
      { key: 'content', label: I18n.t('ver.fieldContent'), hint: I18n.t('ver.fieldContentHint') },
      { key: 'result', label: I18n.t('ver.fieldResult'), hint: I18n.t('ver.fieldResultHint') },
      { key: 'record', label: I18n.t('ver.fieldRecord'), hint: I18n.t('ver.fieldRecordHint') }
    ];
    var cardsHtml = fieldLabels.map(function(f, i) {
      return '<div style="background:var(--gray-50);border:1px solid var(--gray-200);border-radius:10px;padding:16px 18px;margin-bottom:12px;">' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">' +
        '<span style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--primary-700));color:#fff;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + (i + 1) + '</span>' +
        '<label style="font-size:14px;font-weight:600;color:var(--gray-800);">' + f.label + '</label></div>' +
        '<textarea class="ver-field" data-ver-key="' + f.key + '" rows="2" style="width:100%;padding:10px 14px;border:1px solid var(--gray-200);border-radius:8px;font-size:13px;font-family:inherit;resize:vertical;background:#fff;" placeholder="' + f.hint + '">' + esc(ver[f.key] || '') + '</textarea></div>';
    }).join('');

    var extraItems = (data.verificationExtraItems || []).map(function(e, i) {
      return '<div class="ver-extra-row" data-ver-idx="' + i + '" style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">' +
        '<input type="text" class="ver-extra-key" value="' + esc(e.key) + '" placeholder="' + I18n.t('ver.extraItemKey') + '" style="flex:1;padding:7px 10px;border:1px solid var(--gray-200);border-radius:5px;font-size:12px;font-family:inherit;">' +
        '<input type="text" class="ver-extra-val" value="' + esc(e.value) + '" placeholder="' + I18n.t('ver.extraItemValue') + '" style="flex:1;padding:7px 10px;border:1px solid var(--gray-200);border-radius:5px;font-size:12px;font-family:inherit;">' +
        '<button class="btn btn-xs btn-secondary ver-del-extra" data-ver-idx="' + i + '" style="color:#dc2626;border-color:#fecaca;">✕</button></div>';
    }).join('');

    // 管理评审
    var mr = data.managementReview || { reviewContent: '', reviewResult: '', correctiveMeasures: '', reVerification: '' };
    var managementReviewHtml = '<div style="background:#f8fafc;border:1px solid var(--gray-200);border-radius:10px;padding:16px 18px;margin-top:16px;">' +
      '<h3 style="font-size:15px;font-weight:600;color:var(--gray-800);margin-bottom:12px;">' + I18n.t('ver.mgmtReview') + '</h3>' +
      '<p class="q15-table-hint" style="margin-bottom:12px;">' + I18n.t('ver.mgmtReviewHint') + '</p>' +
      '<div class="q15-field-group"><label>' + I18n.t('ver.mgmtReviewContent') + '</label>' +
      '<textarea class="ver-field" data-ver-key="managementReview.reviewContent" rows="2" placeholder="' + I18n.t('ver.mgmtReviewContentHint') + '">' + esc(mr.reviewContent || '') + '</textarea></div>' +
      '<div class="q15-field-group"><label>' + I18n.t('ver.mgmtReviewResult') + '</label>' +
      '<select class="ver-field" data-ver-key="managementReview.reviewResult" style="width:100%;padding:9px 12px;border:1px solid var(--gray-300);border-radius:6px;font-size:13px;font-family:inherit;background:#fff;">' +
        '<option value="">' + I18n.t('ver.mgmtSelect') + '</option>' +
        '<option value="符合"' + (mr.reviewResult === '符合' ? ' selected' : '') + '>' + I18n.t('ver.mgmtCompliant') + '</option>' +
        '<option value="不符合"' + (mr.reviewResult === '不符合' ? ' selected' : '') + '>' + I18n.t('ver.mgmtNonCompliant') + '</option>' +
      '</select></div>' +
      '<div class="ver-corrective-fields" style="display:' + (mr.reviewResult === '不符合' ? '' : 'none') + ';">' +
      '<div class="q15-field-group"><label>' + I18n.t('ver.correctiveMeasures') + '</label>' +
      '<textarea class="ver-field" data-ver-key="managementReview.correctiveMeasures" rows="2" placeholder="' + I18n.t('ver.correctiveMeasuresHint') + '">' + esc(mr.correctiveMeasures || '') + '</textarea></div>' +
      '<div class="q15-field-group"><label>' + I18n.t('ver.reVerification') + '</label>' +
      '<textarea class="ver-field" data-ver-key="managementReview.reVerification" rows="2" placeholder="' + I18n.t('ver.reVerificationHint') + '">' + esc(mr.reVerification || '') + '</textarea></div>' +
      '</div></div>';

    // 签名区
    var signerSection = '';
    if (submitted) {
      signerSection = '<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:16px 18px;margin-top:16px;">' +
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">' +
        '<span style="font-size:20px;">✅</span>' +
        '<span style="font-size:14px;font-weight:600;color:#166534;">' + I18n.t('ver.submittedBanner') + '</span></div>' +
        '<div style="font-size:13px;color:#475569;">' +
        I18n.t('ver.signerLabel') + '：<strong>' + esc(data.verificationSignerName || '') + '</strong> | ' +
        I18n.t('ver.signDateLabel') + '：<strong>' + esc(data.verificationSignerDate || '') + '</strong>' +
        '</div>' +
        '<button class="btn btn-sm btn-secondary" id="verResetBtn" style="margin-top:8px;color:#dc2626;border-color:#fecaca;">' + I18n.t('ver.resetBtn') + '</button>' +
        '</div>';
    } else {
      signerSection = '<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:16px 18px;margin-top:16px;">' +
        '<h3 style="font-size:14px;font-weight:600;color:var(--gray-800);margin-bottom:8px;">' + I18n.t('ver.signTitle') + '</h3>' +
        '<p class="q15-table-hint">' + I18n.t('ver.signHint') + '</p>' +
        '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">' +
        '<input type="text" id="verSignerName" placeholder="' + I18n.t('ver.signerName') + '" style="flex:1;min-width:150px;padding:9px 12px;border:1px solid #d0d5dd;border-radius:6px;font-size:13px;font-family:inherit;" value="' + esc(data.verificationSignerName || '') + '">' +
        '<input type="date" id="verSignerDate" style="width:150px;padding:9px 12px;border:1px solid #d0d5dd;border-radius:6px;font-size:13px;font-family:inherit;" value="' + esc(data.verificationSignerDate || (new Date().toISOString().slice(0,10))) + '">' +
        '</div>' +
        '<button class="btn btn-primary" id="verSubmitBtn" style="margin-top:12px;">' + I18n.t('ver.submitBtn') + '</button>' +
        '</div>';
    }

    var html = '<div class="results-section"><h2>' + I18n.t('ver.sectionTitle') + '</h2>' +
      cardsHtml +
      '<div style="background:var(--gray-50);border:1px solid var(--gray-200);border-radius:10px;padding:16px 18px;margin-top:16px;">' +
      '<h3 style="font-size:14px;font-weight:600;color:var(--gray-800);margin-bottom:8px;">' + I18n.t('ver.extraSection') + '</h3>' +
      '<div id="verExtraBody">' + (extraItems || '<div style="font-size:12px;color:var(--gray-400);text-align:center;padding:8px;">' + I18n.t('ver.extraNoItems') + '</div>') + '</div>' +
      '<button class="btn btn-xs btn-secondary" id="addVerExtraBtn" style="margin-top:4px;">' + I18n.t('ver.extraAddBtn') + '</button></div>' +
      managementReviewHtml +
      signerSection +
      '</div>';

    content.innerHTML = html;
  }

  function collectData(data) {
    document.querySelectorAll('.ver-field').forEach(function(el) {
      var key = el.dataset.verKey;
      if (!key) return;
      // 支持嵌套路径如 managementReview.reviewContent
      if (key.indexOf('.') > -1) {
        var parts = key.split('.');
        if (parts.length === 2) {
          if (!data[parts[0]]) data[parts[0]] = {};
          data[parts[0]][parts[1]] = el.value;
        }
      } else {
        if (key.indexOf('verification.') === 0) {
          var subKey = key.replace('verification.', '');
          if (!data.verification) data.verification = {};
          data.verification[subKey] = el.value;
        } else {
          data[key] = el.value;
        }
      }
    });
    // 收集额外项目
    var extraItems = [];
    document.querySelectorAll('.ver-extra-row').forEach(function(row) {
      var keyInput = row.querySelector('.ver-extra-key');
      var valInput = row.querySelector('.ver-extra-val');
      if (keyInput || valInput) {
        extraItems.push({ key: keyInput ? keyInput.value : '', value: valInput ? valInput.value : '' });
      }
    });
    data.verificationExtraItems = extraItems;
    // 收集验证程序字段
    var verFields = ['basis', 'frequency', 'personnel', 'content', 'result', 'record'];
    verFields.forEach(function(fk) {
      var el = document.querySelector('[data-ver-key="' + fk + '"]');
      if (el && data.verification) data.verification[fk] = el.value;
    });
    return data;
  }

  function bindEvents(data) {
    // 管理评审结果切换显示纠正措施字段
    var mrResult = document.querySelector('[data-ver-key="managementReview.reviewResult"]');
    if (mrResult) {
      mrResult.addEventListener('change', function() {
        var fields = document.querySelector('.ver-corrective-fields');
        if (fields) fields.style.display = this.value === '不符合' ? '' : 'none';
        collectData(data);
        savePlanData(data);
      });
    }

    // 添加额外项目
    document.getElementById('addVerExtraBtn')?.addEventListener('click', function() {
      data = collectData(data);
      if (!data.verificationExtraItems) data.verificationExtraItems = [];
      data.verificationExtraItems.push({ key: '', value: '' });
      savePlanData(data);
      renderVerification(data);
      bindEvents(data);
    });

    // 删除额外项目
    document.querySelectorAll('.ver-del-extra').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var idx = parseInt(this.dataset.verIdx);
        data = collectData(data);
        if (data.verificationExtraItems && data.verificationExtraItems.length > idx) {
          data.verificationExtraItems.splice(idx, 1);
          savePlanData(data);
          renderVerification(data);
          bindEvents(data);
        }
      });
    });

    // 自动保存字段变化
    document.querySelectorAll('.ver-field').forEach(function(el) {
      el.addEventListener('change', function() {
        data = collectData(data);
        savePlanData(data);
      });
    });

    // 验证程序 - 提交
    document.getElementById('verSubmitBtn')?.addEventListener('click', function() {
      data = collectData(data);
      var nameEl = document.getElementById('verSignerName');
      var dateEl = document.getElementById('verSignerDate');
      var signerName = nameEl ? nameEl.value.trim() : '';
      var signDate = dateEl ? dateEl.value : '';
      if (!signerName) { alert(I18n.t('ver.alertNeedName')); if (nameEl) nameEl.focus(); return; }
      if (!signDate) { alert(I18n.t('ver.alertNeedDate')); return; }
      var password = prompt(I18n.t('ver.alertNeedPassword'));
      if (!password) return;

      (async function() {
        var token = null;
        try { token = localStorage.getItem('haccp_token'); } catch(e) { console.warn('Failed to read localStorage haccp_token for verification:', e); }
        if (token) {
          try {
            var resp = await fetch('/api/auth/me', { headers: { 'Authorization': 'Bearer ' + token } });
            if (resp.ok) { doSubmit(data, signerName, signDate); return; }
          } catch(e) { console.warn('Failed to verify auth token with backend:', e); }
        }
        try {
          var username = '';
          if (token) {
            try { var parts = token.split('.'); if (parts.length === 3) { var payload = JSON.parse(atob(parts[1])); username = payload.username || ''; } } catch(e) { console.warn('Failed to decode JWT token for username:', e); }
          }
          if (username) {
            var loginResp = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: username, password: password }) });
            if (loginResp.ok) { doSubmit(data, signerName, signDate); return; }
          }
        } catch(e) { console.warn('Failed to re-login for verification:', e); }
        alert(I18n.t('ver.alertPwdFail'));
      })();
    });

    // 重置
    document.getElementById('verResetBtn')?.addEventListener('click', function() {
      if (!confirm(I18n.t('ver.alertConfirmReset'))) return;
      data.verificationSubmitted = false;
      data.verificationSignerName = '';
      data.verificationSignerDate = '';
      savePlanData(data);
      renderVerification(data);
      bindEvents(data);
    });

    // 自动保存（输入时防抖）
    var saveTimer = null;
    document.querySelectorAll('.ver-field, .ver-extra-key, .ver-extra-val, #verSignerName, #verSignerDate').forEach(function(el) {
      el.addEventListener('input', function() {
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(function() {
          data = collectData(data);
          savePlanData(data);
        }, 300);
      });
    });
  }

  function doSubmit(data, signerName, signDate) {
    data = collectData(data);
    data.verificationSignerName = signerName;
    data.verificationSignerDate = signDate;
    data.verificationSubmitted = true;
    data.verificationSubmitTime = new Date().toISOString();
    savePlanData(data);
    renderVerification(data);
    bindEvents(data);
    alert(I18n.t('ver.alertSubmitSuccess') + '\n\n' + I18n.t('ver.alertSubmitDetail1') + signerName + '\n' + I18n.t('ver.alertSubmitDetail2') + signDate);
    // 刷新导航栏按钮状态
    if (typeof App !== 'undefined' && App.updateVerificationBtn) {
      App.updateVerificationBtn();
    }
  }

  return { init: init };
})();