// 15-min快速问卷模块 - 分步导航式
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
        '<h1>15-min快速问卷</h1>' +
        '<p class="q15-desc">快速填写产品信息，在15分钟内完成快速问卷</p>' +
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
          : '<button class="btn btn-primary btn-lg" id="profileSaveBtn">💾 保存问卷</button>') +
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
          btn.textContent = '💾 保存问卷';
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

  // ===== 流程图预览（在步骤4和步骤5中使用）=====
  function renderFlowchartPreview(data) {
    if (data.flowchartSvg) {
      return '<div class="q15-flowchart-preview" style="text-align:center;">' +
        '<img src="' + esc(data.flowchartSvg) + '" style="max-width:100%;max-height:600px;border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.08);">' +
        '<p style="font-size:12px;color:var(--gray-400);margin-top:8px;">✅ 流程图已保存</p></div>';
    }
    return '<div class="q15-flowchart-empty"><div class="q15-flowchart-empty-icon">📊</div><p>暂未编辑流程图</p><p style="font-size:12px;color:var(--gray-400);margin-top:8px;">点击上方按钮打开流程图编辑器</p></div>';
  }

  // ===== 从 localStorage 同步流程图数据 =====
  function syncStepsFromFlowchart(data) {
    var steps = [];
    var ccp = [];
    var svg = '';
    try {
      var stepsRaw = localStorage.getItem('steps');
      if (stepsRaw) steps = JSON.parse(stepsRaw);
      var ccpRaw = localStorage.getItem('ccp');
      if (ccpRaw) ccp = JSON.parse(ccpRaw);
      svg = localStorage.getItem('haccp_drawio_svg') || '';
    } catch(e) {}

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
            '<button id="pfFcSaveBackBtn" style="background:#2563eb;color:#fff;border:none;border-radius:6px;padding:6px 16px;cursor:pointer;font-size:13px;">💾 保存并返回</button>' +
            '<button id="pfFcCloseBtn" style="background:rgba(255,255,255,.15);color:#fff;border:none;border-radius:6px;padding:6px 14px;cursor:pointer;font-size:13px;">← 返回</button>' +
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
        if (statusEl) statusEl.textContent = '⏳ 同步数据...';
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
      } catch(e) {}
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
      '<p class="q15-table-hint">点击下方按钮打开流程图编辑器，编辑步骤名称、切换CCP标识、添加入/输出箭头和返工箭头。保存后将自动同步到问卷。</p>' +
      '<div style="text-align:center;margin:20px 0;">' +
        '<button class="btn btn-primary" id="pfOpenFlowchartEditorBtn" style="font-size:15px;padding:12px 28px;">' +
          '📊 打开流程图编辑器' +
        '</button>' +
      '</div>' +
      '<div id="pfFlowchartPreviewArea">' +
        renderFlowchartPreview(data) +
      '</div>';
  }

  // ===== 步骤5：流程图的确认（显示SVG预览 + 确认框）=====
  function renderFlowchartConfirm(data) {
    var previewHtml = data.flowchartSvg
      ? '<div style="text-align:center;"><img src="' + esc(data.flowchartSvg) + '" style="max-width:100%;max-height:500px;border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.08);margin-top:12px;"><p style="font-size:12px;color:var(--gray-400);margin-top:8px;">✅ 流程图已保存</p></div>'
      : '<div class="q15-flowchart-empty"><div class="q15-flowchart-empty-icon">🗺️</div><p>暂未绘制流程图，请先在步骤4中编辑</p></div>';
    return '<div class="q15-confirm-box"><label class="q15-checkbox-label"><input type="checkbox" data-pf-field="flowConfirmed"' + (data.flowConfirmed ? ' checked' : '') + '> HACCP小组已到生产现场，对以上流程图的每一步进行核对确认，确保与实际操作完全一致</label><p style="font-size:12px;color:var(--gray-400);margin-top:6px;">（确认内容包括：是否有额外的原料添加、步骤合并等）</p>' +
      '<div class="q15-field-group" style="margin-top:16px;"><label>确认时间 <span class="required">*</span></label><input type="date" data-pf-field="flowchartConfirmDate" value="' + esc(data.flowchartConfirmDate || '') + '"></div></div>' +
      '<div class="q15-flowchart-area" style="margin-top:24px;"><h3>流程图预览</h3>' + previewHtml + '</div>';
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