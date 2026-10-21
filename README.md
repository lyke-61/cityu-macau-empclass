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

### 为什么页面只显示当天

`RoomsBroadcast` 给出的是当天整张 8:00–24:00 的占用表，一天之内不会变化，
所以只需要保持「当天有一份数据」即可，不需要高频轮询。

## 声明

学生自建，非学校官方服务。数据取自 urp.cityu.edu.mo 的公开占用广播页面，
仅供参考，不保证与现场一致。教室内有课、被借用、临时封楼时以现场为准。
