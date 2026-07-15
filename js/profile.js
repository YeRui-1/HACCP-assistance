// 15-min快速问卷模块 - 分步导航式
const Profile = (() => {
  const STORAGE_KEY = 'haccp_profile_data';

  const DEPT_OPTIONS = [
    I18n.t('pf.dept.qc'),
    I18n.t('pf.dept.rd'),
    I18n.t('pf.dept.tech'),
    I18n.t('pf.dept.equip'),
    I18n.t('pf.dept.procure'),
    I18n.t('pf.dept.sales'),
    I18n.t('pf.dept.warehouse'),
    I18n.t('pf.dept.transport'),
    I18n.t('pf.dept.expert')
  ];

  const PD_FIELD_KEYS = ['pd_rawProps','pd_rawSupply','pd_rawUsage','pd_productProps','pd_productProcess','pd_productStorage','pd_productSales'];
  const IU_FIELD_KEYS = ['iu_consumerExpect','iu_intendedUse','iu_consumptionMethod','iu_targetCustomer','iu_vulnerableGroups','iu_unintendedUse'];

  function getProductDescFields() {
    return PD_FIELD_KEYS.map(function(k) {
      var short = k.replace('pd_', '');
      return { id: k, label: I18n.t('pf.pd.' + short), hint: I18n.t('pf.pd.' + short + 'Hint') };
    });
  }

  function getIntendedUseFields() {
    return IU_FIELD_KEYS.map(function(k) {
      var short = k.replace('iu_', '');
      return { id: k, label: I18n.t('pf.iu.' + short), hint: I18n.t('pf.iu.' + short + 'Hint') };
    });
  }

  function genId() { return 'f_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7); }
  function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&').replace(/"/g, '"').replace(/</g, '<').replace(/>/g, '>');
  }
  function xesc(s) { if (!s) return ''; return String(s).replace(/[&]/g, '&').replace(/[<]/g, '<').replace(/[>]/g, '>').replace(/["]/g, '"'); }

  function getDefaultData() {
    return {
      companyName: '',
      deptName: '',
      haccpTeam: [{ id: genId(), name: '', dept: '', role: '', authority: '', remark: '' }],
      auditor: '',
      extraItems: [],
      pd_rawProps: '',
      pd_rawSupply: '',
      pd_rawUsage: '',
      pd_productProps: '',
      pd_productProcess: '',
      pd_productStorage: '',
      pd_productSales: '',
      productExtraItems: [],
      iu_consumerExpect: '',
      iu_intendedUse: '',
      iu_consumptionMethod: '',
      iu_targetCustomer: '',
      iu_vulnerableGroups: '',
      iu_unintendedUse: '',
      iuExtraItems: [],
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
      flowchartConfirmDate: '',
      flowchartXml: '',
      flowchartSvg: '',
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
        return data;
      }
    } catch (e) { /* ignore */ }
    return getDefaultData();
  }

  function saveData(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { console.warn('Failed to write localStorage ' + STORAGE_KEY + ':', e); }
  }

  function syncToQuestionnaire(data) {
    try {
      var qRaw = localStorage.getItem('haccp_15min_data');
      var qData = qRaw ? JSON.parse(qRaw) : {};
      qData.companyName = data.companyName;
      qData.deptName = data.deptName;
      qData.auditor = data.auditor;
      qData.haccpTeam = data.haccpTeam;
      qData.extraItems = data.extraItems;
      getProductDescFields().forEach(function(f) { qData[f.id] = data[f.id]; });
      qData.productExtraItems = data.productExtraItems;
      getIntendedUseFields().forEach(function(f) { qData[f.id] = data[f.id]; });
      qData.iuExtraItems = data.iuExtraItems;
      qData.formula = data.formula;
      qData.processSteps = data.processSteps;
      qData.flowConfirmed = data.flowConfirmed;
      qData.flowchartXml = data.flowchartXml;
      localStorage.setItem('haccp_15min_data', JSON.stringify(qData));
    } catch (e) { console.warn('Failed to sync profile data to questionnaire localStorage:', e); }
  }

  let currentStep = 0;
  const TOTAL_STEPS = 5;
  const SECTION_NAMES = [I18n.t('pf.section1'), I18n.t('pf.section2'), I18n.t('pf.section3'), I18n.t('pf.section4'), I18n.t('pf.section5')];

  function init() {
    currentStep = 0;
    const container = document.getElementById('profileContainer');
    if (!container) return;
    const data = loadData();
    // 检测是否处于 HACCP 审查模式
    var reviewActive = false;
    var reviewedCount = 0;
    var totalItems = 8;
    try { reviewActive = sessionStorage.getItem('haccp_review_active') === 'true'; } catch(e) { console.warn('Failed to read sessionStorage haccp_review_active:', e); }
    try {
      var reviewMap = JSON.parse(localStorage.getItem('haccp_review_status') || '{}');
      reviewedCount = Object.keys(reviewMap).length;
    } catch(e) { console.warn('Failed to parse localStorage haccp_review_status:', e); }
    var reviewBanner = '';
    if (reviewActive) {
      reviewBanner = '<div class="haccp-review-banner" style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:10px 16px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;gap:10px;">' +
        '<div style="display:flex;align-items:center;gap:8px;"><span style="font-size:16px;">📋</span><span style="font-size:13px;color:#166534;">' + I18n.t('pf.reviewBanner') + '<strong>' + reviewedCount + '</strong>/<strong>' + totalItems + '</strong>' + I18n.t('pf.reviewBanner2') + '</span></div>' +
        '<button class="btn btn-sm btn-primary" id="backToHaccpReviewBtn" style="padding:5px 14px;font-size:12px;background:#16a34a;border-color:#16a34a;">' + I18n.t('pf.reviewBackBtn') + '</button>' +
      '</div>';
    }
    container.innerHTML = '' +
      reviewBanner +
      '<a class="back-link" href="javascript:App.navigateTo(\'home\')">← ' + I18n.t('nav.back') + '</a>' +
      '<div class="q15-header">' +
        '<h1>' + I18n.t('pf.pageTitle') + '</h1>' +
        '<p class="q15-desc">' + I18n.t('pf.pageDesc') + '</p>' +
        '<div class="q15-progress" id="profileProgress"></div>' +
      '</div>' +
      '<div id="profileContent"></div>';
    renderSectionNav();
    renderActiveSection();
    // 绑定审查模式返回按钮
    document.getElementById('backToHaccpReviewBtn')?.addEventListener('click', function() {
      // 跳回HACCP计划书 - 步骤5（纠偏措施）
      App.navigateTo('questionnaire');
      setTimeout(function() {
        if (typeof Questionnaire15min !== 'undefined') {
          // 尝试打开审查弹窗
          var data = Questionnaire15min.loadData();
          if (typeof showHaccpConfirmationModal !== 'undefined' && typeof _haccpConfirmationData === 'undefined') {
            // 通过模拟点击"生成计划"按钮来打开弹窗
            var genBtn = document.getElementById('q15GeneratePlanBtn');
            if (genBtn) genBtn.click();
            else {
              // 手动调用
              var qData = Questionnaire15min.loadData();
              qData._haccpSignerName = qData._haccpSignerName || '';
              qData._haccpSignDate = qData._haccpSignDate || '';
              // 导航到步骤5
              try { currentStep = 4; renderActiveSection(); renderSectionNav(); } catch(e) { console.warn('Failed to navigate to step 5 in profile review:', e); }
            }
          }
        }
      }, 200);
    });
  }

  function renderSectionNav() {
    const nav = document.getElementById('profileProgress');
    if (!nav) return;
    nav.innerHTML = SECTION_NAMES.map(function(name, i) {
      var isActive = i === currentStep;
      return '<div class="q15-step ' + (isActive ? 'active' : '') + '" data-step="' + i + '"><div class="q15-step-num">' + (i + 1) + '</div><span>' + name + '</span></div>';
    }).join('');
    nav.querySelectorAll('.q15-step').forEach(function(el) {
      el.addEventListener('click', function() {
        // 切换前捕获当前步骤的流程图
        if (currentStep === 3) {
          var data = loadData();
          captureFlowchartImage(data);
        }
        currentStep = parseInt(this.dataset.step);
        renderActiveSection();
        renderSectionNav();
      });
    });
  }

  function renderActiveSection() {
    const content = document.getElementById('profileContent');
    if (!content) return;
    const data = loadData();
    const sections = [renderHaccpTeam, renderProductDesc, renderIntendedUse, renderFlowchartMake, renderFlowchartConfirm];
    const sectionHTML = sections[currentStep](data);
    content.innerHTML = '' +
      '<div class="q15-section"><h2>' + SECTION_NAMES[currentStep] + '</h2>' + sectionHTML + '</div>' +
      '<div class="q15-nav-buttons">' +
        '<button class="btn btn-secondary" id="profilePrevBtn"' + (currentStep === 0 ? ' disabled' : '') + '>' + I18n.t('pf.prevBtn') + '</button>' +
        '<span class="q15-step-indicator">' + I18n.t('pf.stepIndicator') + (currentStep + 1) + I18n.t('pf.stepOf') + TOTAL_STEPS + I18n.t('pf.stepSuffix') + '</span>' +
        (currentStep < TOTAL_STEPS - 1
          ? '<button class="btn btn-primary" id="profileNextBtn">' + I18n.t('pf.nextBtn') + '</button>'
          : '<button class="btn btn-primary btn-lg" id="profileSaveBtn">' + I18n.t('pf.saveBtn') + '</button>') +
      '</div>';
    bindSectionEvents(content, data);
    document.getElementById('profilePrevBtn')?.addEventListener('click', function() {
      collectSectionData(content, data);
      saveData(data);
      if (currentStep > 0) { currentStep--; renderActiveSection(); renderSectionNav(); }
    });
    document.getElementById('profileNextBtn')?.addEventListener('click', function() {
      collectSectionData(content, data);
      maybeCaptureFlowchart(currentStep, data);
      saveData(data);
      if (currentStep < TOTAL_STEPS - 1) { currentStep++; renderActiveSection(); renderSectionNav(); }
    });
    var saveBtn = document.getElementById('profileSaveBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', function() {
        collectSectionData(content, data);
        maybeCaptureFlowchart(currentStep, data);
        saveData(data);
        syncToQuestionnaire(data);
        var btn = this;
        btn.textContent = I18n.t('pf.saved');
        btn.style.background = 'linear-gradient(135deg, #22c55e, #16a34a)';
        setTimeout(function() {
          btn.textContent = I18n.t('pf.saveBtn');
          btn.style.background = '';
        }, 2000);
      });
    }
    // 绑定流程图编辑器按钮（step 4）
    if (currentStep === 3) {
      var editorBtn = document.getElementById('pfOpenFlowchartEditorBtn');
      if (editorBtn) {
        editorBtn.addEventListener('click', function() {
          openFlowchartEditor();
        });
      }
    }
  }

  function collectSectionData(content, data) {
    const inputs = content.querySelectorAll('[data-pf-field]');
    inputs.forEach(function(el) {
      const field = el.dataset.pfField;
      if (el.type === 'checkbox') data[field] = el.checked;
      else data[field] = el.value;
    });
    var teamBody = content.querySelector('#pf-teamBody');
    if (teamBody) {
      data.haccpTeam = [];
      teamBody.querySelectorAll('tr').forEach(function(tr) {
        var nameEl = tr.querySelector('.pf-t-name');
        var deptEl = tr.querySelector('.pf-t-dept');
        var roleEl = tr.querySelector('.pf-t-role');
        var authEl = tr.querySelector('.pf-t-auth');
        var remarkEl = tr.querySelector('.pf-t-remark');
        data.haccpTeam.push({
          id: genId(),
          name: nameEl ? nameEl.value : '',
          dept: deptEl ? deptEl.value : '',
          role: roleEl ? roleEl.value : '',
          authority: authEl ? authEl.value : '',
          remark: remarkEl ? remarkEl.value : ''
        });
      });
    }
    var extraBody = content.querySelector('#pf-extraBody');
    if (extraBody) {
      data.extraItems = [];
      extraBody.querySelectorAll('.pf-extra-row').forEach(function(row) {
        var keyInput = row.querySelector('.pf-extra-key');
        var valInput = row.querySelector('.pf-extra-val');
        if (keyInput && valInput) {
          data.extraItems.push({ id: genId(), key: keyInput.value, value: valInput.value });
        }
      });
    }
    var peBody = content.querySelector('#pf-peBody');
    if (peBody) {
      data.productExtraItems = [];
      peBody.querySelectorAll('.pf-pe-row').forEach(function(row) {
        var keyInput = row.querySelector('.pf-pe-key');
        var valInput = row.querySelector('.pf-pe-val');
        if (keyInput && valInput) {
          data.productExtraItems.push({ id: genId(), key: keyInput.value, value: valInput.value });
        }
      });
    }
    var iuBody = content.querySelector('#pf-iuBody');
    if (iuBody) {
      data.iuExtraItems = [];
      iuBody.querySelectorAll('.pf-iu-row').forEach(function(row) {
        var keyInput = row.querySelector('.pf-iu-key');
        var valInput = row.querySelector('.pf-iu-val');
        if (keyInput && valInput) {
          data.iuExtraItems.push({ id: genId(), key: keyInput.value, value: valInput.value });
        }
      });
    }
    var formulaBody = content.querySelector('#pf-formulaBody');
    if (formulaBody) {
      data.formula = [];
      formulaBody.querySelectorAll('tr').forEach(function(tr) {
        var inputs = tr.querySelectorAll('input');
        if (inputs.length >= 3) {
          data.formula.push({ id: genId(), material: inputs[0].value, dosage: inputs[1].value, func: inputs[2].value });
        }
      });
    }
    data.processSteps = [];
    content.querySelectorAll('.pf-process-card').forEach(function(card) {
      var inputs = card.querySelectorAll('input, textarea');
      var step = { id: genId(), stepName: '', operationMethod: '', parameters: '', controlPoint: '', equipmentName: '' };
      inputs.forEach(function(el) {
        var field = el.dataset.psField;
        if (field) step[field] = el.value;
      });
      data.processSteps.push(step);
    });
  }

  // ===== 步骤1-3（保持不变）=====
  function renderHaccpTeam(data) {
    var teamRows = data.haccpTeam.map(function(m, i) {
      var deptOptionsHtml = '<option value="">' + I18n.t('pf.selectDept') + '</option>' + DEPT_OPTIONS.map(function(d) {
        var selected = m.dept === d ? ' selected' : '';
        return '<option value="' + esc(d) + '"' + selected + '>' + esc(d) + '</option>';
      }).join('');
      return '<tr data-team-idx="' + i + '">' +
        '<td><input type="text" class="pf-t-name" value="' + esc(m.name) + '" placeholder="' + I18n.t('pf.teamNamePh') + '"></td>' +
        '<td><select class="pf-t-dept" style="width:100%;padding:7px 10px;border:1px solid var(--gray-200);border-radius:5px;font-size:12px;font-family:inherit;background:#fff;">' + deptOptionsHtml + '</select></td>' +
        '<td><input type="text" class="pf-t-role" value="' + esc(m.role) + '" placeholder="' + I18n.t('pf.teamRolePh') + '"></td>' +
        '<td><input type="text" class="pf-t-auth" value="' + esc(m.authority) + '" placeholder="' + I18n.t('pf.teamAuthPh') + '"></td>' +
        '<td><input type="text" class="pf-t-remark" value="' + esc(m.remark) + '" placeholder="' + I18n.t('pf.teamRemarkPh') + '"></td>' +
        '<td><button class="q15-del-row pf-del-team" data-team-idx="' + i + '">&times;</button></td></tr>';
    }).join('');
    return '<div class="q15-field-group"><label>' + I18n.t('pf.companyName') + ' <span class="required">*</span></label><input type="text" data-pf-field="companyName" value="' + esc(data.companyName) + '" placeholder="' + I18n.t('pf.companyNamePh') + '"></div>' +
      '<div class="q15-field-group"><label>' + I18n.t('pf.deptName') + ' <span class="required">*</span></label><input type="text" data-pf-field="deptName" value="' + esc(data.deptName) + '" placeholder="' + I18n.t('pf.deptNamePh') + '"></div>' +
      '<div class="q15-field-group"><label>' + I18n.t('pf.auditor') + '</label><input type="text" data-pf-field="auditor" value="' + esc(data.auditor) + '" placeholder="' + I18n.t('pf.auditorPh') + '"></div>' +
      '<div class="q15-field-group" style="margin-bottom:24px;"><label>' + I18n.t('pf.extraItems') + '</label>' +
      '<div id="pf-extraBody" style="margin-bottom:8px;">' +
      (data.extraItems || []).map(function(e, i) {
        return '<div class="pf-extra-row" data-ex-idx="' + i + '" style="display:flex;gap:8px;align-items:center;margin-bottom:6px;"><input type="text" class="pf-extra-key" value="' + esc(e.key) + '" placeholder="' + I18n.t('pf.extraItemName') + '" style="flex:1;padding:7px 10px;border:1px solid var(--gray-200);border-radius:5px;font-size:12px;font-family:inherit;"><input type="text" class="pf-extra-val" value="' + esc(e.value) + '" placeholder="' + I18n.t('pf.extraItemContent') + '" style="flex:1;padding:7px 10px;border:1px solid var(--gray-200);border-radius:5px;font-size:12px;font-family:inherit;"><button class="q15-del-row pf-del-ex" data-ex-idx="' + i + '" style="flex-shrink:0;">&times;</button></div>';
      }).join('') +
      '</div><button class="btn btn-xs btn-secondary" id="pf-addExtra">' + I18n.t('pf.addItem') + '</button></div>' +
      '<div class="q15-table-section"><h3>' + I18n.t('pf.teamTitle') + ' <span class="required">*</span></h3><p class="q15-table-hint">' + I18n.t('pf.teamHint') + '</p>' +
      '<table class="q15-table" id="pf-teamTable"><thead><tr><th>' + I18n.t('pf.teamName') + '</th><th>' + I18n.t('pf.teamDept') + '</th><th>' + I18n.t('pf.teamRole') + '</th><th>' + I18n.t('pf.teamAuth') + '</th><th>' + I18n.t('pf.teamRemark') + '</th><th style="width:50px">' + I18n.t('pf.teamAction') + '</th></tr></thead><tbody id="pf-teamBody">' + teamRows + '</tbody></table>' +
      '<div style="display:flex;gap:10px;margin-top:8px;"><button class="btn btn-sm btn-secondary" id="pf-addTeam">' + I18n.t('pf.addMember') + '</button><button class="btn btn-sm btn-secondary" id="pf-downloadRecord">' + I18n.t('pf.downloadRecord') + '</button></div></div>';
  }

  function renderProductDesc(data) {
    var cardsHtml = getProductDescFields().map(function(f, i) {
      return '<div style="background:var(--gray-50);border:1px solid var(--gray-200);border-radius:10px;padding:16px 18px;margin-bottom:12px;">' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">' +
        '<span style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--primary-700));color:#fff;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + (i + 1) + '</span>' +
        '<label style="font-size:14px;font-weight:600;color:var(--gray-800);">' + esc(f.label) + '</label></div>' +
        '<p style="font-size:12px;color:var(--gray-400);margin-bottom:6px;">' + I18n.t('pf.hint') + esc(f.hint) + '</p>' +
        '<textarea data-pf-field="' + f.id + '" rows="3" style="width:100%;padding:10px 14px;border:1px solid var(--gray-200);border-radius:8px;font-size:13px;font-family:inherit;resize:vertical;background:#fff;transition:all 0.2s;" placeholder="' + I18n.t('pf.inputPh') + esc(f.label) + '">' + esc(data[f.id] || '') + '</textarea></div>';
    }).join('');
    var extraHtml = (data.productExtraItems || []).map(function(e, i) {
      return '<div class="pf-pe-row" data-pe-idx="' + i + '" style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">' +
        '<input type="text" class="pf-pe-key" value="' + esc(e.key) + '" placeholder="' + I18n.t('pf.extraItemName') + '" style="flex:1;padding:7px 10px;border:1px solid var(--gray-200);border-radius:5px;font-size:12px;font-family:inherit;">' +
        '<input type="text" class="pf-pe-val" value="' + esc(e.value) + '" placeholder="' + I18n.t('pf.extraItemContent') + '" style="flex:1;padding:7px 10px;border:1px solid var(--gray-200);border-radius:5px;font-size:12px;font-family:inherit;">' +
        '<button class="q15-del-row pf-del-pe" data-pe-idx="' + i + '" style="flex-shrink:0;">&times;</button></div>';
    }).join('');
    return '<div style="margin-bottom:20px;"><span style="font-size:15px;font-weight:600;color:var(--gray-700);">' + I18n.t('pf.productDescTitle') + '</span></div>' +
      cardsHtml +
      '<div style="background:var(--gray-50);border:1px solid var(--gray-200);border-radius:10px;padding:16px 18px;">' +
      '<h3 style="font-size:14px;font-weight:600;color:var(--gray-800);margin-bottom:8px;">' + I18n.t('pf.otherInfo') + '</h3>' +
      '<div id="pf-peBody">' + extraHtml + '</div>' +
      '<button class="btn btn-xs btn-secondary" id="pf-addPE" style="margin-top:4px;">' + I18n.t('pf.addItem') + '</button></div>' +
      '<div style="display:flex;gap:10px;margin-top:20px;justify-content:center;">' +
      '<button class="btn btn-primary" id="pf-saveProductDesc">' + I18n.t('pf.save') + '</button>' +
      '<button class="btn btn-secondary" id="pf-resetProductDesc">' + I18n.t('pf.reset') + '</button></div>';
  }

  function renderIntendedUse(data) {
    var cardsHtml = getIntendedUseFields().map(function(f, i) {
      return '<div style="background:var(--gray-50);border:1px solid var(--gray-200);border-radius:10px;padding:16px 18px;margin-bottom:12px;">' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">' +
        '<span style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--primary-700));color:#fff;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + (i + 1) + '</span>' +
        '<label style="font-size:14px;font-weight:600;color:var(--gray-800);">' + esc(f.label) + '</label></div>' +
        '<p style="font-size:12px;color:var(--gray-400);margin-bottom:6px;">' + I18n.t('pf.hint') + esc(f.hint) + '</p>' +
        '<textarea data-pf-field="' + f.id + '" rows="3" style="width:100%;padding:10px 14px;border:1px solid var(--gray-200);border-radius:8px;font-size:13px;font-family:inherit;resize:vertical;background:#fff;transition:all 0.2s;" placeholder="' + I18n.t('pf.inputPh') + esc(f.label) + '">' + esc(data[f.id] || '') + '</textarea></div>';
    }).join('');
    var extraHtml = (data.iuExtraItems || []).map(function(e, i) {
      return '<div class="pf-iu-row" data-iu-idx="' + i + '" style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">' +
        '<input type="text" class="pf-iu-key" value="' + esc(e.key) + '" placeholder="' + I18n.t('pf.extraItemName') + '" style="flex:1;padding:7px 10px;border:1px solid var(--gray-200);border-radius:5px;font-size:12px;font-family:inherit;">' +
        '<input type="text" class="pf-iu-val" value="' + esc(e.value) + '" placeholder="' + I18n.t('pf.extraItemContent') + '" style="flex:1;padding:7px 10px;border:1px solid var(--gray-200);border-radius:5px;font-size:12px;font-family:inherit;">' +
        '<button class="q15-del-row pf-del-iu" data-iu-idx="' + i + '" style="flex-shrink:0;">&times;</button></div>';
    }).join('');
    return '<div style="margin-bottom:20px;"><span style="font-size:15px;font-weight:600;color:var(--gray-700);">' + I18n.t('pf.intendedUseTitle') + '</span></div>' +
      cardsHtml +
      '<div style="background:var(--gray-50);border:1px solid var(--gray-200);border-radius:10px;padding:16px 18px;">' +
      '<h3 style="font-size:14px;font-weight:600;color:var(--gray-800);margin-bottom:8px;">' + I18n.t('pf.otherInfo') + '</h3>' +
      '<div id="pf-iuBody">' + extraHtml + '</div>' +
      '<button class="btn btn-xs btn-secondary" id="pf-addIU" style="margin-top:4px;">' + I18n.t('pf.addItem') + '</button></div>' +
      '<div style="display:flex;gap:10px;margin-top:20px;justify-content:center;">' +
      '<button class="btn btn-primary" id="pf-saveIntendedUse">' + I18n.t('pf.save') + '</button>' +
      '<button class="btn btn-secondary" id="pf-resetIntendedUse">' + I18n.t('pf.reset') + '</button></div>';
  }

  // ===== 流程图预览（在步骤4和步骤5中使用）=====
  function renderFlowchartPreview(data) {
    if (data.flowchartSvg) {
      return '<div class="q15-flowchart-preview" style="text-align:center;">' +
        '<img src="' + esc(data.flowchartSvg) + '" style="max-width:100%;max-height:600px;border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.08);">' +
        '<p style="font-size:12px;color:var(--gray-400);margin-top:8px;">' + I18n.t('pf.flowSaved') + '</p></div>';
    }
    return '<div class="q15-flowchart-empty"><div class="q15-flowchart-empty-icon">📊</div><p>' + I18n.t('pf.flowEmpty') + '</p><p style="font-size:12px;color:var(--gray-400);margin-top:8px;">' + I18n.t('pf.flowEmptyHint') + '</p></div>';
  }

  // ===== 从 localStorage 同步流程图数据 =====
  function syncStepsFromFlowchart(data) {
    var steps = [];
    var ccp = [];
    var svg = '';
    try {
      var stepsRaw = localStorage.getItem('haccp_fc_steps');
      if (stepsRaw) steps = JSON.parse(stepsRaw);
      var ccpRaw = localStorage.getItem('haccp_fc_ccp');
      if (ccpRaw) ccp = JSON.parse(ccpRaw);
      svg = localStorage.getItem('haccp_drawio_svg') || '';
    } catch(e) { console.warn('Failed to read flow chart data from localStorage:', e); }

    if (steps && steps.length > 0) {
      // 更新 fcEditor
      if (!data.fcEditor) data.fcEditor = {};
      data.fcEditor.steps = steps;
      data.fcEditor.ccp = ccp;

      // 同步到 processSteps（仅步骤名称，其他字段留空）
      data.processSteps = steps.map(function(name, i) {
        return {
          id: genId(),
          stepName: name,
          operationMethod: '',
          parameters: '',
          controlPoint: (ccp[i] === 1) ? 'CCP' : '',
          equipmentName: ''
        };
      });

      data.flowchartSvg = svg;
      saveData(data);
      syncToQuestionnaire(data);
    }
  }

  // ===== 打开流程图编辑器（iframe 模态框）=====
  function openFlowchartEditor() {
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.6);z-index:10000;display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = '' +
      '<div style="background:#fff;border-radius:10px;width:95vw;height:95vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.4);">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 20px;background:#1e293b;color:#fff;border-radius:10px 10px 0 0;flex-shrink:0;">' +
          '<span style="font-size:15px;font-weight:600;">📊 流程图模板编辑器</span>' +
          '<div style="display:flex;align-items:center;gap:10px;">' +
            '<span id="pfFcEditorStatus" style="font-size:12px;color:#94a3b8;"></span>' +
            '<button id="pfFcSaveBackBtn" style="background:#2563eb;color:#fff;border:none;border-radius:6px;padding:6px 16px;cursor:pointer;font-size:13px;">' + I18n.t('pf.flowSaveBack') + '</button>' +
            '<button id="pfFcCloseBtn" style="background:rgba(255,255,255,.15);color:#fff;border:none;border-radius:6px;padding:6px 14px;cursor:pointer;font-size:13px;">' + I18n.t('pf.flowBack') + '</button>' +
          '</div>' +
        '</div>' +
        '<div style="flex:1;position:relative;background:#f1f5f9;">' +
          '<iframe id="pfFcIframe" style="width:100%;height:100%;border:none;display:block;" allowfullscreen></iframe>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    var iframe = document.getElementById('pfFcIframe');
    iframe.src = 'flowchart-preview.html';

    function closeEditor(doSync) {
      if (doSync !== false) {
        var statusEl = document.getElementById('pfFcEditorStatus');
        if (statusEl) statusEl.textContent = I18n.t('pf.flowSyncing');
        var data = loadData();
        syncStepsFromFlowchart(data);
      }
      overlay.remove();
      // 刷新步骤4页面以显示预览
      if (currentStep === 3) {
        renderActiveSection();
        renderSectionNav();
      }
    }

    document.getElementById('pfFcSaveBackBtn').addEventListener('click', function() {
      // 先尝试通过 iframe 触发保存
      try {
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage(JSON.stringify({ action: 'save' }), '*');
        }
      } catch(e) { console.warn('Failed to send postMessage to draw.io iframe:', e); }
      // 延时等待保存完成，然后关闭并同步
      setTimeout(function() {
        closeEditor(true);
      }, 500);
    });

    document.getElementById('pfFcCloseBtn').addEventListener('click', function() {
      closeEditor(true);
    });

    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) closeEditor(true);
    });
  }

  // ===== Step 4: 流程图的制定（简化版 - iframe 嵌入式流程图编辑器）=====
  function renderFlowchartMake(data) {
    return '' +
      '<h3>📋 流程图模板编辑</h3>' +
      '<p class="q15-table-hint">' + I18n.t('pf.flowEditorHint') + '</p>' +
      '<div style="text-align:center;margin:20px 0;">' +
        '<button class="btn btn-primary" id="pfOpenFlowchartEditorBtn" style="font-size:15px;padding:12px 28px;">' +
          I18n.t('pf.openFlowEditor') +
        '</button>' +
      '</div>' +
      '<div id="pfFlowchartPreviewArea">' +
        renderFlowchartPreview(data) +
      '</div>';
  }

  // ===== 步骤5：流程图的确认（显示SVG预览 + 确认框）=====
  function renderFlowchartConfirm(data) {
    var previewHtml = data.flowchartSvg
      ? '<div style="text-align:center;"><img src="' + esc(data.flowchartSvg) + '" style="max-width:100%;max-height:500px;border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.08);margin-top:12px;"><p style="font-size:12px;color:var(--gray-400);margin-top:8px;">' + I18n.t('pf.flowSaved') + '</p></div>'
      : '<div class="q15-flowchart-empty"><div class="q15-flowchart-empty-icon">🗺️</div><p>' + I18n.t('pf.flowNoData') + '</p></div>';
    return '<div class="q15-confirm-box"><label class="q15-checkbox-label"><input type="checkbox" data-pf-field="flowConfirmed"' + (data.flowConfirmed ? ' checked' : '') + '> ' + I18n.t('pf.flowConfirmLabel') + '</label><p style="font-size:12px;color:var(--gray-400);margin-top:6px;">' + I18n.t('pf.flowConfirmNote') + '</p>' +
      '<div class="q15-field-group" style="margin-top:16px;"><label>' + I18n.t('pf.flowConfirmTime') + ' <span class="required">*</span></label><input type="date" data-pf-field="flowchartConfirmDate" value="' + esc(data.flowchartConfirmDate || '') + '"></div></div>' +
      '<div class="q15-flowchart-area" style="margin-top:24px;"><h3>' + I18n.t('pf.flowPreview') + '</h3>' + previewHtml + '</div>';
  }

  // ===== 捕获流程图SVG为图片 =====
  function captureFlowchartImage(data) {
    var svg = document.getElementById('pfFcSvg');
    if (!svg) return;
    // 克隆SVG避免修改原始DOM
    var clone = svg.cloneNode(true);
    // 设置白色背景
    var bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('width', '100%');
    bg.setAttribute('height', '100%');
    bg.setAttribute('fill', '#ffffff');
    clone.insertBefore(bg, clone.firstChild);
    var svgStr = new XMLSerializer().serializeToString(clone);
    var dataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgStr)));
    data.flowchartSvg = dataUrl;
    saveData(data);
  }

  function maybeCaptureFlowchart(currentStep, data) {
    // 离开步骤4（流程图制定）时捕获SVG为图片
    if (currentStep === 3) {
      captureFlowchartImage(data);
    }
  }

  // ===== 事件绑定（扩展 - 仅保留增量事件）=====
  function bindSectionEvents(content, data) {
    document.getElementById('pf-addTeam')?.addEventListener('click', function() {
      data = collectAndReload();
      data.haccpTeam.push({ id: genId(), name: '', dept: '', role: '', authority: '', remark: '' });
      saveRenderNav(data);
    });
    content.querySelectorAll('#pf-teamBody .pf-del-team').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var idx = parseInt(this.dataset.teamIdx);
        data = collectAndReload();
        if (data.haccpTeam.length > 1) { data.haccpTeam.splice(idx, 1); saveRenderNav(data); }
      });
    });
    content.querySelectorAll('#pf-teamBody input, #pf-teamBody select').forEach(function(el) {
      el.addEventListener('change', function() { var c = document.getElementById('profileContent'); if (c) { collectSectionData(c, data); saveData(data); } });
      el.addEventListener('input', function() { var c = document.getElementById('profileContent'); if (c) { collectSectionData(c, data); saveData(data); } });
    });
    document.getElementById('pf-addExtra')?.addEventListener('click', function() {
      data = collectAndReload();
      data.extraItems.push({ id: genId(), key: '', value: '' });
      saveRenderNav(data);
    });
    content.querySelectorAll('#pf-extraBody .pf-del-ex').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var idx = parseInt(this.dataset.exIdx);
        data = collectAndReload();
        if (data.extraItems.length > 0) { data.extraItems.splice(idx, 1); saveRenderNav(data); }
      });
    });
    document.getElementById('pf-saveProductDesc')?.addEventListener('click', function() {
      collectSectionData(content, data);
      saveData(data);
      this.textContent = I18n.t('pf.savedOk');
      setTimeout(function() { if (document.getElementById('pf-saveProductDesc')) document.getElementById('pf-saveProductDesc').textContent = I18n.t('pf.save'); }, 1500);
    });
    document.getElementById('pf-resetProductDesc')?.addEventListener('click', function() {
      if (!confirm(I18n.t('pf.confirmReset'))) return;
      getProductDescFields().forEach(function(f) { data[f.id] = ''; });
      data.productExtraItems = [];
      saveData(data);
      renderActiveSection();
      renderSectionNav();
    });
    document.getElementById('pf-addPE')?.addEventListener('click', function() {
      data = collectAndReload();
      data.productExtraItems.push({ id: genId(), key: '', value: '' });
      saveRenderNav(data);
    });
    content.querySelectorAll('#pf-peBody .pf-del-pe').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var idx = parseInt(this.dataset.peIdx);
        data = collectAndReload();
        if (data.productExtraItems.length > 0) { data.productExtraItems.splice(idx, 1); saveRenderNav(data); }
      });
    });
    document.getElementById('pf-saveIntendedUse')?.addEventListener('click', function() {
      collectSectionData(content, data);
      saveData(data);
      this.textContent = I18n.t('pf.savedOk');
      setTimeout(function() { if (document.getElementById('pf-saveIntendedUse')) document.getElementById('pf-saveIntendedUse').textContent = I18n.t('pf.save'); }, 1500);
    });
    document.getElementById('pf-resetIntendedUse')?.addEventListener('click', function() {
      if (!confirm(I18n.t('pf.confirmResetIU'))) return;
      getIntendedUseFields().forEach(function(f) { data[f.id] = ''; });
      data.iuExtraItems = [];
      saveData(data);
      renderActiveSection();
      renderSectionNav();
    });
    document.getElementById('pf-addIU')?.addEventListener('click', function() {
      data = collectAndReload();
      data.iuExtraItems.push({ id: genId(), key: '', value: '' });
      saveRenderNav(data);
    });
    content.querySelectorAll('#pf-iuBody .pf-del-iu').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var idx = parseInt(this.dataset.iuIdx);
        data = collectAndReload();
        if (data.iuExtraItems.length > 0) { data.iuExtraItems.splice(idx, 1); saveRenderNav(data); }
      });
    });
    document.getElementById('pf-addFormula')?.addEventListener('click', function() {
      data = collectAndReload();
      data.formula.push({ id: genId(), material: '', dosage: '', func: '' });
      saveRenderNav(data);
    });
    content.querySelectorAll('#pf-formulaBody .pf-del-fm').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var idx = parseInt(this.dataset.fmIdx);
        data = collectAndReload();
        if (data.formula.length > 1) { data.formula.splice(idx, 1); saveRenderNav(data); }
      });
    });
    content.querySelectorAll('input[data-pf-field], textarea[data-pf-field], select[data-pf-field]').forEach(function(el) {
      el.addEventListener('input', function() { var c = document.getElementById('profileContent'); if (c) { collectSectionData(c, data); saveData(data); } });
    });
  }

  function collectAndReload() {
    var content = document.getElementById('profileContent');
    var data = loadData();
    if (content) collectSectionData(content, data);
    return data;
  }

  function saveRenderNav(data) {
    saveData(data);
    renderActiveSection();
    renderSectionNav();
  }

  return { init: init, loadData: loadData };
})();