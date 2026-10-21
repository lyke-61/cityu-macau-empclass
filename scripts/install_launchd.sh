#!/bin/bash
# 把 mo.cityu.empclass.plist 模板装进 ~/Library/LaunchAgents，
# 自动替换占位符，然后加载。
#
# 用法：bash scripts/install_launchd.sh
# 卸载：bash scripts/uninstall_launchd.sh

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TEMPLATE="$PROJECT_DIR/scripts/mo.cityu.empclass.plist"
TARGET="$HOME/Library/LaunchAgents/mo.cityu.empclass.plist"
LABEL="mo.cityu.empclass"

mkdir -p "$HOME/.emp-class" "$HOME/Library/LaunchAgents"

sed -e "s|__PROJECT_DIR__|$PROJECT_DIR|g" \
    -e "s|__HOME__|$HOME|g" \
    "$TEMPLATE" >"$TARGET"

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
sleep 1
launchctl bootstrap "gui/$(id -u)" "$TARGET"

echo "已安装：$TARGET"
echo "查看状态：launchctl list | grep empclass（第二列 0 = 上次正常退出）"
