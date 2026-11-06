#!/bin/sh
# 故障转移增强的隔离验收（零真实副作用：curl 替身 + 状态目录隔离）
T=/tmp/kp_failover_test
S=/tmp/kp_stub
SCRIPT=/usr/libexec/openclash-helper/speedswitch.sh
ORIG_PATH=$PATH
mkdir -p "$T" "$S"

real_status() {
  ( unset KP_API_OVERRIDE KP_DATA_OVERRIDE KP_DIR_OVERRIDE KP_TEST_CONFIG KP_LOG_OVERRIDE KP_STUB_MODE
    PATH=$ORIG_PATH
    $SCRIPT status 2>/dev/null | grep -o '"current":"[^"]*"' | head -1 )
}

echo "=== 测试前真实快照 ==="
uci show ocspeed > "$T/uci_before"
( PATH=$ORIG_PATH; $SCRIPT status 2>/dev/null | grep -o '"current":"[^"]*"' | head -1 ) > "$T/cur_before"
echo "  current=$(cat $T/cur_before)"

rm -rf "$T/data" "$T/dir" "$T/curl.log" "$T/switch.log" "$T/ocspeed.log"
mkdir -p "$T/data" "$T/dir"
cp /tmp/_oc_stub_curl.sh "$S/curl"; chmod +x "$S/curl"
: > "$T/data/nodes.json"
printf '%s\n' CurNode GeminiOK NoGemini FastNoGemini > "$T/data/candidates.txt"

printf '%s\n' \
  'group=宝贝云' \
  'test_url=https://www.gstatic.com/generate_204' \
  'gemini_url=https://gemini.google.com' \
  'enabled=1' \
  'failover_enable=1' \
  'failover_threshold=3000' \
  'failover_cooldown=120' \
  'failover_quiet=90' \
  'backup_enable=1' \
  'backup_interval=90' \
  'backup_probe=8' \
  'backup_keep=3' \
  'timeout=4000' \
  'testsites=https://www.baidu.com' \
  'gemini_backup_enable=0' \
  'gemini_backup_timeout=6000' \
  'gemini_check_interval=5' \
  'gemini_fail_count=2' \
  'gemini_switch_cooldown=300' > "$T/config"

export KP_API_OVERRIDE=http://mock
export KP_DATA_OVERRIDE=$T/data
export KP_DIR_OVERRIDE=$T/dir
export KP_TEST_CONFIG=$T/config
export KP_LOG_OVERRIDE=$T/ocspeed.log
export KP_TEST_DIR=$T
export PATH=$S:$PATH

echo "=== STEP1: 预选备用名单（Gemini 关闭，通用池 3 个） ==="
$SCRIPT backupnow
echo "  backup.json = $(cat $T/data/backup.json 2>/dev/null)"

echo "=== STEP2: 当前节点整体故障 -> 通用故障转移 ==="
export KP_STUB_MODE=failover
# 预置一个非零的 Gemini 失败计数，验证切换后被清零
gemini_state_set_fail() { printf 'fail_count=2\ncur_gemini_ok=0\n' > "$T/data/gemini_state"; }
gemini_state_set_fail
$SCRIPT failovernow
echo "  switch.log = $(cat $T/switch.log 2>/dev/null | tr '\n' ' ')"
echo "  gemini_state = $(tr '\n' ' ' < $T/data/gemini_state 2>/dev/null)"
echo "  last_failover = $(cat $T/data/last_failover 2>/dev/null)"
# STEP3 会重写 gemini_state，这里先快照 STEP2 的结果
cp "$T/data/gemini_state" "$T/state_after_failover" 2>/dev/null
echo "=== failover 日志 ==="
grep failover "$T/ocspeed.log" 2>/dev/null | tail -8

echo "=== STEP3: 故障转移停用时 Gemini 自检仍能独立运行 ==="
# 改写测试配置：failover 停用、Gemini 开启；直接调 gemini case（不经过 failover case）
grep -v -e '^failover_enable=' -e '^gemini_backup_enable=' "$T/config" > "$T/config.tmp"
printf '%s\n' 'failover_enable=0' 'gemini_backup_enable=1' >> "$T/config.tmp"
mv "$T/config.tmp" "$T/config"
rm -f "$T/data/gemini_state" "$T/data/last_check"
unset KP_STUB_MODE
$SCRIPT gemini
echo "  gemini_state = $(tr '\n' ' ' < $T/data/gemini_state 2>/dev/null)"

echo "=== STEP4: 真实设备状态复核 ==="
uci show ocspeed > "$T/uci_after"
real_status > "$T/cur_after"
echo "  current=$(cat $T/cur_after)"
echo "=== 真实 crontab（应含 failover 行） ==="
grep -c 'speedswitch.sh failover' /etc/crontabs/root
echo "=== UCI 实时 ==="
echo "  failover_enable=$(uci -q get ocspeed.main.failover_enable)  gemini_backup_enable=$(uci -q get ocspeed.main.gemini_backup_enable)"

echo "=== RESULT ==="
target=$(tail -1 "$T/switch.log" 2>/dev/null)
fc=$(grep '^fail_count=' "$T/state_after_failover" 2>/dev/null | cut -d= -f2-)
lt=$(grep '^last_target=' "$T/state_after_failover" 2>/dev/null | cut -d= -f2-)
[ -n "$target" ] && [ "$target" = "$lt" ] && echo "PASS failover_switch=已切换到 $target 且记录 last_target" || echo "FAIL failover_switch"
[ "$fc" = "0" ] && echo "PASS gemini_state_reset=切换后旧节点失败计数清零" || echo "FAIL gemini_state_reset (fc=$fc)"
[ -s "$T/data/last_failover" ] && echo "PASS cooldown=写入 last_failover" || echo "FAIL cooldown"
glc=$(grep '^last_check=' "$T/data/gemini_state" 2>/dev/null | cut -d= -f2-)
[ -n "$glc" ] && echo "PASS gemini_independent=failover 停用时 gemini case 仍执行自检" || echo "FAIL gemini_independent"
grep -q 'speedswitch.sh failover' /etc/crontabs/root && echo "PASS cron=failover 行已启用" || echo "FAIL cron"
if cmp -s "$T/uci_before" "$T/uci_after" && cmp -s "$T/cur_before" "$T/cur_after"; then
  echo "PASS device_unchanged=测试未改变真实 UCI 与当前节点"
else
  echo "FAIL device_unchanged"
fi
echo "=== TEST_DONE ==="
