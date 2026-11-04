/* istore-ui · 外壳交互
   · 整栏折叠（桌面 72px 图标栏 / 窄屏抽屉）与分组折叠，均持久化
   · 菜单搜索、常用收藏置顶、实时状态（顶栏 + 侧栏底部）
   · 快捷键：Ctrl+K 命令面板、[ 折叠侧栏、Esc 关闭
   依赖：无（原生 ES5）；与 ios-spa.js 通过 ios:navigate 事件和 window.IosSpa 协作
*/
(function () {
	'use strict';
	var body = document.body;
	var KEY = 'iosCollapsed';
	var KGRP = 'iosGroups';
	var KFAV = 'iosFav';
	var burger = document.getElementById('iosBurger');
	var backdrop = document.getElementById('iosBackdrop');
	var collapse = document.getElementById('iosCollapse');
	var nav = document.querySelector('.ios-nav');

	function isNarrow() { return window.innerWidth <= 960; }
	function closeDrawer() { body.classList.remove('ios-drawer'); }

	function applyCollapsed(on, persist) {
		body.classList.toggle('ios-collapsed', !!on);
		if (collapse) collapse.setAttribute('aria-expanded', on ? 'false' : 'true');
		if (persist) { try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) {} }
	}

	applyCollapsed(!isNarrow() && body.classList.contains('ios-collapsed'), false);

	if (collapse) {
		collapse.addEventListener('click', function () {
			if (isNarrow()) { closeDrawer(); applyCollapsed(true, false); }
			else { applyCollapsed(!body.classList.contains('ios-collapsed'), true); }
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
	window.addEventListener('resize', function () { if (!isNarrow()) closeDrawer(); });

	Array.prototype.forEach.call(document.querySelectorAll('.ios-nav a'), function (a) {
		a.addEventListener('click', function () { if (isNarrow()) closeDrawer(); });
	});

	/* ---------- 分组手风琴（侧栏固定不滚动的关键） ----------
	   任意时刻只展开一个分组；默认展开当前页所在分组（或记忆的分组）。
	   点击已展开的分组会全部收起，配合搜索 / Ctrl+K 仍能直达任意页面。 */
	var groups = Array.prototype.slice.call(document.querySelectorAll('.ios-nav-g[data-group]'));
	var validKeys = {};
	groups.forEach(function (g) { validKeys[g.getAttribute('data-group')] = true; });
	var remembered = null;
	try { remembered = localStorage.getItem(KGRP); } catch (e) {}
	/* 兼容旧版（曾存 JSON 对象）与非分组值 */
	if (remembered && !validKeys[remembered]) remembered = null;
	var activeGroupKey = '';
	(function () {
		var a = document.querySelector('.ios-nav-i.active');
		var p = a && a.parentNode;
		while (p && p !== document) {
			if (p.classList && p.classList.contains('ios-nav-g')) {
				activeGroupKey = p.getAttribute('data-group') || '';
				break;
			}
			p = p.parentNode;
		}
	})();
	function setOpen(key) {
		groups.forEach(function (g) {
			var on = !!key && g.getAttribute('data-group') === key;
			g.classList.toggle('g-collapsed', !on);
			var b = g.querySelector('[data-group-toggle]');
			if (b) b.setAttribute('aria-expanded', on ? 'true' : 'false');
		});
	}
	setOpen(remembered || activeGroupKey || 'status');
	groups.forEach(function (g) {
		var btn = g.querySelector('[data-group-toggle]');
		if (!btn) return;
		btn.addEventListener('click', function () {
			var key = g.getAttribute('data-group');
			var next = g.classList.contains('g-collapsed') ? key : '';
			setOpen(next);
			try { localStorage.setItem(KGRP, next); } catch (e) {}
		});
	});

	/* ---------- 时钟 ---------- */
	var clock = document.getElementById('iosClock');
	function pad(n) { return n < 10 ? '0' + n : '' + n; }
	function tick() {
		if (!clock) return;
		var d = new Date();
		clock.textContent = pad(d.getHours()) + ':' + pad(d.getMinutes());
	}
	tick();
	setInterval(tick, 15000);

	/* ---------- 菜单索引 ---------- */
	function menuItems() {
		return Array.prototype.slice.call(document.querySelectorAll('.ios-nav-i[data-path]')).filter(function (a) {
			return !(favList && favList.contains(a));
		});
	}
	function itemData(a) {
		return {
			url: a.getAttribute('data-path'),
			label: a.getAttribute('data-label') || '',
			icon: a.getAttribute('data-icon') || 'fa-circle-dot',
			group: a.getAttribute('data-gtitle') || ''
		};
	}
	function setActive(url) {
		var best = null, bestLen = -1;
		var path = String(url || '').replace(/[?#].*$/, '');
		Array.prototype.forEach.call(document.querySelectorAll('.ios-nav-i'), function (a) {
			a.classList.remove('active');
		});
		Array.prototype.forEach.call(document.querySelectorAll('.ios-nav-i[data-path]'), function (a) {
			var p = a.getAttribute('data-path');
			if (p && path.indexOf(p) === 0 && p.length > bestLen) { best = a; bestLen = p.length; }
		});
		if (best) {
			best.classList.add('active');
			var gp = best.parentNode;
			var gg = (gp && gp.classList && gp.classList.contains('ios-nav-g')) ? gp : (gp && gp.parentNode);
			var key = gg && gg.getAttribute ? gg.getAttribute('data-group') : '';
			if (key) {
				setOpen(key);
				try { localStorage.setItem(KGRP, key); } catch (e) {}
			}
		}
	}
	setActive(location.pathname + location.search);
	document.addEventListener('ios:navigate', function (ev) {
		setActive(ev.detail && ev.detail.url);
	});

	/* ---------- 常用收藏 ---------- */
	var favs = [];
	try { favs = JSON.parse(localStorage.getItem(KFAV) || '[]') || []; } catch (e) { favs = []; }
	var favBox = document.getElementById('iosFav');
	var favList = document.getElementById('iosFavList');

	function saveFavs() { try { localStorage.setItem(KFAV, JSON.stringify(favs)); } catch (e) {} }
	function isFav(url) { return favs.indexOf(url) >= 0; }
	function toggleFav(url) {
		var i = favs.indexOf(url);
		if (i >= 0) favs.splice(i, 1); else favs.push(url);
		saveFavs();
		renderFavs();
		renderFavButtons();
	}
	function renderFavs() {
		if (!favBox || !favList) return;
		favList.innerHTML = '';
		var all = menuItems();
		var map = {};
		all.forEach(function (a) { map[a.getAttribute('data-path')] = a; });
		favs.forEach(function (u) {
			var src = map[u];
			if (!src) return;
			var d = itemData(src);
			var a = document.createElement('a');
			a.className = 'ios-nav-i';
			a.href = d.url;
			a.setAttribute('data-path', d.url);
			a.setAttribute('data-label', d.label);
			a.setAttribute('data-icon', d.icon);
			a.setAttribute('data-group', 'fav');
			a.setAttribute('data-gtitle', '常用');
			a.innerHTML = '<i class="fas ' + d.icon + '" aria-hidden="true"></i><span>' + d.label + '</span>';
			favList.appendChild(a);
		});
		favBox.hidden = favList.children.length === 0;
	}
	function renderFavButtons() {
		Array.prototype.forEach.call(document.querySelectorAll('.ios-nav-i[data-path]'), function (a) {
			var url = a.getAttribute('data-path');
			var btn = a.querySelector('.fav-btn');
			if (!btn) {
				btn = document.createElement('button');
				btn.type = 'button';
				btn.className = 'fav-btn';
				btn.setAttribute('aria-label', '收藏此页');
				btn.addEventListener('click', function (ev) {
					ev.preventDefault();
					ev.stopPropagation();
					toggleFav(url);
				});
				a.appendChild(btn);
			}
			btn.innerHTML = '<i class="fas ' + (isFav(url) ? 'fa-star' : 'fa-star-o') + '"></i>';
			btn.classList.toggle('on', isFav(url));
		});
	}
	renderFavs();
	renderFavButtons();

	/* ---------- 搜索过滤 ---------- */
	var search = document.getElementById('iosSearch');
	var navEmpty = document.getElementById('iosNavEmpty');

	function filterNav(q) {
		q = (q || '').trim().toLowerCase();
		if (nav) nav.classList.toggle('searching', q !== '');
		var visible = 0;
		Array.prototype.forEach.call(document.querySelectorAll('.ios-nav-g'), function (g) {
			if (g.id === 'iosFav') return;
			var any = false;
			Array.prototype.forEach.call(g.querySelectorAll('.ios-nav-i[data-path]'), function (a) {
				var label = (a.getAttribute('data-label') || '').toLowerCase();
				var hit = q === '' || label.indexOf(q) >= 0;
				a.classList.toggle('is-hidden', !hit);
				if (hit) any = true;
			});
			g.classList.toggle('is-hidden', q !== '' && !any);
			if (any) visible++;
		});
		if (navEmpty) navEmpty.hidden = !(q !== '' && visible === 0);
	}
	if (search) {
		search.addEventListener('input', function () { filterNav(search.value); });
		search.addEventListener('keydown', function (ev) {
			if (ev.key === 'Escape') { search.value = ''; filterNav(''); search.blur(); }
			if (ev.key === 'Enter') {
				var first = document.querySelector('.ios-nav-i[data-path]:not(.is-hidden)');
				if (first) { first.click(); search.value = ''; filterNav(''); }
			}
		});
	}

	/* ---------- 实时状态（外壳侧唯一轮询点） ---------- */
	var STATS = '/cgi-bin/luci/admin/istore_stats?state=1';
	var prev = { rx: null, tx: null, ts: 0 };
	function fmtRate(bps) {
		if (!isFinite(bps) || bps < 0) return '0 B/s';
		var u = ['B/s', 'KB/s', 'MB/s', 'GB/s'], n = bps, i = 0;
		while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
		return (i === 0 ? Math.round(n) : n.toFixed(1)) + ' ' + u[i];
	}
	function txt(id, v) { var e = document.getElementById(id); if (e) e.textContent = v; }
	function paintShell(d) {
		if (!d) return;
		var wan = d.wan || {};
		var on = wan.up && wan.ip;
		txt('tsWan', on ? wan.ip : '未连接');
		txt('ssWan', on ? wan.ip : '未连接');
		if (typeof wan.rx === 'number') {
			var now = Date.now();
			if (prev.rx !== null && prev.ts) {
				var dt = (now - prev.ts) / 1000;
				if (dt > 0.5) {
					txt('tsRate', fmtRate(Math.max(0, wan.rx - prev.rx) / dt));
				}
			}
			prev.rx = wan.rx; prev.tx = wan.tx; prev.ts = now;
		}
		if (d.clients != null) { txt('tsClients', d.clients + ' 台'); txt('ssClients', d.clients + ' 台'); }
		if (d.sys) {
			txt('tsLoad', d.sys.load || '--');
			txt('ssLoad', d.sys.load || '--');
			txt('tsTemp', (d.sys.temp || '--') + ' ℃');
			txt('ssTemp', (d.sys.temp || '--') + ' ℃');
		}
		var dot = document.getElementById('tsWanDot');
		if (dot) dot.className = 'ops-dot' + (on ? '' : ' bad');
	}
	function poll() {
		if (document.body.classList.contains('ios-embed')) return;
		fetch(STATS, { credentials: 'same-origin', cache: 'no-store' })
			.then(function (r) { return r.ok ? r.json() : null; })
			.then(function (d) { paintShell(d); })
			.catch(function () {});
	}
	poll();
	setInterval(poll, 5000);

	/* ---------- 命令面板 ---------- */
	var cmd = document.createElement('div');
	cmd.className = 'ios-cmd';
	cmd.id = 'iosCmd';
	cmd.hidden = true;
	cmd.innerHTML = [
		'<div class="ios-cmd-mask" data-cmd-close></div>',
		'<div class="ios-cmd-panel" role="dialog" aria-modal="true" aria-label="页面搜索">',
		'  <div class="ios-cmd-head"><i class="fas fa-search" aria-hidden="true"></i>',
		'    <input id="iosCmdInput" type="text" placeholder="跳转到页面…" autocomplete="off" spellcheck="false">',
		'    <kbd>Esc</kbd></div>',
		'  <div class="ios-cmd-list" id="iosCmdList"></div>',
		'  <div class="ios-cmd-foot"><span>↑↓ 选择</span><span>Enter 打开</span><span>Ctrl K 开关</span></div>',
		'</div>'
	].join('');
	document.body.appendChild(cmd);

	var cmdInput = document.getElementById('iosCmdInput');
	var cmdList = document.getElementById('iosCmdList');
	var cmdItems = [], cmdIndex = 0;

	function buildCmdList(q) {
		q = (q || '').trim().toLowerCase();
		var rows = [];
		menuItems().forEach(function (a) {
			var d = itemData(a);
			if (q && d.label.toLowerCase().indexOf(q) < 0) return;
			rows.push(d);
		});
		rows.sort(function (a, b) {
			var fa = isFav(a.url) ? 0 : 1, fb = isFav(b.url) ? 0 : 1;
			if (fa !== fb) return fa - fb;
			return 0;
		});
		cmdItems = rows;
		cmdIndex = 0;
		cmdList.innerHTML = '';
		if (!rows.length) {
			cmdList.innerHTML = '<div class="ios-cmd-empty">没有匹配的页面</div>';
			return;
		}
		rows.forEach(function (d, i) {
			var el = document.createElement('a');
			el.className = 'ios-cmd-item' + (i === 0 ? ' on' : '');
			el.href = d.url;
			el.setAttribute('data-path', d.url);
			el.innerHTML = '<i class="fas ' + d.icon + '" aria-hidden="true"></i>' +
				'<span class="lb">' + d.label + '</span>' +
				'<span class="gp">' + d.group + '</span>' +
				(isFav(d.url) ? '<i class="fas fa-star fav"></i>' : '');
			cmdList.appendChild(el);
		});
	}
	function openCmd() {
		cmd.hidden = false;
		buildCmdList('');
		if (cmdInput) { cmdInput.value = ''; cmdInput.focus(); }
	}
	function closeCmd() { cmd.hidden = true; }
	function moveCmd(delta) {
		var list = cmdList.querySelectorAll('.ios-cmd-item');
		if (!list.length) return;
		list[cmdIndex].classList.remove('on');
		cmdIndex = (cmdIndex + delta + list.length) % list.length;
		list[cmdIndex].classList.add('on');
		list[cmdIndex].scrollIntoView({ block: 'nearest' });
	}
	function goCmd() {
		var list = cmdList.querySelectorAll('.ios-cmd-item');
		if (!list.length) return;
		var url = list[cmdIndex].getAttribute('data-path');
		closeCmd();
		if (window.IosSpa) window.IosSpa.navigate(url);
		else location.href = url;
	}
	if (cmdInput) {
		cmdInput.addEventListener('input', function () { buildCmdList(cmdInput.value); });
		cmdInput.addEventListener('keydown', function (ev) {
			if (ev.key === 'ArrowDown') { ev.preventDefault(); moveCmd(1); }
			else if (ev.key === 'ArrowUp') { ev.preventDefault(); moveCmd(-1); }
			else if (ev.key === 'Enter') { ev.preventDefault(); goCmd(); }
			else if (ev.key === 'Escape') { closeCmd(); }
		});
	}
	cmdList.addEventListener('click', function (ev) {
		var a = ev.target;
		while (a && a.className.indexOf('ios-cmd-item') < 0) a = a.parentNode;
		if (!a) return;
		ev.preventDefault();
		closeCmd();
		var url = a.getAttribute('data-path');
		if (window.IosSpa) window.IosSpa.navigate(url); else location.href = url;
	});
	cmd.addEventListener('click', function (ev) {
		if (ev.target.hasAttribute && ev.target.hasAttribute('data-cmd-close')) closeCmd();
	});

	/* ---------- 快捷键 ---------- */
	var cmdBtn = document.getElementById('iosCmdBtn');
	if (cmdBtn) cmdBtn.addEventListener('click', openCmd);

	document.addEventListener('keydown', function (ev) {
		var tag = (ev.target && ev.target.tagName) || '';
		var typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || ev.target.isContentEditable;
		if ((ev.ctrlKey || ev.metaKey) && (ev.key === 'k' || ev.key === 'K')) {
			ev.preventDefault();
			if (cmd.hidden) openCmd(); else closeCmd();
			return;
		}
		if (ev.key === 'Escape') {
			if (!cmd.hidden) { closeCmd(); return; }
			closeDrawer();
			return;
		}
		if (typing) return;
		if (ev.key === '[') {
			ev.preventDefault();
			applyCollapsed(!body.classList.contains('ios-collapsed'), true);
		}
	});
})();
