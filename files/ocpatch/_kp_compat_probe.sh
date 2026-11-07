#!/bin/sh
U=https://repo.istoreos.com/repo-apk/all/compat/packages.adb
C=/tmp/kpc
mkdir -p "$C"
echo "=== compat 单源索引 ==="
apk --cache-dir "$C" --repositories-file /dev/null --repository "$U" update 2>&1 | tail -4
echo "=== compat 全部包 ==="
apk --cache-dir "$C" --repositories-file /dev/null --repository "$U" search 2>/dev/null | head -25
echo "=== compat 中 luci-lua-runtime ==="
apk --cache-dir "$C" --repositories-file /dev/null --repository "$U" search luci-lua-runtime 2>/dev/null | head -8
echo "=== compat 中 linkeaseauth/fastnet ==="
apk --cache-dir "$C" --repositories-file /dev/null --repository "$U" search linkeaseauth 2>/dev/null | head -5
echo "=== DONE ==="
