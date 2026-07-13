// 结果展示：自动调用 AI 生成报告 + 用户答案 + HACCP 计划章节
const Results = (() => {
  let activeSection = 'aiReport';
  var API_HOST = (function() {
    if (window.location.protocol === 'file:' || window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') {
      return 'http://localhost:8000';
    }
    return '';
  })();

  function getEl(id) { return document.getElementById(id); }

  function esc(str) {
    if (!str) return '';
    // NOTE: the replacements below use the actual HTML entities - do not let formatter change them
    var s = String(str);
    s = s.replace(/&/g, String.fromCharCode(38, 97, 109, 112, 59));
    s = s.replace(/"/g, String.fromCharCode(38, 113, 117, 111, 116, 59));
    s = s.replace(/</g, String.fromCharCode(38, 108, 116, 59));
    s = s.replace(/>/g, String.fromCharCode(38, 103, 116, 59));
    return s;
  }

  function loadTemplate() {
    try { const raw = localStorage.getItem('haccp_questionnaire_template'); return raw ? JSON.parse(raw) : null; }
    catch (e) { return null; }
  }

  async function syncTemplateFromBackend() {
    try {
      const resp = await fetch('http://localhost:8000/api/template');
      if (!resp.ok) return;
      const data = await resp.json();
      if (data.template && data.template.content) {
        const c = data.template.content;
        if (c.questionnaire) localStorage.setItem('haccp_questionnaire_template', JSON.stringify(c.questionnaire));
        if (c.flowchart) localStorage.setItem('haccp_flowchart_template', JSON.stringify(c.flowchart));
      }
    } catch (e) { /* fallback to localStorage */ }
  }

  function loadAnswers() {
    try { const raw = localStorage.getItem('haccp_answers'); return raw ? JSON.parse(raw) : {}; }
    catch (e) { return {}; }
  }

  function loadFcTemplate() {
    try { const raw = localStorage.getItem('haccp_flowchart_template'); return raw ? JSON.parse(raw) : { enabled: false, defaultSteps: [] }; }
    catch (e) { return { enabled: false, defaultSteps: [] }; }
  }

  function loadFcData() {
    try { const raw = localStorage.getItem('haccp_flowchart'); return raw ? JSON.parse(raw) : []; }
    catch (e) { return []; }
  }

  /** 获取 draw.io 导出的 SVG 数据（base64 或 SVG 字符串） */
  function getDrawioSvg() {
    try { return localStorage.getItem('haccp_drawio_svg') || null; } catch(e) { return null; }
  }


  function load15minData() {
    try {
      const raw = localStorage.getItem('haccp_15min_submitted');
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return null;
  }

  function is15minMode() {
    return !!localStorage.getItem('haccp_15min_submitted');
  }

  // ===== Plans backend loading =====
  var _plansCache = [];
  var _currentPlanId = null;

  function getCurrentPlanId() {
    if (_currentPlanId) return _currentPlanId;
    try { _currentPlanId = localStorage.getItem('haccp_current_plan_id'); } catch(e) {}
    return _currentPlanId;
  }

  function setCurrentPlanId(id) {
    _currentPlanId = id;
    try { localStorage.setItem('haccp_current_plan_id', String(id || '')); } catch(e) {}
  }

  async function loadPlansList() {
    try {
      var token = localStorage.getItem('haccp_token');
      if (!token) return [];
      var resp = await fetch(API_HOST + '/api/plans', { headers: { 'Authorization': 'Bearer ' + token } });
      if (resp.ok) {
        var data = await resp.json();
        _plansCache = data.plans || [];
        return _plansCache;
      }
    } catch(e) {}
    return [];
  }

  async function loadPlanFromBackend(planId) {
    try {
      var token = localStorage.getItem('haccp_token');
      if (!token) return null;
      var resp = await fetch(API_HOST + '/api/plans/' + planId, { headers: { 'Authorization': 'Bearer ' + token } });
      if (resp.ok) {
        var data = await resp.json();
        return data.plan.content;
      }
    } catch(e) {}
    return null;
  }

  async function deletePlanFromBackend(planId) {
    try {
      var token = localStorage.getItem('haccp_token');
      if (!token) return false;
      var resp = await fetch(API_HOST + '/api/plans/' + planId, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } });
      return resp.ok;
    } catch(e) { return false; }
  }

  function renderPlanBar(plans) {
    var currentId = getCurrentPlanId();
    var html = '<div class="plan-bar">';
    html += '<select id="planSelector">';
    html += '<option value="">' + I18n.t('plan.placeholder') + '</option>';
    plans.forEach(function(p) {
      var selected = String(p.id) === String(currentId) ? ' selected' : '';
      var label = (p.product_name || p.plan_name || 'Plan #' + p.id) + ' — ' + (p.created_at ? p.created_at.slice(0,10) : '');
      html += '<option value="' + p.id + '"' + selected + '>' + label + '</option>';
    });
    html += '</select>';
    html += '<button class="btn-plan" id="btnNewPlan" title="' + I18n.t('plan.newPlan') + '">' + I18n.t('plan.newPlan') + '</button>';
    html += '<button class="btn-plan danger" id="btnDeletePlan" title="' + I18n.t('plan.deletePlan') + '">' + I18n.t('plan.deletePlan') + '</button>';
    html += '<span class="plan-count">' + I18n.t('lobby.status.plans').replace('{n}', plans.length) + '</span>';
    html += '</div>';
    return html;
  }

  async function init() {
    await syncTemplateFromBackend();

    // Load plans list from backend
    var plans = await loadPlansList();
    var currentId = getCurrentPlanId();

    // Render plan bar
    var planBar = document.getElementById('resultsPlanBar');
    if (planBar && plans.length > 0) {
      planBar.innerHTML = renderPlanBar(plans);
      var sel = document.getElementById('planSelector');
      if (sel) sel.addEventListener('change', function() {
        if (this.value) { setCurrentPlanId(this.value); init(); }
      });
      var btnNew = document.getElementById('btnNewPlan');
      if (btnNew) btnNew.addEventListener('click', function() { App.navigateTo('questionnaire'); });
      var btnDel = document.getElementById('btnDeletePlan');
      if (btnDel) btnDel.addEventListener('click', async function() {
        var id = getCurrentPlanId();
        if (!id) return;
        if (!confirm(I18n.t('plan.deleteConfirm'))) return;
        if (await deletePlanFromBackend(id)) {
          setCurrentPlanId('');
          init();
        }
      });
    } else if (planBar) {
      planBar.innerHTML = '';
    }

    // Auto-select first plan if none selected
    if (!currentId && plans.length > 0) {
      currentId = String(plans[0].id);
      setCurrentPlanId(currentId);
    }

    renderSidebar();
    renderContent();
    setupScrollSpy();
    fetchAiReport();
  }

  // ===== 15min 侧边栏 =====
  function render15minSidebar(nav) {
    const lang = I18n.getLang();
    const items = [
      { key: 'q15-company', label: I18n.t('r15.section1') },
      { key: 'q15-product', label: I18n.t('r15.section2') },
      { key: 'q15-process', label: I18n.t('r15.section3') },
      { key: 'q15-flowchart-image', label: I18n.t('r15.flowchart') },
      { key: 'q15-ccp', label: I18n.t('result.ccp.title') },
      { key: 'q15-hazard', label: I18n.t('r15.section4') },
      { key: 'q15-limits', label: I18n.t('r15.section5') },
      { key: 'q15-verification', label: I18n.t('r15.section6') },
      { key: 'q15-records', label: I18n.t('r15.section7') },
    ];

    nav.innerHTML = '<div style="padding:0 0 12px 0;display:flex;gap:6px;justify-content:center;"><button id="btnExportZh" style="flex:1;padding:8px 0;background:linear-gradient(135deg,#dc2626,#b91c1c);color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">📄 中文</button><button id="btnExportEn" style="flex:1;padding:8px 0;background:linear-gradient(135deg,#1e40af,#1d4ed8);color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">📄 English</button></div>';
    nav.innerHTML += '<ul style="list-style:none;padding:0;margin:0;">' + items.map(item => `
      <li data-section="${item.key}" class="${item.key === activeSection ? 'active' : ''}">${item.label}</li>
    `).join('') + '</ul>';

    nav.querySelectorAll('li').forEach(li => {
      li.addEventListener('click', () => {
        setActive(li.dataset.section);
        const el = document.getElementById('section-' + li.dataset.section);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      });
    });
    var btnZh = document.getElementById('btnExportZh');
    if (btnZh) btnZh.addEventListener('click', function() { exportToWord('zh'); });
    var btnEn = document.getElementById('btnExportEn');
    if (btnEn) btnEn.addEventListener('click', function() { exportToWord('en'); });
  }

  // ===== 侧边栏 =====
  function renderSidebar() {
    const nav = getEl('resultsNav');
    const lang = I18n.getLang();

    // 15min模式
    if (is15minMode()) {
      render15minSidebar(nav);
      return;
    }

    const fcTemplate = loadFcTemplate();
    const items = [
      { key: 'aiReport', label: { zh: I18n.t('r15.aiReport'), en: 'AI Analysis Report' } },
    ];
    // 流程图始终显示（使用 draw.io SVG）
    items.push({ key: 'flowchart', label: { zh: I18n.t('r15.flowchart'), en: 'Process Flow Chart' } });

    items.push({ key: 'productDescription', label: mockHaccpPlan.productDescription.title });
    sectionOrder.forEach(key => {
      if (key !== 'productDescription') {
        items.push({ key, label: mockHaccpPlan[key].title });
      }
    });

    nav.innerHTML = '<div style="padding:0 0 12px 0;display:flex;gap:6px;justify-content:center;"><button id="btnExportZh" style="flex:1;padding:8px 0;background:linear-gradient(135deg,#dc2626,#b91c1c);color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">📄 中文</button><button id="btnExportEn" style="flex:1;padding:8px 0;background:linear-gradient(135deg,#1e40af,#1d4ed8);color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">📄 English</button></div>';
    nav.innerHTML += '<ul style="list-style:none;padding:0;margin:0;">' + items.map(item => `
      <li data-section="${item.key}" class="${item.key === activeSection ? 'active' : ''}">${item.label[lang] || item.label.zh || item.label}</li>
    `).join('') + '</ul>';

    nav.querySelectorAll('li').forEach(li => {
      li.addEventListener('click', () => {
        setActive(li.dataset.section);
        const el = document.getElementById('section-' + li.dataset.section);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      });
    });
    var btnZh2 = document.getElementById('btnExportZh');
    if (btnZh2) btnZh2.addEventListener('click', function() { exportToWord('zh'); });
    var btnEn2 = document.getElementById('btnExportEn');
    if (btnEn2) btnEn2.addEventListener('click', function() { exportToWord('en'); });
  }

  // ===== 15min结果展示 =====
  function render15minContent(container, data, lang) {
    const emptyLabel = I18n.t('common.empty');
    const fieldValue = (val) => val ? esc(val) : '<span style="color:var(--gray-400);font-style:italic;">' + emptyLabel + '</span>';
    const boolYes = (val) => val ? I18n.t('r15.boolYes') : I18n.t('r15.boolNo');

    let html = '<a class="back-link" href="javascript:App.navigateTo(\'home\')">\u2190 ' + I18n.t('nav.back') + '</a>';

    // 验证程序状态卡片（放在最上方）
    var verSubmitted = data.verificationSubmitted || false;
    var verSigner = data.verificationSignerName || '';
    var verDate = data.verificationSignerDate || '';
    if (verSubmitted) {
      html += '<div class="results-section" style="background:#f0fdf4;border:1px solid #86efac;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">' +
        '<div style="display:flex;align-items:center;gap:8px;">' +
        '<span style="font-size:24px;">✅</span>' +
        '<div><div style="font-weight:600;color:#166534;">' + I18n.t('verification.submitted') + '</div>' +
        '<div style="font-size:12px;color:#475569;margin-top:2px;">' + I18n.t('verification.signer') + '：<strong>' + esc(verSigner) + '</strong> | 签名日期：<strong>' + esc(verDate) + '</strong></div></div>' +
        '</div>' +
        '<button class="btn btn-sm btn-secondary" id="resultEditVerBtn" style="border-color:#86efac;color:#166534;">📝 编辑验证程序</button>' +
        '</div></div>';
    } else {
      html += '<div class="results-section" style="background:#fffbeb;border:1px solid #fde68a;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">' +
        '<div style="display:flex;align-items:center;gap:8px;">' +
        '<span style="font-size:24px;">⏰</span>' +
        '<div><div style="font-weight:600;color:#92400e;">' + I18n.t('verification.notSubmitted') + '</div>' +
        '<div style="font-size:12px;color:#92400e;margin-top:2px;">' + I18n.t('verification.notSubmittedHint') + '</div></div>' +
        '</div>' +
        '<button class="btn btn-primary btn-sm" id="resultEditVerBtn">📝 去填写验证程序</button>' +
        '</div></div>';
    }

    const steps = data.processSteps || [];

    // 一、企业信息
    html += '<div class="results-section" id="section-q15-company"><h2>' + I18n.t('r15.companyInfo') + '</h2>' +
      '<div class="result-item"><span class="ri-label">' + I18n.t('r15.companyName') + '</span><span class="ri-value">' + fieldValue(data.companyName) + '</span></div>' +
      '<div class="result-item"><span class="ri-label">' + I18n.t('r15.deptName') + '</span><span class="ri-value">' + fieldValue(data.deptName) + '</span></div>' +
      '<div class="result-item"><span class="ri-label">' + I18n.t('r15.auditor') + '</span><span class="ri-value">' + fieldValue(data.auditor) + '</span></div>';
    // 其他项目 - 以内联形式展示（放在审核人员下方，HACCP小组成员上方）
    if (data.extraItems && data.extraItems.length > 0) {
      data.extraItems.filter(function(e) { return e.key || e.value; }).forEach(function(e) {
        html += '<div class="result-item"><span class="ri-label">' + fieldValue(e.key) + '</span><span class="ri-value">' + fieldValue(e.value) + '</span></div>';
      });
    }
    html += '<h3>' + I18n.t('r15.teamTitle') + '</h3>' +
      '<table><thead><tr><th>' + I18n.t('r15.colName') + '</th><th>' + I18n.t('r15.colDept') + '</th><th>' + I18n.t('r15.colPosition') + '</th><th>' + I18n.t('r15.colRole') + '</th><th>' + I18n.t('r15.colRemark') + '</th></tr></thead><tbody>' +
      (data.haccpTeam || []).map(function(m) { return '<tr><td>' + fieldValue(m.name) + '</td><td>' + fieldValue(m.dept) + '</td><td>' + fieldValue(m.position) + '</td><td>' + fieldValue(m.role) + '</td><td>' + fieldValue(m.remark) + '</td></tr>'; }).join('') +
      '</tbody></table></div>';

    // 二、产品信息
    html += '<div class="results-section" id="section-q15-product"><h2>' + I18n.t('r15.productInfo') + '</h2>' +
      '<div class="result-item"><span class="ri-label">' + I18n.t('r15.productName') + '</span><span class="ri-value">' + fieldValue(data.productName) + '</span></div>' +
      '<div class="result-item"><span class="ri-label">' + I18n.t('r15.rawMaterials') + '</span><span class="ri-value">' + fieldValue(data.rawMaterials) + '</span></div>' +
      '<div class="result-item"><span class="ri-label">' + I18n.t('r15.additives') + '</span><span class="ri-value">' + fieldValue(data.additives) + '</span></div>' +
      '<div class="result-item"><span class="ri-label">' + I18n.t('r15.productPH') + '</span><span class="ri-value">' + fieldValue(data.productPH) + '</span></div>' +
      '<div class="result-item"><span class="ri-label">' + I18n.t('r15.waterActivity') + '</span><span class="ri-value">' + fieldValue(data.waterActivity) + '</span></div>' +
      '<div class="result-item"><span class="ri-label">' + I18n.t('r15.intendedUse') + '</span><span class="ri-value">' + fieldValue(data.intendedUse) + '</span></div>' +
      '<div class="result-item"><span class="ri-label">' + I18n.t('r15.storageCondition') + '</span><span class="ri-value">' + fieldValue(data.storageCondition) + '</span></div>' +
      '<div class="result-item"><span class="ri-label">' + I18n.t('r15.packagingMethod') + '</span><span class="ri-value">' + fieldValue(data.packagingMethod) + '</span></div>' +
      '<div class="result-item"><span class="ri-label">' + I18n.t('r15.targetConsumer') + '</span><span class="ri-value">' + fieldValue(data.targetConsumer) + '</span></div>' +
      '<div class="result-item"><span class="ri-label">' + I18n.t('r15.shelfLife') + '</span><span class="ri-value">' + fieldValue(data.shelfLife) + '</span></div>';
    // 其他项目（产品信息中手动添加的补充信息）
    if (data.productExtraItems && data.productExtraItems.length > 0) {
      data.productExtraItems.filter(function(e) { return e.key || e.value; }).forEach(function(e) {
        html += '<div class="result-item"><span class="ri-label">' + fieldValue(e.key) + '</span><span class="ri-value">' + fieldValue(e.value) + '</span></div>';
      });
    }
    html += '</div>';

    // 三、生产流程
    html += '<div class="results-section" id="section-q15-process"><h2>' + I18n.t('r15.processFlow') + '</h2>' +
      '<h3>' + I18n.t('r15.formula') + '</h3>' +
      '<table><thead><tr><th>' + I18n.t('r15.colMaterial') + '</th><th>' + I18n.t('r15.colDosage') + '</th><th>' + I18n.t('r15.colFunction') + '</th></tr></thead><tbody>' +
      (data.formula || []).map(function(f) { return '<tr><td>' + fieldValue(f.material) + '</td><td>' + fieldValue(f.dosage) + '</td><td>' + fieldValue(f.func) + '</td></tr>'; }).join('') +
      '</tbody></table>' +
      '<h3>' + I18n.t('r15.opSteps') + '</h3>';
    (data.processSteps || []).forEach(function(s, i) {
      html += '<div class="fc-step-card fc-result"><div class="fc-step-header"><span class="fc-step-num">' + (i + 1) + '</span><strong>' + fieldValue(s.stepName) + '</strong></div>' +
        '<table class="fc-result-params"><tbody>' +
        '<tr><th>' + I18n.t('r15.opMethod') + '</th><td>' + fieldValue(s.operationMethod) + '</td></tr>' +
        '<tr><th>' + I18n.t('r15.params') + '</th><td>' + fieldValue(s.parameters) + '</td></tr>' +
        '<tr><th>' + I18n.t('r15.ctrlPoint') + '</th><td>' + fieldValue(s.controlPoint) + '</td></tr>' +
        '<tr><th>' + I18n.t('r15.equipment') + '</th><td>' + fieldValue(s.equipmentName) + '</td></tr>' +
        '</tbody></table></div>';
    });
    html += '<div class="result-item"><span class="ri-label">' + I18n.t('r15.flowConfirmed') + '</span><span class="ri-value">' + boolYes(data.flowConfirmed) + '</span></div></div>';

    // 3.4 - 流程图（来自draw.io编辑器）
    var pfFlowSvg = data.flowchartSvg || '';
    if (!pfFlowSvg) {
      try {
        var pfRaw2 = localStorage.getItem('haccp_profile_data');
        if (pfRaw2) {
          var pfD = JSON.parse(pfRaw2);
          pfFlowSvg = pfD.flowchartSvg || '';
        }
      } catch(e) {}
    }
    if (pfFlowSvg) {
      html += '<div class="results-section" id="section-q15-flowchart-image"><h2>' + I18n.t('r15.flowchart') + '</h2>';
      html += '<div style="text-align:center;padding:16px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;overflow:auto;">';
      html += '<img src="' + pfFlowSvg + '" style="max-width:100%;height:auto;" alt="' + I18n.t('r15.flowchart') + '">';
      html += '</div></div>';
    }

    // 3.5 - CCP判定结果（Codex决策树完整展示）
    if (data.ccpSteps && data.ccpSteps.length > 0) {
      html += '<div class="results-section" id="section-q15-ccp"><h2>' + I18n.t('result.ccp.title') + '</h2>';
      html += '<p style="font-size:13px;color:var(--gray-400);margin-bottom:12px;">' + I18n.t('result.ccp.desc') + '</p>';

      // 统计
      var totalJudgments = 0, ccpCount = 0, nonCcpCount = 0, pendingCount = 0;
      var ccpStepsList = [];
      data.ccpSteps.forEach(function(s, si) {
        if (!s.hazards) return;
        ['bio','chem','phys'].forEach(function(ht) {
          var h = s.hazards[ht] || {};
          totalJudgments++;
          if (h.isCCP === true) { ccpCount++; ccpStepsList.push({step:s.stepName, type:ht, desc:h.hazardDesc, reasoning:h.aiReasoning}); }
          else if (h.isCCP === false) nonCcpCount++;
          else if (h.isCCP === 'modify') nonCcpCount++;
          else pendingCount++;
        });
      });

      // 汇总横幅
      if (totalJudgments > 0) {
        var bannerBg = ccpCount > 0 ? '#fef2f2' : '#f0fdf4';
        var bannerBorder = ccpCount > 0 ? '#fca5a5' : '#86efac';
        var bannerColor = ccpCount > 0 ? '#991b1b' : '#166534';
        html += '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px;">';
        html += '<div style="flex:1;min-width:100px;padding:14px 18px;background:' + bannerBg + ';border:1px solid ' + bannerBorder + ';border-radius:10px;text-align:center;">';
        html += '<div style="font-size:28px;font-weight:700;color:' + bannerColor + ';">' + ccpCount + '</div>';
        html += '<div style="font-size:12px;color:' + bannerColor + ';margin-top:4px;">' + I18n.t('ccp.result.ccp') + '（关键控制点）</div></div>';
        html += '<div style="flex:1;min-width:100px;padding:14px 18px;background:#f0fdf4;border:1px solid #86efac;border-radius:10px;text-align:center;">';
        html += '<div style="font-size:28px;font-weight:700;color:#166534;">' + nonCcpCount + '</div>';
        html += '<div style="font-size:12px;color:#166534;margin-top:4px;">' + I18n.t('ccp.result.nonCcp') + '</div></div>';
        if (pendingCount > 0) {
          html += '<div style="flex:1;min-width:100px;padding:14px 18px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;text-align:center;">';
          html += '<div style="font-size:28px;font-weight:700;color:#64748b;">' + pendingCount + '</div>';
          html += '<div style="font-size:12px;color:#64748b;margin-top:4px;">' + I18n.t('ccp.result.undetermined') + '</div></div>';
        }
        html += '<div style="flex:1;min-width:100px;padding:14px 18px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;text-align:center;">';
        html += '<div style="font-size:28px;font-weight:700;color:#1e40af;">' + data.ccpSteps.length + '</div>';
        html += '<div style="font-size:12px;color:#1e40af;margin-top:4px;">' + I18n.t('ccp.summary.step') + '</div></div>';
        html += '</div>';

        // AI标签
        var hasAI = data.ccpSteps.some(function(cs) { return cs && cs.hazards && ['bio','chem','phys'].some(function(ht) { return cs.hazards[ht] && cs.hazards[ht].aiReasoning; }); });
        if (hasAI) {
          html += '<div style="margin-bottom:16px;padding:10px 14px;background:#f5f3ff;border:1px solid #ddd6fe;border-radius:8px;font-size:13px;color:#6d28d9;">';
          html += '🤖 <strong>AI辅助判定完成</strong> — 以下结果由AI基于Codex判断树规则自动分析生成，请人工复核确认';
          html += '</div>';
        }
      }

      // CCP步骤决策树判定详表
      var htLabels = { bio: I18n.t('result.ccp.bio'), chem: I18n.t('result.ccp.chem'), phys: I18n.t('result.ccp.phys') };
      var htColors = { bio: '#dc2626', chem: '#d97706', phys: '#2563eb' };
      data.ccpSteps.forEach(function(s, si) {
        if (!s.hazards) return;
        var stepBg = '#fff';
        // 该步骤是否有CCP
        var stepHasCcp = ['bio','chem','phys'].some(function(ht) { return s.hazards[ht] && s.hazards[ht].isCCP === true; });
        if (stepHasCcp) stepBg = '#fff5f5';

        html += '<div style="margin-bottom:16px;padding:16px 20px;background:' + stepBg + ';border:1px solid ' + (stepHasCcp ? '#fca5a5' : '#e2e8f0') + ';border-radius:10px;">';
        html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">';
        html += '<span style="width:30px;height:30px;border-radius:50%;background:' + (stepHasCcp ? '#dc2626' : '#64748b') + ';color:#fff;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;">' + (si+1) + '</span>';
        html += '<strong style="font-size:15px;color:' + (stepHasCcp ? '#991b1b' : '#334155') + ';">' + esc(s.stepName || I18n.t('ccp.summary.step') + (si+1)) + '</strong>';
        if (stepHasCcp) html += '<span style="padding:3px 10px;background:#dc2626;color:#fff;border-radius:999px;font-size:11px;font-weight:700;">CCP</span>';
        html += '</div>';

        // 三个危害类型各一行
        html += '<table style="width:100%;border-collapse:collapse;margin:0;font-size:13px;">';
        html += '<thead><tr style="background:#f8fafc;">';
        html += '<th style="padding:6px 8px;border:1px solid #e2e8f0;text-align:left;width:80px;">' + I18n.t('result.ccp.colHazardType') + '</th>';
        html += '<th style="padding:6px 8px;border:1px solid #e2e8f0;text-align:left;">' + I18n.t('result.ccp.colHazardDesc') + '</th>';
        html += '<th style="padding:6px 2px;border:1px solid #e2e8f0;text-align:center;width:38px;font-size:11px;">Q1</th>';
        html += '<th style="padding:6px 2px;border:1px solid #e2e8f0;text-align:center;width:38px;font-size:11px;">Q2</th>';
        html += '<th style="padding:6px 2px;border:1px solid #e2e8f0;text-align:center;width:38px;font-size:11px;">Q3</th>';
        html += '<th style="padding:6px 2px;border:1px solid #e2e8f0;text-align:center;width:38px;font-size:11px;">Q4</th>';
        html += '<th style="padding:6px 2px;border:1px solid #e2e8f0;text-align:center;width:38px;font-size:11px;">Q5</th>';
        html += '<th style="padding:6px 8px;border:1px solid #e2e8f0;text-align:center;width:70px;">' + I18n.t('result.ccp.colResult') + '</th>';
        html += '<th style="padding:6px 8px;border:1px solid #e2e8f0;text-align:left;">' + I18n.t('result.ccp.colReasoning') + '</th>';
        html += '</tr></thead><tbody>';

        ['bio','chem','phys'].forEach(function(ht) {
          var h = s.hazards[ht] || {};
          var q1 = h.q1 || '', q2 = h.q2 || '', q3 = h.q3 || '', q4 = h.q4 || '', q5 = h.q5 || '';
          var isCCP = h.isCCP;
          var resultHtml = '', rowBg = '';
          if (isCCP === true) { resultHtml = '<span style="color:#dc2626;font-weight:700;">' + I18n.t('ccp.result.ccp') + '</span>'; rowBg = '#fef2f2'; }
          else if (isCCP === false) { resultHtml = '<span style="color:#16a34a;">' + I18n.t('ccp.result.nonCcp') + '</span>'; rowBg = '#fff'; }
          else if (isCCP === 'modify') { resultHtml = '<span style="color:#d97706;">' + I18n.t('ccp.result.modify') + '</span>'; rowBg = '#fffbeb'; }
          else { resultHtml = '<span style="color:#94a3b8;font-style:italic;">' + I18n.t('ccp.result.undetermined') + '</span>'; rowBg = '#fff'; }

          // 高亮判定路径上的Q
          var qStyle = function(val, isPath) {
            if (!val) return 'style="text-align:center;color:#cbd5e1;"';
            if (isPath) return 'style="text-align:center;font-weight:700;color:#1e40af;background:#dbeafe;border-radius:3px;"';
            return 'style="text-align:center;color:#475569;"';
          };

          html += '<tr style="background:' + rowBg + ';">';
          html += '<td style="padding:6px 8px;border:1px solid #e2e8f0;font-weight:600;color:' + htColors[ht] + ';">' + htLabels[ht] + '</td>';
          html += '<td style="padding:6px 8px;border:1px solid #e2e8f0;font-size:12px;">' + esc(I18n.b(h.hazardDesc || '')) + '</td>';
          html += '<td ' + qStyle(q1, true) + '>' + (q1||'—') + '</td>';
          html += '<td style="text-align:center;color:' + (q2 ? '#475569' : '#cbd5e1') + ';">' + (q2||'—') + '</td>';
          html += '<td ' + qStyle(q3, !!q3) + '>' + (q3||'—') + '</td>';
          html += '<td style="text-align:center;color:' + (q4 ? '#475569' : '#cbd5e1') + ';">' + (q4||'—') + '</td>';
          html += '<td style="text-align:center;color:' + (q5 ? '#475569' : '#cbd5e1') + ';">' + (q5||'—') + '</td>';
          html += '<td style="padding:6px 4px;border:1px solid #e2e8f0;text-align:center;">' + resultHtml + '</td>';
          html += '<td style="padding:6px 8px;border:1px solid #e2e8f0;font-size:11px;color:#64748b;">' + esc(I18n.b(h.aiReasoning || '')) + '</td>';
          html += '</tr>';
        });
        html += '</tbody></table></div>';
      });
      html += '</div>';
    }

    // 四、危害分析 - 合并所有危害到统一表格，按文档格式展示
    html += '<div class="results-section" id="section-q15-hazard"><h2>四、危害分析</h2>';
    var allHazards = [];
    ['hazardBio', 'hazardChem', 'hazardPhys'].forEach(function(key) {
      var items = data[key] || [];
      items.forEach(function(h) { allHazards.push(h); });
    });
    if (allHazards.length > 0) {
      html += '<div style="overflow-x:auto;"><table style="min-width:850px;"><thead><tr><th>原材料</th><th>风险</th><th>Q1</th><th>Q2</th><th>Q3</th><th>CCP判断</th><th style="min-width:250px;">风险说明</th></tr></thead><tbody>';
      allHazards.forEach(function(h) {
        var riskColor = h.hazardType === '生物危害' ? '#dc2626' : (h.hazardType === '化学危害' ? '#d97706' : '#6b7280');
        html += '<tr><td><strong>' + fieldValue(h.material) + '</strong></td><td style="color:' + riskColor + ';font-weight:500;">' + fieldValue(h.hazardType) + '</td><td>' + fieldValue(h.q1) + '</td><td>' + fieldValue(h.q2) + '</td><td>' + fieldValue(h.q3) + '</td><td>' + fieldValue(h.ccpResult) + '</td><td style="font-size:13px;line-height:1.5;">' + fieldValue(h.detail || h.desc) + '</td></tr>';
      });
      html += '</tbody></table></div>';
    } else {
      var hasAnyHazard = (data.hazardBio || []).length > 0 || (data.hazardChem || []).length > 0 || (data.hazardPhys || []).length > 0;
      if (hasAnyHazard) {
        // 兼容旧数据格式
        html += '<h3>生物危害</h3><table><thead><tr><th>危害描述</th><th>严重性</th><th>发生可能性</th><th>控制措施</th></tr></thead><tbody>' +
          (data.hazardBio || []).map(function(h) { return '<tr><td>' + fieldValue(h.desc) + '</td><td>' + fieldValue(h.severity) + '</td><td>' + fieldValue(h.likelihood) + '</td><td>' + fieldValue(h.control) + '</td></tr>'; }).join('') +
          '</tbody></table><h3>化学危害</h3><table><thead><tr><th>危害描述</th><th>严重性</th><th>发生可能性</th><th>控制措施</th></tr></thead><tbody>' +
          (data.hazardChem || []).map(function(h) { return '<tr><td>' + fieldValue(h.desc) + '</td><td>' + fieldValue(h.severity) + '</td><td>' + fieldValue(h.likelihood) + '</td><td>' + fieldValue(h.control) + '</td></tr>'; }).join('') +
          '</tbody></table><h3>物理危害</h3><table><thead><tr><th>危害描述</th><th>严重性</th><th>发生可能性</th><th>控制措施</th></tr></thead><tbody>' +
          (data.hazardPhys || []).map(function(h) { return '<tr><td>' + fieldValue(h.desc) + '</td><td>' + fieldValue(h.severity) + '</td><td>' + fieldValue(h.likelihood) + '</td><td>' + fieldValue(h.control) + '</td></tr>'; }).join('') +
          '</tbody></table>';
      } else {
        html += '<p style="color:var(--gray-400);font-style:italic;">未填写</p>';
      }
    }
    html += '<div class="result-item"><span class="ri-label">团队确认</span><span class="ri-value">' + boolYes(data.hazardConfirmed) + '</span></div></div>';

    // 五、关键限制
    var stdLabels = { 'gb': I18n.t('limits.gb'), 'industry': I18n.t('limits.industry'), 'enterprise': I18n.t('limits.enterprise'), 'international': I18n.t('limits.international') };
    html += '<div class="results-section" id="section-q15-limits"><h2>' + I18n.t('r15.criticalLimits') + '</h2>' +
      '<div class="result-item"><span class="ri-label">' + I18n.t('r15.standard') + '</span><span class="ri-value">' + (stdLabels[data.execStandard] || fieldValue(data.execStandard)) + '</span></div>' +
      '<div class="result-item"><span class="ri-label">' + I18n.t('r15.criticalDesc') + '</span><span class="ri-value">' + fieldValue(data.criticalLimits) + '</span></div></div>';

    // 六、验证程序
    html += '<div class="results-section" id="section-q15-verification"><h2>' + I18n.t('r15.verification') + '</h2>' +
      '<h3>' + I18n.t('r15.monitoringSetup') + '</h3>' +
      '<table><thead><tr><th>' + I18n.t('r15.colCcp') + '</th><th>' + I18n.t('rec.mon.colObject') + '</th><th>' + I18n.t('rec.mon.colMethod') + '</th><th>' + I18n.t('rec.mon.colFrequency') + '</th><th>' + I18n.t('rec.mon.colPersonnel') + '</th><th>' + I18n.t('r15.colRemark') + '</th></tr></thead><tbody>' +
      (data.monitoring || []).map(function(m) { return '<tr><td>' + fieldValue(m.ccp) + '</td><td>' + fieldValue(m.object) + '</td><td>' + fieldValue(m.method) + '</td><td>' + fieldValue(m.frequency) + '</td><td>' + fieldValue(m.personnel) + '</td><td>' + fieldValue(m.remark) + '</td></tr>'; }).join('') +
      '</tbody></table>' +
      '<h3>' + I18n.t('r15.correctiveActions') + '</h3>' +
      '<table><thead><tr><th>' + I18n.t('r15.colCcp') + '</th><th>' + I18n.t('r15.colCl') + '</th><th>' + I18n.t('r15.colCorrective') + '</th><th>' + I18n.t('r15.colVerification') + '</th><th>' + I18n.t('r15.colRecord') + '</th></tr></thead><tbody>' +
      (data.correctiveActions || []).map(function(c) { return '<tr><td>' + fieldValue(c.ccp) + '</td><td>' + fieldValue(c.cl) + '</td><td>' + fieldValue(c.corrective) + '</td><td>' + fieldValue(c.verification) + '</td><td>' + fieldValue(c.record) + '</td></tr>'; }).join('') +
      '</tbody></table></div>';

    // 七、记录
    html += '<div class="results-section" id="section-q15-records"><h2>' + I18n.t('r15.recordsReports') + '</h2>' +
      '<div class="result-item"><span class="ri-label">' + I18n.t('r15.recordPeriod') + '</span><span class="ri-value">' + fieldValue(data.recordPeriod) + '</span></div>' +
      '<div class="result-item"><span class="ri-label">' + I18n.t('r15.recordFormat') + '</span><span class="ri-value">' + fieldValue(data.recordFormat) + '</span></div></div>';

    container.innerHTML = html;

    // 绑定验证程序编辑按钮
    var editVerBtn = document.getElementById('resultEditVerBtn');
    if (editVerBtn) {
      editVerBtn.addEventListener('click', function() {
        App.navigateToVerification();
      });
    }

  }


  // ===== 主内容 =====
  async function renderContent() {
    const container = getEl('resultsContent');
    const submitted = localStorage.getItem('haccp_submitted');
    const lang = I18n.getLang();

    // Try loading selected plan from backend first
    const planId = getCurrentPlanId();
    var q15Data = null;
    if (planId) {
      q15Data = await loadPlanFromBackend(planId);
    }
    // Fallback to localStorage
    if (!q15Data) {
      q15Data = load15minData();
    }

    if (!submitted) {
      container.innerHTML = [
        '<a class="back-link" href="javascript:App.navigateTo(\'home\')">\u2190 ',
        I18n.t('nav.back'),
        '</a>',
        '<div class="empty-state">',
        '  <div class="empty-icon">\uD83D\uDCCB</div>',
        '  <h3>' + I18n.t('r.empty.title') + '</h3>',
        '  <p>' + I18n.t('r.empty.desc') + '</p>',
        '  <button class="btn btn-primary" onclick="App.navigateTo(\'questionnaire\')">' + I18n.t('r.empty.btn') + '</button>',
        '</div>'
      ].join('');
      return;
    }

    // 如果是15min问卷提交的数据，使用专门的渲染方式
    if (q15Data) {
      render15minContent(container, q15Data, lang);
      return;
    }

    let html = '<a class="back-link" href="javascript:App.navigateTo(\'home\')">\u2190 ' + I18n.t('nav.back') + '</a>';

    // 生产流程图（始终显示 draw.io SVG）
    const fcTitle = lang === 'en' ? 'Process Flow Chart' : '\u751f\u4ea7\u6d41\u7a0b\u56fe';
    html += '<div class="results-section" id="section-flowchart">' +
      '<h2>' + fcTitle + '</h2>' +
      buildFlowchartDisplay(lang) +
      '</div>';


    // 产品描述（用户答案）
    const pdTitle = mockHaccpPlan.productDescription.title[lang] || mockHaccpPlan.productDescription.title.zh;
    html += '<div class="results-section" id="section-productDescription">' +
      '<h2>' + pdTitle + '</h2>' +
      buildProductDescription(lang) +
      '</div>';

    // 其余 HACCP 章节
    sectionOrder.forEach(function(key) {
      if (key === 'productDescription') return;
      var section = mockHaccpPlan[key];
      var title = section.title[lang] || section.title.zh;
      var content = section.content[lang] || section.content.zh;
      html += '<div class="results-section" id="section-' + key + '">' +
        '<h2>' + title + '</h2>' +
        content +
        '</div>';
    });

    container.innerHTML = html;
    // draw.io SVG 已经直接用 <img> 标签插入，无需额外渲染步骤
  }


  // ===== 调用后端 API 生成 AI 报告 =====
  async function fetchAiReport() {
    const body = getEl('aiReportBody');
    if (!body) return;
    const lang = I18n.getLang();

    try {
      const resp = await fetch('http://localhost:8000/api/generate_report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_date: '2026-05-01', end_date: '2026-05-31' }),
      });

      if (!resp.ok) throw new Error('HTTP ' + resp.status);

      const data = await resp.json();
      body.innerHTML = '<div class="report-card" style="margin:0;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:20px 24px;">' +
        '<div class="report-card-body" style="font-size:14px;color:var(--gray-700);line-height:1.8;">' + esc(data.report || '') + '</div></div>';
    } catch (err) {
      var msg = lang === 'en'
        ? 'Generation failed. Please ensure the backend is running. (' + err.message + ')'
        : '\u62a5\u544a\u751f\u6210\u5931\u8d25\uff0c\u8bf7\u786e\u8ba4\u540e\u7aef\u5df2\u542f\u52a8\u3002(' + err.message + ')';
      body.innerHTML = '<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:16px 20px;color:#dc2626;font-size:14px;">' + esc(msg) + '</div>';
    }
  }

  function buildProductDescription(lang) {
    const template = loadTemplate();
    const answers = loadAnswers();

    if (!template || !template.sections || template.sections.length === 0) {
      return mockHaccpPlan.productDescription.content[lang] || mockHaccpPlan.productDescription.content.zh;
    }

    var zh = {
      overview: I18n.t('r15.productOverview'),
      noAnswer: '未填写',
      sectionLabel: I18n.t('r15.section'),
      questionLabel: I18n.t('r15.question'),
      answerLabel: I18n.t('r15.answer'),
    };
    var en = {
      overview: 'Below is the product and process information you submitted:',
      noAnswer: 'Not filled',
      sectionLabel: 'Section',
      questionLabel: 'Question',
      answerLabel: 'Your Answer',
    };
    var t = lang === 'en' ? en : zh;

    var rows = '';
    template.sections.forEach(function(section) {
      section.questions.forEach(function(q) {
        var answer = answers[q.id];
        var display = '';
        if (answer === undefined || answer === '' || (Array.isArray(answer) && answer.length === 0)) {
          display = '<span style="color:var(--gray-400);font-style:italic;">' + t.noAnswer + '</span>';
        } else if (Array.isArray(answer)) {
          display = esc(answer.join('、'));
        } else {
          display = esc(String(answer));
        }
        rows += '<tr><td>' + esc(section.title) + '</td><td>' + esc(q.title) + '</td><td>' + display + '</td></tr>';
      });
    });

    return '<p>' + t.overview + '</p>' +
      '<table><thead><tr><th>' + t.sectionLabel + '</th><th>' + t.questionLabel + '</th><th>' + t.answerLabel + '</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table>';
  }

  /**
   * 在报告中展示 draw.io 流程图（优先使用 SVG，降级为提示）
   */
  function buildFlowchartDisplay(lang) {
    var svgData = getDrawioSvg();
    var zh = { title: I18n.t('r15.flowchartSaved'), noData: I18n.t('r15.flowchartNoData'), hint: I18n.t('r15.flowchartHint') };
    var en = { title: 'Process flow diagram saved from draw.io editor:', noData: 'No flowchart found. Please edit and save in the Process Flowchart step first.', hint: '📌 To update, return to the flowchart editor and press Ctrl+S to save.' };
    var t = lang === 'en' ? en : zh;

    if (!svgData) {
      return '<div style="padding:24px;text-align:center;background:#fffbeb;border:1px dashed #fbbf24;border-radius:8px;">' +
        '<div style="font-size:32px;margin-bottom:8px;">🗺️</div>' +
        '<p style="color:#92400e;font-size:14px;margin:0;">' + t.noData + '</p>' +
        '</div>';
    }

    // SVG 可能是 base64 data URI 或纯 SVG 字符串
    var imgSrc = svgData;
    if (!svgData.startsWith('data:') && !svgData.trim().startsWith('<svg')) {
      imgSrc = 'data:image/svg+xml;base64,' + svgData;
    }

    // 如果是纯 SVG 字符串，用 img 内嵌（base64 encoded）
    if (svgData.trim().startsWith('<svg') || svgData.trim().startsWith('<?xml')) {
      try {
        imgSrc = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
      } catch(e2) {
        imgSrc = 'data:image/svg+xml,' + encodeURIComponent(svgData);
      }
    }

    return '<p style="font-size:13px;color:var(--gray-600);margin-bottom:12px;">' + t.title + '</p>' +
      '<div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px;background:#fafafa;overflow:auto;text-align:center;">' +
      '<img src="' + imgSrc + '" style="max-width:100%;height:auto;" alt="工艺流程图" />' +
      '</div>' +
      '<p style="font-size:12px;color:#6b7280;margin-top:8px;">' + t.hint + '</p>';
  }


  function setActive(key) {
    activeSection = key;
    const nav = getEl('resultsNav');
    if (nav) {
      nav.querySelectorAll('li').forEach(function(li) {
        li.classList.toggle('active', li.dataset.section === key);
      });
    }
  }

  // 15分钟结果的流程图可视化渲染
  function render15minFlowchart(steps) {
    if (!steps || steps.length === 0 || !steps.some(function(s) { return s.stepName && s.stepName.trim(); })) {
      return '<p style="color:var(--gray-400);font-style:italic;text-align:center;padding:20px;">' + I18n.t('r15.noFlowSteps') + '</p>';
    }
    const validSteps = steps.filter(function(s) { return s.stepName && s.stepName.trim(); });
    
    var html = '<div class="q15-visual-flowchart">';
    
    // 开始节点
    html += '<div class="q15-vf-node start-end">' +
      '<div class="q15-vf-node-shape start">' + I18n.t('common.start') + '</div>' +
      '<div class="q15-vf-arrow-down"></div>' +
      '</div>';
    
    validSteps.forEach(function(step, i) {
      var isCCP = step.controlPoint && step.controlPoint.toLowerCase().indexOf('ccp') !== -1;
      var ccpLabel = isCCP ? '<span class="q15-vf-ccp-badge">' + step.controlPoint + '</span>' : '';
      
      html += '<div class="q15-vf-node">' +
        '<div class="q15-vf-node-shape ' + (isCCP ? 'ccp' : 'step') + '">' +
        '<span class="q15-vf-step-num">' + (i + 1) + '</span>' +
        '<div class="q15-vf-step-content">' +
        '<strong>' + esc(step.stepName) + '</strong>' +
        (step.operationMethod ? '<p class="q15-vf-detail">' + I18n.t('r15.method') + esc(step.operationMethod) + '</p>' : '') +
        (step.parameters ? '<p class="q15-vf-detail">' + I18n.t('r15.params') + esc(step.parameters) + '</p>' : '') +
        (step.equipmentName ? '<p class="q15-vf-detail">' + I18n.t('r15.equipment') + esc(step.equipmentName) + '</p>' : '') +
        '</div>' +
        ccpLabel +
        '</div>' +
        (i < validSteps.length - 1 ? '<div class="q15-vf-arrow-down"></div>' : '') +
        '</div>';
    });
    
    html += '<div class="q15-vf-node start-end">' +
      '<div class="q15-vf-arrow-down"></div>' +
      '<div class="q15-vf-node-shape end">' + I18n.t('common.end') + '</div>' +
      '</div>';
    
    html += '</div>';
    return html;
  }

  function setupScrollSpy() {
    const observer = new IntersectionObserver(function(entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          setActive(entries[i].target.id.replace('section-', ''));
        }
      }
    }, { rootMargin: '-20% 0px -70% 0px' });

    setTimeout(function() {
      document.querySelectorAll('.results-section').forEach(function(s) { observer.observe(s); });
    }, 200);
  }

  /**
   * 将 15min 生产步骤转换为 Mermaid 源码，用于 SVG 流程图渲染
   */
  function build15minMermaidSource(steps) {
    if (!steps || steps.length === 0) return null;
    var validSteps = steps.filter(function(s) { return s.stepName && s.stepName.trim(); });
    if (validSteps.length === 0) return null;

    var lines = ['graph TD'];
    lines.push('  %% 15min 问卷生产流程');
    lines.push('  classDef step fill:#e8f5e9,stroke:#43a047,stroke-width:2px;');
    lines.push('  classDef ccp fill:#fff3e0,stroke:#ff9800,stroke-width:2px;');

    var nodeIds = [];
    validSteps.forEach(function(step, i) {
      var id = 'S' + (i + 1);
      nodeIds.push(id);
      var label = (i + 1) + '. ' + (step.stepName || '');
      var isCCP = step.controlPoint && step.controlPoint.toLowerCase().indexOf('ccp') !== -1;
      var className = isCCP ? ':::ccp' : '';
      lines.push('  ' + id + '["' + label + '"]' + className);
    });

    for (var i = 0; i < nodeIds.length - 1; i++) {
      lines.push('  ' + nodeIds[i] + ' --> ' + nodeIds[i + 1]);
    }

    return lines.join('\n');
  }

  // ===== Word文档导出功能（档案步骤1-3 + 15min问卷全部内容）=====


  function exportToWord(lang) {
    var isZh = lang === 'zh';
    var T = function(zh, en) { return isZh ? zh : en; };

    var pfData = {};
    try { var pfRaw = localStorage.getItem('haccp_profile_data'); if (pfRaw) pfData = JSON.parse(pfRaw); } catch(e) {}
    var q15Data = load15minData() || {};

    var data = {};
    ['companyName','deptName','auditor','haccpTeam','extraItems',
      'pd_rawProps','pd_rawSupply','pd_rawUsage','pd_productProps','pd_productProcess','pd_productStorage','pd_productSales',
      'productExtraItems','iu_consumerExpect','iu_intendedUse','iu_consumptionMethod','iu_targetCustomer','iu_vulnerableGroups',
      'iu_unintendedUse','iuExtraItems'].forEach(function(k) {
      if (pfData[k] !== undefined && pfData[k] !== '' && pfData[k] !== null &&
          !(Array.isArray(pfData[k]) && pfData[k].length === 0)) { data[k] = pfData[k]; }
    });
    Object.keys(q15Data).forEach(function(k) { if (data[k] === undefined) data[k] = q15Data[k]; });
    if (!data.companyName && q15Data.companyName) data.companyName = q15Data.companyName;
    if (!data.deptName && q15Data.deptName) data.deptName = q15Data.deptName;

    var esc = function(str) {
      if (!str) return '';
      return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    };
    var td = function(v) {
      if (v === undefined || v === null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && v.length === 0)) {
        return '<td class="empty">' + T('（未填写）', '(Not filled)') + '</td>';
      }
      return '<td>' + esc(String(v)) + '</td>';
    };
    var now = new Date();
    var dateStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    var company = data.companyName || T('HACCP计划书', 'HACCP Plan');

    var html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"><!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom><w:DoNotOptimizeForBrowser/></w:WordDocument></xml><![endif]--><style>' +
      '@page{size:A4;margin:2.54cm 2.54cm 2.54cm 2.54cm;mso-header-margin:1.5cm;mso-footer-margin:1.25cm}' +
      'body{font-family:' + T('"宋体",SimSun,', '"Times New Roman",Times,') + 'serif;font-size:12pt;line-height:1.6;color:#000}' +
      '.cover-title{font-size:16pt;font-weight:bold;text-align:center;margin-bottom:24pt;padding-bottom:12pt;border-bottom:2px solid #000}' +
      '.section-title{font-size:14pt;font-weight:bold;margin-top:24pt;margin-bottom:12pt;padding-bottom:6pt;border-bottom:1px solid #ccc;color:#000}' +
      '.sub-title{font-size:' + T('12pt', '11pt') + ';font-weight:bold;margin-top:14pt;margin-bottom:6pt;color:#222}' +
      'p{font-size:11pt;line-height:1.6;margin-bottom:6pt}' +
      'li{font-size:10pt;line-height:1.6;margin-bottom:2pt}' +
      'table{width:100%;border-collapse:collapse;margin-top:8pt;margin-bottom:16pt}' +
      'th{background-color:#d9e2f3;color:#000;font-weight:bold;font-size:8pt;padding:3pt 4pt;border:1pt solid #000;text-align:center;vertical-align:middle}' +
      'td{font-size:8pt;padding:3pt 4pt;border:1pt solid #000;vertical-align:top;word-break:break-all}' +
      '.hazard-table th{font-size:10pt;padding:4pt 6pt}' +
      '.hazard-table td{font-size:10pt;padding:4pt 6pt}' +
      '.hazard-table td.empty{color:#888;font-style:italic;font-size:9pt}' +
      'td.empty{color:#888;font-style:italic}' +
      '.ccp-yes{color:#c00;font-weight:bold}' +
      '.ctrl-chart td{font-size:7.5pt}' +
      '.ctrl-chart th{font-size:7.5pt}' +
      '.info-table td:first-child{width:180pt;background-color:#f0f0f0;font-weight:bold;font-size:10pt}' +
      '.info-table td{font-size:10pt}' +
      '.footer-note{text-align:center;font-size:9pt;color:#888;margin-top:30pt;border-top:1px solid #ddd;padding-top:8pt}' +
      '</style></head><body>' +
      '<h1 class="cover-title">' + T('HACCP计划书', 'HACCP Plan') + '</h1>' +
      '<p style="font-size:11pt;"><strong>' + T('企业名称', 'Company') + '：</strong>' + esc(company) + '</p>' +
      '<p style="font-size:11pt;"><strong>' + T('制定部门', 'Department') + '：</strong>' + esc(data.deptName || '—') + '</p>' +
      '<p style="font-size:11pt;"><strong>' + T('审核人员', 'Auditor') + '：</strong>' + esc(data.auditor || '—') + '</p>' +
      '<p style="font-size:11pt;"><strong>' + T('发布日期', 'Date of Issue') + '：</strong>' + dateStr + '</p>';

    // ===== 1. HACCP Team =====
    html += '<h2 class="section-title">' + T('1. HACCP小组的组成', '1. HACCP Team Composition') + '</h2>';
    html += '<table class="info-table"><tbody>';
    html += '<tr><td>' + T('企业名称', 'Company Name') + '</td>' + td(data.companyName) + '</tr>';
    html += '<tr><td>' + T('制定部门', 'Department') + '</td>' + td(data.deptName) + '</tr>';
    html += '<tr><td>' + T('审核人员', 'Auditor') + '</td>' + td(data.auditor) + '</tr>';
    html += '</tbody></table>';

    var team = data.haccpTeam || [];
    if (team.length > 0 && team.some(function(m) { return m.name && m.name.trim(); })) {
      html += '<p class="sub-title">' + T('HACCP小组成员', 'HACCP Team Members') + '</p>';
      html += '<table><thead><tr><th>' + T('姓名', 'Name') + '</th><th>' + T('部门', 'Dept.') + '</th><th>' + T('职责', 'Role') + '</th><th>' + T('权限', 'Authority') + '</th><th>' + T('备注', 'Remarks') + '</th></tr></thead><tbody>';
      team.forEach(function(m) { html += '<tr>' + td(m.name) + td(m.dept) + td(m.role) + td(m.authority) + td(m.remark) + '</tr>'; });
      html += '</tbody></table>';
    }

    var ex1 = (data.extraItems || []).filter(function(e) { return e.key || e.value; });
    if (ex1.length > 0) {
      html += '<p class="sub-title">' + T('其他项目', 'Additional Items') + '</p>';
      html += '<table><thead><tr><th>' + T('项目名称', 'Item') + '</th><th>' + T('项目内容', 'Content') + '</th></tr></thead><tbody>';
      ex1.forEach(function(e) { html += '<tr>' + td(e.key) + td(e.value) + '</tr>'; });
      html += '</tbody></table>';
    }

    // ===== 2. Product Description =====
    html += '<h2 class="section-title" style="page-break-before:always;">' + T('2. 产品描述', '2. Product Description') + '</h2>';
    var pdLabel = isZh ? [
      ['pd_productProps','产品的名称、类别、成分及其生物、化学、物理特性'],
      ['pd_rawProps','原辅料、食品包装材料的名称、类别、成分及其生物、化学和物理特性'],
      ['pd_rawSupply','原辅料、食品包装材料的来源，以及生产、包装、储藏、运输和交付方式'],
      ['pd_rawUsage','原辅料、食品包装材料接收要求、接收方式和使用方式'],
      ['pd_productProcess','产品的加工方式'],
      ['pd_productStorage','产品的包装、储藏、运输和交付方式'],
      ['pd_productSales','产品的销售方式和标识']
    ] : [
      ['pd_productProps','Product Name, Category, Composition &amp; Characteristics (Bio/Chem/Phys)'],
      ['pd_rawProps','Raw Materials &amp; Packaging — Name, Category, Composition &amp; Characteristics'],
      ['pd_rawSupply','Raw Materials &amp; Packaging — Source, Production, Storage, Transport &amp; Delivery'],
      ['pd_rawUsage','Raw Materials &amp; Packaging — Receiving Requirements &amp; Usage Method'],
      ['pd_productProcess','Processing Method'],
      ['pd_productStorage','Packaging, Storage, Transport &amp; Delivery Method'],
      ['pd_productSales','Sales Method &amp; Product Labeling']
    ];
    html += '<table class="info-table"><tbody>';
    pdLabel.forEach(function(f) { html += '<tr><td>' + f[1] + '</td>' + td(data[f[0]]) + '</tr>'; });
    html += '</tbody></table>';

    var pe = (data.productExtraItems || []).filter(function(e) { return e.key || e.value; });
    if (pe.length > 0) {
      html += '<p class="sub-title">' + T('其他必要信息', 'Additional Product Information') + '</p>';
      html += '<table><thead><tr><th>' + T('项目名称', 'Item') + '</th><th>' + T('项目内容', 'Content') + '</th></tr></thead><tbody>';
      pe.forEach(function(e) { html += '<tr>' + td(e.key) + td(e.value) + '</tr>'; });
      html += '</tbody></table>';
    }

    // ===== 3. Intended Use =====
    html += '<h2 class="section-title" style="page-break-before:always;">' + T('3. 预期用途的确定', '3. Intended Use') + '</h2>';
    var iuLabel = isZh ? [
      ['iu_consumerExpect','顾客对产品的消费或使用期望'],
      ['iu_intendedUse','产品的预期用途和储藏条件，以及保质期'],
      ['iu_consumptionMethod','产品预期的食用或使用方式'],
      ['iu_targetCustomer','产品预期的顾客对象'],
      ['iu_vulnerableGroups','直接消费产品对易受伤害群体的适用性'],
      ['iu_unintendedUse','产品非预期(但极可能出现)的食用或使用方式']
    ] : [
      ['iu_consumerExpect','Consumer Expectations for the Product'],
      ['iu_intendedUse','Intended Use, Storage Conditions &amp; Shelf Life'],
      ['iu_consumptionMethod','Expected Consumption or Use Method'],
      ['iu_targetCustomer','Target Consumer Group'],
      ['iu_vulnerableGroups','Suitability for Vulnerable Groups'],
      ['iu_unintendedUse','Reasonably Foreseeable Unintended Use']
    ];
    html += '<table class="info-table"><tbody>';
    iuLabel.forEach(function(f) { html += '<tr><td>' + f[1] + '</td>' + td(data[f[0]]) + '</tr>'; });
    html += '</tbody></table>';

    var iue = (data.iuExtraItems || []).filter(function(e) { return e.key || e.value; });
    if (iue.length > 0) {
      html += '<p class="sub-title">' + T('其他必要信息', 'Additional Information') + '</p>';
      html += '<table><thead><tr><th>' + T('项目名称', 'Item') + '</th><th>' + T('项目内容', 'Content') + '</th></tr></thead><tbody>';
      iue.forEach(function(e) { html += '<tr>' + td(e.key) + td(e.value) + '</tr>'; });
      html += '</tbody></table>';
    }

    // ===== 4. Product & Process Info =====
    html += '<h2 class="section-title" style="page-break-before:always;">' + T('4. 产品与生产流程', '4. Product &amp; Process Information') + '</h2>';
    html += '<p class="sub-title">' + T('产品基本信息', 'Basic Product Information') + '</p>';
    var prodLabel = isZh ? [
      ['productName','产品名称'],['rawMaterials','主要原料'],['additives','添加剂'],
      ['productPH','产品PH值'],['waterActivity','水分活度'],
      ['storageCondition','储存条件'],['packagingMethod','包装方式'],
      ['targetConsumer','目标消费者'],['shelfLife','保质期']
    ] : [
      ['productName','Product Name'],['rawMaterials','Raw Materials'],['additives','Additives'],
      ['productPH','pH Value'],['waterActivity','Water Activity (Aw)'],
      ['storageCondition','Storage Conditions'],['packagingMethod','Packaging Method'],
      ['targetConsumer','Target Consumers'],['shelfLife','Shelf Life']
    ];
    html += '<table class="info-table"><tbody>';
    prodLabel.forEach(function(f) { html += '<tr><td>' + f[1] + '</td>' + td(data[f[0]]) + '</tr>'; });
    html += '</tbody></table>';

    var formula = (data.formula || []).filter(function(f) { return f.material || f.dosage || f.func; });
    if (formula.length > 0) {
      html += '<p class="sub-title">' + T('配方 / 物料清单', 'Formula / Bill of Materials') + '</p>';
      html += '<table><thead><tr><th>' + T('原料/辅料/添加剂', 'Ingredient / Additive') + '</th><th>' + T('精确用量', 'Dosage') + '</th><th>' + T('关键作用', 'Function') + '</th></tr></thead><tbody>';
      formula.forEach(function(f) { html += '<tr>' + td(f.material) + td(f.dosage) + td(f.func) + '</tr>'; });
      html += '</tbody></table>';
    }

    var steps = data.processSteps || [];
    var stepsHtml = '';
    steps.forEach(function(s, i) {
      if (!s.stepName || !s.stepName.trim()) return;
      stepsHtml += '<tr><td style="text-align:center;">' + (i+1) + '</td>' + td(s.stepName) + td(s.operationMethod) + td(s.parameters) + td(s.equipmentName) + td(s.controlPoint) + '</tr>';
    });
    if (stepsHtml) {
      html += '<p class="sub-title">' + T('生产操作步骤', 'Process Flow Steps') + '</p>';
      html += '<table><thead><tr><th style="width:30px;">' + T('序号', 'No.') + '</th><th>' + T('步骤名称', 'Step') + '</th><th>' + T('操作方法', 'Method') + '</th><th>' + T('工艺参数', 'Parameters') + '</th><th>' + T('设备名称', 'Equipment') + '</th><th>' + T('控制点', 'Control Pt.') + '</th></tr></thead><tbody>' + stepsHtml + '</tbody></table>';
    }
    html += '<p><strong>' + T('流程图现场确认', 'Flow Chart On-site Confirmation') + '：</strong>' + (data.flowConfirmed ? T('✓ 已由HACCP小组现场确认', '✓ Confirmed by HACCP team on-site') : T('✗ 未确认', '✗ Not confirmed')) + '</p>';

    // 插入流程图（适配Word一页大小）
    html += '<!--FLOWCHART_MARKER-->';
    html += '<p class="sub-title" style="page-break-before:always;">' + T('工艺流程图', 'Process Flow Diagram') + '</p>';
    html += '<div style="text-align:center;padding:8pt;border:1pt solid #ccc;margin-bottom:12pt;">';
    html += '<!--FLOWCHART_IMG-->';
    html += '</div>';

    // ===== 5. CCP判定表 =====
    var ccpSteps = data.ccpSteps || [];
    if (ccpSteps.length > 0) {
      html += '<h2 class="section-title" style="page-break-before:always;">' + T('5. CCP判定表', '5. CCP Determination Table') + '</h2>';
      html += '<table><thead><tr><th style="width:70px;">' + T('加工步骤', 'Process Step') + '</th><th style="width:55px;">' + T('危害', 'Hazard') + '</th><th>' + T('危害描述', 'Hazard Description') + '</th><th style="width:32px;">Q1</th><th style="width:32px;">Q2a</th><th style="width:32px;">Q2b</th><th style="width:32px;">Q3</th><th style="width:32px;">Q4</th><th style="width:32px;">Q5</th><th style="width:48px;">' + T('CCP?', 'CCP?') + '</th><th>' + T('评注 / 判定依据', 'Comment / Justification') + '</th></tr></thead><tbody>';
      var hf = isZh ? {bio:'生物危害',chem:'化学危害',phys:'物理危害'} : {bio:'Biological',chem:'Chemical',phys:'Physical'};
      ccpSteps.forEach(function(s, si) {
        if (!s.hazards) return;
        ['bio','chem','phys'].forEach(function(ht, hi) {
          var h = s.hazards[ht] || {};
          var isCCP = h.isCCP;
          var r = '';
          if (isCCP === true) r = '<span class="ccp-yes">YES</span>';
          else if (isCCP === false) r = 'NO';
          else if (isCCP === 'modify') r = T('需修改', 'Modify');
          else r = '—';
          html += '<tr>';
          if (hi === 0) html += '<td rowspan="3" style="vertical-align:middle;font-weight:bold;">' + esc(s.stepName || T('步骤','Step ')+(si+1)) + '</td>';
          html += '<td style="font-weight:500;">' + hf[ht] + '</td>';
          html += '<td style="font-size:7.5pt;">' + esc(I18n.b(h.hazardDesc || '')) + '</td>';
          html += '<td style="text-align:center;">' + (h.q1||'—') + '</td>';
          html += '<td style="text-align:center;">' + (h.q2||'—') + '</td>';
          html += '<td style="text-align:center;">' + (h.q2_need||'—') + '</td>';
          html += '<td style="text-align:center;">' + (h.q3||'—') + '</td>';
          html += '<td style="text-align:center;">' + (h.q4||'—') + '</td>';
          html += '<td style="text-align:center;">' + (h.q5||'—') + '</td>';
          html += '<td style="text-align:center;">' + r + '</td>';
          html += '<td style="font-size:7pt;">' + esc((I18n.b(h.aiReasoning || '').length > 100 ? I18n.b(h.aiReasoning || '').substring(0,100)+'...' : I18n.b(h.aiReasoning||''))) + '</td>';
          html += '</tr>';
        });
      });
      html += '</tbody></table>';
    }

    // ===== 6. HACCP Control Chart =====
    html += '<h2 class="section-title" style="page-break-before:always;">' + T('6. HACCP控制图表', '6. HACCP Control Chart') + '</h2>';
    html += '<table class="ctrl-chart"><thead><tr><th style="width:28px;">' + T('CCP编号', 'CCP No.') + '</th><th style="width:55px;">' + T('加工步骤', 'Process Step') + '</th><th>' + T('危害', 'Hazard') + '</th><th>' + T('控制措施', 'Control Measure') + '</th><th>' + T('关键限值', 'Critical Limits') + '</th><th colspan="3" style="width:130px;">' + T('监控', 'Monitoring') + '</th><th colspan="2" style="width:130px;">' + T('纠偏措施', 'Corrective Action') + '</th></tr>';
    html += '<tr><th></th><th></th><th></th><th></th><th></th><th style="width:50px;">' + T('方法', 'Procedure') + '</th><th style="width:35px;">' + T('频率', 'Freq.') + '</th><th style="width:50px;">' + T('责任人', 'Resp.') + '</th><th style="width:65px;">' + T('方法', 'Procedure') + '</th><th style="width:50px;">' + T('责任人', 'Resp.') + '</th></tr></thead><tbody>';

    var ccpList = [];
    if (data.ccpSteps && data.ccpSteps.length > 0) {
      data.ccpSteps.forEach(function(s) {
        if (!s.hazards) return;
        ['bio','chem','phys'].forEach(function(ht) {
          var h = s.hazards[ht];
          if (h && h.isCCP === true) {
            var hf2 = isZh ? {bio:'生物危害',chem:'化学危害',phys:'物理危害'} : {bio:'Biological',chem:'Chemical',phys:'Physical'};
            ccpList.push({ stepName: s.stepName, hazard: hf2[ht] + ': ' + I18n.b(h.hazardDesc || '') });
          }
        });
      });
    }
    var monitoring = data.monitoring || [];
    var corrective = data.correctiveActions || [];
    ccpList.forEach(function(ccp, ci) {
      var mon = monitoring[ci] || {};
      var corr = corrective[ci] || {};
      html += '<tr>';
      html += '<td style="text-align:center;vertical-align:middle;font-weight:bold;">CCP ' + (ci+1) + '</td>';
      html += '<td style="vertical-align:middle;">' + esc(ccp.stepName) + '</td>';
      html += '<td>' + esc(ccp.hazard) + '</td>';
      html += td(mon.method || '');
      html += td(data.criticalLimits || '');
      html += td(mon.method || '');
      html += '<td style="text-align:center;">' + esc(mon.frequency || '') + '</td>';
      html += td(mon.personnel || '');
      html += td(corr.corrective || '');
      html += td(corr.record || '');
      html += '</tr>';
    });
    if (ccpList.length === 0) {
      html += '<tr><td colspan="10" style="color:#888;font-style:italic;text-align:center;">' + T('未识别到CCP，无需HACCP控制图表。', 'No CCPs identified. A HACCP control chart is not required.') + '</td></tr>';
    }
    html += '</tbody></table>';

    // ===== 7. Documentation =====
    html += '<h2 class="section-title" style="page-break-before:always;">' + T('7. 文件与记录', '7. Documentation and Records') + '</h2>';
    html += '<p>' + T('所有监控活动均记录在标准表格上。记录包括原料检测结果、温度图表、清洗日志、设备检查记录及纠偏措施报告。', 'All monitoring activities are documented on standard forms. Records include raw material test results, temperature charts, cleaning logs, equipment checks, and corrective action reports.') + '</p>';
    html += '<table class="info-table"><tbody>';
    html += '<tr><td>' + T('记录保存期限', 'Record Retention Period') + '</td>' + td(data.recordPeriod || T('2年', '2 years')) + '</tr>';
    html += '<tr><td>' + T('记录格式要求', 'Record Format Requirements') + '</td>' + td(data.recordFormat || T('电子版及纸质版双份保存', 'Electronic and paper copies')) + '</tr>';
    html += '</tbody></table>';

    // ===== 8. Verification =====
    html += '<h2 class="section-title" style="page-break-before:always;">' + T('8. 验证程序', '8. Verification') + '</h2>';
    html += '<p>' + T('验证活动对于确认HACCP体系有效运行并符合既定计划至关重要。', 'Verification activities are essential to confirm that the HACCP system is operating effectively and in compliance with the established plan.') + '</p>';
    var vMethod = data.verificationMethod || '';
    var vFreq = data.verificationFrequency || '';
    var vPerson = data.verificationPersonnel || '';
    if (vMethod) html += '<p><strong>' + T('验证方法', 'Verification Methods') + '：</strong><br>' + esc(vMethod).replace(/\n/g, '<br>') + '</p>';
    if (vFreq) html += '<p><strong>' + T('验证频率', 'Verification Frequency') + '：</strong>' + esc(vFreq) + '</p>';
    if (vPerson) html += '<p><strong>' + T('验证人员', 'Verification Personnel') + '：</strong>' + esc(vPerson) + '</p>';
    if (!vMethod && !vFreq && !vPerson) {
      html += '<ul>';
      html += '<li>' + T('CCP监控记录审核：每批次生产结束后由品控主管审核。', 'CCP Monitoring Record Review: Reviewed by QC Supervisor after each batch.') + '</li>';
      html += '<li>' + T('纠偏记录回顾：每周由HACCP小组组长回顾。', 'Corrective Action Record Review: Reviewed weekly by HACCP Team Leader.') + '</li>';
      html += '<li>' + T('成品抽样检测：每月进行微生物和理化指标检测。', 'Finished Product Sampling: Monthly microbiological and chemical testing.') + '</li>';
      html += '<li>' + T('设备校准：温度传感器、金属检测仪、pH计等每季度校准。', 'Equipment Calibration: Quarterly for sensors, metal detectors, pH meters.') + '</li>';
      html += '<li>' + T('HACCP体系年度复审：由HACCP小组每年进行全面复审。', 'Annual HACCP System Review: Full review by HACCP team annually.') + '</li>';
      html += '</ul>';
    }

    // ===== 9. Review =====
    html += '<h2 class="section-title">' + T('9. HACCP计划复审', '9. HACCP Plan Review') + '</h2>';
    html += '<p>' + T('在以下情况下，需要对HACCP计划进行复审：', 'The HACCP plan is subject to review under the following circumstances:') + '</p>';
    html += '<ul>';
    html += '<li>' + T('政府法规或食品安全指南发生变化。', 'Changes in government legislation or food safety guidelines.') + '</li>';
    html += '<li>' + T('发生涉及该产品的食品安全事件。', 'Occurrence of a food safety incident involving the product.') + '</li>';
    html += '<li>' + T('收到反复的产品安全投诉或质量不稳定反馈。', 'Repeated complaints on product safety or unstable quality.') + '</li>';
    html += '<li>' + T('引入新配方、新原料或新生产工艺。', 'Introduction of new formulation, materials, or technology.') + '</li>';
    html += '<li>' + T('设备、包装材料或加工方法变更。', 'Changes in equipment, packaging, or processing methods.') + '</li>';
    html += '<li>' + T('出现或检测到新的食源性致病菌或其他危害。', 'Emergence of new foodborne pathogens or other hazards.') + '</li>';
    html += '</ul>';
    html += '<p>' + T('即使未触发以上条件，HACCP小组也至少应', 'In the absence of the above triggers, a comprehensive review shall be conducted at least ') + '<strong>' + T('每年一次', 'annually') + '</strong>' + T('对HACCP计划进行全面复审。', ' by the HACCP team.') + '</p>';

    html += '<p class="footer-note">' + T('本文件由 HACCP AI 助手于 ', 'This document was generated by HACCP AI Assistant on ') + dateStr + T(' 自动生成 — 待HACCP小组审核批准。', ' — For review and approval by the HACCP Team.') + '</p>';
    html += '</body></html>';

    // 获取流程图SVG
    var flowSvg = pfData.flowchartSvg || data.flowchartSvg || '';
    if (!flowSvg) {
      try {
        var pfR = localStorage.getItem('haccp_profile_data');
        if (pfR) { var pfD2 = JSON.parse(pfR); flowSvg = pfD2.flowchartSvg || ''; }
      } catch(e) {}
    }

    function doDownload(finalHtml) {
      var blob = new Blob(['﻿' + finalHtml], { type: 'application/msword;charset=UTF-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = (isZh ? 'HACCP计划书_' : 'HACCP_Plan_') + (company.replace(/[^a-zA-Z0-9一-鿿]/g,'_') || 'Unnamed') + '_' + dateStr + '.doc';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    if (html.indexOf('<!--FLOWCHART_MARKER-->') !== -1 && flowSvg) {
      var img = new Image();
      img.onload = function() {
        var canvas = document.createElement('canvas');
        // A4 usable width ~600px at 96dpi, leave margins. Height max ~750px for one page.
        var displayW = 585;
        var scale = 2;
        var renderW = displayW * scale;
        var ratio = renderW / img.width;
        canvas.width = renderW;
        canvas.height = Math.round(img.height * ratio);
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        var pngData = canvas.toDataURL('image/png');
        html = html.replace('<!--FLOWCHART_MARKER-->', '').replace('<!--FLOWCHART_IMG-->',
          '<img src="' + pngData + '" width="' + displayW + '" style="width:' + displayW + 'px;max-height:700px;">');
        doDownload(html);
      };
      img.onerror = function() {
        html = html.replace('<!--FLOWCHART_MARKER-->', '').replace('<!--FLOWCHART_IMG-->',
          '<img src="' + esc(flowSvg) + '" width="585" style="width:585px;max-height:700px;">');
        doDownload(html);
      };
      img.src = flowSvg;
    } else {
      html = html.replace('<!--FLOWCHART_MARKER-->', '').replace('<!--FLOWCHART_IMG-->', '');
      doDownload(html);
    }
  }


  return { init: init, selectPlan: function(id) { setCurrentPlanId(id); init(); } };
})();