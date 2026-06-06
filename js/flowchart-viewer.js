/**
 * 流程图查看器模块
 * 使用 Mermaid.js 渲染工艺流程图，支持图像节点编辑和源码编辑
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
      container.innerHTML = '<div class="fc-error"><div class="fc-error-icon">&#9888;</div><h3>数据错误</h3><p>流程图数据未定义</p></div>';
      return;
    }

    if (typeof mermaid === 'undefined') {
      container.innerHTML = '<div class="fc-loading"><div class="fc-spinner"></div><p>正在加载 Mermaid 渲染引擎...</p></div>';
      setTimeout(function() {
        if (typeof mermaid === 'undefined') {
          container.innerHTML = '<div class="fc-error"><div class="fc-error-icon">&#9888;</div><h3>加载失败</h3><p>无法加载 Mermaid 渲染库</p></div>';
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
    var btnText = editMode ? '预览流程图' : '编辑步骤名称';
    toolbar.innerHTML = '<button class="btn btn-sm btn-secondary" id="fcToggleEdit">' + (editMode ? '&#128214; ' : '&#9998; ') + btnText + '</button>'
      + '<span class="fc-toolbar-info" id="fcToolbarInfo">' + (editMode ? '修改后自动生效，无需手动保存' : '点击进入编辑模式，双击图像节点也可编辑') + '</span>';
    container.appendChild(toolbar);

    if (editMode) {
      renderNodeEditor(container);
    } else {
      renderChart(container);
    }

    var toggleBtn = document.getElementById('fcToggleEdit');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', function() {
        editMode = !editMode;
        renderView(container);
      });
    }
  }

  function renderNodeEditor(container) {
    var nodes = parseNodes(currentSource);

    var help = document.createElement('div');
    help.className = 'fc-editor-help';
    help.innerHTML = '修改步骤名称后自动更新流程图。还可 <a href="#" id="fcShowRawEditor">编辑完整 Mermaid 源码</a> 或 <a href="#" id="fcResetFromEditor">恢复默认</a>';
    container.appendChild(help);

    var table = document.createElement('table');
    table.className = 'fc-node-table';
    table.innerHTML = '<thead><tr><th style="width:50px">编号</th><th>步骤名称</th><th style="width:100px">类型</th></tr></thead><tbody id="fcNodeTableBody"></tbody>';
    container.appendChild(table);

    var tbody = document.getElementById('fcNodeTableBody');
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      var tr = document.createElement('tr');
      tr.innerHTML = '<td>' + (i + 1) + '</td>'
        + '<td><input type="text" class="fc-node-input" data-nodeid="' + node.id + '" value="' + node.label.replace(/"/g,'"').replace(/&/g,'&').replace(/</g,'<').replace(/>/g,'>') + '" /></td>'
        + '<td><span class="fc-node-badge ' + node.type + '">' + node.type.toUpperCase() + '</span></td>';
      tbody.appendChild(tr);
    }

    var rawDiv = document.createElement('div');
    rawDiv.id = 'fcRawEditorWrap';
    rawDiv.style.display = 'none';
    rawDiv.style.marginTop = '16px';
    rawDiv.innerHTML = '<label style="font-size:13px;font-weight:600;color:var(--gray-600)">Mermaid 源码编辑：</label>'
      + '<textarea id="fcRawEditor" class="fc-editor-textarea" style="min-height:250px">' + currentSource.replace(/</g,'<').replace(/>/g,'>') + '</textarea>'
      + '<div class="fc-editor-actions" style="margin-top:8px">'
      + '<button class="btn btn-primary btn-sm" id="fcRawApply"> 应用</button>'
      + '<span class="fc-editor-status" id="fcRawStatus"></span></div>';
    container.appendChild(rawDiv);

    var inputs = tbody.querySelectorAll('.fc-node-input');
    for (var j = 0; j < inputs.length; j++) {
      inputs[j].addEventListener('input', function() {
        updateSourceFromNodes(nodes);
      });
    }

    document.getElementById('fcShowRawEditor').addEventListener('click', function(e) {
      e.preventDefault();
      var wrap = document.getElementById('fcRawEditorWrap');
      document.getElementById('fcRawEditor').value = currentSource;
      wrap.style.display = wrap.style.display === 'none' ? 'block' : 'none';
    });

    document.getElementById('fcRawApply').addEventListener('click', function() {
      var newSrc = document.getElementById('fcRawEditor').value;
      if (!newSrc || newSrc.trim() === '') {
        document.getElementById('fcRawStatus').textContent = ' 内容为空';
        return;
      }
      currentSource = newSrc;
      try { localStorage.setItem('haccp_flowchart_mermaid', newSrc); } catch(e) {}
      document.getElementById('fcRawStatus').textContent = ' 已保存';
      renderView(container);
    });

    document.getElementById('fcResetFromEditor').addEventListener('click', function(e) {
      e.preventDefault();
      if (window.INULIN_FLOWCHART && window.INULIN_FLOWCHART.mermaid) {
        currentSource = window.INULIN_FLOWCHART.mermaid;
        try { localStorage.removeItem('haccp_flowchart_mermaid'); } catch(e) {}
        renderView(container);
      }
    });
  }

  function updateSourceFromNodes(nodes) {
    var inputs = document.querySelectorAll('.fc-node-input');
    var newSource = currentSource;

    for (var i = 0; i < inputs.length; i++) {
      var nodeId = inputs[i].dataset.nodeid;
      var newLabel = inputs[i].value.trim();
      if (!newLabel) continue;

      for (var j = 0; j < nodes.length; j++) {
        if (nodes[j].id === nodeId) {
          var oldDef = nodeId + '["' + nodes[j].label + '"]';
          var newDef = nodeId + '["' + newLabel + '"]';
          newSource = newSource.split(oldDef).join(newDef);
          nodes[j].label = newLabel;
          break;
        }
      }
    }

    if (newSource !== currentSource) {
      currentSource = newSource;
      try { localStorage.setItem('haccp_flowchart_mermaid', currentSource); } catch(e) {}
      var info = document.getElementById('fcToolbarInfo');
      if (info) info.textContent = ' 已自动更新';
    }
  }

  function parseNodes(src) {
    var nodes = [];
    var lines = src.split('\n');
    var regex = /^(\w+)\["(.+?)"\]/;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line || line.startsWith('%%') || line.startsWith('graph') || line.startsWith('classDef')) continue;
      var match = line.match(regex);
      if (match) {
        var id = match[1];
        var label = match[2];
        var type = 'step';
        if (line.indexOf(':::ccp') > -1) type = 'ccp';
        else if (line.indexOf(':::oprp') > -1) type = 'oprp';
        else if (line.indexOf(':::cqp') > -1) type = 'cqp';
        else if (line.indexOf(':::io') > -1) type = 'io';
        if (id.endsWith('_sub') || id.endsWith('_waste') || id.endsWith('_out') || id.endsWith('_in') || id === 'loop_text' || id === 'L6_text' || id === 'L7_text' || id === 'R2_text' || id === 'R3_text') continue;
        nodes.push({ id: id, label: label, type: type });
      }
    }
    return nodes;
  }

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
    hint.textContent = '滚轮缩放 - 拖拽平移 - 双击节点可编辑 - 点击编辑步骤名称批量修改';
    container.appendChild(hint);

    try {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'default',
        themeVariables: { fontFamily: 'sans-serif', fontSize: '14px' },
        flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis', padding: 16 }
      });
      setTimeout(function() {
        mermaid.run({ nodes: [chartDiv] }).then(function() {
          addDoubleClickEdit(container);
        }).catch(function(err) {
          container.innerHTML = '<div class="fc-error"><div class="fc-error-icon">&#9888;</div><h3>渲染失败</h3><p>' + (err.message || err) + '</p></div>';
        });
      }, 100);
    } catch(err) {
      container.innerHTML = '<div class="fc-error"><div class="fc-error-icon">&#9888;</div><h3>初始化失败</h3><p>' + (err.message || err) + '</p></div>';
    }
  }

  function addDoubleClickEdit(container) {
    var svg = container.querySelector('svg');
    if (!svg) return;

    var nodeGroups = svg.querySelectorAll('g.node');
    for (var i = 0; i < nodeGroups.length; i++) {
      var g = nodeGroups[i];
      g.style.cursor = 'pointer';
      g.title = '双击编辑此步骤';
      g.addEventListener('dblclick', function(e) {
        e.stopPropagation();
        var textEl = this.querySelector('text');
        if (!textEl) return;
        var oldText = textEl.textContent;
        var displayText = oldText;
        var match = oldText.match(/^\d+\.\s*(.*)/);
        if (match) displayText = match[1];

        var newText = prompt('编辑步骤名称：', displayText);
        if (newText && newText.trim() !== '' && newText !== displayText) {
          var oldFull = oldText;
          var lines = currentSource.split('\n');
          var found = false;
          for (var j = 0; j < lines.length; j++) {
            var line = lines[j].trim();
            if (line.indexOf('"' + oldFull + '"') > -1) {
              var newLine = line.replace('"' + oldFull + '"', '"' + newText + '"');
              currentSource = currentSource.split(line).join(newLine);
              found = true;
              break;
            }
          }
          if (found) {
            try { localStorage.setItem('haccp_flowchart_mermaid', currentSource); } catch(ex) {}
            var c = document.getElementById('flowchartContainer');
            if (c) renderView(c);
          }
        }
      });
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