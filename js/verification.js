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
    } catch(e) {}
    return null;
  }

  function savePlanData(data) {
    try { localStorage.setItem('haccp_15min_data', JSON.stringify(data)); } catch(e) {}
  }

  function init() {
    const container = getContainer();
    if (!container) return;
    var data = loadPlanData();
    if (!data) {
      container.innerHTML = '<a class="back-link" href="javascript:App.navigateTo(\'home\')">← ' + I18n.t('nav.back') + '</a>' +
        '<div class="empty-state"><div class="empty-icon">🔐</div><h3>暂无数据</h3><p>请先创建并提交HACCP计划书</p></div>';
      return;
    }
    container.innerHTML = `
      <a class="back-link" href="javascript:App.navigateTo('home')">← ${I18n.t('nav.back')}</a>
      <div class="q15-header">
        <h1>🔐 验证程序</h1>
        <p class="q15-desc">企业应建立并实施对HACCP计划的确认和验证程序，以证实HACCP计划的完整性、适宜性、有效性。</p>
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
      { key: 'basis', label: '验证的依据和方法', hint: '如：GB 14881-2013' },
      { key: 'frequency', label: '验证的频次', hint: '如：每季度一次' },
      { key: 'personnel', label: '验证的人员', hint: '如：HACCP小组组长' },
      { key: 'content', label: '验证的内容', hint: '如：现场审核' },
      { key: 'result', label: '验证结果及采取的措施', hint: '如：合格，无需整改' },
      { key: 'record', label: '验证记录', hint: '如：记录表编号XXX' }
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
        '<input type="text" class="ver-extra-key" value="' + esc(e.key) + '" placeholder="项目名称" style="flex:1;padding:7px 10px;border:1px solid var(--gray-200);border-radius:5px;font-size:12px;font-family:inherit;">' +
        '<input type="text" class="ver-extra-val" value="' + esc(e.value) + '" placeholder="项目内容" style="flex:1;padding:7px 10px;border:1px solid var(--gray-200);border-radius:5px;font-size:12px;font-family:inherit;">' +
        '<button class="btn btn-xs btn-secondary ver-del-extra" data-ver-idx="' + i + '" style="color:#dc2626;border-color:#fecaca;">✕</button></div>';
    }).join('');

    // 管理评审
    var mr = data.managementReview || { reviewContent: '', reviewResult: '', correctiveMeasures: '', reVerification: '' };
    var managementReviewHtml = '<div style="background:#f8fafc;border:1px solid var(--gray-200);border-radius:10px;padding:16px 18px;margin-top:16px;">' +
      '<h3 style="font-size:15px;font-weight:600;color:var(--gray-800);margin-bottom:12px;">📊 管理评审</h3>' +
      '<p class="q15-table-hint" style="margin-bottom:12px;">验证结果需要输入到管理评审中；当验证结果不符合要求时，应采取纠正措施并进行再验证。</p>' +
      '<div class="q15-field-group"><label>评审内容</label>' +
      '<textarea class="ver-field" data-ver-key="managementReview.reviewContent" rows="2" placeholder="描述管理评审的内容和范围">' + esc(mr.reviewContent || '') + '</textarea></div>' +
      '<div class="q15-field-group"><label>评审结果</label>' +
      '<select class="ver-field" data-ver-key="managementReview.reviewResult" style="width:100%;padding:9px 12px;border:1px solid var(--gray-300);border-radius:6px;font-size:13px;font-family:inherit;background:#fff;">' +
        '<option value="">请选择</option>' +
        '<option value="符合"' + (mr.reviewResult === '符合' ? ' selected' : '') + '>符合要求</option>' +
        '<option value="不符合"' + (mr.reviewResult === '不符合' ? ' selected' : '') + '>不符合要求</option>' +
      '</select></div>' +
      '<div class="ver-corrective-fields" style="display:' + (mr.reviewResult === '不符合' ? '' : 'none') + ';">' +
      '<div class="q15-field-group"><label>纠正措施</label>' +
      '<textarea class="ver-field" data-ver-key="managementReview.correctiveMeasures" rows="2" placeholder="采取的纠正措施">' + esc(mr.correctiveMeasures || '') + '</textarea></div>' +
      '<div class="q15-field-group"><label>再验证措施</label>' +
      '<textarea class="ver-field" data-ver-key="managementReview.reVerification" rows="2" placeholder="纠正措施完成后的再验证计划">' + esc(mr.reVerification || '') + '</textarea></div>' +
      '</div></div>';

    // 签名区
    var signerSection = '';
    if (submitted) {
      signerSection = '<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:16px 18px;margin-top:16px;">' +
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">' +
        '<span style="font-size:20px;">✅</span>' +
        '<span style="font-size:14px;font-weight:600;color:#166534;">验证程序已提交</span></div>' +
        '<div style="font-size:13px;color:#475569;">' +
        '组长签名：<strong>' + esc(data.verificationSignerName || '') + '</strong> | ' +
        '签名日期：<strong>' + esc(data.verificationSignerDate || '') + '</strong>' +
        '</div>' +
        '<button class="btn btn-sm btn-secondary" id="verResetBtn" style="margin-top:8px;color:#dc2626;border-color:#fecaca;">🔄 重新提交验证程序</button>' +
        '</div>';
    } else {
      signerSection = '<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:16px 18px;margin-top:16px;">' +
        '<h3 style="font-size:14px;font-weight:600;color:var(--gray-800);margin-bottom:8px;">✍️ HACCP小组组长签名确认</h3>' +
        '<p class="q15-table-hint">验证程序填写完成后，需由HACCP小组组长输入登录密码进行签名确认，提交后即生效。</p>' +
        '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">' +
        '<input type="text" id="verSignerName" placeholder="组长姓名" style="flex:1;min-width:150px;padding:9px 12px;border:1px solid #d0d5dd;border-radius:6px;font-size:13px;font-family:inherit;" value="' + esc(data.verificationSignerName || '') + '">' +
        '<input type="date" id="verSignerDate" style="width:150px;padding:9px 12px;border:1px solid #d0d5dd;border-radius:6px;font-size:13px;font-family:inherit;" value="' + esc(data.verificationSignerDate || (new Date().toISOString().slice(0,10))) + '">' +
        '</div>' +
        '<button class="btn btn-primary" id="verSubmitBtn" style="margin-top:12px;">🔐 组长密码签名提交</button>' +
        '</div>';
    }

    var html = '<div class="results-section"><h2>验证程序</h2>' +
      cardsHtml +
      '<div style="background:var(--gray-50);border:1px solid var(--gray-200);border-radius:10px;padding:16px 18px;margin-top:16px;">' +
      '<h3 style="font-size:14px;font-weight:600;color:var(--gray-800);margin-bottom:8px;">📋 新增验证项目</h3>' +
      '<div id="verExtraBody">' + (extraItems || '<div style="font-size:12px;color:var(--gray-400);text-align:center;padding:8px;">暂无新增项目</div>') + '</div>' +
      '<button class="btn btn-xs btn-secondary" id="addVerExtraBtn" style="margin-top:4px;">+ 添加项目</button></div>' +
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
      if (!signerName) { alert('请输入HACCP小组组长姓名'); if (nameEl) nameEl.focus(); return; }
      if (!signDate) { alert('请选择签名日期'); return; }
      var password = prompt('请输入登录密码以确认组长签名：');
      if (!password) return;

      (async function() {
        var token = null;
        try { token = localStorage.getItem('haccp_token'); } catch(e) {}
        if (token) {
          try {
            var resp = await fetch('/api/auth/me', { headers: { 'Authorization': 'Bearer ' + token } });
            if (resp.ok) { doSubmit(data, signerName, signDate); return; }
          } catch(e) {}
        }
        try {
          var username = '';
          if (token) {
            try { var parts = token.split('.'); if (parts.length === 3) { var payload = JSON.parse(atob(parts[1])); username = payload.username || ''; } } catch(e) {}
          }
          if (username) {
            var loginResp = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: username, password: password }) });
            if (loginResp.ok) { doSubmit(data, signerName, signDate); return; }
          }
        } catch(e) {}
        alert('密码验证失败。请确认您是已登录的HACCP小组组长，并输入正确的登录密码。');
      })();
    });

    // 重置
    document.getElementById('verResetBtn')?.addEventListener('click', function() {
      if (!confirm('确定要重置验证程序吗？重置后需要重新填写并签名提交。')) return;
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
    alert('✅ 验证程序已提交成功！\n\n组长签名：' + signerName + '\n签名日期：' + signDate);
    // 刷新导航栏按钮状态
    if (typeof App !== 'undefined' && App.updateVerificationBtn) {
      App.updateVerificationBtn();
    }
  }

  return { init: init };
})();