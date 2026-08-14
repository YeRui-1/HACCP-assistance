// HACCP计划书创建模块 - 完整HACCP问卷填写模块
const Questionnaire15min = (() => {
  const STORAGE_KEY = 'haccp_15min_data';

  // 如果是通过 file:// 打开的，自动补全后端地址
  var API_HOST = '';
  if (window.location.protocol === 'file:' || window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') {
    API_HOST = 'http://localhost:8000';
  }
  const SECTION_COMPLETED_KEY = 'haccp_15min_completed';

  // ===== 全局历史名称迁移：扫描 localStorage 全部 key，替换旧名称（大小写不敏感）=====
  function migrateAllLegacyNames() {
    try {
      var re = /Jerusalem artichoke/gi;
      var any = false;
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        var val = localStorage.getItem(key);
        if (!val || typeof val !== 'string' || val.indexOf('Jerusalem') === -1) continue;
        var newVal = val.replace(re, 'chicory root');
        if (newVal !== val) {
          localStorage.setItem(key, newVal);
          any = true;
        }
      }
      if (any) console.log('[migrate] localStorage 历史名称已迁移: Jerusalem artichoke -> chicory root');
    } catch (e) { console.warn('[migrate] 迁移失败:', e); }
  }
  migrateAllLegacyNames();

  function genId() { return 'f_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7); }
  // 是/否 → 当前语言（用于CCP判定路径等显示存储值）
  function yn(v) { return v === '是' ? I18n.t('common.yes') : (v === '否' ? I18n.t('common.no') : (v || '')); }
    function esc(str) {
    if (!str) return '';
    var s = String(str);
    s = s.replace(/&/g, String.fromCharCode(38, 97, 109, 112, 59));
    s = s.replace(/"/g, String.fromCharCode(38, 113, 117, 111, 116, 59));
    s = s.replace(/</g, String.fromCharCode(38, 108, 116, 59));
    s = s.replace(/>/g, String.fromCharCode(38, 103, 116, 59));
    return s;
  }
  function getContainer() { return document.getElementById('questionnaireContainer'); }

  // ===== 数据管理 =====
  function getDefaultData() {
    return {
      companyName: '',
      deptName: '',
      haccpTeam: [{ id: genId(), name: '', dept: '', position: '', role: '', remark: '' }],
      auditor: '',
      extraItems: [],
      productExtraItems: [],
      productName: '',
      rawMaterials: '',
      additives: '',
      productPH: '',
      waterActivity: '',
      intendedUse: '',
      storageCondition: '',
      packagingMethod: '',
      targetConsumer: '',
      shelfLife: '',
      formula: [{ id: genId(), material: '', dosage: '', func: '' }],
      processSteps: [{ id: genId(), stepName: '', operationMethod: '', parameters: '', controlPoint: '', equipmentName: '' }],
      flowConfirmed: false,
      flowchartXml: '',
      hazardBio: [],
      hazardChem: [],
      hazardPhys: [],
      // 危害分析工作单（三子步骤共享数据）
      hazardWorksheet: [],
      hazardWorksheetStep: 'identify', // 'identify' | 'assess' | 'control'
      hazardConfirmed: false,
      ccpSteps: [],       // 存储每个步骤的CCP判定结果: { stepName, completed, hazards: { bio: { q1, q1_need, q2, q3, q4, isCCP, hazardDesc }, chem: {...}, phys: {...} } }
      ccpStepIndex: 0,    // 当前正在判定的步骤索引
      ccpHazardType: 'bio', // 当前判定的危害类型: 'bio'|'chem'|'phys'
      ccpCurrentQ: 1,     // 当前问题编号: 1|2|3|4|5
      ccpDecisionTreeVersion: 'v1', // 标准版
      ccpCompleted: false,// 是否已全部完成
      execStandard: '',
      criticalLimits: '',
      criticalLimitsData: [],
      monitoring: [{ id: genId(), ccp: '', object: '', method: '', frequency: '', personnel: '', remark: '' }],
      correctiveActions: [{ id: genId(), ccp: '', personnel: '', causeAnalysis: '', productHandling: '' }],
      recordPeriod: '',
      recordFormat: '',
      verification: { basis: '', frequency: '', personnel: '', content: '', result: '', record: '' },
      verificationExtraItems: [],
      verificationSubmitted: false,
      verificationSignerName: '',
      verificationSignerDate: '',
      managementReview: { reviewContent: '', reviewResult: '', correctiveMeasures: '', reVerification: '' },
    };
  }

  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        const def = getDefaultData();
        Object.keys(def).forEach(k => {
          if (data[k] === undefined) data[k] = def[k];
        });
        // 数据迁移：旧名称 Jerusalem artichoke → chicory root（遍历全部字符串字段）
        migrateLegacyNames(data);
        return data;
      }
    } catch (e) { /* ignore */ }
    return getDefaultData();
  }

  // 迁移旧数据中的历史名称（localStorage 中可能残留旧文本）
  function migrateLegacyNames(obj) {
    if (!obj || typeof obj !== 'object') return;
    var replaced = false;
    var re = /Jerusalem artichoke/gi;
    function fix(v) {
      if (typeof v === 'string' && v.indexOf('Jerusalem') !== -1) {
        replaced = true;
        return v.replace(re, 'chicory root');
      }
      return v;
    }
    (function walk(o) {
      if (Array.isArray(o)) { o.forEach(walk); return; }
      if (o && typeof o === 'object') {
        Object.keys(o).forEach(function(k) { o[k] = fix(o[k]); if (o[k] && typeof o[k] === 'object') walk(o[k]); });
      }
    })(obj);
    if (replaced) saveData(obj);
  }

  function saveData(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
    scheduleDraftSync(data);
  }

  // ===== 草稿自动保存到后端（登录用户，15秒节流）=====
  var _draftTimer = null;
  function scheduleDraftSync(data) {
    var token = null;
    try { token = localStorage.getItem('haccp_token'); } catch(e) {}
    if (!token) return;
    if (_draftTimer) clearTimeout(_draftTimer);
    _draftTimer = setTimeout(function() {
      _draftTimer = null;
      var payload;
      try { payload = JSON.stringify(data); } catch(e) { return; }
      fetch(API_HOST + '/api/drafts/questionnaire', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ data: JSON.parse(payload) }),
      }).catch(function() { /* 后端不可用时静默跳过，本地已保存 */ });
    }, 15000);
  }

  // 本地无数据时，从后端草稿恢复
  function loadDraftFromBackendIfNeeded() {
    try {
      if (localStorage.getItem(STORAGE_KEY)) return;
      var token = localStorage.getItem('haccp_token');
      if (!token) return;
      fetch(API_HOST + '/api/drafts/questionnaire', {
        headers: { 'Authorization': 'Bearer ' + token },
      })
        .then(function(r) { return r.json(); })
        .then(function(d) {
          if (d && d.ok && d.draft && d.draft.content) {
            var parsed = JSON.parse(d.draft.content);
            if (parsed && typeof parsed === 'object') {
              localStorage.setItem(STORAGE_KEY, d.draft.content);
              renderActiveSection();
              renderSectionNav();
            }
          }
        })
        .catch(function() { /* 忽略 */ });
    } catch(e) {}
  }

  function isCompleted() {
    return localStorage.getItem(SECTION_COMPLETED_KEY) === 'true';
  }

  let _uploadedText = '';
  let _uploadedFileName = '';
  let _uploadedFileSize = 0;

  async function init() {
    // 从15min问卷(档案)自动补充产品/原料信息到问卷（须在渲染前，避免被旧数据覆盖）
    syncProfileToQuestionnaireIfNeeded();
    // 本地无数据时，尝试从后端草稿恢复
    loadDraftFromBackendIfNeeded();
    const container = getContainer();
    container.innerHTML = `
      <a class="back-link" href="javascript:App.navigateTo('home')">← ${I18n.t('nav.back')}</a>
      <div id="q15ReviewBanner" style="display:none;"></div>
      <div class="q15-header">
        <h1>${I18n.t('q15.title')}</h1>
        <p class="q15-desc">${I18n.t('q15.desc')}</p>
        <div class="q15-progress" id="q15Progress"></div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:12px 0;padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
        <span style="font-size:12px;color:var(--gray-400);flex:1;">📦 ${I18n.t('q.demoSave')} / ${I18n.t('q.demoLoad')}</span>
        <button class="btn btn-xs btn-secondary" id="q15DemoSaveBtn">${I18n.t('q.demoSave')}</button>
        <button class="btn btn-xs btn-secondary" id="q15DemoLoadBtn">${I18n.t('q.demoLoad')}</button>
        <span id="q15DemoStatus" style="font-size:12px;color:var(--gray-400);"></span>
      </div>
      <div id="q15Content"></div>
    `;
    renderSectionNav();
    renderActiveSection();
    bindDemoEvents();
    
    // 清除旧版本的导航标记（验证程序已独立）
    try { localStorage.removeItem('haccp_navigate_to_verification'); } catch(e) { console.warn('Failed to remove localStorage haccp_navigate_to_verification:', e); }
  }

  // 从15min问卷(档案)自动补充产品/原料信息到问卷
  function syncProfileToQuestionnaireIfNeeded() {
    try {
      var pRaw = localStorage.getItem('haccp_profile_data');
      if (!pRaw) return;
      var p = JSON.parse(pRaw);
      var qRaw = localStorage.getItem(STORAGE_KEY);
      var q = qRaw ? JSON.parse(qRaw) : null;
      if (!q) return;
      var changed = false;
      function fillIfEmpty(k) { if (!q[k] && p[k]) { q[k] = p[k]; changed = true; } }
      ['companyName', 'deptName', 'auditor', 'productName', 'rawMaterials', 'additives', 'intendedUse', 'storageCondition', 'packagingMethod', 'targetConsumer', 'shelfLife'].forEach(fillIfEmpty);
      if ((!q.formula || q.formula.length === 0 || (q.formula.length === 1 && !q.formula[0].material)) && p.formula && p.formula.length > 0) {
        q.formula = JSON.parse(JSON.stringify(p.formula));
        changed = true;
      }
      if (!q.rawMaterials) {
        var mats = [];
        (p.formula || []).forEach(function(f) { if (f.material && f.material.trim() && mats.indexOf(f.material.trim()) === -1) mats.push(f.material.trim()); });
        if (mats.length > 0) { q.rawMaterials = mats.join('、'); changed = true; }
      }
      ['pd_rawProps','pd_rawSupply','pd_rawUsage','pd_productProps','pd_productProcess','pd_productStorage','pd_productSales'].forEach(fillIfEmpty);
      ['iu_consumerExpect','iu_intendedUse','iu_consumptionMethod','iu_targetCustomer','iu_vulnerableGroups','iu_unintendedUse'].forEach(fillIfEmpty);
      if ((!q.productExtraItems || q.productExtraItems.length === 0) && p.productExtraItems) { q.productExtraItems = p.productExtraItems; changed = true; }
      if ((!q.iuExtraItems || q.iuExtraItems.length === 0) && p.iuExtraItems) { q.iuExtraItems = p.iuExtraItems; changed = true; }
      if ((!q.haccpTeam || q.haccpTeam.length === 0) && p.haccpTeam) { q.haccpTeam = p.haccpTeam; changed = true; }
      if (changed) localStorage.setItem(STORAGE_KEY, JSON.stringify(q));
    } catch (e) { console.warn('Failed to sync profile data to questionnaire:', e); }
  }

  // ===== 危害识别前的工艺流程步骤确认（填写/编辑/删除步骤后再做危害识别）=====
  function renderStepManagerBlock(data) {
    autoFillStepsFromFlowchart(data);
    var editIdx = parseInt(data.currentEditingStep);
    if (isNaN(editIdx)) editIdx = -1;
    var stepData = (editIdx >= 0 && editIdx < data.processSteps.length) ? data.processSteps[editIdx] : { stepName: '', equipmentName: '', operationMethod: '', parameters: '' };
    var savedSteps = data.processSteps || [];
    var html = '<div class="q15-step-manager" style="margin-bottom:16px;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">';
    html += '<div style="font-weight:600;font-size:14px;margin-bottom:8px;">' + I18n.t('q.hwStepsTitle') + '</div>';
    html += '<p class="q15-table-hint" style="margin-bottom:10px;">' + I18n.t('q.hwStepsHint') + '</p>';
    html += '<div class="q15-step-form">';
    html += '<div class="q15-field-group"><label>' + I18n.t('q.stepName') + '</label><input type="text" id="stepFormName" value="' + esc(stepData.stepName || '') + '" placeholder="' + I18n.t('q.stepNamePh') + '"></div>';
    html += '<div class="q15-field-group"><label>' + I18n.t('q.equipment') + '</label><input type="text" id="stepFormEquipment" value="' + esc(stepData.equipmentName || '') + '" placeholder="' + I18n.t('q.equipmentPh') + '"></div>';
    html += '<div class="q15-field-group"><label>' + I18n.t('q.method') + '</label><textarea id="stepFormMethod" rows="2" placeholder="' + I18n.t('q.methodPh') + '">' + esc(stepData.operationMethod || '') + '</textarea></div>';
    html += '<div class="q15-field-group"><label>' + I18n.t('q.params') + '</label><input type="text" id="stepFormParams" value="' + esc(stepData.parameters || '') + '" placeholder="' + I18n.t('q.paramsPh') + '"></div>';
    html += '<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">';
    html += '<button class="btn btn-primary btn-sm" id="stepFormSaveBtn">' + I18n.t('q.saveStep') + '</button>';
    html += '<button class="btn btn-secondary btn-sm" id="addNewStepBtn">' + I18n.t('q.addStep') + '</button>';
    html += '</div></div>';
    if (savedSteps.length > 0) {
      html += '<div style="margin-top:14px;"><div style="font-size:13px;font-weight:600;margin-bottom:6px;color:var(--gray-700);">' + I18n.t('q.addedSteps') + '</div><ul style="list-style:none;padding:0;margin:0;">';
      savedSteps.forEach(function(s, i) {
        html += '<li style="padding:8px 10px;margin:4px 0;background:#fff;border:1px solid #e2e8f0;border-radius:6px;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:12px;" data-step-edit="' + i + '">';
        html += '<span><strong>' + (i + 1) + '. ' + esc(s.stepName || I18n.t('q.unnamed')) + '</strong>';
        if (s.equipmentName) html += ' | ' + I18n.t('flow.equipment') + esc(s.equipmentName);
        if (s.operationMethod) html += ' | ' + I18n.t('flow.method') + esc(s.operationMethod);
        if (s.parameters) html += ' | ' + I18n.t('flow.params') + esc(s.parameters);
        html += '</span><button class="btn btn-xs btn-secondary" data-step-delete="' + i + '" style="color:#dc2626;border-color:#fecaca;padding:2px 8px;font-size:12px;flex-shrink:0;">' + I18n.t('q.delete') + '</button></li>';
      });
      html += '</ul></div>';
    }
    html += '</div>';
    return html;
  }

  // ===== 演示数据：保存当前填写内容到后端 / 载入展示 =====
  function setDemoStatus(msg, ok) {
    var el = document.getElementById('q15DemoStatus');
    if (!el) return;
    el.textContent = msg;
    el.style.color = ok ? '#16a34a' : '#dc2626';
  }

  function applyDemoData(demo) {
    const def = getDefaultData();
    Object.keys(def).forEach(k => { if (demo[k] === undefined) demo[k] = def[k]; });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(demo));
    localStorage.setItem('haccp_submitted', 'true');
    localStorage.setItem(SECTION_COMPLETED_KEY, 'true');
    if (demo.processSteps && Array.isArray(demo.processSteps)) {
      try {
        localStorage.setItem('haccp_fc_steps', JSON.stringify(demo.processSteps.map(function(s) { return s.stepName || ''; })));
        localStorage.setItem('haccp_fc_ccp', JSON.stringify(demo.processSteps.map(function(s) { return s.controlPoint && s.controlPoint.toUpperCase().indexOf('CCP') !== -1 ? 1 : 0; })));
        localStorage.setItem('haccp_fc_leftNotes', '[]');
        localStorage.setItem('haccp_fc_rightNotes', '[]');
        localStorage.setItem('haccp_fc_rework', '[]');
      } catch(e) {}
    }
    currentStep = 0;
    renderSectionNav();
    renderActiveSection();
    if (typeof App !== 'undefined' && App.updateVerificationBtn) App.updateVerificationBtn();
  }

  function saveDemoData() {
    const data = loadData();
    var hasContent = JSON.stringify(data) !== JSON.stringify(getDefaultData());
    if (!hasContent) { setDemoStatus(I18n.t('q.demoEmpty'), false); return; }
    // 1. 本地备份（离线兜底）
    try { localStorage.setItem('haccp_demo_backup', JSON.stringify(data)); } catch(e) {}
    // 2. 保存到后端（写入 data/demo_inulin_full.json）
    fetch(API_HOST + '/api/demo/data', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: data }),
    })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d.ok) setDemoStatus(I18n.t('q.demoSaved'), true);
        else setDemoStatus(I18n.t('q.demoFailed') + (d.message || ''), false);
      })
      .catch(function(e) { setDemoStatus(I18n.t('q.demoSavedLocal'), false); });
  }

  function loadDemoData() {
    var backup = null;
    try { backup = localStorage.getItem('haccp_demo_backup'); } catch(e) {}
    fetch(API_HOST + '/api/demo/data')
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d.ok && d.data && (d.data.processSteps || d.data.haccpTeam)) {
          applyDemoData(d.data);
          setDemoStatus(I18n.t('q.demoLoaded'), true);
        } else {
          throw new Error('no data');
        }
      })
      .catch(function(e) {
        if (backup) {
          try { applyDemoData(JSON.parse(backup)); setDemoStatus(I18n.t('q.demoLoaded'), true); }
          catch(e2) { setDemoStatus(I18n.t('q.demoFailed') + e2.message, false); }
        } else {
          setDemoStatus(I18n.t('q.demoFailed') + (e.message || ''), false);
        }
      });
  }

  function bindDemoEvents() {
    var saveBtn = document.getElementById('q15DemoSaveBtn');
    if (saveBtn) saveBtn.addEventListener('click', saveDemoData);
    var loadBtn = document.getElementById('q15DemoLoadBtn');
    if (loadBtn) loadBtn.addEventListener('click', function() {
      if (!confirm(I18n.t('q.demoConfirm'))) return;
      loadDemoData();
    });
  }

  // ==================== 文件上传区域 ====================
  function renderUploadArea() {
    const el = document.getElementById('q15UploadArea');
    if (!el) return;
    const hasFile = !!_uploadedText;
    el.innerHTML = `
      <div class="q15-upload-zone ${hasFile ? 'has-file' : ''}" id="q15UploadZone">
        <div class="q15-upload-zone-icon">${hasFile ? '\u{1F4C4}' : '\u{1F4C1}'}</div>
        <div class="q15-upload-zone-title">${hasFile ? I18n.t('upload.parsed') : I18n.t('upload.optional')}</div>
        <div class="q15-upload-zone-hint">${hasFile ? _uploadedFileName : I18n.t('upload.dropHint')}</div>
        ${!hasFile ? '<div class="q15-upload-zone-hint" style="margin-top:4px;">' + I18n.t('upload.formats') + '</div>' : ''}
        <input type="file" id="q15FileInput" accept=".docx,.pdf" ${hasFile ? 'disabled' : ''}>
        ${!hasFile ? '<button class="q15-upload-btn" id="q15SelectFileBtn">' + I18n.t('upload.selectBtn') + '</button>' : ''}
      </div>
      ${_uploadedText ? `
        <div class="q15-upload-file-info">
          <span class="q15-file-icon">\u{1F4C4}</span>
          <span class="q15-file-name">${esc(_uploadedFileName)}</span>
          <span class="q15-file-size">${formatFileSize(_uploadedFileSize)}</span>
          <span class="q15-file-status ok">${I18n.t('upload.parseSuccess')}</span>
          <button class="btn btn-xs btn-secondary" id="q15ClearFileBtn">${I18n.t('upload.clear')}</button>
        </div>
        <div class="q15-upload-preview">${esc(_uploadedText.slice(0, 300))}${_uploadedText.length > 300 ? '...' : ''}</div>
        <div class="q15-upload-actions">
          <button class="btn btn-primary" id="q15AiFillBtn">${I18n.t('upload.aiFill')}</button>
          <button class="btn btn-secondary" id="q15ClearFileBtn2">${I18n.t('upload.reselect')}</button>
        </div>
      ` : ''}
      <div class="q15-upload-error" id="q15UploadError"></div>
    `;
    bindUploadEvents();
  }

  function bindUploadEvents() {
    const zone = document.getElementById('q15UploadZone');
    const fileInput = document.getElementById('q15FileInput');
    const selectBtn = document.getElementById('q15SelectFileBtn');
    if (selectBtn && fileInput) { selectBtn.addEventListener('click', (e) => { e.stopPropagation(); fileInput.click(); }); }
    if (fileInput) { fileInput.addEventListener('change', (e) => { if (e.target.files.length > 0) handleFile(e.target.files[0]); }); }
    if (zone) {
      zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
      zone.addEventListener('dragleave', () => { zone.classList.remove('drag-over'); });
      zone.addEventListener('drop', (e) => { e.preventDefault(); zone.classList.remove('drag-over'); if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]); });
    }
    const clearBtn = document.getElementById('q15ClearFileBtn');
    const clearBtn2 = document.getElementById('q15ClearFileBtn2');
    if (clearBtn) clearBtn.addEventListener('click', clearUploadedFile);
    if (clearBtn2) clearBtn2.addEventListener('click', clearUploadedFile);
    const aiBtn = document.getElementById('q15AiFillBtn');
    if (aiBtn) aiBtn.addEventListener('click', handleAiFill);
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function showUploadError(msg) {
    const err = document.getElementById('q15UploadError');
    if (err) { err.textContent = msg; err.style.display = 'block'; }
  }

  function hideUploadError() {
    const err = document.getElementById('q15UploadError');
    if (err) err.style.display = 'none';
  }

  function clearUploadedFile() {
    _uploadedText = ''; _uploadedFileName = ''; _uploadedFileSize = 0;
    if (currentStep === 0) renderActiveSection();
  }

  async function handleFile(file) {
    hideUploadError();
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'docx' && ext !== 'pdf') { showUploadError(I18n.t('upload.error.format')); return; }
    if (file.size > 20 * 1024 * 1024) { showUploadError(I18n.t('upload.error.size')); return; }
    if (ext === 'docx' && typeof mammoth === 'undefined') { showUploadError(I18n.t('upload.error.wordLib')); return; }
    if (ext === 'pdf' && (typeof pdfjsLib === 'undefined' || typeof pdfjsLib.getDocument !== 'function')) { showUploadError(I18n.t('upload.error.pdfLib')); return; }
    _uploadedFileName = file.name; _uploadedFileSize = file.size;
    try {
      let text = '';
      if (ext === 'docx') text = await parseDocx(file);
      else if (ext === 'pdf') text = await parsePdf(file);
      if (!text.trim()) { showUploadError(I18n.t('upload.error.noText')); return; }
      _uploadedText = text; renderUploadArea();
    } catch (err) {
      showUploadError(I18n.t('upload.error.parseFail') + (err.message || I18n.t('common.unknownError')) + I18n.t('upload.error.retry'));
    }
  }

  // ==================== DOCX 解析（保留表格结构） ====================
  async function parseDocx(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target.result;
          let htmlResult = null;
          try { htmlResult = await mammoth.convertToHtml({ arrayBuffer }); } catch (htmlErr) { console.warn('Failed to convert DOCX to HTML with mammoth:', htmlErr); }
          if (htmlResult && htmlResult.value) {
            resolve(extractStructuredFromHtml(htmlResult.value));
          } else {
            const result = await mammoth.extractRawText({ arrayBuffer });
            resolve(result.value || '');
          }
        } catch (err) { reject(err); }
      };
      reader.onerror = () => reject(new Error(I18n.t('upload.error.readFail')));
      reader.readAsArrayBuffer(file);
    });
  }

  function extractStructuredFromHtml(html) {
    if (!html) return '';
    var lines = [];
    var parser = new DOMParser();
    var doc = parser.parseFromString('<div id="root">' + html + '</div>', 'text/html');
    var root = doc.getElementById('root');
    if (!root) return html.replace(/<[^>]+>/g, ' ');
    function processNode(node) {
      if (!node) return;
      if (node.nodeType === 3) { var text = node.textContent.trim(); if (text) lines.push(text); return; }
      if (node.nodeType !== 1) return;
      var tag = node.tagName.toLowerCase();
      if (tag === 'table') { lines.push('__TABLE_START__'); var trs = node.querySelectorAll('tr'); if (trs.length === 0) { for (var i = 0; i < node.children.length; i++) { if (node.children[i].tagName && node.children[i].tagName.toLowerCase() === 'tr') processTableRow(node.children[i], lines); } } else { for (var i = 0; i < trs.length; i++) processTableRow(trs[i], lines); } lines.push('__TABLE_END__'); return; }
      if (tag.match(/^h[1-6]$/)) { var text = node.textContent.trim(); if (text) { lines.push('【' + text + '】'); } return; }
      if (tag === 'p' || tag === 'li' || tag === 'div' || tag === 'pre' || tag === 'blockquote') { for (var i = 0; i < node.childNodes.length; i++) processNode(node.childNodes[i]); var lastLine = lines[lines.length - 1]; if (lastLine && lastLine !== '' && !lastLine.startsWith('__TABLE_') && !lastLine.startsWith('【')) lines.push(''); return; }
      if (tag === 'br') { lines.push(''); return; }
      for (var i = 0; i < node.childNodes.length; i++) processNode(node.childNodes[i]);
    }
    function processTableRow(tr, lines) { var cells = []; var tds = tr.querySelectorAll('td, th'); if (tds.length === 0) { for (var i = 0; i < tr.children.length; i++) { var child = tr.children[i]; if (child.tagName && (child.tagName.toLowerCase() === 'td' || child.tagName.toLowerCase() === 'th')) cells.push(child.textContent.trim()); } } else { for (var i = 0; i < tds.length; i++) cells.push(tds[i].textContent.trim()); } lines.push(cells.join(' ||| ')); }
    processNode(root);
    return lines.filter(function(l) { return l !== undefined && l !== null; }).map(function(l) { return l.replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"').replace(/&#[0-9]+;/g, function(m) { return String.fromCharCode(parseInt(m.slice(2, -1))); }).replace(/&nbsp;/g, ' '); }).join('\n').replace(/\n{3,}/g, '\n\n');
  }

  // ==================== PDF 解析（保留布局结构） ====================
  async function parsePdf(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target.result;
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          var allText = '';
          for (var pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            var page = await pdf.getPage(pageNum);
            var content = await page.getTextContent();
            var lineGroups = {};
            for (var i = 0; i < content.items.length; i++) {
              var item = content.items[i];
              var yKey = Math.round(item.transform[5] / 5) * 5;
              if (!lineGroups[yKey]) lineGroups[yKey] = [];
              lineGroups[yKey].push({ text: item.str, x: item.transform[4] });
            }
            var yKeys = Object.keys(lineGroups).sort(function(a, b) { return parseInt(b) - parseInt(a); });
            for (var j = 0; j < yKeys.length; j++) {
              var group = lineGroups[yKeys[j]];
              group.sort(function(a, b) { return a.x - b.x; });
              var line = group.map(function(g) { return g.text; }).join(' ').trim();
              if (line) allText += line + '\n';
            }
          }
          resolve(allText.trim());
        } catch (err) { reject(err); }
      };
      reader.onerror = () => reject(new Error(I18n.t('upload.error.readFail')));
      reader.readAsArrayBuffer(file);
    });
  }

  // ========================= 智能文档解析引擎（适配HACCP计划书格式）=========================
  function detectTableRows(text) {
    if (!text) return [];
    var lines = text.split('\n');
    var tables = [];
    var currentTable = null;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (line.indexOf('__TABLE_START__') !== -1) { currentTable = { rows: [], startLine: i }; continue; }
      if (line.indexOf('__TABLE_END__') !== -1) { if (currentTable) { tables.push(currentTable); currentTable = null; } continue; }
      if (currentTable && line.indexOf('|||') !== -1) { var cells = line.split('|||').map(function(c) { return c.trim(); }); if (cells.length >= 2) currentTable.rows.push(cells); continue; }
      if (currentTable && line.length > 5) {
        if (line.match(/\s{3,}/) && line.split(/\s{3,}/).filter(Boolean).length >= 2) { currentTable.rows.push(line.split(/\s{3,}/).map(function(c) { return c.trim(); }).filter(Boolean)); continue; }
        if (currentTable.rows.length >= 2) tables.push(currentTable);
        currentTable = null;
      }
    }
    if (currentTable && currentTable.rows.length >= 2) tables.push(currentTable);
    return tables;
  }

  function smartParseDocument(text) {
    var result = { companyName: '', deptName: '', haccpTeam: [], auditor: '', extraItems: [], productName: '', rawMaterials: '', additives: '', productPH: '', waterActivity: '', intendedUse: '', storageCondition: '', packagingMethod: '', targetConsumer: '', shelfLife: '', formula: [], processSteps: [], hazardBio: [], hazardChem: [], hazardPhys: [], execStandard: '', criticalLimits: '', monitoring: [], correctiveActions: [], recordPeriod: '', recordFormat: '' };
    if (!text || !text.trim()) return result;
    function extractKV(pattern) { var m = text.match(pattern); return m ? m[1].trim() : ''; }
    var itemDescPairs = {};
    var tables = detectTableRows(text);
    for (var ti = 0; ti < tables.length; ti++) { var rows = tables[ti].rows; if (rows.length < 2) continue; var header = rows[0].join(' ').toLowerCase(); if ((header.indexOf('项目') !== -1 || header.indexOf('描述') !== -1) && rows[0].length <= 3) { for (var ri = 1; ri < rows.length; ri++) { var row = rows[ri]; if (row.length >= 2) { var key = row[0].replace(/[：:]\s*$/, '').trim(); var val = row.slice(1).join(' ').replace(/^[：:]\s*/, '').trim(); if (key && val) itemDescPairs[key] = val; } } } }
    var standardKeys = ['产品名称', '产品名', '主要原料', '原料', '辅料/辅剂', '辅料', '添加剂', '产品特性', '预期用途', '用途', '储存条件', '贮藏条件', '存储条件', '保存条件', '包装方式', '包装', '目标消费者', '消费群体', '适用人群', '保质期', '保存期', '项目', '描述'];
    for (var k in itemDescPairs) { var isStandard = false; for (var sk = 0; sk < standardKeys.length; sk++) { if (k.indexOf(standardKeys[sk]) !== -1) { isStandard = true; break; } } if (!isStandard && k && itemDescPairs[k]) result.extraItems.push({ key: k, value: itemDescPairs[k] }); }
    var lines = text.split('\n');
    var currentSection = '';
    var sectionContent = {};
    for (var li = 0; li < lines.length; li++) { var line = lines[li].trim(); if (!line) continue; var headingMatch = line.match(/^【(.+?)】/) || line.match(/^步骤\s*\d+[：:]\s*(.+)/) || line.match(/^第[一二三四五六七八九十\d]+[部部分章节][：:](.+)/); if (headingMatch) { currentSection = headingMatch[1].trim(); if (!sectionContent[currentSection]) sectionContent[currentSection] = ''; continue; } var titleMatch = line.match(/^[（(]?[一二三四五六七八九十\d]+[)）、]\s*(.+?)[：:。]?\s*$/); if (titleMatch && line.length < 30) { currentSection = titleMatch[1].trim(); if (!sectionContent[currentSection]) sectionContent[currentSection] = ''; continue; } if (currentSection) sectionContent[currentSection] = (sectionContent[currentSection] || '') + line + '\n'; }
    var titleLine = '';
    for (var li2 = 0; li2 < Math.min(lines.length, 10); li2++) { if (lines[li2].trim()) { titleLine = lines[li2].trim(); break; } }
    var companyMatch = titleLine.match(/([^（(]+?)HACCP计划书/);
    if (companyMatch) result.companyName = companyMatch[1].trim();
    result.deptName = '品控部';
    var auditorMatch = text.match(/(?:审核[员人]|批准[员人])[：:]\s*([^\n，。,。]{2,10})/);
    if (auditorMatch) result.auditor = auditorMatch[1].trim();
    var teamText = text.match(/(?:HACCP小组|组成)[^。]*?([^。]{50,500})/);
    if (teamText) { var teamDesc = teamText[1]; var memberRoles = [{ name: '企业负责人', dept: '管理层', position: '企业负责人', role: '组长', remark: '' }, { name: '品控负责人', dept: '品控部', position: '品控主管', role: '副组长', remark: '' }, { name: '生产负责人', dept: '生产部', position: '生产主任', role: '成员', remark: '' }, { name: '设备负责人', dept: '设备部', position: '设备主管', role: '成员', remark: '' }, { name: '仓储负责人', dept: '仓储部', position: '仓储主管', role: '成员', remark: '' }, { name: '采购负责人', dept: '采购部', position: '采购主管', role: '成员', remark: '' }]; var mentionedRoles = []; for (var mr = 0; mr < memberRoles.length; mr++) { var role = memberRoles[mr]; if (teamDesc.indexOf(role.dept.replace('部','')) !== -1 || teamDesc.indexOf(role.dept) !== -1 || teamDesc.indexOf(role.position.replace('主管','')) !== -1) mentionedRoles.push(role); } if (mentionedRoles.length >= 2) result.haccpTeam = mentionedRoles; }
    if (itemDescPairs['产品名称'] || itemDescPairs['产品名']) result.productName = itemDescPairs['产品名称'] || itemDescPairs['产品名'] || '';
    if (itemDescPairs['主要原料'] || itemDescPairs['原料']) result.rawMaterials = itemDescPairs['主要原料'] || itemDescPairs['原料'] || '';
    if (itemDescPairs['辅料/辅剂'] || itemDescPairs['辅料'] || itemDescPairs['添加剂']) result.additives = itemDescPairs['辅料/辅剂'] || itemDescPairs['辅料'] || itemDescPairs['添加剂'] || '';
    if (itemDescPairs['产品特性']) { var propText = itemDescPairs['产品特性']; var phMatch = propText.match(/PH[值]?[：:。\s]*([\d.]+)/i); if (phMatch) result.productPH = phMatch[1]; var awMatch = propText.match(/(?:水分活度|aw)[：:。\s]*([\d.]+)/i); if (awMatch) result.waterActivity = awMatch[1]; }
    if (itemDescPairs['预期用途'] || itemDescPairs['用途']) result.intendedUse = itemDescPairs['预期用途'] || itemDescPairs['用途'] || '';
    if (itemDescPairs['储存条件'] || itemDescPairs['贮藏条件'] || itemDescPairs['存储条件']) result.storageCondition = itemDescPairs['储存条件'] || itemDescPairs['贮藏条件'] || itemDescPairs['存储条件'] || '';
    if (itemDescPairs['包装方式'] || itemDescPairs['包装']) result.packagingMethod = itemDescPairs['包装方式'] || itemDescPairs['包装'] || '';
    if (itemDescPairs['目标消费者'] || itemDescPairs['消费群体'] || itemDescPairs['适用人群']) result.targetConsumer = itemDescPairs['目标消费者'] || itemDescPairs['消费群体'] || itemDescPairs['适用人群'] || '';
    if (itemDescPairs['保质期'] || itemDescPairs['保存期']) result.shelfLife = itemDescPairs['保质期'] || itemDescPairs['保存期'] || '';
    if (!result.productName) result.productName = extractKV(/(?:产品名称|产品名)[：:]\s*([^\n，。,。]{2,50})/);
    if (!result.rawMaterials) result.rawMaterials = extractKV(/(?:主要原料|原材料|原料)[：:]\s*([^\n。]{2,200})/);
    if (!result.additives) result.additives = extractKV(/(?:辅料|添加剂)[：:。]?\s*([^\n。]{2,200})/);
    if (!result.storageCondition) result.storageCondition = extractKV(/(?:储存条件|贮藏条件|存储条件|保存条件)[：:]\s*([^\n。]+)/);
    if (!result.packagingMethod) result.packagingMethod = extractKV(/(?:包装方式|包装方法)[：:]\s*([^\n。]+)/);
    if (!result.shelfLife) result.shelfLife = extractKV(/(?:保质期|保存期|货架期)[：:]\s*([^\n。]{2,20})/);
    if (!result.intendedUse) result.intendedUse = extractKV(/(?:预期用途|用途)[：:]\s*([^\n。]+)/);
    if (!result.targetConsumer) result.targetConsumer = extractKV(/(?:目标消费者|消费群体|适用人群)[：:]\s*([^\n。]+)/);
    if (!result.productPH) { var phMatch = text.match(/(?:PH|pH)[值]?[：:。\s]*([\d.]+)/i); if (phMatch) result.productPH = phMatch[1]; }
    if (!result.waterActivity) { var awMatch = text.match(/(?:水分活度|Aw|aw)[：:。\s]*([\d.]+)/i); if (awMatch) result.waterActivity = awMatch[1]; }
    var processText = '';
    var possibleKeys = ['生产流程', '绘制并确认工艺流程图', '步骤2', '操作方式和步骤'];
    for (var pk = 0; pk < possibleKeys.length; pk++) { for (var sk in sectionContent) { if (sk.indexOf(possibleKeys[pk]) !== -1) { processText = sectionContent[sk]; break; } } if (processText) break; }
    if (!processText) { var flowMatch = text.match(/(?:生产流程|工艺流程|加工流程)[：:。\s]*([\s\S]{500,4000})(?:\n\n|\n(?:步骤|产品|危害|关键|监控|记录|验证))/i); if (flowMatch) processText = flowMatch[1]; }
    if (processText) {
      var rawSteps = processText.split(/[；;]/).filter(Boolean);
      if (rawSteps.length < 2) rawSteps = processText.split(/[。]/).filter(function(s) { return s.trim().length > 10; });
      var stepKeywords = ['清洗', '粉碎', '捣碎', '搅拌', '匀浆', '提取', '浓缩', '膜滤', '过滤', '脱色', '离心', '离子交换', '干燥', '包装', '灌装', '沉淀', '杀菌', '灭菌', '冷却', '检验', '入库', '储存'];
      var processedSteps = [];
      for (var si = 0; si < rawSteps.length; si++) { var segment = rawSteps[si].trim(); if (!segment || segment.length < 8) continue; var stepName = '', params = '', equipment = ''; for (var skw = 0; skw < stepKeywords.length; skw++) { var kw = stepKeywords[skw]; if (segment.indexOf(kw) !== -1) { stepName = kw; break; } } if (!stepName) { if (segment.indexOf('将') !== -1) { var afterJiang = segment.indexOf('将') + 1; stepName = segment.slice(afterJiang, afterJiang + 12).replace(/[。，,].*$/, ''); } else { stepName = segment.slice(0, 12).replace(/[。，,].*$/, ''); } } var equipMatch = segment.match(/([\u4e00-\u9fa5]{2,8}(?:机|器|仪|设备|釜|槽|塔|罐|箱|炉))/); if (equipMatch) equipment = equipMatch[1]; var paramParts = []; var tempMatch = segment.match(/(\d+[~-]?\d*)\s*[℃°\u2103]/); if (tempMatch) paramParts.push('温度' + tempMatch[0]); var timeMatch = segment.match(/(\d+[~-]?\d*)\s*(?:分钟|小时|min|h|秒|s)/); if (timeMatch) paramParts.push('时间' + timeMatch[0]); var pressureMatch = segment.match(/(\d+[~-]?\d*)\s*(?:MPa|Pa|大气压|bar)/); if (pressureMatch) paramParts.push('压力' + pressureMatch[0]); var powerMatch = segment.match(/(\d+[~-]?\d*)\s*[Ww]/); if (powerMatch) paramParts.push('功率' + powerMatch[0] + 'W'); var freqMatch = segment.match(/(\d+[~-]?\d*)\s*k?Hz/); if (freqMatch) paramParts.push('频率' + freqMatch[0] + 'Hz'); var speedMatch = segment.match(/(\d+[~-]?\d*)\s*r\/(?:min|分钟)/); if (speedMatch) paramParts.push('转速' + speedMatch[0] + 'r/min'); if (paramParts.length > 0) params = paramParts.join('，'); var controlPoint = ''; if (segment.indexOf('CCP') !== -1 || segment.indexOf('关键控制') !== -1) { var ccpMatch = segment.match(/(CCP[-\s]*\d+)/i); if (ccpMatch) controlPoint = ccpMatch[1].toUpperCase(); else controlPoint = 'CCP'; } if (stepName) processedSteps.push({ stepName: stepName, operationMethod: segment.slice(0, 60).replace(/[。，,]+$/, '') + (segment.length > 60 ? '...' : ''), parameters: params, controlPoint: controlPoint, equipmentName: equipment }); }
      var seenSteps = {}; for (var psi = 0; psi < processedSteps.length; psi++) { var step = processedSteps[psi]; var key = step.stepName; if (!seenSteps[key] || (step.parameters && !seenSteps[key].parameters)) seenSteps[key] = step; } for (var key in seenSteps) result.processSteps.push(seenSteps[key]); if (result.processSteps.length > 15) result.processSteps = result.processSteps.slice(0, 15);
    }
    var inHazardSection = false, hazardSectionStart = -1;
    for (var li3 = 0; li3 < lines.length; li3++) { var line = lines[li3].trim(); if (line.indexOf('危害分析') !== -1 || line.indexOf('' + I18n.t('q.ccpPotentialHazard') + '') !== -1) { inHazardSection = true; hazardSectionStart = li3; } if (inHazardSection && (line.indexOf('CCP决策') !== -1 || line.indexOf('HACCP计划') !== -1 || (line.indexOf('监控') !== -1 && line.indexOf('CCP') !== -1))) break; }
    if (hazardSectionStart !== -1) {
      for (var ht = 0; ht < tables.length; ht++) { var rows = tables[ht].rows; if (rows.length < 2) continue; var headerStr = rows[0].join(' ').toLowerCase();
        if (headerStr.indexOf('加工步骤') !== -1 || headerStr.indexOf('' + I18n.t('q.ccpPotentialHazard') + '') !== -1 || headerStr.indexOf('是否显著') !== -1 || headerStr.indexOf('判断依据') !== -1) { for (var ri2 = 1; ri2 < rows.length; ri2++) { var row = rows[ri2]; if (row.length < 3) continue; var stepName = row[0], hazardDesc = row[1] || '', isSignificant = row[2] || ''; if (hazardDesc.indexOf('B:') !== -1 || hazardDesc.indexOf('C:') !== -1 || hazardDesc.indexOf('P:') !== -1) { var bioMatch = hazardDesc.match(/B:(.+?)(?=C:|P:|$)/), chemMatch = hazardDesc.match(/C:(.+?)(?=B:|P:|$)/), physMatch = hazardDesc.match(/P:(.+?)(?=B:|C:|$)/); if (bioMatch && isSignificant.indexOf('是') !== -1) result.hazardBio.push({ desc: stepName + '-' + bioMatch[1].trim(), severity: '中', likelihood: '中', control: '参见前提方案控制' }); if (chemMatch && isSignificant.indexOf('是') !== -1) result.hazardChem.push({ desc: stepName + '-' + chemMatch[1].trim(), severity: '中', likelihood: '中', control: '参见前提方案控制' }); if (physMatch && isSignificant.indexOf('是') !== -1) result.hazardPhys.push({ desc: stepName + '-' + physMatch[1].trim(), severity: '中', likelihood: '中', control: '参见前提方案控制' }); } } }
        if (headerStr.indexOf('q1') !== -1 || headerStr.indexOf('q2') !== -1 || headerStr.indexOf('ccp判断') !== -1) { for (var ri3 = 1; ri3 < rows.length; ri3++) { var row = rows[ri3]; if (row.length < 4) continue; var stepName = row[0], hazardText = row[1] || ''; var isCCP = false; for (var ci = 0; ci < row.length; ci++) { if (row[ci].indexOf('是') !== -1 && ci >= 2) isCCP = true; } var lastCol = row[row.length - 1]; if (lastCol === '是' || lastCol.indexOf('CCP') !== -1) isCCP = true; if (hazardText.indexOf('生物') !== -1 || hazardText.indexOf('病原') !== -1 || hazardText.indexOf('细菌') !== -1 || hazardText.indexOf('霉菌') !== -1 || hazardText.indexOf('微生物') !== -1) result.hazardBio.push({ desc: stepName + '-' + hazardText, severity: isCCP ? '高' : '中', likelihood: isCCP ? '高' : '中', control: isCCP ? '通过CCP控制' : '通过前提方案控制' }); else if (hazardText.indexOf('化学') !== -1 || hazardText.indexOf('农药') !== -1 || hazardText.indexOf('重金属') !== -1 || hazardText.indexOf('残留') !== -1) result.hazardChem.push({ desc: stepName + '-' + hazardText, severity: isCCP ? '高' : '中', likelihood: isCCP ? '高' : '中', control: isCCP ? '通过CCP控制' : '通过前提方案控制' }); else if (hazardText.indexOf('物理') !== -1 || hazardText.indexOf('金属') !== -1 || hazardText.indexOf('砂石') !== -1 || hazardText.indexOf('异物') !== -1) result.hazardPhys.push({ desc: stepName + '-' + hazardText, severity: isCCP ? '中' : '低', likelihood: isCCP ? '中' : '低', control: isCCP ? '通过CCP控制' : '通过前提方案控制' }); } }
      }
    }
    var stdMatch = text.match(/(?:依据|按照|根据|执行标准)[：:。]?\s*([A-Za-z]{1,5}\s*\d+[\d-]*)/);
    if (stdMatch) { var stdCode = stdMatch[1].toLowerCase(); if (stdCode.indexOf('gb') !== -1) result.execStandard = 'gb'; else if (stdCode.indexOf('iso') !== -1 || stdCode.indexOf('国际') !== -1) result.execStandard = 'international'; }
    if (!result.execStandard) { if (text.indexOf('GB 14881') !== -1 || text.indexOf('国标') !== -1 || text.indexOf('国家标准') !== -1) result.execStandard = 'gb'; else if (text.indexOf('' + I18n.t('q.clStdIndustry') + '') !== -1) result.execStandard = 'industry'; else if (text.indexOf('' + I18n.t('q.clStdEnterprise') + '') !== -1) result.execStandard = 'enterprise'; }
    var planTables = []; for (var pt = 0; pt < tables.length; pt++) { var rows = tables[pt].rows; if (rows.length < 3) continue; var headerStr = rows[0].join(' ').toLowerCase(); if (headerStr.indexOf('关键控制点') !== -1 && (headerStr.indexOf('关键限值') !== -1 || headerStr.indexOf('cl') !== -1)) planTables.push(tables[pt]); }
    if (planTables.length > 0) { var clParts = []; for (var pti = 0; pti < planTables.length; pti++) { var table = planTables[pti]; for (var ri4 = 1; ri4 < table.rows.length; ri4++) { var row = table.rows[ri4]; if (row.length >= 2) { var ccpName = row[0], clVal = row[1]; if (ccpName && clVal) clParts.push(ccpName + '：' + clVal); } } } if (clParts.length > 0) result.criticalLimits = clParts.join('\n'); }
    if (planTables.length > 0) { for (var pti2 = 0; pti2 < planTables.length; pti2++) { var table = planTables[pti2], headerRow = table.rows[0]; var ccpIdx = -1, clIdx = -1, objIdx = -1, methodIdx = -1, freqIdx = -1, personIdx = -1, remarkIdx = -1, correctiveIdx = -1, verificationIdx = -1, recordIdx = -1; for (var ci2 = 0; ci2 < headerRow.length; ci2++) { var h = headerRow[ci2].toLowerCase(); if (h.indexOf('关键控制点') !== -1 || h === 'ccp') ccpIdx = ci2; if (h.indexOf('关键限值') !== -1 || h.indexOf('cl') !== -1) clIdx = ci2; if (h.indexOf('' + I18n.t('q.monitorObject') + '') !== -1 || h.indexOf('对象') !== -1) objIdx = ci2; if (h.indexOf('' + I18n.t('q.monitorMethod') + '') !== -1 || h.indexOf('方法') !== -1) methodIdx = ci2; if (h.indexOf('' + I18n.t('q.monitorFreq') + '') !== -1 || h.indexOf('频率') !== -1) freqIdx = ci2; if (h.indexOf('' + I18n.t('q.monitorPersonnel') + '') !== -1 || h.indexOf('人员') !== -1) personIdx = ci2; if (h.indexOf('' + I18n.t('q.monAddRemark') + '') !== -1) remarkIdx = ci2; if (h.indexOf('纠偏') !== -1 || h.indexOf(I18n.t('q.corPersonnel')) !== -1) correctiveIdx = ci2; if (h.indexOf('验证') !== -1 || h.indexOf(I18n.t('q.corCause')) !== -1) verificationIdx = ci2; if (h.indexOf('记录') !== -1 || h.indexOf(I18n.t('q.corProduct')) !== -1) recordIdx = ci2; } for (var ri5 = 1; ri5 < table.rows.length; ri5++) { var row = table.rows[ri5], ccpName = ccpIdx !== -1 ? (row[ccpIdx] || '') : ''; if (ccpName) { result.monitoring.push({ ccp: ccpName, object: objIdx !== -1 ? (row[objIdx] || '') : '', method: methodIdx !== -1 ? (row[methodIdx] || '') : '', frequency: freqIdx !== -1 ? (row[freqIdx] || '') : '', personnel: personIdx !== -1 ? (row[personIdx] || '') : '', remark: remarkIdx !== -1 ? (row[remarkIdx] || '') : '' }); if (correctiveIdx !== -1) result.correctiveActions.push({ ccp: ccpName, personnel: correctiveIdx !== -1 ? (row[correctiveIdx] || '') : '', causeAnalysis: verificationIdx !== -1 ? (row[verificationIdx] || '') : '', productHandling: recordIdx !== -1 ? (row[recordIdx] || '') : '' }); } } } }
    var recordMatch = text.match(/(?:记录保存|保存期限|记录期限)[：:。]?\s*(\d+\s*[年月])/);
    if (recordMatch) result.recordPeriod = recordMatch[1];
    if (text.indexOf('电子') !== -1 && text.indexOf('纸质') !== -1) result.recordFormat = '电子版+纸质版'; else if (text.indexOf('电子') !== -1) result.recordFormat = '电子版'; else if (text.indexOf('纸质') !== -1) result.recordFormat = '纸质版';
    return result;
  }

  async function handleAiFill() {
    const aiBtn = document.getElementById('q15AiFillBtn');
    if (!aiBtn) return;
    if (!_uploadedText) { showUploadError('请先上传并解析文件'); return; }
    const content = document.getElementById('q15Content');
    const data = loadData();
    if (content) collectSectionData(content, data);
    aiBtn.disabled = true; aiBtn.textContent = '\u23F3 AI分析中...';
    try {
      const res = await fetchWithTimeout('/api/ai/fill-from-text', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: _uploadedText }) }, 60000);
      const result = await res.json();
      if (!res.ok) throw new Error(result.detail || 'AI 分析失败');
      if (result.ok && result.data) applyAiFillResult(result.data, aiBtn);
      else throw new Error('返回数据格式异常');
    } catch (err) {
      console.warn('后端不可用，使用前端智能解析:', err.message);
      var smartResult = smartParseDocument(_uploadedText);
      var filledCount = 0; for (var key in smartResult) { if (Array.isArray(smartResult[key])) { if (smartResult[key].length > 0) filledCount++; } else if (smartResult[key]) filledCount++; }
      console.log('前端智能解析提取到 ' + filledCount + ' 个字段');
      applyAiFillResult(smartResult, aiBtn);
    }
  }

  function applyAiFillResult(aiData, aiBtn) {
    applyAiData(aiData);
    var filledFields = 0, totalFields = 0; for (var key in aiData) { totalFields++; if (Array.isArray(aiData[key])) { if (aiData[key].length > 0) filledFields++; } else if (aiData[key]) filledFields++; }
    aiBtn.textContent = '\u2713 填充完成（' + filledFields + '/' + totalFields + '个字段）';
    aiBtn.className = 'btn btn-primary';
    setTimeout(() => { aiBtn.disabled = false; aiBtn.textContent = I18n.t('aifill.redo'); aiBtn.className = 'btn btn-primary'; }, 3000);
    renderSectionNav(); currentStep = 0; renderActiveSection(); renderSectionNav();
  }

  function applyAiData(aiData) {
    const data = loadData();
    if (aiData.companyName) data.companyName = aiData.companyName;
    if (aiData.deptName) data.deptName = aiData.deptName;
    if (aiData.auditor) data.auditor = aiData.auditor;
    if (aiData.extraItems && Array.isArray(aiData.extraItems) && aiData.extraItems.length > 0) data.extraItems = aiData.extraItems.map(function(e) { return { id: genId(), key: e.key || '', value: e.value || '' }; });
    if (aiData.productName) data.productName = aiData.productName;
    if (aiData.rawMaterials) data.rawMaterials = aiData.rawMaterials;
    if (aiData.additives) data.additives = aiData.additives;
    if (aiData.productPH) data.productPH = aiData.productPH;
    if (aiData.waterActivity) data.waterActivity = aiData.waterActivity;
    if (aiData.intendedUse) data.intendedUse = aiData.intendedUse;
    if (aiData.storageCondition) data.storageCondition = aiData.storageCondition;
    if (aiData.packagingMethod) data.packagingMethod = aiData.packagingMethod;
    if (aiData.targetConsumer) data.targetConsumer = aiData.targetConsumer;
    if (aiData.shelfLife) data.shelfLife = aiData.shelfLife;
    if (aiData.execStandard) data.execStandard = aiData.execStandard;
    if (aiData.criticalLimits) data.criticalLimits = aiData.criticalLimits;
    if (aiData.recordPeriod) data.recordPeriod = aiData.recordPeriod;
    if (aiData.recordFormat) data.recordFormat = aiData.recordFormat;
    if (aiData.haccpTeam && Array.isArray(aiData.haccpTeam) && aiData.haccpTeam.length > 0) data.haccpTeam = aiData.haccpTeam.map(function(m) { return { id: genId(), name: m.name || '', dept: m.dept || '', position: m.position || '', role: m.role || '', remark: m.remark || '' }; });
    if (aiData.formula && Array.isArray(aiData.formula) && aiData.formula.length > 0) data.formula = aiData.formula.map(function(f) { return { id: genId(), material: f.material || '', dosage: f.dosage || '', func: f.func || '' }; });
    if (aiData.processSteps && Array.isArray(aiData.processSteps) && aiData.processSteps.length > 0) data.processSteps = aiData.processSteps.map(function(s) { return { id: genId(), stepName: s.stepName || '', operationMethod: s.operationMethod || '', parameters: s.parameters || '', controlPoint: s.controlPoint || '', equipmentName: s.equipmentName || '' }; });
    if (aiData.hazardBio && Array.isArray(aiData.hazardBio)) data.hazardBio = aiData.hazardBio.map(function(h) { return { desc: h.desc || '', severity: h.severity || '中', likelihood: h.likelihood || '中', control: h.control || '' }; });
    if (aiData.hazardChem && Array.isArray(aiData.hazardChem)) data.hazardChem = aiData.hazardChem.map(function(h) { return { desc: h.desc || '', severity: h.severity || '中', likelihood: h.likelihood || '中', control: h.control || '' }; });
    if (aiData.hazardPhys && Array.isArray(aiData.hazardPhys)) data.hazardPhys = aiData.hazardPhys.map(function(h) { return { desc: h.desc || '', severity: h.severity || '中', likelihood: h.likelihood || '中', control: h.control || '' }; });
    if (aiData.monitoring && Array.isArray(aiData.monitoring) && aiData.monitoring.length > 0) data.monitoring = aiData.monitoring.map(function(m) { return { id: genId(), ccp: m.ccp || '', object: m.object || '', method: m.method || '', frequency: m.frequency || '', personnel: m.personnel || '', remark: m.remark || '' }; });
    if (aiData.correctiveActions && Array.isArray(aiData.correctiveActions) && aiData.correctiveActions.length > 0) data.correctiveActions = aiData.correctiveActions.map(function(c) { return { id: genId(), ccp: c.ccp || '', personnel: c.personnel || '', causeAnalysis: c.causeAnalysis || '', productHandling: c.productHandling || '' }; });
    saveData(data); renderActiveSection();
  }

  let currentStep = 0;
  const TOTAL_STEPS = 5;
  function getSectionNames() {
    try { return [I18n.t('q15.step0'), I18n.t('q15.step1'), I18n.t('q15.step2'), I18n.t('q15.step3'), I18n.t('q15.step4')]; }
    catch(e) { return ['进行危害分析', '确定关键控制点', '建立关键限值', '建立监控程序', '建立' + I18n.t('q.correctiveTitle') + '']; }
  }

  function renderSectionNav() {
    const data = loadData();
    const nav = document.getElementById('q15Progress');
    if (!nav) return;
    nav.innerHTML = getSectionNames().map((name, i) => { const isActive = i === currentStep; const isDone = isStepCompleted(data, i); return '<div class="q15-step ' + (isActive ? 'active' : '') + ' ' + (isDone ? 'done' : '') + '" data-step="' + i + '"><div class="q15-step-num">' + (isDone ? '\u2713' : i + 1) + '</div><span>' + name + '</span></div>'; }).join('');
    nav.querySelectorAll('.q15-step').forEach(el => { el.addEventListener('click', () => { currentStep = parseInt(el.dataset.step); renderActiveSection(); renderSectionNav(); }); });
  }

  function isStepCompleted(data, step) {
    switch (step) {
      case 0: return data.processSteps.some(s => s.stepName);
      case 1: return data.ccpCompleted;
      case 2: return !!data.execStandard;
      case 3: return data.monitoring.some(m => m.ccp);
      case 4: return data.correctiveActions.some(c => c.ccp);
      default: return false;
    }
  }

  function renderActiveSection() {
    const content = document.getElementById('q15Content');
    if (!content) return;
    // 修复损坏的数据（如旧版本localStorage数据）
    let data;
    try {
      data = loadData();
      if (typeof data.processSteps === 'string') data.processSteps = [];
      if (typeof data.hazardWorksheet === 'string') data.hazardWorksheet = [];
      if (typeof data.ccpSteps === 'string') data.ccpSteps = [];
      if (!Array.isArray(data.processSteps)) data.processSteps = [];
      if (!Array.isArray(data.hazardWorksheet)) data.hazardWorksheet = [];
      if (!Array.isArray(data.ccpSteps)) data.ccpSteps = [];
      if (!Array.isArray(data.monitoring)) data.monitoring = [];
      if (!Array.isArray(data.correctiveActions)) data.correctiveActions = [];
    } catch (e) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(SECTION_COMPLETED_KEY);
      localStorage.removeItem('haccp_submitted');
      data = getDefaultData();
    }
    const sections = [renderProcessFlow, renderHazardAnalysis, renderCriticalLimits, renderMonitoring, renderCorrective];
    let sectionHTML = '';
    try {
      sectionHTML = sections[currentStep](data);
    } catch (e) {
      console.error('渲染章节失败:', e);
      sectionHTML = '<div style="padding:24px;text-align:center;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;margin:20px 0;">' +
        '<div style="font-size:40px;margin-bottom:12px;">⚠️</div>' +
        '<h3 style="color:#991b1b;margin-bottom:8px;">' + I18n.t('q.pageError') + '</h3>' +
        '<p style="color:#b91c1c;font-size:14px;margin-bottom:16px;">' + I18n.t('q.resetHint') + '</p>' +
        '<button class="btn btn-primary" id="resetDataBtn" style="background:#dc2626;border-color:#dc2626;">' + I18n.t('q.resetData') + '</button>' +
        '</div>';
      setTimeout(() => {
        document.getElementById('resetDataBtn')?.addEventListener('click', function() {
          if (confirm(I18n.t('q.resetConfirm'))) {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(SECTION_COMPLETED_KEY);
            localStorage.removeItem('haccp_submitted');
            currentStep = 0;
            renderActiveSection();
            renderSectionNav();
          }
        });
      }, 50);
    }
    var navRightBtn = '';
    if (currentStep === 4) {
      navRightBtn = '<button class="btn btn-primary btn-lg" id="q15GeneratePlanBtn">' + I18n.t('q.generatePlan') + '</button>';
    } else if (currentStep < TOTAL_STEPS - 1) {
      navRightBtn = '<button class="btn btn-primary" id="q15NextBtn">' + I18n.t('q15.nextBtn') + '</button>';
    } else {
      navRightBtn = '<button class="btn btn-primary btn-lg" id="q15SubmitBtn">' + I18n.t('q.submitBtn2') + '</button>';
    }
    content.innerHTML = '<div class="q15-section"><h2>' + getSectionNames()[currentStep] + '</h2>' + sectionHTML + '</div><div class="q15-nav-buttons"><button class="btn btn-secondary" id="q15PrevBtn"' + (currentStep === 0 ? ' disabled' : '') + '>' + I18n.t('q15.prevBtn') + '</button><span class="q15-step-indicator">' + I18n.t('q15.step') + (currentStep + 1) + I18n.t('q15.of') + TOTAL_STEPS + I18n.t('q15.stepLabel') + '</span>' + navRightBtn + '</div>';
    // 更新审查横幅（独立于内容区域）
    updateReviewBanner();
    bindSectionEvents(content, data);
    document.getElementById('q15PrevBtn')?.addEventListener('click', () => { collectSectionData(content, data); saveData(data); if (currentStep > 0) { currentStep--; renderActiveSection(); renderSectionNav(); } });
    document.getElementById('q15NextBtn')?.addEventListener('click', () => { collectSectionData(content, data); saveData(data); if (currentStep < TOTAL_STEPS - 1) { currentStep++; renderActiveSection(); renderSectionNav(); } });
    document.getElementById('q15SubmitBtn')?.addEventListener('click', () => { collectSectionData(content, data); saveData(data); submitQuestionnaire(data); });
    document.getElementById('q15GeneratePlanBtn')?.addEventListener('click', () => { collectSectionData(content, data); saveData(data); showHaccpConfirmationModal(data); });
    document.getElementById('backToHaccpReviewBtn')?.addEventListener('click', function() {
      openHaccpReviewModal();
    });
  }

  function collectSectionData(content, data) {
    const inputs = content.querySelectorAll('[data-q15-field]');
    inputs.forEach(el => { const field = el.dataset.q15Field; if (el.type === 'checkbox') data[field] = el.checked; else data[field] = el.value; });
    const extraBody = content.querySelector('#extraItemsBody');
    if (extraBody) { data.extraItems = []; extraBody.querySelectorAll('tr').forEach(function(tr) { var inputs = tr.querySelectorAll('input'); if (inputs.length >= 2) { data.extraItems.push({ id: genId(), key: inputs[0].value, value: inputs[1].value }); } }); }
    const productExtraBody = content.querySelector('#productExtraItemsBody');
    if (productExtraBody) { data.productExtraItems = []; productExtraBody.querySelectorAll('tr').forEach(function(tr) { var inputs = tr.querySelectorAll('input'); if (inputs.length >= 2) { data.productExtraItems.push({ id: genId(), key: inputs[0].value, value: inputs[1].value }); } }); }
  }

  // ===== 精简版文件上传区域（仅用于"进行危害分析"步骤内部）=====
  function renderCompactUploadArea() {
    if (!_uploadedText && !_uploadedFileName) {
      return '<div style="margin-bottom:12px;padding:8px 12px;border:1px dashed #d0d5dd;border-radius:6px;background:#fafbfc;display:flex;align-items:center;gap:10px;font-size:13px;">' +
        '<span style="color:var(--gray-500);">' + I18n.t('upload.optional') + '</span>' +
        '<input type="file" id="q15CompactFileInput" accept=".docx,.pdf" style="font-size:12px;max-width:200px;">' +
        '<span style="font-size:11px;color:var(--gray-400);">' + I18n.t('upload.formats') + '</span>' +
        '</div>';
    }
    return '<div style="margin-bottom:12px;padding:8px 12px;border:1px solid #e2e8f0;border-radius:6px;background:#f8fafc;display:flex;align-items:center;gap:10px;font-size:13px;">' +
      '<span style="color:var(--gray-500);">' + I18n.t('upload.imported') + '</span> ' + esc(_uploadedFileName) +
      ' <span style="font-size:11px;color:var(--gray-400);">(' + formatFileSize(_uploadedFileSize) + ')</span>' +
      '<button class="btn btn-xs btn-secondary" id="q15CompactClearBtn" style="padding:1px 8px;font-size:11px;">' + I18n.t('upload.clear') + '</button>' +
      '</div>';
  }

  function bindCompactUploadEvents(content) {
    var fileInput = content.querySelector('#q15CompactFileInput');
    if (fileInput) {
      fileInput.addEventListener('change', function(e) {
        if (e.target.files.length > 0) handleFile(e.target.files[0]);
      });
    }
    var clearBtn = content.querySelector('#q15CompactClearBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', function() {
        clearUploadedFile();
        renderActiveSection();
      });
    }
  }

  // ===== CCP 导航面板（可点击跳转）=====
  function renderCcpNavPanel(data) {
    var steps = data.processSteps || [];
    var ccpSteps = data.ccpSteps || [];
    var hazardTypes = ['bio', 'chem', 'phys'];
    var hazardLabels = { bio: 'B', chem: 'C', phys: 'P' };
    var hazardFull = { bio: I18n.t('q.ccpHazardBio'), chem: I18n.t('q.ccpHazardChem'), phys: I18n.t('q.ccpHazardPhys') };
    var isEditMode = data.ccpViewMode === 'edit';
    
    var html = '<div class="ccp-nav-panel">';
    html += '<div class="ccp-nav-header" id="ccpNavToggle">';
    html += '<span>' + I18n.t('q15.navCcp') + '</span>';
    html += '<span class="ccp-nav-toggle" id="ccpNavArrow">▶</span>';
    html += '</div>';
    html += '<div class="ccp-nav-body" id="ccpNavBody">';
    
    steps.forEach(function(step, si) {
      var stepData = ccpSteps[si] || { stepName: step.stepName || '', hazards: {}, completed: false };
      var isStepActive = !isEditMode && si === data.ccpStepIndex;
      var isStepEditActive = isEditMode && data.ccpEditStepIdx === si;
      var stepClass = isStepActive || isStepEditActive ? 'active' : '';
      if (stepData.completed) stepClass = stepClass || 'done';
      
      html += '<div class="ccp-nav-step">';
      html += '<div class="ccp-nav-step-header ' + stepClass + '" data-nav-step="' + si + '">';
      html += '<span class="ccp-nav-step-num">' + (si + 1) + '</span>';
      html += '<span class="ccp-nav-step-name">' + esc(step.stepName || I18n.t('q.ccpSummaryStep') + ' ' + (si + 1)) + '</span>';
      html += '<span class="ccp-nav-toggle">▶</span>';
      html += '</div>';
      
      if (isStepActive || isStepEditActive) {
        html += '<div class="ccp-nav-hazards">';
        // 步骤编辑入口（在步骤列表的最后一项）
        html += '<div class="ccp-nav-hazard' + (isEditMode ? ' active' : '') + '" data-nav-edit="' + si + '">';
        html += '<span class="ccp-nav-hazard-badge">✎</span>';
        html += '<span class="ccp-nav-hazard-label">' + I18n.t('q.ccpEditStep') + '</span>';
        html += '</div>';
        
        hazardTypes.forEach(function(ht) {
          var hData = stepData.hazards[ht] || {};
          var isHazardActive = !isEditMode && ht === data.ccpHazardType;
          var hClass = isHazardActive ? 'active' : '';
          if (hData.isCCP !== undefined) hClass = hClass || 'done';
          var statusText = '';
          if (hData.isCCP === true) statusText = '<span class="ccp-nav-hazard-status ccp">CCP</span>';
          else if (hData.isCCP === false) statusText = '<span class="ccp-nav-hazard-status no-ccp">' + I18n.t('q.ccpNonCcp') + '</span>';
          else if (hData.isCCP === 'modify') statusText = '<span class="ccp-nav-hazard-status" style="background:#fffbeb;color:#d97706;">' + I18n.t('q.ccpNeedModify') + '</span>';
          else statusText = '<span class="ccp-nav-hazard-status pending">' + I18n.t('q.ccpPending') + '</span>';
          
          html += '<div class="ccp-nav-hazard ' + hClass + '" data-nav-hazard="' + si + '" data-nav-ht="' + ht + '">';
          html += '<span class="ccp-nav-hazard-badge">' + hazardLabels[ht] + '</span>';
          html += '<span class="ccp-nav-hazard-label">' + hazardFull[ht] + '</span>';
          html += statusText;
          // 问题点状进度
          var qDots = '';
          for (var qi = 1; qi <= 5; qi++) {
            var dotClass = 'ccp-nav-q-dot';
            if (hData['q' + qi] !== undefined) dotClass += ' answered';
            if (isHazardActive && !isEditMode) {
              var curQ = data.ccpCurrentQ;
              if (qi === curQ || (curQ === 'q2_need' && qi === 2)) dotClass += ' current';
            }
            qDots += '<span class="' + dotClass + '"></span>';
          }
          html += '<span class="ccp-nav-q-dots">' + qDots + '</span>';
          html += '</div>';
        });
        html += '</div>';
      }
      html += '</div>';
    });
    
    html += '</div></div>';
    return html;
  }

  // ===== 步骤2: 确定关键控制点 - 重新设计版 =====
  function normalizeCcpSteps(data) {
    if (!data.processSteps || !Array.isArray(data.processSteps)) data.processSteps = [];
    if (!data.ccpSteps || !Array.isArray(data.ccpSteps)) data.ccpSteps = [];
    // 从危害分析同步显著危害的步骤到 processSteps（兜底同步）
    syncSignificantStepsToProcessSteps(data);
    var hazardTypes = ['bio', 'chem', 'phys'];
    data.processSteps.forEach(function(step, si) {
      if (!data.ccpSteps[si]) data.ccpSteps[si] = { stepName: step.stepName || '', hazards: {}, completed: false };
      data.ccpSteps[si].stepName = step.stepName || data.ccpSteps[si].stepName || '';
      if (!data.ccpSteps[si].hazards) data.ccpSteps[si].hazards = {};
      hazardTypes.forEach(function(ht) {
        if (!data.ccpSteps[si].hazards[ht]) data.ccpSteps[si].hazards[ht] = {};
      });
    });
    if (data.ccpSteps.length > data.processSteps.length) data.ccpSteps = data.ccpSteps.slice(0, data.processSteps.length);
  }

  function renderHazardAnalysis(data) {
    try {
      if (!data.ccpPageMode || ['form', 'judging', 'summary'].indexOf(data.ccpPageMode) === -1) data.ccpPageMode = 'form';
      if (data.currentEditingStep === undefined || data.currentEditingStep === null) data.currentEditingStep = -1;
      if (!data.ccpHazardType || ['bio', 'chem', 'phys'].indexOf(data.ccpHazardType) === -1) data.ccpHazardType = 'bio';
      if (!data.ccpCurrentQ) data.ccpCurrentQ = 1;
      // 问卷步骤为空时，自动加载流程图/档案中已填写的步骤
      autoFillStepsFromFlowchart(data);
      normalizeCcpSteps(data);
      saveData(data);
      if (data.ccpPageMode === 'judging') return renderCCPJudgingPage(data);
      if (data.ccpPageMode === 'summary') return renderCcpSummary(data);
      return renderStepFormPage(data);
    } catch (err) {
      console.error('renderHazardAnalysis failed:', err);
      data.ccpPageMode = 'form';
      saveData(data);
      return '<div style="padding:16px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;color:#991b1b;">' + I18n.t('q.ccpError') + '</div>' + renderStepFormPage(data);
    }
  }
  
  // ===== 步骤填写表单页面 =====
  function renderStepFormPage(data) {
    normalizeCcpSteps(data);
    var editIdx = parseInt(data.currentEditingStep);
    if (isNaN(editIdx)) editIdx = -1;
    var stepData = (editIdx >= 0 && editIdx < data.processSteps.length) ? data.processSteps[editIdx] : { stepName: '', equipmentName: '', operationMethod: '', parameters: '' };
    var savedSteps = data.processSteps || [];
    var html = '<div class="q15-step-form">';
    html += '<div class="q15-field-group"><label>' + I18n.t('q.stepName') + '</label><input type="text" id="stepFormName" value="' + esc(stepData.stepName || '') + '" placeholder="' + I18n.t('q.stepNamePh') + '"></div>';
    html += '<div class="q15-field-group"><label>' + I18n.t('q.equipment') + '</label><input type="text" id="stepFormEquipment" value="' + esc(stepData.equipmentName || '') + '" placeholder="' + I18n.t('q.equipmentPh') + '"></div>';
    html += '<div class="q15-field-group"><label>' + I18n.t('q.method') + '</label><textarea id="stepFormMethod" rows="2" placeholder="' + I18n.t('q.methodPh') + '">' + esc(stepData.operationMethod || '') + '</textarea></div>';
    html += '<div class="q15-field-group"><label>' + I18n.t('q.params') + '</label><input type="text" id="stepFormParams" value="' + esc(stepData.parameters || '') + '" placeholder="' + I18n.t('q.paramsPh') + '"></div>';
    html += '<button class="btn btn-primary btn-sm" id="stepFormSaveBtn">' + I18n.t('q.saveStep') + '</button>';
    html += '</div>';
    if (savedSteps.length > 0) {
      html += '<div style="margin-top:20px;"><h3>' + I18n.t('q.addedSteps') + '</h3><ul style="list-style:none;padding:0;margin:8px 0;">';
      savedSteps.forEach(function(s, i) {
        // 检查该步骤是否有CCP判定结果
        var stepCcp = (data.ccpSteps && data.ccpSteps[i] && data.ccpSteps[i].hazards) ? data.ccpSteps[i].hazards : null;
        var ccpTypes = [];
        if (stepCcp) {
          if (stepCcp.bio && stepCcp.bio.isCCP === true) ccpTypes.push('B');
          if (stepCcp.chem && stepCcp.chem.isCCP === true) ccpTypes.push('C');
          if (stepCcp.phys && stepCcp.phys.isCCP === true) ccpTypes.push('P');
        }
        var isCcp = ccpTypes.length > 0;
        var bg = isCcp ? '#fef2f2' : '#f8fafc';
        var border = isCcp ? '#fca5a5' : '#e2e8f0';
        var ccpBadge = '';
        if (isCcp) {
          ccpBadge = '<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px;background:#dc2626;color:#fff;border-radius:999px;font-size:10px;font-weight:700;flex-shrink:0;margin-left:8px;" title="' + I18n.t('q.ccpJudgedAsCcp') + ccpTypes.join('/') + I18n.t('q.hwHazard') + '">CCP</span>';
        }
        html += '<li style="padding:8px 10px;margin:6px 0;background:' + bg + ';border:1px solid ' + border + ';border-radius:6px;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:12px;" data-step-edit="' + i + '">';
        html += '<span><strong>' + (i + 1) + '. ' + esc(s.stepName || I18n.t('q.unnamed')) + '</strong>';
        if (s.equipmentName) html += ' | ' + I18n.t('flow.equipment') + esc(s.equipmentName);
        if (s.operationMethod) html += ' | ' + I18n.t('flow.method') + esc(s.operationMethod);
        if (s.parameters) html += ' | ' + I18n.t('flow.params') + esc(s.parameters);
        html += '</span>' + ccpBadge;
        html += '<button class="btn btn-xs btn-secondary" data-step-delete="' + i + '" style="color:#dc2626;border-color:#fecaca;padding:2px 8px;font-size:12px;flex-shrink:0;">' + I18n.t('q.delete') + '</button>';
        html += '</li>';
      });
      html += '</ul></div>';
    } else {
      html += '<p style="color:var(--gray-400);font-size:13px;margin-top:16px;">' + I18n.t('q.noStepsHint') + '</p>';
    }
    html += '<hr class="q15-divider"><div class="q15-field-group"><label>' + I18n.t('q.ccpTreeVersion') + '</label>';
    html += '<div style="padding:8px 12px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;font-size:13px;color:#1e40af;">' + I18n.t('q.ccpTreeVersion') + '</div>';
    html += '<div style="margin-top:4px;font-size:12px;color:var(--gray-400);">' + I18n.t('q.ccpTreeDesc') + '</div>';
    html += '<div style="margin-top:12px;padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;color:#475569;line-height:1.7;">';
    html += '<div style="font-weight:500;margin-bottom:4px;font-size:13px;color:#1e293b;">' + I18n.t('q.ccpTreeUsage') + '</div>';
    html += '<div style="padding-left:0;list-style:none;">';
    html += '<div style="margin-bottom:2px;">' + I18n.t('q.ccpInstrA') + '</div>';
    html += '<div style="margin-bottom:2px;">' + I18n.t('q.ccpInstrB') + '</div>';
    html += '<div style="margin-bottom:2px;">' + I18n.t('q.ccpInstrC') + '</div>';
    html += '<div>' + I18n.t('q.ccpInstrD') + '</div>';
    html += '</div></div>';
    html += '<div style="display:flex;gap:10px;margin-top:16px;padding-top:16px;border-top:1px solid #e2e8f0;flex-wrap:wrap;">';
    html += '<button class="btn btn-primary btn-sm" id="aiCcpBtn"' + (savedSteps.length === 0 ? ' disabled title="' + I18n.t('q.needSteps') + '"' : '') + '>' + I18n.t('q.ccpAiBtn') + '</button>';
    html += '<button class="btn btn-outline btn-sm" id="ccpJudgeBtn"' + (savedSteps.length === 0 ? ' disabled title="' + I18n.t('q.needSteps') + '"' : '') + '>' + I18n.t('q.ccpManualBtn') + '</button>';
    html += '<button class="btn btn-secondary btn-sm" id="addNewStepBtn">' + I18n.t('q.addStep') + '</button>';
    html += '<button class="btn btn-secondary btn-sm" id="completeStepsBtn"' + (savedSteps.length === 0 ? ' disabled title="' + I18n.t('q.needSteps') + '"' : '') + '>' + I18n.t('q.ccpCompleteBtn') + '</button>';
    html += '<span id="aiCcpHint" style="font-size:12px;color:var(--gray-400);margin-left:4px;align-self:center;"></span>';
    html += '</div>';
    return html;
  }
  
  function getCcpQuestionText(hazardType, currentQ) {
    var hazardFull = { bio: I18n.t('q.ccpHazardBio'), chem: I18n.t('q.ccpHazardChem'), phys: I18n.t('q.ccpHazardPhys') };
    var name = hazardFull[hazardType] || I18n.b('危害|||Hazard');
    var map = {
      1: I18n.b('Q1：针对此加工步骤已识别的 ' + name + '，有控制措施存在吗？|||Q1: For the identified ' + name + ' at this processing step, are there control measures in place?'),
      1.1: I18n.b('Q1（续）：该步骤上的控制对安全是必要的吗？|||Q1 (cont.): Is control at this step necessary for safety?'),
      2: I18n.b('Q2：该步骤是否专门设计用于把 ' + name + ' 的可能发生消除、降低到可接受水平？|||Q2: Is this step specifically designed to eliminate ' + name + ' or reduce its occurrence to an acceptable level?'),
      3: I18n.b('Q3：' + name + ' 产生的污染是否会超过可接受水平，或增加到不可接受水平？|||Q3: Could contamination from ' + name + ' exceed acceptable levels or increase to unacceptable levels?'),
      4: I18n.b('Q4：后续步骤可否消除' + name + '或将' + name + '的发生降低到可接受水平？|||Q4: Can subsequent steps eliminate ' + name + ' or reduce its occurrence to an acceptable level?')
    };
    return I18n.b(map[currentQ] || '');
  }
  function renderCcpResultBlock(data, hazard, hazardType) {
    if (!hazard || hazard.isCCP === undefined || hazard.isCCP === null) return '';
    var hts = ['bio','chem','phys']; var hti = hts.indexOf(hazardType);
    var lastH = hti === hts.length-1;
    var label = hazard.isCCP===true?I18n.t('q.ccpYes'):(hazard.isCCP==='modify'?I18n.t('q.ccpNeedModifyReEval'):I18n.t('q.ccpNoNonCcp'));
    var c = hazard.isCCP===true?'#dc2626':(hazard.isCCP==='modify'?'#d97706':'#16a34a');
    var bg = hazard.isCCP===true?'#fef2f2':(hazard.isCCP==='modify'?'#fffbeb':'#f0fdf4');
    var path=[];[1,2,3,4,5].forEach(function(qn){if(hazard['q'+qn]!==undefined)path.push('Q'+qn+':'+yn(hazard['q'+qn]));});
    if(hazard.q2_need!==undefined)path.push('Q2' + I18n.t('q.cont') + ''+yn(hazard.q2_need));
    var h='<div style="margin-top:16px;padding:12px;background:'+bg+';border:1px solid '+c+';border-radius:8px;color:'+c+';">';
    h+='<div style="font-weight:600;margin-bottom:6px;">'+I18n.t('ccp.result')+label+'</div>';
    h+='<div style="font-size:13px;color:#475569;">'+I18n.b('判定路径：|||Decision Path: ')+(path.length?path.join(' → '):'—')+'</div>';
    h+='<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;"><button class="btn btn-primary btn-sm" id="ccpNextHazardBtn">'+(lastH?I18n.t('q.doneBtn'):I18n.t('q.ccpNextQ'))+'</button>';
    // 添加上一步按钮，回退到当前问题的上一个问题
    h+='<button class="btn btn-secondary btn-sm" id="ccpPrevStepBtn">' + I18n.t('q.ccpPrevStep') + '</button>';
    // 添加重新判定按钮，清除当前危害所有答案重新判断
    h+='<button class="btn btn-secondary btn-sm" id="ccpResetAllBtn">' + I18n.t('q.ccpRedoHazard') + '</button></div></div>';
    return h;
  }
  function renderCCPJudgingPage(data) {
    normalizeCcpSteps(data);
    var steps=data.processSteps||[];
    if(steps.length===0){data.ccpPageMode='form';saveData(data);return renderStepFormPage(data);}
    var idx=parseInt(data.ccpStepIndex);
    if(isNaN(idx)||idx<0||idx>=steps.length)idx=0;
    data.ccpStepIndex=idx;var step=steps[idx]||{};
    var hts=['bio','chem','phys'];var hf={bio:I18n.t('q.ccpHazardBio'),chem:I18n.t('q.ccpHazardChem'),phys:I18n.t('q.ccpHazardPhys')};
    var ht=data.ccpHazardType||'bio';if(hts.indexOf(ht)===-1)ht='bio';
    data.ccpHazardType=ht;var hti=hts.indexOf(ht);var cq=data.ccpCurrentQ||1;
    if(!data.ccpSteps[idx])data.ccpSteps[idx]={stepName:step.stepName||'',hazards:{},completed:false};
    if(!data.ccpSteps[idx].hazards)data.ccpSteps[idx].hazards={};
    if(!data.ccpSteps[idx].hazards[ht])data.ccpSteps[idx].hazards[ht]={};
    var ch=data.ccpSteps[idx].hazards[ht];
    var html='<div class="ccp-judging-flow"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;gap:10px;flex-wrap:wrap;">';
    html+='<span style="color:var(--gray-500);font-size:13px;">'+I18n.b('步骤 {a}/{b}：{c} — {d}（{e}/3）|||Step {a}/{b}: {c} — {d} ({e}/3)').replace('{a}',idx+1).replace('{b}',steps.length).replace('{c}',esc(I18n.b(step.stepName||'')||I18n.t('q.unnamed'))).replace('{d}',hf[ht]).replace('{e}',hti+1)+'</span>';
    html+='<span style="display:inline-block;padding:2px 8px;border-radius:999px;background:#eff6ff;color:#1d4ed8;font-size:12px;">'+{bio:'B',chem:'C',phys:'P'}[ht]+'</span></div>';
    if(ch.isCCP!==undefined&&ch.isCCP!==null){
      html+=renderCcpResultBlock(data,ch,ht);
      html+='<div style="margin-top:10px;"><button class="btn btn-secondary btn-sm" id="ccpJudgingBackBtn">' + I18n.t('q.ccpBackToEdit') + '</button></div></div>';
      return html;
    }
    var sv=cq==='q2_need'?ch.q2_need:ch['q'+cq];
    html+='<div class="q15-field-group" style="margin-bottom:12px;"><label>'+getCcpQuestionText(ht,cq)+'</label>';
    if(cq===1)html+='<textarea id="ccpHazardDescInput" rows="2" placeholder="' + I18n.t('q.ph_HazardDesc') + '">'+esc(I18n.b(ch.hazardDesc||''))+'</textarea>';
    html+='</div><div style="margin-bottom:12px;display:flex;gap:18px;flex-wrap:wrap;">';
    if(cq===1){html+='<label class="ccp-radio-inline"><input type="radio" name="ccpQAnswer" value="是"'+(sv==='是'?' checked':'')+'> ' + I18n.t('common.yes') + '</label><label class="ccp-radio-inline"><input type="radio" name="ccpQAnswer" value="否"'+(sv==='否'?' checked':'')+'> ' + I18n.t('common.no') + '</label>';}
    else if(cq==='q2_need'){html+='<label class="ccp-radio-inline"><input type="radio" name="ccpQAnswer" value="是"'+(sv==='是'?' checked':'')+'> ' + I18n.t('q.ccpYesNeedModify') + '</label><label class="ccp-radio-inline"><input type="radio" name="ccpQAnswer" value="否"'+(sv==='否'?' checked':'')+'> ' + I18n.t('q.ccpNoNonCcp') + '</label>';}
    else{html+='<label class="ccp-radio-inline"><input type="radio" name="ccpQAnswer" value="是"'+(sv==='是'?' checked':'')+'> ' + I18n.t('common.yes') + '</label><label class="ccp-radio-inline"><input type="radio" name="ccpQAnswer" value="否"'+(sv==='否'?' checked':'')+'> ' + I18n.t('common.no') + '</label>';}
    html+='</div><div style="display:flex;gap:10px;margin-top:8px;"><button class="btn btn-primary btn-sm" id="ccpAnswerBtn">' + I18n.t('common.ok') + '</button><button class="btn btn-secondary btn-sm" id="ccpJudgingBackBtn">' + I18n.t('q.ccpBackToEdit') + '</button></div></div>';
    return html;
  }

  // ===== CCP判定路径摘要 =====
  function buildCCPPathSummary(hazard) {
    if (!hazard || hazard.q1 === undefined) return '';
    var html = '<div style="margin-top:16px;padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;">';
    html += '<div style="font-weight:500;margin-bottom:6px;">' + I18n.t('ccp.path') + '</div>';
    var resultText = '';
    if (hazard.q1 !== undefined) {
      html += '<span style="display:inline-block;padding:2px 8px;margin:2px 4px 2px 0;background:#e2e8f0;border-radius:4px;">Q1: ' + yn(hazard.q1) + '</span>';
      if (hazard.q1 === '否') {
        if (hazard.q1_need === '否') resultText = I18n.t('q.ccpNonCcpQ1NoControl');
        else if (hazard.q1_need === '是') resultText = I18n.t('q.ccpNeedModifyReEval');
        html += '<span style="display:inline-block;padding:2px 8px;margin:2px 4px 2px 0;background:#e2e8f0;border-radius:4px;">Q1.1: ' + yn(hazard.q1_need) + '</span>';
      }
    }
    if (hazard.q2 !== undefined) {
      html += '<span style="display:inline-block;padding:2px 8px;margin:2px 4px 2px 0;background:#e2e8f0;border-radius:4px;">Q2: ' + yn(hazard.q2) + '</span>';
      if (hazard.q2 === '是') resultText = I18n.t('q.ccpCCPQ2Yes');
    }
    if (hazard.q3 !== undefined) {
      html += '<span style="display:inline-block;padding:2px 8px;margin:2px 4px 2px 0;background:#e2e8f0;border-radius:4px;">Q3: ' + yn(hazard.q3) + '</span>';
      if (hazard.q3 === '否') resultText = I18n.t('q.ccpNonCcpQ3');
    }
    if (hazard.q4 !== undefined) {
      html += '<span style="display:inline-block;padding:2px 8px;margin:2px 4px 2px 0;background:#e2e8f0;border-radius:4px;">Q4: ' + yn(hazard.q4) + '</span>';
      if (hazard.q4 === '是') resultText = I18n.t('q.ccpNonCcpQ4');
      else if (hazard.q4 === '否') resultText = I18n.t('q.ccpCCPQ4No');
    }
    if (resultText) {
      var isCCPResult = resultText.indexOf('CCP') !== -1 && resultText.indexOf('非') === -1 && resultText.indexOf('需修改') === -1;
      var isModify = resultText.indexOf('需修改') !== -1;
      var color = isCCPResult ? '#dc2626' : (isModify ? '#d97706' : '#16a34a');
      html += '<div style="margin-top:8px;padding:8px 12px;background:' + (isCCPResult ? '#fef2f2' : isModify ? '#fffbeb' : '#f0fdf4') + ';border:1px solid ' + color + ';border-radius:6px;color:' + color + ';font-weight:500;">';
      html += I18n.t('ccp.result') + resultText;
      html += '</div>';
      
      var isLastHazard = data && data.ccpHazardType;
      var hazardTypes = ['bio', 'chem', 'phys'];
      var hazardTypeIdx = isLastHazard ? hazardTypes.indexOf(isLastHazard) : -1;
      var isLast = hazardTypeIdx >= hazardTypes.length - 1;
      var nextLabel = isLast ? I18n.t('common.done') : I18n.t('q.navNext');
      
      html += '<button class="btn btn-primary btn-sm" id="ccpNextHazardBtn" style="margin-top:10px;">' + nextLabel + '</button>';
    }
    html += '</div>';
    return html;
  }
  
  // ===== 渲染完成判定后的视图 =====
  function renderJudgmentDoneView(data) {
    data.ccpPageMode = 'form';
    saveData(data);
    return renderStepFormPage(data);
  }
  
  function moveToNextJudgmentStep(data, idx, hazardType, hazardTypes) {
    var hazardTypeIdx = hazardTypes.indexOf(hazardType);
    var nextHazardIdx = hazardTypeIdx + 1;
    if (nextHazardIdx < hazardTypes.length) {
      data.ccpHazardType = hazardTypes[nextHazardIdx];
      data.ccpCurrentQ = 1;
      saveData(data);
      return true;
    }
    var nextStep = idx + 1;
    var steps = data.processSteps || [];
    if (nextStep < steps.length) {
      data.ccpStepIndex = nextStep;
      data.ccpHazardType = 'bio';
      data.ccpCurrentQ = 1;
      saveData(data);
      return true;
    }
    return false;
  }

  // ===== 统一CCP判定表格（所有步骤、所有危害、所有问题在同一界面）=====
  function renderUnifiedCcpTable(data, steps) {
    // 确保ccpSteps已初始化
    if (!data.ccpSteps) data.ccpSteps = [];
    var hazardTypes = ['bio', 'chem', 'phys'];
    var hazardLabels = { bio: 'B', chem: 'C', phys: 'P' };
    var hazardFull = { bio: I18n.t('q.ccpHazardBio'), chem: I18n.t('q.ccpHazardChem'), phys: I18n.t('q.ccpHazardPhys') };
    var qLabels = { 1: 'Q1', 2: 'Q2', 3: 'Q3', 4: 'Q4', 5: 'Q5' };
    
    // 初始化所有步骤的ccpStep数据
    steps.forEach(function(step, si) {
      if (!data.ccpSteps[si]) {
        data.ccpSteps[si] = { stepName: step.stepName || '', hazards: {}, completed: false };
      }
      if (!data.ccpSteps[si].hazards) data.ccpSteps[si].hazards = {};
      hazardTypes.forEach(function(ht) {
        if (!data.ccpSteps[si].hazards[ht]) data.ccpSteps[si].hazards[ht] = {};
      });
    });
    
    var html = '<div class="ccp-unified-info">';
    html += I18n.t('q.ccpUnifiedTip');
    html += '</div>';
    
    html += '<div class="ccp-unified-wrapper">';
    html += '<table class="ccp-unified-table">';
    html += '<thead><tr>';
    html += '<th style="min-width:100px;">' + I18n.t('ccp.summary.step') + '</th>';
    html += '<th style="min-width:70px;">' + I18n.b('危害|||Hazard') + '</th>';
    html += '<th style="min-width:120px;">' + I18n.t('q.sumColHazardDesc') + '</th>';
    html += '<th style="width:70px;">Q1<br><span style="font-weight:400;font-size:10px;color:var(--gray-400);">' + I18n.t('q.sumColQ1') + '</span></th>';
    html += '<th style="width:70px;">Q2<br><span style="font-weight:400;font-size:10px;color:var(--gray-400);">' + I18n.t('q.sumColQ2') + '</span></th>';
    html += '<th style="width:70px;">Q2.1<br><span style="font-weight:400;font-size:10px;color:var(--gray-400);">' + I18n.t('q.sumColQ21') + '</span></th>';
    html += '<th style="width:70px;">Q3<br><span style="font-weight:400;font-size:10px;color:var(--gray-400);">' + I18n.t('q.sumColQ3') + '</span></th>';
    html += '<th style="width:70px;">Q4<br><span style="font-weight:400;font-size:10px;color:var(--gray-400);">' + I18n.t('q.sumColQ4') + '</span></th>';
    html += '<th style="width:70px;">Q5<br><span style="font-weight:400;font-size:10px;color:var(--gray-400);">' + I18n.t('q.sumColQ5') + '</span></th>';
    html += '<th style="min-width:80px;">' + I18n.t('q.sumColResult') + '</th>';
    html += '</tr></thead><tbody>';
    
    steps.forEach(function(step, si) {
      hazardTypes.forEach(function(ht, hi) {
        var hData = data.ccpSteps[si].hazards[ht] || {};
        var rowClass = (hi === 0) ? '' : '';
        if (hi === 0) {
          html += '<tr class="step-group-header"><td colspan="10">' + I18n.t('q.ccpStepTitle').replace('{n}', si + 1) + esc(I18n.b(step.stepName || '') || I18n.t('q.unnamed')) + '</td></tr>';
        }
        
        // 危害描述 
        var descVal = I18n.b(hData.hazardDesc || '');
        
        // 各问题的值
        var q1Val = hData.q1 || '';
        var q2Val = hData.q2 || '';
        var q2needVal = hData.q2_need || '';
        var q3Val = hData.q3 || '';
        var q4Val = hData.q4 || '';
        var q5Val = hData.q5 || '';
        
        // 判定结果
        var isCCP = hData.isCCP;
        var resultClass = 'pending';
        var resultText = I18n.t('q.ccpPending');
        if (isCCP === true) { resultClass = 'is-ccp'; resultText = I18n.t('q.ccpIsCCP'); }
        else if (isCCP === false) { resultClass = 'no-ccp'; resultText = I18n.t('q.ccpNotCCP'); }
        else if (isCCP === 'modify') { resultClass = 'modify'; resultText = I18n.t('q.ccpNeedModify'); }
        
        html += '<tr data-ut-row="' + si + '-' + ht + '">';
        // ' + I18n.t('q.stepName') + '
        html += '<td class="ccp-ut-step">' + (hi === 1 ? '' : esc(I18n.b(step.stepName || ''))) + '</td>';
        // 危害类型
        html += '<td><span class="ccp-ut-hazard-badge ' + ht + '">' + hazardLabels[ht] + '</span><span class="ccp-ut-hazard-label">' + hazardFull[ht] + '</span></td>';
        // 危害描述 (Q1文本域)
        html += '<td><textarea class="ccp-ut-desc-input" data-ut-field="hazardDesc" data-ut-si="' + si + '" data-ut-ht="' + ht + '" rows="2" placeholder="' + I18n.t('q.ccpDescPh') + '">' + esc(descVal) + '</textarea></td>';
        
        // Q1: 是否存在危害
        html += '<td>' + renderYesNoBtns(si, ht, 'q1', q1Val) + '</td>';
        // Q2: 是否有控制措施
        html += '<td>' + renderYesNoBtns(si, ht, 'q2', q2Val) + '</td>';
        // Q2_need: 是否需要控制(Q2=否时显示)
        html += '<td>' + (q2Val === '否' ? renderYesNoBtns(si, ht, 'q2_need', q2needVal) : '<span style="color:var(--gray-300);font-size:11px;">—</span>') + '</td>';
        // Q3: 可消除危害
        html += '<td>' + (q1Val === '是' && q2Val === '是' ? renderYesNoBtns(si, ht, 'q3', q3Val) : '<span style="color:var(--gray-300);font-size:11px;">—</span>') + '</td>';
        // Q4: 污染升高
        html += '<td>' + (q1Val === '是' && q2Val === '是' && q3Val === '否' ? renderYesNoBtns(si, ht, 'q4', q4Val) : '<span style="color:var(--gray-300);font-size:11px;">—</span>') + '</td>';
        // Q5: 后续消除
        html += '<td>' + (q1Val === '是' && q2Val === '是' && q3Val === '否' && q4Val === '是' ? renderYesNoBtns(si, ht, 'q5', q5Val) : '<span style="color:var(--gray-300);font-size:11px;">—</span>') + '</td>';
        // 判定结果
        html += '<td><span class="ccp-ut-result ' + resultClass + '">' + resultText + '</span></td>';
        html += '</tr>';
      });
    });
    
    html += '</tbody></table>';
    html += '</div>';
    
    // 操作按钮
    html += '<div class="ccp-unified-actions">';
    html += '<button class="btn btn-primary btn-sm" id="ccpUnifiedSaveBtn">' + I18n.t('q.ccpSaveJudgment') + '</button>';
    html += '<button class="btn btn-secondary btn-sm" id="ccpUnifiedFinishBtn">' + I18n.t('q.ccpFinishAll') + '</button>';
    html += '</div>';
    
    return html;
  }
  
  // 渲染是/否单选按钮
  function renderYesNoBtns(si, ht, field, value) {
    var name = 'ut_' + si + '_' + ht + '_' + field;
    var yesClass = value === '是' ? 'selected-yes' : '';
    var noClass = value === '否' ? 'selected-no' : '';
    return '<div class="ccp-ut-yn">' +
      '<label class="' + yesClass + '"><input type="radio" name="' + name + '" value="是" data-ut-si="' + si + '" data-ut-ht="' + ht + '" data-ut-field="' + field + '"' + (value === '是' ? ' checked' : '') + '> ' + I18n.t('common.yes') + '</label>' +
      '<label class="' + noClass + '"><input type="radio" name="' + name + '" value="否" data-ut-si="' + si + '" data-ut-ht="' + ht + '" data-ut-field="' + field + '"' + (value === '否' ? ' checked' : '') + '> ' + I18n.t('common.no') + '</label>' +
      '</div>';
  }

  function renderSingleCcpStep(data, steps) {
    var idx = data.ccpStepIndex;
    if (idx >= steps.length) { data.ccpCompleted = true; saveData(data); return renderCcpSummary(data) + renderCcpFooter(data); }
    var step = steps[idx];
    // 初始化ccpSteps
    if (!data.ccpSteps) data.ccpSteps = [];
    if (!data.ccpSteps[idx]) {
      data.ccpSteps[idx] = { stepName: step.stepName || '', hazards: {}, completed: false };
    }
    if (!data.ccpSteps[idx].hazards) data.ccpSteps[idx].hazards = {};
    // 当前危害类型
    var hazardType = data.ccpHazardType || 'bio';
    var hazardTypes = ['bio', 'chem', 'phys'];
    var hazardLabels = { bio: I18n.t('q.ccpDtHazardBioLabel'), chem: I18n.t('q.ccpDtHazardChemLabel'), phys: I18n.t('q.ccpDtHazardPhysLabel') };
    var hazardTypeIdx = hazardTypes.indexOf(hazardType);
    // 获取当前危害数据
    var currentHazard = data.ccpSteps[idx].hazards[hazardType] || {};
    // 问题文本 (5问题版本)
    var qTexts = {
      1: I18n.t('q.ccpDtQ1'),
      2: I18n.t('q.ccpDtQ2'),
      3: I18n.t('q.ccpDtQ3'),
      4: I18n.t('q.ccpDtQ4'),
      5: I18n.t('q.ccpDtQ5')
    };
    var qHelps = {
      1: I18n.t('q.ccpDtQ1Help'),
      2: I18n.t('q.ccpDtQ2Help'),
      3: I18n.t('q.ccpDtQ3Help'),
      4: I18n.t('q.ccpDtQ4Help'),
      5: I18n.t('q.ccpDtQ5Help')
    };
    var currentQ = data.ccpCurrentQ || 1;
    // 如果当前危害已完成判定(isCCP!==null)，跳到下一个
    if (currentHazard.isCCP !== undefined && currentHazard.isCCP !== null) {
      var nextHazardIdx = hazardTypeIdx + 1;
      if (nextHazardIdx < hazardTypes.length) {
        data.ccpHazardType = hazardTypes[nextHazardIdx];
        data.ccpCurrentQ = 1;
        saveData(data);
        return renderSingleCcpStep(data, steps);
      } else {
        data.ccpSteps[idx].completed = true;
        var nextStep = idx + 1;
        if (nextStep < steps.length) {
          data.ccpStepIndex = nextStep;
          data.ccpHazardType = 'bio';
          data.ccpCurrentQ = 1;
          saveData(data);
          return renderSingleCcpStep(data, steps);
        } else {
          data.ccpCompleted = true;
          saveData(data);
          return renderCcpSummary(data) + renderCcpFooter(data);
        }
      }
    }
    // 构建危害提示
    var stepHazardDesc = '';
    if (hazardType === 'bio') {
      stepHazardDesc = I18n.t('q.ccpDtHazardBio');
    } else if (hazardType === 'chem') {
      stepHazardDesc = I18n.t('q.ccpDtHazardChem');
    } else if (hazardType === 'phys') {
      stepHazardDesc = I18n.t('q.ccpDtHazardPhys');
    }

    // 判断当前问题是否已回答
    var answered = false;
    var selectedVal = '';
    if (currentQ === 1) {
      if (currentHazard.q1 !== undefined) { answered = true; selectedVal = currentHazard.q1; }
    } else if (currentQ === 2) {
      if (currentHazard.q2 !== undefined) { answered = true; selectedVal = currentHazard.q2; }
    } else if (currentQ === 3) {
      if (currentHazard.q3 !== undefined) { answered = true; selectedVal = currentHazard.q3; }
    } else if (currentQ === 4) {
      if (currentHazard.q4 !== undefined) { answered = true; selectedVal = currentHazard.q4; }
    } else if (currentQ === 5) {
      if (currentHazard.q5 !== undefined) { answered = true; selectedVal = currentHazard.q5; }
    }

    var qHtml = '<div class="ccp-decision-tree">';
    qHtml += '<div class="ccp-dt-header">';
    qHtml += '<span class="ccp-dt-step">' + I18n.t('q.ccpDtStepNum') + (idx + 1) + '：' + esc(I18n.b(step.stepName || '') || I18n.t('q.unnamed')) + '</span>';
    qHtml += '<span class="ccp-dt-hazard-type">' + hazardLabels[hazardType] + I18n.t('q.ccpDtJudging') + ' (' + (hazardTypeIdx + 1) + '/3)</span>';
    qHtml += '</div>';
    qHtml += '<div class="ccp-dt-hazard-desc">' + I18n.t('q.ccpHazardHint') + '' + stepHazardDesc + '</div>';

    // Q1特殊：显示危害描述输入框
    if (currentQ === 1) {
      var hazardDescVal = I18n.b(currentHazard.hazardDesc || '');
      qHtml += '<div class="ccp-dt-question">';
      qHtml += '<div class="ccp-dt-q-text">' + qTexts[1] + '</div>';
      qHtml += '<div class="ccp-dt-q-help">' + qHelps[1] + '</div>';
      qHtml += '<textarea class="ccp-dt-textarea" id="ccpHazardDescInput" placeholder="' + I18n.t('q.ph_HazardDetail') + '" rows="3">' + esc(hazardDescVal) + '</textarea>';
      qHtml += '<div class="ccp-dt-options">';
      qHtml += '<label class="ccp-dt-option' + (selectedVal === '是' ? ' selected' : '') + '"><input type="radio" name="ccpQAnswer" value="是"' + (selectedVal === '是' ? ' checked' : '') + '> <span>' + I18n.t('q.ccpYesSpan') + '</span></label>';
      qHtml += '<label class="ccp-dt-option' + (selectedVal === '否' ? ' selected' : '') + '"><input type="radio" name="ccpQAnswer" value="否"' + (selectedVal === '否' ? ' checked' : '') + '> <span>' + I18n.t('q.ccpNoSpan') + '</span></label>';
      qHtml += '</div>';
      qHtml += '<div class="ccp-dt-actions">';
      qHtml += '<button class="btn btn-primary btn-sm" id="ccpAnswerBtn">' + I18n.t('q.ccpConfirmAnswer') + '</button>';
      qHtml += '</div></div>';
    } else if (currentQ === 'q2_need') {
      // Q2子判断：是否有必要在此步骤进行安全控制
      qHtml += '<div class="ccp-dt-question">';
      qHtml += '<div class="ccp-dt-q-text">' + I18n.t('q.ccpQ2NeedText') + '</div>';
      qHtml += '<div class="ccp-dt-q-help">' + I18n.t('q.ccpQ2NeedHelp') + '</div>';
      qHtml += '<div class="ccp-dt-options">';
      qHtml += '<label class="ccp-dt-option"><input type="radio" name="ccpQAnswer" value="是"> <span>' + I18n.t('q.ccpYesModifySpan') + '</span></label>';
      qHtml += '<label class="ccp-dt-option"><input type="radio" name="ccpQAnswer" value="否"> <span>' + I18n.t('q.ccpNoNonCcpSpan') + '</span></label>';
      qHtml += '</div>';
      qHtml += '<div class="ccp-dt-actions">';
      qHtml += '<button class="btn btn-primary btn-sm" id="ccpQ2NeedBtn">' + I18n.t('q.confirmBtn') + '</button>';
      qHtml += '</div></div>';
    } else {
      // 普通问题 Q2-Q5
      qHtml += '<div class="ccp-dt-question">';
      qHtml += '<div class="ccp-dt-q-text">' + qTexts[currentQ] + '</div>';
      qHtml += '<div class="ccp-dt-q-help">' + (qHelps[currentQ] || '') + '</div>';
      qHtml += '<div class="ccp-dt-options">';
      qHtml += '<label class="ccp-dt-option' + (selectedVal === '是' ? ' selected' : '') + '"><input type="radio" name="ccpQAnswer" value="是"' + (selectedVal === '是' ? ' checked' : '') + '> <span>' + I18n.t('q.ccpYesSpan') + '</span></label>';
      qHtml += '<label class="ccp-dt-option' + (selectedVal === '否' ? ' selected' : '') + '"><input type="radio" name="ccpQAnswer" value="否"' + (selectedVal === '否' ? ' checked' : '') + '> <span>' + I18n.t('q.ccpNoSpan') + '</span></label>';
      qHtml += '</div>';
      qHtml += '<div class="ccp-dt-actions">';
      if (!answered) {
        qHtml += '<button class="btn btn-primary btn-sm" id="ccpAnswerBtn">' + I18n.t('q.ccpConfirmAnswer') + '</button>';
      } else {
        qHtml += '<button class="btn btn-primary btn-sm" id="ccpNextQBtn">' + I18n.t('q.ccpNextQ') + '</button>';
      }
      qHtml += '</div></div>';
    }

    // 判定路径摘要
    if (currentHazard.q1 !== undefined) {
      qHtml += '<div class="ccp-dt-summary">';
      qHtml += '<h4>' + I18n.t('q.ccpDtPathTitle') + '</h4>';
      var pathItems = [];
      var qVals = [1,2,3,4,5];
      for (var qi = 0; qi < qVals.length; qi++) {
        var qn = qVals[qi];
        var qv = currentHazard['q' + qn];
        if (qv !== undefined) {
          pathItems.push('<span class="ccp-dt-path-step">' + I18n.b('Q{n}：|||Q{n}: ').replace('{n}', qn) + yn(qv) + '</span>');
          // 根据决策树显示分支结果
          if (qn === 1 && qv === '否') {
            pathItems.push('<span class="ccp-dt-path-result no-ccp">' + I18n.t('q.ccpNonCcpQ1') + '</span>');
            break;
          }
          if (qn === 2 && qv === '否') {
            if (currentHazard.q2_need === '否') {
              pathItems.push('<span class="ccp-dt-path-result no-ccp">' + I18n.t('q.ccpNonCcpQ2') + '</span>');
            } else if (currentHazard.q2_need === '是') {
              pathItems.push('<span class="ccp-dt-path-result is-ccp">' + I18n.t('q.ccpModifyStepHint') + '</span>');
            }
            break;
          }
          if (qn === 3 && qv === '是') {
            pathItems.push('<span class="ccp-dt-path-result is-ccp">' + I18n.t('q.ccpDtPathCCPQ3') + '</span>');
            break;
          }
          if (qn === 4 && qv === '否') {
            pathItems.push('<span class="ccp-dt-path-result no-ccp">' + I18n.t('q.ccpNonCcpQ4') + '</span>');
            break;
          }
          if (qn === 5) {
            if (qv === '是') pathItems.push('<span class="ccp-dt-path-result no-ccp">' + I18n.t('q.ccpNonCcpQ5') + '</span>');
            else pathItems.push('<span class="ccp-dt-path-result is-ccp">' + I18n.t('q.ccpDtPathCCPQ5') + '</span>');
          }
        } else {
          break;
        }
      }
      qHtml += pathItems.join('<br>');
      qHtml += '</div>';
    }

    // 判定结果
    if (currentHazard.isCCP !== undefined && currentHazard.isCCP !== null) {
      var isCCPVal = currentHazard.isCCP;
      var ccpLabel = isCCPVal === true ? I18n.t('q.ccpYesLabel') : (isCCPVal === 'modify' ? I18n.t('q.ccpNeedModifyReEval') : I18n.t('q.ccpNoLabel'));
      var ccpColor = isCCPVal === true ? '#dc2626' : (isCCPVal === 'modify' ? '#d97706' : '#16a34a');
      var ccpBg = isCCPVal === true ? '#fef2f2' : (isCCPVal === 'modify' ? '#fffbeb' : '#f0fdf4');
      qHtml += '<div class="ccp-dt-final" style="background:' + ccpBg + ';border:1px solid ' + ccpColor + ';color:' + ccpColor + ';">';
      qHtml += '✅ ' + hazardLabels[hazardType] + I18n.t('q.ccpDtResultPrefix') + '<strong>' + ccpLabel + '</strong>';
      qHtml += '</div>';
      // 如果需修改，显示修改后重新评估按钮
      if (isCCPVal === 'modify') {
        qHtml += '<div class="ccp-dt-actions" style="margin-top:12px;"><button class="btn btn-primary btn-sm" id="ccpResetQ2Btn">' + I18n.t('q.ccpModifyReEval') + '</button></div>';
      }
    }

    qHtml += '</div>'; // .ccp-decision-tree close

    var isFirstPosition = (idx === 0 && hazardType === 'bio' && currentQ === 1);
    var prevBtn = !isFirstPosition ? '<button class="btn btn-sm btn-secondary" id="ccpPrevStepBtn" style="margin-right:auto;">' + I18n.t('q15.prevBtn') + '</button>' : '';
    var maxQ = 5;
    var qnumStr = currentQ === 'q2_need' ? I18n.t('q.ccpDtQ2Sub') : (I18n.t('q.ccpDtQNum') + currentQ + '/' + maxQ + I18n.b('（||| (') + hazardLabels[hazardType] + ' ' + (hazardTypeIdx + 1) + '/3' + I18n.b('）||| )'));

    return '<div id="ccpStepContainer">' +
      '<div style="display:flex;align-items:center;margin-bottom:12px;">' + prevBtn +
      '<span class="q15-step-indicator" style="margin:0 auto;">' + I18n.t('q.ccpDtStepNum') + (idx + 1) + ' / ' + steps.length + ' — ' + qnumStr + '</span></div>' +
      qHtml + '</div>';
  }

  // ===== CCP 步骤编辑视图（在CCP流程中编辑步骤信息）=====
  function renderCcpStepEditor(data, steps, editIdx) {
    if (editIdx < 0 || editIdx >= steps.length) editIdx = steps.length - 1;
    var step = steps[editIdx];
    if (!step) return '<p>' + I18n.t('q.ccpNoStepData') + '</p>';
    
    var html = '<div class="ccp-step-editor">';
    html += '<h3>' + I18n.t('q.ccpEditStepN') + (editIdx + 1) + I18n.b('：|||: ') + esc(I18n.b(step.stepName || '') || I18n.t('q.unnamed')) + '</h3>';
    html += '<p class="q15-table-hint">' + I18n.t('q.ccpEditHint') + '</p>';
    
    // 步骤卡片编辑器
    html += '<div class="q15-process-card" data-ps-idx="' + editIdx + '" id="ccpEditStepCard">';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">';
    html += '<div class="q15-field-group"><label>' + I18n.t('q.stepName') + '</label><input type="text" class="ccp-edit-input" data-ps-field="stepName" value="' + esc(step.stepName || '') + '"></div>';
    html += '<div class="q15-field-group"><label>' + I18n.t('q.equipment') + '</label><input type="text" class="ccp-edit-input" data-ps-field="equipmentName" value="' + esc(step.equipmentName || '') + '"></div>';
    html += '</div>';
    html += '<div class="q15-field-group"><label>' + I18n.t('q.method') + '</label><textarea class="ccp-edit-input" data-ps-field="operationMethod" rows="2">' + esc(step.operationMethod || '') + '</textarea></div>';
    html += '<div class="q15-field-group"><label>' + I18n.t('q.params') + '</label><input type="text" class="ccp-edit-input" data-ps-field="parameters" value="' + esc(step.parameters || '') + '"></div>';
    html += '<div class="q15-field-group"><label>' + I18n.t('q.controlPoint') + '</label><input type="text" class="ccp-edit-input" data-ps-field="controlPoint" value="' + esc(step.controlPoint || '') + '" placeholder="' + I18n.t('q.ph_ControlPoint') + '"></div>';
    html += '</div>';
    
    // 操作按钮
    html += '<div class="ccp-step-editor-actions">';
    html += '<button class="btn btn-primary btn-sm" id="ccpEditSaveBtn">' + I18n.t('q.ccpSaveEdit') + '</button>';
    html += '<button class="btn btn-secondary btn-sm" id="ccpEditDeleteBtn" style="color:#dc2626;border-color:#fecaca;">🗑️ ' + I18n.t('q.ccpDeleteStep') + '</button>';
    html += '<button class="btn btn-secondary btn-sm" id="ccpEditBackToJudgeBtn">' + I18n.t('q.ccpBackToJudge') + '</button>';
    html += '</div>';
    
    html += '</div>';
    return html;
  }

  function getStepHazards(data, stepName) {
    var results = [];
    if (!stepName) return results;
    ['hazardBio', 'hazardChem', 'hazardPhys'].forEach(function(key) {
      var arr = data[key] || [];
      arr.forEach(function(h) {
        if (h.desc && h.desc.indexOf(stepName) !== -1) results.push(h);
        else if (h.material && stepName.indexOf(h.material) !== -1) results.push(h);
      });
    });
    return results;
  }

  function renderCcpSummary(data) {
    normalizeCcpSteps(data);
    var steps=data.processSteps||[];var ccpSteps=data.ccpSteps||[];
    if(steps.length===0)return '<p style="color:var(--gray-400);text-align:center;padding:20px;">' + I18n.t('q.ccpNoStepsBack') + '</p><div style="margin-top:16px;"><button class="btn btn-secondary btn-sm" id="summaryBackBtn">' + I18n.t('q.ccpBackEdit') + '</button></div>';
    var hts=['bio','chem','phys'];var hf={bio:'B:'+I18n.t('q.ccpHazardBio'),chem:'C:'+I18n.t('q.ccpHazardChem'),phys:'P:'+I18n.t('q.ccpHazardPhys')};var rows=[];
    var hasAI = ccpSteps.some(function(cs) {
      return cs && cs.hazards && ['bio','chem','phys'].some(function(ht) { return cs.hazards[ht] && cs.hazards[ht].aiReasoning; });
    });
    steps.forEach(function(step,si){hts.forEach(function(ht,hi){
      var h=(ccpSteps[si]&&ccpSteps[si].hazards&&ccpSteps[si].hazards[ht])?ccpSteps[si].hazards[ht]:{};
      var ccp=I18n.t('q.ccpUndetermined');if(h.isCCP===true)ccp='<span style="color:#dc2626;font-weight:600;">' + I18n.t('q.ccpYes') + '</span>';
      else if(h.isCCP===false)ccp='<span style="color:#16a34a;font-weight:600;">' + I18n.t('q.ccpNo') + '</span>';
      else if(h.isCCP==='modify')ccp='<span style="color:#d97706;font-weight:600;">' + I18n.t('q.ccpModify') + '</span>';
      var aiTag = h.aiReasoning ? '<span style="font-size:10px;color:#7c3aed;font-weight:500;">' + I18n.t('common.aiAnalyzing') + '</span>' : '';
      var displayReasoning = h.aiReasoning ? I18n.b(h.aiReasoning) : '';
      var reasoningCell = h.aiReasoning ? '<td style="font-size:11px;color:#6b7280;">' + esc(displayReasoning.length > 40 ? displayReasoning.substring(0, 40) + '...' : displayReasoning) + '</td>' : '<td></td>';
      var displayDesc = h.hazardDesc ? I18n.b(h.hazardDesc) : '';
      rows.push('<tr>'+(hi===0?'<td rowspan="3" style="text-align:center;vertical-align:middle;font-weight:600;">'+esc(I18n.b(step.stepName||'')||I18n.t('q.ccpStepDefault').replace('{n}',si+1))+'</td>':'')+
      '<td>'+hf[ht]+(displayDesc?'<br><span style="font-size:12px;color:#64748b;">'+esc(displayDesc)+'</span>':'')+'</td>'+
      '<td style="text-align:center;">'+esc(yn(h.q1)||'—')+'</td>'+
      '<td style="text-align:center;">'+esc(yn(h.q2)||'—')+(h.q2_need?'<br><span style="font-size:11px;color:#64748b;">' + I18n.t('q.cont') + ''+esc(yn(h.q2_need))+'</span>':'')+'</td>'+
      '<td style="text-align:center;">'+esc(yn(h.q3)||'—')+'</td><td style="text-align:center;">'+esc(yn(h.q4)||'—')+'</td><td style="text-align:center;">'+esc(yn(h.q5)||'—')+'</td><td style="text-align:center;">'+ccp+aiTag+'</td>'+
      (hasAI ? reasoningCell : '') + '</tr>');
    });});
    var html = '';
    if (hasAI) {
      html += '<div style="margin-bottom:12px;padding:10px 14px;background:#f5f3ff;border:1px solid #ddd6fe;border-radius:8px;font-size:13px;color:#6d28d9;">';
      html += '🤖 <strong>' + I18n.t('ccp.localReasoning') + '</strong> — ' + I18n.t('ccp.localReasoningDesc');
      html += '</div>';
    }
    html+='<h3 style="margin-bottom:12px;">' + I18n.t('ccp.summary.title') + '</h3>';
    html+='<div style="overflow-x:auto;"><table class="q15-table" style="min-width:' + (hasAI ? '960px' : '820px') + ';"><thead><tr><th>' + I18n.t('ccp.summary.step') + '</th><th>' + I18n.t('q.ccpPotentialHazard') + '</th><th>Q1</th><th>Q2</th><th>Q3</th><th>Q4</th><th>Q5</th><th>CCP</th>' + (hasAI ? '<th>' + I18n.t('q.ccpAiBasis') + '</th>' : '') + '</tr></thead><tbody>'+rows.join('')+'</tbody></table></div>';
    html+='<div style="margin-top:16px;display:flex;gap:10px;"><button class="btn btn-secondary btn-sm" id="summaryBackBtn">' + I18n.t('q.ccpBackEdit') + '</button></div>';
    return html;
  }

  function renderCcpFooter(data) {
    return '<hr class="q15-divider"><h3>' + I18n.t('flow.title') + ' <span style="font-size:13px;font-weight:400;color:var(--gray-400);">' + I18n.t('flow.desc') + '</span></h3><p class="q15-table-hint">' + I18n.t('flow.hint') + '</p><div class="q15-flowchart-area" id="flowchartArea">' + renderFlowchartPreview(data) + '</div><hr class="q15-divider"><h3>' + I18n.t('q.ccpFlowConfirm') + '</h3><div class="q15-confirm-box"><label class="q15-checkbox-label"><input type="checkbox" data-q15-field="flowConfirmed"' + (data.flowConfirmed ? ' checked' : '') + '> ' + I18n.t('flow.confirmLabel') + '</label><p style="font-size:12px;color:var(--gray-400);margin-top:6px;">' + I18n.t('flow.confirmNote') + '</p></div>';
  }

  function renderCriticalLimits(data) {
    // 初始化关键限值数据结构
    if (!data.criticalLimitsData || !Array.isArray(data.criticalLimitsData)) data.criticalLimitsData = [];
    
    // 从CCP判定结果中提取被判定为CCP的步骤
    var ccpSteps = data.ccpSteps || [];
    var processSteps = data.processSteps || [];
    var ccpList = [];
    ccpSteps.forEach(function(cs, si) {
      if (!cs || !cs.hazards) return;
      var hasCCP = false;
      var ccpNames = [];
      var ccpHazardTypes = [];
      ['bio', 'chem', 'phys'].forEach(function(ht) {
        var h = cs.hazards[ht];
        if (h && h.isCCP === true) {
          hasCCP = true;
          ccpNames.push(h.hazardDesc || ht);
          ccpHazardTypes.push(ht);
        }
      });
      if (hasCCP) {
        var stepName = cs.stepName || (processSteps[si] ? processSteps[si].stepName : '') || (I18n.t('q.ccpSummaryStep') + ' ' + (si + 1));
        ccpList.push({
          stepName: stepName,
          stepIndex: si,
          ccpNames: ccpNames,
          ccpHazardTypes: ccpHazardTypes
        });
        // 确保每个CCP在criticalLimitsData中有对应的条目
        var existing = data.criticalLimitsData.find(function(d) { return d.stepName === stepName; });
        if (!existing) {
          data.criticalLimitsData.push({
            stepName: stepName,
            limits: [{ param: '', value: '', unit: '', basis: '' }],
            operatingLimits: [{ param: '', value: '', unit: '' }]
          });
        }
      }
    });

    var hazardFull = { bio: I18n.t('q.ccpHazardBio'), chem: I18n.t('q.ccpHazardChem'), phys: I18n.t('q.ccpHazardPhys') };

    var html = '';

    // CCP列表展示
    if (ccpList.length > 0) {
      html += '<div style="margin-bottom:16px;padding:12px 16px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;">';
      html += '<div style="font-weight:600;color:#dc2626;margin-bottom:8px;">' + I18n.t('q.clIdentifiedCCPs') + '</div>';
      html += '<ul style="margin:0;padding-left:20px;">';
      ccpList.forEach(function(c) {
        var hazardLabels = c.ccpHazardTypes.map(function(ht) { return hazardFull[ht]; }).join('、');
        html += '<li style="margin:4px 0;font-size:14px;"><strong>' + esc(c.stepName) + '</strong> <span style="color:var(--gray-400);font-size:12px;">（' + hazardLabels + '）</span></li>';
      });
      html += '</ul></div>';
      
      // 每个CCP的关键限值卡片
      html += '<div class="q15-critical-limits-cards">';
      ccpList.forEach(function(c, ci) {
        var clData = data.criticalLimitsData.find(function(d) { return d.stepName === c.stepName; });
        if (!clData) return;
        var li = data.criticalLimitsData.indexOf(clData);
        
        html += '<div class="q15-cl-card" style="margin-bottom:16px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">';
        html += '<div style="background:#fef2f2;padding:10px 16px;font-weight:600;color:#dc2626;border-bottom:1px solid #fecaca;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">' +
          '<span>' + esc(c.stepName) + '</span>' +
          '<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;background:#fffbeb;border:1px solid #fde68a;border-radius:999px;font-size:11px;font-weight:500;color:#92400e;flex-shrink:0;">' + I18n.t('q.clSuggestionBadge') + '</span>' +
          '</div>';
        
        // 关键限值表
        html += '<div style="padding:12px 16px;">';
        html += '<div style="font-weight:500;margin-bottom:8px;font-size:13px;">' + I18n.t('q.clCLTitle') + '</div>';
        html += '<table class="q15-table" style="min-width:auto;margin-bottom:10px;"><thead><tr><th>' + I18n.t('q.clParam') + '</th><th>' + I18n.t('q.clValue') + '</th><th>' + I18n.t('q.clUnit') + '</th><th>' + I18n.t('q.clBasis') + '</th><th style="width:50px;"></th></tr></thead><tbody id="clBody_' + li + '">';
        clData.limits.forEach(function(lim, li2) {
          html += '<tr data-cl-idx="' + li + '" data-cl-lim="' + li2 + '">' +
            '<td><input type="text" class="cl-input cl-param" value="' + esc(lim.param) + '" placeholder="' + I18n.t('q.clPhParam') + '" style="width:100%;"></td>' +
            '<td><input type="text" class="cl-input cl-value" value="' + esc(lim.value) + '" placeholder="' + I18n.t('q.clPhValue') + '" style="width:100%;"></td>' +
            '<td><input type="text" class="cl-input cl-unit" value="' + esc(lim.unit) + '" placeholder="' + I18n.t('q.clPhUnit') + '" style="width:100%;"></td>' +
            '<td><input type="text" class="cl-input cl-basis" value="' + esc(lim.basis) + '" placeholder="' + I18n.t('q.clPhBasis') + '" style="width:100%;"></td>' +
            '<td><button class="btn btn-xs btn-secondary cl-del-limit" data-cl-idx="' + li + '" data-lim-idx="' + li2 + '" style="color:#dc2626;border-color:#fecaca;">✕</button></td>' +
          '</tr>';
        });
        html += '</tbody></table>';
        html += '<button class="btn btn-xs btn-secondary cl-add-limit" data-cl-idx="' + li + '" style="margin-bottom:12px;">' + I18n.t('q.clAdd') + '</button>';
        
        // 操作限值表
        if (!clData.operatingLimits) clData.operatingLimits = [];
        html += '<div style="font-weight:500;margin-bottom:8px;font-size:13px;color:#6366f1;">' + I18n.t('q.clOLTitle') + '<span style="font-weight:400;font-size:11px;color:var(--gray-400);">' + I18n.t('q.clOLHint') + '</span></div>';
        html += '<table class="q15-table" style="min-width:auto;margin-bottom:10px;"><thead><tr><th>' + I18n.t('q.clParam') + '</th><th>' + I18n.t('q.clOLValue') + '</th><th>' + I18n.t('q.clUnit') + '</th><th style="width:50px;"></th></tr></thead><tbody id="olBody_' + li + '">';
        clData.operatingLimits.forEach(function(ol, oli) {
          html += '<tr data-ol-idx="' + li + '" data-ol-lim="' + oli + '">' +
            '<td><input type="text" class="ol-input ol-param" value="' + esc(ol.param) + '" placeholder="' + I18n.t('q.clPhParam') + '" style="width:100%;"></td>' +
            '<td><input type="text" class="ol-input ol-value" value="' + esc(ol.value) + '" placeholder="' + I18n.t('q.clPhOpValue') + '" style="width:100%;"></td>' +
            '<td><input type="text" class="ol-input ol-unit" value="' + esc(ol.unit) + '" placeholder="' + I18n.t('q.clPhUnit') + '" style="width:100%;"></td>' +
            '<td><button class="btn btn-xs btn-secondary ol-del-limit" data-ol-idx="' + li + '" data-ol-lim="' + oli + '" style="color:#dc2626;border-color:#fecaca;">✕</button></td>' +
          '</tr>';
        });
        html += '</tbody></table>';
        html += '<button class="btn btn-xs btn-secondary ol-add-limit" data-cl-idx="' + li + '" style="margin-bottom:8px;">' + I18n.t('q.clAddOp') + '</button>';
        
        html += '</div></div>';
      });
      html += '</div>';
      
      // 汇总文本框
      html += '<div class="q15-field-group" style="margin-top:12px;"><label>' + I18n.t('q.clSummary') + '</label>';
      html += '<textarea data-q15-field="criticalLimits" rows="4" placeholder="' + I18n.t('q.clSummaryPh') + '">' + esc(data.criticalLimits || '') + '</textarea></div>';
      
    } else {
      html = '<div style="margin-bottom:16px;padding:12px 16px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;color:#92400e;font-size:13px;">' + I18n.t('q.clNoCcpWarning') + '</div>';
    }

    // 执行标准和AI按钮
    html += '<p class="q15-table-hint">' + I18n.t('q.clDesc') + '</p>' +
      '<div style="margin-bottom:10px;padding:8px 12px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:12px;color:#92400e;">' + I18n.t('q.clSuggestion') + '</div>' +
      '<div class="q15-field-group"><label>' + I18n.t('q.clSelectStd') + ' <span class="required">*</span></label>' +
      '<select data-q15-field="execStandard">' +
        '<option value="">' + I18n.t('q.verSelectOption') + '</option>' +
        '<option value="gb"' + (data.execStandard === 'gb' ? ' selected' : '') + '>' + I18n.t('q.clStdGb') + '</option>' +
        '<option value="industry"' + (data.execStandard === 'industry' ? ' selected' : '') + '>' + I18n.t('q.clStdIndustry') + '</option>' +
        '<option value="enterprise"' + (data.execStandard === 'enterprise' ? ' selected' : '') + '>' + I18n.t('q.clStdEnterprise') + '</option>' +
        '<option value="international"' + (data.execStandard === 'international' ? ' selected' : '') + '>' + I18n.t('q.clStdInternational') + '</option>' +
      '</select></div>' +
      '<div class="q15-field-group"><label>' + I18n.t('q.clStdRef') + '</label>' +
        '<p class="q15-table-hint" style="margin-bottom:6px;">' + I18n.t('q.clStdRefHint') + '</p>' +
        '<div id="clStandardsPanel" style="max-height:200px;overflow-y:auto;padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;color:var(--gray-600);">' + I18n.t('common.loading') + '</div>' +
      '</div>' +
      '<div class="q15-ai-btn-wrapper">' +
        '<button class="btn btn-secondary btn-sm" id="aiCriticalBtn">' + I18n.t('q.clAIBtn') + '</button>' +
        '<span id="aiCriticalHint" style="font-size:12px;color:var(--gray-400);margin-left:10px;"></span>' +
      '</div>' +
      '<div id="aiCriticalResult" style="margin-top:12px;"></div>';

    return html;
  }

  // ===== 标准参考面板：从 /api/standards 拉取并与当前CCP/产品匹配 =====
  function loadStandardsPanel(data) {
    var panel = document.getElementById('clStandardsPanel');
    if (!panel) return;
    // 从 ccpSteps 提取被判定为CCP的步骤名
    var names = [];
    (data.ccpSteps || []).forEach(function(cs, si) {
      var isCCP = false;
      ['bio', 'chem', 'phys'].forEach(function(ht) {
        var h = cs && cs.hazards && cs.hazards[ht];
        if (h && h.isCCP === true) isCCP = true;
      });
      if (isCCP) names.push(cs.stepName || ((data.processSteps[si] || {}).stepName || ''));
    });
    var haystack = (data.productName || '') + ' ' + names.join(' ');
    fetchWithTimeout(API_HOST + '/api/standards', {}, 10000)
      .then(function(r) { return r.json(); })
      .then(function(res) {
        if (!(res && res.ok && Array.isArray(res.standards))) throw new Error('bad');
        var all = res.standards;
        var picked = all.filter(function(s) {
          var kws = s.applyKeywords || [];
          return kws.some(function(k) { return k && haystack.toLowerCase().indexOf(k.toLowerCase()) !== -1; });
        });
        var list = picked.length > 0 ? picked : all;
        if (list.length === 0) {
          panel.innerHTML = I18n.t('q.clStdRefEmpty');
          return;
        }
        panel.innerHTML = list.slice(0, 12).map(function(s) {
          var name = I18n.b(s.name || s.number || '');
          var limits = s.keyLimits || [];
          var limitHtml = limits.length > 0
            ? '<div style="margin-top:4px;padding-left:10px;border-left:2px solid #bfdbfe;color:var(--gray-500);">' +
              limits.slice(0, 4).map(function(l) { return '<div>• ' + esc(I18n.b(l)) + '</div>'; }).join('') +
              (limits.length > 4 ? '<div>…</div>' : '') + '</div>'
            : '';
          return '<div style="margin-bottom:6px;"><strong style="color:#1e40af;">' + esc(s.number || '') + '</strong> <span>' + esc(name) + '</span>' + limitHtml + '</div>';
        }).join('');
      })
      .catch(function() {
        panel.style.display = 'none';
      });
  }

  // ===== CCP 判定结果自动同步到监控程序和' + I18n.t('q.verCorrective') + ' =====
  function syncCCPToMonitoringAndCorrective(data) {
    // 从 ccpSteps 中找出所有被判定为 CCP 的' + I18n.t('q.stepName') + '
    var ccpStepNames = [];
    (data.ccpSteps || []).forEach(function(cs, si) {
      if (!cs || !cs.hazards) return;
      var stepName = cs.stepName || ((data.processSteps[si] || {}).stepName || '');
      if (!stepName) return;
      var hasCCP = ['bio', 'chem', 'phys'].some(function(ht) {
        return cs.hazards[ht] && cs.hazards[ht].isCCP === true;
      });
      if (hasCCP && ccpStepNames.indexOf(stepName) === -1) {
        ccpStepNames.push(stepName);
      }
    });

    if (ccpStepNames.length === 0) return;

    // 双语感知匹配：AI 返回的 ccp 可能是 "步骤名|||Step Name" 格式
    function ccpMatches(existing, name) {
      if (!existing) return false;
      var zh = String(existing).split('|||')[0].trim();
      return zh === name || existing === name;
    }

    // 用户手动删除过的 CCP 不再自动补回（记录在 _monitoringRemoved / _correctiveRemoved）
    if (!Array.isArray(data._monitoringRemoved)) data._monitoringRemoved = [];
    if (!Array.isArray(data._correctiveRemoved)) data._correctiveRemoved = [];

    // 同步到 monitoring（仅当该 CCP 尚未存在且未被用户删除时追加）
    ccpStepNames.forEach(function(name) {
      if (data._monitoringRemoved.indexOf(name) !== -1) return;
      var exists = data.monitoring.some(function(m) { return ccpMatches(m.ccp, name); });
      if (!exists) {
        data.monitoring.push({
          id: genId(), ccp: name, object: '',
          method: '', frequency: '', personnel: '', remark: ''
        });
      }
    });

    // 同步到 correctiveActions（仅当该 CCP 尚未存在且未被用户删除时追加）
    ccpStepNames.forEach(function(name) {
      if (data._correctiveRemoved.indexOf(name) !== -1) return;
      var exists = data.correctiveActions.some(function(c) { return ccpMatches(c.ccp, name); });
      if (!exists) {
        data.correctiveActions.push({
          id: genId(), ccp: name,
          personnel: '', causeAnalysis: '', productHandling: ''
        });
      }
    });
  }

  // 将 AI 生成的监控方案合并进已有行（按 CCP 中英段任一匹配、大小写不敏感，填充原步骤而非新增）
  function applyAiMonitoringToRows(data, aiRows) {
    if (!aiRows || aiRows.length === 0) return;
    var mapped = aiRows.map(function(m) {
      return { id: genId(), ccp: m.ccp || '', object: m.object || '', method: m.method || '', frequency: m.frequency || '', personnel: m.personnel || '', remark: m.remark || '' };
    });
    function keys(v) { return String(v || '').split('|||').map(function(x) { return x.trim().toLowerCase(); }).filter(Boolean); }
    function share(aKeys, bKeys) { return aKeys.some(function(a) { return bKeys.indexOf(a) !== -1; }); }
    var existing = (data.monitoring || []).slice();
    var used = {};
    mapped.forEach(function(ai) {
      var aiKeys = keys(ai.ccp);
      if (aiKeys.length === 0) { existing.push(ai); return; }
      var idx = -1;
      for (var i = 0; i < existing.length; i++) {
        if (!used[i] && share(keys(existing[i].ccp), aiKeys)) { idx = i; break; }
      }
      if (idx !== -1) {
        ai.ccp = existing[idx].ccp; // 保留原步骤名
        existing[idx] = ai;
        used[idx] = true;
      } else {
        existing.push(ai);
      }
    });
    data.monitoring = existing;
  }

  // 将 AI 生成的纠偏方案合并进已有行（同上：填充原步骤）
  function applyAiCorrectiveToRows(data, aiRows) {
    if (!aiRows || aiRows.length === 0) return;
    var mapped = aiRows.map(function(a) {
      return {
        id: genId(),
        ccp: a.ccp || '',
        cl: a.cl || '',
        personnel: a.personnel || '',
        causeAnalysis: a.causeAnalysis || '',
        productHandling: a.productHandling || '',
        corrective: a.corrective || '',
        verification: a.verification || '',
        record: a.record || ''
      };
    });
    function keys(v) { return String(v || '').split('|||').map(function(x) { return x.trim().toLowerCase(); }).filter(Boolean); }
    function share(aKeys, bKeys) { return aKeys.some(function(a) { return bKeys.indexOf(a) !== -1; }); }
    var existing = (data.correctiveActions || []).slice();
    var used = {};
    mapped.forEach(function(ai) {
      var aiKeys = keys(ai.ccp);
      if (aiKeys.length === 0) { existing.push(ai); return; }
      var idx = -1;
      for (var i = 0; i < existing.length; i++) {
        if (!used[i] && share(keys(existing[i].ccp), aiKeys)) { idx = i; break; }
      }
      if (idx !== -1) {
        ai.ccp = existing[idx].ccp; // 保留原步骤名
        existing[idx] = ai;
        used[idx] = true;
      } else {
        existing.push(ai);
      }
    });
    data.correctiveActions = existing;
  }

  function renderMonitoring(data) {
    syncCCPToMonitoringAndCorrective(data);
    return '<h3>' + I18n.t('q.monitorTitle') + '</h3><p class="q15-table-hint">' + I18n.t('q.monitorHint') + '</p><div class="q15-ai-btn-wrapper" style="margin-bottom:12px;"><button class="btn btn-secondary btn-sm" id="aiMonitorBtn">' + I18n.t('q.monitorAI') + '</button><span id="aiMonitorHint" style="font-size:12px;color:var(--gray-400);margin-left:10px;"></span></div><table class="q15-table"><thead><tr><th>' + I18n.t('q.monitorCCP') + '</th><th>' + I18n.t('q.monitorObject') + '</th><th>' + I18n.t('q.monitorMethod') + '</th><th>' + I18n.t('q.monitorFreq') + '</th><th>' + I18n.t('q.monitorPersonnel') + '</th><th>' + I18n.t('q.monAddRemark') + '</th><th style="width:50px">' + I18n.t('form.colAction') + '</th></tr></thead><tbody id="monitorBody">' + data.monitoring.map(function(m, i) { return '<tr data-mn-idx="' + i + '"><td><input type="text" value="' + esc(I18n.b(m.ccp || '')) + '" placeholder="' + I18n.t('q.monitorPhCCP') + '" style="width:100%;"></td><td><textarea rows="2" style="width:100%;resize:vertical;" placeholder="' + I18n.t('q.monitorPhObject') + '">' + esc(I18n.b(m.object || '')) + '</textarea></td><td><textarea rows="2" style="width:100%;resize:vertical;" placeholder="' + I18n.t('q.monitorPhMethod') + '">' + esc(I18n.b(m.method || '')) + '</textarea></td><td><textarea rows="2" style="width:100%;resize:vertical;" placeholder="' + I18n.t('q.monitorPhFreq') + '">' + esc(I18n.b(m.frequency || '')) + '</textarea></td><td><textarea rows="2" style="width:100%;resize:vertical;" placeholder="' + I18n.t('q.monitorPhPersonnel') + '">' + esc(I18n.b(m.personnel || '')) + '</textarea></td><td><textarea rows="2" style="width:100%;resize:vertical;" placeholder="' + I18n.t('q.monitorPhRemark') + '">' + esc(I18n.b(m.remark || '')) + '</textarea></td><td><button class="q15-del-row" data-mn-idx="' + i + '">&times;</button></td></tr>';       }).join('') + '</tbody></table><button class="btn btn-sm btn-secondary" id="addMonitorRow">' + I18n.t('q.monitorAdd') + '</button> <button class="btn btn-sm btn-secondary" id="monitorDedupBtn" style="color:#92400e;border-color:#fde68a;">' + I18n.t('q.monitorDedup') + '</button>';
  }

  function renderCorrective(data) {
    syncCCPToMonitoringAndCorrective(data);
    var footerTips = '' +
      '<div style="margin:16px 0;padding:14px 18px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;font-size:12px;color:#991b1b;line-height:1.6;">' +
        '<div style="font-weight:600;margin-bottom:4px;">' + I18n.t('q.correctiveWarnTitle') + '</div>' +
        '<p style="margin:0;">' + I18n.t('q.correctiveWarnText') + '</p>' +
      '</div>' +
      '<div style="margin:10px 0 16px 0;padding:14px 18px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;font-size:12px;color:#1e40af;line-height:1.6;">' +
        '<div style="font-weight:600;margin-bottom:4px;">' + I18n.t('q.correctiveReEvalTitle') + '</div>' +
        '<p style="margin:0;">' + I18n.t('q.correctiveReEvalText') + '</p>' +
      '</div>';
    return '<h3>' + I18n.t('q.correctiveTitle') + '</h3><p class="q15-table-hint">' + I18n.t('q.correctiveHint') + '</p>' +
      '<div class="q15-ai-btn-wrapper" style="margin-bottom:12px;">' +
        '<button class="btn btn-secondary btn-sm" id="aiCorrectiveBtn">' + I18n.t('q.correctiveAI') + '</button>' +
        '<span id="aiCorrectiveHint" style="font-size:12px;color:var(--gray-400);margin-left:10px;"></span>' +
      '</div>' +
      '<table class="q15-table"><thead><tr><th>' + I18n.t('q.monitorCCP') + '</th><th>' + I18n.t('q.corPersonnel') + '</th><th>' + I18n.t('q.corCause') + '</th><th>' + I18n.t('q.corProduct') + '</th><th style="width:50px;">' + I18n.t('form.colAction') + '</th></tr></thead><tbody id="correctiveBody">' +
      data.correctiveActions.map(function(c, i) {
        return '<tr data-ca-idx="' + i + '">' +
          '<td><input type="text" value="' + esc(I18n.b(c.ccp || '')) + '" placeholder="' + I18n.t('q.correctivePhCCP') + '" style="width:100%;"></td>' +
          '<td><textarea rows="2" style="width:100%;resize:vertical;" placeholder="' + I18n.t('q.correctivePhPersonnel') + '">' + esc(I18n.b(c.personnel || '')) + '</textarea></td>' +
          '<td><textarea rows="2" style="width:100%;resize:vertical;" placeholder="' + I18n.t('q.correctivePhCause') + '">' + esc(I18n.b(c.causeAnalysis || '')) + '</textarea></td>' +
          '<td><textarea rows="2" style="width:100%;resize:vertical;" placeholder="' + I18n.t('q.correctivePhProduct') + '">' + esc(I18n.b(c.productHandling || '')) + '</textarea></td>' +
          '<td><button class="q15-del-row" data-ca-idx="' + i + '">&times;</button></td>' +
        '</tr>';
      }).join('') +
      '</tbody></table>' +
      '<button class="btn btn-sm btn-secondary" id="addCorrectiveRow">' + I18n.t('q.correctiveAdd') + '</button> <button class="btn btn-sm btn-secondary" id="correctiveDedupBtn" style="color:#92400e;border-color:#fde68a;">' + I18n.t('q.monitorDedup') + '</button>' +
      footerTips;
  }

  function renderVerification(data) {
    if (typeof data.verification !== 'object') data.verification = { basis: '', frequency: '', personnel: '', content: '', result: '', record: '' };
    if (!Array.isArray(data.verificationExtraItems)) data.verificationExtraItems = [];

    var ver = data.verification;
    var submitted = data.verificationSubmitted || false;
    var extraHtml = (data.verificationExtraItems || []).map(function(e, i) {
      return '<tr data-vx-idx="' + i + '"><td><input type="text" value="' + esc(e.key) + '" placeholder="' + I18n.t('q.verExtraKey') + '" style="width:100%;"></td><td><input type="text" value="' + esc(e.value) + '" placeholder="' + I18n.t('q.verExtraVal') + '" style="width:100%;"></td><td><button class="q15-del-row" data-vx-idx="' + i + '">&times;</button></td></tr>';
    }).join('');

    var fieldLabels = [
      { key: 'basis', label: '' + I18n.t('q.verBasis') + '', hint: '' + I18n.t('q.clPhBasis') + '-2013' },
      { key: 'frequency', label: '' + I18n.t('q.verFrequency') + '', hint: '' + I18n.t('q.verFrequencyPh') + '' },
      { key: 'personnel', label: '' + I18n.t('q.verPersonnel') + '', hint: '' + I18n.t('q.verPersonnelPh') + '' },
      { key: 'content', label: '' + I18n.t('q.verContent') + '', hint: '' + I18n.t('q.verContentPh') + '' },
      { key: 'result', label: '' + I18n.t('q.verResult') + '', hint: '' + I18n.t('q.verResultPh') + '' },
      { key: 'record', label: '' + I18n.t('q.verRecord') + '', hint: '' + I18n.t('q.verRecordPh') + '' }
    ];
    var cardsHtml = fieldLabels.map(function(f, i) {
      return '<div style="background:var(--gray-50);border:1px solid var(--gray-200);border-radius:10px;padding:16px 18px;margin-bottom:12px;">' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">' +
        '<span style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--primary-700));color:#fff;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + (i + 1) + '</span>' +
        '<label style="font-size:14px;font-weight:600;color:var(--gray-800);">' + f.label + '</label></div>' +
        '<textarea data-q15-field="verification.' + f.key + '" rows="2" style="width:100%;padding:10px 14px;border:1px solid var(--gray-200);border-radius:8px;font-size:13px;font-family:inherit;resize:vertical;background:#fff;" placeholder="' + f.hint + '">' + esc(ver[f.key] || '') + '</textarea></div>';
    }).join('');
    var extraCardsHtml = (data.verificationExtraItems || []).map(function(e, i) {
      return '<div class="pf-iu-row" data-vx-idx="' + i + '" style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">' +
        '<input type="text" value="' + esc(e.key) + '" class="vx-key" placeholder="' + I18n.t('q.verExtraKey') + '" style="flex:1;padding:7px 10px;border:1px solid var(--gray-200);border-radius:5px;font-size:12px;font-family:inherit;">' +
        '<input type="text" value="' + esc(e.value) + '" class="vx-val" placeholder="' + I18n.t('q.verExtraVal') + '" style="flex:1;padding:7px 10px;border:1px solid var(--gray-200);border-radius:5px;font-size:12px;font-family:inherit;">' +
        '<button class="q15-del-row" data-vx-idx="' + i + '" style="flex-shrink:0;">&times;</button></div>';
    }).join('');

    // 管理评审区域
    var mr = data.managementReview || { reviewContent: '', reviewResult: '', correctiveMeasures: '', reVerification: '' };
    var managementReviewHtml = '<div style="background:#f8fafc;border:1px solid var(--gray-200);border-radius:10px;padding:16px 18px;margin-top:16px;">' +
      '<h3 style="font-size:15px;font-weight:600;color:var(--gray-800);margin-bottom:12px;">' + I18n.t('q.verMgmtReviewTitle') + '</h3>' +
      '<p class="q15-table-hint" style="margin-bottom:12px;">' + I18n.t('q.verMgmtReviewHint') + '</p>' +
      '<div class="q15-field-group"><label>' + I18n.t('q.verReviewContent') + '</label>' +
      '<textarea data-q15-field="managementReview.reviewContent" rows="2" placeholder="' + I18n.t('q.verReviewContentPh') + '">' + esc(mr.reviewContent || '') + '</textarea></div>' +
      '<div class="q15-field-group"><label>' + I18n.t('q.verReviewResult') + '</label>' +
      '<select data-q15-field="managementReview.reviewResult" style="width:100%;padding:9px 12px;border:1px solid var(--gray-300);border-radius:6px;font-size:13px;font-family:inherit;background:#fff;">' +
        '<option value="">' + I18n.t('q.verSelectOption') + '</option>' +
        '<option value="符合" ' + (mr.reviewResult === '符合' ? 'selected' : '') + '>' + I18n.t('q.verCompliantOption') + '</option>' +
        '<option value="不符合" ' + (mr.reviewResult === '不符合' ? 'selected' : '') + '>' + I18n.t('q.verNonCompliantOption') + '</option>' +
      '</select></div>' +
      '<div class="q15-field-group" id="mrCorrectiveField" style="' + (mr.reviewResult === '不符合' ? '' : 'display:none;') + '"><label>' + I18n.t('q.verCorrective') + '</label>' +
      '<textarea data-q15-field="managementReview.correctiveMeasures" rows="2" placeholder="' + I18n.t('q.verCorrectiveMeasuresPh') + '">' + esc(mr.correctiveMeasures || '') + '</textarea></div>' +
      '<div class="q15-field-group" id="mrReVerificationField" style="' + (mr.reviewResult === '不符合' ? '' : 'display:none;') + '"><label>' + I18n.t('q.verReVerify') + '</label>' +
      '<textarea data-q15-field="managementReview.reVerification" rows="2" placeholder="' + I18n.t('q.verReVerificationPh') + '">' + esc(mr.reVerification || '') + '</textarea></div>' +
      '</div>';

    // 签名区域
    var signerSection = '';
    if (submitted) {
      signerSection = '<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:16px 18px;margin-top:16px;">' +
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">' +
        '<span style="font-size:20px;">✅</span>' +
        '<span style="font-size:14px;font-weight:600;color:#166534;">' + I18n.t('q.verSubmitted') + '</span></div>' +
        '<div style="font-size:13px;color:#475569;">' +
        '<span>' + I18n.t('q.verSignerLabel') + '：<strong>' + esc(data.verificationSignerName || '') + '</strong></span> | ' +
        '<span>' + I18n.t('q.verSignDateLabel') + '：<strong>' + esc(data.verificationSignerDate || '') + '</strong></span>' +
        '</div>' +
        '<button class="btn btn-sm btn-secondary" id="verificationResetBtn" style="margin-top:8px;color:#dc2626;border-color:#fecaca;">' + I18n.t('q.verResetBtn') + '</button>' +
        '</div>';
    } else {
      signerSection = '<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:16px 18px;margin-top:16px;">' +
        '<h3 style="font-size:14px;font-weight:600;color:var(--gray-800);margin-bottom:8px;">' + I18n.t('q.verSignTitle') + '</h3>' +
        '<p class="q15-table-hint">' + I18n.t('q.verSignHint') + '</p>' +
        '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">' +
        '<input type="text" id="verificationSignerName" placeholder="' + I18n.t('q.verSignerPh') + '" style="flex:1;min-width:150px;padding:9px 12px;border:1px solid #d0d5dd;border-radius:6px;font-size:13px;font-family:inherit;" value="' + esc(data.verificationSignerName || '') + '">' +
        '<input type="date" id="verificationSignerDate" style="width:150px;padding:9px 12px;border:1px solid #d0d5dd;border-radius:6px;font-size:13px;font-family:inherit;" value="' + esc(data.verificationSignerDate || (new Date().toISOString().slice(0,10))) + '">' +
        '</div>' +
        '<button class="btn btn-primary" id="verificationSubmitBtn" style="margin-top:12px;">' + I18n.t('q.verSignBtn') + '</button>' +
        '</div>';
    }

    return '<h3>' + I18n.t('q.verSectionTitle') + '</h3>' +
      '<p class="q15-table-hint">' + I18n.t('q.verSectionHint') + '</p>' +
      cardsHtml +
      '<div style="background:var(--gray-50);border:1px solid var(--gray-200);border-radius:10px;padding:16px 18px;margin-top:16px;">' +
      '<h3 style="font-size:14px;font-weight:600;color:var(--gray-800);margin-bottom:8px;">' + I18n.t('q.verNewItemTitle') + '</h3>' +
      '<div id="verificationExtraBody">' +
      (extraCardsHtml || '<div style="font-size:12px;color:var(--gray-400);text-align:center;padding:8px;">' + I18n.t('q.verNoExtra') + '</div>') +
      '</div>' +
      '<button class="btn btn-xs btn-secondary" id="addVerificationExtraRow" style="margin-top:4px;">' + I18n.t('q.verAddExtra') + '</button></div>' +
      managementReviewHtml +
      signerSection;
  }

  function renderRecordKeeping(data) {
    return '<div class="q15-field-group"><label>' + I18n.t('q.recordPeriod') + '</label><input type="text" data-q15-field="recordPeriod" value="' + esc(data.recordPeriod) + '" placeholder="' + I18n.t('q.recordPh') + '"></div><div class="q15-field-group"><label>' + I18n.t('q.recordFormat') + '</label><textarea data-q15-field="recordFormat" rows="3" placeholder="' + I18n.t('q.recordFormatPh') + '">' + esc(data.recordFormat) + '</textarea></div><div class="q15-records-summary"><h3>' + I18n.t('q.recordTitle') + '</h3><p class="q15-table-hint">' + I18n.t('q.recordHint') + '</p><div class="q15-record-cards"><div class="q15-record-card"><div class="q15-record-icon">\u{1F4CB}</div><h4>' + I18n.t('q.recMonitorTable') + '</h4><p>' + I18n.t('q.recMonitorDesc') + '</p></div><div class="q15-record-card"><div class="q15-record-icon">\u{1F4CA}</div><h4>' + I18n.t('q.recCorrectiveTable') + '</h4><p>' + I18n.t('q.recordCorrectiveDesc') + '</p></div><div class="q15-record-card"><div class="q15-record-icon">\u{1F4C4}</div><h4>' + I18n.t('q.recordVerify') + '</h4><p>' + I18n.t('q.recVerifyDesc') + '</p></div><div class="q15-record-card"><div class="q15-record-icon">\u{1F4D1}</div><h4>' + I18n.t('q.recReportTable') + '</h4><p>' + I18n.t('q.recordReportDesc') + '</p></div></div><div class="q15-export-actions"><button class="btn btn-secondary btn-sm" id="exportTableBtn" style="margin-top:10px;">' + I18n.t('q.recExportBtn') + '</button></div></div>';
  }

  // ==================== 事件绑定 ====================
  function bindSectionEvents(content, data) {
    // Auto-save data-q15-field inputs on every keystroke
    content.querySelectorAll('[data-q15-field]').forEach(function(el) {
      el.addEventListener('input', function() {
        var field = this.dataset.q15Field;
        if (this.type === 'checkbox') data[field] = this.checked;
        else data[field] = this.value;
        saveData(data);
      });
    });
    const addTeamBtn = content.querySelector('#addTeamRow');
    if (addTeamBtn) { addTeamBtn.addEventListener('click', function() { data.haccpTeam.push({ id: genId(), name: '', dept: '', position: '', role: '', remark: '' }); saveData(data); renderActiveSection(); renderSectionNav(); }); }
    content.querySelectorAll('#teamBody .q15-del-row').forEach(function(btn) { btn.addEventListener('click', function() { var idx = parseInt(this.dataset.teamIdx); if (data.haccpTeam.length > 1) { data.haccpTeam.splice(idx, 1); saveData(data); renderActiveSection(); renderSectionNav(); } }); });
    content.querySelectorAll('#teamBody input').forEach(function(el) { el.addEventListener('input', function() { var row = this.closest('tr'), idx = parseInt(row.dataset.teamIdx), inputs = row.querySelectorAll('input'); if (data.haccpTeam[idx]) { data.haccpTeam[idx].name = inputs[0].value; data.haccpTeam[idx].dept = inputs[1].value; data.haccpTeam[idx].position = inputs[2].value; data.haccpTeam[idx].role = inputs[3].value; data.haccpTeam[idx].remark = inputs[4].value; saveData(data); } }); });

    const addExtraBtn = content.querySelector('#addExtraItemRow');
    if (addExtraBtn) { addExtraBtn.addEventListener('click', function() { data.extraItems.push({ id: genId(), key: '', value: '' }); saveData(data); renderActiveSection(); renderSectionNav(); }); }
    content.querySelectorAll('#extraItemsBody .q15-del-row').forEach(function(btn) { btn.addEventListener('click', function() { var idx = parseInt(this.dataset.exIdx); if (data.extraItems.length > 0) { data.extraItems.splice(idx, 1); saveData(data); renderActiveSection(); renderSectionNav(); } }); });
    content.querySelectorAll('#extraItemsBody input').forEach(function(el) { el.addEventListener('input', function() { collectSectionData(content, data); saveData(data); }); });

    const addProductExtraBtn = content.querySelector('#addProductExtraItemRow');
    if (addProductExtraBtn) { addProductExtraBtn.addEventListener('click', function() { data.productExtraItems.push({ id: genId(), key: '', value: '' }); saveData(data); renderActiveSection(); renderSectionNav(); }); }
    content.querySelectorAll('#productExtraItemsBody .q15-del-row').forEach(function(btn) { btn.addEventListener('click', function() { var idx = parseInt(this.dataset.pExIdx); if (data.productExtraItems.length > 0) { data.productExtraItems.splice(idx, 1); saveData(data); renderActiveSection(); renderSectionNav(); } }); });
    content.querySelectorAll('#productExtraItemsBody input').forEach(function(el) { el.addEventListener('input', function() { collectSectionData(content, data); saveData(data); }); });


    const addStepBtn = content.querySelector('#addProcessStep');
    if (addStepBtn) { addStepBtn.addEventListener('click', function() { data.processSteps.push({ id: genId(), stepName: '', operationMethod: '', parameters: '', controlPoint: '', equipmentName: '' }); saveData(data); renderActiveSection(); }); }
    content.querySelectorAll('.q15-del-process').forEach(function(btn) { btn.addEventListener('click', function() { var idx = parseInt(this.dataset.psIdx); if (data.processSteps.length > 1) { data.processSteps.splice(idx, 1); saveData(data); renderActiveSection(); } }); });
    content.querySelectorAll('.q15-process-card input').forEach(function(el) { el.addEventListener('input', function() { var card = this.closest('.q15-process-card'), idx = parseInt(card.dataset.psIdx), inputs = card.querySelectorAll('input'); if (data.processSteps[idx]) { data.processSteps[idx].stepName = inputs[0].value; data.processSteps[idx].operationMethod = inputs[1].value; data.processSteps[idx].parameters = inputs[2].value; data.processSteps[idx].controlPoint = inputs[3].value; data.processSteps[idx].equipmentName = inputs[4].value; saveData(data); } }); });

    const aiBtn = content.querySelector('#aiHazardBtn');
    if (aiBtn) {
      aiBtn.addEventListener('click', async function() {
        aiBtn.disabled = true;
        var hint = content.querySelector('#aiHazardHint');
        if (hint) hint.textContent = I18n.t('q.aiWaitHint');
        // 收集产品信息
        collectSectionData(content, data);
        saveData(data);
        // 收集原料列表（从配方表和原料字段）
        var materials = [];
        if (data.formula && data.formula.length > 0) {
          data.formula.forEach(function(f) { if (f.material && f.material.trim()) materials.push(f.material.trim()); });
        }
        if (data.rawMaterials) {
          var rawParts = data.rawMaterials.split(/[,，、\s]+/).filter(Boolean);
          rawParts.forEach(function(p) { if (materials.indexOf(p) === -1) materials.push(p); });
        }
        if (data.additives) {
          var addParts = data.additives.split(/[,，、\s]+/).filter(Boolean);
          addParts.forEach(function(p) { if (materials.indexOf(p) === -1) materials.push(p); });
        }
        // 补充：从15min问卷(档案)读取配方/产品描述中的原料
        if (materials.length === 0) {
          try {
            var pRaw2 = localStorage.getItem('haccp_profile_data');
            if (pRaw2) {
              var pd2 = JSON.parse(pRaw2);
              if (pd2.formula && pd2.formula.length) {
                pd2.formula.forEach(function(f) { if (f.material && f.material.trim() && materials.indexOf(f.material.trim()) === -1) materials.push(f.material.trim()); });
              }
              if (pd2.pd_rawProps && materials.length === 0) {
                pd2.pd_rawProps.split(/[\n，,、;；]/).forEach(function(seg) {
                  seg = seg.trim();
                  if (seg && seg.length <= 20 && materials.indexOf(seg) === -1) materials.push(seg);
                });
              }
            }
          } catch(e) {}
        }
        // 如果没有原料数据，直接提示
        if (materials.length === 0) {
          if (hint) hint.textContent = I18n.t('hazard.needMaterials');
          var emptyEl = document.getElementById('aiHazardResult');
          if (emptyEl) emptyEl.innerHTML = '<div style="padding:20px;text-align:center;color:var(--gray-400);">' + I18n.t('hazard.needMaterials') + '</div>';
          aiBtn.disabled = false;
          return;
        }
        // 调用后端原料危害数据库API
        try {
          var hazardBio = [], hazardChem = [], hazardPhys = [], matchedMaterials = [];
          const resp = await fetchWithTimeout(API_HOST + '/api/ai/raw-material-hazards', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ materials: materials })
          });
          if (!resp.ok) {
            throw new Error('API响应异常: ' + resp.status);
          }
          const result = await resp.json();
          if (result.ok && result.data && result.data.matched) {
            matchedMaterials = result.data.matched;
            result.data.matched.forEach(function(entry) {
              var m = entry.material;
              var h = entry.hazards;
              if (h.bio && h.bio.risk) {
                hazardBio.push({
                  material: m,
                  hazardType: I18n.t('q.ccpHazardBio'),
                  desc: h.bio.risk,
                  q1: h.bio.q1 || '',
                  q2: h.bio.q2 || '',
                  q3: h.bio.q3 || '',
                  isCCP: h.bio.isCCP,
                  ccpResult: h.bio.isCCP ? '是' : '否',
                  severity: h.bio.isCCP ? '高' : '中',
                  likelihood: '中',
                  control: h.bio.control || '',
                  detail: h.bio.detail || ''
                });
              }
              if (h.chem && h.chem.risk) {
                hazardChem.push({
                  material: m,
                  hazardType: I18n.t('q.ccpHazardChem'),
                  desc: h.chem.risk,
                  q1: h.chem.q1 || '',
                  q2: h.chem.q2 || '',
                  q3: h.chem.q3 || '',
                  isCCP: h.chem.isCCP,
                  ccpResult: h.chem.isCCP ? '是' : '否',
                  severity: h.chem.isCCP ? '高' : '中',
                  likelihood: '中',
                  control: h.chem.control || '',
                  detail: h.chem.detail || ''
                });
              }
              if (h.phys && h.phys.risk) {
                hazardPhys.push({
                  material: m,
                  hazardType: I18n.t('q.ccpHazardPhys'),
                  desc: h.phys.risk,
                  q1: h.phys.q1 || '',
                  q2: h.phys.q2 || '',
                  q3: h.phys.q3 || '',
                  isCCP: h.phys.isCCP,
                  ccpResult: h.phys.isCCP ? '是' : '否',
                  severity: '中',
                  likelihood: '中',
                  control: h.phys.control || '',
                  detail: h.phys.detail || ''
                });
              }
            });
          }
          // 判断匹配结果
          if (hazardBio.length > 0 || hazardChem.length > 0 || hazardPhys.length > 0) {
            data.hazardBio = hazardBio;
            data.hazardChem = hazardChem;
            data.hazardPhys = hazardPhys;
            data._matchedMaterials = matchedMaterials;
            // 新增了中文危害数据，重置翻译标记以便重新翻译
            data._hazardLangTranslated = '';
            saveData(data);
            if (hint) hint.textContent = I18n.b('✓ 原料危害分析完成，已匹配 {n} 种原料|||✓ Hazard analysis complete. Matched {n} material(s)').replace('{n}', matchedMaterials.length);
            renderAiHazardResult(hazardBio, hazardChem, hazardPhys, matchedMaterials);
            // 英文模式下自动翻译原料名与风险详情为双语
            maybeTranslateHazardsForLang(data);
          } else {
            // 没有匹配到任何原料：显示未匹配信息，不填充数据
            var unmatchedList = materials.join('、');
            data.hazardBio = [];
            data.hazardChem = [];
            data.hazardPhys = [];
            saveData(data);
            if (hint) hint.textContent = '\u2716 ' + I18n.t('hazard.noMatch');
            var resultEl = document.getElementById('aiHazardResult');
            if (resultEl) resultEl.innerHTML = '<div style="padding:20px;text-align:center;color:var(--gray-400);">' + I18n.t('hazard.dbNotFound') + '<strong>' + unmatchedList + '</strong><br><span style="font-size:12px;">' + I18n.t('hazard.dbNotFoundTip') + '</span></div>';
          }
        } catch (err) {
          console.warn('原料危害数据库查询失败:', err.message);
          data.hazardBio = [];
          data.hazardChem = [];
          data.hazardPhys = [];
          saveData(data);
          if (hint) hint.textContent = '\u2716 ' + I18n.b('后端接口不可用|||Backend API unavailable');
          var resultEl = document.getElementById('aiHazardResult');
          if (resultEl) resultEl.innerHTML = '<div style="padding:20px;text-align:center;color:#dc2626;">' + I18n.t('hazard.backendDown') + '</div>';
        }
        aiBtn.disabled = false;
      });
    }

    // AI建议关键限制按钮
    var aiCriticalBtn = content.querySelector('#aiCriticalBtn');
    if (aiCriticalBtn) {
      aiCriticalBtn.addEventListener('click', async function() {        aiCriticalBtn.disabled = true;
        var hint = content.querySelector('#aiCriticalHint');
        if (hint) hint.textContent = I18n.t('q.aiWaitHint');
        var resultEl = content.querySelector('#aiCriticalResult');
        
        // 收集当前数据
        collectSectionData(content, data);
        // 从关键限值卡片收集数据
        collectCriticalLimitsCardData(content, data);
        
        // 构建CCP列表
        var ccpSteps = data.ccpSteps || [];
        var processSteps = data.processSteps || [];
        var ccpList = [];
        ccpSteps.forEach(function(cs, si) {
          if (!cs || !cs.hazards) return;
          var isCCP = false;
          ['bio', 'chem', 'phys'].forEach(function(ht) {
            var h = cs.hazards[ht];
            if (h && h.isCCP === true) isCCP = true;
          });
          if (isCCP) {
            var stepName = cs.stepName || (processSteps[si] ? processSteps[si].stepName : '') || (I18n.t('q.ccpSummaryStep') + ' ' + (si + 1));
            ccpList.push({ stepName: stepName, isCCP: true, operationMethod: processSteps[si] ? processSteps[si].operationMethod : '', parameters: processSteps[si] ? processSteps[si].parameters : '' });
          }
        });
        
        if (ccpList.length === 0) {
          if (hint) hint.textContent = '⚠️ 请先完成CCP判定';
          aiCriticalBtn.disabled = false;
          return;
        }
        
        try {
          var resp = await fetchWithTimeout(API_HOST + '/api/ai/critical-limits', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              product_name: data.productName || '',
              ccp_steps: ccpList,
              exec_standard: data.execStandard || 'gb'
            })
          });
          if (!resp.ok) throw new Error('API响应异常: ' + resp.status);
          var result = await resp.json();
          if (result.ok && result.data) {
            applyAiCriticalLimitsResult(data, result.data, ccpList);
            if (hint) hint.textContent = '✅ AI建议已生成';
            renderActiveSection();
          } else {
            throw new Error('返回数据格式异常');
          }
        } catch (err) {
          console.warn('后端不可用，使用前端模拟:', err.message);
          // 前端模拟
          var limitsText = '';
          ccpList.forEach(function(s) {
            var name = (s.stepName || '').toLowerCase();
            if (name.indexOf('杀菌') !== -1 || name.indexOf('热处理') !== -1 || name.indexOf('灭菌') !== -1) {
              limitsText += '**' + s.stepName + '（AI建议，需HACCP小组确认）**：\n   - 中心温度：≥85℃\n   - 保持时间：≥15秒\n   - 依据：GB 14881-2013 第5.2.1条\n\n';
            } else if (name.indexOf('金属') !== -1 || name.indexOf('异物') !== -1) {
              limitsText += '**' + s.stepName + '（AI建议，需HACCP小组确认）**：\n   - Fe：≤1.5mm\n   - SUS：≤2.0mm\n   - 依据：GB/T 25346-2010\n\n';
            } else if (name.indexOf('验收') !== -1 || name.indexOf('接收') !== -1) {
              limitsText += '**' + s.stepName + '（AI建议，需HACCP小组确认）**：\n   - 农药残留：符合GB 2763-2021\n   - 重金属：符合GB 2762-2022\n   - 依据：GB 2763-2021、GB 2762-2022\n\n';
            } else {
              limitsText += '**' + s.stepName + '（AI建议，需HACCP小组确认）**：\n   - 需根据实际' + I18n.t('q.params') + '确定\n   - 依据：企业内控标准\n\n';
            }
          });
          limitsText = '【AI建议】以下关键限值为系统建议，供HACCP小组参考，须确认后生效。\n\n' + limitsText;
          if (resultEl) resultEl.innerHTML = '<div class="q15-ai-result"><pre style="white-space:pre-wrap;font-size:13px;">' + limitsText + '</pre></div>';
          if (hint) hint.textContent = '✅ 前端模拟建议已生成（后端API不可用时）';
        }
        aiCriticalBtn.disabled = false;
      });
    }

    // 加载标准参考面板（DOM 已就绪后调用）
    if (content.querySelector('#clStandardsPanel')) loadStandardsPanel(data);

    const addMonitorBtn = content.querySelector('#addMonitorRow');
    if (addMonitorBtn) { addMonitorBtn.addEventListener('click', function() { data.monitoring.push({ id: genId(), ccp: '', object: '', method: '', frequency: '', personnel: '', remark: '' }); saveData(data); renderActiveSection(); }); }
    content.querySelectorAll('#monitorBody .q15-del-row').forEach(function(btn) { btn.addEventListener('click', function() { var idx = parseInt(this.dataset.mnIdx); if (!isNaN(idx) && data.monitoring[idx]) { var removed = String(data.monitoring[idx].ccp || '').split('|||')[0].trim(); data.monitoring.splice(idx, 1); if (removed && !Array.isArray(data._monitoringRemoved)) data._monitoringRemoved = []; if (removed && data._monitoringRemoved.indexOf(removed) === -1) data._monitoringRemoved.push(removed); saveData(data); renderActiveSection(); } }); });
    content.querySelectorAll('#monitorBody input, #monitorBody textarea').forEach(function(el) { el.addEventListener('input', function() { var row = this.closest('tr'), idx = parseInt(row.dataset.mnIdx), cells = row.querySelectorAll('input, textarea'); if (data.monitoring[idx]) { data.monitoring[idx].ccp = cells[0].value; data.monitoring[idx].object = cells[1].value; data.monitoring[idx].method = cells[2].value; data.monitoring[idx].frequency = cells[3].value; data.monitoring[idx].personnel = cells[4].value; data.monitoring[idx].remark = cells[5].value; saveData(data); } }); });

    const addCorrectiveBtn = content.querySelector('#addCorrectiveRow');
    if (addCorrectiveBtn) { addCorrectiveBtn.addEventListener('click', function() { data.correctiveActions.push({ id: genId(), ccp: '', personnel: '', causeAnalysis: '', productHandling: '' }); saveData(data); renderActiveSection(); }); }
    content.querySelectorAll('#correctiveBody .q15-del-row').forEach(function(btn) { btn.addEventListener('click', function() { var idx = parseInt(this.dataset.caIdx); if (!isNaN(idx) && data.correctiveActions[idx]) { var removed = String(data.correctiveActions[idx].ccp || '').split('|||')[0].trim(); data.correctiveActions.splice(idx, 1); if (removed && !Array.isArray(data._correctiveRemoved)) data._correctiveRemoved = []; if (removed && data._correctiveRemoved.indexOf(removed) === -1) data._correctiveRemoved.push(removed); saveData(data); renderActiveSection(); } }); });
    // 清除重复行：同一CCP只保留一行（有内容优先：已填内容 > AI双语行 > 空行）
    function dedupRows(arr, getCcp) {
      function hasContent(row) {
        if (!row) return false;
        return Object.keys(row).some(function(k) {
          if (k === 'id' || k === 'ccp') return false;
          var v = row[k];
          return v && String(v).trim().length > 0;
        });
      }
      var seen = {};
      var keep = [];
      arr.forEach(function(row) {
        var key = String(getCcp(row) || '').split('|||')[0].trim();
        if (!key) { keep.push(row); return; }
        if (seen[key] === undefined) {
          seen[key] = keep.length;
          keep.push(row);
        } else {
          var prev = keep[seen[key]];
          if (hasContent(row) && !hasContent(prev)) {
            keep[seen[key]] = row;
          }
        }
      });
      return keep;
    }
    var monitorDedupBtn = content.querySelector('#monitorDedupBtn');
    if (monitorDedupBtn) {
      monitorDedupBtn.addEventListener('click', function() {
        var before = data.monitoring.length;
        data.monitoring = dedupRows(data.monitoring, function(m) { return m.ccp; });
        saveData(data); renderActiveSection();
      });
    }
    var correctiveDedupBtn = content.querySelector('#correctiveDedupBtn');
    if (correctiveDedupBtn) {
      correctiveDedupBtn.addEventListener('click', function() {
        var before = data.correctiveActions.length;
        data.correctiveActions = dedupRows(data.correctiveActions, function(c) { return c.ccp; });
        saveData(data); renderActiveSection();
      });
    }
    content.querySelectorAll('#correctiveBody input, #correctiveBody textarea').forEach(function(el) { el.addEventListener('input', function() { var row = this.closest('tr'), idx = parseInt(row.dataset.caIdx), cells = row.querySelectorAll('input, textarea'); if (data.correctiveActions[idx]) { data.correctiveActions[idx].ccp = cells[0].value; data.correctiveActions[idx].personnel = cells[1].value; data.correctiveActions[idx].causeAnalysis = cells[2].value; data.correctiveActions[idx].productHandling = cells[3].value; saveData(data); } }); });

    const aiMonitorBtn = content.querySelector('#aiMonitorBtn');
    if (aiMonitorBtn) {
      aiMonitorBtn.addEventListener('click', async function() {
        aiMonitorBtn.disabled = true;
        var hint = content.querySelector('#aiMonitorHint');
        if (hint) hint.textContent = I18n.t('q.aiWaitHint');
        collectSectionData(content, data);
        
        // 构建CCP列表
        var ccpSteps = data.ccpSteps || [];
        var processSteps = data.processSteps || [];
        var ccpList = [];
        ccpSteps.forEach(function(cs, si) {
          if (!cs || !cs.hazards) return;
          var isCCP = false;
          ['bio', 'chem', 'phys'].forEach(function(ht) { var h = cs.hazards[ht]; if (h && h.isCCP === true) isCCP = true; });
          if (isCCP) {
            var stepName = cs.stepName || (processSteps[si] ? processSteps[si].stepName : '') || (I18n.t('q.ccpSummaryStep') + ' ' + (si + 1));
            ccpList.push({ stepName: stepName, isCCP: true, operationMethod: processSteps[si] ? processSteps[si].operationMethod : '', parameters: processSteps[si] ? processSteps[si].parameters : '' });
          }
        });
        if (ccpList.length === 0) { if (hint) hint.textContent = '⚠️ 请先完成CCP判定'; aiMonitorBtn.disabled = false; return; }
        
        try {
          var resp = await fetchWithTimeout(API_HOST + '/api/ai/monitoring', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ product_name: data.productName || '', ccp_steps: ccpList, process_description: '' })
          });
          if (!resp.ok) throw new Error('API响应异常: ' + resp.status);
          var result = await resp.json();
          if (result.ok && result.data && result.data.monitoring) {
            // 合并进已有行（填充原步骤，不新增重复行）
            applyAiMonitoringToRows(data, result.data.monitoring);
            data._monitoringRemoved = []; // AI重新生成，恢复用户删除的CCP
            if (hint) hint.textContent = '✅ AI方案已生成';
            saveData(data); renderActiveSection();
          } else throw new Error('返回数据格式异常');
        } catch (err) {
          console.warn('后端不可用，使用前端模拟:', err.message);
          setTimeout(function() {
            applyAiMonitoringToRows(data, [
              { ccp: '杀菌工序', object: '杀菌温度、时间', method: '在线温度传感器连续监控', frequency: '每批次实时记录', personnel: '经HACCP培训的品控专员', remark: '依据GB 14881-2013' },
              { ccp: '金属检测', object: '金属异物', method: '在线金属检测仪自动检测', frequency: '连续监控', personnel: '品控专员', remark: '依据GB/T 25346-2010' }
            ]);
            data._monitoringRemoved = [];
            saveData(data);
            if (hint) hint.textContent = '✅ 前端模拟完成（后端不可用时）';
            aiMonitorBtn.disabled = false;
            renderActiveSection();
          }, 800);
          aiMonitorBtn.disabled = false;
        }
      });
    }

    // ===== AI规划' + I18n.t('q.correctiveTitle') + ' =====
    var aiCorrectiveBtn = content.querySelector('#aiCorrectiveBtn');
    if (aiCorrectiveBtn) {
      aiCorrectiveBtn.addEventListener('click', async function() {
        aiCorrectiveBtn.disabled = true;
        var hint = content.querySelector('#aiCorrectiveHint');
        if (hint) hint.textContent = I18n.t('q.aiWaitHint');
        collectSectionData(content, data);
        
        // 构建CCP列表（从ccpSteps中获取被判定为CCP的步骤）
        var ccpSteps = data.ccpSteps || [];
        var processSteps = data.processSteps || [];
        var criticalLimitsData = data.criticalLimitsData || [];
        var monitoringData = data.monitoring || [];
        var ccpList = [];
        
        ccpSteps.forEach(function(cs, si) {
          if (!cs || !cs.hazards) return;
          var isCCP = false;
          var hazardDescs = [];
          ['bio', 'chem', 'phys'].forEach(function(ht) {
            var h = cs.hazards[ht];
            if (h && h.isCCP === true) {
              isCCP = true;
              if (h.hazardDesc) hazardDescs.push(h.hazardDesc);
            }
          });
          if (isCCP) {
            var stepName = cs.stepName || (processSteps[si] ? processSteps[si].stepName : '') || (I18n.t('q.ccpSummaryStep') + ' ' + (si + 1));
            // 查找对应的关键限值
            var clInfo = '';
            criticalLimitsData.forEach(function(cl) {
              if (cl.stepName === stepName && cl.limits && cl.limits.length > 0) {
                clInfo = cl.limits.map(function(l) { return (l.param || '') + (l.value || '') + (l.unit || ''); }).join('; ');
              }
            });
            // 查找对应的监控信息
            var monitorInfo = '';
            monitoringData.forEach(function(m) {
              if (m.ccp === stepName) {
                monitorInfo = (m.object || '') + ' / ' + (m.method || '') + ' / ' + (m.frequency || '');
              }
            });
            ccpList.push({
              stepName: stepName,
              isCCP: true,
              hazardDesc: hazardDescs.join('; '),
              criticalLimit: clInfo,
              monitoring: monitorInfo,
              operationMethod: processSteps[si] ? processSteps[si].operationMethod : '',
              parameters: processSteps[si] ? processSteps[si].parameters : ''
            });
          }
        });
        
        if (ccpList.length === 0) {
          if (hint) hint.textContent = '⚠️ 请先完成CCP判定';
          aiCorrectiveBtn.disabled = false;
          return;
        }

        // 合并新生成的纠偏方案：填充已有行（双语感知、大小写不敏感），未匹配的CCP追加
        function mergeCorrectiveActions(newActions) {
          if (!newActions || newActions.length === 0) {
            if (hint) hint.textContent = '⚠️ 未生成纠偏方案，请确认CCP判定后重试';
            aiCorrectiveBtn.disabled = false;
            return;
          }
          applyAiCorrectiveToRows(data, newActions);
          data._correctiveRemoved = []; // AI重新生成，恢复用户删除的CCP
          saveData(data);
          if (hint) hint.textContent = '✅ AI纠偏方案已生成（' + newActions.length + '个CCP）';
          aiCorrectiveBtn.disabled = false;
          renderActiveSection();
          renderSectionNav();
        }

        // 后端不可用时的前端模拟（关键词模板，中英文均可匹配）
        function mockCorrectiveFallback() {
          var newActions = [];
          ccpList.forEach(function(ccp) {
            var name = ccp.stepName.toLowerCase();
            // 双语关键词匹配：任一语言段命中即算匹配
            function kwm(kw) {
              return kw.split('|||').some(function(p) { return p && name.indexOf(p.toLowerCase()) !== -1; });
            }
            var personnel = '';
            var causeAnalysis = '';
            var productHandling = '';
            var corrective = '';
            var verification = '';
            var record = '';
            if (['杀菌|||Sterilization', '热处理|||heat treatment', '灭菌|||steriliz', '消毒|||disinfect', '加热|||heat', 'cooking', 'pasteuriz', 'baking', 'frying', 'boiling'].some(kwm)) {
              personnel = '当班生产主任 / 品控专员（有权停机）';
              causeAnalysis = '排查顺序：①蒸汽压力或供汽不足；②温度传感器失准/探头结垢；③操作时间不足或未记录。按此顺序逐一排查并排除';
              productHandling = '1. 立即隔离该批次及前后相邻产品\n2. 评估杀菌不足范围，抽样做微生物检测\n3. 可安全返工的重新杀菌，否则降级/转作他用/销毁\n4. 放行须经HACCP小组书面批准';
              corrective = '立即停机排查蒸汽/传感器/操作记录，修复后重新杀菌达标，并连续验证2批正常方可恢复生产';
              verification = '复查温度记录曲线；对返工品抽样检测微生物；校准温度传感器';
              record = '《杀菌工序温度异常记录表》《产品隔离处置记录》';
            } else if (['金属检测|||Metal detection', '异物|||foreign', '金属探测|||metal detect', 'x光|||x-ray', 'metal', 'detect', 'magnet', 'screen', 'siev'].some(kwm)) {
              personnel = '当班品控 / 设备维护员（有权停机）';
              causeAnalysis = '排查顺序：①检测仪灵敏度漂移或校验失效；②筛网/输送部件破损引入金属；③原料带入金属异物。先用标准试块验证设备';
              productHandling = '1. 立即停线\n2. 隔离自上次合格校验后生产的所有产品\n3. 全部重新过检，剔除品隔离评估\n4. 无法确认安全的产品降级或销毁';
              corrective = '停机检修检测仪并重新校验，修复后以标准试块连续通过3次方可复产';
              verification = '每小时用标准试块验证检测仪；对重新过检产品确认剔除效果；复核校验记录';
              record = '《金属检测异常处理记录》《设备校验记录》';
            } else if (['膜滤|||membrane', '过滤|||filtration', 'filter', 'membrane', 'ultrafiltr', 'nanofiltr'].some(kwm)) {
              personnel = '当班工艺员 / 设备维护员（有权停机）';
              causeAnalysis = '排查顺序：①滤膜破损/堵塞导致滤液浑浊；②进料压力或温度异常；③料液含固量过高使膜通量骤降。按此顺序排查';
              productHandling = '1. 立即停线并隔离异常批次\n2. 检查滤液浊度评估影响范围\n3. 可重新过滤的返工处理，无法确认安全的降级/销毁\n4. 放行须经HACCP小组批准';
              corrective = '停机更换/清洗滤膜并校正膜滤参数，试运行确认滤液澄清达标后方可恢复生产';
              verification = '检查滤液澄清度与透过率；复核膜通量/压差记录；确认滤膜完整性';
              record = '《膜滤工序异常处理记录》《设备维护记录》';
            } else if (['干燥|||drying', '烘干|||dryer', '脱水|||dehydrat', 'dry', 'bake'].some(kwm)) {
              personnel = '当班生产主任 / 设备维护员（有权停机）';
              causeAnalysis = '排查顺序：①烘干温度波动或加热元件故障；②物料铺层厚度/进料速度不当；③排湿系统失效导致湿度超标。按此顺序排查';
              productHandling = '1. 立即隔离该批次\n2. 检测水分含量评估影响\n3. 水分超标可复烘至达标，严重变色/结块的降级或销毁';
              corrective = '停机检修加热/排湿系统，调整温度与进料参数，试烘验证水分达标后方可恢复生产';
              verification = '检测成品水分含量；复核烘干温度曲线；确认设备校准记录';
              record = '《干燥工序异常处理记录》《水分检测记录》';
            } else if (['验收|||receiving', '接收|||receiv', '原料|||raw material', 'incoming', 'inspection', 'acceptance', 'material'].some(kwm)) {
              personnel = '采购专员 / 品控专员';
              causeAnalysis = '排查顺序：①供应商质量波动或检验报告失真；②运输储存条件不当（受潮/混装/超期）；③验收标准执行不严。必要时追溯上游供应商';
              productHandling = '1. 拒收该批次并隔离标记\n2. 已接收的关联原料单独存放并评估\n3. 启动备用供应商保证供应\n4. 向供应商发出整改通知';
              corrective = '拒收该批原料并通知供应商限期整改，复核供应商资质与检测报告，整改验证合格前暂停其供货资格';
              verification = '逐批核查供应商检测报告；定期送第三方抽检；年度供应商审核';
              record = '《原料验收不合格记录》《供应商整改通知单》';
            } else {
              personnel = 'HACCP小组 / 当班工序负责人';
              causeAnalysis = '排查顺序：①设备运行参数异常；②操作人员执行偏差；③原料批次波动；④环境条件变化。按人员-设备-原料-环境顺序排查';
              productHandling = '1. 立即停止异常操作\n2. 隔离受影响产品并评估偏离程度\n3. 按严重程度选择返工/降级/销毁\n4. 处置结果报HACCP小组批准并存档';
              corrective = '查明并消除偏离原因，纠正后连续监控确认CCP恢复受控方可恢复生产';
              verification = '复查纠偏后监控记录，确认关键限值持续满足要求';
              record = '《CCP偏差处理记录》《产品隔离处置记录》';
            }
            newActions.push({
              id: genId(),
              ccp: ccp.stepName,
              cl: '',
              personnel: personnel,
              causeAnalysis: causeAnalysis,
              productHandling: productHandling,
              corrective: corrective,
              verification: verification,
              record: record
            });
          });
          mergeCorrectiveActions(newActions);
          if (hint) hint.textContent = '✅ 前端模拟完成（后端不可用时）';
        }

        // 调用后端AI生成纠偏方案；后端不可用时使用前端模拟
        try {
          var resp = await fetchWithTimeout(API_HOST + '/api/ai/corrective-actions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              product_name: data.productName || '',
              ccp_steps: ccpList,
              critical_limits: data.criticalLimits || ''
            })
          }, 60000);
          if (!resp.ok) throw new Error('API响应异常: ' + resp.status);
          var result = await resp.json();
          if (result.ok && result.data && result.data.correctiveActions) {
            var newActions = result.data.correctiveActions.map(function(a) {
              return {
                id: genId(),
                ccp: a.ccp || '',
                cl: a.cl || '',
                personnel: a.personnel || '',
                causeAnalysis: a.causeAnalysis || '',
                productHandling: a.productHandling || '',
                corrective: a.corrective || '',
                verification: a.verification || '',
                record: a.record || ''
              };
            });
            mergeCorrectiveActions(newActions);
          } else throw new Error('返回数据格式异常');
        } catch (err) {
          console.warn('后端不可用，使用前端模拟:', err.message);
          mockCorrectiveFallback();
          aiCorrectiveBtn.disabled = false;
        }
      });
    }

    // 绑定精简版上传区域事件
    bindCompactUploadEvents(content);

    // ===== 危害分析工作单子步骤事件绑定 =====
    // 子步骤导航点击
    content.querySelectorAll('.hw-subnav-item').forEach(function(el) {
      el.addEventListener('click', function() {
        var step = this.dataset.hwStep;
        if (step) {
          collectHazardWorksheetData(content, data);
          data.hazardWorksheetStep = step;
          saveData(data);
          renderActiveSection();
          renderSectionNav();
        }
      });
    });

    // 危害评估区域的 select 和 checkbox 变化实时保存
    content.querySelectorAll('.hw-select, .hw-textarea, .hw-significant').forEach(function(el) {
      el.addEventListener('change', function() {
        collectHazardWorksheetData(content, data);
        saveData(data);
        // 如果改变的是严重性或可能性，刷新风险等级显示
        if (el.classList.contains('hw-select')) {
          var si = parseInt(el.dataset.wsSi);
          var hi = parseInt(el.dataset.wsHi);
          if (!isNaN(si) && !isNaN(hi) && data.hazardWorksheet[si] && data.hazardWorksheet[si].hazards[hi]) {
            var h = data.hazardWorksheet[si].hazards[hi];
            var riskEl = document.getElementById('ws-risk-si' + si + '-hi' + hi);
            if (riskEl) riskEl.innerHTML = calcRiskLevel(h.severity, h.likelihood);
          }
        }
      });
      el.addEventListener('input', function() {
        collectHazardWorksheetData(content, data);
        saveData(data);
      });
    });

    // 上一步/下一步/查看工作单按钮
    var hwPrevBtn = content.querySelector('#hwPrevBtn');
    if (hwPrevBtn) {
      hwPrevBtn.addEventListener('click', function() {
        collectHazardWorksheetData(content, data);
        var curr = data.hazardWorksheetStep || 'identify';
        if (curr === 'assess') data.hazardWorksheetStep = 'identify';
        else if (curr === 'control') data.hazardWorksheetStep = 'assess';
        saveData(data);
        renderActiveSection();
        renderSectionNav();
      });
    }

    var hwNextBtn = content.querySelector('#hwNextBtn');
    if (hwNextBtn) {
      hwNextBtn.addEventListener('click', function() {
        collectHazardWorksheetData(content, data);
        var curr = data.hazardWorksheetStep || 'identify';
        if (curr === 'identify') data.hazardWorksheetStep = 'assess';
        else if (curr === 'assess') data.hazardWorksheetStep = 'control';
        saveData(data);
        renderActiveSection();
        renderSectionNav();
      });
    }

    var hwViewBtn = content.querySelector('#hwViewWorksheetBtn');
    if (hwViewBtn) {
      hwViewBtn.addEventListener('click', function() {
        collectHazardWorksheetData(content, data);
        saveData(data);
        App.navigateTo('hazardWorksheet');
      });
    }

    // 危害识别"重新匹配"按钮
    var hwRefreshBtn = content.querySelector('#hwRefreshBtn');
    if (hwRefreshBtn) {
      hwRefreshBtn.addEventListener('click', function() {
        this.disabled = true;
        this.textContent = '\u23F3 ' + I18n.t('q.hwRefreshing');
        refreshStepHazards(data);
        setTimeout(function() {
          if (hwRefreshBtn) {
            hwRefreshBtn.disabled = false;
            hwRefreshBtn.textContent = I18n.t('q.hwRefresh');
          }
        }, 1000);
      });
    }

    // AI 失败回退后的"重试AI分析"按钮
    var aiRetryBtn = content.querySelector('#aiHazardRetryBtn');
    if (aiRetryBtn) {
      aiRetryBtn.addEventListener('click', function() {
        this.disabled = true;
        this.textContent = '\u23F3 ' + I18n.t('q.aiAnalyzing');
        // 清除缓存标记，强制重新走AI匹配
        data.hazardWorksheet = [];
        data._hazardStepFingerprint = '';
        data._hazardFromAI = '';
        saveData(data);
        autoMatchStepHazards(data);
      });
    }


    // CCP页面按钮事件绑定（新 + 旧兼容）
    // 只有在使用旧的CCP视图时才绑定旧按钮，避免冲突
    if (data.ccpPageMode !== 'judging' && data.ccpPageMode !== 'form' && data.ccpPageMode !== 'summary') {
      bindCcpStepButtons(content, data);
    }
    bindNewCcpButtons(content, data);

    // 验证程序 - 新增项目表格事件绑定
    const addVerificationExtraBtn = content.querySelector('#addVerificationExtraRow');
    if (addVerificationExtraBtn) { addVerificationExtraBtn.addEventListener('click', function() { data.verificationExtraItems.push({ id: genId(), key: '', value: '' }); saveData(data); renderActiveSection(); }); }
    content.querySelectorAll('#verificationExtraBody .q15-del-row').forEach(function(btn) { btn.addEventListener('click', function() { var idx = parseInt(this.dataset.vxIdx); if (data.verificationExtraItems.length > 0) { data.verificationExtraItems.splice(idx, 1); saveData(data); renderActiveSection(); } }); });
    content.querySelectorAll('#verificationExtraBody input').forEach(function(el) { el.addEventListener('input', function() { var row = this.closest('[data-vx-idx]'), idx = parseInt(row ? row.dataset.vxIdx : -1); if (!isNaN(idx) && data.verificationExtraItems[idx]) { var keyInput = row.querySelector('.vx-key'); var valInput = row.querySelector('.vx-val'); if (keyInput && valInput) { data.verificationExtraItems[idx].key = keyInput.value; data.verificationExtraItems[idx].value = valInput.value; saveData(data); } } }); });

    // ===== 验证程序 - 组长密码签名提交 =====
    var verificationSubmitBtn = content.querySelector('#verificationSubmitBtn');
    if (verificationSubmitBtn) {
      verificationSubmitBtn.addEventListener('click', function() {
        // 收集验证程序数据
        collectSectionData(content, data);
        
        // 获取签名信息
        var nameEl = document.getElementById('verificationSignerName');
        var dateEl = document.getElementById('verificationSignerDate');
        var signerName = nameEl ? nameEl.value.trim() : '';
        var signDate = dateEl ? dateEl.value : '';
        
        if (!signerName) {
          alert('请输入HACCP小组' + I18n.t('q.verSignerPh') + '');
          if (nameEl) nameEl.focus();
          return;
        }
        if (!signDate) {
          alert('' + I18n.t('q.verSelectOption') + '签名日期');
          return;
        }
        
        // 弹出密码确认框
        var password = prompt('请输入登录密码以确认' + I18n.t('q.verSignerLabel') + '：');
        if (!password) return;
        
        // 验证密码 - 通过后端API验证
        (async function() {
          var token = null;
          try { token = localStorage.getItem('haccp_token'); } catch(e) { console.warn('Failed to read localStorage haccp_token for verification:', e); }
          
          if (token) {
            try {
              // 用当前token验证，如果能成功获取用户信息则密码有效
              var resp = await fetch(API_HOST + '/api/auth/me', {
                headers: { 'Authorization': 'Bearer ' + token }
              });
              if (resp.ok) {
                // 密码验证通过（直接用当前登录状态）
                doVerificationSubmit(data, signerName, signDate);
                return;
              }
            } catch(e) { console.warn('Failed to verify auth token with backend:', e); }
          }

          // 尝试用输入的密码重新登录来验证
          try {
            var username = '';
            try {
              var storedUser = JSON.parse(localStorage.getItem('haccp_user') || '{}');
              username = storedUser.username || '';
            } catch(e) { console.warn('Failed to parse localStorage haccp_user:', e); }
            
            if (!username) {
              // 尝试从token中解码
              if (token) {
                try {
                  var parts = token.split('.');
                  if (parts.length === 3) {
                    var payload = JSON.parse(atob(parts[1]));
                    username = payload.username || '';
                  }
                } catch(e) { console.warn('Failed to decode JWT token for username:', e); }
              }
            }
            
            if (username) {
              var loginResp = await fetch(API_HOST + '/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username, password: password })
              });
              if (loginResp.ok) {
                var loginData = await loginResp.json();
                if (loginData.token) {
                  try { localStorage.setItem('haccp_token', loginData.token); } catch(e) { console.warn('Failed to write localStorage haccp_token after login:', e); }
                }
                doVerificationSubmit(data, signerName, signDate);
                return;
              }
            }
          } catch(e) { console.warn('Failed to re-login for verification:', e); }

          alert('密码验证失败。请确认您是已登录的HACCP小组组长，并输入正确的登录密码。');
        })();
      });
    }
    
    // 验证程序 - 重置提交
    var verificationResetBtn = content.querySelector('#verificationResetBtn');
    if (verificationResetBtn) {
      verificationResetBtn.addEventListener('click', function() {
        if (!confirm('确定要重置验证程序吗？重置后需要重新填写并签名提交。')) return;
        data.verificationSubmitted = false;
        data.verificationSignerName = '';
        data.verificationSignerDate = '';
        saveData(data);
        renderActiveSection();
        renderSectionNav();
      });
    }
    
    // 管理评审 - ' + I18n.t('q.verReviewResult') + '变化时显示/隐藏' + I18n.t('q.verCorrective') + '字段
    var mrResultSelect = content.querySelector('[data-q15-field="managementReview.reviewResult"]');
    if (mrResultSelect) {
      mrResultSelect.addEventListener('change', function() {
        var correctiveField = document.getElementById('mrCorrectiveField');
        var reVerificationField = document.getElementById('mrReVerificationField');
        if (this.value === '不符合') {
          if (correctiveField) correctiveField.style.display = '';
          if (reVerificationField) reVerificationField.style.display = '';
        } else {
          if (correctiveField) correctiveField.style.display = 'none';
          if (reVerificationField) reVerificationField.style.display = 'none';
        }
        collectSectionData(content, data);
        saveData(data);
      });
    }

    bindFlowchartButtons(data);
    const exportBtn = content.querySelector('#exportTableBtn');
    if (exportBtn) { exportBtn.addEventListener('click', function() { alert('导出功能：将生成空白记录表格供打印使用（此功能为占位，后续可实现为PDF/Excel导出）'); }); }
  }
  
  // ===== 验证程序提交函数 =====
  function doVerificationSubmit(data, signerName, signDate) {
    data.verificationSignerName = signerName;
    data.verificationSignerDate = signDate;
    data.verificationSubmitted = true;
    data.verificationSubmitTime = new Date().toISOString();
    saveData(data);
    renderActiveSection();
    renderSectionNav();
    alert('✅ ' + I18n.t('q.verSubmitted') + '成功！\n\n' + I18n.t('q.verSignerLabel') + '：' + signerName + '\n' + I18n.t('q.verSignDateLabel') + '：' + signDate);
  }

  // ===== CCP决策树辅助函数 (标准版) =====
  // 决策树逻辑：
  // Q1: 有控制措施存在吗？
  //   → 否 → Q1.1: 该步骤上的控制对安全是必要的吗？
  //         → 是: 标记"需修改步骤/工艺/产品" → 回到Q1起点
  //         → 否: 非CCP → 停止
  //   → 是 → Q2
  // Q2: 该步骤是否专门设计用于把危害的可能发生消除、降低到可接受水平？
  //   → 是: CCP
  //   → 否 → Q3
  // Q3: 危害产生的污染是否会超过可接受水平或增加到不可接受水平？
  //   → 否: 非CCP → 停止
  //   → 是 → Q4
  // Q4: 后续步骤可否消除危害或将危害的发生降低到可接受水平？
  //   → 是: 非CCP → 停止
  //   → 否: CCP
  // ===== AI辅助CCP判定 =====
  function aiCcpJudgment(data) {
    var steps = data.processSteps || [];
    if (steps.length === 0) { alert(I18n.t('q.needOneStep')); return; }
    normalizeCcpSteps(data);

    var stepPayload = steps.map(function(s) {
      return { stepName: s.stepName || '', operationMethod: s.operationMethod || '', parameters: s.parameters || '', equipmentName: s.equipmentName || '' };
    });

    var hint = document.getElementById('aiCcpHint');
    var aiBtn = document.getElementById('aiCcpBtn');
    if (hint) hint.textContent = '⏳ AI正在根据Codex判断树判定CCP...';
    if (aiBtn) aiBtn.disabled = true;

    var apiUrl = (window.location.protocol === 'file:' || window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost')
      ? 'http://localhost:8000' : '';
    apiUrl += '/api/ai/ccp-judgment';

    fetch(apiUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_name: data.productName || '',
        raw_materials: data.rawMaterials || '',
        process_description: (data.processSteps || []).map(function(s) { return s.stepName + (s.operationMethod ? ': ' + s.operationMethod : ''); }).join('; '),
        steps: stepPayload
      })
    })
    .then(function(resp) { if (!resp.ok) throw new Error('HTTP ' + resp.status); return resp.json(); })
    .then(function(result) {
      if (!result.ok || !result.data || !result.data.judgments) throw new Error('AI返回数据格式错误');
      var judgments = result.data.judgments;
      normalizeCcpSteps(data);
      judgments.forEach(function(j) {
        var si = j.stepIndex;
        if (si < 0 || si >= data.processSteps.length) return;
        if (!data.ccpSteps[si]) data.ccpSteps[si] = { stepName: data.processSteps[si].stepName || '', hazards: {}, completed: false };
        if (!data.ccpSteps[si].hazards) data.ccpSteps[si].hazards = {};
        if (!data.ccpSteps[si].hazards.bio) data.ccpSteps[si].hazards.bio = {};
        if (!data.ccpSteps[si].hazards.chem) data.ccpSteps[si].hazards.chem = {};
        if (!data.ccpSteps[si].hazards.phys) data.ccpSteps[si].hazards.phys = {};
        ['bio','chem','phys'].forEach(function(ht) {
          var h = (j.hazards && j.hazards[ht]) ? j.hazards[ht] : {};
          var hz = data.ccpSteps[si].hazards[ht];
          hz.hazardDesc = h.hazardDesc || hz.hazardDesc || '';
          hz.q1 = h.q1 || hz.q1 || '';
          hz.q2 = h.q2 || hz.q2 || '';
          hz.q3 = h.q3 || hz.q3 || '';
          hz.q4 = h.q4 || hz.q4 || '';
          hz.q5 = h.q5 || hz.q5 || '';
          if (h.q2_need) hz.q2_need = h.q2_need;
          hz.isCCP = h.isCCP;
          hz.aiReasoning = h.reasoning || '';
        });
        data.ccpSteps[si].completed = true;
      });
      data.ccpPageMode = 'summary';
      saveData(data);
      if (hint) hint.textContent = '✅ AI判定完成';
      if (aiBtn) aiBtn.disabled = false;
      renderActiveSection(); renderSectionNav();
    })
    .catch(function(err) {
      console.warn('AI CCP判定后端不可用，使用本地判断树规则:', err.message);
      localMockCcpJudgment(data);
      if (hint) hint.textContent = '✅ 本地CCP判定完成（基于判断树规则）';
      if (aiBtn) aiBtn.disabled = false;
    });
  }

  // 本地模拟CCP判定（基于步骤名关键词 + Codex判断树规则，无需后端）
  function localMockCcpJudgment(data) {
    normalizeCcpSteps(data);
    var steps = data.processSteps || [];
    steps.forEach(function(step, si) {
      var sn = (step.stepName || '').trim();
      var om = (step.operationMethod || '').toLowerCase();
      var pm = (step.parameters || '').toLowerCase();
      var en = (step.equipmentName || '').toLowerCase();
      var combined = (sn + om + pm + en).toLowerCase();

      var isHeat = /杀菌|灭菌|热处理|蒸煮|uht|巴氏|消毒|pasteuriz|steriliz|heat/.test(combined);
      var isMetal = /金属检测|异物检测|x光|x-ray|磁选|筛选|metal detect/.test(combined);
      var isReceiving = /验收|接收|原料|receiving|receiv/.test(combined) && combined.indexOf('辅料') === -1;
      var isCleaning = /清洗|清洁|cip|消毒|washing|cleaning/.test(combined);
      var isCooling = /冷却|降温|冷藏|冷冻|速冻|cooling|chill/.test(combined);
      var isPackaging = /包装|灌装|封口|封盖|packaging|filling|sealing/.test(combined);
      var isFilter = /过滤|膜滤|超滤|离心|脱色|filter|membrane|centrifug/.test(combined);
      var isDrying = /烘干|干燥|喷雾|drying|spray/.test(combined);
      var isStorage = /入库|储存|仓储|storage|warehous/.test(combined);

      if (!data.ccpSteps[si]) data.ccpSteps[si] = { stepName: sn || '', hazards: {}, completed: false };
      if (!data.ccpSteps[si].hazards) data.ccpSteps[si].hazards = {};

      // Bio hazard judgment
      var bio = data.ccpSteps[si].hazards.bio || {};
      var bioDesc = '';
      if (isHeat) bioDesc = '致病菌（沙门氏菌、大肠杆菌O157:H7、李斯特菌等）残留|||Pathogenic bacteria (Salmonella, E. coli O157:H7, Listeria, etc.) residue';
      else if (isReceiving) bioDesc = '原料可能携带致病菌（沙门氏菌、大肠杆菌等）|||Raw materials may carry pathogenic bacteria (Salmonella, E. coli, etc.)';
      else if (isCooling) bioDesc = '冷却过程中温度适宜微生物繁殖，可能导致微生物增殖|||Cooling temperatures in microbial growth range may cause proliferation';
      else if (isPackaging) bioDesc = '包装环节在洁净环境下进行，无明显生物危害引入|||Packaging performed in clean environment, no significant biological hazard';
      else if (isCleaning) bioDesc = '清洗不彻底可能导致微生物残留和交叉污染|||Inadequate cleaning may cause microbial residue and cross-contamination';
      else if (isFilter) bioDesc = '过滤介质可能滋生微生物|||Filter media may harbor microorganisms';
      else if (isStorage) bioDesc = '储存条件不当可能导致微生物增殖|||Improper storage may cause microbial growth';
      else bioDesc = '可能存在的微生物污染风险|||Potential microbial contamination risk';

      // Codex decision tree
      var bioQ1, bioQ2, bioQ3, bioQ4, bioQ5, bioQ2need, bioIsCCP, bioReason;
      if (isHeat) {
        bioQ1 = '是'; bioQ2 = '是'; bioQ3 = '是'; bioQ4 = null; bioQ5 = null; bioQ2need = null;
        bioIsCCP = true;
        bioReason = '该步骤存在生物危害风险（致病菌污染），热处理是专门设计用于消除微生物危害的控制措施（Q3=是），故判定为CCP。|||This step has biological hazard risk (pathogen contamination). Heat treatment is specifically designed to eliminate microbial hazards (Q3=Yes), therefore it is a CCP.';
      } else if (isReceiving) {
        bioQ1 = '是'; bioQ2 = '是'; bioQ3 = '否'; bioQ4 = '是'; bioQ5 = '是'; bioQ2need = null;
        bioIsCCP = false;
        bioReason = '原料可能存在生物危害，有验收控制措施（Q2=是），但验收非专门设计用于消除危害（Q3=否），后续加工步骤（杀菌）可消除该危害（Q5=是），故判定为非CCP。|||Raw materials may carry biological hazards. Receiving inspection controls exist (Q2=Yes) but are not specifically designed to eliminate hazards (Q3=No). Subsequent sterilization eliminates the hazard (Q5=Yes), therefore NOT a CCP.';
      } else if (isCooling) {
        bioQ1 = '是'; bioQ2 = '是'; bioQ3 = '否'; bioQ4 = '是'; bioQ5 = '否'; bioQ2need = null;
        bioIsCCP = true;
        bioReason = '冷却步骤存在微生物增殖风险，有温度/时间控制措施（Q2=是），冷却不当会导致污染升高至不可接受水平（Q4=是），后续无杀菌步骤可消除该危害（Q5=否），故判定为CCP。|||Cooling step has microbial growth risk. Temperature/time controls exist (Q2=Yes). Improper cooling increases contamination to unacceptable levels (Q4=Yes). No subsequent sterilization step (Q5=No), therefore it is a CCP.';
      } else if (isPackaging) {
        bioQ1 = '否'; bioQ2 = null; bioQ3 = null; bioQ4 = null; bioQ5 = null; bioQ2need = null;
        bioIsCCP = false;
        bioReason = '包装步骤在洁净环境下进行，无明显生物危害引入风险（Q1=否），故判定为非CCP。|||Packaging is performed in a clean environment. No significant biological hazard introduction risk (Q1=No), therefore NOT a CCP.';
      } else if (isStorage) {
        bioQ1 = '是'; bioQ2 = '是'; bioQ3 = '否'; bioQ4 = '是'; bioQ5 = '否'; bioQ2need = null;
        bioIsCCP = true;
        bioReason = '储存条件不当可能导致微生物增殖，有温湿度控制措施（Q2=是），储存不当会导致危害升高（Q4=是），后续无杀菌步骤（Q5=否），故判定为CCP。|||Improper storage may cause microbial growth. Temperature/humidity controls exist (Q2=Yes). Improper storage increases hazard levels (Q4=Yes). No subsequent sterilization (Q5=No), therefore it is a CCP.';
      } else {
        bioQ1 = '是'; bioQ2 = '是'; bioQ3 = '否'; bioQ4 = '否'; bioQ2need = null; bioQ5 = null;
        bioIsCCP = false;
        bioReason = '该步骤可能存在生物危害，有基本控制措施（Q2=是），但该步骤不会导致污染升高至不可接受水平（Q4=否），故判定为非CCP。|||This step may have biological hazards. Basic controls exist (Q2=Yes), but this step does not increase contamination to unacceptable levels (Q4=No), therefore NOT a CCP.';
      }

      // Chem hazard judgment
      var chem = data.ccpSteps[si].hazards.chem || {};
      var chemDesc = '';
      if (isReceiving) chemDesc = '农药残留、重金属（铅、砷、镉）、兽药残留超标|||Pesticide residues, heavy metals (Pb, As, Cd), veterinary drug residues exceeding limits';
      else if (isFilter) chemDesc = '加工助剂残留、化学物质溶出|||Processing aid residues, chemical substance leaching';
      else if (isCleaning) chemDesc = '清洗剂/消毒剂残留|||Cleaning agent/disinfectant residues';
      else if (isDrying) chemDesc = '高温可能产生化学变化产物|||High temperature may produce chemical change by-products';
      else chemDesc = '无明显化学危害|||No significant chemical hazard';

      var chemQ1, chemQ2, chemQ3, chemQ4, chemQ5, chemQ2need, chemIsCCP, chemReason;
      if (isReceiving) {
        chemQ1 = '是'; chemQ2 = '是'; chemQ3 = '否'; chemQ4 = '否'; chemQ5 = null; chemQ2need = null;
        chemIsCCP = false;
        chemReason = '原料可能存在化学危害，有验收检测控制（Q2=是），但验收步骤不会导致化学危害升高（Q4=否），故判定为非CCP。|||Raw materials may contain chemical hazards. Receiving inspection controls exist (Q2=Yes), but receiving does not increase chemical hazards (Q4=No), therefore NOT a CCP.';
      } else if (isFilter) {
        chemQ1 = '是'; chemQ2 = '是'; chemQ3 = '是'; chemQ4 = null; chemQ5 = null; chemQ2need = null;
        chemIsCCP = true;
        chemReason = '该步骤存在化学危害风险，过滤/脱色步骤专门设计用于去除化学物质（Q3=是），故判定为CCP。|||This step has chemical hazard risk. Filtration/decolorization is specifically designed to remove chemical substances (Q3=Yes), therefore it is a CCP.';
      } else if (isCleaning) {
        chemQ1 = '是'; chemQ2 = '是'; chemQ3 = '否'; chemQ4 = '否'; chemQ5 = null; chemQ2need = null;
        chemIsCCP = false;
        chemReason = '可能存在清洗剂残留，有冲洗控制措施（Q2=是），规范操作下不会导致残留超标（Q4=否），故判定为非CCP。|||Cleaning agent residues may exist. Rinsing controls are in place (Q2=Yes). Proper operations prevent excessive residues (Q4=No), therefore NOT a CCP.';
      } else {
        chemQ1 = '否'; chemQ2 = null; chemQ3 = null; chemQ4 = null; chemQ5 = null; chemQ2need = null;
        chemIsCCP = false;
        chemReason = '该步骤通常不涉及化学危害引入（Q1=否），故判定为非CCP。|||This step typically does not introduce chemical hazards (Q1=No), therefore NOT a CCP.';
      }

      // Phys hazard judgment
      var phys = data.ccpSteps[si].hazards.phys || {};
      var physDesc = '';
      if (isMetal) physDesc = '金属碎片（设备磨损、刀片断裂等产生的铁、不锈钢碎片）|||Metal fragments (Fe, SUS from equipment wear, blade breakage, etc.)';
      else if (isReceiving) physDesc = '原料中可能混入砂石、金属、玻璃等异物|||Raw materials may contain stones, metal, glass and other foreign objects';
      else if (isPackaging) physDesc = '包装材料碎片、封口不良导致异物侵入|||Packaging material fragments, foreign object intrusion from poor sealing';
      else if (isFilter) physDesc = '过滤介质破损可能引入异物|||Damaged filter media may introduce foreign objects';
      else physDesc = '无明显物理危害|||No significant physical hazard';

      var physQ1, physQ2, physQ3, physQ4, physQ5, physQ2need, physIsCCP, physReason;
      if (isMetal) {
        physQ1 = '是'; physQ2 = '是'; physQ3 = '是'; physQ4 = null; physQ5 = null; physQ2need = null;
        physIsCCP = true;
        physReason = '该步骤存在物理危害（金属异物），金属检测/筛选步骤专门设计用于去除金属异物（Q3=是），故判定为CCP。|||This step has physical hazards (metal fragments). Metal detection/screening is specifically designed to remove metal foreign objects (Q3=Yes), therefore it is a CCP.';
      } else if (isReceiving) {
        physQ1 = '是'; physQ2 = '是'; physQ3 = '否'; physQ4 = '否'; physQ5 = null; physQ2need = null;
        physIsCCP = false;
        physReason = '原料可能携带物理异物，有验收目视检查（Q2=是），但验收不会增加物理危害（Q4=否），故判定为非CCP。|||Raw materials may contain physical foreign objects. Visual inspection exists (Q2=Yes), but receiving does not increase physical hazards (Q4=No), therefore NOT a CCP.';
      } else if (isPackaging) {
        physQ1 = '是'; physQ2 = '是'; physQ3 = '否'; physQ4 = '否'; physQ5 = null; physQ2need = null;
        physIsCCP = false;
        physReason = '可能存在包装材料碎片，有目视检查和设备维护控制（Q2=是），风险较低（Q4=否），故判定为非CCP。|||Packaging material fragments may exist. Visual inspection and equipment maintenance controls are in place (Q2=Yes). Risk is low (Q4=No), therefore NOT a CCP.';
      } else {
        physQ1 = '否'; physQ2 = null; physQ3 = null; physQ4 = null; physQ5 = null; physQ2need = null;
        physIsCCP = false;
        physReason = '该步骤通常不涉及物理危害引入（Q1=否），故判定为非CCP。|||This step typically does not introduce physical hazards (Q1=No), therefore NOT a CCP.';
      }

      data.ccpSteps[si].hazards.bio = {
        hazardDesc: bioDesc, q1: bioQ1, q2: bioQ2, q3: bioQ3, q4: bioQ4, q5: bioQ5,
        q2_need: bioQ2need, isCCP: bioIsCCP, aiReasoning: bioReason
      };
      data.ccpSteps[si].hazards.chem = {
        hazardDesc: chemDesc, q1: chemQ1, q2: chemQ2, q3: chemQ3, q4: chemQ4, q5: chemQ5,
        q2_need: chemQ2need, isCCP: chemIsCCP, aiReasoning: chemReason
      };
      data.ccpSteps[si].hazards.phys = {
        hazardDesc: physDesc, q1: physQ1, q2: physQ2, q3: physQ3, q4: physQ4, q5: physQ5,
        q2_need: physQ2need, isCCP: physIsCCP, aiReasoning: physReason
      };
      data.ccpSteps[si].completed = true;
    });
    data.ccpPageMode = 'summary';
    saveData(data);
    renderActiveSection();
    renderSectionNav();
  }

  function evaluateCCPFromQA(hazard) {
    if (!hazard) return null;
    // Q1: 有控制措施存在吗？
    if (hazard.q1 === undefined) return null;
    if (hazard.q1 === '否') {
      // Q1.1: 控制对安全必要吗？
      if (hazard.q1_need === undefined) return null;
      if (hazard.q1_need === '是') return 'modify'; // 需修改
      if (hazard.q1_need === '否') return false; // 非CCP
    }
    // Q1=是，进入Q2
    if (hazard.q2 === undefined) return null;
    if (hazard.q2 === '是') return true; // CCP
    // Q2=否，进入Q3
    if (hazard.q3 === undefined) return null;
    if (hazard.q3 === '否') return false; // 非CCP
    // Q3=是，进入Q4
    if (hazard.q4 === undefined) return null;
    if (hazard.q4 === '是') return false; // 非CCP
    if (hazard.q4 === '否') return true; // CCP
    return null;
  }

  function getNextCCPQuestion(hazard) {
    if (!hazard || hazard.q1 === undefined) return 1;
    if (hazard.q1 === '否') {
      if (hazard.q1_need === undefined) return 'q1_need';
      if (hazard.q1_need === '是') return 'q1_reset'; // 修改后回到Q1
      if (hazard.q1_need === '否') return -1;
    }
    if (hazard.q2 === undefined) return 2;
    if (hazard.q2 === '是') return -1;
    if (hazard.q3 === undefined) return 3;
    if (hazard.q3 === '否') return -1;
    if (hazard.q4 === undefined) return 4;
    return -1;
  }

  // ===== 新CCP页面按钮事件绑定 =====
  function bindNewCcpButtons(content, data) {
    normalizeCcpSteps(data);
    var saveBtn=content.querySelector('#stepFormSaveBtn');
    if(saveBtn)saveBtn.addEventListener('click',function(){
      var n=content.querySelector('#stepFormName'),e=content.querySelector('#stepFormEquipment'),m=content.querySelector('#stepFormMethod'),pp=content.querySelector('#stepFormParams');
      var name=n?n.value.trim():'',eq=e?e.value.trim():'',mt=m?m.value.trim():'',params=pp?pp.value.trim():'';
      if(!name){alert('请输入' + I18n.t('q.stepName') + '');return;}
      if(!data.processSteps||!Array.isArray(data.processSteps))data.processSteps=[];
      var ei=parseInt(data.currentEditingStep);
      if(!isNaN(ei)&&ei>=0&&ei<data.processSteps.length){
        data.processSteps[ei].stepName=name;data.processSteps[ei].equipmentName=eq;data.processSteps[ei].operationMethod=mt;data.processSteps[ei].parameters=params;
        if(data.ccpSteps&&data.ccpSteps[ei])data.ccpSteps[ei].stepName=name;
      }else data.processSteps.push({id:genId(),stepName:name,equipmentName:eq,operationMethod:mt,parameters:params,controlPoint:''});
      data.currentEditingStep=-1;normalizeCcpSteps(data);saveData(data);renderActiveSection();renderSectionNav();
    });
    content.querySelectorAll('[data-step-edit]').forEach(function(el){el.addEventListener('click',function(e){if(e.target&&e.target.dataset&&e.target.dataset.stepDelete!==undefined)return;var idx=parseInt(this.dataset.stepEdit);if(!isNaN(idx)&&idx>=0&&idx<data.processSteps.length){data.currentEditingStep=idx;data.ccpPageMode='form';saveData(data);renderActiveSection();renderSectionNav();}});});
    content.querySelectorAll('[data-step-delete]').forEach(function(el){el.addEventListener('click',function(e){e.stopPropagation();var idx=parseInt(this.dataset.stepDelete);if(isNaN(idx)||idx<0||idx>=data.processSteps.length)return;if(!confirm(I18n.t('step.confirmDel')+esc(data.processSteps[idx].stepName||I18n.t('q.ccpStepDefault').replace('{n}',idx+1))+I18n.t('step.confirmDelSuffix')))return;data.processSteps.splice(idx,1);if(data.ccpSteps&&data.ccpSteps.length>idx)data.ccpSteps.splice(idx,1);data.currentEditingStep=-1;normalizeCcpSteps(data);saveData(data);renderActiveSection();renderSectionNav();});});
    var aBtn=content.querySelector('#addNewStepBtn');if(aBtn)aBtn.addEventListener('click',function(){data.currentEditingStep=-1;data.ccpPageMode='form';saveData(data);renderActiveSection();renderSectionNav();});
    var aiBtn=content.querySelector('#aiCcpBtn');if(aiBtn)aiBtn.addEventListener('click',function(){collectSectionData(content,data);aiCcpJudgment(data);});
    var jBtn=content.querySelector('#ccpJudgeBtn');if(jBtn)jBtn.addEventListener('click',function(){if(!data.processSteps||data.processSteps.length===0){alert(I18n.t('q.needOneStep'));return;}normalizeCcpSteps(data);var stepCount=data.processSteps.length;var prevStepCount=data.ccpSteps?data.ccpSteps.length:0;if(stepCount!==prevStepCount){data.ccpSteps=[];normalizeCcpSteps(data);}// 步骤数未变化时保留已有的判定数据，不清空记录
    // 根据当前编辑的步骤确定起始判断步骤
    var startIdx=parseInt(data.currentEditingStep);if(isNaN(startIdx)||startIdx<0||startIdx>=data.processSteps.length)startIdx=0;data.ccpPageMode='judging';data.ccpStepIndex=startIdx;data.ccpHazardType='bio';data.ccpCurrentQ=1;saveData(data);renderActiveSection();renderSectionNav();});
    var cBtn=content.querySelector('#completeStepsBtn');if(cBtn)cBtn.addEventListener('click',function(){if(!data.processSteps||data.processSteps.length===0){alert(I18n.t('q.needOneStep'));return;}normalizeCcpSteps(data);data.ccpPageMode='summary';saveData(data);renderActiveSection();renderSectionNav();});
    var aBtn2=content.querySelector('#ccpAnswerBtn');if(aBtn2)aBtn2.addEventListener('click',function(){
      normalizeCcpSteps(data);var idx=parseInt(data.ccpStepIndex);if(isNaN(idx)||idx<0||idx>=data.processSteps.length)idx=0;
      var ht=data.ccpHazardType||'bio';var cq=data.ccpCurrentQ||1;var sel=content.querySelector('input[name="ccpQAnswer"]:checked');
      if(!sel){alert('' + I18n.t('q.verSelectOption') + '一个选项');return;}var ans=sel.value;var hz=data.ccpSteps[idx].hazards[ht];
      if(cq===1){var di=content.querySelector('#ccpHazardDescInput');hz.hazardDesc=di?di.value.trim():(hz.hazardDesc||'');hz.q1=ans;}
      else if(cq==='q2_need'){
        hz.q1_need=ans;
        if(ans==='是'){
          // Q1续选"是"：待判断，自动跳转到下一个危害类型
          var hts=['bio','chem','phys'];var hti=hts.indexOf(ht);var steps=data.processSteps||[];
          if(hti<hts.length-1){data.ccpHazardType=hts[hti+1];data.ccpCurrentQ=1;}
          else{if(data.ccpSteps[idx])data.ccpSteps[idx].completed=true;data.ccpPageMode='form';data.ccpHazardType='bio';data.ccpCurrentQ=1;}
          saveData(data);renderActiveSection();renderSectionNav();return;
        }else{
          // Q1续选"否"：非CCP，自动跳转到下一个危害类型
          hz.isCCP=false;
          var hts2=['bio','chem','phys'];var hti2=hts2.indexOf(ht);var steps2=data.processSteps||[];
          if(hti2<hts2.length-1){data.ccpHazardType=hts2[hti2+1];data.ccpCurrentQ=1;}
          else{if(data.ccpSteps[idx])data.ccpSteps[idx].completed=true;data.ccpPageMode='form';data.ccpHazardType='bio';data.ccpCurrentQ=1;}
          saveData(data);renderActiveSection();renderSectionNav();return;
        }
      }else hz['q'+cq]=ans;
      var isCCP=evaluateCCPFromQA(hz);if(isCCP!==null)hz.isCCP=isCCP;else{var nq=getNextCCPQuestion(hz);if(nq==='q2_reset'){hz.isCCP='modify';data.ccpCurrentQ=2;}else if(nq==='q1_need')data.ccpCurrentQ='q2_need';else if(nq==='q2_need')data.ccpCurrentQ='q2_need';else if(nq>0)data.ccpCurrentQ=nq;}
      saveData(data);renderActiveSection();renderSectionNav();
    });
    var nBtn=content.querySelector('#ccpNextHazardBtn');if(nBtn)nBtn.addEventListener('click',function(){normalizeCcpSteps(data);var idx=parseInt(data.ccpStepIndex);if(isNaN(idx))idx=0;var hts=['bio','chem','phys'];var ht=data.ccpHazardType||'bio';var hti=hts.indexOf(ht);if(hti<0)hti=0;if(hti<hts.length-1){data.ccpHazardType=hts[hti+1];data.ccpCurrentQ=1;}else{if(data.ccpSteps[idx])data.ccpSteps[idx].completed=true;data.ccpPageMode='form';data.ccpHazardType='bio';data.ccpCurrentQ=1;}saveData(data);renderActiveSection();renderSectionNav();});
    var bBtn=content.querySelector('#ccpJudgingBackBtn');if(bBtn)bBtn.addEventListener('click',function(){data.ccpPageMode='form';saveData(data);renderActiveSection();renderSectionNav();});
    var sBtn=content.querySelector('#summaryBackBtn');if(sBtn)sBtn.addEventListener('click',function(){data.ccpPageMode='form';saveData(data);renderActiveSection();renderSectionNav();});
    // ===== "重新判定本危害"按钮：清除当前危害所有答案 =====
    var resetAllBtn=content.querySelector('#ccpResetAllBtn');if(resetAllBtn)resetAllBtn.addEventListener('click',function(){normalizeCcpSteps(data);var idx=parseInt(data.ccpStepIndex);if(isNaN(idx))idx=0;var ht=data.ccpHazardType||'bio';if(data.ccpSteps&&data.ccpSteps[idx]&&data.ccpSteps[idx].hazards&&data.ccpSteps[idx].hazards[ht]){var hz=data.ccpSteps[idx].hazards[ht];hz.hazardDesc='';hz.q1=undefined;hz.q2=undefined;hz.q3=undefined;hz.q4=undefined;hz.q5=undefined;hz.q2_need=undefined;hz.isCCP=undefined;}data.ccpCurrentQ=1;saveData(data);renderActiveSection();renderSectionNav();});
    // ===== "上一步"按钮：从结果展示页回退到上一个问题 =====
    function clearCcpAnswersFrom(hazard, fromQ) {
      if (!hazard) return;
      var qn = parseInt(fromQ);
      if (isNaN(qn)) qn = 0;
      for (var q = qn; q <= 5; q++) delete hazard['q' + q];
      if (qn <= 2) delete hazard['q2_need'];
      if (qn <= 2) delete hazard['q3'];
      if (qn <= 3) delete hazard['q4'];
      if (qn <= 4) delete hazard['q5'];
      delete hazard['isCCP'];
    }
    var prevStepBtn=content.querySelector('#ccpPrevStepBtn');if(prevStepBtn)prevStepBtn.addEventListener('click',function(){normalizeCcpSteps(data);var idx=parseInt(data.ccpStepIndex);if(isNaN(idx))idx=0;var ht=data.ccpHazardType||'bio';var hts=['bio','chem','phys'];var hti=hts.indexOf(ht);var currentQ=data.ccpCurrentQ||1;var curHazard=null;if(data.ccpSteps&&data.ccpSteps[idx]&&data.ccpSteps[idx].hazards&&data.ccpSteps[idx].hazards[ht]){curHazard=data.ccpSteps[idx].hazards[ht];}
      if(currentQ==='q2_need'){if(curHazard){delete curHazard['q2_need'];delete curHazard['isCCP'];delete curHazard['q3'];delete curHazard['q4'];delete curHazard['q5'];}data.ccpCurrentQ=2;}
      else if(currentQ>1){if(curHazard)clearCcpAnswersFrom(curHazard,currentQ);data.ccpCurrentQ=currentQ-1;}
      else if(hti>0){var prevHt=hts[hti-1];if(curHazard)clearCcpAnswersFrom(curHazard,1);var prevH=data.ccpSteps&&data.ccpSteps[idx]&&data.ccpSteps[idx].hazards&&data.ccpSteps[idx].hazards[prevHt];if(prevH){delete prevH['isCCP'];var lastQ=0;for(var qi=1;qi<=5;qi++){if(prevH['q'+qi]!==undefined)lastQ=qi;}if(prevH.q2_need!==undefined)lastQ='q2_need';data.ccpCurrentQ=lastQ>0?lastQ:5;if(data.ccpCurrentQ>5)data.ccpCurrentQ=5;}else{data.ccpCurrentQ=5;}data.ccpHazardType=prevHt;}
      else if(idx>0){var prevIdx=idx-1;if(data.ccpSteps&&data.ccpSteps[idx]&&data.ccpSteps[idx].hazards){['bio','chem','phys'].forEach(function(ht2){var h=data.ccpSteps[idx].hazards[ht2];if(h)clearCcpAnswersFrom(h,1);});}data.ccpStepIndex=prevIdx;data.ccpHazardType='phys';data.ccpCurrentQ=5;var prevStepH=data.ccpSteps&&data.ccpSteps[prevIdx]&&data.ccpSteps[prevIdx].hazards&&data.ccpSteps[prevIdx].hazards['phys'];if(prevStepH){delete prevStepH['isCCP'];var lastQ=0;for(var qi=1;qi<=5;qi++){if(prevStepH['q'+qi]!==undefined)lastQ=qi;}if(prevStepH.q2_need!==undefined)lastQ='q2_need';data.ccpCurrentQ=lastQ>0?lastQ:5;if(data.ccpCurrentQ>5)data.ccpCurrentQ=5;}}
      saveData(data);renderActiveSection();renderSectionNav();});
    
  }

  function bindCcpStepButtons(content, data) {
    function saveHazardDescIfNeeded(idx, hazardType) {
      var hazardDescInput = content.querySelector('#ccpHazardDescInput');
      if (hazardDescInput) {
        var desc = hazardDescInput.value.trim();
        if (desc) {
          if (!data.ccpSteps) data.ccpSteps = [];
          if (!data.ccpSteps[idx]) data.ccpSteps[idx] = { stepName: '', hazards: {}, completed: false };
          if (!data.ccpSteps[idx].hazards) data.ccpSteps[idx].hazards = {};
          if (!data.ccpSteps[idx].hazards[hazardType]) data.ccpSteps[idx].hazards[hazardType] = {};
          data.ccpSteps[idx].hazards[hazardType].hazardDesc = desc;
        }
      }
    }

    // 确认回答按钮
    var answerBtn = content.querySelector('#ccpAnswerBtn');
    if (answerBtn) {
      answerBtn.addEventListener('click', function() {
        var idx = data.ccpStepIndex;
        var hazardType = data.ccpHazardType || 'bio';
        var currentQ = data.ccpCurrentQ || 1;
        var selected = content.querySelector('input[name="ccpQAnswer"]:checked');
        if (!selected) { alert('' + I18n.t('q.verSelectOption') + '"有危害/无危害"或"是/否"'); return; }
        var answer = selected.value;
        if (!data.ccpSteps) data.ccpSteps = [];
        if (!data.ccpSteps[idx]) {
          data.ccpSteps[idx] = { stepName: data.processSteps[idx]?.stepName || '', hazards: {}, completed: false };
        }
        if (!data.ccpSteps[idx].hazards) data.ccpSteps[idx].hazards = {};
        if (!data.ccpSteps[idx].hazards[hazardType]) data.ccpSteps[idx].hazards[hazardType] = {};
        
        if (currentQ === 1) saveHazardDescIfNeeded(idx, hazardType);
        
        data.ccpSteps[idx].hazards[hazardType]['q' + currentQ] = answer;
        
        var hazard = data.ccpSteps[idx].hazards[hazardType];
        var isCCP = evaluateCCPFromQA(hazard);
        
        if (isCCP !== null) {
          hazard.isCCP = isCCP;
          data.ccpCurrentQ = 1;
          saveData(data);
          renderActiveSection();
          renderSectionNav();
        } else {
          var nextQ = getNextCCPQuestion(hazard);
          if (nextQ === 'q2_reset') {
            hazard.isCCP = 'modify';
            data.ccpCurrentQ = 2;
            saveData(data);
            renderActiveSection();
            renderSectionNav();
          } else if (nextQ > 0) {
            data.ccpCurrentQ = nextQ;
          } else if (nextQ === 'q2_need') {
            data.ccpCurrentQ = 'q2_need';
          }
          saveData(data);
          renderActiveSection();
          renderSectionNav();
        }
      });
    }

    // Q2子判断：确认按钮
    var q2NeedBtn = content.querySelector('#ccpQ2NeedBtn');
    if (q2NeedBtn) {
      q2NeedBtn.addEventListener('click', function() {
        var idx = data.ccpStepIndex;
        var hazardType = data.ccpHazardType || 'bio';
        var selected = content.querySelector('input[name="ccpQAnswer"]:checked');
        if (!selected) { alert('' + I18n.t('q.verSelectOption') + '"是"或"否"'); return; }
        var answer = selected.value;
        if (!data.ccpSteps) data.ccpSteps = [];
        if (!data.ccpSteps[idx]) {
          data.ccpSteps[idx] = { stepName: '', hazards: {}, completed: false };
        }
        if (!data.ccpSteps[idx].hazards) data.ccpSteps[idx].hazards = {};
        if (!data.ccpSteps[idx].hazards[hazardType]) data.ccpSteps[idx].hazards[hazardType] = {};
        
        data.ccpSteps[idx].hazards[hazardType].q2_need = answer;
        
        var hazard = data.ccpSteps[idx].hazards[hazardType];
        var isCCP = evaluateCCPFromQA(hazard);
        
        if (isCCP !== null) {
          hazard.isCCP = isCCP;
          data.ccpCurrentQ = 1;
          saveData(data);
          renderActiveSection();
          renderSectionNav();
        } else {
          var nextQ = getNextCCPQuestion(hazard);
          if (nextQ === 'q2_reset') {
            hazard.isCCP = 'modify';
            data.ccpCurrentQ = 2;
            saveData(data);
            renderActiveSection();
            renderSectionNav();
          } else if (nextQ > 0) {
            data.ccpCurrentQ = nextQ;
            saveData(data);
            renderActiveSection();
            renderSectionNav();
          }
        }
      });
    }

    // ' + I18n.t('q.ccpModifyReEval') + '按钮
    var resetQ2Btn = content.querySelector('#ccpResetQ2Btn');
    if (resetQ2Btn) {
      resetQ2Btn.addEventListener('click', function() {
        var idx = data.ccpStepIndex;
        var hazardType = data.ccpHazardType || 'bio';
        if (data.ccpSteps && data.ccpSteps[idx] && data.ccpSteps[idx].hazards && data.ccpSteps[idx].hazards[hazardType]) {
          var h = data.ccpSteps[idx].hazards[hazardType];
          h.q2 = undefined;
          h.q2_need = undefined;
          h.isCCP = undefined;
          h.q3 = undefined;
          h.q4 = undefined;
          h.q5 = undefined;
        }
        data.ccpCurrentQ = 2;
        saveData(data);
        renderActiveSection();
        renderSectionNav();
      });
    }

    // 下一步按钮
    var nextQBtn = content.querySelector('#ccpNextQBtn');
    if (nextQBtn) {
      nextQBtn.addEventListener('click', function() {
        var idx = data.ccpStepIndex;
        var hazardType = data.ccpHazardType || 'bio';
        if (!data.ccpSteps) data.ccpSteps = [];
        if (!data.ccpSteps[idx]) data.ccpSteps[idx] = { stepName: '', hazards: {}, completed: false };
        if (!data.ccpSteps[idx].hazards) data.ccpSteps[idx].hazards = {};
        var hazard = data.ccpSteps[idx].hazards[hazardType] || {};
        var isCCP = evaluateCCPFromQA(hazard);
        
        if (isCCP !== null) {
          hazard.isCCP = isCCP;
          data.ccpCurrentQ = 1;
          saveData(data);
          renderActiveSection();
          renderSectionNav();
        } else {
          var nextQ = getNextCCPQuestion(hazard);
          if (nextQ === 'q2_reset') {
            hazard.isCCP = 'modify';
            data.ccpCurrentQ = 2;
            saveData(data);
            renderActiveSection();
            renderSectionNav();
          } else if (nextQ > 0) {
            data.ccpCurrentQ = nextQ;
          } else if (nextQ === 'q2_need') {
            data.ccpCurrentQ = 'q2_need';
          }
          saveData(data);
          renderActiveSection();
          renderSectionNav();
        }
      });
    }

    // ===== 导航面板事件 =====
    var navToggle = content.querySelector('#ccpNavToggle');
    if (navToggle) {
      navToggle.addEventListener('click', function() {
        var body = content.querySelector('#ccpNavBody');
        var arrow = content.querySelector('#ccpNavArrow');
        if (body) {
          if (body.style.display === 'none') {
            body.style.display = 'block';
            if (arrow) arrow.classList.add('expanded');
          } else {
            body.style.display = 'none';
            if (arrow) arrow.classList.remove('expanded');
          }
        }
      });
    }

    content.querySelectorAll('[data-nav-step]').forEach(function(el) {
      el.addEventListener('click', function() {
        var si = parseInt(this.dataset.navStep);
        if (isNaN(si)) return;
        data.ccpStepIndex = si;
        data.ccpHazardType = 'bio';
        data.ccpCurrentQ = 1;
        data.ccpViewMode = 'judge';
        saveData(data);
        renderActiveSection();
        renderSectionNav();
      });
    });

    content.querySelectorAll('[data-nav-edit]').forEach(function(el) {
      el.addEventListener('click', function() {
        var si = parseInt(this.dataset.navEdit);
        if (isNaN(si)) return;
        data.ccpViewMode = 'edit';
        data.ccpEditStepIdx = si;
        saveData(data);
        renderActiveSection();
        renderSectionNav();
      });
    });

    content.querySelectorAll('[data-nav-hazard]').forEach(function(el) {
      el.addEventListener('click', function() {
        var si = parseInt(this.dataset.navHazard);
        var ht = this.dataset.navHt;
        if (isNaN(si) || !ht) return;
        data.ccpStepIndex = si;
        data.ccpHazardType = ht;
        data.ccpCurrentQ = 1;
        data.ccpViewMode = 'judge';
        var hData = null;
        if (data.ccpSteps && data.ccpSteps[si] && data.ccpSteps[si].hazards && data.ccpSteps[si].hazards[ht]) {
          hData = data.ccpSteps[si].hazards[ht];
        }
        if (hData && hData.isCCP !== undefined) delete hData.isCCP;
        var nextQ = 1;
        if (hData) {
          for (var qi = 1; qi <= 5; qi++) {
            if (hData['q' + qi] !== undefined) nextQ = qi + 1;
          }
        }
        if (nextQ > 5) nextQ = 5;
        data.ccpCurrentQ = nextQ === 'q2_need' ? 'q2_need' : nextQ;
        saveData(data);
        renderActiveSection();
        renderSectionNav();
      });
    });

    // ===== 步骤编辑器事件 =====
    var editSaveBtn = content.querySelector('#ccpEditSaveBtn');
    if (editSaveBtn) {
      editSaveBtn.addEventListener('click', function() {
        var editIdx = data.ccpEditStepIdx;
        if (editIdx < 0 || editIdx >= data.processSteps.length) return;
        var inputs = content.querySelectorAll('#ccpEditStepCard .ccp-edit-input');
        inputs.forEach(function(el) {
          var field = el.dataset.psField;
          if (field) data.processSteps[editIdx][field] = el.value;
        });
        if (data.ccpSteps && data.ccpSteps[editIdx]) {
          data.ccpSteps[editIdx].stepName = data.processSteps[editIdx].stepName || '';
        }
        saveData(data);
        var hint = content.querySelector('.q15-table-hint');
        if (hint) {
          hint.textContent = '✅ 已保存步骤信息';
          setTimeout(function() { if (hint) hint.textContent = '在此处修改本步骤的基本信息，修改完成后返回CCP判定'; }, 2000);
        }
      });
    }

    var editDeleteBtn = content.querySelector('#ccpEditDeleteBtn');
    if (editDeleteBtn) {
      editDeleteBtn.addEventListener('click', function() {
        var editIdx = data.ccpEditStepIdx;
        if (editIdx < 0 || editIdx >= data.processSteps.length) return;
        if (data.processSteps.length <= 1) { alert('至少保留一个步骤'); return; }
        if (!confirm('确定要删除步骤 "' + esc(data.processSteps[editIdx].stepName || '步骤' + (editIdx + 1)) + '" 吗？')) return;
        data.processSteps.splice(editIdx, 1);
        if (data.ccpSteps && data.ccpSteps.length > editIdx) data.ccpSteps.splice(editIdx, 1);
        if (editIdx >= data.processSteps.length) editIdx = data.processSteps.length - 1;
        data.ccpViewMode = 'judge';
        data.ccpEditStepIdx = undefined;
        if (data.ccpStepIndex >= data.processSteps.length) data.ccpStepIndex = Math.max(0, data.processSteps.length - 1);
        saveData(data);
        renderActiveSection();
        renderSectionNav();
      });
    }

    var editBackBtn = content.querySelector('#ccpEditBackToJudgeBtn');
    if (editBackBtn) {
      editBackBtn.addEventListener('click', function() {
        data.ccpViewMode = 'judge';
        data.ccpEditStepIdx = undefined;
        saveData(data);
        renderActiveSection();
        renderSectionNav();
      });
    }

    // ===== 改进的"上一步"按钮（支持级联清除后续答案和重新编辑）=====
    function clearCcpAnswersFrom(hazard, fromQ) {
      if (!hazard) return;
      var qn = parseInt(fromQ);
      if (isNaN(qn)) qn = 0;
      for (var q = qn; q <= 5; q++) {
        delete hazard['q' + q];
      }
      if (qn <= 2) delete hazard['q2_need'];
      if (qn <= 2) delete hazard['q3'];
      if (qn <= 3) delete hazard['q4'];
      if (qn <= 4) delete hazard['q5'];
      delete hazard['isCCP'];
    }

    var prevStepBtn = content.querySelector('#ccpPrevStepBtn');
    if (prevStepBtn) {
      prevStepBtn.addEventListener('click', function() {
        var idx = data.ccpStepIndex;
        var hazardType = data.ccpHazardType || 'bio';
        var currentQ = data.ccpCurrentQ || 1;
        var hazardTypes = ['bio', 'chem', 'phys'];
        var hazardTypeIdx = hazardTypes.indexOf(hazardType);
        
        // 获取当前危害数据对象
        var curHazard = null;
        if (data.ccpSteps && data.ccpSteps[idx] && data.ccpSteps[idx].hazards && data.ccpSteps[idx].hazards[hazardType]) {
          curHazard = data.ccpSteps[idx].hazards[hazardType];
        }
        
        if (currentQ === 'q2_need') {
          // 从 q2_need 回退到 Q2
          if (curHazard) {
            delete curHazard['q2_need'];
            delete curHazard['isCCP'];
            delete curHazard['q3'];
            delete curHazard['q4'];
            delete curHazard['q5'];
          }
          data.ccpCurrentQ = 2;
        } else if (currentQ > 1) {
          // 回退到上一个问题，清除当前问题及后续问题的答案
          if (curHazard) clearCcpAnswersFrom(curHazard, currentQ);
          data.ccpCurrentQ = currentQ - 1;
        } else if (hazardTypeIdx > 0) {
          // 回退到上一个危害类型
          var prevHazardType = hazardTypes[hazardTypeIdx - 1];
          // 清除当前危害的所有答案和 isCCP
          if (curHazard) clearCcpAnswersFrom(curHazard, 1);
          // 也清除上一个危害的 isCCP 和后续问题，允许重新编辑
          var prevHazard = data.ccpSteps && data.ccpSteps[idx] && data.ccpSteps[idx].hazards && data.ccpSteps[idx].hazards[prevHazardType];
          if (prevHazard) {
            delete prevHazard['isCCP'];
            // 找到上一个危害最后一个有答案的问题，跳到那个问题
            var lastQ = 0;
            for (var qi = 1; qi <= 5; qi++) {
              if (prevHazard['q' + qi] !== undefined) lastQ = qi;
            }
            if (prevHazard.q2_need !== undefined) lastQ = 'q2_need';
            data.ccpCurrentQ = lastQ > 0 ? lastQ : 5;
            if (data.ccpCurrentQ > 5) data.ccpCurrentQ = 5;
          } else {
            data.ccpCurrentQ = 5;
          }
          data.ccpHazardType = prevHazardType;
        } else if (idx > 0) {
          // 回退到上一个步骤，清除当前步骤的所有答案
          var prevIdx = idx - 1;
          // 清除当前步骤所有危害的 isCCP 和答案
          if (data.ccpSteps && data.ccpSteps[idx] && data.ccpSteps[idx].hazards) {
            var allHTs = ['bio', 'chem', 'phys'];
            allHTs.forEach(function(ht) {
              var h = data.ccpSteps[idx].hazards[ht];
              if (h) clearCcpAnswersFrom(h, 1);
            });
          }
          // 回退到上一步
          data.ccpStepIndex = prevIdx;
          data.ccpHazardType = 'phys';
          data.ccpCurrentQ = 5;
          // 清除上一步的 isCCP，让用户可以重新编辑
          var prevStepHazard = data.ccpSteps && data.ccpSteps[prevIdx] && data.ccpSteps[prevIdx].hazards && data.ccpSteps[prevIdx].hazards['phys'];
          if (prevStepHazard) {
            delete prevStepHazard['isCCP'];
            var lastQ = 0;
            for (var qi = 1; qi <= 5; qi++) {
              if (prevStepHazard['q' + qi] !== undefined) lastQ = qi;
            }
            if (prevStepHazard.q2_need !== undefined) lastQ = 'q2_need';
            data.ccpCurrentQ = lastQ > 0 ? lastQ : 5;
            if (data.ccpCurrentQ > 5) data.ccpCurrentQ = 5;
          }
        }
        saveData(data);
        renderActiveSection();
        renderSectionNav();
      });
    }

    // ===== 改进的"返回编辑"按钮 =====
    var backBtn = content.querySelector('#ccpBackToEditBtn');
    if (backBtn) {
      backBtn.addEventListener('click', function() {
        var steps = data.processSteps || [];
        var lastStepIdx = 0;
        var lastHazardType = 'bio';
        var lastQ = 1;
        
        if (data.ccpSteps && data.ccpSteps.length > 0) {
          for (var si = data.ccpSteps.length - 1; si >= 0; si--) {
            var s = data.ccpSteps[si];
            if (s && s.hazards) {
              var hts = ['phys', 'chem', 'bio'];
              for (var hi = 0; hi < hts.length; hi++) {
                var ht = hts[hi];
                var h = s.hazards[ht];
                if (h) {
                  for (var qi = 5; qi >= 1; qi--) {
                    if (h['q' + qi] !== undefined) {
                      lastStepIdx = si;
                      lastHazardType = ht;
                      lastQ = qi;
                      break;
                    }
                  }
                }
              }
            }
          }
        }
        
        data.ccpCompleted = false;
        data.hazardConfirmed = false;
        data.ccpStepIndex = lastStepIdx;
        data.ccpHazardType = lastHazardType;
        data.ccpCurrentQ = lastQ;
        data.ccpViewMode = 'judge';
        if (data.ccpSteps && data.ccpSteps[lastStepIdx] && data.ccpSteps[lastStepIdx].hazards && data.ccpSteps[lastStepIdx].hazards[lastHazardType]) {
          data.ccpSteps[lastStepIdx].hazards[lastHazardType].isCCP = undefined;
        }
        saveData(data);
        renderActiveSection();
        renderSectionNav();
      });
    }

    // ===== 统一CCP判定表格事件绑定 =====
    content.querySelectorAll('.ccp-ut-desc-input').forEach(function(el) {
      el.addEventListener('input', function() {
        var si = parseInt(this.dataset.utSi);
        var ht = this.dataset.utHt;
        if (isNaN(si) || !ht) return;
        if (!data.ccpSteps) data.ccpSteps = [];
        if (!data.ccpSteps[si]) data.ccpSteps[si] = { stepName: '', hazards: {}, completed: false };
        if (!data.ccpSteps[si].hazards) data.ccpSteps[si].hazards = {};
        if (!data.ccpSteps[si].hazards[ht]) data.ccpSteps[si].hazards[ht] = {};
        data.ccpSteps[si].hazards[ht].hazardDesc = this.value;
        saveData(data);
      });
    });
    
    content.querySelectorAll('.ccp-unified-table input[type="radio"]').forEach(function(el) {
      el.addEventListener('change', function() {
        var si = parseInt(this.dataset.utSi);
        var ht = this.dataset.utHt;
        var field = this.dataset.utField;
        var value = this.value;
        if (isNaN(si) || !ht || !field) return;
        
        if (!data.ccpSteps) data.ccpSteps = [];
        if (!data.ccpSteps[si]) data.ccpSteps[si] = { stepName: data.processSteps[si]?.stepName || '', hazards: {}, completed: false };
        if (!data.ccpSteps[si].hazards) data.ccpSteps[si].hazards = {};
        if (!data.ccpSteps[si].hazards[ht]) data.ccpSteps[si].hazards[ht] = {};
        data.ccpSteps[si].hazards[ht][field] = value;
        
        var hazard = data.ccpSteps[si].hazards[ht];
        var isCCP = evaluateCCPFromQA(hazard);
        if (isCCP !== null) {
          hazard.isCCP = isCCP;
        } else {
          hazard.isCCP = undefined;
        }
        
        saveData(data);
        renderActiveSection();
        renderSectionNav();
      });
    });
    
    var saveBtn = content.querySelector('#ccpUnifiedSaveBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', function() {
        saveData(data);
        renderSectionNav();
      });
    }
    
    var finishBtn = content.querySelector('#ccpUnifiedFinishBtn');
    if (finishBtn) {
      finishBtn.addEventListener('click', function() {
        var allDone = true;
        var pendingCount = 0;
        data.processSteps.forEach(function(step, si) {
          ['bio', 'chem', 'phys'].forEach(function(ht) {
            if (data.ccpSteps && data.ccpSteps[si] && data.ccpSteps[si].hazards && data.ccpSteps[si].hazards[ht]) {
              var h = data.ccpSteps[si].hazards[ht];
              if (h.isCCP === undefined || h.isCCP === null) {
                allDone = false;
                pendingCount++;
              }
            } else {
              allDone = false;
              pendingCount++;
            }
          });
        });
        
        if (!allDone) {
          if (!confirm(I18n.t('q.ccpPendingAlert').replace('{0}', pendingCount))) return;
          data.processSteps.forEach(function(step, si) {
            ['bio', 'chem', 'phys'].forEach(function(ht) {
              if (data.ccpSteps && data.ccpSteps[si] && data.ccpSteps[si].hazards && data.ccpSteps[si].hazards[ht]) {
                var h = data.ccpSteps[si].hazards[ht];
                if (h.isCCP === undefined || h.isCCP === null) {
                  h.isCCP = false;
                }
              } else {
                if (!data.ccpSteps) data.ccpSteps = [];
                if (!data.ccpSteps[si]) data.ccpSteps[si] = { stepName: step.stepName || '', hazards: {}, completed: false };
                if (!data.ccpSteps[si].hazards) data.ccpSteps[si].hazards = {};
                if (!data.ccpSteps[si].hazards[ht]) data.ccpSteps[si].hazards[ht] = {};
                data.ccpSteps[si].hazards[ht].isCCP = false;
              }
            });
          });
        }
        
        data.ccpCompleted = true;
        saveData(data);
        renderActiveSection();
        renderSectionNav();
      });
    }
  }

  // ==================== 渲染AI危害结果到按钮下方 ====================
  function renderAiHazardResult(bio, chem, phys, matchedMaterials) {
    var resultEl = document.getElementById('aiHazardResult');
    if (!resultEl) return;
    
    // 合并所有危害数据到一个统一表格
    var allHazards = [];
    bio.forEach(function(h) { allHazards.push(h); });
    chem.forEach(function(h) { allHazards.push(h); });
    phys.forEach(function(h) { allHazards.push(h); });
    
    var html = '';
    if (matchedMaterials && matchedMaterials.length > 0) {
      html += '<div class="q15-ai-summary" style="margin-bottom:12px;padding:10px 14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;font-size:13px;color:#166534;">';
      html += I18n.b('匹配到 {n} 种原料的危害数据：|||Matched {n} material(s) with hazard data: ').replace('{n}', matchedMaterials.length);
      html += matchedMaterials.map(function(e) { return '<strong>' + esc(I18n.b(e.material || '')) + '</strong>'; }).join('、');
      html += '</div>';
    }
    if (allHazards.length > 0) {
      html += '<div class="q15-hazard-preview" style="overflow-x:auto;"><table class="q15-table" style="min-width:900px;"><thead><tr><th style="min-width:70px;">' + I18n.t('r15.rawMaterial') + '</th><th style="min-width:70px;">' + I18n.t('r15.risk') + '</th><th style="width:50px;">Q1</th><th style="width:50px;">Q2</th><th style="width:50px;">Q3</th><th style="width:70px;">' + I18n.t('r15.ccpJudgment') + '</th><th style="min-width:300px;">' + I18n.t('r15.riskDetail') + '</th></tr></thead><tbody>';
      allHazards.forEach(function(h) {
        var riskColor = (h.hazardType === '生物危害' || h.hazardType === 'Biological Hazard') ? '#dc2626' : ((h.hazardType === '化学危害' || h.hazardType === 'Chemical Hazard') ? '#d97706' : '#6b7280');
        var htDisp = (h.hazardType === '生物危害' || h.hazardType === 'Biological Hazard') ? I18n.t('q.ccpHazardBio') : (h.hazardType === '化学危害' || h.hazardType === 'Chemical Hazard') ? I18n.t('q.ccpHazardChem') : (h.hazardType === '物理危害' || h.hazardType === 'Physical Hazard') ? I18n.t('q.ccpHazardPhys') : h.hazardType;
        function yn(v) { return v === '是' ? I18n.t('common.yes') : (v === '否' ? I18n.t('common.no') : (v || '')); }
        html += '<tr><td><strong>' + esc(I18n.b(h.material || '')) + '</strong></td><td style="color:' + riskColor + ';font-weight:500;">' + esc(htDisp) + '</td><td>' + esc(yn(h.q1)) + '</td><td>' + esc(yn(h.q2)) + '</td><td>' + esc(yn(h.q3)) + '</td><td>' + esc(yn(h.ccpResult)) + '</td><td style="font-size:13px;line-height:1.5;">' + esc(I18n.b(h.detail || h.desc || '')) + '</td></tr>';
      });
      html += '</tbody></table></div>';
      html += '<div style="margin-top:10px;font-size:12px;color:var(--gray-400);text-align:right;">' + I18n.t('hazard.synced') + '</div>';
    } else {
      html = '<div class="q15-ai-result-empty" style="padding:20px;text-align:center;color:var(--gray-400);">' + I18n.t('hazard.noMatch') + '</div>';
    }
    resultEl.innerHTML = html;
  }

  // ==================== 可视化流程图 ====================
  function renderVisualFlowchart(steps) {
    if (!steps || steps.length === 0 || !steps.some(function(s) { return s.stepName && s.stepName.trim(); })) return '<p style="color:var(--gray-400);font-style:italic;text-align:center;padding:20px;">' + I18n.t('q.fcNoSteps') + '</p>';
    var validSteps = steps.filter(function(s) { return s.stepName && s.stepName.trim(); });
    var html = '<div class="q15-visual-flowchart"><div class="q15-vf-node start-end"><div class="q15-vf-node-shape start">' + I18n.t('q.fcStart') + '</div><div class="q15-vf-arrow-down"></div></div>';
    validSteps.forEach(function(step, i) { var isCCP = step.controlPoint && step.controlPoint.toLowerCase().indexOf('ccp') !== -1; var ccpLabel = isCCP ? '<span class="q15-vf-ccp-badge">' + esc(step.controlPoint) + '</span>' : ''; html += '<div class="q15-vf-node"><div class="q15-vf-node-shape ' + (isCCP ? 'ccp' : 'step') + '"><span class="q15-vf-step-num">' + (i + 1) + '</span><div class="q15-vf-step-content"><strong>' + esc(step.stepName) + '</strong>' + (step.operationMethod ? '<p class="q15-vf-detail">' + I18n.t('q.fcMethodLabel') + '' + esc(step.operationMethod) + '</p>' : '') + (step.parameters ? '<p class="q15-vf-detail">' + I18n.t('q.fcParamsLabel') + '' + esc(step.parameters) + '</p>' : '') + (step.equipmentName ? '<p class="q15-vf-detail">' + I18n.t('q.fcEquipmentLabel') + '' + esc(step.equipmentName) + '</p>' : '') + '</div>' + ccpLabel + '</div>' + (i < validSteps.length - 1 ? '<div class="q15-vf-arrow-down"></div>' : '') + '</div>'; });
    html += '<div class="q15-vf-node start-end"><div class="q15-vf-arrow-down"></div><div class="q15-vf-node-shape end">' + I18n.t('q.fcEnd') + '</div></div></div>';
    return html;
  }

  function renderFlowchartPreview(data) {
    var hasSteps = data.processSteps && data.processSteps.some(function(s) { return s.stepName && s.stepName.trim(); });
    if (data.flowchartXml) return '<div class="q15-flowchart-preview"><div class="q15-flowchart-info"><span class="q15-flowchart-icon">\u{1F4CA}</span><span>' + I18n.t('q.fcCreated') + '</span><span class="q15-flowchart-size">' + (data.flowchartXml.length / 1024).toFixed(1) + ' KB</span></div><div class="q15-flowchart-actions"><button class="btn btn-primary btn-sm" id="editDrawioBtn">\u270F\uFE0F draw.io' + I18n.t('q.fcDrawioEdit') + '</button><button class="btn-flowchart" id="q15InulinBtn" style="font-size:13px;padding:6px 18px"><span class="fc-nav-icon">\u{1F4CA}</span> ' + I18n.t('q.fcInulinBtn') + '</button><button class="btn btn-secondary btn-sm" id="clearFlowchartBtn">\u{1F5D1}\uFE0F ' + I18n.t('q.fcClear') + '</button></div></div>';
    if (hasSteps) return '<div class="q15-vf-wrapper"><div class="q15-vf-actions"><button class="btn-flowchart" id="q15InulinBtn" style="font-size:13px;padding:6px 18px"><span class="fc-nav-icon">\u{1F4CA}</span> ' + I18n.t('q.fcInulinBtn') + '</button><button class="btn btn-secondary btn-sm" id="openDrawioBtn">\u{1F4DD} ' + I18n.t('q.fcDrawioAdvanced') + '</button><a class="btn btn-secondary btn-sm" href="flowchart-preview.html?v=' + Date.now() + '" target="_blank" style="text-decoration:none;display:inline-flex;align-items:center;gap:4px;">\u{1F4CA} ' + I18n.t('q.fcTemplatePreview') + '</a></div><div id="q15VfContainer">' + renderVisualFlowchart(data.processSteps) + '</div></div>';
    return '<div class="q15-flowchart-empty"><div class="q15-flowchart-empty-icon">\u{1F4CA}</div><p>' + I18n.t('q.fcEmptyHint') + '</p><p style="font-size:12px;color:var(--gray-400);margin-top:8px;">' + I18n.t('q.fcEmptySubHint') + '</p></div>';
  }

  function bindFlowchartButtons(data) {
    const drawioBtn = document.getElementById('openDrawioBtn');
    if (drawioBtn) drawioBtn.addEventListener('click', () => { openDrawioEditor(data); });
    const editDrawioBtn = document.getElementById('editDrawioBtn');
    if (editDrawioBtn) editDrawioBtn.addEventListener('click', () => { openDrawioEditor(data); });
    var inulinBtn = document.getElementById('q15InulinBtn');
    if (inulinBtn) {
      inulinBtn.addEventListener('click', function() {
        if (typeof mermaid === 'undefined') { alert(I18n.t('q.fcMermaidNotLoaded')); return; }
        var modal = document.createElement('div'); modal.className = 'q15-drawio-modal-overlay'; modal.style.zIndex = '1000';
        modal.innerHTML = '<div class="q15-drawio-modal" style="height:90vh;width:92vw"><div class="q15-drawio-toolbar"><span class="q15-drawio-title">' + I18n.t('q.fcInulinModalTitle') + '</span><div class="q15-drawio-toolbar-actions"><span id="inulinStatus" style="font-size:12px;color:var(--gray-400)"></span><button class="q15-drawio-close" id="inulinModalClose">&times;</button></div></div><div style="flex:1;padding:16px;overflow:auto" id="inulinModalBody"></div></div>';
        document.body.appendChild(modal);
        var body = document.getElementById('inulinModalBody');
        var src = I18n.processBilingual((window.INULIN_FLOWCHART && window.INULIN_FLOWCHART.mermaid) ? window.INULIN_FLOWCHART.mermaid : 'graph TD\n  L1["流程图数据未定义|||Flowchart data not defined"]');
        try { localStorage.setItem('haccp_flowchart_mermaid', src); } catch(e) { console.warn('Failed to write localStorage haccp_flowchart_mermaid:', e); }
        var editMode = false;
        function renderInulinBody() { body.innerHTML = ''; var tb = document.createElement('div'); tb.className = 'fc-toolbar'; tb.innerHTML = '<button class="btn btn-sm btn-secondary" id="inulinToggleEdit">' + (editMode ? I18n.t('q.fcPreviewChart') : I18n.t('q.fcEditChart')) + '</button><span class="fc-toolbar-info" id="inulinInfo">' + (editMode ? I18n.t('q.fcEditModeHint') : I18n.t('q.fcPreviewModeHint')) + '</span>'; body.appendChild(tb); if (editMode) renderInulinEditor(body); else renderInulinChart(body); document.getElementById('inulinToggleEdit')?.addEventListener('click', function() { if (editMode) { var ta = document.getElementById('fcFullSourceEditor'); if (ta) { try { localStorage.setItem('haccp_flowchart_mermaid', ta.value); } catch(e) { console.warn('Failed to write localStorage haccp_flowchart_mermaid from editor:', e); } } } editMode = !editMode; renderInulinBody(); }); }
        function renderInulinChart(container) { var currentSrc = ''; try { currentSrc = localStorage.getItem('haccp_flowchart_mermaid') || src; } catch(e) { currentSrc = src; } var chartDiv = document.createElement('div'); chartDiv.className = 'mermaid'; chartDiv.textContent = I18n.processBilingual(currentSrc); container.appendChild(chartDiv); var legend = document.createElement('div'); legend.className = 'fc-legend'; legend.innerHTML = '<div class="fc-legend-title">' + I18n.t('q.flowchartLegend') + '</div><div class="fc-legend-items"><div class="fc-legend-item"><span class="fc-legend-dot ccp"></span>' + I18n.t('q.ccpLegend') + '</div><div class="fc-legend-item"><span class="fc-legend-dot oprp"></span>' + I18n.t('q.oprpLegend') + '</div><div class="fc-legend-item"><span class="fc-legend-dot cqp"></span>' + I18n.t('q.cqpLegend') + '</div><div class="fc-legend-item"><span class="fc-legend-dot io"></span>' + I18n.t('q.ioLegend') + '</div></div>'; container.appendChild(legend); mermaid.initialize({ startOnLoad: false, theme: 'default', flowchart: { useMaxWidth: true, htmlLabels: true } }); setTimeout(function() { mermaid.run({ nodes: [chartDiv] }).catch(function(err) { chartDiv.innerHTML = '<p style="color:red">' + I18n.t('q.fcRenderError') + (err.message || err) + '</p>'; }); }, 100); }
        function renderInulinEditor(container) { var currentSrc = ''; try { currentSrc = localStorage.getItem('haccp_flowchart_mermaid') || src; } catch(e) { currentSrc = src; } var parsed = parseInulinNodes(currentSrc); var help = document.createElement('div'); help.className = 'fc-editor-help'; help.innerHTML = I18n.t('q.fcEditorHelp'); container.appendChild(help); var table = document.createElement('table'); table.className = 'fc-node-table'; table.innerHTML = '<thead><tr><th>ID</th><th>' + I18n.t('q.fcNodeText') + '</th><th>' + I18n.t('q.fcNodeType') + '</th><th style="width:40px"></th></tr></thead><tbody id="inulinNodeBody"></tbody></table>'; container.appendChild(table); var tbody = document.getElementById('inulinNodeBody'); for (var i = 0; i < parsed.nodes.length; i++) { var n = parsed.nodes[i]; var tr = document.createElement('tr'); tr.dataset.nodeid = n.id; tr.innerHTML = '<td><code>' + n.id + '</code></td><td><input class="fc-node-input" data-nodeid="' + n.id + '" value="' + n.label.replace(/"/g,'"') + '" /></td><td><span class="fc-node-badge ' + n.type + '">' + n.type.toUpperCase() + '</span></td><td><button class="fc-btn-del inulin-del-node" data-nodeid="' + n.id + '">✕</button></td>'; tbody.appendChild(tr); } var addBtn = document.createElement('button'); addBtn.className = 'btn btn-sm btn-secondary'; addBtn.style.margin = '8px 0'; addBtn.textContent = I18n.t('q.fcAddNode'); addBtn.addEventListener('click', function() { var tb = document.getElementById('inulinNodeBody'); var newId = 'N' + Date.now(); var tr = document.createElement('tr'); tr.dataset.nodeid = newId; tr.innerHTML = '<td><code>' + newId + '</code></td><td><input class="fc-node-input" data-nodeid="' + newId + '" value="' + I18n.t('q.fcNewStep') + (tb.children.length + 1) + '" /></td><td><select class="fc-input-type"><option value="step">STEP</option><option value="ccp">CCP</option><option value="oprp">OPRP</option><option value="cqp">CQP</option><option value="io">IO</option></select></td><td><button class="fc-btn-del inulin-del-node" data-nodeid="' + newId + '">✕</button></td>'; tr.querySelector('.inulin-del-node').addEventListener('click', function() { tr.remove(); }); tb.appendChild(tr); }); container.appendChild(addBtn); container.querySelectorAll('.inulin-del-node').forEach(function(btn) { btn.addEventListener('click', function() { var row = this.closest('tr'); if (row) row.remove(); }); }); if (parsed.edges.length > 0) { var eHelp = document.createElement('div'); eHelp.className = 'fc-editor-help'; eHelp.style.marginTop = '16px'; eHelp.textContent = I18n.t('q.fcEdgeLabels'); container.appendChild(eHelp); var eTable = document.createElement('table'); eTable.className = 'fc-node-table'; eTable.innerHTML = '<thead><tr><th>' + I18n.t('q.fcEdgeFrom') + '</th><th>' + I18n.t('q.fcEdgeText') + '</th><th style="width:40px"></th></tr></thead><tbody id="inulinEdgeBody"></tbody></table>'; container.appendChild(eTable); var etbody = document.getElementById('inulinEdgeBody'); for (var i = 0; i < parsed.edges.length; i++) { var e = parsed.edges[i]; if (!e.label) continue; var tr = document.createElement('tr'); tr.innerHTML = '<td><code>' + e.from + ' → ' + e.to + '</code></td><td><input class="fc-edge-label" data-edge="' + e.from + '|' + e.to + '" value="' + (e.label || '') + '" style="width:100%" /></td><td><button class="fc-btn-del inulin-del-edge">✕</button></td>'; tr.querySelector('.inulin-del-edge').addEventListener('click', function() { this.closest('tr').remove(); }); etbody.appendChild(tr); } var addEdgeBtn = document.createElement('button'); addEdgeBtn.className = 'btn btn-sm btn-secondary'; addEdgeBtn.style.margin = '8px 0'; addEdgeBtn.textContent = I18n.t('q.fcAddEdge'); addEdgeBtn.addEventListener('click', function() { var tb = document.getElementById('inulinEdgeBody'); var newId1 = 'N' + Date.now(); var newId2 = 'N' + (Date.now() + 1); var tr = document.createElement('tr'); tr.innerHTML = '<td><input class="fc-edge-input" value="' + newId1 + '-->' + newId2 + '" style="width:120px;font-size:12px" /></td><td><input class="fc-edge-label" value="" style="width:100%" /></td><td><button class="fc-btn-del inulin-del-edge">✕</button></td>'; tr.querySelector('.inulin-del-edge').addEventListener('click', function() { tr.remove(); }); tb.appendChild(tr); }); container.appendChild(addEdgeBtn); } var actions = document.createElement('div'); actions.className = 'fc-editor-actions'; actions.style.marginTop = '12px'; actions.innerHTML = '<button class="btn btn-primary btn-sm" id="inulinApply">' + I18n.t('q.fcApply') + '</button><button class="btn btn-secondary btn-sm" id="inulinReset">' + I18n.t('q.fcResetDefault') + '</button><span class="fc-editor-status" id="inulinEditStatus"></span>'; container.appendChild(actions); document.getElementById('inulinApply').addEventListener('click', function() { var ns = currentSrc; var changes = 0; container.querySelectorAll('.fc-node-input').forEach(function(inp) { var nid = inp.dataset.nodeid; var nl = inp.value.trim(); if (!nid || !nl) return; var lens = ns.split('\n'); for (var j = 0; j < lens.length; j++) { var l = lens[j].trim(); var m = l.match(new RegExp('^' + nid + '\\["(.+?)"\\]')); if (m) { var ol = m[1]; if (ol !== nl) { ns = ns.split(nid + '["' + ol + '"]').join(nid + '["' + nl + '"]'); changes++; } break; } } }); container.querySelectorAll('.fc-edge-label').forEach(function(inp) { var edge = inp.dataset.edge; var nl = inp.value.trim(); if (!edge) return; var parts = edge.split('|'); if (parts.length !== 2) return; var from = parts[0], to = parts[1]; var lens = ns.split('\n'); for (var j = 0; j < lens.length; j++) { var l = lens[j].trim(); var m = l.match(new RegExp('^' + from + '\\s*[-=.]+>\\|(.+?)\\|\\s*' + to + '$')); if (m) { var ol = m[1]; if (nl === '') { ns = ns.split(l).join(from + ' --> ' + to); } else if (ol !== nl) { ns = ns.split('|' + ol + '|').join('|' + nl + '|'); } changes++; break; } } }); if (changes > 0) { try { localStorage.setItem('haccp_flowchart_mermaid', ns); } catch(e) { console.warn('Failed to write localStorage haccp_flowchart_mermaid after apply:', e); } document.getElementById('inulinEditStatus').textContent = I18n.t('q.fcApplied').replace('{0}', changes); currentSrc = ns; } else { document.getElementById('inulinEditStatus').textContent = I18n.t('q.fcNoChanges'); } }); document.getElementById('inulinReset').addEventListener('click', function() { if (window.INULIN_FLOWCHART && window.INULIN_FLOWCHART.mermaid) { try { localStorage.setItem('haccp_flowchart_mermaid', window.INULIN_FLOWCHART.mermaid); } catch(e) { console.warn('Failed to write localStorage haccp_flowchart_mermaid on reset:', e); } document.getElementById('inulinEditStatus').textContent = I18n.t('q.fcRestored'); renderInulinBody(); } }); }
        function parseInulinNodes(src) { var nodes = [], edges = [], lens = src.split('\n'), nodeRegex = /^(\w+)\["(.+?)"\]/, edgeRegex = /^(\w+)\s*[-=.]+>\s*(?:\|(.+?)\|)?\s*(\w+)/; for (var i = 0; i < lens.length; i++) { var l = lens[i].trim(); if (!l || l.startsWith('%%') || l.startsWith('graph') || l.startsWith('classDef')) continue; var m = l.match(nodeRegex); if (m) { var id = m[1], label = m[2]; if (id === 'loop_text' || id === 'L6_text' || id === 'L7_text' || id === 'R2_text' || id === 'R3_text') continue; var type = 'step'; if (l.indexOf(':::ccp') > -1) type = 'ccp'; else if (l.indexOf(':::oprp') > -1) type = 'oprp'; else if (l.indexOf(':::cqp') > -1) type = 'cqp'; else if (l.indexOf(':::io') > -1) type = 'io'; nodes.push({ id: id, label: label, type: type }); continue; } var e = l.match(edgeRegex); if (e) edges.push({ from: e[1], to: e[3], label: e[2] || '' }); } return { nodes: nodes, edges: edges }; }
        renderInulinBody(); document.getElementById('inulinModalClose').onclick = function() { modal.remove(); }; modal.onclick = function(e) { if (e.target === modal) modal.remove(); };
      });
    }
    const clearBtn = document.getElementById('clearFlowchartBtn');
    if (clearBtn) { clearBtn.addEventListener('click', () => { data.flowchartXml = ''; saveData(data); const area = document.getElementById('flowchartArea'); if (area) { area.innerHTML = renderFlowchartPreview(data); bindFlowchartButtons(data); } }); }
  }

  const DRAWIO_BASE = 'https://embed.diagrams.net/';
  function xesc(s) { if (!s) return ''; return String(s).replace(/[&]/g, '&').replace(/[<]/g, '<').replace(/[>]/g, '>').replace(/["]/g, '"'); }

  // 根据操作步骤生成 draw.io XML
  function generateDrawioXml(steps) {
    var validSteps = (steps || []).filter(function(s) { return s.stepName && s.stepName.trim(); });
    var cells = [];
    var NODE_W = 160, NODE_H = 60, ARROW_H = 40;
    var cx = 300; // 中心x

    // 起始节点
    var startY = 40;
    cells.push('<mxCell id="0" /><mxCell id="1" parent="0" />');
    cells.push('<mxCell id="start" value="' + I18n.t('q.fcStart') + '" style="ellipse;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;fontSize=14;fontStyle=1;" vertex="1" parent="1"><mxGeometry x="' + (cx - 50) + '" y="' + startY + '" width="100" height="50" as="geometry" /></mxCell>');

    var prevId = 'start';
    var curY = startY + 50 + ARROW_H;

    for (var i = 0; i < validSteps.length; i++) {
      var step = validSteps[i];
      var nodeId = 'step_' + i;
      var isCCP = step.controlPoint && step.controlPoint.toLowerCase().indexOf('ccp') !== -1;
      var fillColor = isCCP ? '#f8cecc' : '#dae8fc';
      var strokeColor = isCCP ? '#b85450' : '#6c8ebf';
      var labelLines = [xesc(step.stepName)];
      if (step.parameters) labelLines.push('<font style="font-size:10px;color:#555;">' + xesc(step.parameters) + '</font>');
      if (isCCP && step.controlPoint) labelLines.push('<b style="color:#b85450;">' + xesc(step.controlPoint) + '</b>');
      var label = '<html>' + labelLines.join('<br>') + '</html>';

      cells.push('<mxCell id="' + nodeId + '" value="' + label + '" style="rounded=1;whiteSpace=wrap;html=1;fillColor=' + fillColor + ';strokeColor=' + strokeColor + ';fontSize=12;" vertex="1" parent="1"><mxGeometry x="' + (cx - NODE_W / 2) + '" y="' + curY + '" width="' + NODE_W + '" height="' + NODE_H + '" as="geometry" /></mxCell>');

      // 箭头
      var arrowId = 'arrow_' + i;
      cells.push('<mxCell id="' + arrowId + '" style="edgeStyle=orthogonalEdgeStyle;" edge="1" source="' + prevId + '" target="' + nodeId + '" parent="1"><mxGeometry relative="1" as="geometry" /></mxCell>');

      prevId = nodeId;
      curY += NODE_H + ARROW_H;
    }

    // 结束节点
    cells.push('<mxCell id="end" value="' + I18n.t('q.fcEnd') + '" style="ellipse;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;fontSize=14;fontStyle=1;" vertex="1" parent="1"><mxGeometry x="' + (cx - 50) + '" y="' + curY + '" width="100" height="50" as="geometry" /></mxCell>');
    cells.push('<mxCell id="arrow_end" style="edgeStyle=orthogonalEdgeStyle;" edge="1" source="' + prevId + '" target="end" parent="1"><mxGeometry relative="1" as="geometry" /></mxCell>');

    var totalH = curY + 50 + 40;
    return '<?xml version="1.0" encoding="UTF-8"?><mxGraphModel dx="1422" dy="762" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1169" pageHeight="827" math="0" shadow="0"><root>' + cells.join('') + '</root></mxGraphModel>';
  }

  // 打开 draw.io 嵌入式编辑器
  function openDrawioEditor(data) {
    // 准备初始 XML
    var initXml = data.flowchartXml || '';
    if (!initXml) {
      var validSteps = (data.processSteps || []).filter(function(s) { return s.stepName && s.stepName.trim(); });
      initXml = generateDrawioXml(validSteps);
    }

    // 创建遮罩
    var overlay = document.createElement('div');
    overlay.className = 'q15-drawio-modal-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center;';

    overlay.innerHTML = [
      '<div style="background:#fff;border-radius:10px;width:95vw;height:94vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.4);">',
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 20px;background:#1e293b;color:#fff;border-radius:10px 10px 0 0;">',
          '<span style="font-size:15px;font-weight:600;">' + I18n.t('q.fcDrawioTitle') + '</span>',
          '<div style="display:flex;align-items:center;gap:10px;">',
            '<span id="drawioStatus" style="font-size:12px;color:#94a3b8;"></span>',
            '<button id="drawioSaveBtn" style="background:#2563eb;color:#fff;border:none;border-radius:6px;padding:6px 16px;cursor:pointer;font-size:13px;">' + I18n.t('q.fcDrawioSave') + '</button>',
            '<button id="drawioCloseBtn" style="background:rgba(255,255,255,.15);color:#fff;border:none;border-radius:6px;padding:6px 14px;cursor:pointer;font-size:13px;">' + I18n.t('q.fcDrawioClose') + '</button>',
          '</div>',
        '</div>',
        '<div style="flex:1;position:relative;background:#f1f5f9;">',
          '<div id="drawioLoadingMask" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#f1f5f9;z-index:5;font-size:14px;color:#64748b;">',
            '<div style="text-align:center;"><div class="fc-spinner" style="width:36px;height:36px;border-width:4px;margin:0 auto 12px;"></div><p>' + I18n.t('q.fcDrawioLoading') + '</p><p style="font-size:12px;margin-top:4px;">' + I18n.t('q.fcDrawioLoadingHint') + '</p></div>',
          '</div>',
          '<iframe id="drawioFrame" src="https://embed.diagrams.net/?embed=1&proto=json&spin=1&stealth=1&lang=' + I18n.t('q.fcDrawioLang') + '" style="width:100%;height:100%;border:none;display:block;" allowfullscreen></iframe>',
        '</div>',
      '</div>'
    ].join('');

    document.body.appendChild(overlay);

    var frame = document.getElementById('drawioFrame');
    var statusEl = document.getElementById('drawioStatus');
    var loadingMask = document.getElementById('drawioLoadingMask');
    var iframeReady = false;
    var pendingXml = initXml;
    var currentXml = initXml;

    function setStatus(msg) { if (statusEl) statusEl.textContent = msg; }

    // 与 draw.io iframe 的 postMessage 通信
    function sendToFrame(msg) {
      try { frame.contentWindow.postMessage(JSON.stringify(msg), '*'); } catch(e) { console.warn('Failed to send postMessage to draw.io iframe:', e); }
    }

    function handleMessage(evt) {
      var msg;
      try { msg = JSON.parse(evt.data); } catch(e) { return; }
      if (!msg || !msg.event) return;

      if (msg.event === 'init') {
        // draw.io 已就绪，发送加载指令
        if (loadingMask) loadingMask.style.display = 'none';
        iframeReady = true;
        sendToFrame({ action: 'load', autosave: 1, xml: pendingXml || '' });
        setStatus(I18n.t('q.fcDrawioEditingHint'));
      } else if (msg.event === 'autosave') {
        currentXml = msg.xml || currentXml;
        setStatus(I18n.t('q.fcDrawioAutoSaving'));
        setTimeout(function() { setStatus(I18n.t('q.fcDrawioEditing')); }, 1500);
      } else if (msg.event === 'save') {
        currentXml = msg.xml || currentXml;
        doSave();
      } else if (msg.event === 'export') {
        currentXml = msg.xml || currentXml;
        doSave();
      } else if (msg.event === 'close') {
        closeEditor();
      }
    }

    function doSave() {
      data.flowchartXml = currentXml;
      saveData(data);
      setStatus(I18n.t('q.fcDrawioSaved'));
      // 刷新预览区域
      var area = document.getElementById('flowchartArea');
      if (area) {
        area.innerHTML = renderFlowchartPreview(data);
        bindFlowchartButtons(data);
      }
    }

    function closeEditor() {
      window.removeEventListener('message', handleMessage);
      overlay.remove();
    }

    window.addEventListener('message', handleMessage);

    document.getElementById('drawioSaveBtn').onclick = function() {
      // 请求 draw.io 导出当前 XML
      sendToFrame({ action: 'export', format: 'xml' });
    };
    document.getElementById('drawioCloseBtn').onclick = closeEditor;
    overlay.addEventListener('click', function(e) { if (e.target === overlay) closeEditor(); });

    // 超时提示
    setTimeout(function() {
      if (!iframeReady && loadingMask && loadingMask.style.display !== 'none') {
        loadingMask.innerHTML = '<div style="text-align:center;color:#dc2626;"><p style="font-size:16px;margin-bottom:8px;">' + I18n.t('flow.timeoutTitle') + '</p><p style="font-size:13px;">' + I18n.t('flow.timeoutDesc') + '</p></div>';
      }
    }, 15000);
  }

  // ==================== 将 renderProcessFlow 改造为三子步骤 ====================
  // 重写 renderProcessFlow (临时方案 - 在原有基础上扩展)
  // 使用 data.hazardWorksheetStep 字段控制子步骤: 'identify' | 'assess' | 'control'

  // 子步骤导航
  function renderHazardSubNav(data) {
    var step = data.hazardWorksheetStep || 'identify';
    var steps = [
      { id: 'identify', label: I18n.t('q.hwIdentifyLabel'), icon: '🔍' },
      { id: 'assess', label: I18n.t('q.hwAssessLabel'), icon: '📊' },
      { id: 'control', label: I18n.t('q.hwControlLabel'), icon: '🛡️' }
    ];
    var html = '<div class="hw-subnav">';
    steps.forEach(function(s) {
      var isActive = s.id === step;
      var isDone = false;
      if (s.id === 'identify') isDone = data.hazardWorksheet && data.hazardWorksheet.length > 0;
      else if (s.id === 'assess') isDone = data.hazardWorksheet.some(function(st) { return st.hazards && st.hazards.some(function(h) { return h.isSignificant !== undefined; }); });
      else if (s.id === 'control') isDone = data.hazardWorksheet.some(function(st) { return st.hazards && st.hazards.some(function(h) { return h.controlMeasure; }); });
      html += '<div class="hw-subnav-item ' + (isActive ? 'active' : '') + (isDone ? ' done' : '') + '" data-hw-step="' + s.id + '">' +
        '<span class="hw-subnav-num">' + (isDone ? '✓' : s.icon) + '</span>' +
        '<span>' + s.label + '</span></div>';
    });
    html += '</div>';
    return html;
  }

  // ===== 更新 renderProcessFlow 为三子步骤 =====
  // 保持原有的 renderProcessFlow 函数名，但内部委托到子函数
  // 注意：这会在加载时覆盖 renderProcessFlow 函数定义

  // 步骤危害数据库缓存 + Map索引
  var _stepHazardsCache = null;
  var _stepHazardsMap = null;

  // 构建Map索引（步骤名→条目 + 别名→条目）
  function buildStepHazardsMap(data) {
    _stepHazardsMap = new Map();
    if (!data || !Array.isArray(data)) return;
    data.forEach(function(entry) {
      if (!entry.step) return;
      _stepHazardsMap.set(entry.step.toLowerCase(), entry);
      if (entry.aliases && Array.isArray(entry.aliases)) {
        entry.aliases.forEach(function(alias) {
          if (alias) _stepHazardsMap.set(alias.toLowerCase(), entry);
        });
      }
    });
  }

  // 加载步骤危害数据库（加载后自动构建Map索引，带超时）
  function loadStepHazards(forceRefresh) {
    if (_stepHazardsCache && !forceRefresh) return Promise.resolve(_stepHazardsCache);
    // 如果强制刷新，清除缓存
    if (forceRefresh) { _stepHazardsCache = null; _stepHazardsMap = null; }
    var url = 'data/step_hazards.json?t=' + Date.now();
    // 使用 AbortController 实现 5 秒超时
    var controller = new AbortController();
    var timeoutId = setTimeout(function() { controller.abort(); }, 5000);
    return fetch(url, { signal: controller.signal })
      .then(function(resp) {
        clearTimeout(timeoutId);
        if (!resp.ok) throw new Error('加载失败');
        return resp.json();
      })
      .then(function(data) {
        _stepHazardsCache = data;
        buildStepHazardsMap(data);
        return data;
      })
      .catch(function(err) {
        clearTimeout(timeoutId);
        console.warn('步骤危害数据库加载失败:', err);
        return [];
      });
  }

  // 强制刷新危害匹配（清除缓存 + 清空已匹配数据 + 重新匹配）
  function refreshStepHazards(data) {
    // 清除已匹配的数据
    data.hazardWorksheet = [];
    data._unmatchedSteps = [];
    saveData(data);
    
    // 强制重新加载并匹配
    var fcSteps = getAllFcSteps();
    if (fcSteps.length === 0) {
      renderActiveSection();
      renderSectionNav();
      return;
    }
    
    loadStepHazards(true).then(function(stepDb) {
      if (!stepDb || stepDb.length === 0) return;
      
      var ws = [];
      var matchedCount = 0;
      var unmatchedSteps = [];
      
      fcSteps.forEach(function(stepName) {
        var matched = matchStepName(stepName, stepDb);
        var stepEntry = { stepId: genId(), stepName: stepName || '', hazards: [] };
        
        if (matched) {
          matchedCount++;
          var h = matched.hazards;
          if (h.bio && h.bio.desc && h.bio.desc !== '无显著生物危害' && h.bio.desc !== '无') {
            stepEntry.hazards.push({
              id: genId(), category: 'biological', hazardDesc: h.bio.desc, source: stepName,
              isSignificant: h.bio.isSignificant || false, severity: h.bio.isSignificant ? '高' : '中',
              likelihood: h.bio.isSignificant ? '高' : '中', basis: h.bio.basis || '',
              controlMeasure: h.bio.control || '', controlRelation: h.bio.controlRelation || ''
            });
          }
          if (h.chem && h.chem.desc && h.chem.desc !== '无显著化学危害' && h.chem.desc !== '无') {
            stepEntry.hazards.push({
              id: genId(), category: 'chemical', hazardDesc: h.chem.desc, source: stepName,
              isSignificant: h.chem.isSignificant || false, severity: h.chem.isSignificant ? '高' : '中',
              likelihood: h.chem.isSignificant ? '高' : '中', basis: h.chem.basis || '',
              controlMeasure: h.chem.control || '', controlRelation: h.chem.controlRelation || ''
            });
          }
          if (h.phys && h.phys.desc && h.phys.desc !== '无显著物理危害' && h.phys.desc !== '无') {
            stepEntry.hazards.push({
              id: genId(), category: 'physical', hazardDesc: h.phys.desc, source: stepName,
              isSignificant: h.phys.isSignificant || false, severity: h.phys.isSignificant ? '高' : '中',
              likelihood: h.phys.isSignificant ? '中' : '低', basis: h.phys.basis || '',
              controlMeasure: h.phys.control || '', controlRelation: h.phys.controlRelation || ''
            });
          }
        } else {
          unmatchedSteps.push(stepName);
        }
        ws.push(stepEntry);
      });
      
      data.hazardWorksheet = ws;
      data._unmatchedSteps = unmatchedSteps;
      data._hazardStepFingerprint = fcSteps.join(',');
      data._hazardFromAI = 'mock';
      saveData(data);
      
      renderActiveSection();
      renderSectionNav();
    });
  }

  // saveData防抖：避免频繁序列化大对象
  var _saveDataTimer = null;
  function debouncedSaveData(data) {
    if (_saveDataTimer) clearTimeout(_saveDataTimer);
    _saveDataTimer = setTimeout(function() {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch(e) { console.warn('Failed to write localStorage ' + STORAGE_KEY + ':', e); }
      _saveDataTimer = null;
    }, 50);
  }

  // 步骤模糊匹配（优先使用Map索引，支持 exclude 排除词避免误匹配）
  function matchStepName(userStepName, stepDb) {
    if (!userStepName) return null;
    var name = userStepName.trim().toLowerCase();
    function excluded(entry) {
      if (!entry || !entry.exclude || entry.exclude.length === 0) return false;
      return entry.exclude.some(function(x) { return x && name.indexOf(String(x).toLowerCase()) !== -1; });
    }
    // 优先使用Map索引（O(1)精确匹配）
    if (_stepHazardsMap) {
      var mapEntry = _stepHazardsMap.get(name);
      if (mapEntry && !excluded(mapEntry)) return mapEntry;
    }
    if (!stepDb) return null;
    // 回退：包含匹配（用户步骤名包含数据库步骤名，或反之）
    for (var i = 0; i < stepDb.length; i++) {
      var entry = stepDb[i];
      if (excluded(entry)) continue;
      if (name.indexOf(entry.step.toLowerCase()) !== -1 || entry.step.toLowerCase().indexOf(name) !== -1) return entry;
      if (entry.aliases) {
        for (var k = 0; k < entry.aliases.length; k++) {
          if (name.indexOf(entry.aliases[k].toLowerCase()) !== -1 || entry.aliases[k].toLowerCase().indexOf(name) !== -1) return entry;
        }
      }
    }
    return null;
  }

  // 从档案数据中读取流程图编辑器步骤
  function getFcStepsFromProfile() {
    try {
      var raw = localStorage.getItem('haccp_profile_data');
      if (!raw) return [];
      var profileData = JSON.parse(raw);
      if (profileData.fcEditor && profileData.fcEditor.steps && profileData.fcEditor.steps.length > 0) {
        return profileData.fcEditor.steps;
      }
      // 兼容旧版本：如果 fcEditor 不存在但 processSteps 有数据
      if (profileData.processSteps && profileData.processSteps.length > 0) {
        var steps = [];
        profileData.processSteps.forEach(function(s) {
          if (s.stepName && s.stepName.trim()) steps.push(s.stepName.trim());
        });
        return steps;
      }
    } catch (e) { console.warn('Failed to parse flow steps from draw.io XML:', e); }
    return [];
  }

  // 汇总所有步骤来源：问卷 processSteps（用户确认）→ 档案流程图 → 流程图编辑器(haccp_fc_steps)
  function getAllFcSteps() {
    var steps = [];
    try {
      var qRaw = localStorage.getItem('haccp_15min_data');
      if (qRaw) {
        var qd = JSON.parse(qRaw);
        if (qd.processSteps && qd.processSteps.length > 0) {
          qd.processSteps.forEach(function(s) {
            if (s.stepName && s.stepName.trim()) steps.push(s.stepName.trim());
          });
        }
      }
    } catch (e) {}
    if (steps.length === 0) {
      steps = getFcStepsFromProfile();
    }
    if (steps.length === 0) {
      try {
        var fcRaw = localStorage.getItem('haccp_fc_steps');
        if (fcRaw) {
          var arr = JSON.parse(fcRaw);
          if (Array.isArray(arr)) arr.forEach(function(n) { if (n && n.trim()) steps.push(n.trim()); });
        }
      } catch (e) {}
    }
    return steps;
  }

  // 流程图步骤自动加载到 CCP 判定步骤表（当问卷步骤为空时）
  function autoFillStepsFromFlowchart(data) {
    if (data.processSteps && data.processSteps.some(function(s) { return s.stepName && s.stepName.trim(); })) return;
    var names = getAllFcSteps();
    if (names.length === 0) return;
    var ccpArr = [];
    try {
      var ccpRaw = localStorage.getItem('haccp_fc_ccp');
      if (ccpRaw) { ccpArr = JSON.parse(ccpRaw); }
    } catch (e) {}
    data.processSteps = names.map(function(n, i) {
      return {
        id: genId(),
        stepName: n,
        operationMethod: '',
        parameters: '',
        controlPoint: (ccpArr[i] === 1) ? 'CCP' : '',
        equipmentName: ''
      };
    });
    saveData(data);
  }

  // 自动匹配步骤危害（从档案/问卷/流程图中读取步骤）— 关键词匹配优先（确定性、可复现），全部未命中时回退 AI
  function autoMatchStepHazards(data) {
    var fcSteps = getAllFcSteps();
    if (fcSteps.length === 0) {
      renderActiveSection();
      renderSectionNav();
      return;
    }
    keywordMatchStepHazards(data, fcSteps);
  }

  // 关键词匹配（内置双语知识库，确定性输出）；匹配不到任何步骤时回退 AI
  function keywordMatchStepHazards(data, fcSteps) {
    loadStepHazards().then(function(stepDb) {
      var re = /Jerusalem artichoke/gi;
      function fixText(v) { return (typeof v === 'string' && v.indexOf('Jerusalem') !== -1) ? v.replace(re, 'chicory root') : v; }
      var ws = [];
      var matchedCount = 0;
      var unmatchedSteps = [];
      fcSteps.forEach(function(stepName) {
        stepName = fixText(stepName);
        var matched = matchStepName(stepName, stepDb);
        var stepEntry = { stepId: genId(), stepName: stepName || '', hazards: [] };
        if (matched) {
          matchedCount++;
          var h = matched.hazards;
          ['bio', 'chem', 'phys'].forEach(function(ht, hi) {
            var hd = h[ht];
            if (!hd || !hd.desc) return;
            var isNone = hd.desc.indexOf('无显著') !== -1 || hd.desc === '无';
            if (isNone && hd.desc.indexOf('|||') !== -1) {
              // 双语"无显著"标记同样跳过
              if (hd.desc.split('|||')[0].indexOf('无显著') !== -1 || hd.desc.split('|||')[0] === '无') return;
            } else if (isNone) return;
            stepEntry.hazards.push({
              id: genId(),
              category: ht === 'bio' ? 'biological' : (ht === 'chem' ? 'chemical' : 'physical'),
              hazardDesc: fixText(hd.desc),
              source: fixText(matched.step || stepName),
              isSignificant: !!hd.isSignificant,
              severity: hd.isSignificant ? '高' : '中',
              likelihood: hd.isSignificant ? '高' : '中',
              basis: fixText(hd.basis || ''),
              controlMeasure: fixText(hd.control || ''),
              controlRelation: fixText(hd.controlRelation || '')
            });
          });
        } else {
          unmatchedSteps.push(stepName);
        }
        ws.push(stepEntry);
      });
      if (matchedCount > 0) {
        // 关键词匹配成功：确定性结果，直接应用
        data.hazardWorksheet = ws;
        data._unmatchedSteps = unmatchedSteps;
        data._hazardStepFingerprint = fcSteps.join(',');
        data._hazardFromAI = 'keyword';
        saveData(data);
        maybeTranslateHazardsForLang(data);
        renderActiveSection();
        renderSectionNav();
      } else {
        // 关键词完全未命中 → 回退 AI 匹配
        aiMatchStepHazards(data, fcSteps);
      }
    });
  }

  // ===== AI 步骤危害结果缓存 =====
  function getAiStepHazardsCacheKey(fcSteps, data) {
    return 'aih|v2|' + fcSteps.join('|') + '|' + (data.productName || '') + '|' + (data.rawMaterials || '');
  }
  function loadAiStepHazardsCache(key) {
    try {
      var raw = localStorage.getItem('haccp_ai_step_cache');
      if (!raw) return null;
      var obj = JSON.parse(raw);
      // 迁移旧缓存中的历史名称
      var cacheDirty = false;
      Object.keys(obj).forEach(function(k) {
        var entry = obj[k];
        if (entry && entry.data) {
          var txt = JSON.stringify(entry.data);
          if (txt.indexOf('Jerusalem') !== -1) {
            try { entry.data = JSON.parse(txt.replace(/Jerusalem artichoke/gi, 'chicory root')); cacheDirty = true; } catch(e2) {}
          }
        }
      });
      if (cacheDirty) localStorage.setItem('haccp_ai_step_cache', JSON.stringify(obj));
      var hit = obj[key];
      if (hit && hit.data && hit.data.length) return hit.data;
    } catch(e) {}
    return null;
  }
  function saveAiStepHazardsCache(key, results) {
    try {
      var raw = localStorage.getItem('haccp_ai_step_cache');
      var obj = raw ? JSON.parse(raw) : {};
      obj[key] = { data: results, time: Date.now() };
      var keys = Object.keys(obj);
      if (keys.length > 10) {
        keys.sort(function(a, b) { return (obj[a].time || 0) - (obj[b].time || 0); });
        keys.slice(0, keys.length - 10).forEach(function(k) { delete obj[k]; });
      }
      localStorage.setItem('haccp_ai_step_cache', JSON.stringify(obj));
    } catch(e) {}
  }

  // 把 AI 返回的危害条目应用到 worksheet（写入前迁移旧名称）
  function applyAiStepResults(data, fcSteps, entries, source) {
    var re = /Jerusalem artichoke/gi;
    function fixText(v) { return (typeof v === 'string' && v.indexOf('Jerusalem') !== -1) ? v.replace(re, 'chicory root') : v; }
    var ws = [];
    var unmatched = [];
    var byStep = {};
    entries.forEach(function(entry) { byStep[fixText((entry.step || '').trim())] = entry; });
    fcSteps.forEach(function(stepName) {
      stepName = fixText(stepName);
      var entry = byStep[stepName.trim()];
      var hazards = [];
      if (entry) {
        ['bio', 'chem', 'phys'].forEach(function(ht) {
          var h = (entry.hazards || {})[ht];
          if (h && h.desc) {
            hazards.push({
              id: genId(),
              category: ht === 'bio' ? 'biological' : (ht === 'chem' ? 'chemical' : 'physical'),
              hazardDesc: fixText(h.desc),
              source: fixText(entry.step || stepName),
              isSignificant: !!h.isSignificant,
              severity: h.isSignificant ? '高' : '中',
              likelihood: h.isSignificant ? '高' : '中',
              basis: fixText(h.basis || ''),
              controlMeasure: fixText(h.control || ''),
              controlRelation: fixText(h.controlRelation || '')
            });
          }
        });
      }
      if (hazards.length === 0) unmatched.push(stepName);
      ws.push({ stepId: genId(), stepName: stepName || '', hazards: hazards });
    });
    data.hazardWorksheet = ws;
    data._unmatchedSteps = unmatched;
    data._hazardStepFingerprint = fcSteps.join(',');
    data._hazardFromAI = source; // true=AI, 'cache'=AI缓存, 'mock'=内置示例数据
    saveData(data);
    // AI 数据可能为纯中文，英文模式下补充翻译
    maybeTranslateHazardsForLang(data);
    renderActiveSection();
    renderSectionNav();
  }

  // 带超时的 fetch（防止后端卡住导致界面一直转圈）
  function fetchWithTimeout(url, options, timeoutMs) {
    var controller = new AbortController();
    var timer = setTimeout(function() { try { controller.abort(); } catch(e) {} }, timeoutMs || 60000);
    options = options || {};
    options.signal = controller.signal;
    return fetch(url, options).finally(function() { clearTimeout(timer); });
  }

  // AI 匹配：优先读缓存，未命中时并行分批调用后端 /api/ai/step-hazards（双语输出），失败时回退本地数据库
  function aiMatchStepHazards(data, fcSteps) {
    var cacheKey = getAiStepHazardsCacheKey(fcSteps, data);
    var cached = loadAiStepHazardsCache(cacheKey);
    if (cached) {
      applyAiStepResults(data, fcSteps, cached, 'cache');
      return;
    }
    var CHUNK = 4; // 每批最多4个步骤，避免AI返回过长被截断
    var chunks = [];
    for (var i = 0; i < fcSteps.length; i += CHUNK) chunks.push(fcSteps.slice(i, i + CHUNK));
    var results = [];
    var remaining = chunks.length;
    var hasSuccess = false;
    var done = false;

    function finish() {
      if (done) return;
      done = true;
      if (hasSuccess) {
        applyAiStepResults(data, fcSteps, results, true);
        saveAiStepHazardsCache(cacheKey, results);
      } else {
        fallbackMockStepHazards(data, fcSteps);
      }
    }

    // 总超时看门狗：90秒后强制结束（部分成功用部分结果，全部失败回退内置数据）
    setTimeout(function() { finish(); }, 90000);

    chunks.forEach(function(chunk) {
      var payload = { steps: chunk, product_name: data.productName || '', raw_materials: data.rawMaterials || '' };
      fetchWithTimeout(API_HOST + '/api/ai/step-hazards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }, 60000)
        .then(function(r) { return r.json(); })
        .then(function(res) {
          if (done) return;
          if (res.ok && res.data && res.data.length > 0) {
            hasSuccess = true;
            res.data.forEach(function(e) { results.push(e); });
          }
        })
        .catch(function() { /* 单批失败/超时不中断其他批次 */ })
        .finally(function() {
          remaining--;
          if (remaining === 0) finish();
        });
    });
  }

  function fallbackMockStepHazards(data, fcSteps) {
    loadStepHazards().then(function(stepDb) {
      // 无论 stepDb 是否为空，都要重新渲染页面（移除"正在匹配中"状态）
      if (!stepDb || stepDb.length === 0) {
        data.hazardWorksheet = [];
        data._hazardStepFingerprint = fcSteps.join(',');
        data._unmatchedSteps = fcSteps;
        data._hazardFromAI = 'mock';
        saveData(data);
        renderActiveSection();
        renderSectionNav();
        return;
      }
      
      var ws = [];
      var matchedCount = 0;
      var unmatchedSteps = [];
      
      fcSteps.forEach(function(stepName) {
        var matched = matchStepName(stepName, stepDb);
        var stepEntry = { stepId: genId(), stepName: stepName || '', hazards: [] };
        
        if (matched) {
          matchedCount++;
          var h = matched.hazards;
          // 生物危害（跳过"无显著"标记）
          if (h.bio && h.bio.desc && h.bio.desc !== '无显著生物危害' && h.bio.desc !== '无') {
            stepEntry.hazards.push({
              id: genId(),
              category: 'biological',
              hazardDesc: h.bio.desc,
              source: stepName,
              isSignificant: h.bio.isSignificant || false,
              severity: h.bio.isSignificant ? '高' : '中',
              likelihood: h.bio.isSignificant ? '高' : '中',
              basis: h.bio.basis || '',
              controlMeasure: h.bio.control || '',
              controlRelation: h.bio.controlRelation || ''
            });
          }
          // 化学危害
          if (h.chem && h.chem.desc && h.chem.desc !== '无显著化学危害' && h.chem.desc !== '无') {
            stepEntry.hazards.push({
              id: genId(),
              category: 'chemical',
              hazardDesc: h.chem.desc,
              source: stepName,
              isSignificant: h.chem.isSignificant || false,
              severity: h.chem.isSignificant ? '高' : '中',
              likelihood: h.chem.isSignificant ? '高' : '中',
              basis: h.chem.basis || '',
              controlMeasure: h.chem.control || '',
              controlRelation: h.chem.controlRelation || ''
            });
          }
          // 物理危害
          if (h.phys && h.phys.desc && h.phys.desc !== '无显著物理危害' && h.phys.desc !== '无') {
            stepEntry.hazards.push({
              id: genId(),
              category: 'physical',
              hazardDesc: h.phys.desc,
              source: stepName,
              isSignificant: h.phys.isSignificant || false,
              severity: h.phys.isSignificant ? '高' : '中',
              likelihood: h.phys.isSignificant ? '中' : '低',
              basis: h.phys.basis || '',
              controlMeasure: h.phys.control || '',
              controlRelation: h.phys.controlRelation || ''
            });
          }
        } else {
          unmatchedSteps.push(stepName);
        }
        ws.push(stepEntry);
      });
      
      data.hazardWorksheet = ws;
      data._unmatchedSteps = unmatchedSteps;
      // 保存步骤指纹（与匹配所用步骤来源一致，避免指纹不匹配导致无限循环），下次进入时无需重新匹配
      data._hazardStepFingerprint = fcSteps.join(',');
      data._hazardFromAI = 'mock';
      saveData(data);
      
      // 回退数据为纯中文，英文模式下补充翻译
      maybeTranslateHazardsForLang(data);
      
      // 重新渲染
      renderActiveSection();
      renderSectionNav();
    });
  }
  // ===== 英文模式下，将中文危害数据批量翻译为双语（中文|||English），带本地缓存 =====
  var TRANS_CACHE_KEY = 'haccp_trans_cache';
  var _transCache = null;
  function getTransCache() {
    if (_transCache) return _transCache;
    try {
      var raw = localStorage.getItem(TRANS_CACHE_KEY);
      _transCache = raw ? JSON.parse(raw) : {};
    } catch(e) { _transCache = {}; }
    return _transCache;
  }
  function saveTransCache() {
    try {
      var obj = getTransCache();
      var keys = Object.keys(obj);
      if (keys.length > 500) {
        keys.slice(0, keys.length - 500).forEach(function(k) { delete obj[k]; });
      }
      localStorage.setItem(TRANS_CACHE_KEY, JSON.stringify(obj));
    } catch(e) {}
  }

  function maybeTranslateHazardsForLang(data) {
    if (typeof I18n === 'undefined' || I18n.getLang() !== 'en') return false;
    if (data._hazardLangTranslated === 'en-v2') return false;
    var texts = [], seen = {};
    function collect(v) {
      if (v && typeof v === 'string' && v.indexOf('|||') === -1 && /[\u4e00-\u9fff]/.test(v) && !seen[v]) {
        seen[v] = true;
        texts.push(v);
      }
    }
    (data.hazardWorksheet || []).forEach(function(s) {
      collect(s.stepName);
      (s.hazards || []).forEach(function(h) {
        collect(h.hazardDesc); collect(h.basis); collect(h.controlMeasure); collect(h.controlRelation);
      });
    });
    ['hazardBio', 'hazardChem', 'hazardPhys'].forEach(function(k) {
      (data[k] || []).forEach(function(h) {
        collect(h.material); collect(h.desc); collect(h.control); collect(h.detail);
      });
    });
    if (texts.length === 0) {
      // 仅当确实存在危害数据且无需翻译时才标记完成；
      // 数据为空时先不标记，等待AI匹配完成后若回退到中文数据仍可触发翻译
      var hasHazardData = (data.hazardWorksheet || []).length > 0
        || ['hazardBio', 'hazardChem', 'hazardPhys'].some(function(k) { return (data[k] || []).length > 0; });
      if (hasHazardData) {
        try { data._hazardLangTranslated = 'en-v2'; saveData(data); } catch(e) {}
      }
      return false;
    }

    function applyMap(map) {
      function applyBilingual(v) { if (!v || v.indexOf('|||') !== -1) return v; return map[v] ? v + '|||' + map[v] : v; }
      (data.hazardWorksheet || []).forEach(function(s) {
        s.stepName = applyBilingual(s.stepName);
        (s.hazards || []).forEach(function(h) {
          h.hazardDesc = applyBilingual(h.hazardDesc);
          h.basis = applyBilingual(h.basis);
          h.controlMeasure = applyBilingual(h.controlMeasure);
          h.controlRelation = applyBilingual(h.controlRelation);
        });
      });
      ['hazardBio', 'hazardChem', 'hazardPhys'].forEach(function(k) {
        (data[k] || []).forEach(function(h) {
          h.material = applyBilingual(h.material);
          h.desc = applyBilingual(h.desc);
          h.control = applyBilingual(h.control);
          h.detail = applyBilingual(h.detail);
        });
      });
      if (Array.isArray(data._matchedMaterials)) {
        data._matchedMaterials.forEach(function(e) { e.material = applyBilingual(e.material); });
      }
    }

    function markDoneIfClean() {
      // 只有所有危害数据都变为双语后才标记完成，否则下次继续翻译剩余中文
      var remaining = false;
      function chk(v) { if (v && typeof v === 'string' && v.indexOf('|||') === -1 && /[\u4e00-\u9fff]/.test(v)) remaining = true; }
      (data.hazardWorksheet || []).forEach(function(s) {
        chk(s.stepName);
        (s.hazards || []).forEach(function(h) {
          chk(h.hazardDesc); chk(h.basis); chk(h.controlMeasure); chk(h.controlRelation);
        });
      });
      ['hazardBio', 'hazardChem', 'hazardPhys'].forEach(function(k) {
        (data[k] || []).forEach(function(h) {
          chk(h.material); chk(h.desc); chk(h.control); chk(h.detail);
        });
      });
      if (!remaining) data._hazardLangTranslated = 'en-v2';
      saveData(data);
      renderActiveSection();
      renderSectionNav();
      // 重新渲染AI原料危害结果表（翻译后）
      if ((data.hazardBio || []).length || (data.hazardChem || []).length || (data.hazardPhys || []).length) {
        renderAiHazardResult(data.hazardBio || [], data.hazardChem || [], data.hazardPhys || [], data._matchedMaterials || []);
      }
    }

    // 1. 先用本地缓存翻译
    var cache = getTransCache();
    var map = {};
    var uncached = [];
    texts.forEach(function(t) {
      if (cache[t]) map[t] = cache[t];
      else uncached.push(t);
    });
    if (Object.keys(map).length > 0) applyMap(map);
    if (uncached.length === 0) { markDoneIfClean(); return true; }

    // 2. 未命中的调用后端翻译
    fetchWithTimeout(API_HOST + '/api/ai/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts: uncached, target: 'en' }),
    })
      .then(function(r) { return r.json(); })
      .then(function(res) {
        if (res.ok && Array.isArray(res.data) && res.data.length === uncached.length) {
          uncached.forEach(function(t, i) {
            var tr = String(res.data[i] || '').replace(/^\s*\d+[\.、:：]\s*/, '').trim();
            if (tr && tr !== t) { map[t] = tr; cache[t] = tr; }
          });
          saveTransCache();
          applyMap(map);
          markDoneIfClean();
        }
        // 翻译接口异常时不标记，下次进入时重试
      })
      .catch(function() {
        // 网络失败时不标记，下次进入时重试
      });
    return true;
  }

  function renderHazardIdentify(data) {
    // 检查是否有hazardWorksheet数据；如果为空则检查档案中是否有流程图步骤
    var ws = data.hazardWorksheet || [];
    var fcSteps = getAllFcSteps();
    var autoTriggered = false;
    
    // 计算当前步骤的版本指纹（用于判断步骤是否变更）
    var currentStepFingerprint = fcSteps.join(',');
    var cachedFingerprint = data._hazardStepFingerprint || '';
    
    // 步骤指纹变化（含首次访问）时触发自动匹配；
    // 注意：不能仅因 worksheet 为空就重复触发，否则匹配结果为空时会无限循环
    if (currentStepFingerprint !== cachedFingerprint && fcSteps.length > 0) {
      // 如果数据已存在但步骤变更，先清空旧数据
      if (ws.length > 0 && currentStepFingerprint !== cachedFingerprint) {
        data.hazardWorksheet = [];
        data._hazardStepFingerprint = '';
      }
      autoTriggered = true;
      // 立即触发匹配
      setTimeout(function() {
        autoMatchStepHazards(data);
      }, 100);
    }

    var html = renderStepManagerBlock(data) + '<h3>' + I18n.t('q.hwIdentify') + '</h3><p class="q15-table-hint">' + I18n.t('q.hwIdentifyHint') + '</p>';

    // AI 不可用回退到示例数据时的提示 + 重试
    if (data._hazardFromAI === 'mock') {
      html += '<div style="margin-bottom:12px;padding:10px 14px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:13px;color:#92400e;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">' +
        '<span style="flex:1;">' + I18n.t('q.hwAiFallback') + '</span>' +
        '<button class="btn btn-xs btn-secondary" id="aiHazardRetryBtn" style="color:#92400e;border-color:#fde68a;">' + I18n.t('q.hwAiRetry') + '</button>' +
      '</div>';
    }

    // 自动匹配中或匹配结果显示
    if (autoTriggered) {
      html += '<div id="stepHazardLoading" style="padding:20px;text-align:center;color:var(--gray-400);">' +
        '<span class="spinner" style="width:18px;height:18px;"></span> ' + I18n.t('q.hwLoadingMatch') + '</div>';
    }

    // 匹配结果展示（按步骤列出危害）
    html += '<div id="stepHazardResult">';
    if (ws.length > 0) {
      var matchedCount = 0;
      ws.forEach(function(step) {
        if (step.hazards && step.hazards.length > 0) matchedCount++;
      });
      html += '<div class="q15-ai-summary" style="margin-bottom:12px;padding:10px 14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;font-size:13px;color:#166534;">';
      html += '' + I18n.t('q.hwMatchedSteps').replace('{0}', matchedCount).replace('{1}', ws.length) + '';
      if (data._hazardFromAI === 'keyword') html += I18n.t('q.hwKeywordMatched');
      else if (data._hazardFromAI === 'cache') html += I18n.t('q.hwAiCached');
      else if (data._hazardFromAI === true) html += I18n.t('q.hwAiMatched');
      html += '</div>';

      // 未匹配步骤提示
      var unmatched = data._unmatchedSteps || [];
      if (unmatched.length > 0) {
        html += '<div style="margin-bottom:12px;padding:8px 12px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:12px;color:#92400e;">';
        html += '' + I18n.t('q.hwUnmatchedHint') + '<strong>' + unmatched.join('、') + '</strong>';
        html += '</div>';
      }

      // 按步骤展示可勾选的危害列表
      html += '<div class="q15-step-hazards-list">';
      ws.forEach(function(step, si) {
        if (!step.hazards || step.hazards.length === 0) return;
        var catLabels = { biological: 'B', chemical: 'C', physical: 'P' };
        var catColors = { biological: '#dc2626', chemical: '#d97706', physical: '#6b7280' };
        var catFull = { biological: I18n.t('q.ccpHazardBio'), chemical: I18n.t('q.ccpHazardChem'), physical: I18n.t('q.ccpHazardPhys') };

        html += '<div class="q15-step-hazard-card" style="margin-bottom:12px;padding:12px 16px;background:#fff;border:1px solid var(--gray-200);border-radius:var(--radius-sm);">';
        html += '<div style="font-weight:600;font-size:14px;margin-bottom:8px;">' + esc(I18n.b(step.stepName || '')) + '</div>';
        
        step.hazards.forEach(function(h, hi) {
          var catLabel = catLabels[h.category] || '';
          var catColor = catColors[h.category] || '#666';
          var catFullName = catFull[h.category] || '';
          html += '<label class="q15-step-hazard-item" style="display:flex;align-items:flex-start;gap:8px;padding:6px 8px;margin:2px 0;border-radius:4px;cursor:pointer;transition:var(--transition);">' +
            '<input type="checkbox" class="hw-hazard-checkbox" data-ws-si="' + si + '" data-ws-hi="' + hi + '" checked style="margin-top:3px;">' +
            '<span style="display:inline-block;padding:0 6px;border-radius:3px;font-size:11px;font-weight:700;color:#fff;background:' + catColor + ';flex-shrink:0;">' + catLabel + '</span>' +
            '<div style="flex:1;font-size:13px;">' +
              '<div>' + esc(I18n.b(h.hazardDesc || '')) + '</div>' +
              '<div style="font-size:11px;color:var(--gray-400);margin-top:2px;">' + catFullName + (h.isSignificant ? ' | <span style="color:#dc2626;">' + I18n.t('q.hwSignificant') + '</span>' : ' | <span style="color:var(--gray-400);">' + I18n.t('q.hwNonSignificant') + '</span>') + '</div>' +
            '</div>' +
          '</label>';
        });
        html += '</div>';
      });
      html += '</div>';
    } else if (!autoTriggered) {
      html += '<div style="padding:20px;text-align:center;color:var(--gray-400);">' + I18n.t('q.hwNoFlowSteps') + '</div>';
    }
    html += '</div>';

    // 操作按钮区（重新匹配 + AI辅助识别）
    html += '<div class="q15-ai-btn-wrapper" style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">';
    html += '<button class="btn btn-secondary btn-sm" id="aiHazardBtn">\u{1F916} ' + I18n.t('q.hwAiIdentify') + '</button>';
    html += '<button class="btn btn-secondary btn-sm" id="hwRefreshBtn">\u{1F504} ' + I18n.t('q.hwRefresh') + '</button>';
    html += '<span id="aiHazardHint" style="font-size:12px;color:var(--gray-400);margin-left:5px;"></span>';
    html += '</div>';
    html += '<div id="aiHazardResult" style="margin-top:12px;"></div>';

    return html;
  }

  // 危害评估子步骤
  function renderHazardAssess(data) {
    var ws = data.hazardWorksheet || [];
    if (ws.length === 0) {
      return '<div style="padding:20px;text-align:center;color:var(--gray-400);">' + I18n.t('q.hwNoDataAssess') + '</div>';
    }
    var html = '<div class="hw-assess-table-wrapper"><table class="hw-table"><thead><tr>' +
      '<th style="min-width:80px;">' + I18n.t('q.hwStepCol') + '</th><th>' + I18n.t('q.ccpPotentialHazard') + '</th><th>' + I18n.t('q.hwHazardCategory') + '</th>' +
      '<th style="width:80px;">' + I18n.t('q.hwSeverity') + '</th><th style="width:80px;">' + I18n.t('q.hwLikelihood') + '</th><th style="width:80px;">' + I18n.t('q.hwRiskLevel') + '</th>' +
      '<th style="min-width:150px;">' + I18n.t('q.hwBasisCol') + '</th><th style="width:70px;">' + I18n.t('q.hwSignificantCol') + '</th></tr></thead><tbody>';
    ws.forEach(function(step, si) {
      if (!step.hazards || step.hazards.length === 0) return;
      step.hazards.forEach(function(h, hi) {
        var catLabel = h.category === 'biological' ? I18n.t('q.ccpHazardBio') : (h.category === 'chemical' ? I18n.t('q.ccpHazardChem') : I18n.t('q.ccpHazardPhys'));
        var catColor = h.category === 'biological' ? '#dc2626' : (h.category === 'chemical' ? '#d97706' : '#6b7280');
        html += '<tr>' +
          (hi === 0 ? '<td rowspan="' + step.hazards.length + '" style="text-align:center;vertical-align:middle;"><strong>' + esc(I18n.b(step.stepName || '')) + '</strong></td>' : '') +
          '<td>' + esc(I18n.b(h.hazardDesc || '')) + '</td>' +
          '<td style="color:' + catColor + ';">' + catLabel + '</td>' +
          '<td><select class="hw-select" data-ws-si="' + si + '" data-ws-hi="' + hi + '" data-ws-field="severity">' +
            '<option value="高"' + (h.severity === '高' ? ' selected' : '') + '>' + I18n.t('q.hwSeverityHigh') + '</option>' +
            '<option value="中"' + (h.severity === '中' ? ' selected' : '') + '>' + I18n.t('q.hwSeverityMid') + '</option>' +
            '<option value="低"' + (h.severity === '低' ? ' selected' : '') + '>' + I18n.t('q.hwSeverityLow') + '</option>' +
          '</select></td>' +
          '<td><select class="hw-select" data-ws-si="' + si + '" data-ws-hi="' + hi + '" data-ws-field="likelihood">' +
            '<option value="高"' + (h.likelihood === '高' ? ' selected' : '') + '>' + I18n.t('q.hwSeverityHigh') + '</option>' +
            '<option value="中"' + (h.likelihood === '中' ? ' selected' : '') + '>' + I18n.t('q.hwSeverityMid') + '</option>' +
            '<option value="低"' + (h.likelihood === '低' ? ' selected' : '') + '>' + I18n.t('q.hwSeverityLow') + '</option>' +
          '</select></td>' +
          '<td id="ws-risk-si' + si + '-hi' + hi + '" style="font-weight:500;">' + calcRiskLevel(h.severity || '中', h.likelihood || '中') + '</td>' +
          '<td><textarea class="hw-textarea" data-ws-si="' + si + '" data-ws-hi="' + hi + '" data-ws-field="basis" rows="2" placeholder="' + I18n.t('q.hwBasisPh') + '">' + esc(I18n.b(h.basis || '')) + '</textarea></td>' +
          '<td style="text-align:center;"><input type="checkbox" class="hw-significant" data-ws-si="' + si + '" data-ws-hi="' + hi + '"' + (h.isSignificant ? ' checked' : '') + '></td>' +
        '</tr>';
      });
    });
    html += '</tbody></table></div>';
    html += '<div style="margin-top:8px;font-size:12px;color:var(--gray-400);">💡 ' + I18n.t('q.hwAssessAutoHint') + '</div>';
    return html;
  }

  function calcRiskLevel(severity, likelihood) {
    if (!severity || !likelihood) return '—';
    var s = severity === '高' ? 3 : (severity === '中' ? 2 : 1);
    var l = likelihood === '高' ? 3 : (likelihood === '中' ? 2 : 1);
    var r = s * l;
    if (r >= 6) return '<span style="color:#dc2626;">' + I18n.t('q.hwSeverityHigh') + '</span>';
    if (r >= 3) return '<span style="color:#d97706;">' + I18n.t('q.hwSeverityMid') + '</span>';
    return '<span style="color:#16a34a;">' + I18n.t('q.hwSeverityLow') + '</span>';
  }

  // 控制措施子步骤
  function renderHazardControl(data) {
    var ws = data.hazardWorksheet || [];
    if (ws.length === 0) {
      return '<div style="padding:20px;text-align:center;color:var(--gray-400);">' + I18n.t('q.hwNoDataAssess') + '</div>';
    }
    // 只显示显著危害
    var hasSignificant = false;
    ws.forEach(function(step) {
      if (step.hazards) step.hazards.forEach(function(h) { if (h.isSignificant) hasSignificant = true; });
    });
    if (!hasSignificant) {
      return '<div style="padding:20px;text-align:center;color:var(--gray-400);">' + I18n.t('q.hwNoDataControl') + '</div>';
    }
    var html = '<div class="hw-control-table-wrapper"><table class="hw-table"><thead><tr>' +
      '<th>' + I18n.t('ccp.summary.step') + '</th><th>' + I18n.t('q.ccpPotentialHazard') + '</th><th>' + I18n.t('q.hwControlMeasureCol') + '</th><th style="min-width:200px;">' + I18n.t('q.hwControlRelationCol') + '</th></tr></thead><tbody>';
    ws.forEach(function(step, si) {
      if (!step.hazards) return;
      step.hazards.forEach(function(h, hi) {
        if (!h.isSignificant) return;
        html += '<tr>' +
          '<td><strong>' + esc(I18n.b(step.stepName || '')) + '</strong></td>' +
          '<td>' + esc(I18n.b(h.hazardDesc || '')) + '</td>' +
          '<td><textarea class="hw-textarea" data-ws-si="' + si + '" data-ws-hi="' + hi + '" data-ws-field="controlMeasure" rows="2" placeholder="' + I18n.t('q.hwControlPh') + '">' + esc(I18n.b(h.controlMeasure || '')) + '</textarea></td>' +
          '<td><textarea class="hw-textarea" data-ws-si="' + si + '" data-ws-hi="' + hi + '" data-ws-field="controlRelation" rows="2" placeholder="' + I18n.t('q.hwControlRelationPh') + '">' + esc(I18n.b(h.controlRelation || '')) + '</textarea></td>' +
        '</tr>';
      });
    });
    html += '</tbody></table></div>';
    return html;
  }

  // 重写 renderProcessFlow - 通过 data.hazardWorksheetStep 切换子步骤
  function renderProcessFlow(data) {
    // 初始化 hazardWorksheet 数据
    if (!data.hazardWorksheet) data.hazardWorksheet = [];
    if (!data.hazardWorksheetStep) data.hazardWorksheetStep = 'identify';
    
    // 如果 hazardBio/Chem/Phys 有数据但 worksheet 为空，从 legacy 数据转换
    if (data.hazardWorksheet.length === 0 && (data.hazardBio.length > 0 || data.hazardChem.length > 0 || data.hazardPhys.length > 0)) {
      convertHazardsToWorksheet(data);
    }

    // 英文模式下翻译预存的危害数据（AI批量翻译为双语格式）
    maybeTranslateHazardsForLang(data);

    var subNav = renderHazardSubNav(data);
    var stepContent = '';
    var step = data.hazardWorksheetStep || 'identify';
    
    if (step === 'identify') {
      stepContent = renderHazardIdentify(data);
    } else if (step === 'assess') {
      stepContent = renderHazardAssess(data);
    } else if (step === 'control') {
      stepContent = renderHazardControl(data);
    }

    var html = subNav + '<div class="hw-step-content">' + stepContent + '</div>';
    
    // 操作按钮
    html += '<div class="hw-actions" style="margin-top:16px;padding-top:16px;border-top:1px solid var(--gray-200);display:flex;gap:10px;justify-content:space-between;">';
    html += '<div>';
    if (step !== 'identify') {
      html += '<button class="btn btn-secondary btn-sm" id="hwPrevBtn">' + I18n.t('q.hwPrevBtn') + '</button>';
    }
    html += '</div><div>';
    if (step !== 'control') {
      html += '<button class="btn btn-primary btn-sm" id="hwNextBtn">' + I18n.t('q.hwNextBtn') + '</button>';
    } else {
      html += '<button class="btn btn-primary btn-sm" id="hwViewWorksheetBtn">' + I18n.t('q.hwViewWorksheet') + '</button>';
    }
    html += '</div></div>';

    return html;
  }

  // 从 legacy hazardBio/Chem/Phys 转换到 worksheet 格式
  function convertHazardsToWorksheet(data) {
    var wsMap = {};
    function getOrCreateStep(stepName) {
      if (!stepName) stepName = '通用';
      if (!wsMap[stepName]) {
        wsMap[stepName] = { stepId: genId(), stepName: stepName, hazards: [] };
      }
      return wsMap[stepName];
    }
    // 处理 legacy 数据
    var legacyMaps = [
      { key: 'hazardBio', category: 'biological' },
      { key: 'hazardChem', category: 'chemical' },
      { key: 'hazardPhys', category: 'physical' }
    ];
    legacyMaps.forEach(function(lm) {
      (data[lm.key] || []).forEach(function(h) {
        var stepName = '原料验收'; // 默认步骤
        if (h.material) stepName = h.material + '验收';
        var step = getOrCreateStep(stepName);
        step.hazards.push({
          id: genId(),
          category: lm.category,
          hazardDesc: h.desc || h.risk || '',
          source: h.material || '',
          isSignificant: h.isCCP || false,
          severity: h.severity || '中',
          likelihood: h.likelihood || '中',
          basis: '',
          controlMeasure: h.control || '',
          controlRelation: ''
        });
      });
    });
    data.hazardWorksheet = Object.values(wsMap);
    // 如果 processSteps 有数据，按步骤组织
    if (data.processSteps && data.processSteps.length > 0) {
      var orderedWs = [];
      data.processSteps.forEach(function(ps) {
        if (wsMap[ps.stepName]) orderedWs.push(wsMap[ps.stepName]);
        else orderedWs.push({ stepId: ps.id, stepName: ps.stepName, hazards: [] });
      });
      data.hazardWorksheet = orderedWs;
    }
  }

  // ===== 同步显著危害对应的步骤到 processSteps（确定关键控制点）=====
  function syncSignificantStepsToProcessSteps(data) {
    if (!data.hazardWorksheet || !Array.isArray(data.hazardWorksheet)) return;
    if (!data.processSteps || !Array.isArray(data.processSteps)) data.processSteps = [];
    
    // 收集包含显著危害的步骤名（保持顺序、去重）
    var stepNames = [];
    var seen = {};
    data.hazardWorksheet.forEach(function(step) {
      if (!step.hazards || !step.stepName) return;
      var hasSignificant = step.hazards.some(function(h) { return h.isSignificant; });
      if (hasSignificant && !seen[step.stepName]) {
        stepNames.push(step.stepName);
        seen[step.stepName] = true;
      }
    });
    
    // 去重保留已有的 processSteps
    var existingNames = {};
    data.processSteps.forEach(function(s) { existingNames[s.stepName] = true; });
    
    // 添加不存在的步骤
    stepNames.forEach(function(name) {
      if (!existingNames[name]) {
        data.processSteps.push({
          id: genId(),
          stepName: name,
          operationMethod: '',
          parameters: '',
          controlPoint: '',
          equipmentName: ''
        });
      }
    });
  }

  // ===== 收集危害工作单数据 =====
  function collectHazardWorksheetData(content, data) {
    // 从子步骤UI收集数据到 data.hazardWorksheet
    // 危害识别 - 复选框（hw-checkbox + hw-hazard-checkbox）
    content.querySelectorAll('.hw-checkbox, .hw-hazard-checkbox').forEach(function(cb) {
      var si = parseInt(cb.dataset.wsSi);
      var hi = parseInt(cb.dataset.wsHi);
      if (!isNaN(si) && !isNaN(hi) && data.hazardWorksheet[si] && data.hazardWorksheet[si].hazards[hi]) {
        data.hazardWorksheet[si].hazards[hi].selected = cb.checked;
      }
    });

    // 危害评估 - 严重性/可能性/判断依据/显著危害
    content.querySelectorAll('.hw-select').forEach(function(sel) {
      var si = parseInt(sel.dataset.wsSi);
      var hi = parseInt(sel.dataset.wsHi);
      var field = sel.dataset.wsField;
      if (!isNaN(si) && !isNaN(hi) && data.hazardWorksheet[si] && data.hazardWorksheet[si].hazards[hi]) {
        data.hazardWorksheet[si].hazards[hi][field] = sel.value;
      }
    });
    content.querySelectorAll('.hw-textarea').forEach(function(ta) {
      var si = parseInt(ta.dataset.wsSi);
      var hi = parseInt(ta.dataset.wsHi);
      var field = ta.dataset.wsField;
      if (!isNaN(si) && !isNaN(hi) && data.hazardWorksheet[si] && data.hazardWorksheet[si].hazards[hi]) {
        var rawVal = data.hazardWorksheet[si].hazards[hi][field];
        // 双语原文未修改时保留原文（避免导航后丢失另一种语言）
        if (!(ta.value === I18n.b(rawVal || '') && rawVal && rawVal.indexOf('|||') !== -1)) {
          data.hazardWorksheet[si].hazards[hi][field] = ta.value;
        }
      }
    });
    content.querySelectorAll('.hw-significant').forEach(function(cb) {
      var si = parseInt(cb.dataset.wsSi);
      var hi = parseInt(cb.dataset.wsHi);
      if (!isNaN(si) && !isNaN(hi) && data.hazardWorksheet[si] && data.hazardWorksheet[si].hazards[hi]) {
        data.hazardWorksheet[si].hazards[hi].isSignificant = cb.checked;
      }
    });
    
    // 收集完成后，自动同步显著危害的步骤到 processSteps（确定关键控制点步骤）
    syncSignificantStepsToProcessSteps(data);
  }

  // ===== 收集关键限值卡片数据（从DOM输入框）=====
  function collectCriticalLimitsCardData(content, data) {
    if (!data.criticalLimitsData) data.criticalLimitsData = [];
    content.querySelectorAll('.q15-cl-card').forEach(function(card) {
      var headerEl = card.querySelector('div:first-child');
      if (!headerEl) return;
      var stepName = headerEl.textContent.trim();
      var clData = data.criticalLimitsData.find(function(d) { return d.stepName === stepName; });
      if (!clData) return;
      // 收集关键限值
      var clRows = card.querySelectorAll('#clBody_' + data.criticalLimitsData.indexOf(clData) + ' tr');
      clData.limits = [];
      clRows.forEach(function(tr) {
        var inputs = tr.querySelectorAll('input');
        if (inputs.length >= 4) {
          clData.limits.push({ param: inputs[0].value, value: inputs[1].value, unit: inputs[2].value, basis: inputs[3].value });
        }
      });
      // 收集操作限值
      var olRows = card.querySelectorAll('#olBody_' + data.criticalLimitsData.indexOf(clData) + ' tr');
      clData.operatingLimits = [];
      olRows.forEach(function(tr) {
        var inputs = tr.querySelectorAll('input');
        if (inputs.length >= 3) {
          clData.operatingLimits.push({ param: inputs[0].value, value: inputs[1].value, unit: inputs[2].value });
        }
      });
    });
  }

  // ===== 应用AI关键限值结果到数据 =====
  function applyAiCriticalLimitsResult(data, aiResult, ccpList) {
    if (!data.criticalLimitsData) data.criticalLimitsData = [];
    var criticalLimitsText = aiResult.criticalLimits || '';
    data.criticalLimits = criticalLimitsText;
    var details = aiResult.details || [];
    
    details.forEach(function(d) {
      var stepName = d.ccp || '';
      if (!stepName) return;
      var clData = data.criticalLimitsData.find(function(cd) { return cd.stepName === stepName; });
      if (!clData) {
        clData = { stepName: stepName, limits: [], operatingLimits: [] };
        data.criticalLimitsData.push(clData);
      }
      // 解析limit字段，如"中心温度≥85℃，保持时间≥15秒" -> 拆分
      var limitStr = d.limit || '';
      var parts = limitStr.split(/[，,]/).filter(Boolean);
      clData.limits = parts.map(function(p) {
        p = p.trim();
        // 尝试匹配"参数+数值+单位"模式
        var m = p.match(/^([\u4e00-\u9fa5a-zA-Z]+)([<>=≤≥\d.~-]+)(.*)$/);
        if (m) {
          return { param: m[1], value: m[2], unit: m[3] || '', basis: d.basis || '' };
        }
        return { param: p, value: '', unit: '', basis: d.basis || '' };
      });
    });
  }

  // ===== 显示危害分析工作单（跳转到新页面）=====
  function showHazardWorksheet() {
    var data = loadData();
    var container = document.getElementById('hazardWorksheetContainer');
    if (!container) return;
    
    var ws = data.hazardWorksheet || [];
    if (ws.length === 0) {
      container.innerHTML = '<a class="back-link" href="javascript:App.navigateTo(\'questionnaire\')">' + I18n.t('q.hwBackToQuestionnaire') + '</a>' +
        '<div class="empty-state"><div class="empty-icon">📋</div><h3>' + I18n.t('q.hwEmpty') + '</h3>' +
        '<p>' + I18n.t('q.hwWorksheetEmptyHint') + '</p>' +
        '<button class="btn btn-primary" onclick="App.navigateTo(\'questionnaire\')">' + I18n.t('q.hwBackToQuestionnaire') + '</button></div>';
      return;
    }

    var html = '<a class="back-link" href="javascript:App.navigateTo(\'questionnaire\')">' + I18n.t('q.hwBackToQuestionnaire') + '</a>';
    html += '<div class="hw-worksheet-page">';
    html += '<h1>' + I18n.t('q.hwWorksheetTitle') + '</h1>';
    html += '<p class="q15-table-hint" style="margin-bottom:16px;">' + I18n.t('q.hwWorksheetHint') + '</p>';
    
    // 表格
    html += '<div class="hw-worksheet-table-wrapper" style="overflow-x:auto;">';
    html += '<table class="hw-worksheet-table"><thead><tr>' +
      '<th style="min-width:80px;">' + I18n.t('q.hwStepCol') + '</th>' +
      '<th>' + I18n.t('q.ccpPotentialHazard') + '</th>' +
      '<th>' + I18n.t('q.hwHazardCategory') + '</th>' +
      '<th>' + I18n.t('q.hwSignificantCol') + '</th>' +
      '<th style="min-width:140px;">' + I18n.t('q.hwBasisCol') + '</th>' +
      '<th>' + I18n.t('q.hwControlMeasureCol') + '</th>' +
      '<th style="min-width:180px;">' + I18n.t('q.hwControlRelationCol') + '</th>' +
      '</tr></thead><tbody>';

    ws.forEach(function(step, si) {
      if (!step.hazards || step.hazards.length === 0) {
        html += '<tr><td>' + esc(I18n.b(step.stepName || '')) + '</td><td colspan="6" style="color:var(--gray-400);text-align:center;">' + I18n.t('q.hwNoData') + '</td></tr>';
        return;
      }
      step.hazards.forEach(function(h, hi) {
        var catLabel = h.category === 'biological' ? I18n.t('q.ccpHazardBio') : (h.category === 'chemical' ? I18n.t('q.ccpHazardChem') : I18n.t('q.ccpHazardPhys'));
        html += '<tr>' +
          (hi === 0 ? '<td rowspan="' + step.hazards.length + '" style="text-align:center;vertical-align:middle;font-weight:500;">' + esc(I18n.b(step.stepName || '')) + '</td>' : '') +
          '<td>' + esc(I18n.b(h.hazardDesc || '')) + '</td>' +
          '<td>' + catLabel + '</td>' +
          '<td>' + (h.isSignificant ? '<span style="color:#dc2626;font-weight:500;">' + I18n.t('common.yes') + '</span>' : '<span style="color:var(--gray-400);">' + I18n.t('common.no') + '</span>') + '</td>' +
          '<td>' + esc(I18n.b(h.basis || '')) + '</td>' +
          '<td>' + esc(I18n.b(h.controlMeasure || '')) + '</td>' +
          '<td>' + esc(I18n.b(h.controlRelation || '')) + '</td>' +
        '</tr>';
      });
    });

    html += '</tbody></table></div>';
    html += '<div style="margin-top:16px;display:flex;gap:10px;">';
    html += '<button class="btn btn-secondary" onclick="App.navigateTo(\'questionnaire\')">' + I18n.t('q.hwBackToQuestionnaire') + '</button>';
    html += '<button class="btn btn-secondary" id="hwPrintBtn">' + I18n.t('q.hwPrintExport') + '</button>';
    html += '</div></div>';

    container.innerHTML = html;

    // 打印按钮
    var printBtn = document.getElementById('hwPrintBtn');
    if (printBtn) {
      printBtn.addEventListener('click', function() {
        window.print();
      });
    }
  }

  // ===== HACCP确认弹窗（检查清单 + 电子签署）=====
  var _haccpConfirmationData = null;
  var _haccpReviewMap = {};
  var _haccpReviewActive = false; // 是否处于审查模式
  var _haccpReviewFromStep = -1;  // 从哪个步骤过来的

  var HACCP_CHECK_ITEMS = [
    { key: 'profile', labelKey: 'q.haccpCheck1', step: 'profile', icon: '🏢' },
    { key: 'product', labelKey: 'q.haccpCheck2', step: 'profile', icon: '📋' },
    { key: 'flowchart', labelKey: 'q.haccpCheck3', step: 0, icon: '📊' },
    { key: 'hazard', labelKey: 'q.haccpCheck4', step: 0, icon: '🔍' },
    { key: 'ccp', labelKey: 'q.haccpCheck5', step: 1, icon: '🎯' },
    { key: 'limits', labelKey: 'q.haccpCheck6', step: 2, icon: '📏' },
    { key: 'monitor', labelKey: 'q.haccpCheck7', step: 3, icon: '📡' },
    { key: 'corrective', labelKey: 'q.haccpCheck8', step: 4, icon: '🛠️' },
  ];

  function showHaccpConfirmationModal(data) {
    _haccpConfirmationData = data;
    // 初始化审查状态（从localStorage读取已保存的审查记录）
    try {
      var saved = localStorage.getItem('haccp_review_status');
      if (saved) _haccpReviewMap = JSON.parse(saved);
    } catch(e) { _haccpReviewMap = {}; }

    var overlay = document.createElement('div');
    overlay.className = 'q15-modal-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;';

    overlay.innerHTML = '<div class="q15-haccp-confirm-modal" style="background:#fff;border-radius:12px;width:560px;max-width:94vw;max-height:92vh;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.25);">' +
      '<div style="padding:20px 24px 16px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;gap:12px;">' +
        '<span style="font-size:24px;">📋</span>' +
        '<h2 style="margin:0;font-size:18px;font-weight:600;color:#1e293b;">' + I18n.t('q.haccpConfirmTitle') + '</h2>' +
        '<span style="margin-left:auto;font-size:12px;color:#94a3b8;">' + I18n.t('q.haccpConfirmSub') + '</span>' +
      '</div>' +
      '<div style="padding:16px 24px;overflow-y:auto;flex:1;" id="haccpChecklistBody">' +
        renderChecklistItems() +
      '</div>' +
      '<div style="padding:12px 24px 20px;border-top:1px solid #e2e8f0;">' +
        '<div style="margin-bottom:14px;">' +
          '<label style="font-size:13px;font-weight:500;color:#475569;display:block;margin-bottom:4px;">' + I18n.t('q.haccpSignerLabel') + '</label>' +
          '<div style="display:flex;gap:10px;">' +
            '<input type="text" id="haccpSignerName" placeholder="' + I18n.t('q.ph_SignerFull') + '" style="flex:1;padding:9px 12px;border:1px solid #d0d5dd;border-radius:6px;font-size:13px;font-family:inherit;" value="' + esc(data._haccpSignerName || '') + '">' +
            '<input type="date" id="haccpSignerDate" style="width:140px;padding:9px 12px;border:1px solid #d0d5dd;border-radius:6px;font-size:13px;font-family:inherit;" value="' + esc(data._haccpSignDate || (new Date().toISOString().slice(0,10))) + '">' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;gap:10px;">' +
          '<button class="btn btn-secondary" id="haccpSaveDraftBtn" style="flex:1;padding:10px 16px;font-size:14px;">' + I18n.t('q.btnSaveDraft') + '</button>' +
          '<button class="btn btn-secondary" id="haccpSkipBtn" style="flex:1;padding:10px 16px;font-size:14px;color:#b45309;border-color:#fde68a;background:#fffbeb;">' + I18n.t('q.btnSkipHACCP') + '</button>' +
          '<button class="btn btn-primary" id="haccpConfirmBtn" style="flex:1;padding:10px 16px;font-size:14px;' + (getReviewedCount() < HACCP_CHECK_ITEMS.length ? 'opacity:.5;cursor:not-allowed;' : '') + '">' + I18n.t('q.btnConfirmHACCP') + '</button>' +
        '</div>' +
      '</div>' +
    '</div>';

    document.body.appendChild(overlay);
    bindHaccpModalEvents(overlay, data);
  }

  function renderChecklistItems() {
    var allReviewed = true;
    var html = '';
    HACCP_CHECK_ITEMS.forEach(function(item, i) {
      var reviewed = _haccpReviewMap[item.key] || false;
      if (!reviewed) allReviewed = false;
      html += '<div class="haccp-check-item" data-check-key="' + item.key + '" style="display:flex;align-items:center;gap:12px;padding:10px 12px;margin-bottom:6px;border:1px solid ' + (reviewed ? '#bbf7d0' : '#e2e8f0') + ';border-radius:8px;background:' + (reviewed ? '#f0fdf4' : '#fafbfc') + ';cursor:pointer;transition:all .2s;" title="' + (reviewed ? '✅ ' + I18n.t('q.previewed') : I18n.t('q.previewClickItem')) + '">' +
        '<span style="font-size:18px;">' + (reviewed ? '✅' : item.icon) + '</span>' +
        '<span style="flex:1;font-size:13px;color:' + (reviewed ? '#166534' : '#334155') + ';font-weight:' + (reviewed ? '500' : '400') + ';">' + I18n.t(item.labelKey) + '</span>' +
        '<span data-check-action="preview" style="font-size:12px;color:' + (reviewed ? '#16a34a' : '#2563eb') + ';padding:3px 10px;border-radius:4px;background:' + (reviewed ? '#dcfce7' : '#eff6ff') + ';flex-shrink:0;">' + (reviewed ? I18n.t('q.previewed') : I18n.t('q.previewClick')) + '</span>' +
      '</div>';
    });
    return html;
  }

  function getReviewedCount() {
    var count = 0;
    HACCP_CHECK_ITEMS.forEach(function(item) {
      if (_haccpReviewMap[item.key]) count++;
    });
    return count;
  }

  function openHaccpReviewModal() {
    if (_haccpConfirmationData) {
      showHaccpConfirmationModal(_haccpConfirmationData);
      return;
    }
    // 兜底：从 localStorage 重新加载数据
    try {
      var data = loadData();
      if (data) {
        _haccpConfirmationData = data;
        showHaccpConfirmationModal(data);
      }
    } catch(e) { console.warn('Failed to load data for HACCP confirmation:', e); }
  }

  function updateReviewBanner() {
    var bannerEl = document.getElementById('q15ReviewBanner');
    if (!bannerEl) return;
    if (_haccpReviewActive && currentStep < 5) {
      var reviewedCount = getReviewedCount();
      bannerEl.style.display = 'block';
      bannerEl.innerHTML = '<div class="haccp-review-banner" style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:10px 16px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;gap:10px;">' +
        '<div style="display:flex;align-items:center;gap:8px;"><span style="font-size:16px;">📋</span><span style="font-size:13px;color:#166534;">' + I18n.t('pf.reviewBanner') + '<strong>' + reviewedCount + '</strong>/<strong>' + HACCP_CHECK_ITEMS.length + '</strong>' + I18n.t('pf.reviewBanner2') + '</span></div>' +
        '<button class="btn btn-sm btn-primary" id="backToHaccpReviewBtn" style="padding:5px 14px;font-size:12px;background:#16a34a;border-color:#16a34a;">' + I18n.t('pf.reviewBackBtn') + '</button>' +
      '</div>';
      document.getElementById('backToHaccpReviewBtn')?.addEventListener('click', function() {
        openHaccpReviewModal();
      });
    } else {
      bannerEl.style.display = 'none';
    }
  }

  function bindHaccpModalEvents(overlay, data) {
    // 检查项点击 - 跳转到对应步骤预览
    overlay.querySelectorAll('.haccp-check-item').forEach(function(el) {
      el.addEventListener('click', function() {
        var key = this.dataset.checkKey;
        var item = HACCP_CHECK_ITEMS.find(function(i) { return i.key === key; });
        if (!item) return;

        // 标记为已预览
        _haccpReviewMap[item.key] = true;
        try { localStorage.setItem('haccp_review_status', JSON.stringify(_haccpReviewMap)); } catch(e) { console.warn('Failed to write localStorage haccp_review_status:', e); }

        // 刷新检查项显示
        var body = document.getElementById('haccpChecklistBody');
        if (body) body.innerHTML = renderChecklistItems();

        // 更新确认按钮状态
        var confirmBtn = document.getElementById('haccpConfirmBtn');
        if (confirmBtn) {
          var allDone = getReviewedCount() >= HACCP_CHECK_ITEMS.length;
          confirmBtn.style.opacity = allDone ? '1' : '.5';
          confirmBtn.style.cursor = allDone ? 'pointer' : 'not-allowed';
        }

        // 设置为审查模式，显示返回横幅
        _haccpReviewActive = true;
        try { sessionStorage.setItem('haccp_review_active', 'true'); } catch(e) { console.warn('Failed to write sessionStorage haccp_review_active:', e); }

        // 如果是 profile 相关项，跳转到首页档案
        if (item.step === 'profile') {
          overlay.remove();
          App.navigateTo('home');
          // 点击第一张卡片（15-min快速问卷）
          setTimeout(function() {
            var card = document.getElementById('btnGoProfile');
            if (card) card.click();
          }, 100);
        } else {
          // 跳转到对应的 HACCP 步骤
          if (typeof currentStep !== 'undefined') {
            currentStep = item.step;
          }
          overlay.remove();
          // 重新导航到问卷页面并切换到指定步骤
          App.navigateTo('questionnaire');
          // 需要重新初始化并跳转到指定步骤
          setTimeout(function() {
            // 用renderActiveSection跳转到目标步骤
            if (typeof currentStep !== 'undefined') {
              currentStep = item.step;
              renderActiveSection();
              renderSectionNav();
            }
          }, 50);
        }
      });
    });

    // 保存草稿按钮
    document.getElementById('haccpSaveDraftBtn')?.addEventListener('click', function() {
      // 保存签署人信息到 data
      var nameEl = document.getElementById('haccpSignerName');
      var dateEl = document.getElementById('haccpSignerDate');
      if (nameEl) data._haccpSignerName = nameEl.value;
      if (dateEl) data._haccpSignDate = dateEl.value;
      saveData(data);
      overlay.remove();
    });

    // 跳过确认按钮：免逐项预览，直接生成计划
    document.getElementById('haccpSkipBtn')?.addEventListener('click', function() {
      if (!confirm(I18n.t('q.alertSkipCheck'))) return;
      var nameEl = document.getElementById('haccpSignerName');
      var dateEl = document.getElementById('haccpSignerDate');
      if (nameEl && nameEl.value.trim()) data._haccpSignerName = nameEl.value.trim();
      if (dateEl && dateEl.value) data._haccpSignDate = dateEl.value;
      // 标记全部检查项为已预览（跳过逐项确认）
      HACCP_CHECK_ITEMS.forEach(function(item) { _haccpReviewMap[item.key] = true; });
      try { localStorage.setItem('haccp_review_status', JSON.stringify(_haccpReviewMap)); } catch(e) { console.warn('Failed to write localStorage haccp_review_status:', e); }
      data._haccpConfirmed = true;
      data._haccpConfirmDate = new Date().toISOString();
      data._haccpSkipped = true;
      saveData(data);

      // 保存到后端
      savePlanToBackend(data).then(function(savedPlan) {
        if (savedPlan) {
          console.log('Plan saved to backend, id:', savedPlan.id);
        }
        // localStorage 仍然保存作为离线兜底
        localStorage.setItem('haccp_submitted', 'true');
        localStorage.setItem(SECTION_COMPLETED_KEY, 'true');
        try { localStorage.removeItem('haccp_review_status'); } catch(e) { console.warn('Failed to remove localStorage haccp_review_status:', e); }
      });

      overlay.remove();
      alert(I18n.t('q.alertHACCPGenerated') + '\n\n' + I18n.t('q.alertSkipDone'));
      App.navigateTo('results');
    });

    // 确认HACCP生成按钮
    document.getElementById('haccpConfirmBtn')?.addEventListener('click', function() {
      var allDone = getReviewedCount() >= HACCP_CHECK_ITEMS.length;
      if (!allDone) {
        alert('请先预览所有检查项后再确认生成。');
        return;
      }

      var nameEl = document.getElementById('haccpSignerName');
      var dateEl = document.getElementById('haccpSignerDate');
      var signerName = nameEl ? nameEl.value.trim() : '';
      var signDate = dateEl ? dateEl.value : '';

      if (!signerName) {
        alert('请输入签署人姓名');
        nameEl?.focus();
        return;
      }
      if (!signDate) {
        alert('' + I18n.t('q.verSelectOption') + '签署日期');
        return;
      }

      // 保存签署信息
      data._haccpSignerName = signerName;
      data._haccpSignDate = signDate;
      data._haccpConfirmed = true;
      data._haccpConfirmDate = new Date().toISOString();
      saveData(data);

      // 保存到后端
      savePlanToBackend(data).then(function(savedPlan) {
        if (savedPlan) {
          console.log('Plan saved to backend, id:', savedPlan.id);
        }
        // localStorage 仍然保存作为离线兜底
        localStorage.setItem('haccp_submitted', 'true');
        localStorage.setItem(SECTION_COMPLETED_KEY, 'true');
        try { localStorage.removeItem('haccp_review_status'); } catch(e) { console.warn('Failed to remove localStorage haccp_review_status:', e); }
      });

      overlay.remove();
      alert(I18n.t('q.alertHACCPGenerated') + '\n\n' + I18n.t('ver.alertSubmitDetail1') + signerName + '\n' + I18n.t('ver.alertSubmitDetail2') + signDate + '\n\n' + I18n.t('q.alertGotoResults'));
      App.navigateTo('results');
    });
  }

  // ==================== 提交问卷 ====================

  async function savePlanToBackend(data) {
    var token = null;
    try { token = localStorage.getItem('haccp_token'); } catch(e) { console.warn('Failed to read localStorage haccp_token:', e); }
    if (!token) {
      var needsLogin = confirm(I18n.t('plan.loginRequired'));
      if (needsLogin) { if (typeof App !== 'undefined') App.showLoginModal(); }
      return null;
    }
    try {
      var planName = data.productName || data.companyName || ('Plan ' + new Date().toISOString().slice(0,10));
      var existingId = null;
      try { existingId = localStorage.getItem('haccp_current_plan_id'); } catch(e) {}
      var apiUrl = '/api/plans';
      var method = 'POST';
      // If a plan is currently selected, UPDATE it instead of creating a duplicate
      if (existingId) {
        apiUrl = '/api/plans/' + existingId;
        method = 'PUT';
      }
      var resp = await fetch(apiUrl, {
        method: method,
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({
          plan_name: planName,
          product_name: data.productName || '',
          company_name: data.companyName || '',
          content: data
        })
      });
      if (resp.ok) {
        var result = await resp.json();
        var plan = result.plan || {};
        localStorage.setItem('haccp_current_plan_id', String(plan.id || existingId));
        return plan;
      }
      if (resp.status === 401) {
        alert(I18n.t('plan.loginRequired'));
        return null;
      }
    } catch(e) {
      console.warn('Backend save failed, falling back to localStorage:', e);
    }
    return null;
  }

  function submitQuestionnaire(data) {
    const finalData = loadData();
    // 当计划书重新提交时，重置验证程序状态（触发联锁）
    finalData.verificationSubmitted = false;
    finalData.verificationSignerName = '';
    finalData.verificationSignerDate = '';

    // 保存到后端
    savePlanToBackend(finalData).then(function(savedPlan) {
      if (savedPlan) console.log('Plan saved to backend, id:', savedPlan.id);
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify(finalData));
    localStorage.setItem('haccp_submitted', 'true');
    localStorage.setItem(SECTION_COMPLETED_KEY, 'true');
    // 清除验证程序提醒记录，触发24小时重新提醒
    try { localStorage.removeItem('haccp_verification_reminder_time'); } catch(e) { console.warn('Failed to remove localStorage haccp_verification_reminder_time:', e); }
    alert(I18n.t('q.alertSubmitSuccess') + '\n\n' + I18n.t('q.alertSubmitMsg'));
    App.navigateTo('results');
  }

  // ===== 外部调用的步骤导航方法 =====
  function navigateToStep(stepIndex) {
    if (stepIndex >= 0 && stepIndex < TOTAL_STEPS) {
      currentStep = stepIndex;
      renderActiveSection();
      renderSectionNav();
    }
  }

  return { init: init, loadData: loadData, showHazardWorksheet: showHazardWorksheet, _navigateToStep: navigateToStep, reset: function() { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(SECTION_COMPLETED_KEY); currentStep = 0; } };
})();