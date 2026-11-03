/* ==========================================================================
   ios-enhance.js · 全站运维层
   · 顶部运维条（WAN/IPv4/实时速率/终端数/CPU·内存/温度）
   · 长卡片折叠（高级项默认收起）
   · 表单脏标记保存条
   仅第三套主题（istore）加载；幂等，重复执行无副作用。
   ========================================================================== */
(function () {
	'use strict';
	if (window.__kpOpsLoaded) return;
	window.__kpOpsLoaded = true;
	if (window.top !== window) return;              /* iframe 内不执行 */

	var STATS = '/cgi-bin/luci/admin/istore_stats?state=1';
	var POLL = 5000;
	var prev = { rx: null, tx: null, ts: 0 };

	function $(s, r) { return (r || document).querySelector(s); }
	function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
	function esc(v) { return String(v == null ? '' : v); }

	function fmtRate(bytesPerSec) {
		if (!isFinite(bytesPerSec) || bytesPerSec < 0) return '0 B/s';
		var u = ['B/s', 'KB/s', 'MB/s', 'GB/s'], n = bytesPerSec, i = 0;
		while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
		return (i === 0 ? Math.round(n) : n.toFixed(1)) + ' ' + u[i];
	}

	/* ---------- 运维条 ---------- */
	function buildBar(host) {
		var bar = document.createElement('div');
		bar.className = 'ops-bar';
		bar.id = 'kpOpsBar';
		bar.innerHTML = [
			'<div class="ops-item"><span class="k">上行链路</span>',
			'<span class="v" id="opsLink"><i class="ops-dot warn"></i><span>检测中…</span></span></div>',
			'<div class="ops-item"><span class="k">实时速率</span>',
			'<span class="v" id="opsRate">↓ 0 B/s <small>↑ 0 B/s</small></span></div>',
			'<div class="ops-item"><span class="k">在线终端</span>',
			'<span class="v" id="opsClients">— <small>台</small></span></div>',
			'<div class="ops-item"><span class="k">负载 / 内存</span>',
			'<span class="v" id="opsSys">—</span></div>',
			'<div class="ops-item"><span class="k">设备温度</span>',
			'<span class="v" id="opsTemp">— <small>℃</small></span></div>'
		].join('');
		if (host.firstChild) host.insertBefore(bar, host.firstChild);
		else host.appendChild(bar);
		return bar;
	}

	function paint(d) {
		var link = $('#opsLink');
		if (link && d.wan) {
			var on = d.wan.up && d.wan.ip;
			link.innerHTML = '<i class="ops-dot ' + (on ? '' : 'bad') + '"></i><span>' +
				esc(on ? d.wan.ip : '未连接') + '</span>';
		}
		if (d.wan && typeof d.wan.rx === 'number') {
			var now = Date.now();
			if (prev.rx !== null && prev.ts) {
				var dt = (now - prev.ts) / 1000;
				if (dt > 0.5) {
					var drx = Math.max(0, d.wan.rx - prev.rx) / dt;
					var dtx = Math.max(0, d.wan.tx - prev.tx) / dt;
					var r = $('#opsRate');
					if (r) r.innerHTML = '↓ ' + fmtRate(drx) + ' <small>↑ ' + fmtRate(dtx) + '</small>';
				}
			}
			prev.rx = d.wan.rx; prev.tx = d.wan.tx; prev.ts = now;
		}
		var cl = $('#opsClients');
		if (cl && d.clients != null) cl.innerHTML = d.clients + ' <small>台</small>';
		var sy = $('#opsSys');
		if (sy && d.sys) sy.innerHTML = esc(d.sys.load) + ' <small>/ ' + esc(d.sys.mem) + '%</small>';
		var tp = $('#opsTemp');
		if (tp) tp.innerHTML = (d.sys && d.sys.temp ? esc(d.sys.temp) : '—') + ' <small>℃</small>';
	}

	function poll() {
		fetch(STATS, { credentials: 'same-origin', cache: 'no-store' })
			.then(function (r) { return r.ok ? r.json() : null; })
			.then(function (d) { if (d) paint(d); })
			.catch(function () {});
	}

	/* ---------- 长卡片折叠 ---------- */
	function foldLongSections() {
		$$('#maincontent fieldset.cbi-section').forEach(function (fs) {
			if (fs.getAttribute('data-kp-fold')) return;
			var legend = $('legend', fs);
			if (!legend) return;
			var title = (legend.textContent || '').trim();
			var fields = fs.querySelectorAll('.cbi-value').length;
			var isAdv = /高级|Advanced|IPv6|Area Bypass|Sniffer/i.test(title);
			if (fields > 40) return;                             /* 超大表单不折叠 */
			if (fs.querySelector('.cbi-tabmenu')) return;         /* 带标签页的区块不折叠 */
			if (fields < 10 && !isAdv) return;

			fs.setAttribute('data-kp-fold', '1');
			var btn = document.createElement('button');
			btn.type = 'button';
			btn.className = 'kp-fold-btn';
			btn.innerHTML = '<i class="fas fa-chevron-down"></i>' + (isAdv ? '展开' : '收起');
			legend.appendChild(btn);
			if (isAdv) {
				fs.classList.add('kp-folded');
				btn.innerHTML = '<i class="fas fa-chevron-down"></i>展开';
			}
			btn.addEventListener('click', function () {
				var folded = fs.classList.toggle('kp-folded');
				btn.innerHTML = '<i class="fas fa-chevron-down"></i>' + (folded ? '展开' : '收起');
			});
		});
	}

	/* ---------- 顶部重复操作条去重（LuCI 有时在标题上方也渲染一份） ---------- */
	function dedupeActions() {
		var acts = ('#maincontent .cbi-page-actions');
		if (acts.length > 1) {
			for (var i = 0; i < acts.length - 1; i++) acts[i].style.display = 'none';
		}
	}

	/* ---------- 脏标记保存条 ---------- */
	function dirtyWatch() {
		var form = $('#maincontent');
		if (!form || form.getAttribute('data-kp-dirty')) return;
		form.setAttribute('data-kp-dirty', '1');

		var bar = document.createElement('div');
		bar.className = 'kp-dirty-bar';
		bar.id = 'kpDirtyBar';
		bar.innerHTML = '<span class="dot"></span><span>有 <b>未保存</b> 的改动</span>' +
			'<button type="button" class="ios-btn" id="kpDirtyReset">撤销</button>' +
			'<button type="button" class="ios-btn primary" id="kpDirtySave">保存并应用</button>';

		var dirty = false, timer = null;
		function show(on) {
			dirty = on;
			bar.classList.toggle('show', on);
		}
		form.addEventListener('change', function (e) {
			var t = e.target;
			if (!t || !/^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) return;
			clearTimeout(timer);
			timer = setTimeout(function () { show(true); }, 120);
		});
		document.body.appendChild(bar);

		var save = $('#kpDirtySave', bar), reset = $('#kpDirtyReset', bar);
		if (save) save.addEventListener('click', function () {
			var btn = $('#maincontent .cbi-button-apply, #maincontent .cbi-button-save');
			if (btn) btn.click(); else show(false);
		});
		if (reset) reset.addEventListener('click', function () { location.reload(); });
	}

	/* ---------- DHCP/DNS 专项：摘要条 + 锚点导航 ---------- */
	function dhcpModule(host) {
		if (host.getAttribute('data-kp-dhcp')) return;
		host.setAttribute('data-kp-dhcp', '1');

		var strip = document.createElement('div');
		strip.className = 'ops-bar';
		strip.id = 'kpDhcpStrip';
		strip.innerHTML = [
			'<div class="ops-item"><span class="k">动态租约</span><span class="v" id="kpLeases">— <small>条</small></span></div>',
			'<div class="ops-item"><span class="k">静态绑定</span><span class="v" id="kpStatics">— <small>条</small></span></div>',
			'<div class="ops-item"><span class="k">地址池</span><span class="v" id="kpPool">—</span></div>',
			'<div class="ops-item"><span class="k">池占用</span><span class="v" id="kpPoolPct">—</span></div>'
		].join('');
		var ops = document.getElementById('kpOpsBar');
		if (ops && ops.nextSibling) host.insertBefore(strip, ops.nextSibling);
		else host.insertBefore(strip, host.firstChild);

		function paintDhcp(d) {
			if (!d || !d.dhcp) return;
			var a = document.getElementById('kpLeases');
			var b = document.getElementById('kpStatics');
			var c = document.getElementById('kpPool');
			var e = document.getElementById('kpPoolPct');
			if (a) a.innerHTML = d.dhcp.leases + ' <small>条</small>';
			if (b) b.innerHTML = d.dhcp.statics + ' <small>条</small>';
			if (c) c.textContent = d.dhcp.start + ' – ' + (d.dhcp.start + d.dhcp.limit - 1);
			if (e) e.innerHTML = d.dhcp.pct + '% <small>' + d.dhcp.leases + '/' + d.dhcp.limit + '</small>';
		}
		fetch(STATS, { credentials: 'same-origin', cache: 'no-store' })
			.then(function (r) { return r.ok ? r.json() : null; })
			.then(paintDhcp).catch(function () {});
		setInterval(function () {
			fetch(STATS, { credentials: 'same-origin', cache: 'no-store' })
				.then(function (r) { return r.ok ? r.json() : null; })
				.then(paintDhcp).catch(function () {});
		}, 15000);

		/* 锚点导航 */
		var secs = $$('#maincontent fieldset.cbi-section, #maincontent .cbi-section').filter(function (s) {
			return s.querySelector('legend, h3');
		});
		if (secs.length < 2) return;
		var nav = document.createElement('div');
		nav.className = 'kp-anchors';
		secs.forEach(function (s, i) {
			var t = s.querySelector('legend, h3');
			var name = (t.textContent || '').replace(/收起|展开/g, '').trim();
			if (!name) return;
			if (!s.id) s.id = 'kps-' + i;
			var a = document.createElement('a');
			a.href = '#' + s.id;
			a.textContent = name;
			a.addEventListener('click', function (ev) {
				ev.preventDefault();
				s.scrollIntoView({ behavior: 'smooth', block: 'start' });
			});
			nav.appendChild(a);
		});
		strip.parentNode.insertBefore(nav, strip.nextSibling);
	}

	/* ---------- 启动 ---------- */
	function init() {
		var host = document.getElementById('maincontent');
		if (!host) host = document.querySelector('.ios-content');
		if (!host) return;
		/* 自建页（有 .ios-page-h）不再插运维条，避免重复 */
		if (!host.querySelector('.ios-page-h')) buildBar(host);
		poll();
		setInterval(poll, POLL);
		foldLongSections();
		dirtyWatch();
		dedupeActions();
		if (/\/network\/dhcp/.test(location.pathname)) dhcpModule(host);
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
