/* 空教室 · 澳城大氹仔
 * 数据由 GitHub Actions 每 10 分钟更新，前端只负责算「现在」和渲染。
 */

const CONFIG = {
  githubUser: "lyke-61",
  repo: "cityu-macau-empclass",
  branch: "main",
  path: "data/rooms.json",
};

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
const REFRESH_MS = 5 * 60 * 1000;   // 多久重新拉一次数据
const STALE_MIN = 30;               // 超过多久算「可能过期」

let state = { data: null, open: new Set(), lastFetch: 0 };

/* ---------------- 数据地址 ---------------- */

function dataSources() {
  const list = [];
  if (!CONFIG.githubUser.startsWith("YOUR_")) {
    list.push(
      `https://raw.githubusercontent.com/${CONFIG.githubUser}/${CONFIG.repo}/${CONFIG.branch}/${CONFIG.path}`
    );
  }
  list.push("./rooms.json", "../data/rooms.json"); // 本地调试用
  return list;
}

async function loadData() {
  for (const url of dataSources()) {
    try {
      const full = url.startsWith("http") ? `${url}?t=${Date.now()}` : url;
      const res = await fetch(full, { cache: "no-store" });
      if (!res.ok) continue;
      const data = await res.json();
      if (data && Array.isArray(data.buildings)) return data;
    } catch (_) {
      /* 换下一个来源 */
    }
  }
  return null;
}

/* ---------------- 时间计算 ---------------- */

const pad = (n) => String(n).padStart(2, "0");

function slotOfDay(date) {
  const mins = date.getHours() * 60 + date.getMinutes();
  return Math.floor((mins - state.data.day_start_hour * 60) / state.data.slot_minutes);
}

function slotLabel(slot) {
  const mins = state.data.day_start_hour * 60 + slot * state.data.slot_minutes;
  return `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
}

/** 把 blocks 展开成每格占用情况：[null, "課程名", null, ...] */
function expand(room, slots) {
  const arr = new Array(slots).fill(null);
  for (const [start, end, name] of room.blocks) {
    for (let i = start; i < end && i < slots; i++) arr[i] = name;
  }
  return arr;
}

/** 从 slot 开始还能空多久，返回 {free:bool, untilSlot, occupiedBy} */
function statusAt(occ, slot, slots) {
  if (occ[slot]) {
    let end = slot;
    while (end < slots && occ[end] === occ[slot]) end++;
    return { free: false, untilSlot: end, occupiedBy: occ[slot] };
  }
  let end = slot;
  while (end < slots && !occ[end]) end++;
  return { free: true, untilSlot: end, occupiedBy: null };
}

function humanDuration(slot, untilSlot) {
  const mins = (untilSlot - slot) * state.data.slot_minutes;
  if (mins <= 0) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}小時${m}分`;
  if (h) return `${h}小時`;
  return `${m}分`;
}

/* ---------------- 渲染 ---------------- */

