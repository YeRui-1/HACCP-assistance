// 管理员：菜单 + 内容布局（多模板管理）
const Admin = (() => {
  const TEMPLATE_KEY = 'haccp_questionnaire_template';
  const ANSWERS_KEY = 'haccp_answers';
  const API_BASE = 'http://localhost:8000';

  function genId() { return 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7); }
  function getEl(id) { return document.getElementById(id); }
  function esc(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ===== localStorage 操作 =====
  function load() {
    try { const raw = localStorage.getItem(TEMPLATE_KEY); return raw ? JSON.parse(raw) : { sections: [] }; }
    catch (e) { return { sections: [] }; }
  }
  function save(template) { localStorage.setItem(TEMPLATE_KEY, JSON.stringify(template)); syncToBackend(); }
  function loadAnswers() {
    try { const raw = localStorage.getItem(ANSWERS_KEY); return raw ? JSON.parse(raw) : {}; }
    catch (e) { return {}; }
  }

  function syncToBackend() {
    if (!currentTemplateId) return;
    fetch(`${API_BASE}/api/templates/${currentTemplateId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: currentTemplateName || 'default', content: { questionnaire: load() } }),
    }).catch(() => {});
  }

  // ===== 状态 =====
  let template = load();
  let activeSectionId = template.sections.length > 0 ? template.sections[0].id : null;
  let editMode = 'edit';
  let activeMenu = 'templates';
  let currentTemplateId = null;
  let currentTemplateName = '';

  // 迁移旧流程图模板数据
  function migrateFlowchart() {
    if (template.sections.some(s => s.isFlowchart)) return;
    try {
      const old = localStorage.getItem('haccp_flowchart_template');
      if (old) {
        const fc = JSON.parse(old);
        if (fc.enabled && fc.defaultSteps && fc.defaultSteps.length > 0) {
          template.sections.push({
            id: genId(), title: '生产流程图', isFlowchart: true,
            defaultSteps: fc.defaultSteps, questions: [],
          });
          save(template);
        }
        localStorage.removeItem('haccp_flowchart_template');
      }
    } catch (e) {}
  }

  // ===== 入口 =====
  function init() {
    template = load();
    migrateFlowchart();
    editMode = 'edit';
    renderLayout();
  }

  // ===== 布局 =====
  function renderLayout() {
    const container = getEl('adminContainer');
    container.innerHTML = `
      <div class="admin-toolbar">
        <span class="admin-title" data-i18n="admin.title">${I18n.t('admin.title')}</span>
        <button class="btn btn-secondary btn-sm" id="btnExitAdmin" data-i18n="nav.exitAdmin">${I18n.t('nav.exitAdmin')}</button>
      </div>
      <div class="admin-layout">
        <div class="admin-menu" id="adminMenu">
          <div class="admin-menu-header">功能菜单</div>
          <button class="admin-menu-item" data-menu="results">
            <span class="menu-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
            </span>
            <span>${I18n.t('admin.card2.title')}</span>
          </button>
          <button class="admin-menu-item active" data-menu="templates">
            <span class="menu-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
              </svg>
            </span>
            <span>${I18n.t('admin.templates')}</span>
          </button>
        </div>
        <div class="admin-content" id="adminContent"></div>
      </div>
    `;

    getEl('btnExitAdmin').onclick = () => App.exitAdmin();
    document.querySelectorAll('.admin-menu-item').forEach(item => {
      item.addEventListener('click', () => switchMenu(item.dataset.menu));
    });

    App.translatePage();
    renderContent();
  }

  function switchMenu(menu) {
    activeMenu = menu;
    editMode = 'edit';
    document.querySelectorAll('.admin-menu-item').forEach(item => {
      item.classList.toggle('active', item.dataset.menu === menu);
    });
    renderContent();
  }

  function renderContent() {
    const content = getEl('adminContent');
    content.style.opacity = '0';
    setTimeout(() => {
      if (activeMenu === 'editor') renderEditor(content);
      else if (activeMenu === 'results') renderResults(content);
      else if (activeMenu === 'templates') renderTemplates(content);
      content.style.opacity = '1';
    }, 120);
  }

  // ===== 模板管理页 =====
  async function renderTemplates(content) {
    content.innerHTML = `
      <div class="admin-page-title">${I18n.t('admin.templates')}</div>
      <div class="admin-page-desc">${I18n.t('admin.templatesDesc')}</div>
      <div style="margin-bottom:16px;display:flex;gap:10px;">
        <button class="btn btn-primary btn-sm" id="btnNewTemplate">${I18n.t('admin.newTemplate')}</button>
        <button class="btn btn-secondary btn-sm" id="btnRefreshTemplates">${I18n.t('admin.refresh')}</button>
      </div>
      <div id="tplList"></div>
    `;

    document.getElementById('btnNewTemplate').onclick = () => showCreateDialog();
    document.getElementById('btnRefreshTemplates').onclick = () => refreshTemplateList();

    await refreshTemplateList();
  }

  async function refreshTemplateList() {
    const listEl = document.getElementById('tplList');
    if (!listEl) return;

    let templates = [];
    try {
      const resp = await fetch(`${API_BASE}/api/templates`);
      if (resp.ok) {
        const data = await resp.json();
        templates = data.templates || [];
      }
    } catch (e) { /* 后端不可用 */ }

    if (templates.length === 0) {
      listEl.innerHTML = `<div class="empty-state"><div class="empty-icon">📁</div><h3>${I18n.t('admin.noTemplates')}</h3><p>${I18n.t('admin.noTemplatesDesc')}</p></div>`;
      return;
    }

    const zh = I18n.getLang() === 'zh';
    listEl.innerHTML = `
      <table class="tpl-table">
        <thead><tr>
          <th>${zh ? '名称' : 'Name'}</th>
          <th>${zh ? '描述' : 'Description'}</th>
          <th>${zh ? '状态' : 'Status'}</th>
          <th>${zh ? '更新时间' : 'Updated'}</th>
          <th>${zh ? '操作' : 'Actions'}</th>
        </tr></thead>
        <tbody>
          ${templates.map(t => `
            <tr>
              <td><strong>${esc(t.name)}</strong></td>
              <td><span style="color:var(--gray-500);font-size:13px;">${esc(t.description || '-')}</span></td>
              <td>${t.is_published ? `<span class="badge badge-published">${zh ? '已发布' : 'Published'}</span>` : `<span class="badge badge-draft">${zh ? '草稿' : 'Draft'}</span>`}</td>
              <td style="font-size:13px;color:var(--gray-400);">${esc(t.updated_at || '')}</td>
              <td class="tpl-actions">
                <button class="btn btn-xs btn-primary btn-tpl-edit" data-id="${t.id}">${zh ? '编辑' : 'Edit'}</button>
                ${t.is_published ? '' : `<button class="btn btn-xs btn-secondary btn-tpl-publish" data-id="${t.id}">${zh ? '发布' : 'Publish'}</button>`}
                <button class="btn btn-xs btn-secondary btn-tpl-copy" data-id="${t.id}">${zh ? '复制' : 'Copy'}</button>
                ${t.is_published ? '' : `<button class="btn btn-xs btn-tpl-del" data-id="${t.id}" style="color:var(--red);border-color:var(--red);">${zh ? '删除' : 'Delete'}</button>`}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    // 绑定操作事件
    listEl.querySelectorAll('.btn-tpl-edit').forEach(b => b.onclick = () => editTemplate(parseInt(b.dataset.id)));
    listEl.querySelectorAll('.btn-tpl-publish').forEach(b => b.onclick = () => doPublish(parseInt(b.dataset.id)));
    listEl.querySelectorAll('.btn-tpl-copy').forEach(b => b.onclick = () => showCreateDialog(parseInt(b.dataset.id)));
    listEl.querySelectorAll('.btn-tpl-del').forEach(b => b.onclick = () => doDelete(parseInt(b.dataset.id)));
  }

  function showCreateDialog(copyFromId) {
    const zh = I18n.getLang() === 'zh';
    const dialog = document.createElement('div');
    dialog.className = 'modal-overlay show';
    dialog.innerHTML = `
      <div class="modal-box" style="width:420px;">
        <h3>${zh ? '新建模板' : 'New Template'}</h3>
        <div style="margin-top:12px;">
          <label style="font-size:13px;font-weight:500;color:var(--gray-700);">${zh ? '模板名称' : 'Name'}</label>
          <input type="text" id="dlgName" style="width:100%;padding:8px 12px;border:1px solid var(--gray-300);border-radius:6px;font-size:14px;margin-top:4px;" placeholder="${zh ? '请输入模板名称' : 'Enter template name'}">
        </div>
        <div style="margin-top:12px;">
          <label style="font-size:13px;font-weight:500;color:var(--gray-700);">${zh ? '描述' : 'Description'}</label>
          <input type="text" id="dlgDesc" style="width:100%;padding:8px 12px;border:1px solid var(--gray-300);border-radius:6px;font-size:14px;margin-top:4px;" placeholder="${zh ? '可选描述' : 'Optional description'}">
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary btn-sm" id="dlgCancel">${I18n.t('pwd.cancel')}</button>
          <button class="btn btn-primary btn-sm" id="dlgConfirm">${I18n.t('pwd.confirm')}</button>
        </div>
      </div>
    `;
    document.body.appendChild(dialog);

    document.getElementById('dlgCancel').onclick = () => dialog.remove();
    document.getElementById('dlgConfirm').onclick = async () => {
      const name = document.getElementById('dlgName').value.trim();
      const desc = document.getElementById('dlgDesc').value.trim();
      if (!name) return;
      dialog.remove();
      await createTemplate(name, desc, copyFromId);
    };
    document.getElementById('dlgName').focus();
  }

  async function createTemplate(name, desc, copyFromId) {
    try {
      const body = { name, description: desc };
      if (copyFromId) body.copy_from_id = copyFromId;
      const resp = await fetch(`${API_BASE}/api/templates`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (resp.ok) {
        const data = await resp.json();
        await refreshTemplateList();
        // 自动打开编辑
        await loadTemplateForEdit(data.template.id);
      }
    } catch (e) { alert(I18n.t('admin.genError')); }
  }

  async function editTemplate(id) {
    await loadTemplateForEdit(id);
    switchMenu('editor');
  }

  async function loadTemplateForEdit(id) {
    try {
      const resp = await fetch(`${API_BASE}/api/templates/${id}`);
      if (resp.ok) {
        const data = await resp.json();
        currentTemplateId = data.template.id;
        currentTemplateName = data.template.name;
        const c = data.template.content;
        if (c.questionnaire) {
          template = c.questionnaire;
          localStorage.setItem(TEMPLATE_KEY, JSON.stringify(template));
        }
        activeSectionId = template.sections.length > 0 ? template.sections[0].id : null;
      }
    } catch (e) {
      // fallback to localStorage
      currentTemplateId = id;
      template = load();
      activeSectionId = template.sections.length > 0 ? template.sections[0].id : null;
    }
  }

  async function doPublish(id) {
    try {
      const resp = await fetch(`${API_BASE}/api/templates/${id}/publish`, { method: 'POST' });
      if (resp.ok) await refreshTemplateList();
    } catch (e) { alert(I18n.t('admin.genError')); }
  }

  async function doDelete(id) {
    if (!confirm(I18n.getLang() === 'zh' ? '确定删除此模板？' : 'Delete this template?')) return;
    try {
      const resp = await fetch(`${API_BASE}/api/templates/${id}`, { method: 'DELETE' });
      if (!resp.ok) {
        const err = await resp.json();
        alert(err.detail || I18n.t('admin.genError'));
      }
      await refreshTemplateList();
    } catch (e) { alert(I18n.t('admin.genError')); }
  }

  // ===== 编辑问卷（改造：支持模板 ID）=====
  function renderEditor(content) {
    if (!currentTemplateId) {
      content.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📝</div>
          <h3>${I18n.getLang() === 'zh' ? '请先选择模板' : 'Please select a template'}</h3>
          <p>${I18n.getLang() === 'zh' ? '请从「模板管理」中选择一个模板进行编辑' : 'Please select a template from Template Manager to edit.'}</p>
          <button class="btn btn-primary" onclick="document.querySelector('.admin-menu-item[data-menu=templates]').click()">${I18n.t('admin.templates')}</button>
        </div>
      `;
      return;
    }

    content.innerHTML = `
      <a class="back-link" href="javascript:void(0)" id="btnBackToTpl" style="margin-bottom:16px;">← ${I18n.getLang() === 'zh' ? '返回模板列表' : 'Back to Templates'}</a>
      <div class="admin-page-title">${esc(currentTemplateName)} <span style="font-size:12px;color:var(--gray-400);font-weight:400;">(ID: ${currentTemplateId})</span></div>
      <div class="admin-page-desc">${I18n.t('admin.card1.desc')}</div>
      <div style="margin-bottom:16px;">
        <div class="mode-toggle">
          <button class="mode-btn ${editMode === 'edit' ? 'active' : ''}" data-mode="edit">${I18n.t('admin.edit')}</button>
          <button class="mode-btn ${editMode === 'test' ? 'active' : ''}" data-mode="test">${I18n.t('admin.test')}</button>
        </div>
      </div>
      <div class="admin-editor-wrap" id="adminEditorWrap"></div>
    `;

    const btnBack = document.getElementById('btnBackToTpl');
    if (btnBack) btnBack.onclick = () => switchMenu('templates');

    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.onclick = () => {
        editMode = btn.dataset.mode;
        renderEditor(getEl('adminContent'));
      };
    });

    renderEditorContent();
  }

  function renderEditorContent() {
    const wrap = getEl('adminEditorWrap');
    if (!wrap) return;

    const sidebarHtml = `
      <div class="admin-sidebar" id="adminSidebar">
        <h3>${I18n.t('admin.sectionList')}</h3>
        <ul class="section-list" id="sectionList">
          ${template.sections.map((s, i) => `
            <li data-sid="${s.id}" data-idx="${i}" class="${s.id === activeSectionId ? 'active' : ''}" draggable="true">
              <span class="drag-handle">⠿</span>
              <span>${s.isFlowchart ? '🔄 ' : ''}${esc(s.title) || I18n.t('admin.newSection')}</span>
              ${editMode === 'edit' ? `<button class="del-section" data-sid="${s.id}" title="${I18n.t('admin.delSection')}">&times;</button>` : ''}
            </li>
          `).join('')}
          ${template.sections.length === 0 ? `<li style="color:var(--gray-400);cursor:default;font-size:13px;">${I18n.t('admin.noSection')}</li>` : ''}
        </ul>
        ${editMode === 'edit' ? `<button class="btn-add-section" id="btnAddSection">${I18n.t('admin.addSection')}</button>` : ''}
        ${editMode === 'edit' ? `<button class="btn-add-section" id="btnAddFlowSection" style="margin-top:4px;">${I18n.t('admin.addFlowSection')}</button>` : ''}
      </div>
    `;
    wrap.innerHTML = sidebarHtml + '<div class="admin-main" id="adminMain"></div>';

    if (editMode === 'edit') {
      const btnAdd = document.getElementById('btnAddSection');
      const btnFlow = document.getElementById('btnAddFlowSection');
      if (btnAdd) btnAdd.addEventListener('click', () => addSection('normal'));
      if (btnFlow) btnFlow.addEventListener('click', () => addSection('flowchart'));
    }
    document.querySelectorAll('.section-list li[data-sid]').forEach(li => {
      li.addEventListener('click', (e) => {
        if (e.target.closest('.del-section')) return;
        activeSectionId = li.dataset.sid;
        renderEditorContent();
      });
    });
    document.querySelectorAll('.del-section').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteSection(btn.dataset.sid);
      });
    });

    // 拖拽排序
    let dragSrcIdx = -1;
    const list = document.getElementById('sectionList');
    if (list) {
      list.querySelectorAll('li[draggable]').forEach(li => {
        li.addEventListener('dragstart', (e) => {
          dragSrcIdx = parseInt(li.dataset.idx);
          li.classList.add('dragging');
          e.dataTransfer.effectAllowed = 'move';
        });
        li.addEventListener('dragend', () => {
          li.classList.remove('dragging');
          list.querySelectorAll('li').forEach(l => l.classList.remove('drag-over'));
        });
        li.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          list.querySelectorAll('li').forEach(l => l.classList.remove('drag-over'));
          li.classList.add('drag-over');
        });
        li.addEventListener('drop', (e) => {
          e.preventDefault();
          li.classList.remove('drag-over');
          const dstIdx = parseInt(li.dataset.idx);
          if (dragSrcIdx >= 0 && dragSrcIdx !== dstIdx) {
            const moved = template.sections.splice(dragSrcIdx, 1)[0];
            template.sections.splice(dstIdx, 0, moved);
            save(template);
            activeSectionId = moved.id;
            renderEditorContent();
          }
        });
      });
    }

    renderMain();
  }

  function renderMain() {
    const main = document.getElementById('adminMain');
    if (!main) return;

    if (editMode === 'test') {
      const t = load();
      if (!t || !t.sections || t.sections.length === 0) {
        main.innerHTML = `<div class="admin-placeholder"><div class="ph-icon">📋</div><p>${I18n.t('admin.noTestData')}</p></div>`;
        return;
      }
      main.innerHTML = '';
      Questionnaire.renderInto(main, t, {
        isTest: true,
        onSubmit: () => { alert(I18n.t('admin.testSuccess')); }
      });
      return;
    }

    const section = template.sections.find(s => s.id === activeSectionId);
    if (!section) {
      main.innerHTML = `<div class="admin-placeholder"><div class="ph-icon">📝</div><p>${I18n.t('admin.noSectionHint')}</p></div>`;
      return;
    }

    // 流程图章节：编辑默认步骤
    if (section.isFlowchart) {
      main.innerHTML = `
        <div class="title-row">
          <h2 class="editable-title" id="sectionTitle">🔄 ${esc(section.title)}</h2>
          <button class="btn-edit-title" id="btnEditTitle" title="${I18n.getLang() === 'zh' ? '修改章节名称' : 'Rename section'}">✎</button>
        </div>
        <p class="admin-hint">${I18n.getLang() === 'zh' ? '生产流程章节 — 设置默认步骤模板' : 'Flowchart section — Set default step templates'}</p>
        <div style="margin-top:16px;">
          <p style="font-size:13px;font-weight:600;color:var(--gray-700);margin-bottom:6px;">${I18n.t('fc.defaultSteps')}</p>
          <textarea id="fcDefaultSteps" style="width:100%;min-height:120px;padding:10px;border:1px solid var(--gray-200);border-radius:8px;font-size:14px;font-family:inherit;resize:vertical;" placeholder="${I18n.t('fc.defaultStepsHint')}">${esc((section.defaultSteps || []).join('\n'))}</textarea>
          <p class="fc-config-hint">${I18n.t('fc.defaultStepsHint')}</p>
        </div>
      `;

      const btnEdit = document.getElementById('btnEditTitle');
      const titleEl = document.getElementById('sectionTitle');
      if (btnEdit) btnEdit.addEventListener('click', () => startRenameSection(section, titleEl));
      if (titleEl) titleEl.addEventListener('click', () => startRenameSection(section, titleEl));

      const fcTextarea = document.getElementById('fcDefaultSteps');
      if (fcTextarea) {
        fcTextarea.addEventListener('input', () => {
          section.defaultSteps = fcTextarea.value.split('\n').map(s => s.trim()).filter(s => s);
          save(template);
        });
      }
      return;
    }

    main.innerHTML = `
      <div class="title-row">
        <h2 class="editable-title" id="sectionTitle">${esc(section.title)}</h2>
        <button class="btn-edit-title" id="btnEditTitle" title="${I18n.getLang() === 'zh' ? '修改章节名称' : 'Rename section'}">✎</button>
      </div>
      <p class="admin-hint">${section.questions.length} ${I18n.t('admin.questions')}</p>
      ${section.questions.map((q, i) => renderQuestionCard(q, i)).join('')}
      <button class="btn-add-q" id="btnAddQ">${I18n.t('admin.addQuestion')}</button>
    `;

    const btnEditTitle = document.getElementById('btnEditTitle');
    const titleEl = document.getElementById('sectionTitle');
    if (btnEditTitle) btnEditTitle.addEventListener('click', () => startRenameSection(section, titleEl));
    if (titleEl) titleEl.addEventListener('click', () => startRenameSection(section, titleEl));

    document.getElementById('btnAddQ').addEventListener('click', () => addQuestion(section));

    section.questions.forEach((q, i) => {
      document.getElementById('del-' + q.id)?.addEventListener('click', () => deleteQuestion(section, i));
      document.getElementById('qtitle-' + q.id)?.addEventListener('input', function() { q.title = this.value; save(template); });
      document.getElementById('qtype-' + q.id)?.addEventListener('change', function() { q.type = this.value; if (!['select','radio','checkbox','table'].includes(q.type)) q.options = []; save(template); renderEditorContent(); });
      document.getElementById('qreq-' + q.id)?.addEventListener('change', function() { q.required = this.checked; save(template); });

      const optInput = document.getElementById('optinput-' + q.id);
      if (optInput) {
        optInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addOption(q, optInput); } });
      }
      document.getElementById('optadd-' + q.id)?.addEventListener('click', () => addOption(q, optInput));

      q.options.forEach((_, oi) => {
        document.getElementById(`optdel-${q.id}-${oi}`)?.addEventListener('click', () => { q.options.splice(oi, 1); save(template); renderEditorContent(); });
      });
    });
  }

  function renderQuestionCard(q, index) {
    const needsOptions = ['select', 'radio', 'checkbox', 'table'].includes(q.type);
    const isTable = q.type === 'table';
    return `
      <div class="question-card">
        <div class="q-header">
          <span class="q-number">#${index + 1}</span>
          <div class="q-row">
            <input type="text" id="qtitle-${q.id}" value="${esc(q.title)}" placeholder="${I18n.t('admin.qTitle')}">
            <select id="qtype-${q.id}">
              ${['text','textarea','number','date','select','radio','checkbox','table'].map(t => `<option value="${t}" ${q.type === t ? 'selected' : ''}>${I18n.t('type.' + t)}</option>`).join('')}
            </select>
            <label class="q-required"><input type="checkbox" id="qreq-${q.id}" ${q.required ? 'checked' : ''}> ${I18n.t('admin.required')}</label>
            <button class="btn-delete-q" id="del-${q.id}" title="${I18n.t('admin.deleteQ')}">&times;</button>
          </div>
        </div>
        ${needsOptions ? `
          <div class="q-options">
            <span style="font-size:12px;color:var(--gray-400);">${isTable ? I18n.t('tbl.columns') : I18n.t('admin.options')}</span>
            ${(q.options || []).map((opt, oi) => `<span class="opt-tag">${esc(opt)}<button id="optdel-${q.id}-${oi}">&times;</button></span>`).join('')}
            <input type="text" id="optinput-${q.id}" placeholder="${isTable ? I18n.t('tbl.columnsHint') : I18n.t('admin.optPlaceholder')}">
            <button class="btn btn-xs btn-secondary" id="optadd-${q.id}">+</button>
          </div>` : ''}
      </div>`;
  }

  function startRenameSection(section, titleEl) {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = section.title;
    input.className = 'rename-input';
    titleEl.replaceWith(input);
    input.focus();
    input.select();

    const commit = () => {
      const newTitle = input.value.trim();
      if (newTitle) {
        section.title = newTitle;
        save(template);
      }
      renderEditorContent();
    };
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { input.blur(); }
      if (e.key === 'Escape') { input.value = section.title; input.blur(); }
    });
  }

  function addSection(type) {
    const isFlow = type === 'flowchart';
    const defTitle = isFlow ? '生产流程图' : I18n.t('admin.newSection');
    const title = prompt(I18n.t('admin.sectionPrompt'), defTitle);
    if (!title || !title.trim()) return;
    template.sections.push({
      id: genId(), title: title.trim(), questions: [],
      isFlowchart: isFlow,
      defaultSteps: isFlow ? [] : undefined,
    });
    activeSectionId = template.sections[template.sections.length - 1].id;
    save(template);
    renderEditorContent();
  }
  function deleteSection(sid) {
    if (!confirm(I18n.t('admin.confirmDel'))) return;
    template.sections = template.sections.filter(s => s.id !== sid);
    activeSectionId = template.sections.length > 0 ? template.sections[0].id : null;
    save(template);
    renderEditorContent();
  }
  function addQuestion(section) {
    section.questions.push({ id: genId(), type: 'text', title: '', required: true, options: [] });
    save(template);
    renderEditorContent();
    setTimeout(() => { document.getElementById('qtitle-' + section.questions[section.questions.length - 1].id)?.focus(); }, 100);
  }
  function deleteQuestion(section, index) { section.questions.splice(index, 1); save(template); renderEditorContent(); }
  function addOption(q, inputEl) {
    const val = inputEl.value.trim();
    if (!val) return;
    if (!q.options) q.options = [];
    if (q.options.includes(val)) { inputEl.value = ''; return; }
    q.options.push(val);
    inputEl.value = '';
    save(template);
    renderEditorContent();
    setTimeout(() => { document.getElementById('optinput-' + q.id)?.focus(); }, 100);
  }

  // ===== 查看用户提交结果 =====
  function renderResults(content) {
    const submitted = localStorage.getItem('haccp_submitted');

    content.innerHTML = `
      <div class="admin-page-title">${I18n.t('admin.card2.title')}</div>
      <div class="admin-page-desc">${I18n.t('admin.card2.desc')}</div>
      <div class="report-actions">
        <button class="btn btn-primary" id="btnGenerateReport">${I18n.t('admin.genReport')}</button>
        <span class="report-error" id="reportError"></span>
      </div>
      <div class="report-card" id="reportCard" style="display:none;">
        <div class="report-card-title">${I18n.t('admin.reportTitle')}</div>
        <div class="report-card-body" id="reportBody"></div>
      </div>
      <div class="results-viewer" id="resultsViewer"></div>
    `;

    const btnReport = document.getElementById('btnGenerateReport');
    if (btnReport) btnReport.addEventListener('click', () => generateReport());

    const viewer = document.getElementById('resultsViewer');
    if (!submitted) {
      viewer.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><h3>${I18n.t('admin.card2.empty')}</h3><p>${I18n.t('admin.noUserResult')}</p></div>`;
      return;
    }

    const tmpl = load();
    const answers = loadAnswers();

    if (!tmpl || !tmpl.sections || tmpl.sections.length === 0) {
      viewer.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><h3>${I18n.t('admin.noUserResult')}</h3></div>`;
      return;
    }

    let html = '';
    tmpl.sections.forEach(section => {
      html += `<div class="result-section"><h3>${esc(section.title)}</h3>`;
      section.questions.forEach(q => {
        const answer = answers[q.id];
        let display = '';
        if (answer === undefined || answer === '' || (Array.isArray(answer) && answer.length === 0)) {
          display = `<span class="empty">${I18n.t('admin.resultUnknown')}</span>`;
        } else if (q.type === 'table' && Array.isArray(answer) && answer.some(r => Array.isArray(r))) {
          display = '<table class="fc-result-params"><thead><tr>' +
            (q.options || []).map(c => `<th>${esc(c)}</th>`).join('') +
            '</tr></thead><tbody>' +
            answer.filter(r => Array.isArray(r) && r.some(c => c)).map(r => '<tr>' + r.map(c => `<td>${esc(c || '')}</td>`).join('') + '</tr>').join('') +
            '</tbody></table>';
        } else if (Array.isArray(answer)) {
          display = esc(answer.join(', '));
        } else {
          display = esc(String(answer));
        }
        html += `<div class="result-item"><span class="ri-label">${esc(q.title) || '(未命名)'}</span><span class="ri-value">${display}</span></div>`;
      });
      html += '</div>';
    });
    viewer.innerHTML = html;
  }

  async function generateReport() {
    const btn = document.getElementById('btnGenerateReport');
    const errorEl = document.getElementById('reportError');
    const card = document.getElementById('reportCard');
    const body = document.getElementById('reportBody');

    if (errorEl) errorEl.textContent = '';
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> ${I18n.t('admin.genLoading')}`;

    try {
      const resp = await fetch(`${API_BASE}/api/generate_report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_date: '2026-05-01', end_date: '2026-05-31' }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      if (body) body.textContent = data.report || '';
      if (card) card.style.display = 'block';
    } catch (err) {
      if (errorEl) errorEl.textContent = `${I18n.t('admin.genError')} (${err.message})`;
      if (card) card.style.display = 'none';
    } finally {
      btn.disabled = false;
      btn.textContent = I18n.t('admin.genReport');
    }
  }

  return { init };
})();
