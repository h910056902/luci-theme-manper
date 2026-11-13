/* ==========================================================================
   ios-logs.js · 系统日志 / 内核日志统一查看器
   模板只需提供：
     <div id="logApp"></div>
     <textarea id="logRaw" hidden data-title="..." data-src="..." data-fetch="?action=fetch"><原始日志></textarea>
   全文用 textContent 渲染，绝不拼进 innerHTML（日志内容不可信）。
   ========================================================================== */
(function () {
	'use strict';
	var raw = document.getElementById('logRaw');
	var app = document.getElementById('logApp');
	if (!raw || !app) return;

	var title = raw.getAttribute('data-title') || '日志';
	var src = raw.getAttribute('data-src') || '';
	var fetchUrl = raw.getAttribute('data-fetch') || '';
	var isKernel = (raw.getAttribute('data-kernel') === '1');

	var st = {
		lines: [], levels: [], q: '', level: 'all',
		auto: false, timer: null, refreshTimer: null,
		loading: false, updated: 0, pageSize: 600
	};

	function $(id) { return document.getElementById(id); }
	function fs() { return Math.max(0, document.documentElement.scrollHeight); }
	function fmtTime(t) {
		var d = new Date(t * 1000);
		function p(n) { return n < 10 ? '0' + n : '' + n; }
		return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
	}
	/* 级别判定：
	   - syslog 是 rsyslog 格式，时间戳后带 0-7 优先级数字，直接读它最准
	     （0-3 错误 / 4 警告 / 7 调试 / 其余普通）
	   - 内核日志的 NOTICE 属正常驱动输出，不染成警告，只按关键词判严重级 */
	function level(s) {
		if (!isKernel) {
			var m = s.match(/^\S+\s+(\d+)\s/);
			if (m) {
				var p = parseInt(m[1], 10);
				if (p <= 3) return 'err';
				if (p === 4) return 'warn';
				if (p === 7) return 'debug';
				return 'info';
			}
		}
		if (/\b(error|err|fail|failed|failure|fatal|critical|crit|alert|emerg|panic|oops|denied|segfault|call trace)\b/i.test(s)) return 'err';
		if (/\b(warn|warning|caution|timeout|timed out|retry|reset|dropped|disconnect|rejected)\b/i.test(s)) return 'warn';
		if (!isKernel && /\b(notice|NOTICE)\b/.test(s)) return 'warn';
		if (/\b(debug|dbg|verbose)\b/i.test(s)) return 'debug';
		return 'info';
	}
	function countLevel(k) {
		var n = 0;
		for (var i = 0; i < st.levels.length; i++) if (st.levels[i] === k) n++;
		return n;
	}

	/* ---------- 骨架：静态 HTML，无用户数据 ---------- */
	app.innerHTML = [
		'<div class="ios-card log-card">',
		'  <div class="log-head">',
		'    <div class="log-head-l">',
		'      <h3></h3>',
		'      <span class="sub" id="logSrc"></span>',
		'    </div>',
		'    <div class="log-actions">',
		'      <label class="log-auto"><input type="checkbox" id="logAuto"> 自动刷新</label>',
		'      <button type="button" class="ios-btn sm" id="logRefresh"><i class="fas fa-sync"></i> 刷新</button>',
		'      <button type="button" class="ios-btn sm" id="logCopy"><i class="fas fa-copy"></i> 复制</button>',
		'      <button type="button" class="ios-btn sm" id="logDownload"><i class="fas fa-download"></i> 下载</button>',
		'    </div>',
		'  </div>',
		'  <div class="log-toolbar">',
		'    <div class="log-search"><i class="fas fa-search" aria-hidden="true"></i>',
		'      <input type="search" id="logQ" placeholder="搜索关键词 / 进程名 / 错误码" autocomplete="off" spellcheck="false"></div>',
		'    <div class="log-chips" id="logChips">',
		'      <button type="button" class="log-chip on" data-lv="all">全部 <b>0</b></button>',
		'      <button type="button" class="log-chip err" data-lv="err">错误 <b>0</b></button>',
		'      <button type="button" class="log-chip warn" data-lv="warn">警告 <b>0</b></button>',
		'      <button type="button" class="log-chip" data-lv="info">普通 <b>0</b></button>',
		'    </div>',
		'    <div class="log-jump">',
		'      <button type="button" class="log-mini" id="logTop" title="回到顶部"><i class="fas fa-arrow-up"></i></button>',
		'      <button type="button" class="log-mini" id="logBottom" title="跳到最新"><i class="fas fa-arrow-down"></i></button>',
		'    </div>',
		'  </div>',
		'  <div class="log-view" id="logView" tabindex="0"></div>',
		'  <div class="log-foot">',
		'    <span id="logStat"></span>',
		'    <span class="log-foot-dim" id="logHint"></span>',
		'  </div>',
		'</div>'
	].join('');
	app.querySelector('.log-head-l h3').textContent = title;

	function setSource(s) {
		src = s || src;
		$('logSrc').textContent = '来源 ' + (src || '未知') + ' · 更新 ' + (st.updated ? fmtTime(st.updated) : '—');
	}

	/* ---------- 数据 ---------- */
	function setText(text, fromFetch) {
		var t = String(text || '').replace(/\r/g, '');
		st.lines = t.split('\n');
		while (st.lines.length && !st.lines[st.lines.length - 1].trim()) st.lines.pop();
		st.levels = [];
		for (var i = 0; i < st.lines.length; i++) st.levels.push(level(st.lines[i]));
		st.updated = Math.floor(Date.now() / 1000);
		if (fromFetch) raw.value = t;
		setSource(src);
		render();
	}

	function markText(el, text, q) {
		if (!q) { el.textContent = text; return; }
		var low = text.toLowerCase(), i = low.indexOf(q), p = 0;
		while (i >= 0) {
			el.appendChild(document.createTextNode(text.slice(p, i)));
			var m = document.createElement('mark');
			m.textContent = text.slice(i, i + q.length);
			el.appendChild(m);
			p = i + q.length;
			i = low.indexOf(q, p);
		}
		el.appendChild(document.createTextNode(text.slice(p)));
	}

	function render() {
		var view = $('logView');
		var q = st.q.toLowerCase();
		var rows = [], shown = 0, matched = 0;
		var frag = document.createDocumentFragment();
		for (var i = 0; i < st.lines.length; i++) {
			var line = st.lines[i], lv = st.levels[i];
			if (st.level !== 'all' && lv !== st.level) continue;
			if (q && line.toLowerCase().indexOf(q) < 0) continue;
			matched++;
			/* 大日志只渲染前 pageSize 行，避免 1200 行 DOM 拖慢交互 */
			if (shown >= st.pageSize) continue;
			var row = document.createElement('div');
			row.className = 'log-row lv-' + lv;
			/* 长行默认单行省略，悬停看 title、点击展开全文 */
			row.title = line.length > 140 ? line : '';
			row.addEventListener('click', function () {
				this.classList.toggle('expanded');
			});
			var n = document.createElement('span');
			n.className = 'log-n';
			n.textContent = String(i + 1);
			var t = document.createElement('span');
			t.className = 'log-t';
			markText(t, line, q);
			row.appendChild(n); row.appendChild(t);
			frag.appendChild(row);
			shown++;
		}
		view.replaceChildren(frag);
		$('logStat').textContent = '显示 ' + shown + ' / 匹配 ' + matched + ' · 共 ' + st.lines.length + ' 行';
		$('logHint').textContent = shown >= st.pageSize
			? ('仅渲染前 ' + st.pageSize + ' 行，用搜索缩小范围')
			: (q ? '按 Esc 清空搜索' : '等宽显示 · 行号可对照原始日志');
		if (!matched) {
			var empty = document.createElement('div');
			empty.className = 'log-empty';
			empty.textContent = st.lines.length ? '没有匹配的日志，换个关键词或级别试试' : '暂无日志数据';
			view.appendChild(empty);
		}
		/* chips 计数 */
		var chips = $('logChips').querySelectorAll('.log-chip');
		var counts = { all: st.lines.length, err: countLevel('err'), warn: countLevel('warn'), info: countLevel('info') + countLevel('debug') };
		for (var c = 0; c < chips.length; c++) {
			var k = chips[c].getAttribute('data-lv');
			chips[c].querySelector('b').textContent = String(counts[k] || 0);
		}
	}

	/* ---------- 状态反馈 ---------- */
	function status(msg, kind) {
		var h = $('logHint');
		if (!h) return;
		h.textContent = msg;
		h.className = 'log-foot-dim' + (kind ? ' log-' + kind : '');
		setTimeout(function () {
			if (h.textContent === msg) { h.className = 'log-foot-dim'; render(); }
		}, 4000);
	}

	function refresh() {
		if (st.loading || !fetchUrl) { location.reload(); return; }
		st.loading = true;
		var btn = $('logRefresh');
		if (btn) btn.disabled = true;
		status('正在读取最新日志…');
		fetch(fetchUrl, { credentials: 'same-origin', cache: 'no-store' })
			.then(function (r) { return r.json(); })
			.then(function (d) {
				if (d && d.ok) {
					setText(d.text, true);
					status('已更新 · ' + fmtTime(st.updated), 'ok');
				} else {
					status('读取失败：' + ((d && d.msg) || '未知错误'), 'bad');
				}
			})
			.catch(function () { status('读取失败：请求未送达', 'bad'); })
			.then(function () {
				st.loading = false;
				if (btn) btn.disabled = false;
			});
	}

	/* ---------- 操作 ---------- */
	function visibleText() {
		var q = st.q.toLowerCase(), out = [];
		for (var i = 0; i < st.lines.length; i++) {
			if (st.level !== 'all' && st.levels[i] !== st.level) continue;
			if (q && st.lines[i].toLowerCase().indexOf(q) < 0) continue;
			out.push(st.lines[i]);
		}
		return out.join('\n');
	}
	function copyText() {
		var text = visibleText();
		var done = function () {
			var b = $('logCopy');
			if (!b) return;
			b.innerHTML = '<i class="fas fa-check"></i> 已复制';
			setTimeout(function () { b.innerHTML = '<i class="fas fa-copy"></i> 复制'; }, 1600);
			status('已复制 ' + text.split('\n').length + ' 行到剪贴板', 'ok');
		};
		if (navigator.clipboard && navigator.clipboard.writeText) {
			navigator.clipboard.writeText(text).then(done).catch(function () {
				status('复制失败：浏览器未授权', 'bad');
			});
		} else {
			var ta = document.createElement('textarea');
			ta.value = text; document.body.appendChild(ta); ta.select();
			try { document.execCommand('copy'); done(); } catch (e) { status('复制失败', 'bad'); }
			document.body.removeChild(ta);
		}
	}
	function download() {
		var blob = new Blob([visibleText() + '\n'], { type: 'text/plain;charset=utf-8' });
		var a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = (isKernel ? 'kernel-' : 'system-') + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + '.log';
		document.body.appendChild(a); a.click(); document.body.removeChild(a);
		setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
		status('已导出日志', 'ok');
	}

	/* ---------- 事件 ---------- */
	$('logQ').addEventListener('input', function () { st.q = this.value.trim(); render(); });
	$('logQ').addEventListener('keydown', function (ev) {
		if (ev.key === 'Escape') { this.value = ''; st.q = ''; render(); }
	});
	$('logChips').addEventListener('click', function (ev) {
		var t = ev.target;
		while (t && t !== this && !(t.classList && t.classList.contains('log-chip'))) t = t.parentNode;
		if (!t || t === this) return;
		var all = this.querySelectorAll('.log-chip');
		for (var i = 0; i < all.length; i++) all[i].classList.toggle('on', all[i] === t);
		st.level = t.getAttribute('data-lv');
		render();
		$('logView').scrollTop = 0;
	});
	$('logRefresh').addEventListener('click', refresh);
	$('logCopy').addEventListener('click', copyText);
	$('logDownload').addEventListener('click', download);
	$('logTop').addEventListener('click', function () { $('logView').scrollTop = 0; });
	$('logBottom').addEventListener('click', function () {
		var v = $('logView'); v.scrollTop = v.scrollHeight;
	});
	$('logAuto').addEventListener('change', function () {
		st.auto = this.checked;
		if (st.timer) { clearInterval(st.timer); st.timer = null; }
		if (st.auto) {
			st.timer = setInterval(function () { if (!document.hidden) refresh(); }, 5000);
			status('自动刷新已开启（5 秒）', 'ok');
		} else {
			status('自动刷新已关闭');
		}
	});
	document.addEventListener('visibilitychange', function () {
		if (!document.hidden && st.auto) refresh();
	});

	setText(raw.value, false);
})();
