#!/bin/sh
# 端到端：Gemini 感知备用节点自动切换测试
# 零真实副作用：curl 被替身拦截、状态目录隔离、配置用 KP_TEST_CONFIG 覆盖，
# 真实 UCI / OpenClash 节点 / backup.json 全程不被写入。
T=/tmp/kp_gemini_test
S=/tmp/kp_stub
SCRIPT=/usr/libexec/openclash-helper/speedswitch.sh
ORIG_PATH=$PATH
mkdir -p "$T" "$S"

real_status() {
  ( unset KP_API_OVERRIDE KP_DATA_OVERRIDE KP_DIR_OVERRIDE KP_TEST_CONFIG KP_LOG_OVERRIDE
    PATH=$ORIG_PATH
    $SCRIPT status 2>/dev/null | grep -o '"current":"[^"]*"' | head -1 )
}

echo "=== 测试前真实设备快照 ==="
uci show ocspeed > "$T/uci_before"
real_status > "$T/cur_before"
echo "  current=$(cat $T/cur_before)"

rm -rf "$T/data" "$T/dir" "$T/curl.log" "$T/switch.log" "$T/ocspeed.log"
mkdir -p "$T/data" "$T/dir"
cp /tmp/_oc_stub_curl.sh "$S/curl"
chmod +x "$S/curl"

printf '%s\n' \
  'group=宝贝云' \
  'test_url=https://www.gstatic.com/generate_204' \
  'gemini_url=https://gemini.google.com' \
  'enabled=1' \
  'backup_enable=1' \
  'backup_interval=90' \
  'backup_probe=8' \
  'backup_keep=3' \
  'timeout=4000' \
  'testsites=https://www.baidu.com' \
  'failover_threshold=3000' \
  'failover_cooldown=120' \
  'failover_quiet=90' \
  'gemini_backup_enable=1' \
  'gemini_backup_timeout=6000' \
  'gemini_check_interval=0' \
  'gemini_fail_count=2' \
  'gemini_switch_cooldown=300' > "$T/config"

# 候选池：当前节点 + 1 个支持 Gemini + 2 个不支持（其中一个 gstatic 更快）
# 空 nodes.json 让 backup_do 走 candidates.txt 回退且不留「文件不存在」噪音
: > "$T/data/nodes.json"
printf '%s\n' CurNode GeminiOK NoGemini FastNoGemini > "$T/data/candidates.txt"

export KP_API_OVERRIDE=http://mock
export KP_DATA_OVERRIDE=$T/data
export KP_DIR_OVERRIDE=$T/dir
export KP_TEST_CONFIG=$T/config
export KP_LOG_OVERRIDE=$T/ocspeed.log
export PATH=$S:$PATH

echo "=== STEP1: backupnow（Gemini 准入预选） ==="
$SCRIPT backupnow
echo "  backup.json = $(cat $T/data/backup.json 2>/dev/null)"

echo "=== STEP2: 页面手动检测（force）只诊断、绝不切换 ==="
$SCRIPT geminicheck
echo "  result = $(cat $T/dir/gemini_check_result.json 2>/dev/null)"
echo "  switch.log = $(cat $T/switch.log 2>/dev/null | tr '\n' ' ')"
cp "$T/dir/gemini_check_result.json" "$T/force_result.json" 2>/dev/null
cp "$T/switch.log" "$T/switch_after_force" 2>/dev/null || : > "$T/switch_after_force"
cp "$T/data/gemini_state" "$T/state_after_force" 2>/dev/null
rm -f "$T/data/gemini_state"

echo "=== STEP3: 后台 auto 自检第 1 次（计数 1/2，不应切换） ==="
$SCRIPT gemini
echo "  state = $(tr '\n' ' ' < $T/data/gemini_state 2>/dev/null)"
echo "  switch.log = $(cat $T/switch.log 2>/dev/null | tr '\n' ' ')"

echo "=== STEP4: 后台 auto 自检第 2 次（应自动切换到 GeminiOK） ==="
$SCRIPT gemini
echo "  state = $(tr '\n' ' ' < $T/data/gemini_state 2>/dev/null)"
echo "  switch.log = $(cat $T/switch.log 2>/dev/null | tr '\n' ' ')"
echo "=== 相关日志 ==="
grep -i gemini "$T/ocspeed.log" 2>/dev/null | tail -12

echo "=== STEP5: 真实设备状态复核 ==="
uci show ocspeed > "$T/uci_after"
real_status > "$T/cur_after"
echo "  current=$(cat $T/cur_after)"

echo "=== RESULT ==="
# 1. 备用池：Gemini 可用节点排首位且带 g，不足 keep 时用通用节点补足（不带 g）
list=$(cat $T/data/backup.json 2>/dev/null)
first_is_gemini=0; gcount=0; total=0
case "$list" in *'"list":[{"n":"GeminiOK","d":250,"g":300}'*) first_is_gemini=1 ;; esac
gcount=$(grep -o '"g":[0-9]*' "$T/data/backup.json" 2>/dev/null | wc -l)
total=$(grep -o '"n":"' "$T/data/backup.json" 2>/dev/null | wc -l)
[ "$first_is_gemini" = "1" ] && [ "$gcount" = "1" ] && [ "$total" = "3" ] \
  && echo "PASS backup_pool=Gemini 节点优先带 g ($gcount)，通用节点补足至 $total" \
  || echo "FAIL backup_pool (first=$first_is_gemini g=$gcount total=$total)"

# 2. 页面 force 检测只诊断，绝不切换
frc=$(cat $T/force_result.json 2>/dev/null)
case "$frc" in *'"switched":0'*) force_no_switch=1 ;; *) force_no_switch=0 ;; esac
[ "$force_no_switch" = "1" ] && [ ! -s "$T/switch_after_force" ] \
  && echo "PASS force_diagnostic_only=手动检测不触发切换" \
  || echo "FAIL force_diagnostic_only"

# 3. 后台 auto 自检确实发出切换且目标正确
target=$(tail -1 "$T/switch.log" 2>/dev/null)
state_target=$(grep '^last_target=' "$T/data/gemini_state" 2>/dev/null | cut -d= -f2-)
[ "$target" = "GeminiOK" ] && [ "$state_target" = "GeminiOK" ] \
  && echo "PASS auto_switch=已自动切换到 GeminiOK" \
  || echo "FAIL auto_switch (target=$target state=$state_target)"

# 4. 连续失败计数被重置、冷却已记录
fc=$(grep '^fail_count=' "$T/data/gemini_state" 2>/dev/null | cut -d= -f2-)
ls=$(grep '^last_switch=' "$T/data/gemini_state" 2>/dev/null | cut -d= -f2-)
[ "$fc" = "0" ] && [ -n "$ls" ] && echo "PASS state_reset=fail_count=0 且记录 last_switch" || echo "FAIL state_reset"

# 5. 真实配置与当前节点未变
if cmp -s "$T/uci_before" "$T/uci_after" && cmp -s "$T/cur_before" "$T/cur_after"; then
  echo "PASS device_unchanged=UCI 与当前节点均未变化"
else
  echo "FAIL device_unchanged"
fi
echo "=== TEST_DONE ==="
