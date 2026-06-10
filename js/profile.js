// 创建档案模块 - 企业信息 + 产品信息（从15分钟问卷分离出来）
const Profile = (() => {
  const STORAGE_KEY = 'haccp_profile_data';

  function genId() { return 'f_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7); }
  function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&').replace(/"/g, '"').replace(/</g, '<').replace(/>/g, '>');
  }

  function getDefaultData() {
    return {
      companyName: '',
      deptName: '',
      haccpTeam: [{ id: genId(), name: '', dept: '', position: '', role: '', remark: '' }],
      auditor: '',
      extraItems: [],
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
      productExtraItems: [],
    };
  }

  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : getDefaultData();
    } catch (e) { return getDefaultData(); }
  }

  function saveData(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
  }

  // 同步数据到15分钟问卷（兼容旧数据）
  function syncToQuestionnaire(data) {
    try {
      var qData = null;
      var qRaw = localStorage.getItem('haccp_15min_data');
      if (qRaw) {
        qData = JSON.parse(qRaw);
      } else {
        // 如果问卷没有初始化，尝试用问卷的 default
        qData = {};
      }
      // 覆盖企业信息
      qData.companyName = data.companyName;
      qData.deptName = data.deptName;
      qData.auditor = data.auditor;
      qData.haccpTeam = data.haccpTeam;
      qData.extraItems = data.extraItems;
      // 覆盖产品信息
      qData.productName = data.productName;
      qData.rawMaterials = data.rawMaterials;
      qData.additives = data.additives;
      qData.productPH = data.productPH;
      qData.waterActivity = data.waterActivity;
      qData.intendedUse = data.intendedUse;
      qData.storageCondition = data.storageCondition;
      qData.packagingMethod = data.packagingMethod;
      qData.targetConsumer = data.targetConsumer;
      qData.shelfLife = data.shelfLife;
      qData.productExtraItems = data.productExtraItems;
      localStorage.setItem('haccp_15min_data', JSON.stringify(qData));
    } catch (e) {}
  }

  function init() {
    const container = document.getElementById('profileContainer');
    if (!container) return;
    const data = loadData();
    container.innerHTML = `
      <a class="back-link" href="javascript:App.navigateTo('home')">← 返回首页</a>
      <div class="q15-section">
        <h2>创建档案</h2>
        <p style="font-size:14px;color:var(--gray-400);margin-bottom:20px;">填写企业和产品基本信息，完成后数据将自动同步到问卷</p>
        <div id="profileCompanySection">${renderCompanyInfo(data)}</div>
        <hr class="q15-divider">
        <div id="profileProductSection">${renderProductInfo(data)}</div>
        <div style="text-align:center;margin-top:24px;">
          <button class="btn btn-primary btn-lg" id="profileSaveBtn">💾 保存档案</button>
        </div>
      </div>
    `;
    bindProfileEvents(data);
  }

  function renderCompanyInfo(data) {
    var extraHtml = '';
    if (data.extraItems && data.extraItems.length > 0) {
      extraHtml = data.extraItems.map(function(e, i) {
        return '<tr data-ex-idx="' + i + '"><td><input type="text" class="profile-ex-key" value="' + esc(e.key) + '" placeholder="项目名称" style="width:100%"></td><td><input type="text" class="profile-ex-val" value="' + esc(e.value) + '" placeholder="项目内容" style="width:100%"></td><td><button class="q15-del-row profile-del-ex" data-ex-idx="' + i + '">&times;</button></td></tr>';
      }).join('');
    }
    return '<h3 style="margin-bottom:16px;color:var(--gray-800);">企业信息</h3>' +
      '<div class="q15-field-group"><label>企业名称 <span class="required">*</span></label><input type="text" id="pf-companyName" value="' + esc(data.companyName) + '" placeholder="请输入企业名称"></div>' +
      '<div class="q15-field-group"><label>制定部门 <span class="required">*</span></label><input type="text" id="pf-deptName" value="' + esc(data.deptName) + '" placeholder="请输入制定部门"></div>' +
      '<div class="q15-table-section"><h3>HACCP小组成员</h3><table class="q15-table" id="pf-teamTable"><thead><tr><th>姓名</th><th>部门</th><th>职位</th><th>小组职责</th><th>备注</th><th style="width:50px">操作</th></tr></thead><tbody id="pf-teamBody">' +
      data.haccpTeam.map(function(m, i) {
        return '<tr data-team-idx="' + i + '"><td><input type="text" class="pf-t-name" value="' + esc(m.name) + '" placeholder="姓名"></td><td><input type="text" class="pf-t-dept" value="' + esc(m.dept) + '" placeholder="部门"></td><td><input type="text" class="pf-t-pos" value="' + esc(m.position) + '" placeholder="职位"></td><td><input type="text" class="pf-t-role" value="' + esc(m.role) + '" placeholder="如：组长、副组长"></td><td><input type="text" class="pf-t-remark" value="' + esc(m.remark) + '" placeholder="备注信息"></td><td><button class="q15-del-row pf-del-team" data-team-idx="' + i + '">&times;</button></td></tr>';
      }).join('') +
      '</tbody></table><button class="btn btn-sm btn-secondary" id="pf-addTeam">+ 添加成员</button></div>' +
      '<div class="q15-table-section" style="margin-top:16px;"><table class="q15-table"><thead><tr><th>项目名称</th><th>项目内容</th><th style="width:50px">操作</th></tr></thead><tbody id="pf-extraBody">' +
      extraHtml +
      '</tbody></table><button class="btn btn-sm btn-secondary" id="pf-addExtra">+ 添加项目</button></div>';
  }

  function renderProductInfo(data) {
    var extraHtml = '';
    if (data.productExtraItems && data.productExtraItems.length > 0) {
      extraHtml = data.productExtraItems.map(function(e, i) {
        return '<tr data-p-ex-idx="' + i + '"><td><input type="text" class="pf-pe-key" value="' + esc(e.key) + '" placeholder="项目名称" style="width:100%"></td><td><input type="text" class="pf-pe-val" value="' + esc(e.value) + '" placeholder="项目内容" style="width:100%"></td><td><button class="q15-del-row pf-del-pe" data-p-ex-idx="' + i + '">&times;</button></td></tr>';
      }).join('');
    }
    return '<h3 style="margin-bottom:16px;color:var(--gray-800);">产品信息</h3>' +
      '<div class="q15-field-group"><label>产品名称 <span class="required">*</span></label><input type="text" id="pf-productName" value="' + esc(data.productName) + '" placeholder="请输入产品名称"></div>' +
      '<div class="q15-field-group"><label>主要原料</label><textarea id="pf-rawMaterials" placeholder="列出主要原料，不同原料用逗号分隔">' + esc(data.rawMaterials) + '</textarea></div>' +
      '<div class="q15-field-group"><label>添加剂</label><textarea id="pf-additives" placeholder="列出使用的添加剂，不同添加剂用逗号分隔">' + esc(data.additives) + '</textarea></div>' +
      '<div class="q15-row"><div class="q15-field-group"><label>产品特性PH</label><input type="number" step="0.01" id="pf-productPH" value="' + esc(data.productPH) + '" placeholder="如：6.5"></div><div class="q15-field-group"><label>水分活度</label><input type="number" step="0.01" id="pf-waterActivity" value="' + esc(data.waterActivity) + '" placeholder="如：0.85"></div></div>' +
      '<div class="q15-field-group"><label>预期用途</label><textarea id="pf-intendedUse" placeholder="描述产品的预期用途和消费群体如何使用该产品">' + esc(data.intendedUse) + '</textarea></div>' +
      '<div class="q15-row"><div class="q15-field-group"><label>储存条件</label><input type="text" id="pf-storageCondition" value="' + esc(data.storageCondition) + '" placeholder="如：阴凉干燥处"></div><div class="q15-field-group"><label>包装方式</label><input type="text" id="pf-packagingMethod" value="' + esc(data.packagingMethod) + '" placeholder="如：真空包装"></div></div>' +
      '<div class="q15-row"><div class="q15-field-group"><label>目标消费者</label><input type="text" id="pf-targetConsumer" value="' + esc(data.targetConsumer) + '" placeholder="如：一般人群"></div><div class="q15-field-group"><label>保质期</label><input type="text" id="pf-shelfLife" value="' + esc(data.shelfLife) + '" placeholder="如：12个月"></div></div>' +
      '<div class="q15-table-section" style="margin-top:16px;"><table class="q15-table"><thead><tr><th>项目名称</th><th>项目内容</th><th style="width:50px">操作</th></tr></thead><tbody id="pf-peBody">' +
      extraHtml +
      '</tbody></table><button class="btn btn-sm btn-secondary" id="pf-addPE">+ 添加项目</button></div>';
  }

  function collectProfileData() {
    var data = loadData();
    data.companyName = document.getElementById('pf-companyName')?.value || '';
    data.deptName = document.getElementById('pf-deptName')?.value || '';
    data.auditor = document.getElementById('pf-auditor')?.value || '';
    data.productName = document.getElementById('pf-productName')?.value || '';
    data.rawMaterials = document.getElementById('pf-rawMaterials')?.value || '';
    data.additives = document.getElementById('pf-additives')?.value || '';
    data.productPH = document.getElementById('pf-productPH')?.value || '';
    data.waterActivity = document.getElementById('pf-waterActivity')?.value || '';
    data.intendedUse = document.getElementById('pf-intendedUse')?.value || '';
    data.storageCondition = document.getElementById('pf-storageCondition')?.value || '';
    data.packagingMethod = document.getElementById('pf-packagingMethod')?.value || '';
    data.targetConsumer = document.getElementById('pf-targetConsumer')?.value || '';
    data.shelfLife = document.getElementById('pf-shelfLife')?.value || '';

    // 收集HACCP小组
    data.haccpTeam = [];
    document.querySelectorAll('#pf-teamBody tr').forEach(function(tr) {
      var inputs = tr.querySelectorAll('input');
      if (inputs.length >= 5) {
        data.haccpTeam.push({
          id: genId(),
          name: inputs[0].value,
          dept: inputs[1].value,
          position: inputs[2].value,
          role: inputs[3].value,
          remark: inputs[4].value
        });
      }
    });

    // 收集其他项目（企业）
    data.extraItems = [];
    document.querySelectorAll('#pf-extraBody tr').forEach(function(tr) {
      var inputs = tr.querySelectorAll('input');
      if (inputs.length >= 2) {
        data.extraItems.push({ id: genId(), key: inputs[0].value, value: inputs[1].value });
      }
    });

    // 收集其他项目（产品）
    data.productExtraItems = [];
    document.querySelectorAll('#pf-peBody tr').forEach(function(tr) {
      var inputs = tr.querySelectorAll('input');
      if (inputs.length >= 2) {
        data.productExtraItems.push({ id: genId(), key: inputs[0].value, value: inputs[1].value });
      }
    });

    return data;
  }

  function bindProfileEvents(data) {
    // 添加小组行
    document.getElementById('pf-addTeam')?.addEventListener('click', function() {
      data = collectProfileData();
      data.haccpTeam.push({ id: genId(), name: '', dept: '', position: '', role: '', remark: '' });
      saveAndRender(data);
    });

    // 删除小组行
    document.querySelectorAll('#pf-teamBody .pf-del-team').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var idx = parseInt(this.dataset.teamIdx);
        data = collectProfileData();
        if (data.haccpTeam.length > 1) {
          data.haccpTeam.splice(idx, 1);
          saveAndRender(data);
        }
      });
    });

    // 添加企业其他项目
    document.getElementById('pf-addExtra')?.addEventListener('click', function() {
      data = collectProfileData();
      data.extraItems.push({ id: genId(), key: '', value: '' });
      saveAndRender(data);
    });

    // 删除企业其他项目
    document.querySelectorAll('#pf-extraBody .pf-del-ex').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var idx = parseInt(this.dataset.exIdx);
        data = collectProfileData();
        if (data.extraItems.length > 0) {
          data.extraItems.splice(idx, 1);
          saveAndRender(data);
        }
      });
    });

    // 添加产品其他项目
    document.getElementById('pf-addPE')?.addEventListener('click', function() {
      data = collectProfileData();
      data.productExtraItems.push({ id: genId(), key: '', value: '' });
      saveAndRender(data);
    });

    // 删除产品其他项目
    document.querySelectorAll('#pf-peBody .pf-del-pe').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var idx = parseInt(this.dataset.pExIdx);
        data = collectProfileData();
        if (data.productExtraItems.length > 0) {
          data.productExtraItems.splice(idx, 1);
          saveAndRender(data);
        }
      });
    });

    // 保存按钮
    document.getElementById('profileSaveBtn')?.addEventListener('click', function() {
      data = collectProfileData();
      saveData(data);
      syncToQuestionnaire(data);
      var btn = this;
      btn.textContent = '✅ 已保存！';
      btn.style.background = 'linear-gradient(135deg, #22c55e, #16a34a)';
      setTimeout(function() {
        btn.textContent = '💾 保存档案';
        btn.style.background = '';
      }, 2000);
    });
  }

  function saveAndRender(data) {
    saveData(data);
    init();
  }

  return { init: init, loadData: loadData };
})();