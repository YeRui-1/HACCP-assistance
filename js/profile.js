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

  let currentStep = 0;
  const TOTAL_STEPS = 5;
  const SECTION_NAMES = ['HACCP小组的组成', '产品描述', '预期用途的确定', '流程图的制定', '流程图的确认'];

  function init() {
    currentStep = 0;
    const container = document.getElementById('profileContainer');
    if (!container) return;
    const data = loadData();
    container.innerHTML = '' +
      '<a class="back-link" href="javascript:App.navigateTo(\'home\')">← 返回首页</a>' +
      '<div class="q15-header">' +
        '<h1>创建档案</h1>' +
        '<p class="q15-desc">请按照实际情况填写以下信息，完成后数据将自动同步到问卷</p>' +
        '<div class="q15-progress" id="profileProgress"></div>' +
      '</div>' +
      '<div id="profileContent"></div>';
    renderSectionNav();
    renderActiveSection();
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
        '<button class="btn btn-secondary" id="profilePrevBtn"' + (currentStep === 0 ? ' disabled' : '') + '>← 上一步</button>' +
        '<span class="q15-step-indicator">第 ' + (currentStep + 1) + ' / ' + TOTAL_STEPS + ' 步</span>' +
        (currentStep < TOTAL_STEPS - 1
          ? '<button class="btn btn-primary" id="profileNextBtn">下一步 →</button>'
          : '<button class="btn btn-primary btn-lg" id="profileSaveBtn">💾 保存档案</button>') +
      '</div>';
    bindSectionEvents(content, data);
    document.getElementById('profilePrevBtn')?.addEventListener('click', function() {
      collectSectionData(content, data);
      saveData(data);
      if (currentStep > 0) { currentStep--; renderActiveSection(); renderSectionNav(); }
    });
    document.getElementById('profileNextBtn')?.addEventListener('click', function() {
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
    // 渲染编辑器SVG
    if (currentStep === 3) {
      var d2 = loadData();
      var ed2 = fcLoadEditorData(d2);
      fcRenderSvg(ed2);
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
        '<td><button class="q15-del-row pf-del-team" data-team-idx="' + i + '">&times;</button></td></tr>';
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
      '<table class="q15-table" id="pf-teamTable"><thead><tr><th>姓名</th><th>部门</th><th>职责</th><th>权限</th><th>备注</th><th style="width:50px">操作</th></tr></thead><tbody id="pf-teamBody">' + teamRows + '</tbody></table>' +
      '<div style="display:flex;gap:10px;margin-top:8px;"><button class="btn btn-sm btn-secondary" id="pf-addTeam">+ 添加成员</button><button class="btn btn-sm btn-secondary" id="pf-downloadRecord">📋 记录表下载</button></div></div>';
  }

  function renderProductDesc(data) {
    var cardsHtml = PRODUCT_DESC_FIELDS.map(function(f, i) {
      return '<div style="background:var(--gray-50);border:1px solid var(--gray-200);border-radius:10px;padding:16px 18px;margin-bottom:12px;">' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">' +
        '<span style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--primary-700));color:#fff;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + (i + 1) + '</span>' +
        '<label style="font-size:14px;font-weight:600;color:var(--gray-800);">' + esc(f.label) + '</label></div>' +
        '<p style="font-size:12px;color:var(--gray-400);margin-bottom:6px;">提示：' + esc(f.hint) + '</p>' +
        '<textarea data-pf-field="' + f.id + '" rows="3" style="width:100%;padding:10px 14px;border:1px solid var(--gray-200);border-radius:8px;font-size:13px;font-family:inherit;resize:vertical;background:#fff;transition:all 0.2s;" placeholder="请输入' + esc(f.label) + '">' + esc(data[f.id] || '') + '</textarea></div>';
    }).join('');
    var extraHtml = (data.productExtraItems || []).map(function(e, i) {
      return '<div class="pf-pe-row" data-pe-idx="' + i + '" style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">' +
        '<input type="text" class="pf-pe-key" value="' + esc(e.key) + '" placeholder="项目名称" style="flex:1;padding:7px 10px;border:1px solid var(--gray-200);border-radius:5px;font-size:12px;font-family:inherit;">' +
        '<input type="text" class="pf-pe-val" value="' + esc(e.value) + '" placeholder="项目内容" style="flex:1;padding:7px 10px;border:1px solid var(--gray-200);border-radius:5px;font-size:12px;font-family:inherit;">' +
        '<button class="q15-del-row pf-del-pe" data-pe-idx="' + i + '" style="flex-shrink:0;">&times;</button></div>';
    }).join('');
    return '<div style="margin-bottom:20px;"><span style="font-size:15px;font-weight:600;color:var(--gray-700);">产品描述信息填报</span></div>' +
      cardsHtml +
      '<div style="background:var(--gray-50);border:1px solid var(--gray-200);border-radius:10px;padding:16px 18px;">' +
      '<h3 style="font-size:14px;font-weight:600;color:var(--gray-800);margin-bottom:8px;">其他必要信息</h3>' +
      '<div id="pf-peBody">' + extraHtml + '</div>' +
      '<button class="btn btn-xs btn-secondary" id="pf-addPE" style="margin-top:4px;">+ 添加项目</button></div>' +
      '<div style="display:flex;gap:10px;margin-top:20px;justify-content:center;">' +
      '<button class="btn btn-primary" id="pf-saveProductDesc">💾 保存</button>' +
      '<button class="btn btn-secondary" id="pf-resetProductDesc">🔄 重置</button></div>';
  }

  function renderIntendedUse(data) {
    var cardsHtml = INTENDED_USE_FIELDS.map(function(f, i) {
      return '<div style="background:var(--gray-50);border:1px solid var(--gray-200);border-radius:10px;padding:16px 18px;margin-bottom:12px;">' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">' +
        '<span style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--primary-700));color:#fff;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + (i + 1) + '</span>' +
        '<label style="font-size:14px;font-weight:600;color:var(--gray-800);">' + esc(f.label) + '</label></div>' +
        '<p style="font-size:12px;color:var(--gray-400);margin-bottom:6px;">提示：' + esc(f.hint) + '</p>' +
        '<textarea data-pf-field="' + f.id + '" rows="3" style="width:100%;padding:10px 14px;border:1px solid var(--gray-200);border-radius:8px;font-size:13px;font-family:inherit;resize:vertical;background:#fff;transition:all 0.2s;" placeholder="请输入' + esc(f.label) + '">' + esc(data[f.id] || '') + '</textarea></div>';
    }).join('');
    var extraHtml = (data.iuExtraItems || []).map(function(e, i) {
      return '<div class="pf-iu-row" data-iu-idx="' + i + '" style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">' +
        '<input type="text" class="pf-iu-key" value="' + esc(e.key) + '" placeholder="项目名称" style="flex:1;padding:7px 10px;border:1px solid var(--gray-200);border-radius:5px;font-size:12px;font-family:inherit;">' +
        '<input type="text" class="pf-iu-val" value="' + esc(e.value) + '" placeholder="项目内容" style="flex:1;padding:7px 10px;border:1px solid var(--gray-200);border-radius:5px;font-size:12px;font-family:inherit;">' +
        '<button class="q15-del-row pf-del-iu" data-iu-idx="' + i + '" style="flex-shrink:0;">&times;</button></div>';
    }).join('');
    return '<div style="margin-bottom:20px;"><span style="font-size:15px;font-weight:600;color:var(--gray-700);">预期用途信息填报</span></div>' +
      cardsHtml +
      '<div style="background:var(--gray-50);border:1px solid var(--gray-200);border-radius:10px;padding:16px 18px;">' +
      '<h3 style="font-size:14px;font-weight:600;color:var(--gray-800);margin-bottom:8px;">其他必要信息</h3>' +
      '<div id="pf-iuBody">' + extraHtml + '</div>' +
      '<button class="btn btn-xs btn-secondary" id="pf-addIU" style="margin-top:4px;">+ 添加项目</button></div>' +
      '<div style="display:flex;gap:10px;margin-top:20px;justify-content:center;">' +
      '<button class="btn btn-primary" id="pf-saveIntendedUse">💾 保存</button>' +
      '<button class="btn btn-secondary" id="pf-resetIntendedUse">🔄 重置</button></div>';
  }

  // ===== 流程图相关函数（从问卷搬来）=====
  function renderVisualFlowchart(steps) {
    if (!steps || steps.length === 0 || !steps.some(function(s) { return s.stepName && s.stepName.trim(); })) return '<p style="color:var(--gray-400);font-style:italic;text-align:center;padding:20px;">暂无步骤数据</p>';
    var validSteps = steps.filter(function(s) { return s.stepName && s.stepName.trim(); });
    var html = '<div class="q15-visual-flowchart"><div class="q15-vf-node start-end"><div class="q15-vf-node-shape start">开始</div><div class="q15-vf-arrow-down"></div></div>';
    validSteps.forEach(function(step, i) { var isCCP = step.controlPoint && step.controlPoint.toLowerCase().indexOf('ccp') !== -1; var ccpLabel = isCCP ? '<span class="q15-vf-ccp-badge">' + esc(step.controlPoint) + '</span>' : ''; html += '<div class="q15-vf-node"><div class="q15-vf-node-shape ' + (isCCP ? 'ccp' : 'step') + '"><span class="q15-vf-step-num">' + (i + 1) + '</span><div class="q15-vf-step-content"><strong>' + esc(step.stepName) + '</strong>' + (step.operationMethod ? '<p class="q15-vf-detail">方法：' + esc(step.operationMethod) + '</p>' : '') + (step.parameters ? '<p class="q15-vf-detail">参数：' + esc(step.parameters) + '</p>' : '') + (step.equipmentName ? '<p class="q15-vf-detail">设备：' + esc(step.equipmentName) + '</p>' : '') + '</div>' + ccpLabel + '</div>' + (i < validSteps.length - 1 ? '<div class="q15-vf-arrow-down"></div>' : '') + '</div>'; });
    html += '<div class="q15-vf-node start-end"><div class="q15-vf-arrow-down"></div><div class="q15-vf-node-shape end">结束</div></div></div>';
    return html;
  }

  function renderFlowchartPreview(data) {
    var hasSteps = data.processSteps && data.processSteps.some(function(s) { return s.stepName && s.stepName.trim(); });
    if (data.flowchartXml) return '<div class="q15-flowchart-preview"><div class="q15-flowchart-info"><span class="q15-flowchart-icon">📊</span><span>流程图已创建</span><span class="q15-flowchart-size">' + (data.flowchartXml.length / 1024).toFixed(1) + ' KB</span></div><div class="q15-flowchart-actions"><button class="btn btn-primary btn-sm" id="pfEditDrawioBtn">✏️ draw.io编辑</button><button class="btn-flowchart" id="pfInulinBtn" style="font-size:13px;padding:6px 18px"><span class="fc-nav-icon">📊</span> 菊粉工艺流程图</button><button class="btn btn-secondary btn-sm" id="pfClearFlowchartBtn">🗑️ 清除</button></div></div>';
    if (hasSteps) return '<div class="q15-vf-wrapper"><div class="q15-vf-actions"><button class="btn btn-secondary btn-sm" id="pfOpenDrawioBtn">📝 draw.io高级编辑</button><button class="btn-flowchart" id="pfInulinBtn" style="font-size:13px;padding:6px 18px"><span class="fc-nav-icon">📊</span> 菊粉工艺流程图</button><a class="btn btn-secondary btn-sm" href="flowchart-preview.html" target="_blank" style="text-decoration:none;display:inline-flex;align-items:center;gap:4px;">📊 流程图模板预览</a></div><div id="pfVfContainer">' + renderVisualFlowchart(data.processSteps) + '</div></div>';
    return '<div class="q15-flowchart-empty"><div class="q15-flowchart-empty-icon">📊</div><p>请先在上方填写操作步骤，AI将自动生成生产流程图</p><p style="font-size:12px;color:var(--gray-400);margin-top:8px;">支持在线编辑和导出</p></div>';
  }

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

  function openInulinModal(data) {
    if (typeof mermaid === 'undefined') { alert('Mermaid 渲染库未加载'); return; }
    var modal = document.createElement('div'); modal.className = 'q15-drawio-modal-overlay'; modal.style.zIndex = '1000';
    modal.innerHTML = '<div class="q15-drawio-modal" style="height:90vh;width:92vw"><div class="q15-drawio-toolbar"><span class="q15-drawio-title">菊粉完整生产工艺流程图 — 编辑</span><div class="q15-drawio-toolbar-actions"><span id="pfInulinStatus" style="font-size:12px;color:var(--gray-400)"></span><button class="q15-drawio-close" id="pfInulinModalClose">&times;</button></div></div><div style="flex:1;padding:16px;overflow:auto" id="pfInulinModalBody"></div></div>';
    document.body.appendChild(modal);
    var body = document.getElementById('pfInulinModalBody');
    var src = (window.INULIN_FLOWCHART && window.INULIN_FLOWCHART.mermaid) ? window.INULIN_FLOWCHART.mermaid : 'graph TD\n  L1["流程图数据未定义"]';
    try { localStorage.setItem('haccp_flowchart_mermaid', src); } catch(e) {}
    var editMode = false;
    function renderInulinBody() { body.innerHTML = ''; var tb = document.createElement('div'); tb.className = 'fc-toolbar'; tb.innerHTML = '<button class="btn btn-sm btn-secondary" id="pfInulinToggleEdit">' + (editMode ? '📖 预览流程图' : '✏️ 编辑流程图') + '</button><span class="fc-toolbar-info" id="pfInulinInfo">' + (editMode ? '修改节点表格后点击"应用修改"保存' : '点击编辑按钮编辑节点名称和箭头标签') + '</span>'; body.appendChild(tb); if (editMode) renderInulinEditor(body); else { renderInulinChart(body); } document.getElementById('pfInulinToggleEdit')?.addEventListener('click', function() { if (editMode) { var ta = document.getElementById('pfInulinFullSourceEditor'); if (ta) { try { localStorage.setItem('haccp_flowchart_mermaid', ta.value); } catch(e) {} } } editMode = !editMode; renderInulinBody(); }); }
    function renderInulinChart(container) { var currentSrc = ''; try { currentSrc = localStorage.getItem('haccp_flowchart_mermaid') || src; } catch(e) { currentSrc = src; } var chartDiv = document.createElement('div'); chartDiv.className = 'mermaid'; chartDiv.textContent = currentSrc; container.appendChild(chartDiv); var legend = document.createElement('div'); legend.className = 'fc-legend'; legend.innerHTML = '<div class="fc-legend-title">图 例</div><div class="fc-legend-items"><div class="fc-legend-item"><span class="fc-legend-dot ccp"></span>CCP - 关键控制点</div><div class="fc-legend-item"><span class="fc-legend-dot oprp"></span>OPRP - 操作性前提方案</div><div class="fc-legend-item"><span class="fc-legend-dot cqp"></span>CQP - 关键质量点</div><div class="fc-legend-item"><span class="fc-legend-dot io"></span>输入/输出/副产物</div></div>'; container.appendChild(legend); mermaid.initialize({ startOnLoad: false, theme: 'default', flowchart: { useMaxWidth: true, htmlLabels: true } }); setTimeout(function() { mermaid.run({ nodes: [chartDiv] }).catch(function(err) { chartDiv.innerHTML = '<p style="color:red">渲染失败: ' + (err.message || err) + '</p>'; }); }, 100); }
    function renderInulinEditor(container) { var currentSrc = ''; try { currentSrc = localStorage.getItem('haccp_flowchart_mermaid') || src; } catch(e) { currentSrc = src; } var parsed = parseMermaidNodes(currentSrc); var help = document.createElement('div'); help.className = 'fc-editor-help'; help.innerHTML = '修改节点名称和箭头标签后点击「应用修改」保存，然后点击「预览流程图」查看效果。'; container.appendChild(help); var table = document.createElement('table'); table.className = 'fc-node-table'; table.innerHTML = '<thead><tr><th>ID</th><th>节点文字</th><th>类型</th><th style="width:40px"></th></tr></thead><tbody id="pfInulinNodeBody"></tbody></table>'; container.appendChild(table); var tbody = document.getElementById('pfInulinNodeBody'); for (var i = 0; i < parsed.nodes.length; i++) { var n = parsed.nodes[i]; var tr = document.createElement('tr'); tr.dataset.nodeid = n.id; tr.innerHTML = '<td><code>' + n.id + '</code></td><td><input class="fc-node-input" data-nodeid="' + n.id + '" value="' + n.label.replace(/"/g,'"') + '" /></td><td><span class="fc-node-badge ' + n.type + '">' + n.type.toUpperCase() + '</span></td><td><button class="fc-btn-del pfInulinDelNode" data-nodeid="' + n.id + '">✕</button></td>'; tbody.appendChild(tr); }
    var addBtn = document.createElement('button'); addBtn.className = 'btn btn-sm btn-secondary'; addBtn.style.margin = '8px 0'; addBtn.textContent = '+ 添加节点行'; addBtn.addEventListener('click', function() { var tb = document.getElementById('pfInulinNodeBody'); var newId = 'N' + Date.now(); var tr = document.createElement('tr'); tr.dataset.nodeid = newId; tr.innerHTML = '<td><code>' + newId + '</code></td><td><input class="fc-node-input" data-nodeid="' + newId + '" value="新步骤' + (tb.children.length + 1) + '" /></td><td><select class="fc-input-type"><option value="step">STEP</option><option value="ccp">CCP</option><option value="oprp">OPRP</option><option value="cqp">CQP</option><option value="io">IO</option></select></td><td><button class="fc-btn-del pfInulinDelNode" data-nodeid="' + newId + '">✕</button></td>'; tr.querySelector('.pfInulinDelNode').addEventListener('click', function() { tr.remove(); }); tb.appendChild(tr); }); container.appendChild(addBtn); container.querySelectorAll('.pfInulinDelNode').forEach(function(btn) { btn.addEventListener('click', function() { var row = this.closest('tr'); if (row) row.remove(); }); });
    if (parsed.edges.length > 0) { var eHelp = document.createElement('div'); eHelp.className = 'fc-editor-help'; eHelp.style.marginTop = '16px'; eHelp.textContent = '箭头标签：'; container.appendChild(eHelp); var eTable = document.createElement('table'); eTable.className = 'fc-node-table'; eTable.innerHTML = '<thead><tr><th>连接</th><th>线上文字</th><th style="width:40px"></th></tr></thead><tbody id="pfInulinEdgeBody"></tbody></table>'; container.appendChild(eTable); var etbody = document.getElementById('pfInulinEdgeBody'); for (var i = 0; i < parsed.edges.length; i++) { var e = parsed.edges[i]; if (!e.label) continue; var tr = document.createElement('tr'); tr.innerHTML = '<td><code>' + e.from + ' → ' + e.to + '</code></td><td><input class="fc-edge-label" data-edge="' + e.from + '|' + e.to + '" value="' + (e.label || '') + '" style="width:100%" /></td><td><button class="fc-btn-del pfInulinDelEdge">✕</button></td>'; tr.querySelector('.pfInulinDelEdge').addEventListener('click', function() { this.closest('tr').remove(); }); etbody.appendChild(tr); } var addEdgeBtn = document.createElement('button'); addEdgeBtn.className = 'btn btn-sm btn-secondary'; addEdgeBtn.style.margin = '8px 0'; addEdgeBtn.textContent = '+ 添加箭头标签'; addEdgeBtn.addEventListener('click', function() { var tb = document.getElementById('pfInulinEdgeBody'); var newId1 = 'N' + Date.now(); var newId2 = 'N' + (Date.now() + 1); var tr = document.createElement('tr'); tr.innerHTML = '<td><input class="fc-edge-input" value="' + newId1 + '-->' + newId2 + '" style="width:120px;font-size:12px" /></td><td><input class="fc-edge-label" value="" style="width:100%" /></td><td><button class="fc-btn-del pfInulinDelEdge">✕</button></td>'; tr.querySelector('.pfInulinDelEdge').addEventListener('click', function() { tr.remove(); }); tb.appendChild(tr); }); container.appendChild(addEdgeBtn); }
    var actions = document.createElement('div'); actions.className = 'fc-editor-actions'; actions.style.marginTop = '12px'; actions.innerHTML = '<button class="btn btn-primary btn-sm" id="pfInulinApply">✅ 应用修改</button><button class="btn btn-secondary btn-sm" id="pfInulinReset">↩️ 恢复默认</button><span class="fc-editor-status" id="pfInulinEditStatus"></span>'; container.appendChild(actions);
    document.getElementById('pfInulinApply').addEventListener('click', function() { var ns = currentSrc; var changes = 0; container.querySelectorAll('.fc-node-input').forEach(function(inp) { var nid = inp.dataset.nodeid; var nl = inp.value.trim(); if (!nid || !nl) return; var lens = ns.split('\n'); for (var j = 0; j < lens.length; j++) { var l = lens[j].trim(); var m = l.match(new RegExp('^' + nid + '\\["(.+?)"\\]')); if (m) { var ol = m[1]; if (ol !== nl) { ns = ns.split(nid + '["' + ol + '"]').join(nid + '["' + nl + '"]'); changes++; } break; } } }); container.querySelectorAll('.fc-edge-label').forEach(function(inp) { var edge = inp.dataset.edge; var nl = inp.value.trim(); if (!edge) return; var parts = edge.split('|'); if (parts.length !== 2) return; var from = parts[0], to = parts[1]; var lens = ns.split('\n'); for (var j = 0; j < lens.length; j++) { var l = lens[j].trim(); var m = l.match(new RegExp('^' + from + '\\s*[-=.]+>\\|(.+?)\\|\\s*' + to + '$')); if (m) { var ol = m[1]; if (nl === '') { ns = ns.split(l).join(from + ' --> ' + to); } else if (ol !== nl) { ns = ns.split('|' + ol + '|').join('|' + nl + '|'); } changes++; break; } } }); if (changes > 0) { try { localStorage.setItem('haccp_flowchart_mermaid', ns); } catch(e) {} document.getElementById('pfInulinEditStatus').textContent = '✅ 已应用 ' + changes + ' 处修改'; currentSrc = ns; } else { document.getElementById('pfInulinEditStatus').textContent = 'ℹ️ 未检测到修改'; } });
    document.getElementById('pfInulinReset').addEventListener('click', function() { if (window.INULIN_FLOWCHART && window.INULIN_FLOWCHART.mermaid) { try { localStorage.setItem('haccp_flowchart_mermaid', window.INULIN_FLOWCHART.mermaid); } catch(e) {} document.getElementById('pfInulinEditStatus').textContent = '✅ 已恢复默认'; renderInulinBody(); } }); }
    function parseMermaidNodes(src) { var nodes = [], edges = [], lens = src.split('\n'), nodeRegex = /^(\w+)\["(.+?)"\]/, edgeRegex = /^(\w+)\s*[-=.]+>\s*(?:\|(.+?)\|)?\s*(\w+)/; for (var i = 0; i < lens.length; i++) { var l = lens[i].trim(); if (!l || l.startsWith('%%') || l.startsWith('graph') || l.startsWith('classDef')) continue; var m = l.match(nodeRegex); if (m) { var id = m[1], label = m[2]; if (id === 'loop_text' || id === 'L6_text' || id === 'L7_text' || id === 'R2_text' || id === 'R3_text') continue; var type = 'step'; if (l.indexOf(':::ccp') > -1) type = 'ccp'; else if (l.indexOf(':::oprp') > -1) type = 'oprp'; else if (l.indexOf(':::cqp') > -1) type = 'cqp'; else if (l.indexOf(':::io') > -1) type = 'io'; nodes.push({ id: id, label: label, type: type }); continue; } var e = l.match(edgeRegex); if (e) edges.push({ from: e[1], to: e[3], label: e[2] || '' }); } return { nodes: nodes, edges: edges }; }
    renderInulinBody();
    document.getElementById('pfInulinModalClose').onclick = function() { modal.remove(); };
    modal.onclick = function(e) { if (e.target === modal) modal.remove(); };
  }

  function bindFlowchartButtons(data) {
    var openBtn = document.getElementById('pfOpenDrawioBtn');
    if (openBtn) openBtn.addEventListener('click', function() { openDrawioEditor(data); });
    var editBtn = document.getElementById('pfEditDrawioBtn');
    if (editBtn) editBtn.addEventListener('click', function() { openDrawioEditor(data); });
    var inulinBtn = document.getElementById('pfInulinBtn');
    if (inulinBtn) inulinBtn.addEventListener('click', function() { openInulinModal(data); });
    var clearBtn = document.getElementById('pfClearFlowchartBtn');
    if (clearBtn) { clearBtn.addEventListener('click', function() { data.flowchartXml = ''; saveData(data); var area = document.getElementById('pfFlowchartArea'); if (area) { area.innerHTML = renderFlowchartPreview(data); bindFlowchartButtons(data); } }); }
  }

  // ===== 流程图编辑器核心（菊花工艺图模板）=====
  var FC_DEFAULT_STEPS = ['新鲜菊芋','超声波清洗去皮','粉碎预处理','精细破碎','清水匀浆','超声波破壁','沉淀提液','制菊芋粗提取液','减压浓缩','膜滤除杂','絮凝反应','离心除杂','活性炭脱色','离心除炭','树脂脱离子','二次膜过滤','醇降处理','烘干干燥','菊粉成品','金属检测','灌装打包','入库储存'];
  var FC_DEFAULT_CCP = [0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,1,0,1,0,0];
  var FC_DEFAULT_LEFT = [[1,'地下水','40℃水温、清洗30分钟'],[2,'三级粉碎机粉碎至15mm',null],[4,'1.5~3倍纯净水','搅拌'],[5,'功率50~100W、频率40kHz','12min'],[10,'温度35℃','搅拌转速80r/min'],[12,'活性炭',null],[14,'交换树脂',null],[16,'乙醇',null],[17,'温度120~180℃',null]];
  var FC_DEFAULT_RIGHT = [[1,'废水',null],[6,'加热加压、静置沉淀5min','废渣'],[8,'废渣',null],[9,null,'去除蛋白质、纤维素杂质'],[13,'废活性炭',null],[14,'饱和树脂',null],[16,'沉淀',null]];
  var FC_DEFAULT_REWORK = [[9,8,'不合格，返工'],[15,14,'粗菊粉溶液'],[17,16,'不合格，返工'],[19,18,'不合格，返工']];
  var FC_NW=240, FC_NH=60, FC_NX=12, FC_SY=50, FC_YG=100, FC_CX=650, FC_TH=2350, FC_AL=90;

  function fcLoadEditorData(data) {
    if (!data.fcEditor) {
      data.fcEditor = { steps: FC_DEFAULT_STEPS.slice(), ccp: FC_DEFAULT_CCP.slice(), leftNotes: JSON.parse(JSON.stringify(FC_DEFAULT_LEFT)), rightNotes: JSON.parse(JSON.stringify(FC_DEFAULT_RIGHT)), rework: JSON.parse(JSON.stringify(FC_DEFAULT_REWORK)) };
    }
    return data.fcEditor;
  }
  function fcNY(i) { return FC_SY + i * FC_YG; }
  function fcNCY(i) { return fcNY(i) + FC_NH / 2; }

  function fcRenderSvg(ed) {
    var wrap = document.getElementById('pfFcSvgWrap');
    if (!wrap) return;
    var svg = document.getElementById('pfFcSvg');
    if (!svg) { svg = document.createElementNS('http://www.w3.org/2000/svg','svg'); svg.id = 'pfFcSvg'; wrap.innerHTML = ''; wrap.appendChild(svg); }
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var defs = document.createElementNS('http://www.w3.org/2000/svg','defs');
    defs.innerHTML = '<marker id="pfM1" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="#222"/></marker><marker id="pfM2" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="#e53935"/></marker><marker id="pfM3" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#059669"/></marker>';
    svg.appendChild(defs);
    var cnt = ed.steps.length, totalH = Math.max(FC_TH, FC_SY + cnt * FC_YG + 30);
    svg.setAttribute('width', 1600); svg.setAttribute('height', totalH);
    svg.setAttribute('viewBox', '0 0 1600 ' + totalH);
    var ix = FC_CX - FC_NW/2 - FC_AL;
    // Input arrow
    fcAddLine(svg, ix, fcNCY(0), FC_CX - FC_NW/2, fcNCY(0), '#222', 2, 'url(#pfM1)');
    fcAddText(svg, ix - 15, fcNCY(0) + 8, '#333', 24, 'bold', 'end', '入料');
    // Nodes
    for (var i = 0; i < cnt; i++) {
      var y = fcNY(i), isCCP = ed.ccp[i] === 1;
      fcAddRect(svg, FC_CX - FC_NW/2, y, FC_NW, FC_NH, FC_NX, isCCP ? '#dc2626' : '#f5f5f5', isCCP ? '#991b1b' : '#666', isCCP ? 3 : 1.5);
      fcAddText(svg, FC_CX, y + FC_NH/2 + 10, isCCP ? '#fff' : '#333', 24, 'bold', 'middle', (i+1) + '. ' + ed.steps[i]);
    }
    // Vertical arrows
    for (var i = 0; i < cnt - 1; i++) fcAddLine(svg, FC_CX, fcNY(i) + FC_NH, FC_CX, fcNY(i+1), '#222', 2, 'url(#pfM1)');
    // Left notes
    var LX1 = FC_CX - FC_NW/2 - 5 - FC_AL, LX2 = FC_CX - FC_NW/2 - 5;
    for (var li = 0; li < ed.leftNotes.length; li++) {
      var idx = ed.leftNotes[li][0], ab = ed.leftNotes[li][1], be = ed.leftNotes[li][2];
      if (idx >= cnt) continue; var cy = fcNCY(idx);
      if (ab) fcAddText(svg, LX1 - 15, cy - 28, '#059669', 18, 'bold', 'end', ab);
      if (be) fcAddText(svg, LX1 - 15, cy + 40, '#059669', 18, 'normal', 'end', be);
      fcAddLine(svg, LX1, cy, LX2, cy, '#059669', 1.5, 'url(#pfM3)');
    }
    // Right notes
    var RX1 = FC_CX + FC_NW/2 + 5, RX2 = RX1 + FC_AL;
    for (var ri = 0; ri < ed.rightNotes.length; ri++) {
      var idx = ed.rightNotes[ri][0], ab = ed.rightNotes[ri][1], be = ed.rightNotes[ri][2];
      if (idx >= cnt) continue; var cy = fcNCY(idx);
      if (ab) fcAddText(svg, RX2 + 15, cy - 28, '#059669', 18, 'bold', 'start', ab);
      if (be) fcAddText(svg, RX2 + 15, cy + 40, '#059669', 18, 'normal', 'start', be);
      fcAddLine(svg, RX1, cy, RX2, cy, '#059669', 1.5, 'url(#pfM3)');
    }
    // Rework
    for (var r = 0; r < ed.rework.length; r++) {
      var si = ed.rework[r][0], ti = ed.rework[r][1], label = ed.rework[r][2];
      if (si >= cnt || ti >= cnt) continue;
      var fy = fcNCY(si), ty = fcNCY(ti), rx = FC_CX + FC_NW/2, mx = rx + 140;
      fcAddPolyline(svg, rx+','+fy+' '+mx+','+fy+' '+mx+','+ty+' '+(rx+3)+','+ty, 'none', '#e53935', 2, '8,4', 'url(#pfM2)');
      if (label) { var el = document.createElementNS('http://www.w3.org/2000/svg','text'); el.setAttribute('x',mx+15); el.setAttribute('y',(fy+ty)/2); el.setAttribute('fill','#e53935'); el.setAttribute('font-size','18'); el.setAttribute('font-weight','bold'); el.setAttribute('writing-mode','tb'); el.setAttribute('text-anchor','middle'); el.textContent = label; svg.appendChild(el); }
    }
  }
  function fcAddRect(s,x,y,w,h,r,f,st,sw){var e=document.createElementNS('http://www.w3.org/2000/svg','rect');e.setAttribute('x',x);e.setAttribute('y',y);e.setAttribute('width',w);e.setAttribute('height',h);e.setAttribute('rx',r);e.setAttribute('ry',r);e.setAttribute('fill',f);e.setAttribute('stroke',st);e.setAttribute('stroke-width',sw);s.appendChild(e);}
  function fcAddLine(s,x1,y1,x2,y2,st,sw,m){var e=document.createElementNS('http://www.w3.org/2000/svg','line');e.setAttribute('x1',x1);e.setAttribute('y1',y1);e.setAttribute('x2',x2);e.setAttribute('y2',y2);e.setAttribute('stroke',st);e.setAttribute('stroke-width',sw);if(m)e.setAttribute('marker-end',m);s.appendChild(e);}
  function fcAddText(s,x,y,f,fs,fw,a,t){var e=document.createElementNS('http://www.w3.org/2000/svg','text');e.setAttribute('x',x);e.setAttribute('y',y);e.setAttribute('fill',f);e.setAttribute('font-size',fs);e.setAttribute('font-weight',fw);e.setAttribute('text-anchor',a);e.textContent=t;s.appendChild(e);}
  function fcAddPolyline(s,p,f,st,sw,d,m){var e=document.createElementNS('http://www.w3.org/2000/svg','polyline');e.setAttribute('points',p);e.setAttribute('fill',f);e.setAttribute('stroke',st);e.setAttribute('stroke-width',sw);e.setAttribute('stroke-dasharray',d);if(m)e.setAttribute('marker-end',m);s.appendChild(e);}

  // ===== Step 4: 流程图的制定（增强版）=====
  function renderFlowchartMake(data) {
    var ed = fcLoadEditorData(data);
    var stepItems = ed.steps.map(function(n,i){
      var isCCP = ed.ccp[i] === 1;
      return '<li class="fcp-step-item"><span class="fcp-step-num'+(isCCP?' ccp':'')+'">'+(i+1)+'</span><span class="fcp-move-btn" onclick="Profile.fcMoveUp('+i+')">▲</span><span class="fcp-move-btn" onclick="Profile.fcMoveDown('+i+')">▼</span><input class="fcp-step-input" value="'+esc(n)+'" data-i="'+i+'" oninput="Profile.fcEditStep(this)"><button class="fcp-ccp-btn'+(isCCP?' active':'')+'" onclick="Profile.fcToggleCCP('+i+')">CCP</button><span class="fcp-step-del" onclick="Profile.fcDelStep('+i+')">×</span></li>';
    }).join('');
    var leftArrowItems = ed.leftNotes.map(function(a,i){return '<div class="fcp-arrow-item"><span class="fcp-arrow-tag green">S'+(a[0]+1)+'</span><input value="'+esc(a[1]||'')+'" data-i="'+i+'" data-f="1" oninput="Profile.fcEditLeftNote(this)" placeholder="上方"><input value="'+esc(a[2]||'')+'" data-i="'+i+'" data-f="2" oninput="Profile.fcEditLeftNote(this)" placeholder="下方"><span class="fcp-arrow-del" onclick="Profile.fcDelLeftNote('+i+')">×</span></div>';}).join('');
    var rightArrowItems = ed.rightNotes.map(function(a,i){return '<div class="fcp-arrow-item"><span class="fcp-arrow-tag green">S'+(a[0]+1)+'</span><input value="'+esc(a[1]||'')+'" data-i="'+i+'" data-f="1" oninput="Profile.fcEditRightNote(this)" placeholder="上方"><input value="'+esc(a[2]||'')+'" data-i="'+i+'" data-f="2" oninput="Profile.fcEditRightNote(this)" placeholder="下方"><span class="fcp-arrow-del" onclick="Profile.fcDelRightNote('+i+')">×</span></div>';}).join('');
    var reworkItems = ed.rework.map(function(r,i){return '<div class="fcp-arrow-item"><span class="fcp-arrow-tag red">S'+(r[0]+1)+'→S'+(r[1]+1)+'</span><input value="'+esc(r[2])+'" data-i="'+i+'" oninput="Profile.fcEditRework(this)" placeholder="标签"><span class="fcp-arrow-del" onclick="Profile.fcDelRework('+i+')">×</span></div>';}).join('');
    var leftEmpty = leftArrowItems ? '' : '<div class="fcp-empty-hint">(无)</div>';
    var rightEmpty = rightArrowItems ? '' : '<div class="fcp-empty-hint">(无)</div>';
    var reworkEmpty = reworkItems ? '' : '<div class="fcp-empty-hint">(无)</div>';
    // Save fcEditor data to data
    saveData(data);
    return '' +
      '<h3>配方以及依据</h3><p class="q15-table-hint">根据投料顺序列出原料、辅料及添加剂的精确用量，并解释关键原料的作用</p>' +
      '<table class="q15-table" id="pf-formulaTable"><thead><tr><th>原料/辅料/添加剂</th><th>精确用量</th><th>关键作用</th><th style="width:50px">操作</th></tr></thead><tbody id="pf-formulaBody">' +
      (data.formula || []).map(function(f, i){
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
          '<div class="q15-field-group"><label>控制点</label><input type="text" data-ps-field="controlPoint" value="' + esc(s.controlPoint) + '" placeholder="如：CCP-1"></div></div></div>';
      }).join('') +
      '</div><button class="btn btn-sm btn-secondary" id="pf-addStep">+ 添加步骤</button>' +
      '<hr class="q15-divider"><h3>🗺️ 生产工艺流程图</h3><p class="q15-table-hint">在下方 draw.io 编辑器中绘制您的生产工艺流程图，完成后保存，将自动同步到报告中。</p><div class="q15-flowchart-area" id="pfFlowchartArea">' + renderFlowchartPreview(data) + '</div>' +
      '<hr class="q15-divider"><h3>📋 流程图模板编辑 <span style="font-size:13px;font-weight:400;color:var(--gray-400);">编辑步骤、箭头标注，实时预览</span></h3><p class="q15-table-hint">下方为菊粉工艺流程图模板，可直接编辑步骤名称、切换CCP标识、添加入/输出箭头和返工箭头，SVG实时更新。</p>' +
      '<div class="pf-fc-editor-wrap">' +
        '<div class="pf-fc-toolbar"><span class="fcp-toolbar-title">步骤列表 <strong style="color:var(--primary);">' + ed.steps.length + '</strong>步</span><button class="btn btn-xs btn-secondary" onclick="Profile.fcResetDefault()">↩️ 恢复默认</button><button class="btn btn-xs btn-secondary" onclick="Profile.fcGenDrawioXml()">🔗 用draw.io打开</button></div>' +
        '<div class="pf-fc-columns">' +
          '<div class="pf-fc-left">' +
            '<div class="pf-fc-editor-section"><h5>步骤编辑</h5>' +
            '<ul class="fcp-step-list" id="pfFcStepList" style="max-height:250px;">' + stepItems + '</ul>' +
            '<div class="fcp-add-step" style="margin-top:4px;"><input id="pfFcNewStep" placeholder="新步骤名称"><button class="btn btn-primary btn-sm" onclick="Profile.fcAddStep()">+ 添加</button></div></div>' +
            '<div class="pf-fc-editor-section"><h5>↩️ 左侧输入箭头</h5><div class="fcp-arrow-list" id="pfFcLeftList" style="max-height:100px;">' + (leftArrowItems || leftEmpty) + '</div>' +
            '<div class="fcp-arrow-add"><input id="pfFcLaS" placeholder="步号" style="width:40px;"><input id="pfFcLaA" placeholder="上方"><input id="pfFcLaB" placeholder="下方" style="width:60px;"><button class="btn btn-xs btn-primary" onclick="Profile.fcAddLeftNote()">+</button></div></div>' +
            '<div class="pf-fc-editor-section"><h5>↪️ 右侧输出箭头</h5><div class="fcp-arrow-list" id="pfFcRightList" style="max-height:100px;">' + (rightArrowItems || rightEmpty) + '</div>' +
            '<div class="fcp-arrow-add"><input id="pfFcRaS" placeholder="步号" style="width:40px;"><input id="pfFcRaA" placeholder="上方"><input id="pfFcRaB" placeholder="下方" style="width:60px;"><button class="btn btn-xs btn-primary" onclick="Profile.fcAddRightNote()">+</button></div></div>' +
            '<div class="pf-fc-editor-section"><h5>🔴 返工箭头</h5><div class="fcp-arrow-list" id="pfFcReworkList" style="max-height:80px;">' + (reworkItems || reworkEmpty) + '</div>' +
            '<div class="fcp-arrow-add"><input id="pfFcRwS" placeholder="源" style="width:40px;"><input id="pfFcRwT" placeholder="目标" style="width:40px;"><input id="pfFcRwL" placeholder="标签"><button class="btn btn-xs btn-primary" onclick="Profile.fcAddRework()">+</button></div></div>' +
          '</div>' +
          '<div class="pf-fc-right"><div class="pf-fc-svg-wrap" id="pfFcSvgWrap"></div>' +
          '<div class="pf-fc-legend" style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;font-size:11px;color:var(--gray-500);">' +
            '<span><span class="fcp-legend-box" style="background:#f5f5f5;border-color:#666;"></span>普通</span>' +
            '<span><span class="fcp-legend-box" style="background:#dc2626;border-color:#991b1b;"></span>CCP</span>' +
            '<span><span class="fcp-legend-line" style="background:#222;height:2px;width:14px;display:inline-block;vertical-align:middle;"></span>流程</span>' +
            '<span><span class="fcp-legend-line" style="background:#059669;height:2px;width:14px;display:inline-block;vertical-align:middle;"></span>输入/输出</span>' +
            '<span><span style="border-top:2px dashed #e53935;width:14px;display:inline-block;vertical-align:middle;"></span>返工</span>' +
          '</div></div>' +
        '</div>' +
      '</div>';
  }

  // ===== 步骤5 ====
  function renderFlowchartConfirm(data) {
    return '<div class="q15-confirm-box"><label class="q15-checkbox-label"><input type="checkbox" data-pf-field="flowConfirmed"' + (data.flowConfirmed ? ' checked' : '') + '> HACCP小组已到生产现场，对以上流程图的每一步进行核对确认，确保与实际操作完全一致</label><p style="font-size:12px;color:var(--gray-400);margin-top:6px;">（确认内容包括：是否有额外的原料添加、步骤合并等）</p></div>' +
      '<div class="q15-flowchart-area" style="margin-top:24px;"><h3>流程图预览</h3><p class="q15-table-hint">可在问卷中使用 draw.io 绘制专业的生产工艺流程图</p><div class="q15-flowchart-empty"><div class="q15-flowchart-empty-icon">🗺️</div><p>暂未绘制流程图</p></div></div>';
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
      this.textContent = '✅ 已保存！';
      setTimeout(function() { if (document.getElementById('pf-saveProductDesc')) document.getElementById('pf-saveProductDesc').textContent = '💾 保存'; }, 1500);
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
    document.getElementById('pf-saveIntendedUse')?.addEventListener('click', function() {
      collectSectionData(content, data);
      saveData(data);
      this.textContent = '✅ 已保存！';
      setTimeout(function() { if (document.getElementById('pf-saveIntendedUse')) document.getElementById('pf-saveIntendedUse').textContent = '💾 保存'; }, 1500);
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
    bindFlowchartButtons(data);
    content.querySelectorAll('input[data-pf-field], textarea[data-pf-field], select[data-pf-field]').forEach(function(el) {
      el.addEventListener('input', function() { var c = document.getElementById('profileContent'); if (c) { collectSectionData(c, data); saveData(data); } });
    });
    content.querySelectorAll('.pf-pe-key, .pf-pe-val, .pf-iu-key, .pf-iu-val').forEach(function(el) {
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

  // ===== 公开的编辑器操作 =====
  function fcEditStep(inp){var d=loadData(),ed=fcLoadEditorData(d),i=parseInt(inp.dataset.i);ed.steps[i]=inp.value.trim()||'步骤'+(i+1);fcRenderAll(d);}
  function fcToggleCCP(i){var d=loadData(),ed=fcLoadEditorData(d);ed.ccp[i]=ed.ccp[i]?0:1;fcRenderAll(d);}
  function fcMoveUp(i){if(i<=0)return;var d=loadData(),ed=fcLoadEditorData(d);var tmp=ed.steps[i];ed.steps[i]=ed.steps[i-1];ed.steps[i-1]=tmp;var td=ed.ccp[i];ed.ccp[i]=ed.ccp[i-1];ed.ccp[i-1]=td;fcRenderAll(d);}
  function fcMoveDown(i){var d=loadData(),ed=fcLoadEditorData(d);if(i>=ed.steps.length-1)return;var tmp=ed.steps[i];ed.steps[i]=ed.steps[i+1];ed.steps[i+1]=tmp;var td=ed.ccp[i];ed.ccp[i]=ed.ccp[i+1];ed.ccp[i+1]=td;fcRenderAll(d);}
  function fcAddStep(){var inp=document.getElementById('pfFcNewStep');if(!inp)return;var v=inp.value.trim();if(!v)return;var d=loadData(),ed=fcLoadEditorData(d);ed.steps.push(v);ed.ccp.push(0);inp.value='';fcRenderAll(d);}
  function fcDelStep(i){var d=loadData(),ed=fcLoadEditorData(d);if(ed.steps.length<=1)return;ed.steps.splice(i,1);ed.ccp.splice(i,1);fcRenderAll(d);}
  function fcEditLeftNote(inp){var d=loadData(),ed=fcLoadEditorData(d),i=parseInt(inp.dataset.i),f=parseInt(inp.dataset.f);ed.leftNotes[i][f]=inp.value.trim()||null;fcRenderAll(d);}
  function fcEditRightNote(inp){var d=loadData(),ed=fcLoadEditorData(d),i=parseInt(inp.dataset.i),f=parseInt(inp.dataset.f);ed.rightNotes[i][f]=inp.value.trim()||null;fcRenderAll(d);}
  function fcEditRework(inp){var d=loadData(),ed=fcLoadEditorData(d),i=parseInt(inp.dataset.i);ed.rework[i][2]=inp.value.trim()||'';fcRenderAll(d);}
  function fcAddLeftNote(){var d=loadData(),ed=fcLoadEditorData(d);var s=parseInt(document.getElementById('pfFcLaS').value)-1,a=document.getElementById('pfFcLaA').value.trim(),b=document.getElementById('pfFcLaB').value.trim();if(isNaN(s)||s<0)return;ed.leftNotes.push([s,a||null,b||null]);document.getElementById('pfFcLaS').value='';document.getElementById('pfFcLaA').value='';document.getElementById('pfFcLaB').value='';fcRenderAll(d);}
  function fcAddRightNote(){var d=loadData(),ed=fcLoadEditorData(d);var s=parseInt(document.getElementById('pfFcRaS').value)-1,a=document.getElementById('pfFcRaA').value.trim(),b=document.getElementById('pfFcRaB').value.trim();if(isNaN(s)||s<0)return;ed.rightNotes.push([s,a||null,b||null]);document.getElementById('pfFcRaS').value='';document.getElementById('pfFcRaA').value='';document.getElementById('pfFcRaB').value='';fcRenderAll(d);}
  function fcAddRework(){var d=loadData(),ed=fcLoadEditorData(d);var s=parseInt(document.getElementById('pfFcRwS').value)-1,t=parseInt(document.getElementById('pfFcRwT').value)-1,l=document.getElementById('pfFcRwL').value.trim();if(isNaN(s)||isNaN(t)||s<0||t<0)return;ed.rework.push([s,t,l||'']);document.getElementById('pfFcRwS').value='';document.getElementById('pfFcRwT').value='';document.getElementById('pfFcRwL').value='';fcRenderAll(d);}
  function fcDelLeftNote(i){var d=loadData(),ed=fcLoadEditorData(d);ed.leftNotes.splice(i,1);fcRenderAll(d);}
  function fcDelRightNote(i){var d=loadData(),ed=fcLoadEditorData(d);ed.rightNotes.splice(i,1);fcRenderAll(d);}
  function fcDelRework(i){var d=loadData(),ed=fcLoadEditorData(d);ed.rework.splice(i,1);fcRenderAll(d);}
  function fcRenderAll(data){var ed=fcLoadEditorData(data);var list=document.getElementById('pfFcStepList');if(list){list.innerHTML=ed.steps.map(function(n,i){var isCCP=ed.ccp[i]===1;return '<li class="fcp-step-item"><span class="fcp-step-num'+(isCCP?' ccp':'')+'">'+(i+1)+'</span><span class="fcp-move-btn" onclick="Profile.fcMoveUp('+i+')">▲</span><span class="fcp-move-btn" onclick="Profile.fcMoveDown('+i+')">▼</span><input class="fcp-step-input" value="'+esc(n)+'" data-i="'+i+'" oninput="Profile.fcEditStep(this)"><button class="fcp-ccp-btn'+(isCCP?' active':'')+'" onclick="Profile.fcToggleCCP('+i+')">CCP</button><span class="fcp-step-del" onclick="Profile.fcDelStep('+i+')">×</span></li>';}).join('');}fcRenderArrowLists(ed);fcRenderSvg(ed);saveData(data);}
  function fcRenderArrowLists(ed){var ll=document.getElementById('pfFcLeftList');if(ll){var li=ed.leftNotes.map(function(a,i){return '<div class="fcp-arrow-item"><span class="fcp-arrow-tag green">S'+(a[0]+1)+'</span><input value="'+esc(a[1]||'')+'" data-i="'+i+'" data-f="1" oninput="Profile.fcEditLeftNote(this)" placeholder="上方"><input value="'+esc(a[2]||'')+'" data-i="'+i+'" data-f="2" oninput="Profile.fcEditLeftNote(this)" placeholder="下方"><span class="fcp-arrow-del" onclick="Profile.fcDelLeftNote('+i+')">×</span></div>';}).join('');ll.innerHTML=li||'<div class="fcp-empty-hint">(无)</div>';}var rl=document.getElementById('pfFcRightList');if(rl){var ri=ed.rightNotes.map(function(a,i){return '<div class="fcp-arrow-item"><span class="fcp-arrow-tag green">S'+(a[0]+1)+'</span><input value="'+esc(a[1]||'')+'" data-i="'+i+'" data-f="1" oninput="Profile.fcEditRightNote(this)" placeholder="上方"><input value="'+esc(a[2]||'')+'" data-i="'+i+'" data-f="2" oninput="Profile.fcEditRightNote(this)" placeholder="下方"><span class="fcp-arrow-del" onclick="Profile.fcDelRightNote('+i+')">×</span></div>';}).join('');rl.innerHTML=ri||'<div class="fcp-empty-hint">(无)</div>';}var rw=document.getElementById('pfFcReworkList');if(rw){var rwi=ed.rework.map(function(r,i){return '<div class="fcp-arrow-item"><span class="fcp-arrow-tag red">S'+(r[0]+1)+'→S'+(r[1]+1)+'</span><input value="'+esc(r[2])+'" data-i="'+i+'" oninput="Profile.fcEditRework(this)" placeholder="标签"><span class="fcp-arrow-del" onclick="Profile.fcDelRework('+i+')">×</span></div>';}).join('');rw.innerHTML=rwi||'<div class="fcp-empty-hint">(无)</div>';}}
  function fcResetDefault(){if(!confirm('确认恢复默认流程图？将丢失所有自定义修改。'))return;var d=loadData();d.fcEditor={steps:FC_DEFAULT_STEPS.slice(),ccp:FC_DEFAULT_CCP.slice(),leftNotes:JSON.parse(JSON.stringify(FC_DEFAULT_LEFT)),rightNotes:JSON.parse(JSON.stringify(FC_DEFAULT_RIGHT)),rework:JSON.parse(JSON.stringify(FC_DEFAULT_REWORK))};fcRenderAll(d);}
  function fcGenDrawioXml(){var d=loadData(),ed=fcLoadEditorData(d);var lines=['<mxfile host="HACCP-assistance" version="21.0.0">','  <diagram id="pf-haccp-flow" name="菊粉生产工艺流程图">'];var totalH=FC_SY+ed.steps.length*FC_YG+30;lines.push('    <mxGraphModel pageWidth="1600" pageHeight="'+totalH+'"><root><mxCell id="0"/><mxCell id="1" parent="0"/>');var yp=FC_SY;for(var i=0;i<ed.steps.length;i++){var isCCP=ed.ccp[i]===1;var fc=isCCP?'#dc2626':'#f5f5f5',sc=isCCP?'#991b1b':'#666666',fn=isCCP?'#ffffff':'#333333';lines.push('        <mxCell id="n'+(i+1)+'" value="'+esc(ed.steps[i])+'" style="rounded=1;whiteSpace=wrap;html=1;arcSize=20;fillColor='+fc+';strokeColor='+sc+';fontColor='+fn+';fontStyle=1;fontSize=12;" vertex="1" parent="1"><mxGeometry x="'+(FC_CX-FC_NW/2)+'" y="'+yp+'" width="'+FC_NW+'" height="'+FC_NH+'" as="geometry"/></mxCell>');yp+=FC_YG;}for(var i=0;i<ed.steps.length-1;i++)lines.push('        <mxCell id="e'+(i+1)+'" style="edgeStyle=orthogonalEdgeStyle;strokeColor=#000000;strokeWidth=2;" edge="1" source="n'+(i+1)+'" target="n'+(i+2)+'" parent="1"><mxGeometry relative="1" as="geometry"/></mxCell>');for(var r=0;r<ed.rework.length;r++){var s=ed.rework[r][0]+1,t=ed.rework[r][1]+1;var fY=fcNCY(ed.rework[r][0]),tY=fcNCY(ed.rework[r][1]),mx=FC_CX+FC_NW/2+140;if(ed.rework[r][2])lines.push('        <mxCell id="rw'+(r+1)+'" value="'+esc(ed.rework[r][2])+'" style="edgeStyle=orthogonalEdgeStyle;exitX=1;exitY=0.5;entryX=1;entryY=0.5;strokeColor=#e53935;strokeWidth=2;dashed=1;dashPattern=8 4;fillColor=#e53935;fontColor=#e53935;fontStyle=1;fontSize=11;" edge="1" source="n'+s+'" target="n'+t+'" parent="1"><mxGeometry relative="1" as="geometry"><Array as="points"><mxPoint x="'+mx+'" y="'+fY+'"/><mxPoint x="'+mx+'" y="'+tY+'"/></Array></mxGeometry></mxCell>');}lines.push('      </root></mxGraphModel></diagram></mxfile>');window.open('https://app.diagrams.net/#xml='+encodeURIComponent(lines.join('\n')));}

  return { init: init, loadData: loadData, fcEditStep: fcEditStep, fcToggleCCP: fcToggleCCP, fcMoveUp: fcMoveUp, fcMoveDown: fcMoveDown, fcAddStep: fcAddStep, fcDelStep: fcDelStep, fcEditLeftNote: fcEditLeftNote, fcEditRightNote: fcEditRightNote, fcEditRework: fcEditRework, fcAddLeftNote: fcAddLeftNote, fcAddRightNote: fcAddRightNote, fcAddRework: fcAddRework, fcDelLeftNote: fcDelLeftNote, fcDelRightNote: fcDelRightNote, fcDelRework: fcDelRework, fcResetDefault: fcResetDefault, fcGenDrawioXml: fcGenDrawioXml };
})();