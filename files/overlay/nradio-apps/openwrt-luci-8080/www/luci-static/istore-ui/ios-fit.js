/* ==========================================================================
   ios-fit.js · 一屏适配引擎（已全局停用）
   按需求「剩余页面全部放开一页限制」：不再缩放、不再页内分段、
   不再给 body 加 ios-fit 类。页面级自然滚动、侧栏/顶栏固定、
   组件统一由 ios-design.css 接管。
   保留本文件作为空实现，避免改动 header/footer 的加载链路与缓存。
   ========================================================================== */
(function () {
	'use strict';
	if (window.__iosFitLoaded) return;
	window.__iosFitLoaded = true;

	var host = document.getElementById('maincontent');
	if (!host) return;
	/* 全站放开一屏：所有页面（含 DHCP）都走自然滚动 */
	return;
	var embed = document.body.classList.contains('ios-embed');
	var NAV_ID = 'iosSegNav';
	var built = false;
	var cached = [];

	document.documentElement.classList.add('ios-fit-root');
	document.body.classList.add('ios-fit');

	function visible(el) {
		return el && el.nodeType === 1 && el.tagName !== 'SCRIPT' && el.tagName !== 'STYLE' &&
			el.tagName !== 'LINK' && el.id !== NAV_ID;
	}

	function collect() {
		/* 网络设置向导是 .wz-* 结构，不在通用选择器里。低视口时按
		   「状态条 + 每张配置卡 + 页脚」分段；被隐藏的卡会从 grid 中移除，
		   标题与副标题始终保留，页面级仍不滚动。 */
		var wzGrid = host.querySelector('.wz-grid');
		if (wzGrid) {
			var wzBlocks = [];
			var kpis = host.querySelector('.wz-kpis');
			if (kpis) wzBlocks.push(kpis);
			Array.prototype.forEach.call(wzGrid.children, function (c) {
				if (visible(c) && c.classList.contains('wz-card')) wzBlocks.push(c);
			});
			var foot = host.querySelector('.wz-foot');
			if (foot) wzBlocks.push(foot);
			if (wzBlocks.length > 2) return wzBlocks;
		}
		var sels = '.ios-grid, .ios-card, .cbi-section, .panel, .ops-bar, .kp-anchors, table.cbi-section-table';
		var all = Array.prototype.slice.call(host.querySelectorAll(sels)).filter(visible);
		/* 只保留最外层块，避免父子同时被分页 */
		return all.filter(function (el) {
			return !all.some(function (o) { return o !== el && o.contains(el); });
		});
	}

	function labelOf(el, i) {
		var d = el.getAttribute('data-fit-label');
		if (d) return d;
		var t = el.querySelector('legend, h3, .ios-card-h h3, .panel-title, h2, caption');
		var s = t ? (t.textContent || '').replace(/收起|展开/g, '').trim() : '';
		if (!s) s = '分区 ' + (i + 1);
		return s.length > 13 ? s.slice(0, 13) + '…' : s;
	}

	function available() {
		var cs = window.getComputedStyle(host);
		var pad = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
		/* host 可能被内容撑得比视口还高（实测 1280x720 下为 738），
		   用真实视口高度兜底，否则分段贪心会按错误高度算。 */
		var vp = window.innerHeight - (embed ? 0 : 56);
		return Math.max(260, Math.min(host.clientHeight, vp) - pad - 48);
	}

	function reset() {
		var nav = document.getElementById(NAV_ID);
		if (nav && nav.parentNode) nav.parentNode.removeChild(nav);
		Array.prototype.forEach.call(cached, function (el) { el.style.display = ''; });
		host.style.zoom = '';
		document.body.classList.remove('ios-fit-paged', 'ios-fit-single');
		built = false;
	}

	function build() {
		if (built) return;
		var blocks = collect();
		cached = blocks;
		var avail = available();
		var overflow = host.scrollHeight - (host.clientHeight - 8);
		var isWizard = !!host.querySelector('.wz-grid');
		/* #maincontent 带 overflow:hidden 时 scrollHeight 会低估真实内容高度。
		   实测 5 张向导卡在内容高 <700px 的视口（如 1280x720）即使缩到 87% 也放不下，
		   这类矮视口直接走页内分段，保证卡片不被裁掉且页面级不滚动。 */
		var forcePaged = isWizard && window.innerHeight < 740;

		/* 紧凑后已在一屏内：无需分段 */
		if (!forcePaged && overflow <= 4) return;

		/* 轻度溢出：整体等比缩到一屏（最小 87%），优先保留「全部内容同屏可见」 */
		if (!forcePaged && overflow <= 150) {
			var scale = Math.max(0.87, (host.clientHeight - 8) / host.scrollHeight);
			host.style.zoom = scale.toFixed(3);
			/* 向导页按卡片实际位置复核：缩放后仍有卡被裁，就撤销缩放改走分段 */
			var wz = host.querySelector('.wz-grid');
			if (wz) {
				var cs = wz.querySelectorAll(':scope > .wz-card');
				var last = cs.length ? cs[cs.length - 1] : null;
				var hr = host.getBoundingClientRect();
				if (last && last.getBoundingClientRect().bottom > hr.bottom + 2) {
					host.style.zoom = '';
				} else {
					return;
				}
			} else {
				return;
			}
		}

		if (blocks.length < 2) {
			document.body.classList.add('ios-fit-single');
			return;
		}

		var pages = [], cur = [], used = 0;
		blocks.forEach(function (el) {
			var h = (el.offsetHeight || 0) + 12;
			if (cur.length && used + h > avail) { pages.push(cur); cur = []; used = 0; }
			cur.push(el); used += h;
		});
		if (cur.length) pages.push(cur);
		if (pages.length < 2) {
			document.body.classList.add('ios-fit-single');
			return;
		}

		var nav = document.createElement('div');
		nav.className = 'ios-segnav';
		nav.id = NAV_ID;
		nav.setAttribute('role', 'tablist');
		pages.forEach(function (pg, i) {
			var b = document.createElement('button');
			b.type = 'button';
			b.className = 'ios-seg' + (i === 0 ? ' on' : '');
			b.setAttribute('role', 'tab');
			b.textContent = labelOf(pg[0], i);
			b.addEventListener('click', function () { show(i); });
			nav.appendChild(b);
		});
		var tip = document.createElement('span');
		tip.className = 'ios-fit-tip';
		tip.innerHTML = '<i class="fas fa-layer-group"></i> 共 ' + pages.length + ' 段';
		nav.appendChild(tip);
		host.insertBefore(nav, host.firstChild);

		function show(i) {
			pages.forEach(function (pg, pi) {
				pg.forEach(function (el) { el.style.display = pi === i ? '' : 'none'; });
			});
			Array.prototype.forEach.call(nav.querySelectorAll('.ios-seg'), function (b, bi) {
				b.classList.toggle('on', bi === i);
				b.setAttribute('aria-selected', bi === i ? 'true' : 'false');
			});
			window.scrollTo(0, 0);
			if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
		}

		document.body.classList.add('ios-fit-paged');
		built = true;
		show(0);
	}

	function start() {
		/* 等 ios-enhance.js 的折叠/DHCP 摘要条完成后再测量 */
		setTimeout(build, embed ? 420 : 320);
		/* 向导页的 Wi-Fi/SIM/订阅行由页面 JS 异步填充，首测时卡片还没长高；
		   延迟再复核一次，避免低视口下误判「已一屏」而把底部卡裁掉。 */
		if (host.querySelector('.wz-grid')) {
			setTimeout(function () { reset(); build(); }, 1700);
		}
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
	else start();

	var rt = null;
	window.addEventListener('resize', function () {
		clearTimeout(rt);
		rt = setTimeout(function () { reset(); build(); }, 260);
	});

	/* 供 CDP 验收读取 */
	window.IosFit = {
		paged: function () { return document.body.classList.contains('ios-fit-paged'); },
		segments: function () { var n = document.getElementById(NAV_ID); return n ? n.querySelectorAll('.ios-seg').length : 0; },
		overflow: function () {
			var d = document.scrollingElement || document.documentElement;
			return Math.max(0, d.scrollHeight - d.clientHeight);
		}
	};
})();
