export default {
  async fetch(request, env, ctx) {
    // 处理预检请求
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': '*',
        }
      });
    }
  
    const url = new URL(request.url);
  
    if (!url.pathname.startsWith('/https://steamcommunity.com/miniprofile/')) {
      return new Response('400: Invalid URL format', { status: 400 });
    }
  
    const pathPart = decodeURIComponent(url.pathname.slice(1));
    const steamIdMatch = pathPart.match(/\/miniprofile\/([^?\/]+)$/);
    if (!steamIdMatch) {
      return new Response('400: Cannot extract Steam ID', { status: 400 });
    }
  
    let requestedSteamId = steamIdMatch[1];
  
    // 转换为 32 位 account ID
    let convertedSteamId;
    try {
      const bigIntId = BigInt(requestedSteamId);
      convertedSteamId = Number(bigIntId & 0xffffffffn);
    } catch (e) {
      return new Response('400: Invalid Steam ID', { status: 400 });
    }
  
    // 构建目标 URL
    let targetUrl = `https://steamcommunity.com/miniprofile/${convertedSteamId}`;
    const language = url.searchParams.get('l') || 'en';
    targetUrl += `?l=${language}`;
    const appId = url.searchParams.get('appId');
    if (appId) targetUrl += `&appid=${appId}`;
  
    const proxyResponse = await fetch(targetUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
  
    if (!proxyResponse.ok) {
      return new Response('502: Steam unavailable', { status: 502 });
    }
  
    const newHeaders = new Headers(proxyResponse.headers);
    newHeaders.set('Access-Control-Allow-Origin', '*');
    newHeaders.set('Access-Control-Allow-Methods', 'GET');
    newHeaders.set('Cache-Control', 'public, s-maxage=300');
  
    return new Response(proxyResponse.body, {
      status: proxyResponse.status,
      headers: newHeaders
    });
  }
}
