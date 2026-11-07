/* ==========================================================================
   ios-ocspeed.js · 自动测速页功能可达性增强
   只在 /admin/services/openclash/ocspeed 条件加载。不改第三方逻辑，只补三件事：
   1) 顶部快捷导航（设置 / 日志 / 排行 / 顶部），避免为点「保存设置」滚 3700px
   2) 设置展开时把保存按钮吸底，日志/排行锚点高亮
   3) 回到顶部悬浮按钮
   ========================================================================== */
(function () {
	'use strict';
	var body = document.querySelector('.ocspeed-body');
	if (!body) return;

	var header = body.querySelector(':scope > header');
	var cfg = document.getElementById('cfgBox');
	var save = document.getElementById('btnSave');
	var logPanel = Array.prototype.slice.call(body.querySelectorAll('section.panel')).filter(function (p) {
		return /运行日志/.test(p.textContent || '');
	})[0];
	var rankPanel = Array.prototype.slice.call(body.querySelectorAll('section.panel')).filter(function (p) {
		return /节点排行/.test(p.textContent || '');
	})[0];

	/* 全站放开一屏后 .ocspeed-body 不再是滚动容器，改用页面级滚动。
	   sticky 顶栏约 56px，额外留 14px 呼吸空间。 */
	function jump(el, expand) {
		if (!el) return;
		if (expand && el.tagName === 'DETAILS' && !el.open) {
			var s = el.querySelector('summary');
			if (s) s.click();
		}
		var r = el.getBoundingClientRect();
		window.scrollTo({ top: Math.max(0, window.scrollY + r.top - 70), behavior: 'smooth' });
	}

	/* ---------- 顶部快捷导航 ---------- */
	if (header && !header.querySelector('.oc-quick')) {
		var bar = document.createElement('div');
		bar.className = 'oc-quick';
		bar.innerHTML = [
			'<button type="button" data-jump="rank"><i class="fas fa-list-ol" aria-hidden="true"></i> 排行</button>',
			'<button type="button" data-jump="cfg"><i class="fas fa-sliders-h" aria-hidden="true"></i> 设置</button>',
			'<button type="button" data-jump="log"><i class="fas fa-scroll" aria-hidden="true"></i> 日志</button>',
			'<button type="button" data-jump="gemini"><i class="fas fa-robot" aria-hidden="true"></i> Gemini</button>'
		].join('');
		header.appendChild(bar);
		bar.addEventListener('click', function (ev) {
			var b = ev.target;
			while (b && b !== bar && b.tagName !== 'BUTTON') b = b.parentNode;
			if (!b || b === bar) return;
			var k = b.getAttribute('data-jump');
			if (k === 'cfg') jump(cfg, true);
			else if (k === 'log') jump(logPanel, false);
			else if (k === 'gemini') jump(document.getElementById('backupCard'), false);
			else jump(rankPanel, false);
			Array.prototype.forEach.call(bar.querySelectorAll('button'), function (x) {
				x.classList.toggle('on', x === b);
			});
		});
	}

	/* ---------- 保存按钮：仅设置展开时悬浮常驻 ---------- */
	if (save && cfg) {
		var syncSave = function () { save.classList.toggle('oc-save-sticky', !!cfg.open); };
		cfg.addEventListener('toggle', syncSave);
		syncSave();
	}

	/* ---------- 回到顶部 ---------- */
	var top = document.createElement('button');
	top.type = 'button';
	top.className = 'oc-totop';
	top.innerHTML = '<i class="fas fa-arrow-up" aria-hidden="true"></i> 顶部';
	top.title = '回到顶部';
	document.body.appendChild(top);
	top.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
	function syncTop() { top.classList.toggle('show', window.scrollY > 420); }
	window.addEventListener('scroll', syncTop, { passive: true });
	syncTop();

	/* 供验收脚本读取 */
	window.OcQuick = {
		buttons: function () { return bar ? bar.querySelectorAll('button').length : 0; },
		jumpTo: function (k) {
			if (k === 'cfg') jump(cfg, true);
			else if (k === 'log') jump(logPanel, false);
			else if (k === 'gemini') jump(document.getElementById('backupCard'), false);
			else jump(rankPanel, false);
		},
		cfgOpen: function () { return !!(cfg && cfg.open); },
		scrollTop: function () { return Math.round(window.scrollY); },
		totopVisible: function () { return top.classList.contains('show'); }
	};
})();
