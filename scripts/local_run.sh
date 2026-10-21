#!/bin/bash
# 在本机抓一次教室占用，有变化就推回 GitHub。
# 由 launchd 每 10 分钟调用，见同目录的 mo.cityu.empclass.plist。

set -uo pipefail

# 仓库根目录（本脚本在 scripts/ 下）
cd "$(dirname "$0")/.." || exit 1

# launchd 启动时 PATH 很短，显式补上
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

LOG_DIR="$HOME/.emp-class"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/run.log"

stamp() { date "+%Y-%m-%d %H:%M:%S"; }

{
  echo "===== $(stamp) 开始 ====="

  if ! python3 scraper/fetch_rooms.py --out data/rooms.json; then
    echo "$(stamp) 抓取失败，保留上次数据"
    echo "===== $(stamp) 结束（失败）====="
    exit 1
  fi

  # 用 git status 判断，这样错误文件的删除也能一起提交
  if [ -z "$(git status --porcelain -- data/)" ]; then
    echo "$(stamp) 数据无变化，跳过提交"
    echo "===== $(stamp) 结束 ====="
    exit 0
  fi

  git add -A -- data/
  git -c user.name="emp-class" -c user.email="emp-class@users.noreply.github.com" \
      commit -q -m "chore: 更新教室占用 $(date '+%Y-%m-%d %H:%M')"

  # 远端可能有别的提交（比如手动跑 Actions 留下的），先 rebase 再推
  if ! git pull --rebase --autostash -q origin main; then
    echo "$(stamp) 拉取失败，本次不推送"
    exit 1
  fi
  git push -q origin main && echo "$(stamp) 已推送"
  echo "===== $(stamp) 结束 ====="
} >>"$LOG" 2>&1

# 日志只留最近 2000 行
tail -n 2000 "$LOG" >"$LOG.tmp" && mv "$LOG.tmp" "$LOG"
