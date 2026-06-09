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
      { key: 'aiReport', label: 'AI 分析报告' },
      { key: 'q15-company', label: '一、企业信息' },
      { key: 'q15-product', label: '二、产品信息' },
      { key: 'q15-process', label: '三、生产流程' },
      { key: 'q15-hazard', label: '四、危害分析' },
      { key: 'q15-limits', label: '五、关键限制' },
      { key: 'q15-verification', label: '六、验证程序' },
      { key: 'q15-records', label: '七、记录与报表' },
    ];

    nav.innerHTML = items.map(item => `
      <li data-section="${item.key}" class="${item.key === activeSection ? 'active' : ''}">${item.label}</li>
    `).join('');

    nav.querySelectorAll('li').forEach(li => {
      li.addEventListener('click', () => {
        setActive(li.dataset.section);
        const el = document.getElementById('section-' + li.dataset.section);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      });
    });
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
      { key: 'aiReport', label: { zh: 'AI 分析报告', en: 'AI Analysis Report' } },
    ];
    // 流程图始终显示（使用 draw.io SVG）
    items.push({ key: 'flowchart', label: { zh: '生产流程图', en: 'Process Flow Chart' } });

    items.push({ key: 'productDescription', label: mockHaccpPlan.productDescription.title });
    sectionOrder.forEach(key => {
      if (key !== 'productDescription') {
        items.push({ key, label: mockHaccpPlan[key].title });
      }
    });

    nav.innerHTML = items.map(item => `
      <li data-section="${item.key}" class="${item.key === activeSection ? 'active' : ''}">${item.label[lang] || item.label.zh || item.label}</li>
    `).join('');

    nav.querySelectorAll('li').forEach(li => {
      li.addEventListener('click', () => {
        setActive(li.dataset.section);
        const el = document.getElementById('section-' + li.dataset.section);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      });
    });
  }

  // ===== 15min结果展示 =====
  function render15minContent(container, data, lang) {
    const fieldValue = (val) => val ? esc(val) : '<span style="color:var(--gray-400);font-style:italic;">未填写</span>';
    const boolYes = (val) => val ? '\u2713 是' : '\u2717 否';

    let html = '<a class="back-link" href="javascript:App.navigateTo(\'home\')">\u2190 ' + I18n.t('nav.back') + '</a>';

    // AI 报告
    html += `
      <div class="results-section" id="section-aiReport">
        <h2>AI 分析报告</h2>
        <div id="aiReportBody">
          <div class="report-loading">
            <span class="spinner" style="width:20px;height:20px;border-color:rgba(37,99,235,0.2);border-top-color:#2563eb;"></span>
            <span>${lang === 'en' ? 'Generating AI report...' : '正在生成 AI 报告...'}</span>
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
    var stdLabels = { 'gb': '国标（GB）', 'industry': '行业标准', 'enterprise': '企业标准', 'international': '国际标准' };
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

  return { init };
})();