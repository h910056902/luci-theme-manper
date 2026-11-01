#!/bin/sh
# ===============================================================
#  luci-theme-manper — nradio 8080 定制 LuCI 一键部署脚本
#
#  项目主页: https://github.com/h910056902/luci-theme-manper
#  用法(路由器 SSH 终端执行):
#     sh -c "$(wget -O - https://raw.githubusercontent.com/h910056902/luci-theme-manper/main/manper.sh)"
#  或下载后执行:
#     wget -O manper.sh https://raw.githubusercontent.com/h910056902/luci-theme-manper/main/manper.sh
#     sh manper.sh            # 交互菜单
#     sh manper.sh install    # 直接安装/更新
#     sh manper.sh uninstall  # 卸载并恢复
#     sh manper.sh status     # 查看状态
#
#  环境变量:
#     MANPER_PORT=8081        # 监听端口(默认 8080,与 GL 原厂 8080 冲突时改这里)
#     MANPER_LISTEN=0.0.0.0   # 监听地址(默认 0.0.0.0)
#     MANPER_DL_URL=...       # 自定义离线包地址(国内加速)
# ===============================================================

GITHUB_REPO="h910056902/luci-theme-manper"
GITHUB_RAW="https://raw.githubusercontent.com/${GITHUB_REPO}/main"
GITHUB_TARBALL="https://github.com/${GITHUB_REPO}/archive/refs/heads/main.tar.gz"

APP_ROOT="/overlay/nradio-apps"
APP_DIR="${APP_ROOT}/openwrt-luci-8080"
UCI_SECTION="openwrt8080"
PORT="${MANPER_PORT:-8080}"
LISTEN="${MANPER_LISTEN:-0.0.0.0}:${PORT}"

C_GREEN="\033[32m"; C_RED="\033[31m"; C_YELLOW="\033[33m"; C_BLUE="\033[36m"; C_END="\033[0m"

msg()  { printf "${C_GREEN}[INFO]${C_END} %s\n" "$1"; }
warn() { printf "${C_YELLOW}[WARN]${C_END} %s\n" "$1"; }
err()  { printf "${C_RED}[FAIL]${C_END} %s\n" "$1"; }
head() { printf "${C_BLUE}%s${C_END}\n" "$1"; }

# ---------- 下载工具 ----------
fetch() { # fetch <url> <outfile>
	local url="$1" out="$2" i=0
	while [ $i -lt 3 ]; do
		if command -v curl >/dev/null 2>&1; then
			curl -fsSLk --connect-timeout 15 -o "$out" "$url" && return 0
		else
			wget --no-check-certificate -T 15 -O "$out" "$url" 2>/dev/null && return 0
		fi
		i=$((i + 1))
	done
	return 1
}

# ---------- 准备源文件(本地仓库目录或在线拉取) ----------
SRC=""
prepare_source() {
	local self_dir base
	self_dir=$(dirname "$0" 2>/dev/null)
	if [ -d "${self_dir}/files" ]; then
		SRC="${self_dir}"
		msg "使用本地源文件: ${SRC}"
		return 0
	fi
	SRC="/tmp/manper-src.$$"
	mkdir -p "${SRC}" 2>/dev/null
	local dl_url="${MANPER_DL_URL:-${GITHUB_TARBALL}}"
	msg "在线拉取项目文件: ${dl_url}"
	if ! fetch "${dl_url}" "/tmp/manper.tar.gz.$$"; then
		err "下载失败。国内设备可尝试: export MANPER_DL_URL=https://ghproxy.com/${GITHUB_TARBALL}"
		err "或将整个仓库下载解压后,把 manper.sh 放在仓库根目录再运行。"
		rm -rf "${SRC}" "/tmp/manper.tar.gz.$$"
		return 1
	fi
	tar -xzf "/tmp/manper.tar.gz.$$" -C "${SRC}" 2>/dev/null
	rm -f "/tmp/manper.tar.gz.$$"
	base=$(ls "${SRC}" 2>/dev/null | head -n 1)
	if [ -z "${base}" ] || [ ! -d "${SRC}/${base}/files" ]; then
		err "离线包解压异常"
		rm -rf "${SRC}"
		return 1
	fi
	SRC="${SRC}/${base}"
	msg "源文件就绪: ${SRC}"
	return 0
}

