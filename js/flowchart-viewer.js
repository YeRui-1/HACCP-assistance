/**
 * 流程图查看器模块
 * 使用 Mermaid.js 在浏览器端渲染 SVG 工艺流程图
 */
const FlowchartViewer = (() => {

  function init() {
    var container = document.getElementById('flowchartContainer');
    if (!container) return;

    // 检查 Mermaid 库
    if (typeof mermaid === 'undefined') {
      container.innerHTML = '<div class="fc-loading"><div class="fc-spinner"></div><p>正在加载 Mermaid 渲染引擎...</p></div>';
      setTimeout(function() {
        if (typeof mermaid === 'undefined') {
          container.innerHTML = '<div class="fc-error"><div class="fc-error-icon">⚠️</div><h3>加载失败</h3><p>无法加载 Mermaid 渲染库，请检查网络连接</p></div>';
        } else {
          renderChart(container);
        }
      }, 6000);
      return;
    }

    renderChart(container);
  }

  function renderChart(container) {
    container.innerHTML = '';

    // 读数据
    var data = window.INULIN_FLOWCHART;
    if (!data || !data.mermaid) {
      container.innerHTML = '<div class="fc-error"><div class="fc-error-icon">⚠️</div><h3>数据错误</h3><p>流程图数据未定义 (window.INULIN_FLOWCHART 不存在)</p></div>';
      return;
    }

    // 创建 mermaid div
    var chartDiv = document.createElement('div');
    chartDiv.className = 'mermaid';
    chartDiv.textContent = data.mermaid;
    container.appendChild(chartDiv);

    // 图例
    var legend = document.createElement('div');
    legend.className = 'fc-legend';
    legend.innerHTML = '<div class="fc-legend-title">图 例</div><div class="fc-legend-items">'
      + '<div class="fc-legend-item"><span class="fc-legend-dot ccp"></span>CCP - 关键控制点</div>'
      + '<div class="fc-legend-item"><span class="fc-legend-dot oprp"></span>OPRP - 操作性前提方案</div>'
      + '<div class="fc-legend-item"><span class="fc-legend-dot cqp"></span>CQP - 关键质量点</div>'
      + '<div class="fc-legend-item"><span class="fc-legend-dot io"></span>输入/输出/副产物</div>'
      + '</div>';
    container.appendChild(legend);

    // 操作提示
    var hint = document.createElement('div');
    hint.className = 'fc-viewer-hint';
    hint.textContent = '🖱️ 滚轮缩放 · 拖拽平移';
    if (window.I18n && I18n.t) hint.textContent = I18n.t('fc.hint');
    container.appendChild(hint);

    // 配置并渲染 Mermaid
    try {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'default',
        themeVariables: {
          fontFamily: 'sans-serif',
          fontSize: '14px'
        },
        flowchart: {
          useMaxWidth: true,
          htmlLabels: true,
          curve: 'basis',
          padding: 16
        }
      });

      // 延迟一帧确保 DOM 已追加
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