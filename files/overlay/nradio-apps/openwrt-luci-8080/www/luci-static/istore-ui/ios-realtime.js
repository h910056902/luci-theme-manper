/* ==========================================================================
   ios-realtime.js · 实时负载 SVG 主题注入
   图表是 <embed id="bwsvg"> 加载的同源外部 SVG 文档，父页 CSS 进不去。
   LuCI 原厂脚本把网格写成 inline style="stroke:black;stroke-width:0.1"、
   坐标文字写成 fill:#999999，这里用带 !important 的 <style> 注入 SVG 文档，
   只改网格/文字/背景与线宽，不改三条曲线的原始配色（保留图例语义）。
   ========================================================================== */
(function () {
	'use strict';
	var CSS = [
		'svg{background:transparent}',
		'line{stroke:rgba(30,50,90,.10)!important;stroke-width:.6!important}',
		'text{fill:#8898aa!important;font-size:9px!important;' +
			'font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif}',
		'rect{fill:rgba(0,96,255,.035)}',
		'polyline,path{stroke-width:2!important;stroke-linejoin:round!important;stroke-linecap:round!important}'
	].join('\n');

	var tries = 0;
	function patch() {
		var e = document.getElementById('bwsvg');
		if (!e) return;
		var d = null;
		try { d = e.getSVGDocument(); } catch (err) { return; }
		if (!d || !d.documentElement) {
			if (tries++ < 20) setTimeout(patch, 350);
			return;
		}
		if (d.documentElement.getAttribute('data-kp-themed')) return;
		var st = d.createElementNS('http://www.w3.org/2000/svg', 'style');
		st.setAttribute('type', 'text/css');
		st.textContent = CSS;
		d.documentElement.appendChild(st);
		d.documentElement.setAttribute('data-kp-themed', '1');
	}

	patch();
	window.addEventListener('load', patch);
	var embed = document.getElementById('bwsvg');
	if (embed) embed.addEventListener('load', patch);
	/* embed 文档被重建时低频兜底，8 次后停止 */
	var n = 0;
	var timer = setInterval(function () {
		if (++n > 8) { clearInterval(timer); return; }
		patch();
	}, 1200);
})();
