// HACCP记录管理模块 - 产品描述记录、监控记录、纠偏记录、验证记录
const Records = (() => {
  const STORAGE_KEY = 'haccp_records_data';
  
  function genId() { return 'rec_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7); }
  function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&').replace(/"/g, '"').replace(/</g, '<').replace(/>/g, '>');
  }
  
  // ===== 数据管理 =====
  function getDefaultData() {
    return {
      productDescription: { // 产品描述记录
        records: []
      },
      monitoring: { // 监控记录
        records: []
      },
      corrective: { // 纠偏记录
        records: []
      },
      verification: { // 验证记录
        planModification: [],
        productTesting: [],
        ccpMonitorReview: [],
        ccpCorrectiveReview: [],
        ccpOnsiteVerify: []
      }
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
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
  }
  
  // ===== 从HACCP计划书加载数据 =====
  function loadPlanData() {
    try {
      const raw = localStorage.getItem('haccp_15min_data');
      if (raw) return JSON.parse(raw);
    } catch(e) {}
    return null;
  }
  
  // ===== 数据提取辅助函数 =====
  function getCompanyInfo(planData) {
    return {
      companyName: planData.companyName || '',
      address: '',
      processCategory: '',
      productType: planData.productName || '',
      productName: planData.productName || '',
      ingredients: planData.rawMaterials || '',
      additives: planData.additives || '',
      productCharacteristics: (planData.productPH ? 'PH:' + planData.productPH : '') + (planData.waterActivity ? ' 水分活度:' + planData.waterActivity : ''),
      intendedUse: planData.intendedUse || '',
      targetConsumer: planData.targetConsumer || '',
      consumptionMethod: planData.intendedUse || '',
      packagingType: planData.packagingMethod || '',
      storageCondition: planData.storageCondition || '',
      shelfLife: planData.shelfLife || '',
      labelDescription: '',
      saleTransport: ''
    };
  }
  
  // ==================== 页面渲染 ====================
  function getContainer() {
    return document.getElementById('recordsContainer');
  }
  
  let activeTab = 'productDesc';
  
  const TAB_NAMES = ['产品描述记录', '监控记录', '纠偏记录', '验证活动记录'];
  const TAB_KEYS = ['productDesc', 'monitoring', 'corrective', 'verification'];
  
  function init() {
    const container = getContainer();
    if (!container) return;
    container.innerHTML = `
      <a class="back-link" href="javascript:App.navigateTo('home')">← 返回首页</a>
      <div class="q15-header">
        <h1>📋 HACCP记录管理</h1>
        <p class="q15-desc">AI自动生成记录模板，填写实际运行数据后保存</p>
        <div class="q15-progress" id="recordsTabNav"></div>
      </div>
      <div id="recordsContent"></div>
    `;
    renderTabNav();
    renderActiveTab();
    bindEvents();
  }
  
  function renderTabNav() {
    const nav = document.getElementById('recordsTabNav');
    if (!nav) return;
    nav.innerHTML = TAB_NAMES.map((name, i) => {
      const key = TAB_KEYS[i];
      const isActive = key === activeTab;
      return '<div class="q15-step ' + (isActive ? 'active' : '') + '" data-rec-tab="' + key + '">' +
        '<div class="q15-step-num">' + (i + 1) + '</div><span>' + name + '</span></div>';
    }).join('');
    nav.querySelectorAll('[data-rec-tab]').forEach(el => {
      el.addEventListener('click', () => {
        activeTab = el.dataset.recTab;
        renderTabNav();
        renderActiveTab();
      });
    });
  }
  
  function renderActiveTab() {
    const container = document.getElementById('recordsContent');
    if (!container) return;
    const planData = loadPlanData();
    const recData = loadData();
    
    switch (activeTab) {
      case 'productDesc':
        container.innerHTML = renderProductDesc(planData, recData);
        break;
      case 'monitoring':
        container.innerHTML = renderMonitoringRecords(planData, recData);
        break;
      case 'corrective':
        container.innerHTML = renderCorrectiveRecords(planData, recData);
        break;
      case 'verification':
        container.innerHTML = renderVerificationRecords(planData, recData);
        break;
    }
    bindTabEvents(planData, recData);
  }
  
  // ==================== 产品描述记录 ====================
  function renderProductDesc(planData, recData) {
    if (!planData) return '<div class="empty-state"><div class="empty-icon">📋</div><h3>暂无数据</h3><p>请先创建HACCP计划书</p></div>';
    
    var info = getCompanyInfo(planData);
    // 检查是否有已保存的记录
    var records = recData.productDescription.records || [];
    var lastRecord = records.length > 0 ? records[records.length - 1] : null;
    
    if (lastRecord) {
      info = { ...info, ...lastRecord };
    }
    
    var html = '<div class="results-section"><h2>产品描述记录</h2><p class="q15-table-hint">以下信息已从HACCP计划书中自动提取，请补充完整后保存</p>';
    
    var fields = [
      { key: 'companyName', label: '企业名称', value: info.companyName, readonly: true },
      { key: 'address', label: '企业地址', value: info.address },
      { key: 'processCategory', label: '加工类别', value: info.processCategory },
      { key: 'productType', label: '产品类型', value: info.productType },
      { key: 'productName', label: '产品名称', value: info.productName, readonly: true },
      { key: 'ingredients', label: '产品配料', value: info.ingredients, readonly: true },
      { key: 'additives', label: '添加剂', value: info.additives, readonly: true },
      { key: 'productCharacteristics', label: '产品特性', value: info.productCharacteristics },
      { key: 'intendedUse', label: '预期用途和顾客对象', value: info.intendedUse, readonly: true },
      { key: 'targetConsumer', label: '目标消费者', value: info.targetConsumer, readonly: true },
      { key: 'consumptionMethod', label: '食用(使用)方法', value: info.consumptionMethod },
      { key: 'packagingType', label: '包装类型', value: info.packagingType, readonly: true },
      { key: 'storageCondition', label: '贮存条件和保质期', value: info.storageCondition + ' / ' + (info.shelfLife || ''), readonly: true },
      { key: 'labelDescription', label: '标签说明', value: info.labelDescription },
      { key: 'saleTransport', label: '销售和运输要求', value: info.saleTransport }
    ];
    
    // 表格形式展示
    html += '<div style="overflow-x:auto;"><table class="q15-table"><thead><tr><th style="width:180px;">项目</th><th>内容</th></tr></thead><tbody>';
    fields.forEach(function(f) {
      html += '<tr><td style="font-weight:500;">' + f.label + '</td><td>';
      if (f.readonly) {
        html += '<span class="ri-value">' + esc(f.value || '') + '</span>';
      } else {
        html += '<input type="text" class="pd-input" data-pd-field="' + f.key + '" value="' + esc(f.value || '') + '" style="width:100%;padding:6px 10px;border:1px solid var(--gray-300);border-radius:4px;font-size:13px;">';
      }
      html += '</td></tr>';
    });
    html += '</tbody></table></div>';
    
    // 操作按钮
    html += '<div style="margin-top:16px;display:flex;gap:10px;">';
    html += '<button class="btn btn-primary" id="pdSaveBtn">💾 保存产品描述记录</button>';
    html += '<button class="btn btn-secondary" id="pdPrintBtn">🖨️ 打印</button>';
    html += '</div>';
    
    // 历史记录列表
    if (records.length > 0) {
      html += '<div style="margin-top:20px;"><h3>历史记录</h3>';
      html += '<div style="font-size:12px;color:var(--gray-400);">共 ' + records.length + ' 条记录</div></div>';
    }
    
    html += '</div>';
    return html;
  }
  
  // ==================== 监控记录 ====================
  function renderMonitoringRecords(planData, recData) {
    if (!planData) return '<div class="empty-state"><div class="empty-icon">📋</div><h3>暂无数据</h3><p>请先创建HACCP计划书</p></div>';
    
    var monitoring = planData.monitoring || [];
    var ccpSteps = planData.ccpSteps || [];
    var records = recData.monitoring.records || [];
    
    var html = '<div class="results-section"><h2>📡 监控记录</h2>';
    html += '<p class="q15-table-hint">AI已根据HACCP计划书生成监控记录模板，填写实际测量或观察结果后保存</p>';
    
    // AI生成按钮
    html += '<div style="margin-bottom:16px;"><button class="btn btn-secondary btn-sm" id="monGenBtn">🤖 AI生成监控记录模板</button>';
    html += '<span id="monGenHint" style="font-size:12px;color:var(--gray-400);margin-left:10px;"></span></div>';
    
    if (records.length === 0 && monitoring.length === 0) {
      html += '<div style="padding:20px;text-align:center;color:var(--gray-400);">暂无监控方案数据，请先在HACCP计划书中设置监控程序。</div>';
    }
    
    // 已保存的记录列表
    records.forEach(function(rec, ri) {
      html += '<div class="rec-card" style="margin-bottom:16px;border:1px solid var(--gray-200);border-radius:8px;overflow:hidden;">';
      html += '<div style="background:var(--gray-50);padding:10px 16px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--gray-200);">';
      html += '<span style="font-weight:600;font-size:14px;">记录 #' + (ri + 1) + ' — ' + esc(rec.date || '无日期') + '</span>';
      html += '<button class="btn btn-xs btn-secondary mon-del-btn" data-rec-idx="' + ri + '" style="color:#dc2626;border-color:#fecaca;">🗑️ 删除</button>';
      html += '</div>';
      html += '<div style="padding:12px 16px;">';
      
      // 监控记录表格
      html += '<table class="q15-table"><thead><tr><th>CCP</th><th>监控对象</th><th>方法</th><th>频率</th><th>限值</th><th>实际结果</th><th>监控人员</th><th>日期</th></tr></thead><tbody>';
      (rec.entries || []).forEach(function(entry, ei) {
        html += '<tr><td>' + esc(entry.ccp || '') + '</td>' +
          '<td>' + esc(entry.object || '') + '</td>' +
          '<td>' + esc(entry.method || '') + '</td>' +
          '<td>' + esc(entry.frequency || '') + '</td>' +
          '<td>' + esc(entry.limit || '') + '</td>' +
          '<td><input type="text" class="mon-result" data-rec-idx="' + ri + '" data-entry-idx="' + ei + '" value="' + esc(entry.result || '') + '" style="width:80px;padding:4px 6px;border:1px solid var(--gray-300);border-radius:3px;font-size:12px;"></td>' +
          '<td><input type="text" class="mon-person" data-rec-idx="' + ri + '" data-entry-idx="' + ei + '" value="' + esc(entry.personnel || '') + '" style="width:70px;padding:4px 6px;border:1px solid var(--gray-300);border-radius:3px;font-size:12px;"></td>' +
          '<td><input type="date" class="mon-date" data-rec-idx="' + ri + '" data-entry-idx="' + ei + '" value="' + esc(entry.date || '') + '" style="width:100px;padding:4px 6px;border:1px solid var(--gray-300);border-radius:3px;font-size:12px;"></td>' +
          '</tr>';
      });
      html += '</tbody></table>';
      html += '<div style="margin-top:8px;display:flex;gap:10px;align-items:center;">';
      html += '<input type="text" class="mon-reviewer" data-rec-idx="' + ri + '" value="' + esc(rec.reviewer || '') + '" placeholder="审核人签名" style="padding:6px 10px;border:1px solid var(--gray-300);border-radius:4px;font-size:12px;width:150px;">';
      html += '<input type="date" class="mon-reviewDate" data-rec-idx="' + ri + '" value="' + esc(rec.reviewDate || '') + '" style="padding:6px 10px;border:1px solid var(--gray-300);border-radius:4px;font-size:12px;">';
      html += '<span style="font-size:12px;color:var(--gray-400);">审核签名</span>';
      html += '</div>';
      html += '</div></div>';
    });
    
    // 底部操作
    html += '<div style="display:flex;gap:10px;margin-top:12px;">';
    html += '<button class="btn btn-primary btn-sm" id="monSaveBtn">💾 保存所有监控记录</button>';
    html += '</div>';
    
    html += '</div>';
    return html;
  }
  
  // ==================== 纠偏记录 ====================
  function renderCorrectiveRecords(planData, recData) {
    if (!planData) return '<div class="empty-state"><div class="empty-icon">📋</div><h3>暂无数据</h3><p>请先创建HACCP计划书</p></div>';
    
    var correctiveActions = planData.correctiveActions || [];
    var records = recData.corrective.records || [];
    
    var html = '<div class="results-section"><h2>🛠️ 纠偏记录</h2>';
    html += '<p class="q15-table-hint">AI已根据HACCP计划书生成纠偏记录模板，填写实际偏差和处理结果后保存</p>';
    
    html += '<div style="margin-bottom:16px;"><button class="btn btn-secondary btn-sm" id="corGenBtn">🤖 AI生成纠偏记录模板</button>';
    html += '<span id="corGenHint" style="font-size:12px;color:var(--gray-400);margin-left:10px;"></span></div>';
    
    records.forEach(function(rec, ri) {
      html += '<div class="rec-card" style="margin-bottom:16px;border:1px solid var(--gray-200);border-radius:8px;overflow:hidden;">';
      html += '<div style="background:#fffbeb;padding:10px 16px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #fde68a;">';
      html += '<span style="font-weight:600;font-size:14px;">纠偏 #' + (ri + 1) + ' — ' + esc(rec.date || '无日期') + '</span>';
      html += '<button class="btn btn-xs btn-secondary cor-del-btn" data-rec-idx="' + ri + '" style="color:#dc2626;border-color:#fecaca;">🗑️ 删除</button>';
      html += '</div>';
      html += '<div style="padding:12px 16px;">';
      
      html += '<table class="q15-table"><thead><tr><th style="width:140px;">项目</th><th>内容</th></tr></thead><tbody>';
      var fields = [
        { key: 'ccp', label: 'CCP', val: rec.ccp },
        { key: 'deviation', label: '偏离描述和原因', val: rec.deviation },
        { key: 'corrective', label: '纠偏措施及结果', val: rec.corrective },
        { key: 'batch', label: '受影响产品批次/隔离位置', val: rec.batch },
        { key: 'evaluation', label: '评估方法和结果', val: rec.evaluation },
        { key: 'disposition', label: '最终处置', val: rec.disposition },
        { key: 'personnel', label: '纠偏人员签名', val: rec.personnel, inputType: 'text' },
        { key: 'reviewer', label: '审核签名', val: rec.reviewer, inputType: 'text' }
      ];
      fields.forEach(function(f) {
        html += '<tr><td style="font-weight:500;">' + f.label + '</td><td>';
        if (f.inputType === 'text' || f.key === 'personnel' || f.key === 'reviewer') {
          html += '<input type="text" class="cor-input" data-rec-idx="' + ri + '" data-field="' + f.key + '" value="' + esc(f.val || '') + '" style="width:100%;padding:6px 10px;border:1px solid var(--gray-300);border-radius:4px;font-size:13px;">';
        } else {
          html += '<textarea class="cor-input" data-rec-idx="' + ri + '" data-field="' + f.key + '" rows="2" style="width:100%;padding:6px 10px;border:1px solid var(--gray-300);border-radius:4px;font-size:13px;font-family:inherit;">' + esc(f.val || '') + '</textarea>';
        }
        html += '</td></tr>';
      });
      html += '<tr><td>纠偏日期</td><td><input type="date" class="cor-input" data-rec-idx="' + ri + '" data-field="date" value="' + esc(rec.date || '') + '" style="padding:6px 10px;border:1px solid var(--gray-300);border-radius:4px;font-size:13px;"></td></tr>';
      html += '</tbody></table>';
      html += '</div></div>';
    });
    
    html += '<div style="display:flex;gap:10px;margin-top:12px;">';
    html += '<button class="btn btn-primary btn-sm" id="corSaveBtn">💾 保存所有纠偏记录</button>';
    html += '</div>';
    
    html += '</div>';
    return html;
  }
  
  // ==================== 验证活动记录 ====================
  function renderVerificationRecords(planData, recData) {
    if (!planData) return '<div class="empty-state"><div class="empty-icon">📋</div><h3>暂无数据</h3><p>请先创建HACCP计划书</p></div>';
    
    var verData = recData.verification;
    var html = '<div class="results-section"><h2>✅ 验证活动记录</h2>';
    html += '<p class="q15-table-hint">记录HACCP计划的验证活动，包括计划修改、检测、审核和现场验证</p>';
    
    // 子标签导航
    var subTabs = [
      { id: 'planModification', label: '计划修改记录' },
      { id: 'productTesting', label: '半成品成品检测' },
      { id: 'ccpMonitorReview', label: 'CCP监控审核' },
      { id: 'ccpCorrectiveReview', label: 'CCP纠偏审核' },
      { id: 'ccpOnsiteVerify', label: 'CCP现场验证' }
    ];
    
    html += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;" id="verSubNav">';
    subTabs.forEach(function(st) {
      html += '<button class="btn btn-sm ' + (st.id === '_verSubActive' ? 'btn-primary' : 'btn-secondary') + ' ver-sub-btn" data-ver-sub="' + st.id + '">' + st.label + '</button>';
    });
    html += '</div>';
    
    // 默认展示第一个tab
    var subActive = '_verSubActive' in window ? window._verSubActive : 'planModification';
    var items = verData[subActive] || [];
    
    html += '<div id="verSubContent">';
    html += renderVerSubTable(subActive, items);
    html += '</div>';
    
    html += '<div style="display:flex;gap:10px;margin-top:12px;">';
    html += '<button class="btn btn-primary btn-sm" id="verSaveBtn">💾 保存验证记录</button>';
    html += '<button class="btn btn-secondary btn-sm" id="verAddBtn">+ 添加记录</button>';
    html += '</div>';
    
    html += '</div>';
    return html;
  }
  
  function renderVerSubTable(tabKey, items) {
    var titles = {
      planModification: { label: 'HACCP计划修改记录', headers: ['修改日期', '修改内容', '修改原因', '修改人', '批准人'] },
      productTesting: { label: '半成品成品定期检测记录', headers: ['检测日期', '产品名称', '检测项目', '检测结果', '检测人', '判定'] },
      ccpMonitorReview: { label: 'CCP监控审核记录', headers: ['审核日期', 'CCP名称', '审核内容', '审核结果', '审核人', '备注'] },
      ccpCorrectiveReview: { label: 'CCP纠偏审核记录', headers: ['审核日期', 'CCP名称', '纠偏情况', '审核结论', '审核人', '备注'] },
      ccpOnsiteVerify: { label: 'CCP现场验证记录', headers: ['验证日期', 'CCP名称', '验证内容', '验证结果', '验证人', '备注'] }
    };
    var t = titles[tabKey] || titles.planModification;
    
    var html = '<h3 style="margin:12px 0 8px;">' + t.label + '</h3>';
    html += '<table class="q15-table"><thead><tr>';
    t.headers.forEach(function(h) {
      html += '<th>' + h + '</th>';
    });
    html += '<th style="width:50px;">操作</th></tr></thead><tbody id="verSubBody">';
    
    items.forEach(function(item, i) {
      html += '<tr data-ver-idx="' + i + '" data-ver-tab="' + tabKey + '">';
      t.headers.forEach(function(h, hi) {
        var fieldKey = 'col' + hi;
        html += '<td><input type="text" class="ver-input" data-ver-tab="' + tabKey + '" data-ver-idx="' + i + '" data-field="' + fieldKey + '" value="' + esc(item[fieldKey] || '') + '" style="width:100%;padding:4px 6px;border:1px solid var(--gray-300);border-radius:3px;font-size:12px;"></td>';
      });
      html += '<td><button class="btn btn-xs btn-secondary ver-del-row" data-ver-tab="' + tabKey + '" data-ver-idx="' + i + '" style="color:#dc2626;border-color:#fecaca;">✕</button></td>';
      html += '</tr>';
    });
    
    if (items.length === 0) {
      html += '<tr><td colspan="' + (t.headers.length + 1) + '" style="text-align:center;color:var(--gray-400);padding:20px;">暂无记录，点击"+ 添加记录"按钮添加</td></tr>';
    }
    
    html += '</tbody></table>';
    return html;
  }
  
  // ==================== AI生成函数 ====================
  function aiGenerateMonitoring(planData) {
    var monitoring = planData.monitoring || [];
    var ccpSteps = planData.ccpSteps || [];
    var processSteps = planData.processSteps || [];
    
    if (monitoring.length === 0) return [];
    
    // 获取关键限值信息
    var criticalLimitsData = planData.criticalLimitsData || [];
    
    var entries = monitoring.map(function(m) {
      var clInfo = '';
      var clData = criticalLimitsData.find(function(c) { return c.stepName === m.ccp; });
      if (clData && clData.limits && clData.limits.length > 0) {
        clInfo = clData.limits.map(function(l) { return l.param + l.value + l.unit; }).join(', ');
      }
      return {
        ccp: m.ccp || '',
        object: m.object || '',
        method: m.method || '',
        frequency: m.frequency || '',
        limit: clInfo || '',
        result: '',
        personnel: '',
        date: ''
      };
    });
    
    var today = new Date().toISOString().slice(0, 10);
    return [{
      id: genId(),
      entries: entries,
      date: today,
      reviewer: '',
      reviewDate: ''
    }];
  }
  
  function aiGenerateCorrective(planData) {
    var correctiveActions = planData.correctiveActions || [];
    if (correctiveActions.length === 0) return [];
    
    var today = new Date().toISOString().slice(0, 10);
    return correctiveActions.map(function(c) {
      return {
        id: genId(),
        ccp: c.ccp || '',
        deviation: '',
        corrective: c.corrective || '',
        batch: '',
        evaluation: '',
        disposition: '',
        personnel: '',
        reviewer: '',
        date: today
      };
    });
  }
  
  // ==================== 事件绑定 ====================
  function bindEvents() {
    document.getElementById('recordsTabNav')?.addEventListener('click', function(e) {
      var tabEl = e.target.closest('[data-rec-tab]');
      if (tabEl) {
        activeTab = tabEl.dataset.recTab;
        renderTabNav();
        renderActiveTab();
      }
    });
  }
  
  function bindTabEvents(planData, recData) {
    // 产品描述记录 - 保存
    var pdSaveBtn = document.getElementById('pdSaveBtn');
    if (pdSaveBtn) {
      pdSaveBtn.addEventListener('click', function() {
        var recData = loadData();
        var inputs = document.querySelectorAll('.pd-input');
        var record = { id: genId(), createdAt: new Date().toISOString() };
        inputs.forEach(function(inp) {
          record[inp.dataset.pdField] = inp.value;
        });
        // 补充只读字段
        var readonlyRows = document.querySelectorAll('.results-section table tbody tr');
        var fieldLabels = ['companyName', 'address', 'processCategory', 'productType', 'productName', 'ingredients', 'additives', 'productCharacteristics', 'intendedUse', 'targetConsumer', 'consumptionMethod', 'packagingType', 'storageCondition', 'labelDescription', 'saleTransport'];
        readonlyRows.forEach(function(row, idx) {
          var cells = row.querySelectorAll('td');
          if (cells.length >= 2 && idx < fieldLabels.length) {
            var key = fieldLabels[idx];
            var valEl = cells[1].querySelector('.ri-value') || cells[1].querySelector('input');
            if (valEl) {
              record[key] = valEl.value || valEl.textContent || '';
            }
          }
        });
        // 合并到已有记录
        if (!recData.productDescription) recData.productDescription = { records: [] };
        recData.productDescription.records.push(record);
        saveData(recData);
        alert('✅ 产品描述记录已保存！');
      });
    }
    
    // 产品描述 - 打印
    document.getElementById('pdPrintBtn')?.addEventListener('click', function() {
      window.print();
    });
    
    // 监控记录 - AI生成
    document.getElementById('monGenBtn')?.addEventListener('click', function() {
      var hint = document.getElementById('monGenHint');
      if (hint) hint.textContent = '⏳ 正在生成...';
      
      var planData = loadPlanData();
      if (!planData) { alert('请先创建HACCP计划书'); return; }
      
      var newRecords = aiGenerateMonitoring(planData);
      if (newRecords.length === 0) {
        if (hint) hint.textContent = '⚠️ 暂无监控方案数据';
        return;
      }
      
      var recData = loadData();
      recData.monitoring.records = recData.monitoring.records.concat(newRecords);
      saveData(recData);
      
      if (hint) hint.textContent = '✅ 已生成 ' + newRecords.length + ' 条监控记录模板';
      renderActiveTab();
    });
    
    // 监控记录 - 保存（收集输入框数据）
    document.getElementById('monSaveBtn')?.addEventListener('click', function() {
      var recData = loadData();
      var records = recData.monitoring.records || [];
      
      // 收集结果、人员、日期
      document.querySelectorAll('.mon-result').forEach(function(inp) {
        var ri = parseInt(inp.dataset.recIdx);
        var ei = parseInt(inp.dataset.entryIdx);
        if (records[ri] && records[ri].entries[ei]) {
          records[ri].entries[ei].result = inp.value;
        }
      });
      document.querySelectorAll('.mon-person').forEach(function(inp) {
        var ri = parseInt(inp.dataset.recIdx);
        var ei = parseInt(inp.dataset.entryIdx);
        if (records[ri] && records[ri].entries[ei]) {
          records[ri].entries[ei].personnel = inp.value;
        }
      });
      document.querySelectorAll('.mon-date').forEach(function(inp) {
        var ri = parseInt(inp.dataset.recIdx);
        var ei = parseInt(inp.dataset.entryIdx);
        if (records[ri] && records[ri].entries[ei]) {
          records[ri].entries[ei].date = inp.value;
        }
      });
      document.querySelectorAll('.mon-reviewer').forEach(function(inp) {
        var ri = parseInt(inp.dataset.recIdx);
        if (records[ri]) records[ri].reviewer = inp.value;
      });
      document.querySelectorAll('.mon-reviewDate').forEach(function(inp) {
        var ri = parseInt(inp.dataset.recIdx);
        if (records[ri]) records[ri].reviewDate = inp.value;
      });
      
      recData.monitoring.records = records;
      saveData(recData);
      alert('✅ 监控记录已保存！');
    });
    
    // 监控记录 - 删除
    document.querySelectorAll('.mon-del-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var ri = parseInt(this.dataset.recIdx);
        if (!confirm('确定要删除这条监控记录吗？')) return;
        var recData = loadData();
        recData.monitoring.records.splice(ri, 1);
        saveData(recData);
        renderActiveTab();
      });
    });
    
    // 纠偏记录 - AI生成
    document.getElementById('corGenBtn')?.addEventListener('click', function() {
      var hint = document.getElementById('corGenHint');
      if (hint) hint.textContent = '⏳ 正在生成...';
      
      var planData = loadPlanData();
      if (!planData) { alert('请先创建HACCP计划书'); return; }
      
      var newRecords = aiGenerateCorrective(planData);
      if (newRecords.length === 0) {
        if (hint) hint.textContent = '⚠️ 暂无纠偏方案数据';
        return;
      }
      
      var recData = loadData();
      recData.corrective.records = recData.corrective.records.concat(newRecords);
      saveData(recData);
      
      if (hint) hint.textContent = '✅ 已生成 ' + newRecords.length + ' 条纠偏记录模板';
      renderActiveTab();
    });
    
    // 纠偏记录 - 保存
    document.getElementById('corSaveBtn')?.addEventListener('click', function() {
      var recData = loadData();
      var records = recData.corrective.records || [];
      
      document.querySelectorAll('.cor-input').forEach(function(inp) {
        var ri = parseInt(inp.dataset.recIdx);
        var field = inp.dataset.field;
        if (records[ri] && field) {
          records[ri][field] = inp.value;
        }
      });
      
      recData.corrective.records = records;
      saveData(recData);
      alert('✅ 纠偏记录已保存！');
    });
    
    // 纠偏记录 - 删除
    document.querySelectorAll('.cor-del-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var ri = parseInt(this.dataset.recIdx);
        if (!confirm('确定要删除这条纠偏记录吗？')) return;
        var recData = loadData();
        recData.corrective.records.splice(ri, 1);
        saveData(recData);
        renderActiveTab();
      });
    });
    
    // 验证记录 - 子标签切换
    document.querySelectorAll('.ver-sub-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        window._verSubActive = this.dataset.verSub;
        renderActiveTab();
      });
    });
    
    // 验证记录 - 添加
    document.getElementById('verAddBtn')?.addEventListener('click', function() {
      var subActive = window._verSubActive || 'planModification';
      var recData = loadData();
      if (!recData.verification[subActive]) recData.verification[subActive] = [];
      
      var newItem = { col0: '', col1: '', col2: '', col3: '', col4: '', col5: '' };
      recData.verification[subActive].push(newItem);
      saveData(recData);
      renderActiveTab();
    });
    
    // 验证记录 - 保存
    document.getElementById('verSaveBtn')?.addEventListener('click', function() {
      var recData = loadData();
      document.querySelectorAll('.ver-input').forEach(function(inp) {
        var tabKey = inp.dataset.verTab;
        var idx = parseInt(inp.dataset.verIdx);
        var field = inp.dataset.field;
        if (recData.verification[tabKey] && recData.verification[tabKey][idx]) {
          recData.verification[tabKey][idx][field] = inp.value;
        }
      });
      saveData(recData);
      alert('✅ 验证记录已保存！');
    });
    
    // 验证记录 - 删除行
    document.querySelectorAll('.ver-del-row').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var tabKey = this.dataset.verTab;
        var idx = parseInt(this.dataset.verIdx);
        var recData = loadData();
        if (recData.verification[tabKey]) {
          recData.verification[tabKey].splice(idx, 1);
          saveData(recData);
          renderActiveTab();
        }
      });
    });
  }
  
  return { init: init, loadData: loadData };
})();