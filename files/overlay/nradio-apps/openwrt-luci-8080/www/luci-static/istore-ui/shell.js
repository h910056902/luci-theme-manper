/* istore-ui · 外壳交互：侧栏折叠（桌面）/ 抽屉（窄屏）/ 时钟 / 菜单高亮
   折叠规则：
     · 桌面(>960px)：折叠成 72px 图标栏，状态存 localStorage
     · 窄屏(<=960px)：侧栏是抽屉；「折叠」= 收起抽屉，顶栏汉堡重新打开
*/
(function () {
	'use strict';
	var body = document.body;
	var KEY = 'iosCollapsed';
	var burger = document.getElementById('iosBurger');
	var backdrop = document.getElementById('iosBackdrop');
	var collapse = document.getElementById('iosCollapse');

	function isNarrow() { return window.innerWidth <= 960; }
	function closeDrawer() { body.classList.remove('ios-drawer'); }

	function applyCollapsed(on, persist) {
		body.classList.toggle('ios-collapsed', !!on);
		if (collapse) collapse.setAttribute('aria-expanded', on ? 'false' : 'true');
		if (persist) {
			try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) {}
		}
	}

	/* 初始态：桌面读记忆；窄屏不套用桌面折叠记忆（抽屉默认隐藏） */
	applyCollapsed(!isNarrow() && body.classList.contains('ios-collapsed'), false);

	if (collapse) {
		collapse.addEventListener('click', function () {
			if (isNarrow()) {
				closeDrawer();
				applyCollapsed(true, false);
			} else {
				applyCollapsed(!body.classList.contains('ios-collapsed'), true);
			}
		});
	}

	if (burger) {
		burger.addEventListener('click', function () {
			if (isNarrow()) {
				body.classList.toggle('ios-drawer');
				if (body.classList.contains('ios-drawer')) applyCollapsed(false, false);
			} else {
				applyCollapsed(!body.classList.contains('ios-collapsed'), true);
			}
		});
	}

	if (backdrop) backdrop.addEventListener('click', closeDrawer);
	document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDrawer(); });
	window.addEventListener('resize', function () { if (!isNarrow()) closeDrawer(); });

	/* 窄屏点菜单后自动收起抽屉 */
	Array.prototype.forEach.call(document.querySelectorAll('.ios-nav a'), function (a) {
		a.addEventListener('click', function () { if (isNarrow()) closeDrawer(); });
	});

	/* 时钟 */
	var clock = document.getElementById('iosClock');
	function pad(n) { return n < 10 ? '0' + n : '' + n; }
	function tick() {
		if (!clock) return;
		var d = new Date();
		clock.textContent = pad(d.getHours()) + ':' + pad(d.getMinutes());
	}
	tick();
	setInterval(tick, 15000);

	/* 菜单高亮兜底（最长前缀匹配） */
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
