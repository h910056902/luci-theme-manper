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
		/* 自建主题设置页、ocspeed 自动测速页、iStore Vue 应用都有自己的保存/交互逻辑。
		   全局脏条会监听所有 input/change，在 iStore 里搜索、选标签、点复选框都会
		   误判成「表单变脏」，且其「保存并应用」可能提交到错误表单，故跳过。
		   SPA 壳页里 iframe 指向 iStore 时同样跳过，避免壳页残留脏条。 */
		if (/\/system\/argon-config|\/services\/openclash\/ocspeed|\/admin\/store|\/status\/procmgr/.test(location.pathname)) return;
		var spaf = document.getElementById('iosFrame');
		if (spaf && /\/admin\/store/.test(spaf.getAttribute('src') || '')) return;
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
		/* SPA 壳页加载时 iframe 还是 about:blank，之后才导航到 iStore，
		   所以这里必须动态判断，不能只在 dirtyWatch() 入口跳过一次。 */
		function isStorePage() {
			if (/\/admin\/store/.test(location.pathname)) return true;
			var spaf = document.getElementById('iosFrame');
			return !!(spaf && /\/admin\/store/.test(spaf.getAttribute('src') || ''));
		}
		function show(on) { bar.classList.toggle('show', on && !isStorePage()); }
		form.addEventListener('change', function (e) {
			var t = e.target;
			if (!t || !/^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) return;
			if (isStorePage()) return;
			clearTimeout(timer);
			timer = setTimeout(function () { show(true); }, 120);
		});
		document.body.appendChild(bar);
		/* 切换到 iStore 时把可能已显示的脏条收起（不新增轮询） */
		var spaf0 = document.getElementById('iosFrame');
		if (spaf0) spaf0.addEventListener('load', function () { if (isStorePage()) show(false); });

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
		/* 运维指标由壳页 shell.js 单点轮询后广播；iframe 内不常驻定时器，
		   避免每打开一页就多一条 15s 的 CGI 请求。 */
		window.addEventListener('message', function (ev) {
			var m = ev && ev.data;
			if (!m || m.type !== 'kp-stats' || !m.data) return;
			paintDhcp(m.data);
		});
		if (window.parent !== window) {
			try { window.parent.postMessage({ type: 'kp-stats-request' }, '*'); } catch (e) {}
		} else if (document.getElementById('kpStatics')) {
			/* 脱离壳页独立打开：降级为一次性拉取，不常驻 */
			fetch('/cgi-bin/luci/admin/istore_stats?state=1', { credentials: 'same-origin', cache: 'no-store' })
				.then(function (r) { return r.ok ? r.json() : null; })
				.then(function (d) { if (d) paintDhcp(d); }).catch(function () {});
		}

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

	/* ---------- 老版 PNG 小图标矢量化 ---------- */
	// LuCI 的接口/无线列表还在用 16px 位图（ethernet.png / wifi.png…），
	// 在高分屏上发虚、看着像裂图。映射为 FontAwesome 矢量图标，
	// 禁用态降低不透明度以保留「未启用」的语义。
	var LEGACY_ICONS = {
		'ethernet.png': 'fa-network-wired',
		'ethernet_disabled.png': 'fa-network-wired',
		'wifi.png': 'fa-wifi',
		'wifi_disabled.png': 'fa-wifi',
		'wifi_big_disabled.png': 'fa-wifi',
		'port_up.png': 'fa-plug',
		'port_down.png': 'fa-plug'
	};
	function vectorizeLegacyIcons(scope) {
		$$('img[src*="/icons/"]', scope || document).forEach(function (img) {
			var m = (img.getAttribute('src') || '').match(/icons\/([a-z0-9_-]+\.png)$/i);
			var fa = m && LEGACY_ICONS[m[1].toLowerCase()];
			if (!fa || img.getAttribute('data-vec')) return;
			img.setAttribute('data-vec', '1');
			var off = /disabled|down/.test(m[1]);
			var i = document.createElement('i');
			i.className = 'fas ' + fa;
			i.setAttribute('aria-hidden', 'true');
			i.style.cssText = 'display:inline-block;width:18px;text-align:center;font-size:14px;vertical-align:-2px;color:var(--ink-2,#5b6b7c);opacity:' + (off ? '.5' : '.95');
			img.parentNode.insertBefore(i, img);
			img.style.display = 'none';
		});
	}

	/* ---------- 启动 ---------- */
	function init() {
		var host = document.getElementById('maincontent');
		if (!host) host = document.querySelector('.ios-content');
		if (!host) return;
		foldLongSections();
		dirtyWatch();
		dedupeActions();
		vectorizeLegacyIcons(host);
		// JS 渲染的表格（无线关联列表等）稍后才出现，补一次
		setTimeout(function () { vectorizeLegacyIcons(host); }, 1200);
		if (/\/network\/dhcp/.test(location.pathname)) dhcpModule(host);
		if (/\/system\/argon-config/.test(location.pathname)) themeModule(host);
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();

/* --------------------------------------------------------------------------
   原厂兼容垫片
   1) nradio_adv 页面（reset/expand/boot/cpe_upgrade…）会调用 create_info_box，
      但主题层未加载定义它的 /luci-static/nradio/js/main.min.js，
      点「升级」时抛 ReferenceError。这里给等价的轻量主题化提示框。
   2) 部分原厂脚本用 XHR 设置 Content-Length / Connection 等禁止的请求头，
      浏览器会打印 console error；过滤这些头不改变实际请求行为。
   -------------------------------------------------------------------------- */
(function () {
	'use strict';
	/* 页面级标记：备份/升级页需要专用紧凑排版 */
	if (/\/system\/flashops(\/|$|\?)/.test(location.pathname)) {
		document.body.classList.add('ios-page-flashops');
	}
	if (typeof window.create_info_box !== 'function') {
		window.create_info_box = function (opt) {
			opt = opt || {};
			var msg = String(opt.msg || opt.message || '');
			var btn = String(opt.btn_val || opt.btn || 'OK');
			var cb = (typeof opt.callback === 'function') ? opt.callback : null;
			var box = document.getElementById('iosInfoBox');
			if (!box) {
				box = document.createElement('div');
				box.id = 'iosInfoBox';
				box.className = 'ios-info-box';
				box.setAttribute('role', 'dialog');
				document.body.appendChild(box);
			}
			box.innerHTML = '';
			var p = document.createElement('p');
			p.textContent = msg;
			var b = document.createElement('button');
			b.type = 'button';
			b.className = 'ios-btn primary';
			b.textContent = btn;
			b.addEventListener('click', function () {
				box.classList.remove('show');
				if (cb) cb();
			});
			box.appendChild(p);
			box.appendChild(b);
			box.classList.add('show');
		};
	}
	if (window.XMLHttpRequest && XMLHttpRequest.prototype.setRequestHeader) {
		var orig = XMLHttpRequest.prototype.setRequestHeader;
		XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
			if (/^(Content-Length|Connection|Host|Cookie|Cookie2|Origin|Referer|User-Agent)$/i.test(String(name))) return;
			return orig.apply(this, arguments);
		};
	}
})();
