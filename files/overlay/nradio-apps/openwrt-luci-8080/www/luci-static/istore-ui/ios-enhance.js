/* ==========================================================================
   ios-enhance.js · 页面增强层（壳页与嵌入页都执行）
   · 长卡片折叠（高级项默认收起）
   · 表单脏标记保存条
   · DHCP/DNS 摘要条 + 锚点导航
   · 重复操作条去重
   运维指标（WAN/速率/终端/负载/温度）统一由 shell.js 在外壳轮询，本文件不再重复拉取。
   ========================================================================== */
(function () {
	'use strict';
	if (window.__kpEnhanceLoaded) return;
	window.__kpEnhanceLoaded = true;

	var IN_EMBED = document.body.classList.contains('ios-embed');

	function $(s, r) { return (r || document).querySelector(s); }
	function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

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

	/* ---------- 重复操作条去重（保留最后一个） ---------- */
	function dedupeActions() {
		var acts = document.querySelectorAll('#maincontent .cbi-page-actions');
		if (!acts || acts.length < 2) return;
		for (var i = 0; i < acts.length - 1; i++) {
			acts[i].style.display = 'none';
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

		var timer = null;
		function show(on) { bar.classList.toggle('show', on); }
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
		if (reset) reset.addEventListener('click', function () {
			if (IN_EMBED) location.reload();
			else if (window.IosSpa && window.IosSpa.active()) window.IosSpa.reload();
			else location.reload();
		});
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
		host.insertBefore(strip, host.firstChild);

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
		var STATS = '/cgi-bin/luci/admin/istore_stats?state=1';
		function pull() {
			fetch(STATS, { credentials: 'same-origin', cache: 'no-store' })
				.then(function (r) { return r.ok ? r.json() : null; })
				.then(paintDhcp).catch(function () {});
		}
		pull();
		setInterval(pull, 15000);

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

	/* ---------- 主题设置页：三套自建主题的卡片式选择 ---------- */
	function themeModule(host) {
		var sel = document.querySelector('select[id$=".ui_theme"]') ||
			document.getElementById('cbid.config.1.ui_theme');
		if (!sel || host.getAttribute('data-kp-theme')) return;
		host.setAttribute('data-kp-theme', '1');

		var THEMES = [
			{ id: 'manper', name: 'manper 定制',   desc: '星空登录 · 驾驶舱首页' },
			{ id: 'myos',   name: 'MYOS UI',       desc: '原厂仪表盘 · 真实数据' },
			{ id: 'istore', name: 'iStoreOS 风格', desc: '自研单页控制台 · 浅色蓝渐变' }
		];
		var cur = sel.value;
		/* model 未同步时 istore 不在 option 里，按已加载样式表兜底，避免保存写错值 */
		if (['manper', 'myos', 'istore'].indexOf(cur) < 0) {
			cur = document.querySelector('link[href*="istore-ui/istore-ui.css"]') ? 'istore' : 'manper';
			var op = document.createElement('option');
			op.value = cur; op.textContent = cur;
			sel.appendChild(op);
			sel.value = cur;
		}

		var row = sel.closest ? sel.closest('.cbi-value') : null;
		var box = document.createElement('div');
		box.className = 'ios-theme-picker';
		box.innerHTML = '<div class="ios-theme-h"><h3>8080 界面风格</h3>' +
			'<span class="sub">三套自建主题 · 选择后点「保存更改」生效</span></div>' +
			'<div class="ios-theme-grid">' +
			THEMES.map(function (t) {
				return '<button type="button" class="ios-theme-card" data-theme="' + t.id + '">' +
					'<span class="tp tp-' + t.id + '"><i class="tp-side"></i><i class="tp-top"></i>' +
					'<i class="tp-c1"></i><i class="tp-c2"></i><i class="tp-c3"></i></span>' +
					'<span class="tt"><b>' + t.name + '</b><small>' + t.desc + '</small></span>' +
					'<em>当前使用</em></button>';
			}).join('') + '</div>' +
			'<div class="ios-theme-tip"><i class="fas fa-info-circle" aria-hidden="true"></i>' +
			'切换后整套外壳与登录页都会变化；保存会重新加载页面，其他改动请先提交。</div>';

		if (row) {
			row.parentNode.insertBefore(box, row);
			row.style.display = 'none';
		} else {
			host.insertBefore(box, host.firstChild);
		}

		function sync() {
			Array.prototype.forEach.call(box.querySelectorAll('.ios-theme-card'), function (c) {
				var on = c.getAttribute('data-theme') === sel.value;
				c.classList.toggle('on', on);
				c.setAttribute('aria-pressed', on ? 'true' : 'false');
			});
		}
		box.addEventListener('click', function (ev) {
			var c = ev.target;
			while (c && c !== box && (!c.classList || !c.classList.contains('ios-theme-card'))) c = c.parentNode;
			if (!c || c === box) return;
			sel.value = c.getAttribute('data-theme');
			try { sel.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
			sync();
		});
		sel.addEventListener('change', sync);
		sync();
	}

	/* ---------- 启动 ---------- */
	function init() {
		var host = document.getElementById('maincontent');
		if (!host) host = document.querySelector('.ios-content');
		if (!host) return;
		foldLongSections();
		dirtyWatch();
		dedupeActions();
		if (/\/network\/dhcp/.test(location.pathname)) dhcpModule(host);
		if (/\/system\/argon-config/.test(location.pathname)) themeModule(host);
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
