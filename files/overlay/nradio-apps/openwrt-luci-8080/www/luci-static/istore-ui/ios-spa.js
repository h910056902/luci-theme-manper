/* ==========================================================================
   ios-spa.js · 单页控制台路由层
   · 侧栏常驻：拦截 .ios-nav-i 点击，改用单 iframe 加载目标页（_embed=1）
   · 首屏不额外渲染：直接展示服务端已渲染的页面，首次点菜单才启用 iframe
   · 安全网：未保存改动拦截、加载骨架、12s 超时自动整页回退、登录页检测
   · 暴露 window.IosSpa = { navigate, isDirty, backToConsole, reload }
   ========================================================================== */
(function () {
	'use strict';

	var body = document.body;
	var view = document.getElementById('iosView');
	var frame = document.getElementById('iosFrame');
	var skel = document.getElementById('iosSkeleton');
	var content = document.getElementById('maincontent');
	if (!view || !frame || !content) return;

	var HOME = body.getAttribute('data-home') || '/cgi-bin/luci/admin/status/details';
	/* 防火墙状态页服务端要枚举 IPv4/IPv6 全表规则，实测稳定 29~30 秒；
	   超时必须覆盖它，否则会误判成「加载失败」。 */
	var TIMEOUT = 45000;
	var SLOW = /\/status\/iptables/;
	var INITIAL = location.pathname + location.search;

	var spaLive = false;      /* iframe 是否已接管内容区 */
	var currentUrl = INITIAL; /* 当前内容区对应的 URL */
	var expectUrl = '';       /* 本次 iframe 期望加载的 URL */
	var timer = null;
	var loading = false;

	/* 侧栏给的是路径，也可能传来同源绝对 URL（脚本调用 / 收藏链接），统一归一 */
	function normalize(u) {
		if (!u) return u;
		if (u.charAt(0) === '/') return u;
		try {
			var x = new URL(u, location.href);
			if (x.origin === location.origin) return x.pathname + x.search + x.hash;
		} catch (e) {}
		return u;
	}
	function isInternal(u) {
		u = normalize(u);
		return !!u && u.indexOf('/cgi-bin/luci/') === 0;
	}
	function withEmbed(u) {
		if (!isInternal(u)) return u;
		/* iStore 入口 /admin/store 会 302 到 /admin/store/pages 并丢掉 query，
		   首屏按非嵌入态渲染出第二套侧栏，之后才被 load 纠正重新加载。
		   直接指向最终 SPA 路径（200、不重定向），一次加载就是嵌入态。 */
		if (u.indexOf('/admin/store/pages') < 0 && /\/admin\/store\/?(\?|$)/.test(u)) {
			u = u.replace(/\/admin\/store\/?(\?.*)?$/, '/admin/store/pages/installed$1');
		}
		if (u.indexOf('_embed=1') >= 0) return u;
		return u + (u.indexOf('?') >= 0 ? '&' : '?') + '_embed=1';
	}
	function stripEmbed(u) {
		return String(u || '').replace(/([?&])_embed=1(?=&|$)/, '$1').replace(/[?&]$/, '');
	}
	function cleanUrl(u) {
		/* 去掉 _embed 便于与侧栏 data-path / 地址栏对比 */
		var s = stripEmbed(u || '');
		return s || '/';
	}

	/* ---------- 脏状态 ---------- */
	function dirtyIn(doc) {
		if (!doc) return false;
		var bar = doc.getElementById('kpDirtyBar');
		return !!(bar && bar.className.indexOf('show') >= 0);
	}
	function isDirty() {
		if (dirtyIn(document)) return true;
		try { return dirtyIn(frame.contentDocument); } catch (e) { return false; }
	}

	/* ---------- 骨架 / 提示 ---------- */
	function showSkeleton(on) {
		if (!skel) return;
		skel.style.display = on ? 'flex' : 'none';
	}
	/* 只有 iframe 内确实是嵌入态时才收起骨架。
	   302 / 内部跳转丢了 _embed 时首屏是完整外壳（含第二套侧栏），
	   提前收起骨架会让用户看到「一瞬间两个左侧菜单栏」。 */
	function hideSkeletonWhenEmbedded() {
		try {
			var w = frame.contentWindow;
			var u = w ? (w.location.pathname + w.location.search) : '';
			if (isInternal(u) && u.indexOf('_embed=1') < 0) return;
		} catch (e) {}
		showSkeleton(false);
	}
	function fail(msg, url) {
		loading = false;
		clearTimeout(timer);
		showSkeleton(false);
		var box = document.getElementById('iosSpaError');
		if (!box) {
			box = document.createElement('div');
			box.id = 'iosSpaError';
			box.className = 'ios-spa-error';
			view.appendChild(box);
		}
		box.innerHTML = '<i class="fas fa-exclamation-triangle"></i><div><b>页面加载失败</b>' +
			'<span>' + msg + '</span></div>' +
			'<button type="button" class="ios-btn sm" id="iosSpaRetry">重试</button>' +
			'<button type="button" class="ios-btn sm primary" id="iosSpaFallback">整页打开</button>';
		box.style.display = 'flex';
		var retry = document.getElementById('iosSpaRetry');
		var back = document.getElementById('iosSpaFallback');
		if (retry) retry.onclick = function () { box.style.display = 'none'; load(url, true); };
		if (back) back.onclick = function () { location.href = cleanUrl(url); };
	}
	function clearError() {
		var box = document.getElementById('iosSpaError');
		if (box) box.style.display = 'none';
	}

	/* ---------- 地址栏 / 高亮 ---------- */
	function announce(url) {
		try {
			document.dispatchEvent(new CustomEvent('ios:navigate', { detail: { url: url } }));
		} catch (e) {
			var ev = document.createEvent('CustomEvent');
			ev.initCustomEvent('ios:navigate', true, true, { url: url });
			document.dispatchEvent(ev);
		}
	}
	function setCrumb(text) {
		var el = document.getElementById('iosCrumbTitle');
		if (el && text) el.textContent = text;
	}

	/* ---------- 加载 ---------- */
	function activate() {
		if (spaLive) return;
		spaLive = true;
		view.hidden = false;
		view.setAttribute('aria-hidden', 'false');
		body.classList.add('ios-spa-on');
	}

	function load(url, force) {
		url = normalize(url);
		if (!isInternal(url)) { location.href = url; return; }
		url = cleanUrl(url);
		if (!force && url === currentUrl && spaLive) return;
		if (!force && isDirty() && !window.confirm('当前页面有未保存的改动，确定离开吗？')) return;

		activate();
		clearError();
		showSkeleton(true);
		var hint = document.getElementById('iosSkHint');
		if (hint) hint.textContent = SLOW.test(url)
			? '防火墙规则较多，首次生成约需 30 秒…'
			: '正在加载页面…';
		loading = true;
		expectUrl = url;
		currentUrl = url;

		if (content) content.style.display = 'none';
		frame.style.visibility = 'visible';

		clearTimeout(timer);
		timer = setTimeout(function () {
			if (loading) fail('超过 ' + Math.round(TIMEOUT / 1000) + ' 秒仍未完成加载。', url);
		}, TIMEOUT);

		frame.src = withEmbed(url);
		setCrumbFromIndex(url);
		announce(url);
	}

	function setCrumbFromIndex(url) {
		var best = null, bestLen = -1;
		Array.prototype.forEach.call(document.querySelectorAll('.ios-nav-i[data-path]'), function (a) {
			var p = a.getAttribute('data-path');
			if (p && url.indexOf(p) === 0 && p.length > bestLen) { best = a; bestLen = p.length; }
		});
		if (best) setCrumb(best.getAttribute('data-label'));
	}

	function showServerContent() {
		/* 回到首屏（服务端已渲染的那一页），不重新请求 */
		spaLive = false;
		body.classList.remove('ios-spa-on');
		view.hidden = true;
		view.setAttribute('aria-hidden', 'true');
		if (content) content.style.display = '';
		showSkeleton(false);
		clearTimeout(timer);
		loading = false;
		currentUrl = INITIAL;
		announce(cleanUrl(INITIAL));
	}

	/* ---------- iframe 生命周期 ---------- */
	frame.setAttribute('loading', 'eager');

	frame.addEventListener('load', function () {
		if (frame.src === 'about:blank') return;
		clearTimeout(timer);

		var doc = null, win = null;
		try { doc = frame.contentDocument; win = frame.contentWindow; } catch (e) {}

		/* 内部脚本/302 丢了 _embed → 纠正，避免「页面套页面」。
		   纠正期间保持骨架遮挡，loading 也保持 true，直到下一次 load 确认嵌入态。 */
		if (win) {
			try {
				var u = win.location.pathname + win.location.search;
				if (isInternal(u) && u.indexOf('_embed=1') < 0) {
					frame.src = withEmbed(cleanUrl(u));
					/* 二次加载也要有超时兜底，否则骨架可能一直挂着 */
					clearTimeout(timer);
					timer = setTimeout(function () {
						if (loading) fail('超过 ' + Math.round(TIMEOUT / 1000) + ' 秒仍未完成加载。', currentUrl);
					}, TIMEOUT);
					return;
				}
				currentUrl = cleanUrl(u);
			} catch (e) {}
		}
		loading = false;
		hideSkeletonWhenEmbedded();

		if (doc) {
			/* 会话过期：iframe 内出现登录表单 → 整页跳转，让 sysauth 接管 */
			if (doc.getElementById('luci_password')) {
				location.href = cleanUrl(currentUrl);
				return;
			}
			var t = doc.title || '';
			t = t.replace(/\s*·\s*C2000.*$/, '').replace(/\s*·\s*NRadio.*$/, '').trim();
			if (t) setCrumb(t);
		}
		announce(currentUrl);
		setCrumbFromIndex(currentUrl);
	});

	/* 父窗口接收嵌入页消息（标题 / 就绪 / 离开） */
	window.addEventListener('message', function (ev) {
		var d = ev.data;
		if (!d || typeof d !== 'object' || !d.type) return;
		if (d.type === 'ready') {
			clearTimeout(timer);
			loading = false;
			hideSkeletonWhenEmbedded();
			if (d.title) setCrumb(String(d.title).replace(/\s*·\s*C2000.*$/, '').trim());
		} else if (d.type === 'leave') {
			/* 子页即将跳转，保持骨架，避免白屏 */
		}
	});

	/* ---------- 侧栏拦截 ---------- */
	document.addEventListener('click', function (ev) {
		if (ev.defaultPrevented || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey || ev.button !== 0) return;
		var a = ev.target;
		while (a && a.tagName !== 'A') a = a.parentNode;
		if (!a) return;
		if (a.target && a.target !== '_self') return;
		var path = a.getAttribute('data-path');
		var href = a.getAttribute('href') || '';
		if (!path && !isInternal(href)) return;
		if (a.getAttribute('href') && a.getAttribute('href').charAt(0) === '#') return;
		var url = path || href;
		if (!isInternal(url)) return;
		ev.preventDefault();
		load(url, false);
		if (history.pushState) {
			try { history.pushState({ iosSpa: true, url: cleanUrl(url) }, '', cleanUrl(url)); } catch (e) {}
		}
	}, false);

	/* ---------- 前进后退 ---------- */
	window.addEventListener('popstate', function (ev) {
		var st = ev.state;
		if (st && st.iosSpa && st.url) {
			load(st.url, true);
		} else if (spaLive) {
			showServerContent();
		}
	});

	/* ---------- 对外契约 ---------- */
	window.IosSpa = {
		navigate: function (url, opts) {
			opts = opts || {};
			url = normalize(url);
			load(url, !!opts.force);
			if (!opts.replace && history.pushState) {
				try { history.pushState({ iosSpa: true, url: cleanUrl(url) }, '', cleanUrl(url)); } catch (e) {}
			} else if (opts.replace && history.replaceState) {
				try { history.replaceState({ iosSpa: true, url: cleanUrl(url) }, '', cleanUrl(url)); } catch (e) {}
			}
		},
		isDirty: isDirty,
		backToConsole: function () {
			if (cleanUrl(INITIAL) === cleanUrl(HOME) && !spaLive) { showServerContent(); return; }
			window.IosSpa.navigate(HOME);
		},
		reload: function () {
			if (spaLive) { load(currentUrl, true); } else { location.reload(); }
		},
		current: function () { return currentUrl; },
		active: function () { return spaLive; }
	};

	/* 首屏若不在首页，保留服务端内容；state 里记一笔，便于后退 */
	if (history.replaceState) {
		try { history.replaceState({ iosSpa: false, url: INITIAL }, '', INITIAL); } catch (e) {}
	}
})();
