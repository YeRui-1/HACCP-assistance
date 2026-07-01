// 结果展示：自动调用 AI 生成报告 + 用户答案 + HACCP 计划章节
const Results = (() => {
  let activeSection = 'aiReport';

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

  async function init() {
    await syncTemplateFromBackend();
    renderSidebar();
    renderContent();
    setupScrollSpy();
    fetchAiReport();
  }

  // ===== 15min 侧边栏 =====
  function render15minSidebar(nav) {
    const lang = I18n.getLang();
    const items = [
      { key: 'aiReport', label: I18n.t('r15.aiReport') },
      { key: 'q15-company', label: I18n.t('r15.section1') },
      { key: 'q15-product', label: I18n.t('r15.section2') },
      { key: 'q15-process', label: I18n.t('r15.section3') },
      { key: 'q15-ccp', label: I18n.t('result.ccp.title') },
      { key: 'q15-hazard', label: I18n.t('r15.section4') },
      { key: 'q15-limits', label: I18n.t('r15.section5') },
      { key: 'q15-verification', label: I18n.t('r15.section6') },
      { key: 'q15-records', label: I18n.t('r15.section7') },
    ];

    // 导出按钮
    var exportLabel = lang === 'en' ? '📄 Export Word' : '📄 导出Word';
    nav.innerHTML = '<div style="padding:0 0 12px 0;text-align:center;"><button id="btnExportWord" style="width:100%;padding:9px 14px;background:linear-gradient(135deg,#1e40af,#1d4ed8);color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">' + exportLabel + '</button></div>';
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
    // 绑定导出按钮
    var exportBtn = document.getElementById('btnExportWord');
    if (exportBtn) exportBtn.addEventListener('click', exportToWord);
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

    var exportLabel2 = lang === 'en' ? '📄 Export Word' : '📄 导出Word';
    nav.innerHTML = '<div style="padding:0 0 12px 0;text-align:center;"><button id="btnExportWord" style="width:100%;padding:9px 14px;background:linear-gradient(135deg,#1e40af,#1d4ed8);color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">' + exportLabel2 + '</button></div>';
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
    // 绑定导出按钮
    var exportBtn = document.getElementById('btnExportWord');
    if (exportBtn) exportBtn.addEventListener('click', exportToWord);
  }

  // ===== 15min结果展示 =====
  function render15minContent(container, data, lang) {
    const emptyLabel = I18n.t('common.empty');
    const fieldValue = (val) => val ? esc(val) : '<span style="color:var(--gray-400);font-style:italic;">' + emptyLabel + '</span>';
    const boolYes = (val) => val ? '\u2713 是' : '\u2717 否';

    let html = '<a class="back-link" href="javascript:App.navigateTo(\'home\')">\u2190 ' + I18n.t('nav.back') + '</a>';

    // AI 报告
    html += `
      <div class="results-section" id="section-aiReport">
        <h2>AI 分析报告</h2>
        <div id="aiReportBody">
          <div class="report-loading">
            <span class="spinner" style="width:20px;height:20px;border-color:rgba(37,99,235,0.2);border-top-color:#2563eb;"></span>
            <span>${lang === 'en' ? 'Generating AI report...' : I18n.t('r15.generating')}</span>
          </div>
        </div>
      </div>
    `;

    // 如果生产步骤有数据，展示可视化流程图（使用独立ID避免重复）
    const steps = data.processSteps || [];
    if (steps.some(s => s.stepName && s.stepName.trim())) {
      var fcHtml = '<div class="fc-mermaid-wrapper" style="margin-bottom:24px;padding:16px;background:#fafafa;border:1px solid #e5e7eb;border-radius:10px;overflow-x:auto;">';
      fcHtml += '<div class="mermaid" style="min-height:100px;"></div>';
      fcHtml += '</div>';
      html += '<div class="results-section" id="section-q15-flowchart"><h2>生产流程图</h2>' + fcHtml + render15minFlowchart(steps) + '</div>';
    }

    // 一、企业信息
    html += '<div class="results-section" id="section-q15-company"><h2>一、企业信息</h2>' +
      '<div class="result-item"><span class="ri-label">企业名称</span><span class="ri-value">' + fieldValue(data.companyName) + '</span></div>' +
      '<div class="result-item"><span class="ri-label">制定部门</span><span class="ri-value">' + fieldValue(data.deptName) + '</span></div>' +
      '<div class="result-item"><span class="ri-label">审核人员</span><span class="ri-value">' + fieldValue(data.auditor) + '</span></div>';
    // 其他项目 - 以内联形式展示（放在审核人员下方，HACCP小组成员上方）
    if (data.extraItems && data.extraItems.length > 0) {
      data.extraItems.filter(function(e) { return e.key || e.value; }).forEach(function(e) {
        html += '<div class="result-item"><span class="ri-label">' + fieldValue(e.key) + '</span><span class="ri-value">' + fieldValue(e.value) + '</span></div>';
      });
    }
    html += '<h3>HACCP小组成员</h3>' +
      '<table><thead><tr><th>姓名</th><th>部门</th><th>职位</th><th>职责</th><th>备注</th></tr></thead><tbody>' +
      (data.haccpTeam || []).map(function(m) { return '<tr><td>' + fieldValue(m.name) + '</td><td>' + fieldValue(m.dept) + '</td><td>' + fieldValue(m.position) + '</td><td>' + fieldValue(m.role) + '</td><td>' + fieldValue(m.remark) + '</td></tr>'; }).join('') +
      '</tbody></table></div>';

    // 二、产品信息
    html += '<div class="results-section" id="section-q15-product"><h2>二、产品信息</h2>' +
      '<div class="result-item"><span class="ri-label">产品名称</span><span class="ri-value">' + fieldValue(data.productName) + '</span></div>' +
      '<div class="result-item"><span class="ri-label">主要原料</span><span class="ri-value">' + fieldValue(data.rawMaterials) + '</span></div>' +
      '<div class="result-item"><span class="ri-label">添加剂</span><span class="ri-value">' + fieldValue(data.additives) + '</span></div>' +
      '<div class="result-item"><span class="ri-label">产品PH</span><span class="ri-value">' + fieldValue(data.productPH) + '</span></div>' +
      '<div class="result-item"><span class="ri-label">水分活度</span><span class="ri-value">' + fieldValue(data.waterActivity) + '</span></div>' +
      '<div class="result-item"><span class="ri-label">预期用途</span><span class="ri-value">' + fieldValue(data.intendedUse) + '</span></div>' +
      '<div class="result-item"><span class="ri-label">储存条件</span><span class="ri-value">' + fieldValue(data.storageCondition) + '</span></div>' +
      '<div class="result-item"><span class="ri-label">包装方式</span><span class="ri-value">' + fieldValue(data.packagingMethod) + '</span></div>' +
      '<div class="result-item"><span class="ri-label">目标消费者</span><span class="ri-value">' + fieldValue(data.targetConsumer) + '</span></div>' +
      '<div class="result-item"><span class="ri-label">保质期</span><span class="ri-value">' + fieldValue(data.shelfLife) + '</span></div>';
    // 其他项目（产品信息中手动添加的补充信息）
    if (data.productExtraItems && data.productExtraItems.length > 0) {
      data.productExtraItems.filter(function(e) { return e.key || e.value; }).forEach(function(e) {
        html += '<div class="result-item"><span class="ri-label">' + fieldValue(e.key) + '</span><span class="ri-value">' + fieldValue(e.value) + '</span></div>';
      });
    }
    html += '</div>';

    // 三、生产流程
    html += '<div class="results-section" id="section-q15-process"><h2>三、生产流程</h2>' +
      '<h3>配方</h3>' +
      '<table><thead><tr><th>原料/辅料/添加剂</th><th>精确用量</th><th>关键作用</th></tr></thead><tbody>' +
      (data.formula || []).map(function(f) { return '<tr><td>' + fieldValue(f.material) + '</td><td>' + fieldValue(f.dosage) + '</td><td>' + fieldValue(f.func) + '</td></tr>'; }).join('') +
      '</tbody></table>' +
      '<h3>操作步骤</h3>';
    (data.processSteps || []).forEach(function(s, i) {
      html += '<div class="fc-step-card fc-result"><div class="fc-step-header"><span class="fc-step-num">' + (i + 1) + '</span><strong>' + fieldValue(s.stepName) + '</strong></div>' +
        '<table class="fc-result-params"><tbody>' +
        '<tr><th>操作方法</th><td>' + fieldValue(s.operationMethod) + '</td></tr>' +
        '<tr><th>工艺参数</th><td>' + fieldValue(s.parameters) + '</td></tr>' +
        '<tr><th>控制点</th><td>' + fieldValue(s.controlPoint) + '</td></tr>' +
        '<tr><th>设备名称</th><td>' + fieldValue(s.equipmentName) + '</td></tr>' +
        '</tbody></table></div>';
    });
    html += '<div class="result-item"><span class="ri-label">流程图现场确认</span><span class="ri-value">' + boolYes(data.flowConfirmed) + '</span></div></div>';

    // 3.5 - CCP判定结果
    if (data.ccpSteps && data.ccpSteps.length > 0) {
      html += '<div class="results-section" id="section-q15-ccp"><h2>' + I18n.t('result.ccp.title') + '</h2>';
      html += '<p style="font-size:13px;color:var(--gray-400);margin-bottom:12px;">' + I18n.t('result.ccp.desc') + '</p>';
      html += '<div style="overflow-x:auto;"><table style="min-width:900px;"><thead><tr>';
      html += '<th>' + I18n.t('ccp.summary.step') + '</th><th>' + I18n.t('result.ccp.colHazardType') + '</th><th>' + I18n.t('result.ccp.colHazardDesc') + '</th>';
      html += '<th>Q1</th><th>Q2</th><th>Q3</th><th>Q4</th><th>Q5</th>';
      html += '<th>' + I18n.t('result.ccp.colResult') + '</th><th>' + I18n.t('result.ccp.colReasoning') + '</th>';
      html += '</tr></thead><tbody>';
      var hazardTypes = ['bio', 'chem', 'phys'];
      var hazardTypeNames = { bio: I18n.t('result.ccp.bio'), chem: I18n.t('result.ccp.chem'), phys: I18n.t('result.ccp.phys') };
      data.ccpSteps.forEach(function(s, si) {
        if (!s.hazards) return;
        hazardTypes.forEach(function(ht, hi) {
          var h = s.hazards[ht] || {};
          var isCCP = h.isCCP;
          var resultText = '';
          var resultColor = '';
          if (isCCP === true) { resultText = I18n.t('ccp.result.ccp'); resultColor = '#dc2626'; }
          else if (isCCP === false) { resultText = I18n.t('ccp.result.nonCcp'); resultColor = '#16a34a'; }
          else if (isCCP === 'modify') { resultText = I18n.t('ccp.result.modify'); resultColor = '#d97706'; }
          else { resultText = I18n.t('ccp.result.undetermined'); resultColor = '#6b7280'; }
          var reasoningHtml = '';
          if (h.aiReasoning) {
            reasoningHtml = '<span style="font-size:11px;color:#6b7280;" title="' + esc(h.aiReasoning) + '">' + esc(h.aiReasoning.substring(0, 60) + (h.aiReasoning.length > 60 ? '...' : '')) + '</span>';
            if (h.aiOverridden) reasoningHtml += ' <span style="color:#d97706;font-size:9px;font-weight:500;">' + I18n.t('ccp.userModified') + '</span>';
            else reasoningHtml += ' <span style="color:#7c3aed;font-size:9px;">' + I18n.t('ccp.aiLabel') + '</span>';
          }
          html += '<tr>';
          if (hi === 0) html += '<td rowspan="3" style="vertical-align:middle;font-weight:500;">' + esc(s.stepName || '步骤' + (si+1)) + '</td>';
          html += '<td style="white-space:nowrap;">' + hazardTypeNames[ht] + '</td>';
          html += '<td style="font-size:12px;">' + esc(h.hazardDesc || '') + '</td>';
          html += '<td style="text-align:center;">' + (h.q1 || '—') + '</td>';
          html += '<td style="text-align:center;">' + (h.q2 || '—') + '</td>';
          html += '<td style="text-align:center;">' + (h.q3 || '—') + '</td>';
          html += '<td style="text-align:center;">' + (h.q4 || '—') + '</td>';
          html += '<td style="text-align:center;">' + (h.q5 || '—') + '</td>';
          html += '<td style="color:' + resultColor + ';font-weight:bold;text-align:center;">' + resultText + '</td>';
          html += '<td>' + reasoningHtml + '</td>';
          html += '</tr>';
        });
      });
      html += '</tbody></table></div></div>';
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
    html += '<div class="results-section" id="section-q15-limits"><h2>五、关键限制</h2>' +
      '<div class="result-item"><span class="ri-label">执行标准</span><span class="ri-value">' + (stdLabels[data.execStandard] || fieldValue(data.execStandard)) + '</span></div>' +
      '<div class="result-item"><span class="ri-label">关键限制说明</span><span class="ri-value">' + fieldValue(data.criticalLimits) + '</span></div></div>';

    // 六、验证程序
    html += '<div class="results-section" id="section-q15-verification"><h2>六、验证程序</h2>' +
      '<h3>监控程序设置</h3>' +
      '<table><thead><tr><th>CCP</th><th>监控对象</th><th>监控方法</th><th>监控频率</th><th>监控人员</th><th>备注</th></tr></thead><tbody>' +
      (data.monitoring || []).map(function(m) { return '<tr><td>' + fieldValue(m.ccp) + '</td><td>' + fieldValue(m.object) + '</td><td>' + fieldValue(m.method) + '</td><td>' + fieldValue(m.frequency) + '</td><td>' + fieldValue(m.personnel) + '</td><td>' + fieldValue(m.remark) + '</td></tr>'; }).join('') +
      '</tbody></table>' +
      '<h3>纠偏措施</h3>' +
      '<table><thead><tr><th>CCP</th><th>关键限值(CL)</th><th>纠偏措施</th><th>验证</th><th>记录</th></tr></thead><tbody>' +
      (data.correctiveActions || []).map(function(c) { return '<tr><td>' + fieldValue(c.ccp) + '</td><td>' + fieldValue(c.cl) + '</td><td>' + fieldValue(c.corrective) + '</td><td>' + fieldValue(c.verification) + '</td><td>' + fieldValue(c.record) + '</td></tr>'; }).join('') +
      '</tbody></table></div>';

    // 七、记录
    html += '<div class="results-section" id="section-q15-records"><h2>七、记录与报表</h2>' +
      '<div class="result-item"><span class="ri-label">记录保存期限</span><span class="ri-value">' + fieldValue(data.recordPeriod) + '</span></div>' +
      '<div class="result-item"><span class="ri-label">记录格式要求</span><span class="ri-value">' + fieldValue(data.recordFormat) + '</span></div></div>';

    container.innerHTML = html;

    // 15min 模式：用 Mermaid 渲染生产步骤流程图（若可用）
    var mermaidDiv = container.querySelector('#section-q15-flowchart .mermaid');
    if (mermaidDiv && typeof mermaid !== 'undefined') {
      var src15 = build15minMermaidSource(steps);
      if (src15) {
        mermaidDiv.textContent = src15;
        mermaid.initialize({ startOnLoad: false, theme: 'default', flowchart: { useMaxWidth: true, htmlLabels: true } });
        setTimeout(function() { mermaid.run({ nodes: [mermaidDiv] }).catch(function(){}); }, 100);
      }
    }
  }


  // ===== 主内容 =====
  function renderContent() {
    const container = getEl('resultsContent');
    const submitted = localStorage.getItem('haccp_submitted');
    const lang = I18n.getLang();

    // 检查是否有15min问卷提交数据
    const q15Data = load15minData();

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

    // AI 报告区域（初始加载中）
    const aiTitle = lang === 'en' ? 'AI Analysis Report' : 'AI \u5206\u6790\u62a5\u544a';
    let html = '<a class="back-link" href="javascript:App.navigateTo(\'home\')">\u2190 ' + I18n.t('nav.back') + '</a>';

    html += [
      '<div class="results-section" id="section-aiReport">',
      '  <h2>' + aiTitle + '</h2>',
      '  <div id="aiReportBody">',
      '    <div class="report-loading">',
      '      <span class="spinner" style="width:20px;height:20px;border-color:rgba(37,99,235,0.2);border-top-color:#2563eb;"></span>',
      '      <span>' + (lang === 'en' ? 'Generating AI report...' : '\u6b63\u5728\u751f\u6210 AI \u62a5\u544a...') + '</span>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('');

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
      overview: '以下为您在问卷中提交的产品与工艺信息：',
      noAnswer: '未填写',
      sectionLabel: '章节',
      questionLabel: '题目',
      answerLabel: '您填写的内容',
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
    var zh = { title: '以下为在 draw.io 编辑器中绘制并保存的生产流程图：', noData: '暂无流程图。请先在「生产流程图」步骤中用 draw.io 编辑并保存。', hint: '📌 如需修改，请返回流程图编辑页面，按 Ctrl+S 保存后重新查看报告。' };
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
      return '<p style="color:var(--gray-400);font-style:italic;text-align:center;padding:20px;">暂无生产流程步骤数据</p>';
    }
    const validSteps = steps.filter(function(s) { return s.stepName && s.stepName.trim(); });
    
    var html = '<div class="q15-visual-flowchart">';
    
    // 开始节点
    html += '<div class="q15-vf-node start-end">' +
      '<div class="q15-vf-node-shape start">开始</div>' +
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
        (step.operationMethod ? '<p class="q15-vf-detail">方法：' + esc(step.operationMethod) + '</p>' : '') +
        (step.parameters ? '<p class="q15-vf-detail">参数：' + esc(step.parameters) + '</p>' : '') +
        (step.equipmentName ? '<p class="q15-vf-detail">设备：' + esc(step.equipmentName) + '</p>' : '') +
        '</div>' +
        ccpLabel +
        '</div>' +
        (i < validSteps.length - 1 ? '<div class="q15-vf-arrow-down"></div>' : '') +
        '</div>';
    });
    
    html += '<div class="q15-vf-node start-end">' +
      '<div class="q15-vf-arrow-down"></div>' +
      '<div class="q15-vf-node-shape end">结束</div>' +
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


  // ===== Word文档导出功能（完整版：档案1-3步 + 15min问卷内容）=====
  function exportToWord() {
    var pfData = {};
    try { var pfRaw = localStorage.getItem('haccp_profile_data'); if (pfRaw) pfData = JSON.parse(pfRaw); } catch(e) {}
    var q15Data = load15minData() || {};

    // 合并数据
    var data = {};
    var pfKeys = ['companyName','deptName','auditor','haccpTeam','extraItems',
      'pd_rawProps','pd_rawSupply','pd_rawUsage','pd_productProps','pd_productProcess','pd_productStorage','pd_productSales',
      'productExtraItems','iu_consumerExpect','iu_intendedUse','iu_consumptionMethod','iu_targetCustomer','iu_vulnerableGroups',
      'iu_unintendedUse','iuExtraItems'];
    pfKeys.forEach(function(k) {
      if (pfData[k] !== undefined && pfData[k] !== '' && pfData[k] !== null &&
          !(Array.isArray(pfData[k]) && pfData[k].length === 0)) { data[k] = pfData[k]; }
    });
    Object.keys(q15Data).forEach(function(k) { if (data[k] === undefined) data[k] = q15Data[k]; });
    if (!data.companyName && q15Data.companyName) data.companyName = q15Data.companyName;
    if (!data.deptName && q15Data.deptName) data.deptName = q15Data.deptName;

    // 辅助函数
    var esc = function(str) {
      if (!str) return '';
      return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    };
    var td = function(v) {
      if (v === undefined || v === null || (typeof v === 'string' && !v.trim()) ||
          (Array.isArray(v) && v.length === 0)) {
        return '<td style="color:#999;font-style:italic;">（未填写）</td>';
      }
      return '<td>' + esc(String(v)) + '</td>';
    };
    var boolYes = function(v) { return v ? '&#10003; 是' : '&#10007; 否'; };
    var emptyCell = function(text) {
      return '<td colspan="5" style="color:#6b7280;font-style:italic;text-align:center;">' + esc(text || '') + '</td>';
    };

    var now = new Date();
    var dateStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');

    // Word 文档头部
    var html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"><!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom><w:DoNotOptimizeForBrowser/></w:WordDocument></xml><![endif]--><style>@page{size:A4;margin:2cm 2.5cm 2cm 2.5cm;mso-header-margin:1.5cm;mso-footer-margin:1.25cm}body{font-family:"宋体",SimSun,serif;font-size:12pt;line-height:1.8;color:#333}h1{font-family:"黑体",SimHei,sans-serif;font-size:18pt;text-align:center;color:#1e3a5f;margin-bottom:8pt;border-bottom:2px solid #1e3a5f;padding-bottom:8pt}h2{font-family:"黑体",SimHei,sans-serif;font-size:14pt;color:#1e40af;margin-top:20pt;margin-bottom:10pt;border-left:4px solid #1e40af;padding-left:8pt}h3{font-family:"黑体",SimHei,sans-serif;font-size:12pt;color:#374151;margin-top:14pt;margin-bottom:8pt}table{width:100%;border-collapse:collapse;margin-bottom:12pt}th{background-color:#1e3a5f;color:#fff;font-size:10.5pt;padding:6pt 8pt;border:1px solid #1e3a5f;text-align:center}td{font-size:10.5pt;padding:5pt 8pt;border:1px solid #999;word-break:break-all}.info-table td:first-child{width:200pt;background-color:#f0f4ff;font-weight:bold}.meta{text-align:right;font-size:10pt;color:#666;margin-bottom:16pt}</style></head><body>' +
      '<h1>HACCP 产品档案</h1><p class="meta">导出日期：' + dateStr + ' | 企业名称：' + esc(data.companyName || '（未填写）') + '</p>';

    // ==================== 一、HACCP小组的组成 ====================
    html += '<h2>一、HACCP小组的组成</h2>';
    html += '<table class="info-table"><tr><td>企业名称</td>' + td(data.companyName) + '</tr><tr><td>制定部门</td>' + td(data.deptName) + '</tr><tr><td>审核人员</td>' + td(data.auditor) + '</tr></table>';
    var ex1 = (data.extraItems || []).filter(function(e) { return e.key || e.value; });
    if (ex1.length > 0) {
      html += '<h3>其他项目</h3><table><thead><tr><th>项目名称</th><th>项目内容</th></tr></thead><tbody>';
      ex1.forEach(function(e) { html += '<tr>' + td(e.key) + td(e.value) + '</tr>'; });
      html += '</tbody></table>';
    }
    html += '<h3>HACCP小组成员</h3><table><thead><tr><th>姓名</th><th>部门</th><th>职责</th><th>权限</th><th>备注</th></tr></thead><tbody>';
    var team = data.haccpTeam || [];
    var teamHtml = '';
    team.forEach(function(m) { teamHtml += '<tr>' + td(m.name) + td(m.dept) + td(m.role) + td(m.authority) + td(m.remark) + '</tr>'; });
    html += (teamHtml || '<tr><td colspan="5" style="color:#999;font-style:italic;text-align:center;">暂无成员信息</td></tr>') + '</tbody></table>';

    // ==================== 二、产品描述 ====================
    html += '<h2 style="page-break-before:always;">二、产品描述</h2>';
    html += '<table class="info-table"><tbody>';
    [
      ['pd_rawProps','原辅料、食品包装材料的名称、类别、成分及其生物、化学和物理特性'],
      ['pd_rawSupply','原辅料、食品包装材料的来源，以及生产、包装、储藏、运输和交付方式'],
      ['pd_rawUsage','原辅料、食品包装材料接收要求、接收方式和使用方式'],
      ['pd_productProps','产品的名称、类别、成分及其生物、化学、物理特性'],
      ['pd_productProcess','产品的加工方式'],
      ['pd_productStorage','产品的包装、储藏、运输和交付方式'],
      ['pd_productSales','产品的销售方式和标识']
    ].forEach(function(f) { html += '<tr><td>' + esc(f[1]) + '</td>' + td(data[f[0]]) + '</tr>'; });
    html += '</tbody></table>';
    var pe = (data.productExtraItems || []).filter(function(e) { return e.key || e.value; });
    if (pe.length > 0) {
      html += '<h3>其他必要信息</h3><table><thead><tr><th>项目名称</th><th>项目内容</th></tr></thead><tbody>';
      pe.forEach(function(e) { html += '<tr>' + td(e.key) + td(e.value) + '</tr>'; });
      html += '</tbody></table>';
    }

    // ==================== 三、预期用途的确定 ====================
    html += '<h2 style="page-break-before:always;">三、预期用途的确定</h2>';
    html += '<table class="info-table"><tbody>';
    [
      ['iu_consumerExpect','顾客对产品的消费或使用期望'],
      ['iu_intendedUse','产品的预期用途和储藏条件，以及保质期'],
      ['iu_consumptionMethod','产品预期的食用或使用方式'],
      ['iu_targetCustomer','产品预期的顾客对象'],
      ['iu_vulnerableGroups','直接消费产品对易受伤害群体的适用性'],
      ['iu_unintendedUse','产品非预期(但极可能出现)的食用或使用方式']
    ].forEach(function(f) { html += '<tr><td>' + esc(f[1]) + '</td>' + td(data[f[0]]) + '</tr>'; });
    html += '</tbody></table>';
    var iue = (data.iuExtraItems || []).filter(function(e) { return e.key || e.value; });
    if (iue.length > 0) {
      html += '<h3>其他必要信息</h3><table><thead><tr><th>项目名称</th><th>项目内容</th></tr></thead><tbody>';
      iue.forEach(function(e) { html += '<tr>' + td(e.key) + td(e.value) + '</tr>'; });
      html += '</tbody></table>';
    }

    // ==================== 四、产品与生产流程 ====================
    html += '<h2 style="page-break-before:always;">四、产品与生产流程</h2>';
    html += '<h3>产品基本信息</h3><table class="info-table">';
    [
      ['productName','产品名称'],['rawMaterials','主要原料'],['additives','添加剂'],
      ['productPH','产品PH值'],['waterActivity','水分活度'],['intendedUse','预期用途'],
      ['storageCondition','储存条件'],['packagingMethod','包装方式'],['targetConsumer','目标消费者'],
      ['shelfLife','保质期']
    ].forEach(function(f) { html += '<tr><td>' + esc(f[1]) + '</td>' + td(data[f[0]]) + '</tr>'; });
    html += '</table>';

    // 配方
    var formula = (data.formula || []).filter(function(f) { return f.material || f.dosage || f.func; });
    if (formula.length > 0) {
      html += '<h3>配方</h3><table><thead><tr><th>原料/辅料/添加剂</th><th>精确用量</th><th>关键作用</th></tr></thead><tbody>';
      formula.forEach(function(f) { html += '<tr>' + td(f.material) + td(f.dosage) + td(f.func) + '</tr>'; });
      html += '</tbody></table>';
    }

    // 操作步骤
    var steps = data.processSteps || [];
    var stepsHtml = '';
    steps.forEach(function(s, i) {
      if (!s.stepName || !s.stepName.trim()) return;
      stepsHtml += '<tr><td style="text-align:center;">' + (i+1) + '</td>' + td(s.stepName) + td(s.operationMethod) + td(s.parameters) + td(s.controlPoint) + td(s.equipmentName) + '</tr>';
    });
    if (stepsHtml) {
      html += '<h3>生产操作步骤</h3><table><thead><tr><th style="width:40px;">序号</th><th>步骤名称</th><th>操作方法</th><th>工艺参数</th><th>控制点</th><th>设备名称</th></tr></thead><tbody>' + stepsHtml + '</tbody></table>';
    }
    html += '<table class="info-table"><tr><td>流程图现场确认</td><td>' + boolYes(data.flowConfirmed) + '</td></tr></table>';

    // ==================== 五、CCP判定结果 ====================
    var ccpSteps = data.ccpSteps || [];
    if (ccpSteps.length > 0) {
      html += '<h2 style="page-break-before:always;">五、CCP判定结果</h2>';
      html += '<table><thead><tr><th>步骤</th><th>危害类型</th><th>危害描述</th><th>Q1</th><th>Q2</th><th>Q3</th><th>Q4</th><th>Q5</th><th>判定结果</th></tr></thead><tbody>';
      var htLabel = { bio: '生物危害', chem: '化学危害', phys: '物理危害' };
      ccpSteps.forEach(function(s, si) {
        if (!s.hazards) return;
        ['bio','chem','phys'].forEach(function(ht, hi) {
          var h = s.hazards[ht] || {};
          var r = '';
          if (h.isCCP === true) r = '<span style="color:#dc2626;font-weight:bold;">CCP</span>';
          else if (h.isCCP === false) r = '<span style="color:#16a34a;">非CCP</span>';
          else if (h.isCCP === 'modify') r = '<span style="color:#d97706;">需修改</span>';
          else r = '未判定';
          html += '<tr>';
          if (hi === 0) html += '<td rowspan="3" style="vertical-align:middle;font-weight:500;">' + esc(s.stepName || ('步骤'+(si+1))) + '</td>';
          html += '<td>' + htLabel[ht] + '</td><td style="font-size:10pt;">' + esc(h.hazardDesc || '') + '</td>';
          html += '<td style="text-align:center;">' + (h.q1||'—') + '</td><td style="text-align:center;">' + (h.q2||'—') + '</td><td style="text-align:center;">' + (h.q3||'—') + '</td><td style="text-align:center;">' + (h.q4||'—') + '</td><td style="text-align:center;">' + (h.q5||'—') + '</td>';
          html += '<td style="text-align:center;">' + r + '</td></tr>';
        });
      });
      html += '</tbody></table>';
    }

    // ==================== 六、危害分析（按材料/步骤分组，每种材料列出生物+化学+物理三类危害）====================
    html += '<h2 style="page-break-before:always;">六、危害分析</h2>';
    var hazDone = false;

    // --- 6a. 新版格式（hazardWorksheet: 按步骤分组，每步骤有 bio/chem/phys 三类危害）---
    var hw = data.hazardWorksheet || [];
    if (hw.length > 0) {
      hazDone = true;
      html += '<h3>危害分析工作单</h3>';
      html += '<table><thead><tr><th style="width:80px;">加工步骤</th><th style="width:70px;">危害类型</th><th>潜在危害描述</th><th style="width:50px;">严重性</th><th style="width:50px;">可能性</th><th style="width:60px;">显著危害</th><th>控制措施</th></tr></thead><tbody>';
      hw.forEach(function(ws) {
        var sn = ws.stepName || '';
        var hz = ws.hazards || [];
        // 按类型分组：bio → 生物危害, chem → 化学危害, phys → 物理危害
        var groups = { '生物危害': [], '化学危害': [], '物理危害': [] };
        hz.forEach(function(h) {
          var c = h.hazardType || h.category || '';
          if (c === '生物危害' || c === 'biological') groups['生物危害'].push(h);
          else if (c === '化学危害' || c === 'chemical') groups['化学危害'].push(h);
          else if (c === '物理危害' || c === 'physical') groups['物理危害'].push(h);
        });
        // 三行：生物/化学/物理（有可能某类有多条）
        var rowData = [];
        ['生物危害','化学危害','物理危害'].forEach(function(t) {
          var items = groups[t];
          if (items && items.length > 0) {
            items.forEach(function(h) { rowData.push({ type: t, h: h }); });
          } else {
            rowData.push({ type: t, h: null });
          }
        });
        rowData.forEach(function(rd, ri) {
          html += '<tr>';
          if (ri === 0) html += '<td rowspan="' + rowData.length + '" style="vertical-align:middle;font-weight:500;">' + esc(sn || '（未命名）') + '</td>';
          var tc = rd.type === '生物危害' ? '#dc2626' : (rd.type === '化学危害' ? '#d97706' : '#2563eb');
          html += '<td style="color:' + tc + ';font-weight:500;">' + rd.type + '</td>';
          if (rd.h) {
            html += td(rd.h.hazardDesc) + td(rd.h.severity) + td(rd.h.likelihood);
            html += '<td style="text-align:center;">' + (rd.h.isSignificant ? '<span style="color:#dc2626;font-weight:bold;">&#10003; 是</span>' : '—') + '</td>';
            html += td(rd.h.controlMeasure || rd.h.control);
          } else {
            html += '<td colspan="4" style="color:#6b7280;font-style:italic;">无显著' + rd.type + '</td>';
          }
          html += '</tr>';
        });
      });
      html += '</tbody></table>';
    }

    // --- 6b. 旧版格式兼容（hazardBio/Chem/Phys 含 material 字段）---
    if (!hazDone) {
      var bio = data.hazardBio || [];
      var chem = data.hazardChem || [];
      var phys = data.hazardPhys || [];
      // 按 material 字段分组
      var matMap = {};
      bio.forEach(function(h) {
        var m = h.material || '未指定材料';
        if (!matMap[m]) matMap[m] = { bioH: null, chemH: null, physH: null };
        matMap[m].bioH = h;
      });
      chem.forEach(function(h) {
        var m = h.material || '未指定材料';
        if (!matMap[m]) matMap[m] = { bioH: null, chemH: null, physH: null };
        matMap[m].chemH = h;
      });
      phys.forEach(function(h) {
        var m = h.material || '未指定材料';
        if (!matMap[m]) matMap[m] = { bioH: null, chemH: null, physH: null };
        matMap[m].physH = h;
      });
      var mats = Object.keys(matMap);
      if (mats.length > 0) {
        hazDone = true;
        html += '<h3>危害分析（按材料分组）</h3>';
        html += '<table><thead><tr><th style="width:90px;">材料</th><th style="width:70px;">危害类型</th><th>危害描述</th><th style="width:50px;">严重性</th><th style="width:50px;">可能性</th><th>控制措施</th></tr></thead><tbody>';
        mats.forEach(function(mat) {
          var g = matMap[mat];
          [
            { type: '生物危害', color: '#dc2626', h: g.bioH },
            { type: '化学危害', color: '#d97706', h: g.chemH },
            { type: '物理危害', color: '#2563eb', h: g.physH }
          ].forEach(function(r, ri) {
            html += '<tr>';
            if (ri === 0) html += '<td rowspan="3" style="vertical-align:middle;font-weight:500;">' + esc(mat) + '</td>';
            html += '<td style="color:' + r.color + ';font-weight:500;">' + r.type + '</td>';
            if (r.h) {
              html += td(r.h.desc || r.h.detail) + td(r.h.severity) + td(r.h.likelihood) + td(r.h.control);
            } else {
              html += '<td colspan="3" style="color:#6b7280;font-style:italic;">无显著' + r.type + '</td>';
            }
            html += '</tr>';
          });
        });
        html += '</tbody></table>';
      }
    }
    if (!hazDone) {
      html += '<p style="color:#999;font-style:italic;">暂未填写危害分析信息</p>';
    }
    html += '<table class="info-table"><tr><td>团队确认</td><td>' + boolYes(data.hazardConfirmed) + '</td></tr></table>';

    // ==================== 七、关键限制与监控 ====================
    html += '<h2 style="page-break-before:always;">七、关键限制与监控</h2>';
    var sl = { gb:'国标（GB）', industry:'行业标准', enterprise:'企业标准', international:'国际标准' };
    html += '<table class="info-table"><tr><td>执行标准</td>' + td(sl[data.execStandard] || data.execStandard) + '</tr><tr><td>关键限制说明</td>' + td(data.criticalLimits) + '</tr></table>';
    var mon = (data.monitoring || []).filter(function(m) { return m.ccp || m.object || m.method; });
    if (mon.length > 0) {
      html += '<h3>监控程序设置</h3><table><thead><tr><th>CCP</th><th>监控对象</th><th>监控方法</th><th>监控频率</th><th>监控人员</th><th>备注</th></tr></thead><tbody>';
      mon.forEach(function(m) { html += '<tr>' + td(m.ccp) + td(m.object) + td(m.method) + td(m.frequency) + td(m.personnel) + td(m.remark) + '</tr>'; });
      html += '</tbody></table>';
    }
    var ca = (data.correctiveActions || []).filter(function(c) { return c.ccp || c.cl || c.corrective; });
    if (ca.length > 0) {
      html += '<h3>纠偏措施</h3><table><thead><tr><th>CCP</th><th>关键限值(CL)</th><th>纠偏措施</th><th>验证</th><th>记录</th></tr></thead><tbody>';
      ca.forEach(function(c) { html += '<tr>' + td(c.ccp) + td(c.cl) + td(c.corrective) + td(c.verification) + td(c.record) + '</tr>'; });
      html += '</tbody></table>';
    }

    // ==================== 八、记录与报表 ====================
    html += '<h2 style="page-break-before:always;">八、记录与报表</h2>';
    html += '<table class="info-table"><tr><td>记录保存期限</td>' + td(data.recordPeriod) + '</tr><tr><td>记录格式要求</td>' + td(data.recordFormat) + '</tr></table>';
    html += '<p style="text-align:center;color:#999;font-size:9pt;margin-top:30pt;">—— 本文件由 HACCP AI 助手自动生成 ——</p></body></html>';

    // 触发下载
    var blob = new Blob(['﻿' + html], { type: 'application/msword;charset=UTF-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'HACCP产品档案_' + (data.companyName || '未命名') + '_' + dateStr + '.doc';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return { init };
})();