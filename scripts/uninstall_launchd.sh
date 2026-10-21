#!/bin/bash
# 卸载定时任务并删除已安装的 plist。

set -uo pipefail

TARGET="$HOME/Library/LaunchAgents/mo.cityu.empclass.plist"
LABEL="mo.cityu.empclass"

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
rm -f "$TARGET"
echo "已卸载"
