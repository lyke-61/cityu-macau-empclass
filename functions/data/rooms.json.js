// 从 KV 读取最新教室数据；KV 里没有时回落到仓库里的静态文件
export async function onRequestGet(context) {
  const { env, next } = context;

  try {
    const cached = await env.ROOMS?.get("rooms.json");
    if (cached) {
      return new Response(cached, {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-cache",
        },
      });
    }
  } catch (e) {
    // KV 没绑定或读失败，走回落
  }

  return next();
}
