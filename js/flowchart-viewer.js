/**
 * 流程图查看器模块
 * 使用 Mermaid.js 渲染工艺流程图，支持表格编辑器全面编辑
 */
const FlowchartViewer = (() => {

  var editMode = false;
  var currentSource = '';

  function init() {
    var container = document.getElementById('flowchartContainer');
    if (!container) return;
    editMode = false;

    var saved = null;
    try { saved = localStorage.getItem('haccp_flowchart_mermaid'); } catch(e) {}
    if (saved) {
      currentSource = saved;
    } else if (window.INULIN_FLOWCHART) {
      currentSource = window.INULIN_FLOWCHART.mermaid;
    } else {
      container.innerHTML = '<div class="fc-error"><div class="fc-error-icon">⚠️</div><h3>数据错误</h3><p>流程图数据未定义</p></div>';
      return;
    }

    if (typeof mermaid === 'undefined') {
      container.innerHTML = '<div class="fc-loading"><div class="fc-spinner"></div><p>正在加载 Mermaid 渲染引擎...</p></div>';
      setTimeout(function() {
        if (typeof mermaid === 'undefined') {
          container.innerHTML = '<div class="fc-error"><div class="fc-error-icon">⚠️</div><h3>加载失败</h3><p>无法加载 Mermaid 渲染库</p></div>';
        } else {
          renderView(container);
        }
      }, 6000);
      return;
    }

    renderView(container);
  }

  function renderView(container) {
    container.innerHTML = '';

    var toolbar = document.createElement('div');
    toolbar.className = 'fc-toolbar';
    var btnText = editMode ? '📖 预览流程图' : '✏️ 编辑流程图';
    toolbar.innerHTML = '<button class="btn btn-sm btn-secondary" id="fcToggleEdit">' + btnText + '</button>'
      + '<span class="fc-toolbar-info" id="fcToolbarInfo">' + (editMode ? '修改后点击"预览流程图"查看效果' : '') + '</span>';
    container.appendChild(toolbar);

    if (editMode) {
      renderFullEditor(container);
    } else {
      renderChart(container);
    }

    var toggleBtn = document.getElementById('fcToggleEdit');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', function() {
        if (editMode) {
          var ta = document.getElementById('fcFullSourceEditor');
          if (ta) currentSource = ta.value;
        }
        editMode = !editMode;
        renderView(container);
      });
    }
  }

  // ===== 完整编辑器：节点表格 + 箭头表格 + 源码编辑 =====
  function renderFullEditor(container) {
    var parsed = parseFull(currentSource);

    // --- Tab 切换 ---
    var tabs = document.createElement('div');
    tabs.className = 'fc-editor-tabs';
    tabs.innerHTML = '<button class="fc-editor-tab active" data-tab="nodes">步骤节点</button>'
      + '<button class="fc-editor-tab" data-tab="edges">箭头标签</button>'
      + '<button class="fc-editor-tab" data-tab="source">源码</button>';
    container.appendChild(tabs);

    // --- 节点面板 ---
    var panelNodes = document.createElement('div');
    panelNodes.className = 'fc-editor-panel active';

    var helpN = document.createElement('div');
    helpN.className = 'fc-editor-help';
    helpN.innerHTML = '编辑所有节点名称（主步骤 + 物料输入/废渣输出），修改后点击底部「应用修改」保存。';
    panelNodes.appendChild(helpN);

    var tableN = document.createElement('table');
    tableN.className = 'fc-node-table';
    tableN.innerHTML = '<thead><tr><th style="width:50px">#</th><th>ID</th><th>节点文字</th><th style="width:80px">类型</th><th style="width:40px"></th></tr></thead><tbody id="fcNodeBody"></tbody></table>';
    panelNodes.appendChild(tableN);

    var addRowBtn = document.createElement('button');
    addRowBtn.className = 'btn btn-sm btn-secondary';
    addRowBtn.style.margin = '8px 0';
    addRowBtn.textContent = '+ 添加节点行';
    addRowBtn.addEventListener('click', function() {
      var tbody = document.getElementById('fcNodeBody');
      if (!tbody) return;
      var tr = document.createElement('tr');
      var idx = tbody.children.length + 1;
      tr.innerHTML = '<td></td><td><input class="fc-input-id" value="NEW' + idx + '" style="width:80px;font-size:12px" /></td>'
        + '<td><input class="fc-input-label" value="新步骤' + idx + '" style="width:100%" /></td>'
        + '<td><select class="fc-input-type"><option value="step">步骤</option><option value="ccp">CCP</option><option value="oprp">OPRP</option><option value="cqp">CQP</option><option value="io">IO</option></select></td>'
        + '<td><button class="fc-btn-del">✕</button></td>';
      var delBtn = tr.querySelector('.fc-btn-del');
      delBtn.addEventListener('click', function() { tr.remove(); });
      tbody.appendChild(tr);
    });
    panelNodes.appendChild(addRowBtn);

    container.appendChild(panelNodes);

    // 填充节点行
    var tbodyN = document.getElementById('fcNodeBody');
    for (var i = 0; i < parsed.nodes.length; i++) {
      var n = parsed.nodes[i];
      var tr = document.createElement('tr');
      tr.innerHTML = '<td>' + (i + 1) + '</td><td><code style="font-size:12px">' + n.id + '</code></td>'
        + '<td><input class="fc-input-label" data-nodeid="' + n.id + '" value="' + n.label.replace(/"/g,'"') + '" style="width:100%" oninput="window._fcMarkDirty && window._fcMarkDirty()" /></td>'
        + '<td><span class="fc-node-badge ' + n.type + '">' + n.type.toUpperCase() + '</span></td>'
        + '<td><button class="fc-btn-del" data-id="' + n.id + '" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:16px">✕</button></td>';
      tbodyN.appendChild(tr);
    }

    // --- 箭头标签面板 ---
    var panelEdges = document.createElement('div');
    panelEdges.className = 'fc-editor-panel';

    var helpE = document.createElement('div');
    helpE.className = 'fc-editor-help';
    helpE.innerHTML = '编辑连接线上的说明文字。留空表示不显示文字。';
    panelEdges.appendChild(helpE);

    var tableE = document.createElement('table');
    tableE.className = 'fc-node-table';
    tableE.innerHTML = '<thead><tr><th style="width:50px">#</th><th>连接</th><th>线上文字</th><th style="width:40px"></th></tr></thead><tbody id="fcEdgeBody"></tbody></table>';
    panelEdges.appendChild(tableE);

    var addEdgeBtn = document.createElement('button');
    addEdgeBtn.className = 'btn btn-sm btn-secondary';
    addEdgeBtn.style.margin = '8px 0';
    addEdgeBtn.textContent = '+ 添加连线文字';
    addEdgeBtn.addEventListener('click', function() {
      var tb = document.getElementById('fcEdgeBody');
      if (!tb) return;
      var idx = tb.children.length + 1;
      var tr = document.createElement('tr');
      tr.innerHTML = '<td></td><td><input class="fc-edge-input" value="A-->B" style="width:120px;font-size:12px" /></td>'
        + '<td><input class="fc-edge-label" value="" style="width:100%" /></td>'
        + '<td><button class="fc-btn-del" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:16px">✕</button></td>';
      tr.querySelector('.fc-btn-del').addEventListener('click', function() { tr.remove(); });
      tb.appendChild(tr);
    });
    panelEdges.appendChild(addEdgeBtn);

    container.appendChild(panelEdges);

    // 填充箭头行
    var tbodyE = document.getElementById('fcEdgeBody');
    for (var i = 0; i < parsed.edges.length; i++) {
      var e = parsed.edges[i];
      var tr = document.createElement('tr');
      tr.innerHTML = '<td>' + (i + 1) + '</td><td><code style="font-size:12px">' + e.from + ' → ' + e.to + '</code></td>'
        + '<td><input class="fc-edge-label" data-edge="' + e.from + '|' + e.to + '" value="' + (e.label || '') + '" style="width:100%" /></td>'
        + '<td><button class="fc-btn-del" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:16px">✕</button></td>';
      tbodyE.appendChild(tr);
    }

    // --- 源码面板 ---
    var panelSource = document.createElement('div');
    panelSource.className = 'fc-editor-panel';
    var helpS = document.createElement('div');
    helpS.className = 'fc-editor-help';
    helpS.innerHTML = '直接编辑 Mermaid 完整源码。语法参考 <a href="https://mermaid.js.org/syntax/flowchart.html" target="_blank">Mermaid 文档</a>';
    panelSource.appendChild(helpS);
    var ta = document.createElement('textarea');
    ta.id = 'fcFullSourceEditor';
    ta.className = 'fc-editor-textarea';
    ta.value = currentSource;
    panelSource.appendChild(ta);
    container.appendChild(panelSource);

    // --- 底部操作栏 ---
    var actions = document.createElement('div');
    actions.className = 'fc-editor-actions';
    actions.style.marginTop = '16px';
    actions.innerHTML = '<button class="btn btn-primary btn-sm" id="fcApplyAll">✅ 应用修改</button>'
      + '<button class="btn btn-secondary btn-sm" id="fcResetSrc">↩️ 恢复默认</button>'
      + '<span class="fc-editor-status" id="fcEditStatus"></span>';
    container.appendChild(actions);

    // --- Tab 切换绑定 ---
    var tabBtns = tabs.querySelectorAll('.fc-editor-tab');
    for (var t = 0; t < tabBtns.length; t++) {
      tabBtns[t].addEventListener('click', function() {
        tabs.querySelectorAll('.fc-editor-tab').forEach(function(b) { b.classList.remove('active'); });
        this.classList.add('active');
        container.querySelectorAll('.fc-editor-panel').forEach(function(p) { p.classList.remove('active'); });
        var panel = container.querySelector('.fc-editor-panel[data-tab="' + this.dataset.tab + '"]');
        if (!panel) {
          // data-tab 未设置，用索引匹配
          var panels = container.querySelectorAll('.fc-editor-panel');
          var idx = Array.prototype.indexOf.call(tabBtns, this);
          if (panels[idx]) panels[idx].classList.add('active');
        } else {
          panel.classList.add('active');
        }
        // 修正：不支持 data-tab 属性，用顺序匹配
        var allPanels = container.querySelectorAll('.fc-editor-panel');
        allPanels.forEach(function(p) { p.classList.remove('active'); });
        var idx2 = Array.prototype.indexOf.call(tabBtns, this);
        if (allPanels[idx2]) allPanels[idx2].classList.add('active');
      });
    }

    // 标记脏数据
    window._fcMarkDirty = function() {
      var st = document.getElementById('fcEditStatus');
      if (st) st.textContent = '⚠️ 有未应用的修改';
    };

    // 应用修改
    document.getElementById('fcApplyAll').addEventListener('click', function() {
      applyEdits(container);
    });

    // 恢复默认
    document.getElementById('fcResetSrc').addEventListener('click', function() {
      if (window.INULIN_FLOWCHART && window.INULIN_FLOWCHART.mermaid) {
        currentSource = window.INULIN_FLOWCHART.mermaid;
        try { localStorage.removeItem('haccp_flowchart_mermaid'); } catch(e) {}
        document.getElementById('fcEditStatus').textContent = '✅ 已恢复默认，点击预览查看';
      }
    });
  }

  // ===== 将表格修改应用到源码 =====
  function applyEdits(container) {
    var fullSource = currentSource;
    var changes = 0;

    // 1. 节点文字修改
    var labelInputs = container.querySelectorAll('.fc-input-label');
    labelInputs.forEach(function(inp) {
      var nodeId = inp.dataset.nodeid;
      var newLabel = inp.value.trim();
      if (!nodeId || !newLabel) return;

      // 查找源码中的定义
      var lines = fullSource.split('\n');
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        var match = line.match(new RegExp('^' + nodeId + '\\["(.+?)"\\]'));
        if (match) {
          var oldLabel = match[1];
          if (oldLabel !== newLabel) {
            var oldLine = nodeId + '["' + oldLabel + '"]';
            var newLine = nodeId + '["' + newLabel + '"]';
            fullSource = fullSource.split(oldLine).join(newLine);
            changes++;
          }
          break;
        }
      }
    });

    // 2. 箭头标签修改
    var edgeInputs = container.querySelectorAll('.fc-edge-label');
    edgeInputs.forEach(function(inp) {
      var edge = inp.dataset.edge;
      var newLabel = inp.value.trim();
      if (!edge) return;
      var parts = edge.split('|');
      if (parts.length !== 2) return;
      var from = parts[0], to = parts[1];

      var lines = fullSource.split('\n');
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        var trimmed = line.trim();
        // 匹配 from -->|xxx| to 或 from -.->|xxx| to
        var arrowRegex = new RegExp('^' + from + '\\s*[-=.]+>\\|(.+?)\\|\\s*' + to + '$');
        var m = trimmed.match(arrowRegex);
        if (m) {
          var oldLabel = m[1];
          if (newLabel === '') {
            // 去掉标签：A-->|xxx| B → A--> B
            fullSource = fullSource.split(trimmed).join(from + ' --> ' + to);
          } else if (oldLabel !== newLabel) {
            fullSource = fullSource.split('|' + oldLabel + '|').join('|' + newLabel + '|');
          }
          changes++;
          break;
        }
      }
    });

    // 3. 如果源码面板有修改，合并
    var ta = document.getElementById('fcFullSourceEditor');
    if (ta && ta.value !== currentSource) {
      fullSource = ta.value;
      changes++;
    }

    if (changes > 0) {
      currentSource = fullSource;
      try { localStorage.setItem('haccp_flowchart_mermaid', currentSource); } catch(e) {}
      document.getElementById('fcEditStatus').textContent = '✅ 已应用 ' + changes + ' 处修改，点击「预览流程图」查看';
    } else {
      document.getElementById('fcEditStatus').textContent = 'ℹ️ 未检测到修改';
    }
  }

  // ===== 解析节点 + 箭头 =====
  function parseFull(src) {
    var nodes = [];
    var edges = [];
    var lines = src.split('\n');
    var nodeRegex = /^(\w+)\["(.+?)"\]/;
    var edgeRegex = /^(\w+)\s*[-=.]+>\s*(?:\|(.+?)\|)?\s*(\w+)/;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line || line.startsWith('%%') || line.startsWith('graph') || line.startsWith('classDef')) continue;

      var m = line.match(nodeRegex);
      if (m) {
        var id = m[1];
        var label = m[2];
        // 跳过文字标注
        if (id === 'loop_text' || id === 'L6_text' || id === 'L7_text' || id === 'R2_text' || id === 'R3_text') continue;
        var type = 'step';
        if (line.indexOf(':::ccp') > -1) type = 'ccp';
        else if (line.indexOf(':::oprp') > -1) type = 'oprp';
        else if (line.indexOf(':::cqp') > -1) type = 'cqp';
        else if (line.indexOf(':::io') > -1) type = 'io';
        nodes.push({ id: id, label: label, type: type });
        continue;
      }

      var e = line.match(edgeRegex);
      if (e) {
        edges.push({ from: e[1], to: e[3], label: e[2] || '' });
      }
    }

    return { nodes: nodes, edges: edges };
  }

  // ===== 渲染 Mermaid 图表 =====
  function renderChart(container) {
    var chartDiv = document.createElement('div');
    chartDiv.className = 'mermaid';
    chartDiv.textContent = currentSource;
    container.appendChild(chartDiv);

    var legend = document.createElement('div');
    legend.className = 'fc-legend';
    legend.innerHTML = '<div class="fc-legend-title">图 例</div><div class="fc-legend-items">'
      + '<div class="fc-legend-item"><span class="fc-legend-dot ccp"></span>CCP - 关键控制点</div>'
      + '<div class="fc-legend-item"><span class="fc-legend-dot oprp"></span>OPRP - 操作性前提方案</div>'
      + '<div class="fc-legend-item"><span class="fc-legend-dot cqp"></span>CQP - 关键质量点</div>'
      + '<div class="fc-legend-item"><span class="fc-legend-dot io"></span>输入/输出/副产物</div>'
      + '</div>';
    container.appendChild(legend);

    var hint = document.createElement('div');
    hint.className = 'fc-viewer-hint';
    hint.textContent = '🖱️ 滚轮缩放 · 拖拽平移 · 点击 ✏️ 编辑流程图 进行完整编辑';
    container.appendChild(hint);

    try {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'default',
        themeVariables: { fontFamily: 'sans-serif', fontSize: '14px' },
        flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis', padding: 16 }
      });
      setTimeout(function() {
        mermaid.run({ nodes: [chartDiv] }).catch(function(err) {
          container.innerHTML = '<div class="fc-error"><div class="fc-error-icon">⚠️</div><h3>渲染失败</h3><p>' + (err.message || err) + '</p></div>';
        });
      }, 100);
    } catch(err) {
      container.innerHTML = '<div class="fc-error"><div class="fc-error-icon">⚠️</div><h3>初始化失败</h3><p>' + (err.message || err) + '</p></div>';
    }
  }

  function destroy() {
    var container = document.getElementById('flowchartContainer');
    if (container) container.innerHTML = '';
  }

  return { init: init, destroy: destroy };
})();

if (typeof window !== 'undefined') {
  window.FlowchartViewer = FlowchartViewer;
}