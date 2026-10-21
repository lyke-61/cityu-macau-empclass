# 澳门城市大学（氹仔校区）空教室查询 · emp-class

一个把学校「教室占用广播」页面变成**手机一屏能看完**的小工具。

只收录含「課室」的 51 间教室（排除电脑室、画室、传译实验室、音乐治疗室、会议厅）。

---

## 它怎么工作

```
GitHub Actions（每 10 分钟）
        │
        ├─ 跑 scraper/fetch_rooms.py
        │     └─ 抓 6 个楼栋页，解析成「占用时段块」
        │
        └─ 写入 data/rooms.json 并 commit
                    │
                    ▼
        Cloudflare Pages（只有代码改动才重新部署）
                    │
                    ▼
        手机浏览器 fetch raw.githubusercontent.com 上的 rooms.json
```

关键点：**数据更新不触发 Pages 构建**。Pages 免费额度是 500 次构建/月，
如果每 10 分钟部署一次就是 4320 次/月，三天就爆。所以数据和站点分开走。

---

## 一次性配置（约 20 分钟）

### 1. 建仓库

把整个 `emp-class/` 推到 GitHub（公开仓库，Actions 免费且不限时长）。

### 2. 改一处配置

打开 `site/app.js`，把第一行的用户名换成你的：

```js
const GITHUB_USER = "你的GitHub用户名";
const GITHUB_REPO = "emp-class";
const GITHUB_BRANCH = "main";
```

### 3. 开 Actions

仓库 → Settings → Actions → General → Workflow permissions →
选 **Read and write permissions** → Save。

不开这一步，定时任务没法把 `rooms.json` 提交回去。

### 4. 接 Pages

Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git →
选这个仓库，然后填：

| 项目 | 填什么 |
|---|---|
| Project name | `emp-class`（就是你的子域名） |
| Production branch | `main` |
| Framework preset | `None` |
| Build command | 留空 |
| Build output directory | `site` |

部署完你会拿到 `https://emp-class.pages.dev`。

最后进项目 → Settings → Build → **Build watch paths** 填 `site/*`
（这样只有前端代码变了才重新构建，数据提交不会烧构建次数）。

### 5. 手动跑一次

仓库 → Actions → 「抓取教室占用」→ Run workflow。
等 1 分钟，`data/rooms.json` 会出现在仓库里，页面就能用了。

---

## 本地调试

```bash
# 抓一次真实数据
python3 scraper/fetch_rooms.py --out data/rooms.json

# 用本地 HTML 调试解析（不联网）
python3 scraper/fetch_rooms.py --offline /tmp --out /tmp/rooms.json

# 起个本地服务看页面
cd site && python3 -m http.server 8080
# 然后访问 http://localhost:8080
```

本地跑时页面会自动改用同目录的 `rooms.json`（见 `app.js` 里的 `resolveDataUrl`）。

---

## 数据格式

```jsonc
{
  "date": "2026-10-21",
  "generated_at": "2026-10-21T20:27:00+08:00",
  "day_start_hour": 8,        // 表格从 8:00 开始
  "slot_minutes": 10,         // 每格 10 分钟
  "slots_per_day": 96,        // 8:00–24:00
  "holiday": null,            // 公众假期名称，或 null
  "room_count": 51,
  "buildings": [
    {
      "code": "L",
      "name": "中葡樓",
      "rooms": [
        {
          "room": "L105課室Classroom",
          "short": "L105",
          "blocks": [[6, 13, "憲法與基本法"]]   // [起始格, 结束格, 课程名]
        }
      ]
    }
  ]
}
```

`blocks` 只记录**被占用**的区间，没列出来的就是空。一个格子 = 10 分钟，
编号 0 对应 8:00，编号 95 对应 23:50。

---

## 每年要手动改一次

`data/holidays.json` 是澳门公众假期表。**固定日期的已经填好了，农历节日
（農曆新年、清明、佛誕、端午、重陽）每年不同，要按澳门政府公告补。**

格式是 `"MM-DD": "节日名"`，重复日期直接加条目即可。

---

## 维护要点

- **学期初**：确认抓取还正常（学校改版会让解析失效）
- **每年 1 月**：更新 `data/holidays.json`
- **抓取挂了**：页面会显示「数据可能已过期」，不会假装新鲜

## 声明

学生自建，非学校官方服务。数据取自 urp.cityu.edu.mo 的公开占用广播页面，
仅供参考，不保证与现场一致。教室内有课、被借用、临时封楼时以现场为准。
