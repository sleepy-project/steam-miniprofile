export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
  
    // 路径必须以 /https://steamcommunity.com/miniprofile/ 开头，且后面是纯 ID
    if (url.pathname === '/' || !url.pathname.startsWith('/https://steamcommunity.com/miniprofile/')) {
      return new Response('400: Invalid URL format. Example: /https://steamcommunity.com/miniprofile/123456789?l=en', { status: 400 });
    }
  
    // 正确提取：路径中只有 base URL + ID，不包含查询参数
    const pathPart = decodeURIComponent(url.pathname.slice(1)); // https://steamcommunity.com/miniprofile/80655735
  
    if (!pathPart.startsWith('https://steamcommunity.com/miniprofile/')) {
      return new Response('500: Domain not allowed', { status: 500 });
    }
  
    // 正确提取 Steam ID：从最后一个 / 后开始，直到路径结束（不包含查询）
    const steamIdIndex = pathPart.lastIndexOf('/');
    const requestedSteamId = pathPart.substring(steamIdIndex + 1);
  
    // 必须是纯数字或有效 SteamID64
    let convertedSteamId;
    try {
      const bigIntId = BigInt(requestedSteamId);
      convertedSteamId = Number(bigIntId & 0xffffffffn);
    } catch (e) {
      return new Response(`400: Invalid Steam ID: "${requestedSteamId}" is not a valid number`, { status: 400 });
    }
  
    // 构建目标 URL（使用转换后的 32 位 ID）
    let targetUrl = 'https://steamcommunity.com/miniprofile/' + convertedSteamId;
  
    // 从 Worker 的 query 参数读取 l 和 appId（关键！）
    const language = url.searchParams.get('l') || 'en';
    targetUrl += `?l=${language}`;
  
    const appId = url.searchParams.get('appId');
    if (appId) {
      targetUrl += `&appid=${appId}`;
    }
  
    // 代理请求
    const proxyResponse = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
  
    if (!proxyResponse.ok) {
      return new Response(`500: Steam returned ${proxyResponse.status}`, { status: 500 });
    }
  
    const newHeaders = new Headers(proxyResponse.headers);
    newHeaders.set('Access-Control-Allow-Origin', '*');
    newHeaders.set('Access-Control-Allow-Methods', 'GET');
    newHeaders.set('Cache-Control', 'public, s-maxage=60');
    newHeaders.set('CDN-Cache-Control', 'public, s-maxage=300');
  
    return new Response(proxyResponse.body, {
      status: proxyResponse.status,
      headers: newHeaders,
    });
  }
};
