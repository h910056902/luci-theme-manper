#!/bin/sh
# 测试替身：拦截 speedswitch.sh 的所有 curl 调用，返回可控延迟/切换结果。
# 真实 OpenClash API 完全不会被访问；PUT 请求只记录到 switch.log。
T=/tmp/kp_gemini_test
args="$*"
printf '%s\n' "$args" >> "$T/curl.log"

case "$args" in
  *"-X PUT"*)
    printf '%s\n' "$args" | grep -o '"name":"[^"]*"' | sed 's/"name":"//; s/"$//' >> "$T/switch.log"
    printf '{}'
    exit 0 ;;
esac

case "$args" in
  *"/version"*)
    printf '{"version":"mock"}'; exit 0 ;;
  *"/delay"*)
    name=$(printf '%s' "$args" | grep -o 'proxies/[^/]*/delay' | head -1 | sed 's#proxies/##; s#/delay##')
    isgem=0
    case "$args" in *gemini.google.com*) isgem=1 ;; esac
    case "$name" in
      CurNode)
        if [ "$isgem" = "1" ]; then printf '{}'; else printf '{"delay":200}'; fi ;;
      GeminiOK)
        if [ "$isgem" = "1" ]; then printf '{"delay":300}'; else printf '{"delay":250}'; fi ;;
      NoGemini)
        if [ "$isgem" = "1" ]; then printf '{}'; else printf '{"delay":180}'; fi ;;
      FastNoGemini)
        if [ "$isgem" = "1" ]; then printf '{}'; else printf '{"delay":120}'; fi ;;
      *) printf '{}' ;;
    esac
    exit 0 ;;
  *"/proxies/"*)
    printf '{"now":"CurNode"}'; exit 0 ;;
esac
printf '{}'
