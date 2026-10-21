# 澳门城市大学（氹仔校区）空教室查询

把学校「教室占用广播」页面变成**手机一屏能看完**的小工具。

只收录含「課室」的 51 间教室，排除电脑室、画室、传译实验室、音乐治疗室和会议厅。

线上地址：https://emp-class.pages.dev

---

## 它怎么工作

```
本机（定时触发，或手动执行 scripts/local_run.sh）
        │
        ├─ 跑 scraper/fetch_rooms.py
        │     └─ 抓 6 个楼栋页，解析成「占用时段块」
        │
        └─ 写入 data/rooms.json 并 push 到 GitHub
                    │
                    ▼
        Cloudflare Pages（只有代码改动才重新部署）
                    │
                    ▼
        手机浏览器 fetch raw.githubusercontent.com 上的 rooms.json
```

### 为什么抓取必须在本机跑

学校服务器（`202.175.79.228`）**不接受来自境外机房的连接**。GitHub Actions
（Azure 美国）实测三次全部 TCP 超时，云端抓取服务同样连不上；而本机网络和香港节点都正常。

所以仓库里的 GitHub Actions 只留了手动触发，定时任务由本机 launchd 负责。

### 为什么用 Pages 而不是 Workers

两个都试过：Workers 的 `workers.dev` 域名在这条网络被 DNS 污染（解析到
`128.121.243.75` 这类伪地址，直连超时），而 `pages.dev` 解析和访问都正常。
所以最终用 Cloudflare Pages 托管，Worker 项目已删除。

### 为什么页面只显示当天

`RoomsBroadcast` 给出的是当天整张 8:00–24:00 的占用表，一天之内不会变化，
所以只需要保持「当天有一份数据」即可，不需要高频轮询。

---

## 维护要点

**定时任务**（launchd，每小时检查一次；数据没变不会写文件也不会提交）

```bash
# 安装
cp scripts/mo.cityu.empclass.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/mo.cityu.empclass.plist

# 查看状态（第二列 0 = 上次正常退出）
launchctl list | grep empclass

# 卸载
launchctl bootout gui/$(id -u)/mo.cityu.empclass
rm ~/Library/LaunchAgents/mo.cityu.empclass.plist
```

合盖即睡眠，任务不会跑；但 launchd 会在唤醒后补跑，所以开盖后很快就会更新。
日志在 `~/.emp-class/run.log`。

**手动跑一次**

```bash
bash scripts/local_run.sh
```

**每学期开学**：确认抓取还正常（学校改版会让解析失效）。

**每年一月**：补 `data/holidays.json` 里的农历节日（農曆新年、清明、佛誕、端午、
中秋翌日、重陽、冬至），固定公历日期已经填好。

**抓取失败时**：页面顶部会提示数据日期不是今天，不会假装新鲜；
详细的错误会写进 `data/last_error.txt` 并提交回仓库。

---

## 声明

学生自建，非学校官方服务。数据取自 urp.cityu.edu.mo 的公开占用广播页面，
仅供参考，不保证与现场一致。教室内有课、被借用、临时封楼时以现场为准。
