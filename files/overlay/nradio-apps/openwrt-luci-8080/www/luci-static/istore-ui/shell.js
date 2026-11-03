/* istore-ui · 外壳交互：抽屉菜单 / 时钟 / 菜单高亮兜底 */
(function () {
	'use strict';
	var body = document.body;
	var burger = document.getElementById('iosBurger');
	var backdrop = document.getElementById('iosBackdrop');

	function closeDrawer() { body.classList.remove('ios-drawer'); }

	if (burger) {
		burger.addEventListener('click', function () {
			body.classList.toggle('ios-drawer');
		});
	}
	if (backdrop) backdrop.addEventListener('click', closeDrawer);
	document.addEventListener('keydown', function (e) {
		if (e.key === 'Escape') closeDrawer();
	});
	window.addEventListener('resize', function () {
		if (window.innerWidth > 960) closeDrawer();
	});

	var clock = document.getElementById('iosClock');
	function pad(n) { return n < 10 ? '0' + n : '' + n; }
	function tick() {
		if (!clock) return;
		var d = new Date();
		clock.textContent = pad(d.getHours()) + ':' + pad(d.getMinutes());
	}
	tick();
	setInterval(tick, 15000);

	/* 服务端已渲染 active；这里对「父级路径相同」再做一次兜底 */
	var path = location.pathname.replace(/\/+$/, '');
	var best = null, bestLen = -1;
	Array.prototype.forEach.call(document.querySelectorAll('.ios-nav-i[data-path]'), function (a) {
		var p = a.getAttribute('data-path');
		if (p && path.indexOf(p) === 0 && p.length > bestLen) { best = a; bestLen = p.length; }
	});
	if (best) {
		Array.prototype.forEach.call(document.querySelectorAll('.ios-nav-i.active'), function (a) {
			if (a !== best) a.classList.remove('active');
		});
		best.classList.add('active');
	}
})();

/* ---- 侧栏折叠（桌面端 72px 图标栏），状态记忆 ---- */
(function () {
	var KEY = 'iosCollapsed';
	var body = document.body;
	var btn = document.getElementById('iosCollapse');

	function apply(on) {
		body.classList.toggle('ios-collapsed', !!on);
		if (btn) btn.setAttribute('aria-expanded', on ? 'false' : 'true');
	}
	apply(body.classList.contains('ios-collapsed'));

	if (btn) {
		btn.addEventListener('click', function () {
			var on = !body.classList.contains('ios-collapsed');
			apply(on);
			try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) {}
		});
	}
	/* 窄屏（抽屉模式）不保留折叠态视觉，但记录保留，回桌面自动恢复 */
})();