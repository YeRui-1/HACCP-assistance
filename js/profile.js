// 创建档案模块 - 分步导航式（仿照15分钟问卷样式）
const Profile = (() => {
  const STORAGE_KEY = 'haccp_profile_data';

  const DEPT_OPTIONS = [
    '卫生质量控制',
    '产品研发',
    '生产工艺技术',
    '设备设施管理',
    '原辅料采购',
    '销售',
    '仓储',
    '运输',
    '外部专家'
  ];

  const PRODUCT_DESC_FIELDS = [
    { id: 'pd_rawProps', label: '原辅料、食品包装材料的名称、类别、成分及其生物、化学和物理特性', hint: '名称 / 类别 / 成分 / 理化生物特性' },
    { id: 'pd_rawSupply', label: '原辅料、食品包装材料的来源，以及生产、包装、储藏、运输和交付方式', hint: '来源 / 生产 / 包装 / 储藏 / 运输 / 交付方式' },
    { id: 'pd_rawUsage', label: '原辅料、食品包装材料接收要求、接收方式和使用方式', hint: '接收要求 / 接收方式 / 使用方式' },
    { id: 'pd_productProps', label: '产品的名称、类别、成分及其生物、化学、物理特性', hint: '产品名称 / 类别 / 成分 / 理化生物特性' },
    { id: 'pd_productProcess', label: '产品的加工方式', hint: '完整加工方式描述' },
    { id: 'pd_productStorage', label: '产品的包装、储藏、运输和交付方式', hint: '包装 / 储藏 / 运输 / 交付方式' },
    { id: 'pd_productSales', label: '产品的销售方式和标识', hint: '销售方式 / 产品标签标识' }
  ];

  const INTENDED_USE_FIELDS = [
    { id: 'iu_consumerExpect', label: '顾客对产品的消费或使用期望', hint: '顾客期望 / 消费场景' },
    { id: 'iu_intendedUse', label: '产品的预期用途和储藏条件，以及保质期', hint: '预期用途 / 储藏条件 / 保质期' },
    { id: 'iu_consumptionMethod', label: '产品预期的食用或使用方式', hint: '食用方式 / 使用方法' },
    { id: 'iu_targetCustomer', label: '产品预期的顾客对象', hint: '目标顾客 / 消费群体' },
    { id: 'iu_vulnerableGroups', label: '直接消费产品对易受伤害群体的适用性', hint: '儿童 / 老人 / 孕妇 / 过敏人群等' },
    { id: 'iu_unintendedUse', label: '产品非预期(但极可能出现)的食用或使用方式', hint: '可能的误用 / 非预期使用方式' }
  ];

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
      // 产品描述 - 7项固定字段
      pd_rawProps: '',
      pd_rawSupply: '',
      pd_rawUsage: '',
      pd_productProps: '',
      pd_productProcess: '',
      pd_productStorage: '',
      pd_productSales: '',
      productExtraItems: [],
      // 预期用途 - 6项固定字段
      iu_consumerExpect: '',
      iu_intendedUse: '',
      iu_consumptionMethod: '',
      iu_targetCustomer: '',
      iu_vulnerableGroups: '',
      iu_unintendedUse: '',
      iuExtraItems: [],
      // 旧字段兼容
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
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
  }

  // 同步数据到15分钟问卷
  function syncToQuestionnaire(data) {
    try {
      var qRaw = localStorage.getItem('haccp_15min_data');
      var qData = qRaw ? JSON.parse(qRaw) : {};
      qData.companyName = data.companyName;
      qData.deptName = data.deptName;
      qData.auditor = data.auditor;
      qData.haccpTeam = data.haccpTeam;
      qData.extraItems = data.extraItems;
      PRODUCT_DESC_FIELDS.forEach(function(f) { qData[f.id] = data[f.id]; });
      qData.productExtraItems = data.productExtraItems;
      INTENDED_USE_FIELDS.forEach(function(f) { qData[f.id] = data[f.id]; });
      qData.iuExtraItems = data.iuExtraItems;
      qData.formula = data.formula;
      qData.processSteps = data.processSteps;
      qData.flowConfirmed = data.flowConfirmed;
      qData.flowchartXml = data.flowchartXml;
      localStorage.setItem('haccp_15min_data', JSON.stringify(qData));
    } catch (e) {}
  }

  // ===== 分步导航 =====
  let currentStep = 0;
  const TOTAL_STEPS = 5;
  const SECTION_NAMES = ['HACCP小组的组成', '产品描述', '预期用途的确定', '流程图的制定', '流程图的确认'];

  function init() {
    currentStep = 0;
    const container = document.getElementById('profileContainer');
    if (!container) return;
    const data = loadData();
    container.innerHTML = `
      <a class="back-link" href="javascript:App.navigateTo('home')">← 返回首页</a>
      <div class="q15-header">
        <h1>创建档案</h1>
        <p class="q15-desc">请按照实际情况填写以下信息，完成后数据将自动同步到问卷</p>
        <div class="q15-progress" id="profileProgress"></div>
      </div>
      <div id="profileContent"></div>
    `;
    renderSectionNav();
    renderActiveSection();
  }

  function renderSectionNav() {
    const nav = document.getElementById('profileProgress');
    if (!nav) return;
    nav.innerHTML = SECTION_NAMES.map((name, i) => {
      const isActive = i === currentStep;
      return `<div class="q15-step ${isActive ? 'active' : ''}" data-step="${i}">
        <div class="q15-step-num">${i + 1}</div>
        <span>${name}</span>
      </div>`;
    }).join('');
    nav.querySelectorAll('.q15-step').forEach(el => {
      el.addEventListener('click', () => {
        currentStep = parseInt(el.dataset.step);
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
    content.innerHTML = `
      <div class="q15-section">
        <h2>${SECTION_NAMES[currentStep]}</h2>
        ${sectionHTML}
      </div>
      <div class="q15-nav-buttons">
        <button class="btn btn-secondary" id="profilePrevBtn"${currentStep === 0 ? ' disabled' : ''}>← 上一步</button>
        <span class="q15-step-indicator">第 ${currentStep + 1} / ${TOTAL_STEPS} 步</span>
        ${currentStep < TOTAL_STEPS - 1
          ? '<button class="btn btn-primary" id="profileNextBtn">下一步 →</button>'
          : '<button class="btn btn-primary btn-lg" id="profileSaveBtn">💾 保存档案</button>'
        }
      </div>
    `;
    bindSectionEvents(content, data);

    document.getElementById('profilePrevBtn')?.addEventListener('click', () => {
      collectSectionData(content, data);
      saveData(data);
      if (currentStep > 0) { currentStep--; renderActiveSection(); renderSectionNav(); }
    });
    document.getElementById('profileNextBtn')?.addEventListener('click', () => {
      collectSectionData(content, data);
      saveData(data);
      if (currentStep < TOTAL_STEPS - 1) { currentStep++; renderActiveSection(); renderSectionNav(); }
    });
    var saveBtn = document.getElementById('profileSaveBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', function() {
        collectSectionData(content, data);
        saveData(data);
        syncToQuestionnaire(data);
        var btn = this;
        btn.textContent = '✅ 已保存并同步！';
        btn.style.background = 'linear-gradient(135deg, #22c55e, #16a34a)';
        setTimeout(function() {
          btn.textContent = '💾 保存档案';
          btn.style.background = '';
        }, 2000);
      });
    }
  }

  function collectSectionData(content, data) {
    const inputs = content.querySelectorAll('[data-pf-field]');
    inputs.forEach(el => {
      const field = el.dataset.pfField;
      if (el.type === 'checkbox') data[field] = el.checked;
      else data[field] = el.value;
    });
    // 收集HACCP小组成员
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
    // 收集企业其他项目
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
    // 收集产品描述-其他必要信息
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
    // 收集预期用途-其他必要信息
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
    // 收集配方表
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
    // 收集生产步骤
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

  // ===== 步骤渲染函数 =====

  // 步骤1：HACCP小组的组成
  function renderHaccpTeam(data) {
    var teamRows = data.haccpTeam.map(function(m, i) {
      var deptOptionsHtml = '<option value="">请选择部门</option>' + DEPT_OPTIONS.map(function(d) {
        var selected = m.dept === d ? ' selected' : '';
        return '<option value="' + esc(d) + '"' + selected + '>' + esc(d) + '</option>';
      }).join('');
      return '<tr data-team-idx="' + i + '">' +
        '<td><input type="text" class="pf-t-name" value="' + esc(m.name) + '" placeholder="姓名"></td>' +
        '<td><select class="pf-t-dept" style="width:100%;padding:7px 10px;border:1px solid var(--gray-200);border-radius:5px;font-size:12px;font-family:inherit;background:#fff;">' + deptOptionsHtml + '</select></td>' +
        '<td><input type="text" class="pf-t-role" value="' + esc(m.role) + '" placeholder="职责"></td>' +
        '<td><input type="text" class="pf-t-auth" value="' + esc(m.authority) + '" placeholder="权限"></td>' +
        '<td><input type="text" class="pf-t-remark" value="' + esc(m.remark) + '" placeholder="备注"></td>' +
        '<td><button class="q15-del-row pf-del-team" data-team-idx="' + i + '">&times;</button></td>' +
        '</tr>';
    }).join('');

    return '<div class="q15-field-group"><label>企业名称 <span class="required">*</span></label><input type="text" data-pf-field="companyName" value="' + esc(data.companyName) + '" placeholder="请输入企业名称"></div>' +
      '<div class="q15-field-group"><label>制定部门 <span class="required">*</span></label><input type="text" data-pf-field="deptName" value="' + esc(data.deptName) + '" placeholder="请输入制定部门"></div>' +
      '<div class="q15-field-group"><label>审核人员</label><input type="text" data-pf-field="auditor" value="' + esc(data.auditor) + '" placeholder="请输入审核人员姓名"></div>' +
      '<div class="q15-field-group" style="margin-bottom:24px;"><label>其他项目</label>' +
      '<div id="pf-extraBody" style="margin-bottom:8px;">' +
      (data.extraItems || []).map(function(e, i) {
        return '<div class="pf-extra-row" data-ex-idx="' + i + '" style="display:flex;gap:8px;align-items:center;margin-bottom:6px;"><input type="text" class="pf-extra-key" value="' + esc(e.key) + '" placeholder="项目名称" style="flex:1;padding:7px 10px;border:1px solid var(--gray-200);border-radius:5px;font-size:12px;font-family:inherit;"><input type="text" class="pf-extra-val" value="' + esc(e.value) + '" placeholder="项目内容" style="flex:1;padding:7px 10px;border:1px solid var(--gray-200);border-radius:5px;font-size:12px;font-family:inherit;"><button class="q15-del-row pf-del-ex" data-ex-idx="' + i + '" style="flex-shrink:0;">&times;</button></div>';
      }).join('') +
      '</div><button class="btn btn-xs btn-secondary" id="pf-addExtra">+ 添加项目</button></div>' +
      '<div class="q15-table-section"><h3>HACCP小组成员 <span class="required">*</span></h3><p class="q15-table-hint">成员涵盖生产、品控、设备、仓储、采购等部门负责人</p>' +
      '<table class="q15-table" id="pf-teamTable"><thead><tr>' +
      '<th>姓名</th><th>部门</th><th>职责</th><th>权限</th><th>备注</th><th style="width:50px">操作</th>' +
      '</tr></thead><tbody id="pf-teamBody">' + teamRows + '</tbody></table>' +
      '<div style="display:flex;gap:10px;margin-top:8px;"><button class="btn btn-sm btn-secondary" id="pf-addTeam">+ 添加成员</button><button class="btn btn-sm btn-secondary" id="pf-downloadRecord">📋 记录表下载</button></div></div>';
  }

  // 步骤2：产品描述
  function renderProductDesc(data) {
    var cardsHtml = PRODUCT_DESC_FIELDS.map(function(f, i) {
      return '<div style="background:var(--gray-50);border:1px solid var(--gray-200);border-radius:10px;padding:16px 18px;margin-bottom:12px;">' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">' +
        '<span style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--primary-700));color:#fff;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + (i + 1) + '</span>' +
        '<label style="font-size:14px;font-weight:600;color:var(--gray-800);">' + esc(f.label) + '</label>' +
        '</div>' +
        '<p style="font-size:12px;color:var(--gray-400);margin-bottom:6px;">提示：' + esc(f.hint) + '</p>' +
        '<textarea data-pf-field="' + f.id + '" rows="3" style="width:100%;padding:10px 14px;border:1px solid var(--gray-200);border-radius:8px;font-size:13px;font-family:inherit;resize:vertical;background:#fff;transition:all 0.2s;" placeholder="请输入' + esc(f.label) + '">' + esc(data[f.id] || '') + '</textarea>' +
        '</div>';
    }).join('');

    var extraHtml = (data.productExtraItems || []).map(function(e, i) {
      return '<div class="pf-pe-row" data-pe-idx="' + i + '" style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">' +
        '<input type="text" class="pf-pe-key" value="' + esc(e.key) + '" placeholder="项目名称" style="flex:1;padding:7px 10px;border:1px solid var(--gray-200);border-radius:5px;font-size:12px;font-family:inherit;">' +
        '<input type="text" class="pf-pe-val" value="' + esc(e.value) + '" placeholder="项目内容" style="flex:1;padding:7px 10px;border:1px solid var(--gray-200);border-radius:5px;font-size:12px;font-family:inherit;">' +
        '<button class="q15-del-row pf-del-pe" data-pe-idx="' + i + '" style="flex-shrink:0;">&times;</button></div>';
    }).join('');

    return '<div style="margin-bottom:20px;">' +
      '<span style="font-size:15px;font-weight:600;color:var(--gray-700);">产品描述信息填报</span>' +
      '</div>' +
      cardsHtml +
      '<div style="background:var(--gray-50);border:1px solid var(--gray-200);border-radius:10px;padding:16px 18px;">' +
      '<h3 style="font-size:14px;font-weight:600;color:var(--gray-800);margin-bottom:8px;">其他必要信息</h3>' +
      '<div id="pf-peBody">' + extraHtml + '</div>' +
      '<button class="btn btn-xs btn-secondary" id="pf-addPE" style="margin-top:4px;">+ 添加项目</button></div>' +
      '<div style="display:flex;gap:10px;margin-top:20px;justify-content:center;">' +
      '<button class="btn btn-primary" id="pf-saveProductDesc">💾 保存</button>' +
      '<button class="btn btn-secondary" id="pf-resetProductDesc">🔄 重置</button></div>';
  }

  // 步骤3：预期用途的确定
  function renderIntendedUse(data) {
    var cardsHtml = INTENDED_USE_FIELDS.map(function(f, i) {
      return '<div style="background:var(--gray-50);border:1px solid var(--gray-200);border-radius:10px;padding:16px 18px;margin-bottom:12px;">' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">' +
        '<span style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--primary-700));color:#fff;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + (i + 1) + '</span>' +
        '<label style="font-size:14px;font-weight:600;color:var(--gray-800);">' + esc(f.label) + '</label>' +
        '</div>' +
        '<p style="font-size:12px;color:var(--gray-400);margin-bottom:6px;">提示：' + esc(f.hint) + '</p>' +
        '<textarea data-pf-field="' + f.id + '" rows="3" style="width:100%;padding:10px 14px;border:1px solid var(--gray-200);border-radius:8px;font-size:13px;font-family:inherit;resize:vertical;background:#fff;transition:all 0.2s;" placeholder="请输入' + esc(f.label) + '">' + esc(data[f.id] || '') + '</textarea>' +
        '</div>';
    }).join('');

    var extraHtml = (data.iuExtraItems || []).map(function(e, i) {
      return '<div class="pf-iu-row" data-iu-idx="' + i + '" style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">' +
        '<input type="text" class="pf-iu-key" value="' + esc(e.key) + '" placeholder="项目名称" style="flex:1;padding:7px 10px;border:1px solid var(--gray-200);border-radius:5px;font-size:12px;font-family:inherit;">' +
        '<input type="text" class="pf-iu-val" value="' + esc(e.value) + '" placeholder="项目内容" style="flex:1;padding:7px 10px;border:1px solid var(--gray-200);border-radius:5px;font-size:12px;font-family:inherit;">' +
        '<button class="q15-del-row pf-del-iu" data-iu-idx="' + i + '" style="flex-shrink:0;">&times;</button></div>';
    }).join('');

    return '<div style="margin-bottom:20px;">' +
      '<span style="font-size:15px;font-weight:600;color:var(--gray-700);">预期用途信息填报</span>' +
      '</div>' +
      cardsHtml +
      '<div style="background:var(--gray-50);border:1px solid var(--gray-200);border-radius:10px;padding:16px 18px;">' +
      '<h3 style="font-size:14px;font-weight:600;color:var(--gray-800);margin-bottom:8px;">其他必要信息</h3>' +
      '<div id="pf-iuBody">' + extraHtml + '</div>' +
      '<button class="btn btn-xs btn-secondary" id="pf-addIU" style="margin-top:4px;">+ 添加项目</button></div>' +
      '<div style="display:flex;gap:10px;margin-top:20px;justify-content:center;">' +
      '<button class="btn btn-primary" id="pf-saveIntendedUse">💾 保存</button>' +
      '<button class="btn btn-secondary" id="pf-resetIntendedUse">🔄 重置</button></div>';
  }

  // ==================== 流程图相关函数（从问卷原封不动搬过来）====================

  // 可视化流程图
  function renderVisualFlowchart(steps) {
    if (!steps || steps.length === 0 || !steps.some(function(s) { return s.stepName && s.stepName.trim(); })) return '<p style="color:var(--gray-400);font-style:italic;text-align:center;padding:20px;">暂无步骤数据</p>';
    var validSteps = steps.filter(function(s) { return s.stepName && s.stepName.trim(); });
    var html = '<div class="q15-visual-flowchart"><div class="q15-vf-node start-end"><div class="q15-vf-node-shape start">开始</div><div class="q15-vf-arrow-down"></div></div>';
    validSteps.forEach(function(step, i) { var isCCP = step.controlPoint && step.controlPoint.toLowerCase().indexOf('ccp') !== -1; var ccpLabel = isCCP ? '<span class="q15-vf-ccp-badge">' + esc(step.controlPoint) + '</span>' : ''; html += '<div class="q15-vf-node"><div class="q15-vf-node-shape ' + (isCCP ? 'ccp' : 'step') + '"><span class="q15-vf-step-num">' + (i + 1) + '</span><div class="q15-vf-step-content"><strong>' + esc(step.stepName) + '</strong>' + (step.operationMethod ? '<p class="q15-vf-detail">方法：' + esc(step.operationMethod) + '</p>' : '') + (step.parameters ? '<p class="q15-vf-detail">参数：' + esc(step.parameters) + '</p>' : '') + (step.equipmentName ? '<p class="q15-vf-detail">设备：' + esc(step.equipmentName) + '</p>' : '') + '</div>' + ccpLabel + '</div>' + (i < validSteps.length - 1 ? '<div class="q15-vf-arrow-down"></div>' : '') + '</div>'; });
    html += '<div class="q15-vf-node start-end"><div class="q15-vf-arrow-down"></div><div class="q15-vf-node-shape end">结束</div></div></div>';
    return html;
  }

  // 流程图预览
  function renderFlowchartPreview(data) {
    var hasSteps = data.processSteps && data.processSteps.some(function(s) { return s.stepName && s.stepName.trim(); });
    if (data.flowchartXml) return '<div class="q15-flowchart-preview"><div class="q15-flowchart-info"><span class="q15-flowchart-icon">📊</span><span>流程图已创建</span><span class="q15-flowchart-size">' + (data.flowchartXml.length / 1024).toFixed(1) + ' KB</span></div><div class="q15-flowchart-actions"><button class="btn btn-primary btn-sm" id="pfEditDrawioBtn">✏️ draw.io编辑</button><button class="btn btn-secondary btn-sm" id="pfClearFlowchartBtn">🗑️ 清除</button></div></div>';
    if (hasSteps) return '<div class="q15-vf-wrapper"><div class="q15-vf-actions"><button class="btn btn-secondary btn-sm" id="pfOpenDrawioBtn">📝 draw.io高级编辑</button></div><div id="pfVfContainer">' + renderVisualFlowchart(data.processSteps) + '</div></div>';
    return '<div class="q15-flowchart-empty"><div class="q15-flowchart-empty-icon">📊</div><p>请先在上方填写操作步骤，AI将自动生成生产流程图</p></div>';
  }

  // 生成 draw.io XML
  function generateDrawioXml(steps) {
    var validSteps = (steps || []).filter(function(s) { return s.stepName && s.stepName.trim(); });
    var cells = [];
    var NODE_W = 160, NODE_H = 60, ARROW_H = 40;
    var cx = 300;
    var startY = 40;
    cells.push('<mxCell id="0" /><mxCell id="1" parent="0" />');
    cells.push('<mxCell id="start" value="开始" style="ellipse;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;fontSize=14;fontStyle=1;" vertex="1" parent="1"><mxGeometry x="' + (cx - 50) + '" y="' + startY + '" width="100" height="50" as="geometry" /></mxCell>');
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
      var arrowId = 'arrow_' + i;
      cells.push('<mxCell id="' + arrowId + '" style="edgeStyle=orthogonalEdgeStyle;" edge="1" source="' + prevId + '" target="' + nodeId + '" parent="1"><mxGeometry relative="1" as="geometry" /></mxCell>');
      prevId = nodeId;
      curY += NODE_H + ARROW_H;
    }
    cells.push('<mxCell id="end" value="结束" style="ellipse;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;fontSize=14;fontStyle=1;" vertex="1" parent="1"><mxGeometry x="' + (cx - 50) + '" y="' + curY + '" width="100" height="50" as="geometry" /></mxCell>');
    cells.push('<mxCell id="arrow_end" style="edgeStyle=orthogonalEdgeStyle;" edge="1" source="' + prevId + '" target="end" parent="1"><mxGeometry relative="1" as="geometry" /></mxCell>');
    var totalH = curY + 50 + 40;
    return '<?xml version="1.0" encoding="UTF-8"?><mxGraphModel dx="1422" dy="762" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1169" pageHeight="827" math="0" shadow="0"><root>' + cells.join('') + '</root></mxGraphModel>';
  }

  // 打开 draw.io 编辑器
  function openDrawioEditor(data) {
    var initXml = data.flowchartXml || '';
    if (!initXml) {
      var validSteps = (data.processSteps || []).filter(function(s) { return s.stepName && s.stepName.trim(); });
      initXml = generateDrawioXml(validSteps);
    }
    var overlay = document.createElement('div');
    overlay.className = 'q15-drawio-modal-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = [
      '<div style="background:#fff;border-radius:10px;width:95vw;height:94vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.4);">',
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 20px;background:#1e293b;color:#fff;border-radius:10px 10px 0 0;">',
          '<span style="font-size:15px;font-weight:600;">✏️ Draw.io 流程图编辑器</span>',
          '<div style="display:flex;align-items:center;gap:10px;">',
            '<span id="pfDrawioStatus" style="font-size:12px;color:#94a3b8;"></span>',
            '<button id="pfDrawioSaveBtn" style="background:#2563eb;color:#fff;border:none;border-radius:6px;padding:6px 16px;cursor:pointer;font-size:13px;">💾 保存</button>',
            '<button id="pfDrawioCloseBtn" style="background:rgba(255,255,255,.15);color:#fff;border:none;border-radius:6px;padding:6px 14px;cursor:pointer;font-size:13px;">✕ 关闭</button>',
          '</div>',
        '</div>',
        '<div style="flex:1;position:relative;background:#f1f5f9;">',
          '<div id="pfDrawioLoadingMask" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#f1f5f9;z-index:5;font-size:14px;color:#64748b;">',
            '<div style="text-align:center;"><div class="fc-spinner" style="width:36px;height:36px;border-width:4px;margin:0 auto 12px;"></div><p>正在加载 Draw.io 编辑器...</p><p style="font-size:12px;margin-top:4px;">如长时间未响应，请检查网络连接</p></div>',
          '</div>',
          '<iframe id="pfDrawioFrame" src="https://embed.diagrams.net/?embed=1&proto=json&spin=1&stealth=1&lang=zh" style="width:100%;height:100%;border:none;display:block;" allowfullscreen></iframe>',
        '</div>',
      '</div>'
    ].join('');
    document.body.appendChild(overlay);

    var frame = document.getElementById('pfDrawioFrame');
    var statusEl = document.getElementById('pfDrawioStatus');
    var loadingMask = document.getElementById('pfDrawioLoadingMask');
    var iframeReady = false;
    var pendingXml = initXml;
    var currentXml = initXml;

    function setStatus(msg) { if (statusEl) statusEl.textContent = msg; }
    function sendToFrame(msg) { try { frame.contentWindow.postMessage(JSON.stringify(msg), '*'); } catch(e) {} }
    function doSave() {
      data.flowchartXml = currentXml;
      saveData(data);
      setStatus('✅ 已保存');
      var area = document.getElementById('pfFlowchartArea');
      if (area) { area.innerHTML = renderFlowchartPreview(data); bindFlowchartButtons(data); }
    }
    function closeEditor() {
      window.removeEventListener('message', handleMessage);
      overlay.remove();
    }
    function handleMessage(evt) {
      var msg;
      try { msg = JSON.parse(evt.data); } catch(e) { return; }
      if (!msg || !msg.event) return;
      if (msg.event === 'init') {
        if (loadingMask) loadingMask.style.display = 'none';
        iframeReady = true;
        sendToFrame({ action: 'load', autosave: 1, xml: pendingXml || '' });
        setStatus('编辑中（修改后点击保存）');
      } else if (msg.event === 'autosave') {
        currentXml = msg.xml || currentXml;
        setStatus('自动保存中...');
        setTimeout(function() { setStatus('编辑中'); }, 1500);
      } else if (msg.event === 'save' || msg.event === 'export') {
        currentXml = msg.xml || currentXml;
        doSave();
      } else if (msg.event === 'close') {
        closeEditor();
      }
    }
    window.addEventListener('message', handleMessage);
    document.getElementById('pfDrawioSaveBtn').onclick = function() { sendToFrame({ action: 'export', format: 'xml' }); };
    document.getElementById('pfDrawioCloseBtn').onclick = closeEditor;
    overlay.addEventListener('click', function(e) { if (e.target === overlay) closeEditor(); });
    setTimeout(function() {
      if (!iframeReady && loadingMask && loadingMask.style.display !== 'none') {
        loadingMask.innerHTML = '<div style="text-align:center;color:#dc2626;"><p style="font-size:16px;margin-bottom:8px;">⚠️ 加载超时</p><p style="font-size:13px;">无法连接到 Draw.io 服务器<br>请检查网络连接或稍后重试</p></div>';
      }
    }, 15000);
  }

  // 绑定流程图按钮
  function bindFlowchartButtons(data) {
    var openBtn = document.getElementById('pfOpenDrawioBtn');
    if (openBtn) openBtn.addEventListener('click', function() { openDrawioEditor(data); });
    var editBtn = document.getElementById('pfEditDrawioBtn');
    if (editBtn) editBtn.addEventListener('click', function() { openDrawioEditor(data); });
    var clearBtn = document.getElementById('pfClearFlowchartBtn');
    if (clearBtn) { clearBtn.addEventListener('click', function() { data.flowchartXml = ''; saveData(data); var area = document.getElementById('pfFlowchartArea'); if (area) { area.innerHTML = renderFlowchartPreview(data); bindFlowchartButtons(data); } }); }
  }

  // 步骤4：流程图的制定
  function renderFlowchartMake(data) {
    return '<h3>配方以及依据</h3><p class="q15-table-hint">根据投料顺序列出原料、辅料及添加剂的精确用量，并解释关键原料的作用</p>' +
      '<table class="q15-table" id="pf-formulaTable"><thead><tr><th>原料/辅料/添加剂</th><th>精确用量</th><th>关键作用</th><th style="width:50px">操作</th></tr></thead><tbody id="pf-formulaBody">' +
      (data.formula || []).map(function(f, i) {
        return '<tr data-fm-idx="' + i + '"><td><input type="text" value="' + esc(f.material) + '" placeholder="如：活性炭"></td><td><input type="text" value="' + esc(f.dosage) + '" placeholder="如：Xx g/kg原料"></td><td><input type="text" value="' + esc(f.func) + '" placeholder="如：除去色素"></td><td><button class="q15-del-row pf-del-fm" data-fm-idx="' + i + '">&times;</button></td></tr>';
      }).join('') +
      '</tbody></table><button class="btn btn-sm btn-secondary" id="pf-addFormula">+ 添加原料</button>' +
      '<hr class="q15-divider"><h3>生产流程步骤</h3><p class="q15-table-hint">按照生产顺序列出各加工步骤及其工艺参数</p><div id="pf-processSteps">' +
      (data.processSteps || []).map(function(s, i) {
        return '<div class="q15-process-card pf-process-card" data-ps-idx="' + i + '">' +
          '<div class="q15-process-header"><span class="q15-step-badge">步骤 ' + (i + 1) + '</span><button class="q15-del-process pf-del-ps" data-ps-idx="' + i + '">&times;</button></div>' +
          '<div class="q15-process-grid"><div class="q15-field-group"><label>步骤名称</label><input type="text" data-ps-field="stepName" value="' + esc(s.stepName) + '" placeholder="如：清洗"></div>' +
          '<div class="q15-field-group"><label>设备名称</label><input type="text" data-ps-field="equipmentName" value="' + esc(s.equipmentName) + '" placeholder="如：清洗机"></div></div>' +
          '<div class="q15-field-group" style="margin-bottom:0;"><label>操作方法</label><textarea data-ps-field="operationMethod" rows="2" placeholder="描述操作方法">' + esc(s.operationMethod) + '</textarea></div>' +
          '<div class="q15-row" style="margin-top:8px;"><div class="q15-field-group"><label>工艺参数</label><input type="text" data-ps-field="parameters" value="' + esc(s.parameters) + '" placeholder="如：温度85℃"></div>' +
          '<div class="q15-field-group"><label>控制点</label><input type="text" data-ps-field="controlPoint" value="' + esc(s.controlPoint) + '" placeholder="如：CCP-1"></div></div>' +
          '</div>';
      }).join('') +
      '</div><button class="btn btn-sm btn-secondary" id="pf-addStep">+ 添加步骤</button>' +
      '<hr class="q15-divider"><h3>🗺️ 生产工艺流程图</h3><p class="q15-table-hint">在下方 draw.io 编辑器中绘制您的生产工艺流程图，完成后保存，将自动同步到报告中。</p><div class="q15-flowchart-area" id="pfFlowchartArea">' + renderFlowchartPreview(data) + '</div>';
  }

  // 步骤5：流程图的确认
  function renderFlowchartConfirm(data) {
    return '<div class="q15-confirm-box"><label class="q15-checkbox-label"><input type="checkbox" data-pf-field="flowConfirmed"' + (data.flowConfirmed ? ' checked' : '') + '> HACCP小组已到生产现场，对以上流程图的每一步进行核对确认，确保与实际操作完全一致</label><p style="font-size:12px;color:var(--gray-400);margin-top:6px;">（确认内容包括：是否有额外的原料添加、步骤合并等）</p></div>' +
      '<div class="q15-flowchart-area" style="margin-top:24px;"><h3>流程图预览</h3><p class="q15-table-hint">可在问卷中使用 draw.io 绘制专业的生产工艺流程图</p><div class="q15-flowchart-empty"><div class="q15-flowchart-empty-icon">🗺️</div><p>暂未绘制流程图</p></div></div>';
  }

  // ===== 事件绑定 =====
  function bindSectionEvents(content, data) {
    // 添加小组行
    document.getElementById('pf-addTeam')?.addEventListener('click', function() {
      data = collectAndReload();
      data.haccpTeam.push({ id: genId(), name: '', dept: '', role: '', authority: '', remark: '' });
      saveRenderNav(data);
    });
    // 删除小组行
    content.querySelectorAll('#pf-teamBody .pf-del-team').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var idx = parseInt(this.dataset.teamIdx);
        data = collectAndReload();
        if (data.haccpTeam.length > 1) { data.haccpTeam.splice(idx, 1); saveRenderNav(data); }
      });
    });
    // 小组行输入实时保存
    content.querySelectorAll('#pf-teamBody input, #pf-teamBody select').forEach(function(el) {
      el.addEventListener('change', function() {
        var content2 = document.getElementById('profileContent');
        if (content2) { collectSectionData(content2, data); saveData(data); }
      });
      el.addEventListener('input', function() {
        var content2 = document.getElementById('profileContent');
        if (content2) { collectSectionData(content2, data); saveData(data); }
      });
    });
    // 添加企业其他项目
    document.getElementById('pf-addExtra')?.addEventListener('click', function() {
      data = collectAndReload();
      data.extraItems.push({ id: genId(), key: '', value: '' });
      saveRenderNav(data);
    });
    // 删除企业其他项目
    content.querySelectorAll('#pf-extraBody .pf-del-ex').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var idx = parseInt(this.dataset.exIdx);
        data = collectAndReload();
        if (data.extraItems.length > 0) { data.extraItems.splice(idx, 1); saveRenderNav(data); }
      });
    });

    // ===== 产品描述板块事件 =====
    document.getElementById('pf-saveProductDesc')?.addEventListener('click', function() {
      collectSectionData(content, data);
      saveData(data);
      var btn = this;
      btn.textContent = '✅ 已保存！';
      setTimeout(function() { btn.textContent = '💾 保存'; }, 1500);
    });
    document.getElementById('pf-resetProductDesc')?.addEventListener('click', function() {
      if (!confirm('确定要重置当前填写的所有产品描述信息吗？')) return;
      PRODUCT_DESC_FIELDS.forEach(function(f) { data[f.id] = ''; });
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

    // ===== 预期用途板块事件 =====
    document.getElementById('pf-saveIntendedUse')?.addEventListener('click', function() {
      collectSectionData(content, data);
      saveData(data);
      var btn = this;
      btn.textContent = '✅ 已保存！';
      setTimeout(function() { btn.textContent = '💾 保存'; }, 1500);
    });
    document.getElementById('pf-resetIntendedUse')?.addEventListener('click', function() {
      if (!confirm('确定要重置当前填写的所有预期用途信息吗？')) return;
      INTENDED_USE_FIELDS.forEach(function(f) { data[f.id] = ''; });
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

    // 添加配方行
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
    // 添加步骤
    document.getElementById('pf-addStep')?.addEventListener('click', function() {
      data = collectAndReload();
      data.processSteps.push({ id: genId(), stepName: '', operationMethod: '', parameters: '', controlPoint: '', equipmentName: '' });
      saveRenderNav(data);
    });
    content.querySelectorAll('#pf-processSteps .pf-del-ps').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var idx = parseInt(this.dataset.psIdx);
        data = collectAndReload();
        if (data.processSteps.length > 1) { data.processSteps.splice(idx, 1); saveRenderNav(data); }
      });
    });

    // 绑定流程图按钮
    bindFlowchartButtons(data);

    // 实时保存输入变化
    content.querySelectorAll('input[data-pf-field], textarea[data-pf-field], select[data-pf-field]').forEach(function(el) {
      el.addEventListener('input', function() {
        var content2 = document.getElementById('profileContent');
        if (content2) { collectSectionData(content2, data); saveData(data); }
      });
    });
    content.querySelectorAll('.pf-pe-key, .pf-pe-val, .pf-iu-key, .pf-iu-val').forEach(function(el) {
      el.addEventListener('input', function() {
        var content2 = document.getElementById('profileContent');
        if (content2) { collectSectionData(content2, data); saveData(data); }
      });
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