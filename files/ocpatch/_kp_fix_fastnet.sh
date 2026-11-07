#!/bin/sh
# FastNet 安装失败修复：为 APK 提供缺失的虚拟依赖 luci-lua-runtime
# 完全可逆：apk del luci-lua-runtime 即可回滚；备份 /etc/apk/world 与 installed。
D=/tmp/kpdummy
echo "=== 备份 APK 元数据 ==="
cp /etc/apk/world /tmp/kp_world.bak 2>/dev/null && echo "  world ok"
cp /lib/apk/db/installed /tmp/kp_installed.bak 2>/dev/null && echo "  installed ok"

echo "=== 构造虚拟兼容包 ==="
rm -rf "$D"; mkdir -p "$D/pkg" "$D/data"
printf 'pkgname = luci-lua-runtime\npkgver = 1.0-r1\narch = aarch64_cortex-a53\npkgdesc = Virtual compatibility package; LuCI Lua runtime is provided by luci-base on OpenWrt 25.12\nurl = local\nlicense = MIT\nsize = 0\nprovides = luci-lua-runtime=1.0-r1\n' > "$D/pkg/.PKGINFO"
( cd "$D/data" && tar czf "$D/pkg/data.tar.gz" . 2>/dev/null )
( cd "$D/pkg" && tar czf "$D/luci-lua-runtime-1.0-r1.apk" .PKGINFO data.tar.gz )
ls -l "$D/luci-lua-runtime-1.0-r1.apk"

echo "=== 安装虚拟包 ==="
apk add --allow-untrusted --force-non-repository "$D/luci-lua-runtime-1.0-r1.apk" 2>&1
echo "EXIT=$?"

echo "=== 验证依赖可见 ==="
apk info -e luci-lua-runtime 2>/dev/null || echo "  not-visible"
echo "=== 用 apk 试算依赖（只读，不安装） ==="
apk --repositories-file /tmp/is-root/etc/apk.conf --cache-dir /tmp/is-root/apk add --simulate --allow-untrusted app-meta-fastnet 2>&1 | tail -18
echo "=== DONE ==="