function renderClock() {
  const now = new Date();
  document.getElementById("clock").textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function renderMeta(data) {
  const el = document.getElementById("meta");
  const d = data.date ? new Date(`${data.date}T00:00:00`) : null;
  const dayText = d ? `${d.getMonth() + 1}月${d.getDate()}日 週${WEEKDAYS[d.getDay()]}` : "";
  const gen = data.generated_at ? new Date(data.generated_at) : null;
  const genText = gen
    ? `數據 ${pad(gen.getHours())}:${pad(gen.getMinutes())}`
    : "";
  el.textContent = [dayText, `${data.room_count ?? "—"} 間教室`, genText]
    .filter(Boolean)
    .join(" · ");
}

function renderNotice(data) {
  const el = document.getElementById("notice");
  const messages = [];
  let holiday = false;

  if (data.holiday) {
    messages.push(`今日為公眾假期（${data.holiday}），教學樓開放時間可能調整，請留意學校公告。`);
    holiday = true;
  }

  const gen = data.generated_at ? new Date(data.generated_at) : null;
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  if (data.date && data.date !== todayIso) {
    messages.push(`數據日期是 ${data.date}，不是今天，抓取可能已中斷。`);
  } else if (gen && (Date.now() - gen.getTime()) / 60000 > STALE_MIN) {
    const mins = Math.round((Date.now() - gen.getTime()) / 60000);
    messages.push(`數據已 ${mins} 分鐘未更新，可能不是最新。`);
  }

  el.hidden = messages.length === 0;
  el.className = `notice${holiday && messages.length === 1 ? " holiday" : ""}`;
  el.innerHTML = messages.map((m) => `<div>${m}</div>`).join("");
}

function renderList(data) {
  const list = document.getElementById("list");
  const slots = data.slots_per_day;
  const slot = Math.max(0, Math.min(slots - 1, slotOfDay(new Date())));
  const fragment = document.createDocumentFragment();

  for (const b of data.buildings) {
    if (!b.rooms.length) continue;

    const rows = b.rooms.map((room) => {
      const occ = expand(room, slots);
      const st = statusAt(occ, slot, slots);
      return { room, st };
    });

    // 空的在前，空得久的排前面；占用的按结束时间排
    rows.sort((a, b2) => {
      if (a.st.free !== b2.st.free) return a.st.free ? -1 : 1;
      return a.st.free
        ? b2.st.untilSlot - a.st.untilSlot
        : a.st.untilSlot - b2.st.untilSlot;
    });

    const freeCount = rows.filter((r) => r.st.free).length;
    const open = state.open.has(b.code);

    const section = document.createElement("section");
    section.className = `bld${open ? " open" : ""}`;
    section.dataset.code = b.code;

    const head = document.createElement("button");
    head.className = "bld-head";
    head.type = "button";
    head.setAttribute("aria-expanded", String(open));
    head.innerHTML = `
      <span class="code">${b.code}</span>
      <span class="bld-name">${b.name}</span>
      <span class="free-count">${freeCount}<span class="unit">/${rows.length} 空</span></span>
      <span class="chev"></span>`;
    head.addEventListener("click", () => {
      const isOpen = section.classList.toggle("open");
      head.setAttribute("aria-expanded", String(isOpen));
      isOpen ? state.open.add(b.code) : state.open.delete(b.code);
    });
    section.appendChild(head);

    const ul = document.createElement("ul");
    ul.className = "rooms";

    for (const { room, st } of rows) {
      const li = document.createElement("li");
      li.className = `room ${st.free ? "is-free" : "is-busy"}`;

      let statusText;
      if (st.free) {
        statusText =
          st.untilSlot >= slots
            ? "現在空 · 今天剩餘時段"
            : `現在空 · 可待到 ${slotLabel(st.untilSlot)}`;
      } else {
        statusText = `${st.occupiedBy} · 至 ${slotLabel(st.untilSlot)}`;
      }

      const tag = st.free ? humanDuration(slot, st.untilSlot) : "";
      li.innerHTML = `
        <span class="rn">${room.short}</span>
        <span class="rs">${statusText}</span>
        ${tag ? `<span class="tag">${tag}</span>` : ""}`;
      ul.appendChild(li);
    }

    section.appendChild(ul);
    fragment.appendChild(section);
  }

  list.replaceChildren(fragment);
}

function renderAll(data) {
  renderMeta(data);
  renderNotice(data);
  renderList(data);
  const stamp = document.getElementById("stamp");
  const gen = data.generated_at ? new Date(data.generated_at) : null;
  stamp.textContent = gen
    ? `數據生成於 ${gen.getFullYear()}-${pad(gen.getMonth() + 1)}-${pad(gen.getDate())} ${pad(gen.getHours())}:${pad(gen.getMinutes())}（澳門時間）`
    : "";
}

/* ---------------- 启动 ---------------- */

async function boot() {
  renderClock();
  const data = await loadData();

  if (!data) {
    document.getElementById("meta").textContent = "無法載入數據";
    const n = document.getElementById("notice");
    n.hidden = false;
    n.textContent = "抓不到數據。請檢查網絡，或到 GitHub Actions 手動跑一次抓取。";
    return;
  }

  state.data = data;
  state.lastFetch = Date.now();
  renderAll(data);
}

setInterval(renderClock, 20 * 1000);

// 时间跨过整点时重新计算（每次数据刷新前也要重算一次）
setInterval(() => {
  if (state.data) renderAll(state.data);
}, 60 * 1000);

// 定期重新拉数据
setInterval(async () => {
  const data = await loadData();
  if (data) {
    state.data = data;
    renderAll(data);
  }
}, REFRESH_MS);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && Date.now() - state.lastFetch > REFRESH_MS) {
    boot();
  }
});

boot();
