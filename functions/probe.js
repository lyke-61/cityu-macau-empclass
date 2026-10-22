export async function onRequest({ request }) {
  const cf = request.cf || {};
  const url = "https://urp.cityu.edu.mo/RoomManagement/RoomsBroadcast.aspx?BuildID=TC&FloorID=L";
  const out = {
    colo: cf.colo,            // 执行节点，如 HKG / SIN / NRT
    country: cf.country,
    city: cf.city,
    asn: cf.asn,
  };
  const t0 = Date.now();
  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        "Accept-Language": "zh-TW,zh;q=0.9",
      },
    });
    const body = await r.text();
    out.status = r.status;
    out.bytes = body.length;
    out.ms = Date.now() - t0;
    out.hasTable = body.includes("uiTable");
  } catch (e) {
    out.error = String(e);
    out.ms = Date.now() - t0;
  }
  return new Response(JSON.stringify(out, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
