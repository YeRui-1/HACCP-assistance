// 结果展示：自动调用 AI 生成报告 + 用户答案 + HACCP 计划章节
const Results = (() => {
  let activeSection = 'aiReport';

  function getEl(id) { return document.getElementById(id); }

  function esc(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
    if (fcTemplate.enabled) {
      items.push({ key: 'flowchart', label: { zh: '生产流程图', en: 'Process Flow Chart' } });
    }
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
    const fieldValue = (val) => val ? esc(val) : `<span style="color:var(--gray-400);font-style:italic;">未填写</span>`;
    const boolYes = (val) => val ? '✓ 是' : '✗ 否';

    let html = `<a class="back-link" href="javascript:App.navigateTo('home')">← ${I18n.t('nav.back')}</a>`;

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

    // 一、企业信息
    html += `<div class="results-section" id="section-q15-company"><h2>一、企业信息</h2>
      <div class="result-item"><span class="ri-label">企业名称</span><span class="ri-value">${fieldValue(data.companyName)}</span></div>
      <div class="result-item"><span class="ri-label">制定部门</span><span class="ri-value">${fieldValue(data.deptName)}</span></div>
      <div class="result-item"><span class="ri-label">审核人员</span><span class="ri-value">${fieldValue(data.auditor)}</span></div>
      <h3>HACCP小组成员</h3>
      <table><thead><tr><th>姓名</th><th>部门</th><th>职位</th><th>职责</th></tr></thead><tbody>
        ${(data.haccpTeam || []).map(m => `<tr><td>${fieldValue(m.name)}</td><td>${fieldValue(m.dept)}</td><td>${fieldValue(m.position)}</td><td>${fieldValue(m.role)}</td></tr>`).join('')}
      </tbody></table></div>`;

    // 二、产品信息
    html += `<div class="results-section" id="section-q15-product"><h2>二、产品信息</h2>
      <div class="result-item"><span class="ri-label">产品名称</span><span class="ri-value">${fieldValue(data.productName)}</span></div>
      <div class="result-item"><span class="ri-label">主要原料</span><span class="ri-value">${fieldValue(data.rawMaterials)}</span></div>
      <div class="result-item"><span class="ri-label">添加剂</span><span class="ri-value">${fieldValue(data.additives)}</span></div>
      <div class="result-item"><span class="ri-label">产品PH</span><span class="ri-value">${fieldValue(data.productPH)}</span></div>
      <div class="result-item"><span class="ri-label">水分活度</span><span class="ri-value">${fieldValue(data.waterActivity)}</span></div>
      <div class="result-item"><span class="ri-label">预期用途</span><span class="ri-value">${fieldValue(data.intendedUse)}</span></div>
      <div class="result-item"><span class="ri-label">储存条件</span><span class="ri-value">${fieldValue(data.storageCondition)}</span></div>
      <div class="result-item"><span class="ri-label">包装方式</span><span class="ri-value">${fieldValue(data.packagingMethod)}</span></div>
      <div class="result-item"><span class="ri-label">目标消费者</span><span class="ri-value">${fieldValue(data.targetConsumer)}</span></div>
      <div class="result-item"><span class="ri-label">保质期</span><span class="ri-value">${fieldValue(data.shelfLife)}</span></div></div>`;

    // 三、生产流程
    html += `<div class="results-section" id="section-q15-process"><h2>三、生产流程</h2>
      <h3>配方</h3>
      <table><thead><tr><th>原料/辅料/添加剂</th><th>精确用量</th><th>关键作用</th></tr></thead><tbody>
        ${(data.formula || []).map(f => `<tr><td>${fieldValue(f.material)}</td><td>${fieldValue(f.dosage)}</td><td>${fieldValue(f.func)}</td></tr>`).join('')}
      </tbody></table>
      <h3>操作步骤</h3>`;
    (data.processSteps || []).forEach((s, i) => {
      html += `<div class="fc-step-card fc-result"><div class="fc-step-header"><span class="fc-step-num">${i + 1}</span><strong>${fieldValue(s.stepName)}</strong></div>
        <table class="fc-result-params"><tbody>
          <tr><th>操作方法</th><td>${fieldValue(s.operationMethod)}</td></tr>
          <tr><th>工艺参数</th><td>${fieldValue(s.parameters)}</td></tr>
          <tr><th>控制点</th><td>${fieldValue(s.controlPoint)}</td></tr>
          <tr><th>设备名称</th><td>${fieldValue(s.equipmentName)}</td></tr>
        </tbody></table></div>`;
    });
    html += `<div class="result-item"><span class="ri-label">流程图现场确认</span><span class="ri-value">${boolYes(data.flowConfirmed)}</span></div></div>`;

    // 四、危害分析
    html += `<div class="results-section" id="section-q15-hazard"><h2>四、危害分析</h2>`;
    const hazardTypes = [
      { key: 'hazardBio', label: '生物危害' },
      { key: 'hazardChem', label: '化学危害' },
      { key: 'hazardPhys', label: '物理危害' },
    ];
    hazardTypes.forEach(({ key, label }) => {
      const items = data[key] || [];
      html += `<h3>${label}</h3>`;
      if (items.length > 0) {
        html += `<table><thead><tr><th>危害描述</th><th>严重性</th><th>发生可能性</th><th>控制措施</th></tr></thead><tbody>
          ${items.map(h => `<tr><td>${fieldValue(h.desc)}</td><td>${fieldValue(h.severity)}</td><td>${fieldValue(h.likelihood)}</td><td>${fieldValue(h.control)}</td></tr>`).join('')}
        </tbody></table>`;
      } else {
        html += `<p style="color:var(--gray-400);font-style:italic;">未填写</p>`;
      }
    });
    html += `<div class="result-item"><span class="ri-label">团队确认</span><span class="ri-value">${boolYes(data.hazardConfirmed)}</span></div></div>`;

    // 五、关键限制
    const stdLabels = { 'gb': '国标（GB）', 'industry': '行业标准', 'enterprise': '企业标准', 'international': '国际标准' };
    html += `<div class="results-section" id="section-q15-limits"><h2>五、关键限制</h2>
      <div class="result-item"><span class="ri-label">执行标准</span><span class="ri-value">${stdLabels[data.execStandard] || fieldValue(data.execStandard)}</span></div>
      <div class="result-item"><span class="ri-label">关键限制说明</span><span class="ri-value">${fieldValue(data.criticalLimits)}</span></div></div>`;

    // 六、验证程序
    html += `<div class="results-section" id="section-q15-verification"><h2>六、验证程序</h2>
      <h3>监控程序设置</h3>
      <table><thead><tr><th>CCP</th><th>监控对象</th><th>监控方法</th><th>监控频率</th><th>监控人员</th><th>备注</th></tr></thead><tbody>
        ${(data.monitoring || []).map(m => `<tr><td>${fieldValue(m.ccp)}</td><td>${fieldValue(m.object)}</td><td>${fieldValue(m.method)}</td><td>${fieldValue(m.frequency)}</td><td>${fieldValue(m.personnel)}</td><td>${fieldValue(m.remark)}</td></tr>`).join('')}
      </tbody></table>
      <h3>纠偏措施</h3>
      <table><thead><tr><th>CCP</th><th>关键限值(CL)</th><th>纠偏措施</th><th>验证</th><th>记录</th></tr></thead><tbody>
        ${(data.correctiveActions || []).map(c => `<tr><td>${fieldValue(c.ccp)}</td><td>${fieldValue(c.cl)}</td><td>${fieldValue(c.corrective)}</td><td>${fieldValue(c.verification)}</td><td>${fieldValue(c.record)}</td></tr>`).join('')}
      </tbody></table></div>`;

    // 七、记录
    html += `<div class="results-section" id="section-q15-records"><h2>七、记录与报表</h2>
      <div class="result-item"><span class="ri-label">记录保存期限</span><span class="ri-value">${fieldValue(data.recordPeriod)}</span></div>
      <div class="result-item"><span class="ri-label">记录格式要求</span><span class="ri-value">${fieldValue(data.recordFormat)}</span></div></div>`;

    container.innerHTML = html;
  }

  // ===== 主内容 =====
  function renderContent() {
    const container = getEl('resultsContent');
    const submitted = localStorage.getItem('haccp_submitted');
    const lang = I18n.getLang();

    // 检查是否有15min问卷提交数据
    const q15Data = load15minData();

    if (!submitted) {
      container.innerHTML = `
        <a class="back-link" href="javascript:App.navigateTo('home')">← ${I18n.t('nav.back')}</a>
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <h3>${I18n.t('r.empty.title')}</h3>
          <p>${I18n.t('r.empty.desc')}</p>
          <button class="btn btn-primary" onclick="App.navigateTo('questionnaire')">${I18n.t('r.empty.btn')}</button>
        </div>
      `;
      return;
    }

    // 如果是15min问卷提交的数据，使用专门的渲染方式
    if (q15Data) {
      render15minContent(container, q15Data, lang);
      return;
    }

    // AI 报告区域（初始加载中）
    const aiTitle = lang === 'en' ? 'AI Analysis Report' : 'AI 分析报告';
    let html = `<a class="back-link" href="javascript:App.navigateTo('home')">← ${I18n.t('nav.back')}</a>`;

    html += `
      <div class="results-section" id="section-aiReport">
        <h2>${aiTitle}</h2>
        <div id="aiReportBody">
          <div class="report-loading">
            <span class="spinner" style="width:20px;height:20px;border-color:rgba(37,99,235,0.2);border-top-color:#2563eb;"></span>
            <span>${lang === 'en' ? 'Generating AI report...' : '正在生成 AI 报告...'}</span>
          </div>
        </div>
      </div>
    `;

    // 生产流程图
    const fcTemplate = loadFcTemplate();
    if (fcTemplate.enabled) {
      const fcTitle = lang === 'en' ? 'Process Flow Chart' : '生产流程图';
      html += `
        <div class="results-section" id="section-flowchart">
          <h2>${fcTitle}</h2>
          ${buildFlowchartDisplay(lang)}
        </div>
      `;
    }

    // 产品描述（用户答案）
    const pdTitle = mockHaccpPlan.productDescription.title[lang] || mockHaccpPlan.productDescription.title.zh;
    html += `
      <div class="results-section" id="section-productDescription">
        <h2>${pdTitle}</h2>
        ${buildProductDescription(lang)}
      </div>
    `;

    // 其余 HACCP 章节
    sectionOrder.forEach(key => {
      if (key === 'productDescription') return;
      const section = mockHaccpPlan[key];
      const title = section.title[lang] || section.title.zh;
      const content = section.content[lang] || section.content.zh;
      html += `
        <div class="results-section" id="section-${key}">
          <h2>${title}</h2>
          ${content}
        </div>
      `;
    });

    container.innerHTML = html;
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

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const data = await resp.json();
      body.innerHTML = `
        <div class="report-card" style="margin:0;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:20px 24px;">
          <div class="report-card-body" style="font-size:14px;color:var(--gray-700);line-height:1.8;">${esc(data.report || '')}</div>
        </div>
      `;
    } catch (err) {
      const msg = lang === 'en'
        ? `Generation failed. Please ensure the backend is running. (${err.message})`
        : `报告生成失败，请确认后端已启动。(${err.message})`;
      body.innerHTML = `
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:16px 20px;color:#dc2626;font-size:14px;">
          ${esc(msg)}
        </div>
      `;
    }
  }

  function buildProductDescription(lang) {
    const template = loadTemplate();
    const answers = loadAnswers();

    if (!template || !template.sections || template.sections.length === 0) {
      return mockHaccpPlan.productDescription.content[lang] || mockHaccpPlan.productDescription.content.zh;
    }

    const zh = {
      overview: '以下为您在问卷中提交的产品与工艺信息：',
      noAnswer: '未填写',
      sectionLabel: '章节',
      questionLabel: '题目',
      answerLabel: '您填写的内容',
    };
    const en = {
      overview: 'Below is the product and process information you submitted:',
      noAnswer: 'Not filled',
      sectionLabel: 'Section',
      questionLabel: 'Question',
      answerLabel: 'Your Answer',
    };
    const t = lang === 'en' ? en : zh;

    let rows = '';
    template.sections.forEach(section => {
      section.questions.forEach(q => {
        const answer = answers[q.id];
        let display = '';
        if (answer === undefined || answer === '' || (Array.isArray(answer) && answer.length === 0)) {
          display = `<span style="color:var(--gray-400);font-style:italic;">${t.noAnswer}</span>`;
        } else if (Array.isArray(answer)) {
          display = esc(answer.join('、'));
        } else {
          display = esc(String(answer));
        }
        rows += `<tr><td>${esc(section.title)}</td><td>${esc(q.title)}</td><td>${display}</td></tr>`;
      });
    });

    return `
      <p>${t.overview}</p>
      <table>
        <thead><tr><th>${t.sectionLabel}</th><th>${t.questionLabel}</th><th>${t.answerLabel}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function buildFlowchartDisplay(lang) {
    const fcData = loadFcData();
    const zh = { overview: '以下为产品生产流程及各步骤的工艺参数：', noData: '未填写生产流程', step: '步骤', param: '参数名称', value: '参数值', unit: '单位' };
    const en = { overview: 'Below is the production process flow and parameters for each step:', noData: 'No process flow data', step: 'Step', param: 'Parameter', value: 'Value', unit: 'Unit' };
    const t = lang === 'en' ? en : zh;

    if (!fcData || fcData.length === 0) {
      return `<p style="color:var(--gray-400);font-style:italic;">${t.noData}</p>`;
    }

    let html = `<p>${t.overview}</p>`;
    fcData.forEach((step, si) => {
      html += `
        <div class="fc-step-card fc-result">
          <div class="fc-step-header">
            <span class="fc-step-num">${si + 1}</span>
            <strong style="font-size:15px;color:var(--gray-800);">${esc(step.name || '(未命名)')}</strong>
          </div>
          ${step.description ? `<p style="font-size:13px;color:var(--gray-500);margin-bottom:8px;">${esc(step.description)}</p>` : ''}
          ${step.parameters && step.parameters.some(p => p.name) ? `
            <table class="fc-result-params">
              <thead><tr><th>${t.param}</th><th>${t.value}</th><th>${t.unit}</th></tr></thead>
              <tbody>
                ${step.parameters.filter(p => p.name).map(p => `
                  <tr><td>${esc(p.name || '')}</td><td>${esc(p.value || '')}</td><td>${esc(p.unit || '')}</td></tr>
                `).join('')}
              </tbody>
            </table>
          ` : ''}
        </div>
      `;
    });
    return html;
  }

  function setActive(key) {
    activeSection = key;
    const nav = getEl('resultsNav');
    if (nav) {
      nav.querySelectorAll('li').forEach(li => {
        li.classList.toggle('active', li.dataset.section === key);
      });
    }
  }

  function setupScrollSpy() {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          setActive(entry.target.id.replace('section-', ''));
        }
      }
    }, { rootMargin: '-20% 0px -70% 0px' });

    setTimeout(() => {
      document.querySelectorAll('.results-section').forEach(s => observer.observe(s));
    }, 200);
  }

  return { init };
})();
