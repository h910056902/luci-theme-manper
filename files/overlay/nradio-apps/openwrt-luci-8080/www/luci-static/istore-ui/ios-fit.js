/* ==========================================================================
   ios-fit.js · 一屏适配引擎
   1) 启用紧凑布局（ios-fit.css），页面级禁止滚动
   2) 内容仍超一屏时，把顶层区块按高度贪心分成若干「页内分段」
      顶部生成分段导航，一次只显示一段 —— 页面始终只有一屏、不滑动
   3) 单块仍超出视口时仅保留块内滚动，保证内容可达
   壳页与 iframe 嵌入页都会执行。
   ========================================================================== */
(function () {
	'use strict';
	if (window.__iosFitLoaded) return;
	window.__iosFitLoaded = true;

	var host = document.getElementById('maincontent');
	if (!host) return;
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
		return Math.max(260, host.clientHeight - pad - 48);
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

		/* 紧凑后已在一屏内：无需分段 */
		if (overflow <= 4) return;

		/* 轻度溢出：整体等比缩到一屏（最小 87%），优先保留「全部内容同屏可见」 */
		if (overflow <= 150) {
			var scale = Math.max(0.87, (host.clientHeight - 8) / host.scrollHeight);
			host.style.zoom = scale.toFixed(3);
			return;
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
