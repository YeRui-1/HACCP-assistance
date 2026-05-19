// 问卷填写：动态渲染管理员创建的问卷（用户端 + 管理员测试用）
const Questionnaire = (() => {
  const TEMPLATE_KEY = 'haccp_questionnaire_template';
  const ANSWERS_KEY = 'haccp_answers';
  const TEST_ANSWERS_KEY = 'haccp_test_answers';
  const FC_TEMPLATE_KEY = 'haccp_flowchart_template'; // 保留用于迁移

  function esc(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function genId() { return 'fc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7); }

  function loadTemplate() {
    try { const raw = localStorage.getItem(TEMPLATE_KEY); return raw ? JSON.parse(raw) : null; }
    catch (e) { return null; }
  }
  function loadFcData(sectionId, isTest) {
    const key = isTest ? `haccp_flowchart_test_${sectionId}` : `haccp_flowchart_${sectionId}`;
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : []; }
    catch (e) { return []; }
  }
  function saveFcData(sectionId, data, isTest) {
    const key = isTest ? `haccp_flowchart_test_${sectionId}` : `haccp_flowchart_${sectionId}`;
    localStorage.setItem(key, JSON.stringify(data));
  }

  // 迁移旧的全局流程图数据
  function migrateFcData(sectionId) {
    try {
      const old = localStorage.getItem('haccp_flowchart');
      if (old) {
        localStorage.setItem(`haccp_flowchart_${sectionId}`, old);
        localStorage.removeItem('haccp_flowchart');
        localStorage.removeItem('haccp_flowchart_test');
      }
    } catch (e) {}
  }
  async function syncTemplateFromBackend() {
    try {
      const resp = await fetch('http://localhost:8000/api/template');
      if (!resp.ok) return;
      const data = await resp.json();
      if (data.template && data.template.content && data.template.content.questionnaire) {
        localStorage.setItem(TEMPLATE_KEY, JSON.stringify(data.template.content.questionnaire));
      }
    } catch (e) {}
  }

  function loadAnswers(isTest) {
    try { const raw = localStorage.getItem(isTest ? TEST_ANSWERS_KEY : ANSWERS_KEY); return raw ? JSON.parse(raw) : {}; }
    catch (e) { return {}; }
  }
  function saveAnswers(answers, isTest) {
    localStorage.setItem(isTest ? TEST_ANSWERS_KEY : ANSWERS_KEY, JSON.stringify(answers));
  }

  // 用户端入口
  async function init() {
    await syncTemplateFromBackend();
    const container = document.getElementById('questionnaireContainer');
    const template = loadTemplate();

    if (!template || !template.sections || template.sections.length === 0) {
      container.innerHTML = `
        <a class="back-link" href="javascript:App.navigateTo('home')">← ${I18n.t('nav.back')}</a>
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <h3>${I18n.t('q.empty.title')}</h3>
          <p>${I18n.t('q.empty.desc')}</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `<a class="back-link" href="javascript:App.navigateTo('home')">← ${I18n.t('nav.back')}</a><div id="qForm"></div>`;
    const formContainer = container.querySelector('#qForm');
    renderInto(formContainer, template, { isTest: false, onSubmit: onUserSubmit });
  }

  // 将问卷渲染到指定容器
  function renderInto(container, template, opts = {}) {
    const { isTest = false, onSubmit = null } = opts;
    const answers = loadAnswers(isTest);

    // 收集流程图 section 的 ID 和数据
    const fcSections = template.sections.filter(s => s.isFlowchart);
    const fcDataMap = {};
    fcSections.forEach(s => {
      migrateFcData(s.id);
      let fcData = loadFcData(s.id, isTest);
      if (fcData.length === 0 && s.defaultSteps && s.defaultSteps.length > 0) {
        s.defaultSteps.forEach(name => {
          fcData.push({ id: genId(), name, description: '', controlPoint: '', equipment: '', parameters: [{ name: '', value: '', unit: '' }] });
        });
        saveFcData(s.id, fcData, isTest);
      }
      fcDataMap[s.id] = fcData;
    });

    let html = template.sections.map(section => {
      if (section.isFlowchart) {
        return renderFlowchartHTML(section, fcDataMap[section.id]);
      }
      return `
        <div class="q-section">
          <h2>${esc(section.title)}</h2>
          <p class="section-desc">${section.questions.length} ${I18n.t('q.questions')}</p>
          ${section.questions.map((q, qi) => renderQuestion(q, qi, answers)).join('')}
        </div>
      `;
    }).join('');

    const btnLabel = isTest ? I18n.t('q.submitTest') : I18n.t('q.submit');
    html += `
      <div class="q-submit">
        <button class="btn btn-primary" id="btnSubmit">${btnLabel}</button>
        ${isTest ? `<p style="margin-top:10px;font-size:13px;color:var(--gray-400);">${I18n.t('q.testHint')}</p>` : ''}
      </div>
    `;

    container.innerHTML = html;

    bindTableEvents(container, template, answers, isTest);

    // 流程图事件绑定
    fcSections.forEach(s => {
      bindFlowchartEvents(container, s, fcDataMap[s.id], isTest);
    });

    const btnSubmit = container.querySelector('#btnSubmit');
    if (btnSubmit) {
      btnSubmit.addEventListener('click', () => {
        collectAnswers(container, template, answers);
        let allValid = validate(template, answers);
        fcSections.forEach(s => {
          collectFlowchartData(container, fcDataMap[s.id]);
          if (!validateFlowchart(fcDataMap[s.id])) allValid = false;
        });
        if (!allValid) return;
        saveAnswers(answers, isTest);
        fcSections.forEach(s => saveFcData(s.id, fcDataMap[s.id], isTest));
        if (onSubmit) onSubmit(answers);
      });
    }

    container.querySelectorAll('input:not(.fc-input), textarea:not(.fc-textarea), select').forEach(el => {
      el.addEventListener('input', () => { collectAnswers(container, template, answers); saveAnswers(answers, isTest); });
      el.addEventListener('change', () => { collectAnswers(container, template, answers); saveAnswers(answers, isTest); });
    });

    fcSections.forEach(s => {
      container.querySelectorAll('.fc-input, .fc-textarea').forEach(el => {
        el.addEventListener('input', () => { collectFlowchartData(container, fcDataMap[s.id]); saveFcData(s.id, fcDataMap[s.id], isTest); });
      });
    });
  }

  // ===== 流程图 HTML =====
  function renderFlowchartHTML(section, fcData) {
    let steps = '';
    fcData.forEach((step, si) => {
      steps += `
        <div class="fc-step-card" data-fc-idx="${si}">
          <div class="fc-step-header">
            <span class="fc-step-num">${si + 1}</span>
            <input type="text" class="fc-input" data-fc-idx="${si}" data-fc-field="name" value="${esc(step.name)}" placeholder="${I18n.t('fc.stepNamePh')}">
            <div class="fc-step-move">
              <button class="fc-move-up" data-fc-idx="${si}" title="${I18n.t('fc.moveUp')}">▲</button>
              <button class="fc-move-down" data-fc-idx="${si}" title="${I18n.t('fc.moveDown')}">▼</button>
            </div>
            <button class="btn-delete-q fc-del-step" data-fc-idx="${si}" title="${I18n.t('fc.delStep')}">&times;</button>
          </div>
          <div class="fc-step-desc">
            <textarea class="fc-textarea" data-fc-idx="${si}" data-fc-field="description" placeholder="${I18n.t('fc.stepDescPh')}">${esc(step.description || '')}</textarea>
          </div>
          <div class="fc-step-extra">
            <input type="text" class="fc-input" data-fc-idx="${si}" data-fc-field="controlPoint" value="${esc(step.controlPoint || '')}" placeholder="${I18n.t('fc.controlPointPh')}">
            <input type="text" class="fc-input" data-fc-idx="${si}" data-fc-field="equipment" value="${esc(step.equipment || '')}" placeholder="${I18n.t('fc.equipmentPh')}">
          </div>
          <div class="fc-params">
            <div class="fc-params-label">
              <span>${I18n.t('fc.paramHeader')}</span>
            </div>
            ${(step.parameters || []).map((p, pi) => `
              <div class="fc-param-row">
                <input type="text" class="fc-input param-name" data-fc-idx="${si}" data-fc-pi="${pi}" data-fc-pfield="name" value="${esc(p.name || '')}" placeholder="${I18n.t('fc.paramNamePh')}">
                <input type="text" class="fc-input param-value" data-fc-idx="${si}" data-fc-pi="${pi}" data-fc-pfield="value" value="${esc(p.value || '')}" placeholder="${I18n.t('fc.paramValuePh')}">
                <input type="text" class="fc-input param-unit" data-fc-idx="${si}" data-fc-pi="${pi}" data-fc-pfield="unit" value="${esc(p.unit || '')}" placeholder="${I18n.t('fc.paramUnitPh')}">
                <button class="fc-param-del" data-fc-idx="${si}" data-fc-pi="${pi}">&times;</button>
              </div>
            `).join('')}
            <button class="fc-add-param" data-fc-idx="${si}">${I18n.t('fc.addParam')}</button>
          </div>
        </div>
      `;
    });

    return `
      <div class="fc-section" id="fcSection">
        <h2>${I18n.t('fc.title')}</h2>
        <p class="fc-desc">${I18n.t('fc.desc')}</p>
        <div id="fcSteps">${steps}</div>
        <div class="fc-global-actions">
          <button class="btn btn-secondary btn-sm" id="fcAddStep">${I18n.t('fc.addStep')}</button>
          <span class="error-msg" id="fcError" style="margin-left:10px;"></span>
        </div>
      </div>
    `;
  }

  // ===== 流程图事件 =====
  function bindFlowchartEvents(container, section, fcData, isTest) {
    // 添加步骤
    const btnAdd = container.querySelector('#fcAddStep');
    if (btnAdd) {
      btnAdd.addEventListener('click', () => {
        fcData.push({ id: genId(), name: '', description: '', parameters: [{ name: '', value: '', unit: '' }] });
        saveFcData(section.id, fcData, isTest);
        refreshFlowchart(container, section, fcData, isTest);
      });
    }

    // 删除步骤
    container.querySelectorAll('.fc-del-step').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.fcIdx);
        fcData.splice(idx, 1);
        saveFcData(section.id, fcData, isTest);
        refreshFlowchart(container, section, fcData, isTest);
      });
    });

    // 上移
    container.querySelectorAll('.fc-move-up').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.fcIdx);
        if (idx > 0) {
          [fcData[idx - 1], fcData[idx]] = [fcData[idx], fcData[idx - 1]];
          saveFcData(section.id, fcData, isTest);
          refreshFlowchart(container, fcData, isTest);
        }
      });
    });

    // 下移
    container.querySelectorAll('.fc-move-down').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.fcIdx);
        if (idx < fcData.length - 1) {
          [fcData[idx], fcData[idx + 1]] = [fcData[idx + 1], fcData[idx]];
          saveFcData(section.id, fcData, isTest);
          refreshFlowchart(container, fcData, isTest);
        }
      });
    });

    // 添加参数
    container.querySelectorAll('.fc-add-param').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.fcIdx);
        if (!fcData[idx].parameters) fcData[idx].parameters = [];
        fcData[idx].parameters.push({ name: '', value: '', unit: '' });
        saveFcData(section.id, fcData, isTest);
        refreshFlowchart(container, section, fcData, isTest);
      });
    });

    // 删除参数
    container.querySelectorAll('.fc-param-del').forEach(btn => {
      btn.addEventListener('click', () => {
        const stepIdx = parseInt(btn.dataset.fcIdx);
        const paramIdx = parseInt(btn.dataset.fcPi);
        fcData[stepIdx].parameters.splice(paramIdx, 1);
        if (fcData[stepIdx].parameters.length === 0) {
          fcData[stepIdx].parameters = [{ name: '', value: '', unit: '' }];
        }
        saveFcData(section.id, fcData, isTest);
        refreshFlowchart(container, section, fcData, isTest);
      });
    });
  }

  function refreshFlowchart(container, section, fcData, isTest) {
    const fcSection = container.querySelector('#fcSection');
    if (!fcSection) return;
    const wrapper = container.querySelector('#qForm') || container;
    const allHTML = wrapper.innerHTML;
    // 替换 fcSection 内容
    const newSteps = fcData.map((step, si) => {
      return `
        <div class="fc-step-card" data-fc-idx="${si}">
          <div class="fc-step-header">
            <span class="fc-step-num">${si + 1}</span>
            <input type="text" class="fc-input" data-fc-idx="${si}" data-fc-field="name" value="${esc(step.name)}" placeholder="${I18n.t('fc.stepNamePh')}">
            <div class="fc-step-move">
              <button class="fc-move-up" data-fc-idx="${si}" title="${I18n.t('fc.moveUp')}">▲</button>
              <button class="fc-move-down" data-fc-idx="${si}" title="${I18n.t('fc.moveDown')}">▼</button>
            </div>
            <button class="btn-delete-q fc-del-step" data-fc-idx="${si}" title="${I18n.t('fc.delStep')}">&times;</button>
          </div>
          <div class="fc-step-desc">
            <textarea class="fc-textarea" data-fc-idx="${si}" data-fc-field="description" placeholder="${I18n.t('fc.stepDescPh')}">${esc(step.description || '')}</textarea>
          </div>
          <div class="fc-step-extra">
            <input type="text" class="fc-input" data-fc-idx="${si}" data-fc-field="controlPoint" value="${esc(step.controlPoint || '')}" placeholder="${I18n.t('fc.controlPointPh')}">
            <input type="text" class="fc-input" data-fc-idx="${si}" data-fc-field="equipment" value="${esc(step.equipment || '')}" placeholder="${I18n.t('fc.equipmentPh')}">
          </div>
          <div class="fc-params">
            <div class="fc-params-label"><span>${I18n.t('fc.paramHeader')}</span></div>
            ${(step.parameters || []).map((p, pi) => `
              <div class="fc-param-row">
                <input type="text" class="fc-input param-name" data-fc-idx="${si}" data-fc-pi="${pi}" data-fc-pfield="name" value="${esc(p.name || '')}" placeholder="${I18n.t('fc.paramNamePh')}">
                <input type="text" class="fc-input param-value" data-fc-idx="${si}" data-fc-pi="${pi}" data-fc-pfield="value" value="${esc(p.value || '')}" placeholder="${I18n.t('fc.paramValuePh')}">
                <input type="text" class="fc-input param-unit" data-fc-idx="${si}" data-fc-pi="${pi}" data-fc-pfield="unit" value="${esc(p.unit || '')}" placeholder="${I18n.t('fc.paramUnitPh')}">
                <button class="fc-param-del" data-fc-idx="${si}" data-fc-pi="${pi}">&times;</button>
              </div>
            `).join('')}
            <button class="fc-add-param" data-fc-idx="${si}">${I18n.t('fc.addParam')}</button>
          </div>
        </div>
      `;
    }).join('');

    fcSection.querySelector('#fcSteps').innerHTML = newSteps;
    bindFlowchartEvents(container, fcData, isTest);

    // 重新绑定输入事件
    container.querySelectorAll('.fc-input, .fc-textarea').forEach(el => {
      el.addEventListener('input', () => {
        collectFlowchartData(container, fcData);
        saveFcData(section.id, fcData, isTest);
      });
    });
  }

  function collectFlowchartData(container, fcData) {
    const steps = container.querySelectorAll('.fc-step-card');
    steps.forEach((card, si) => {
      if (si >= fcData.length) return;
      const nameInput = card.querySelector('[data-fc-field="name"]');
      const descInput = card.querySelector('[data-fc-field="description"]');
      if (nameInput) fcData[si].name = nameInput.value;
      if (descInput) fcData[si].description = descInput.value;
      const cpInput = card.querySelector('[data-fc-field="controlPoint"]');
      const eqInput = card.querySelector('[data-fc-field="equipment"]');
      if (cpInput) fcData[si].controlPoint = cpInput.value;
      if (eqInput) fcData[si].equipment = eqInput.value;

      const paramRows = card.querySelectorAll('.fc-param-row');
      paramRows.forEach((row, pi) => {
        if (!fcData[si].parameters) fcData[si].parameters = [];
        if (!fcData[si].parameters[pi]) fcData[si].parameters[pi] = {};
        const nameEl = row.querySelector('[data-fc-pfield="name"]');
        const valueEl = row.querySelector('[data-fc-pfield="value"]');
        const unitEl = row.querySelector('[data-fc-pfield="unit"]');
        if (nameEl) fcData[si].parameters[pi].name = nameEl.value;
        if (valueEl) fcData[si].parameters[pi].value = valueEl.value;
        if (unitEl) fcData[si].parameters[pi].unit = unitEl.value;
      });
    });
  }

  function validateFlowchart(fcData) {
    if (!fcData || fcData.length === 0) {
      showFcError(I18n.t('fc.noSteps'));
      return false;
    }
    for (let i = 0; i < fcData.length; i++) {
      if (!fcData[i].name || !fcData[i].name.trim()) {
        showFcError(I18n.t('fc.stepNameRequired'));
        return false;
      }
    }
    hideFcError();
    return true;
  }

  function showFcError(msg) {
    const el = document.getElementById('fcError');
    if (el) { el.textContent = msg; el.style.display = 'block'; el.style.color = 'var(--red)'; }
  }
  function hideFcError() {
    const el = document.getElementById('fcError');
    if (el) el.style.display = 'none';
  }

  function bindTableEvents(container, template, answers, isTest) {
    // 添加行
    container.querySelectorAll('.btn-tbl-add').forEach(btn => {
      btn.addEventListener('click', () => {
        const qid = btn.dataset.qid;
        const q = findQuestion(template, qid);
        if (!q) return;
        const cols = (q.options || []).length;
        if (!Array.isArray(answers[qid])) answers[qid] = [];
        answers[qid].push(Array(cols).fill(''));
        saveAnswers(answers, isTest);
        refreshTableInDOM(container, q, answers, isTest);
      });
    });

    // 删除行
    container.querySelectorAll('.btn-tbl-del').forEach(btn => {
      btn.addEventListener('click', () => {
        const qid = btn.dataset.qid;
        const row = parseInt(btn.dataset.row);
        if (Array.isArray(answers[qid]) && answers[qid].length > 1) {
          answers[qid].splice(row, 1);
          saveAnswers(answers, isTest);
          refreshTableInDOM(container, findQuestion(template, qid), answers, isTest);
        }
      });
    });

    // 单元格输入
    container.querySelectorAll('.tbl-cell').forEach(cell => {
      cell.addEventListener('input', () => {
        const qid = cell.dataset.qid;
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        if (!Array.isArray(answers[qid])) answers[qid] = [];
        if (!Array.isArray(answers[qid][row])) answers[qid][row] = [];
        answers[qid][row][col] = cell.value;
        saveAnswers(answers, isTest);
      });
    });
  }

  function findQuestion(template, qid) {
    for (const s of template.sections) {
      for (const q of s.questions) {
        if (q.id === qid) return q;
      }
    }
    return null;
  }

  function refreshTableInDOM(container, q, answers, isTest) {
    const tableDiv = container.querySelector(`.table-input[data-qid="${q.id}"]`);
    if (!tableDiv) return;
    tableDiv.outerHTML = renderTableInput(q, answers[q.id]);
    // 重新绑定事件
    const newDiv = container.querySelector(`.table-input[data-qid="${q.id}"]`);
    if (newDiv) {
      const tempContainer = { querySelectorAll: (sel) => newDiv.parentElement.querySelectorAll(sel) };
      // 简化：直接在容器级别重新绑定
      bindTableEvents(container, { sections: [{ questions: [q] }] }, answers, isTest);
    }
  }

  function onUserSubmit(answers) {
    localStorage.setItem('haccp_submitted', 'true');
    App.navigateTo('results');
  }

  // ===== 题目渲染 =====
  function renderQuestion(q, index, answers) {
    const val = answers[q.id] !== undefined ? answers[q.id] : '';
    const req = q.required ? '<span class="required">*</span>' : '';

    let input = '';
    switch (q.type) {
      case 'text':
        input = `<input type="text" data-qid="${q.id}" value="${esc(val)}" placeholder="${I18n.t('q.placeholder.text')}">`;
        break;
      case 'number':
        input = `<input type="number" data-qid="${q.id}" value="${esc(val)}" placeholder="${I18n.t('q.placeholder.text')}">`;
        break;
      case 'date':
        input = `<input type="date" data-qid="${q.id}" value="${esc(val)}">`;
        break;
      case 'textarea':
        input = `<textarea data-qid="${q.id}" placeholder="${I18n.t('q.placeholder.text')}">${esc(val)}</textarea>`;
        break;
      case 'select':
        input = `<select data-qid="${q.id}">
          <option value="">${I18n.t('q.placeholder.select')}</option>
          ${(q.options || []).map(opt => `<option value="${esc(opt)}" ${val === opt ? 'selected' : ''}>${esc(opt)}</option>`).join('')}
        </select>`;
        break;
      case 'radio':
        input = `<div class="option-group">
          ${(q.options || []).map(opt => `<label><input type="radio" data-qid="${q.id}" name="radio-${q.id}" value="${esc(opt)}" ${val === opt ? 'checked' : ''}> ${esc(opt)}</label>`).join('')}
        </div>`;
        break;
      case 'checkbox':
        const checkedVals = Array.isArray(val) ? val : [];
        input = `<div class="option-group">
          ${(q.options || []).map(opt => `<label><input type="checkbox" data-qid="${q.id}" value="${esc(opt)}" ${checkedVals.includes(opt) ? 'checked' : ''}> ${esc(opt)}</label>`).join('')}
        </div>`;
        break;
      case 'table':
        input = renderTableInput(q, val);
        break;
      default:
        input = `<input type="text" data-qid="${q.id}" value="${esc(val)}">`;
    }

    return `
      <div class="form-group" data-qid="${q.id}">
        <label>${index + 1}. ${esc(q.title)} ${req}</label>
        ${input}
        <span class="error-msg">${I18n.t('q.required')}</span>
      </div>
    `;
  }

  function renderTableInput(q, val) {
    const rows = Array.isArray(val) && val.length > 0 ? val : [Array((q.options || []).length).fill('')];
    const cols = q.options || [];
    return `
      <div class="table-input" data-qid="${q.id}">
        <table>
          <thead><tr>${cols.map(c => `<th>${esc(c)}</th>`).join('')}<th style="width:50px;"></th></tr></thead>
          <tbody>${rows.map((row, ri) => `
            <tr data-row="${ri}">
              ${cols.map((_, ci) => `<td><input type="text" class="tbl-cell" data-qid="${q.id}" data-row="${ri}" data-col="${ci}" value="${esc(row[ci] || '')}" placeholder="${I18n.t('tbl.cellPlaceholder')}"></td>`).join('')}
              <td><button class="btn-tbl-del" data-qid="${q.id}" data-row="${ri}" title="${I18n.t('tbl.delRow')}">&times;</button></td>
            </tr>
          `).join('')}</tbody>
        </table>
        <button class="btn-tbl-add" data-qid="${q.id}">${I18n.t('tbl.addRow')}</button>
      </div>
    `;
  }

  function collectAnswers(container, template, answers) {
    template.sections.forEach(section => {
      section.questions.forEach(q => {
        if (q.type === 'checkbox') {
          const checked = container.querySelectorAll(`input[type="checkbox"][data-qid="${q.id}"]:checked`);
          answers[q.id] = Array.from(checked).map(cb => cb.value);
        } else if (q.type === 'radio') {
          const selected = container.querySelector(`input[type="radio"][data-qid="${q.id}"]:checked`);
          answers[q.id] = selected ? selected.value : '';
        } else if (q.type === 'table') {
          // 表格数据由 tbl-cell 的 input 事件实时收集，这里做兜底
          const cells = container.querySelectorAll(`.tbl-cell[data-qid="${q.id}"]`);
          const rows = new Set();
          cells.forEach(c => rows.add(parseInt(c.dataset.row)));
          const data = [];
          rows.forEach(ri => {
            const rowCells = container.querySelectorAll(`.tbl-cell[data-qid="${q.id}"][data-row="${ri}"]`);
            data[ri] = [];
            rowCells.forEach(c => { data[ri][parseInt(c.dataset.col)] = c.value; });
          });
          answers[q.id] = data.filter(r => r && r.some(c => c));
        } else {
          const el = container.querySelector(`input[data-qid="${q.id}"], textarea[data-qid="${q.id}"], select[data-qid="${q.id}"]`);
          answers[q.id] = el ? el.value : '';
        }
      });
    });
  }

  function validate(template, answers) {
    let firstError = null;
    template.sections.forEach(section => {
      section.questions.forEach(q => {
        if (!q.required) return;
        const val = answers[q.id];
        let isEmpty;
        if (q.type === 'table') {
          isEmpty = !Array.isArray(val) || val.length === 0 || !val.some(row => Array.isArray(row) && row.some(c => c && c.trim()));
        } else if (Array.isArray(val)) {
          isEmpty = val.length === 0;
        } else {
          isEmpty = !val || !val.toString().trim();
        }
        const group = document.querySelector(`.form-group[data-qid="${q.id}"]`);
        if (isEmpty) {
          if (group) { group.classList.add('error'); if (!firstError) firstError = group; }
        } else {
          if (group) group.classList.remove('error');
        }
      });
    });
    if (firstError) { firstError.scrollIntoView({ behavior: 'smooth', block: 'center' }); return false; }
    return true;
  }

  return { init, renderInto, loadTemplate };
})();