cleanup_source() {
	[ -n "${SRC}" ] && [ "${SRC#"/tmp/manper-src."}" != "${SRC}" ] && rm -rf "${SRC}"
	return 0
}

# ---------- 前置检查 ----------
check_env() {
	local miss=0 b
	for b in uci uhttpd lua; do
		if ! command -v "$b" >/dev/null 2>&1; then
			err "缺少依赖: ${b} (opkg update && opkg install uhttpd luci-base luci-lua-runtime)"
			miss=1
		fi
	done
	[ "$miss" = "1" ] && return 1
	if [ ! -f "/usr/lib/lua/luci/dispatcher.lua" ]; then
		warn "未检测到 Lua 版 LuCI(/usr/lib/lua/luci/dispatcher.lua)。"
		warn "本项目需要 Lua LuCI(iStoreOS / nradio 固件 / GL 原厂均满足);主线 OpenWrt 需安装 luci-lua-runtime。"
		return 1
	fi
	local clash
	clash=$(uci show uhttpd 2>/dev/null | grep "listen_http" | grep ":${PORT}'" | grep -v "uhttpd\.${UCI_SECTION}\." | head -n 1)
	if [ -n "${clash}" ]; then
		err "端口 ${PORT} 已被其他 uhttpd 实例占用: ${clash}"
		err "请改用其他端口安装,例如: MANPER_PORT=8081 sh manper.sh"
		return 1
	fi
	local avail_kb
	avail_kb=$(df -k /overlay 2>/dev/null | tail -n 1 | awk '{print $4}')
	if [ -n "${avail_kb}" ] && [ "${avail_kb}" -lt 6000 ] 2>/dev/null; then
		err "/overlay 剩余空间不足 6MB(当前 ${avail_kb}KB),无法部署约 4MB 的项目文件"
		return 1
	fi
	return 0
}

# ---------- 把 files/usr/lib/lua 下的依赖装到目标系统(覆盖前自动备份) ----------
install_deps() { # install_deps <源目录> <清单输出文件>
	local src_root="$1" manifest="$2" rel
	manifest="${manifest}.$(date +%Y%m%d-%H%M%S)"
	find "${src_root}" -type f | sed "s|^${src_root}/||" > "${manifest}"
	msg "安装固件侧 Lua 依赖(覆盖前自动备份到 ${APP_ROOT}/.manper-backup-*)"
	cp -a "${src_root}/luci/." "/usr/lib/lua/luci/" || return 1
	[ -d "${src_root}/cloudd" ] && cp -a "${src_root}/cloudd" "/usr/lib/lua/" || true
	# rpcd ACL 等宿主侧扩展文件
	local share_src="${src_root%/usr/lib/lua}/usr/share"
	[ -d "${share_src}" ] && cp -a "${share_src}/." "/usr/share/" 2>/dev/null
	# 备份被覆盖的原文件
	local bk="${APP_ROOT}/.manper-backup.$(date +%Y%m%d-%H%M%S)"
	mkdir -p "${bk}"
	while read -r rel; do
		if [ -e "/usr/lib/lua/${rel}" ]; then
			mkdir -p "${bk}/$(dirname "${rel}")" 2>/dev/null
			cp -a "/usr/lib/lua/${rel}" "${bk}/${rel}"
		fi
	done < "${manifest}"
	msg "原文件备份: ${bk}"
	return 0
}

