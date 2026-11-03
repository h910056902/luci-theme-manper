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
