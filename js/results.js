// 结果展示：自动调用 AI 生成报告 + 用户答案 + HACCP 计划章节
const Results = (() => {
  let activeSection = 'productDescription';

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
      if (data.template && data.template.content && data.template.content.questionnaire) {
        localStorage.setItem('haccp_questionnaire_template', JSON.stringify(data.template.content.questionnaire));
      }
    } catch (e) { /* fallback to localStorage */ }
  }

  function loadAnswers() {
    try { const raw = localStorage.getItem('haccp_answers'); return raw ? JSON.parse(raw) : {}; }
    catch (e) { return {}; }
  }

  function loadFcData(sectionId) {
    try { const raw = localStorage.getItem(`haccp_flowchart_${sectionId}`); return raw ? JSON.parse(raw) : []; }
    catch (e) { return []; }
  }

  // ===== 报告历史管理 =====
  function getReportHistory() {
    try { return JSON.parse(localStorage.getItem('haccp_report_history') || '[]'); }
    catch (e) { return []; }
  }
  function addReportToHistory(id, title) {
    const history = getReportHistory();
    history.push({ id: id, title: title, date: new Date().toLocaleString() });
    localStorage.setItem('haccp_report_history', JSON.stringify(history));
  }
  function getLatestReportId() {
    const history = getReportHistory();
    return history.length > 0 ? history[history.length - 1].id : null;
  }
  let _activeReportId = null;

  async function init() {
    await syncTemplateFromBackend();
    // 刚提交完问卷，自动生成新报告并直接查看
    if (localStorage.getItem('haccp_just_submitted')) {
      localStorage.removeItem('haccp_just_submitted');
      showLoading();
      const ok = await fetchAiReport();
      if (ok && _activeReportId) {
        renderSidebar();
        renderContent();
        setupScrollSpy();
        return;
      }
    }
    showReportList();
  }

  // ===== 报告列表 =====
  function showReportList() {
    const container = getEl('resultsContent');
    const nav = getEl('resultsNav');
    const lang = I18n.getLang();
    const history = getReportHistory();

    nav.innerHTML = '';

    let html = `<a class="back-link" href="javascript:App.navigateTo('home')">← ${I18n.t('nav.back')}</a>`;
    html += `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
      <h2 style="margin:0;">${lang === 'en' ? 'My Reports' : '我的报告'}</h2>
      <button class="btn btn-primary" onclick="App.navigateTo('questionnaire')">${lang === 'en' ? '+ New Report' : '+ 新建报告'}</button>
    </div>`;

    if (history.length === 0) {
      html += `
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <h3>${lang === 'en' ? 'No Reports' : '暂无报告'}</h3>
          <p>${lang === 'en' ? 'Fill in the questionnaire to generate your first HACCP report.' : '填写问卷生成第一份 HACCP 报告'}</p>
          <button class="btn btn-primary" onclick="App.navigateTo('questionnaire')">${lang === 'en' ? 'Start' : '开始填写'}</button>
        </div>
      `;
    } else {
      html += `<div style="display:flex;flex-direction:column;gap:12px;">`;
      history.slice().reverse().forEach(r => {
        html += `
          <div class="report-card" style="cursor:pointer;padding:16px 20px;" onclick="Results.viewReport(${r.id})">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <div>
                <strong style="font-size:15px;">#${r.id} ${esc(r.title)}</strong>
                <p style="margin:4px 0 0;font-size:12px;color:var(--gray-400);">${esc(r.date)}</p>
              </div>
              <span style="color:var(--primary);font-size:13px;">${lang === 'en' ? 'View →' : '查看 →'}</span>
            </div>
          </div>
        `;
      });
      html += `</div>`;
    }

    container.innerHTML = html;
    // 列表视图隐藏侧边栏
    const sidebar = document.querySelector('.results-sidebar');
    if (sidebar) sidebar.style.display = 'none';
    window._aiHaccpPlan = null;
    _activeReportId = null;
  }

  // ===== 查看单份报告 =====
  async function viewReport(reportId) {
    showLoading();
    const loaded = await loadExistingReport(reportId);
    if (loaded) {
      _activeReportId = reportId;
      renderSidebar();
      renderContent();
      setupScrollSpy();
    } else {
      showReportList();
    }
  }

  async function switchReport(reportId) {
    await viewReport(reportId);
    document.getElementById('section-productDescription')?.scrollIntoView({ behavior: 'smooth' });
  }

  // ===== 侧边栏 =====
  function renderSidebar() {
    const nav = getEl('resultsNav');
    if (!nav) return;
    const sidebar = document.querySelector('.results-sidebar');
    if (sidebar) sidebar.style.display = '';
    const lang = I18n.getLang();
    const plan = window._aiHaccpPlan;

    function getTitle(key, fallback) {
      if (plan && plan[key] && plan[key].title) {
        return plan[key].title;
      }
      return fallback;
    }

    const template = loadTemplate();
    const hasFlowchart = template && template.sections && template.sections.some(s => s.isFlowchart);

    let inner = '';

    // 返回列表按钮
    inner += `<li style="padding:4px 0 12px;">
      <a href="javascript:Results.showReportList()" style="font-size:13px;color:var(--primary);text-decoration:none;">← ${lang === 'en' ? 'Back to List' : '返回报告列表'}</a>
    </li>`;

    // 章节导航
    const items = [
      { key: 'productDescription', label: getTitle('productDescription', mockHaccpPlan.productDescription.title) },
      { key: 'aiReport', label: getTitle('aiReport', { zh: '生产流程', en: 'Production Process' }) },
    ];
    if (hasFlowchart) {
      const fcSection = template.sections.find(s => s.isFlowchart);
      items.push({ key: 'flowchart', label: { zh: fcSection ? fcSection.title : '生产流程图', en: fcSection ? fcSection.title : 'Process Flow Chart' } });
    }
    sectionOrder.forEach(key => {
      if (key !== 'productDescription') {
        items.push({ key, label: getTitle(key, mockHaccpPlan[key].title) });
      }
    });

    inner += items.map(item => `
      <li data-section="${item.key}" class="${item.key === activeSection ? 'active' : ''}">${item.label[lang] || item.label.zh || item.label}</li>
    `).join('');

    // 历史报告
    const history = getReportHistory();
    if (history.length > 1) {
      inner += `<li class="nav-divider" style="margin-top:16px;padding-top:12px;border-top:1px solid var(--gray-200);font-size:11px;color:var(--gray-400);padding-left:12px;">${lang === 'en' ? 'History' : '历史报告'}</li>`;
      history.slice().reverse().forEach(r => {
        inner += `<li data-report-id="${r.id}" style="font-size:12px;padding:6px 12px;cursor:pointer;${r.id === _activeReportId ? 'color:var(--primary);font-weight:600;' : ''}">${esc(r.title)}</li>`;
      });
    }

    nav.innerHTML = inner;

    nav.querySelectorAll('li[data-section]').forEach(li => {
      li.addEventListener('click', () => {
        setActive(li.dataset.section);
        const el = document.getElementById('section-' + li.dataset.section);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      });
    });

    nav.querySelectorAll('li[data-report-id]').forEach(li => {
      li.addEventListener('click', () => {
        switchReport(parseInt(li.dataset.reportId));
      });
    });
  }

  // ===== 加载状态 =====
  function showLoading() {
    const container = getEl('resultsContent');
    const nav = getEl('resultsNav');
    if (nav) nav.innerHTML = '';
    const lang = I18n.getLang();
    container.innerHTML = `
      <a class="back-link" href="javascript:App.navigateTo('home')">← ${I18n.t('nav.back')}</a>
      <div class="report-loading" style="text-align:center;padding:60px 20px;">
        <span class="spinner" style="width:24px;height:24px;border-color:rgba(37,99,235,0.2);border-top-color:#2563eb;"></span>
        <p style="margin-top:12px;color:var(--gray-400);">${lang === 'en' ? 'Loading...' : '加载中...'}</p>
      </div>
    `;
  }

  // ===== 加载占位 =====
  function showLoadingContent() {
    const container = getEl('resultsContent');
    const submitted = localStorage.getItem('haccp_submitted');
    if (!submitted) {
      renderContent();
      return;
    }
    const lang = I18n.getLang();
    container.innerHTML = `
      <a class="back-link" href="javascript:App.navigateTo('home')">← ${I18n.t('nav.back')}</a>
      <div class="results-section">
        <div class="report-loading" style="text-align:center;padding:40px;">
          <span class="spinner" style="width:24px;height:24px;border-color:rgba(37,99,235,0.2);border-top-color:#2563eb;"></span>
          <p style="margin-top:12px;color:var(--gray-400);">${lang === 'en' ? 'Generating HACCP plan...' : '正在生成 HACCP 计划书...'}</p>
        </div>
      </div>
    `;
  }

  // ===== 主内容 =====
  function renderContent() {
    const container = getEl('resultsContent');
    const submitted = localStorage.getItem('haccp_submitted');
    const lang = I18n.getLang();

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

    const plan = window._aiHaccpPlan;

    // 辅助函数：AI 数据优先，fallback 到 mock
    function getSection(key) {
      if (plan && plan[key]) return plan[key];
      return mockHaccpPlan[key] || null;
    }

    let html = `<a class="back-link" href="javascript:App.navigateTo('home')">← ${I18n.t('nav.back')}</a>`;

    // 1) 产品描述（排最前）
    const pdSection = getSection('productDescription');
    const pdTitle = pdSection.title[lang] || pdSection.title.zh;
    html += `
      <div class="results-section" id="section-productDescription">
        <h2>${pdTitle}</h2>
        ${buildProductDescription(lang)}
      </div>
    `;

    // 2) 生产流程（AI 报告区）
    const aiSection = plan ? plan.aiReport : null;
    const aiTitle = (aiSection && aiSection.title ? aiSection.title[lang] : null)
      || (lang === 'en' ? 'Production Process' : '生产流程');
    const aiContent = aiSection ? (aiSection[lang] || aiSection.zh || '') : '';

    if (aiContent) {
      html += `
        <div class="results-section" id="section-aiReport">
          <h2>${esc(aiTitle)}</h2>
          <div id="aiReportBody">
            <div class="report-card" style="margin:0;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:20px 24px;">
              <div class="report-card-body" style="font-size:14px;color:var(--gray-700);line-height:1.8;">${aiContent.replace(/\n/g, '<br>')}</div>
            </div>
          </div>
        </div>
      `;
    } else {
      html += `
        <div class="results-section" id="section-aiReport">
          <h2>${esc(aiTitle)}</h2>
          <div id="aiReportBody">
            <div class="report-loading">
              <span class="spinner" style="width:20px;height:20px;border-color:rgba(37,99,235,0.2);border-top-color:#2563eb;"></span>
              <span>${lang === 'en' ? 'Generating...' : '正在生成...'}</span>
            </div>
          </div>
        </div>
      `;
    }

    // 3) 生产流程图章节
    const template = loadTemplate();
    if (template && template.sections) {
      template.sections.filter(s => s.isFlowchart).forEach(s => {
        const fcTitle = s.title || (lang === 'en' ? 'Process Flow Chart' : '生产流程图');
        html += `
          <div class="results-section" id="section-flowchart">
            <h2>${esc(fcTitle)}</h2>
            ${buildFlowchartDisplay(lang, s.id)}
          </div>
        `;
      });
    }

    // 其余 HACCP 章节
    sectionOrder.forEach(key => {
      if (key === 'productDescription') return;
      const section = getSection(key);
      if (!section) return;
      const title = section.title[lang] || section.title.zh || key;
      const content = section.content[lang] || section.content.zh || '';
      html += `
        <div class="results-section" id="section-${key}">
          <h2>${title}</h2>
          ${content}
        </div>
      `;
    });

    container.innerHTML = html;
  }

  // ===== 从后端加载已有报告 =====
  async function loadExistingReport(reportId) {
    try {
      const resp = await fetch(`http://localhost:8000/api/reports/${reportId}`);
      if (!resp.ok) return false;
      const data = await resp.json();
      if (data.report && data.report.plan) {
        window._aiHaccpPlan = data.report.plan;
        return true;
      }
      return false;
    } catch (e) {
      console.error('Load report error:', e);
      return false;
    }
  }

  // ===== 调用后端 API 生成 AI 报告 =====
  async function fetchAiReport() {
    const lang = I18n.getLang();
    const answers = loadAnswers();
    const template = loadTemplate();

    const flowcharts = {};
    if (template && template.sections) {
      template.sections.filter(s => s.isFlowchart).forEach(s => {
        flowcharts[s.id] = loadFcData(s.id);
      });
    }

    try {
      const resp = await fetch('http://localhost:8000/api/generate_report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: lang, answers: answers, template: template, flowcharts: flowcharts }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const data = await resp.json();
      window._aiHaccpPlan = data.plan;

      const saveResp = await fetch('http://localhost:8000/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: new Date().toLocaleString(),
          answers: answers,
          flowcharts: flowcharts,
          plan: data.plan,
          language: lang,
        }),
      });
      if (saveResp.ok) {
        const saved = await saveResp.json();
        if (saved.report && saved.report.id) {
          addReportToHistory(saved.report.id, saved.report.title || '');
          _activeReportId = saved.report.id;
        }
      }
      return true;
    } catch (err) {
      window._aiHaccpPlan = null;
      console.error('AI generation failed:', err);
      return false;
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
        } else if (q.type === 'table' && Array.isArray(answer) && answer.length > 0 && answer.some(r => Array.isArray(r))) {
          display = '<table class="fc-result-params"><thead><tr>' +
            (q.options || []).map(c => `<th>${esc(c)}</th>`).join('') +
            '</tr></thead><tbody>' +
            answer.filter(r => Array.isArray(r) && r.some(c => c)).map(r => '<tr>' + r.map(c => `<td>${esc(c || '')}</td>`).join('') + '</tr>').join('') +
            '</tbody></table>';
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

  function buildFlowchartDisplay(lang, sectionId) {
    const fcData = loadFcData(sectionId);
    const zh = { overview: '以下为产品生产流程及各步骤的工艺参数：', noData: '未填写生产流程', step: '步骤', param: '参数名称', value: '参数值', unit: '单位', controlPoint: '关键限值', equipment: '设备名称', ingName: '名称', ingAmount: '用量', ingPurpose: '作用', ingredients: '原料/辅料/添加剂' };
    const en = { overview: 'Below is the production process flow and parameters for each step:', noData: 'No process flow data', step: 'Step', param: 'Parameter', value: 'Value', unit: 'Unit', controlPoint: 'Control Point', equipment: 'Equipment', ingName: 'Name', ingAmount: 'Amount', ingPurpose: 'Purpose', ingredients: 'Ingredients/Additives' };
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
          ${(step.controlPoint || step.equipment) ? `<div style="display:flex;gap:20px;margin-bottom:10px;font-size:13px;">${step.controlPoint ? `<span><span style="color:var(--gray-400);">${t.controlPoint}: </span><span style="color:var(--gray-700);font-weight:500;">${esc(step.controlPoint)}</span></span>` : ''}${step.equipment ? `<span><span style="color:var(--gray-400);">${t.equipment}: </span><span style="color:var(--gray-700);font-weight:500;">${esc(step.equipment)}</span></span>` : ''}</div>` : ''}
          ${step.ingredients && step.ingredients.some(ing => ing.name) ? `
            <p style="font-size:12px;font-weight:600;color:var(--gray-500);margin:8px 0 4px;">${t.ingredients}</p>
            <table class="fc-result-params">
              <thead><tr><th>${t.ingName}</th><th>${t.ingAmount}</th><th>${t.ingPurpose}</th></tr></thead>
              <tbody>
                ${step.ingredients.filter(ing => ing.name).map(ing => `
                  <tr><td>${esc(ing.name || '')}</td><td>${esc(ing.amount || '')}</td><td>${esc(ing.purpose || '')}</td></tr>
                `).join('')}
              </tbody>
            </table>
          ` : ''}
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

  return { init, viewReport, showReportList };
})();