# ---------- 主部署 ----------
do_install() {
	check_env || return 1
	prepare_source || return 1

	local ts bkapp
	ts=$(date +%Y%m%d-%H%M%S)

	# 1. 部署 8080 实例目录
	if [ -d "${APP_DIR}" ]; then
		bkapp="${APP_DIR}.bak-${ts}"
		msg "检测到已有部署,备份到 ${bkapp}"
		cp -a "${APP_DIR}" "${bkapp}" 2>/dev/null
		rm -rf "${APP_DIR}"
	fi
	mkdir -p "${APP_ROOT}"
	cp -a "${SRC}/files/overlay/nradio-apps/openwrt-luci-8080" "${APP_ROOT}/" || {
		err "复制项目文件失败"; return 1; }

	# 2. 重建 www/luci-static 符号链接
	local slist="${APP_DIR}/www/luci-static/symlinks.list" name target n_ok=0 n_skip=0
	if [ -f "${slist}" ]; then
		while read -r name target; do
			case "${name}" in ""|\#*) continue;; esac
			case "${target}" in
				/*)
					if [ -e "${target}" ]; then
						ln -sfn "${target}" "${APP_DIR}/www/luci-static/${name}"; n_ok=$((n_ok + 1))
					else
						warn "跳过符号链接 ${name}(宿主机缺少 ${target})"; n_skip=$((n_skip + 1))
					fi
					;;
				*)
					ln -sfn "${target}" "${APP_DIR}/www/luci-static/${name}"; n_ok=$((n_ok + 1))
					;;
			esac
		done < "${slist}"
		msg "符号链接: 重建 ${n_ok} 个,跳过 ${n_skip} 个"
	fi

	# 3. 固件侧 Lua 依赖(nradio.lua / cloudd / nradio 控制器 / argon-config)
	install_deps "${SRC}/files/usr/lib/lua" "${APP_ROOT}/.manper-manifest" || return 1

	# 3b. /etc/config/argon 默认配置(仅在缺失时写入,不覆盖用户设置)
	if [ ! -e "/etc/config/argon" ] && [ -f "${SRC}/files/etc/config.argon.default" ]; then
		cp "${SRC}/files/etc/config.argon.default" "/etc/config/argon"
		msg "已写入 /etc/config/argon 默认配置(argon-config 可修改)"
	fi

	# 3c. 宿主机 /www/luci-static/argon 兼容链接
	#     主题模板通过该路径读取 dark.css;同时让 80 端口原 LuCI 也能选用 argon
	if [ ! -e "/www/luci-static/argon" ]; then
		ln -s "${APP_DIR}/www/luci-static/argon" "/www/luci-static/argon" 2>/dev/null \
			&& msg "已创建宿主链接 /www/luci-static/argon -> 实例目录"
	fi

	# 4. 权限: cgi-bin 可执行;历史备份脚本去掉执行位(避免被当作 CGI 直接调用)
	chmod +x "${APP_DIR}/www/cgi-bin/luci" "${APP_DIR}/www/cgi-bin/mwrt-svc" "${APP_DIR}/www/cgi-bin/mwrt-wifi" 2>/dev/null
	for f in "${APP_DIR}"/www/cgi-bin/*.bak* "${APP_DIR}"/www/cgi-bin/*.p8bak*; do
		[ -f "$f" ] && chmod -x "$f"
	done 2>/dev/null

	# 5. 注册 uhttpd 8080 实例
	uci -q delete "uhttpd.${UCI_SECTION}" >/dev/null 2>&1
	uci set "uhttpd.${UCI_SECTION}=uhttpd"
	uci set "uhttpd.${UCI_SECTION}.enabled=1"
	uci set "uhttpd.${UCI_SECTION}.listen_http=${LISTEN}"
	uci set "uhttpd.${UCI_SECTION}.rfc1918_filter=1"
	uci set "uhttpd.${UCI_SECTION}.max_connections=20"
	uci set "uhttpd.${UCI_SECTION}.network_timeout=30"
	uci set "uhttpd.${UCI_SECTION}.http_keepalive=20"
	uci set "uhttpd.${UCI_SECTION}.tcp_keepalive=1"
	uci set "uhttpd.${UCI_SECTION}.max_requests=10"
	uci set "uhttpd.${UCI_SECTION}.script_timeout=3600"
	uci set "uhttpd.${UCI_SECTION}.home=${APP_DIR}/www"
	uci set "uhttpd.${UCI_SECTION}.cgi_prefix=/cgi-bin"
	uci commit uhttpd

	# 6. 清理实例调度缓存并重启 uhttpd
	rm -f /tmp/luci-indexcache-bootstrap* /tmp/luci-indexcache-argon* 2>/dev/null
	if [ -x "/etc/init.d/uhttpd" ]; then
		/etc/init.d/uhttpd enable >/dev/null 2>&1
		/etc/init.d/uhttpd restart >/dev/null 2>&1 || /etc/init.d/uhttpd start >/dev/null 2>&1
	fi

	local lan_ip
	lan_ip=$(uci -q get network.lan.ipaddr 2>/dev/null | awk '{print $1}' | cut -d/ -f1)
	[ -z "${lan_ip}" ] && lan_ip=$(ip -4 addr show br-lan 2>/dev/null | grep inet | awk '{print $2}' | cut -d/ -f1 | head -n 1)

	cleanup_source
	echo ""
	head "=============================================="
	msg "Manper 8080 LuCI 部署完成!"
	msg "访问: http://${lan_ip:-<路由器IP>}:${PORT}"
	msg "卸载: sh manper.sh uninstall"
	head "=============================================="
	return 0
}

# ---------- 高级: 安装固件侧参考控制器(admin/ 等,覆盖前自动备份) ----------
do_vendor_controllers() {
	prepare_source || return 1
	if [ ! -d "${SRC}/vendor-reference/usr/lib/lua" ]; then
		err "源文件中没有 vendor-reference 目录"; return 1; fi
	warn "此操作会覆盖目标系统的通用控制器文件(如 admin/status.lua),覆盖前会自动备份。"
	warn "适用于 nradio 固件缺失这些文件的场合;iStoreOS/GL 原厂固件一般无需执行。"
	printf "确认继续? (y/N): "
	read -r ans
	case "${ans}" in
		y|Y|yes|YES) ;;
		*) msg "已取消"; return 0;;
	esac
	install_deps "${SRC}/vendor-reference/usr/lib/lua" "${APP_ROOT}/.manper-manifest-vendor" || return 1
	rm -f /tmp/luci-indexcache-bootstrap* /tmp/luci-indexcache-argon* 2>/dev/null
	/etc/init.d/uhttpd restart >/dev/null 2>&1
	msg "参考控制器安装完成"
	cleanup_source
	return 0
}

# ---------- 卸载 ----------
do_uninstall() {
	local manifest bk latest ans
	if [ ! -d "${APP_DIR}" ] && ! uci -q get "uhttpd.${UCI_SECTION}" >/dev/null 2>&1; then
		msg "未检测到部署,无需卸载"; return 0; fi
	printf "将移除 8080 实例并恢复被覆盖的固件文件,确认? (y/N): "
	read -r ans
	case "${ans}" in
		y|Y|yes|YES) ;;
		*) msg "已取消"; return 0;;
	esac

	# 1. 按 manifest 恢复固件侧文件(最新一份)
	for manifest in $(ls -1d "${APP_ROOT}"/.manper-manifest* 2>/dev/null | sort | tail -n 1); do
		bk="${manifest/.manper-manifest/.manper-backup}"
		msg "恢复固件文件(manifest: ${manifest})"
		while read -r rel; do
			[ -z "${rel}" ] && continue
			if [ -f "${bk}/${rel}" ]; then
				mkdir -p "/usr/lib/lua/$(dirname "${rel}")" 2>/dev/null
				cp -a "${bk}/${rel}" "/usr/lib/lua/${rel}"
			elif [ -e "/usr/lib/lua/${rel}" ]; then
				case "${rel}" in
					controller/nradio/*|controller/nradio_adv/*|cloudd/*|controller/argon-config.lua|model/cbi/argon-config.lua|view/argon-config/*|i18n/argon-config.*.lmo) rm -f "/usr/lib/lua/${rel}" ;;
				esac
			fi
		done < "${manifest}"
		rm -rf "${manifest}"
	done
	rm -rf "${APP_ROOT}"/.manper-backup* 2>/dev/null
	# 仅清空(不删)我们创建、且卸载后仍为空的厂商目录
	rmdir /usr/lib/lua/cloudd /usr/lib/lua/luci/controller/nradio /usr/lib/lua/luci/controller/nradio_adv /usr/lib/lua/luci/view/argon-config 2>/dev/null
	# 移除宿主机 /www/luci-static/argon 兼容链接(仅当指向本实例)
	if [ -L "/www/luci-static/argon" ] && [ "$(readlink /www/luci-static/argon 2>/dev/null)" = "${APP_DIR}/www/luci-static/argon" ]; then
		rm -f "/www/luci-static/argon"
	fi

	# 2. 移除 8080 实例目录(留一份 .removed 备份以防万一)
	if [ -d "${APP_DIR}" ]; then
		mv "${APP_DIR}" "${APP_DIR}.removed-$(date +%Y%m%d-%H%M%S)" 2>/dev/null || rm -rf "${APP_DIR}"
	fi

	# 3. 移除 uhttpd 实例并重启
	uci -q delete "uhttpd.${UCI_SECTION}"
	uci commit uhttpd
	rm -f /tmp/luci-indexcache-bootstrap* 2>/dev/null
	/etc/init.d/uhttpd restart >/dev/null 2>&1

	msg "Manper 8080 LuCI 已卸载,固件文件已恢复"
	return 0
}

# ---------- 状态 ----------
do_status() {
	head "== Manper 8080 LuCI 状态 =="
	if [ -d "${APP_DIR}" ]; then
		msg "实例目录: ${APP_DIR} (存在)"
	else
		warn "实例目录不存在: ${APP_DIR}"
	fi
	if uci -q get "uhttpd.${UCI_SECTION}" >/dev/null 2>&1; then
		msg "uhttpd 实例: ${UCI_SECTION} (已注册, listen: $(uci -q get uhttpd.${UCI_SECTION}.listen_http 2>/dev/null))"
	else
		warn "uhttpd 实例未注册"
	fi
	if netstat -ltn 2>/dev/null | grep -q ":${PORT} "; then
		msg "端口 ${PORT}: 监听中"
	else
		warn "端口 ${PORT}: 未监听"
	fi
	local lan_ip
	lan_ip=$(uci -q get network.lan.ipaddr 2>/dev/null | awk '{print $1}' | cut -d/ -f1)
	msg "访问地址: http://${lan_ip:-<路由器IP>}:${PORT}"
	return 0
}

usage() {
	echo "用法: sh manper.sh [install|uninstall|status]"
	echo "  不带参数 = 交互菜单"
}

menu() {
	head "=============================================="
	head "   luci-theme-manper · nradio 8080 定制 LuCI"
	head "   ${GITHUB_REPO}"
	head "=============================================="
	echo "  1) 安装 / 更新 Manper 8080 LuCI (推荐)"
	echo "  2) 安装 nradio 固件侧参考控制器 [高级]"
	echo "  3) 卸载 Manper 并恢复"
	echo "  4) 查看状态"
	echo "  0) 退出"
	printf "请输入序号: "
	read -r choice
	case "${choice}" in
		1) do_install ;;
		2) do_vendor_controllers ;;
		3) do_uninstall ;;
		4) do_status ;;
		0|"") exit 0 ;;
		*) warn "无效选择" ;;
	esac
}

case "$1" in
	install|-y)    do_install ;;
	uninstall|remove) do_uninstall ;;
	status)        do_status ;;
	*)             menu ;;
esac
