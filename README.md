# 澳门城市大学（氹仔校区）空教室查询

把学校「教室占用广播」页面变成**手机一屏能看完**的小工具。

**整套流程全自动，跑在 Cloudflare 上**：抓取、解析、存储、发布都在云端完成，
不需要任何一台电脑开着，也不用手动更新数据。

只收录含「課室」的 51 间教室，排除电脑室、画室、传译实验室、音乐治疗室和会议厅。

线上地址：https://emp-class.pages.dev

---

## 它怎么工作

```
Cloudflare Worker「room-scraper」
   └─ Durable Object（锁定 apac 区域）每 4 小时唤醒
        ├─ 抓 6 个楼栋页，解析成「占用时段块」
        └─ 写入 KV（key: rooms.json）
                    │
                    ▼
Pages Function 读取 KV → 提供 /data/rooms.json
                    │
                    ▼
手机浏览器同源读取，浏览器本地时间算「现在」
```

数据全部在 Cloudflare 内部流转，不需要任何一台常开的电脑。

### 为什么抓取要放在 Durable Object 里

学校服务器 `202.175.79.228` 按来源 IP 段拦截：

- 本机网络、香港/新加坡节点 ✅
- GitHub Actions（Azure 美国）、Cloudflare 普通 cron（达拉斯 DFW）、Cloudflare 美国边缘 ❌ 全部超时

Worker 的 cron 触发器跑在美国，抓不到。但 Durable Object 支持 `locationHint: "apac"`，
把对象固定创建在亚太，它发出的请求就能通（实测落新加坡，446ms 拿到完整页面）。
所以定时任务写成 DO 的 alarm，而不是 cron。

### 为什么页面只显示当天

`RoomsBroadcast` 给出的是当天整张 8:00–24:00 的占用表，一天之内不会变化。

## 声明

学生自建，非学校官方服务。数据取自 urp.cityu.edu.mo 的公开占用广播页面，
仅供参考，不保证与现场一致。教室内有课、被借用、临时封楼时以现场为准。
