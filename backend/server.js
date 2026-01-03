// server.js
const express = require("express");
const fetch = require("node-fetch");
const SteamID = require("steamid");
const app = express();

let distinctCount = 0;

// 静态文件
app.use(express.static("public"));

// 首页
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/views/index.html");
});

// 主代理路由
app.options("*", (req, res) => {
  // 处理预检请求（与 CF Snippet 完全一致）
  res.header({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "*",
  });
  res.status(204).send();
});

app.get("/:encodedUrl(*)", async (req, res) => {
  const { encodedUrl } = req.params;
  const fullPath = "/" + encodedUrl; // 恢复完整路径

  // 1. 检查路径格式
  if (!fullPath.startsWith("/https://steamcommunity.com/miniprofile/")) {
    return res.status(400).type("text/plain").send("400: Invalid URL format");
  }

  // 2. 解码并提取 SteamID
  const decodedPath = decodeURIComponent(fullPath.slice(1)); // 去掉开头的 /
  const steamIdMatch = decodedPath.match(/\/miniprofile\/([^?\/]+)$/);
  if (!steamIdMatch) {
    return res.status(400).type("text/plain").send("400: Cannot extract Steam ID");
  }

  const requestedSteamId = steamIdMatch[1];

  // 3. 转换为 32 位 account ID（优先用 BigInt，兼容性最好）
  let convertedSteamId;
  try {
    const bigIntId = BigInt(requestedSteamId);
    convertedSteamId = Number(bigIntId & 0xffffffffn);
  } catch (e) {
    // 如果 BigInt 失败，尝试用 steamid 库（对 SteamID64、SteamID3 等更宽容）
    try {
      const sid = new SteamID(requestedSteamId);
      convertedSteamId = Number(sid.getBigIntAccountID() & 0xffffffffn);
    } catch (err) {
      console.error("Invalid Steam ID:", requestedSteamId, err);
      return res.status(400).type("text/plain").send("400: Invalid Steam ID");
    }
  }

  // 4. 构造目标 URL
  const language = req.query.l || "en";
  const appId = req.query.appId;

  let targetUrl = `https://steamcommunity.com/miniprofile/${convertedSteamId}?l=${language}`;
  if (appId) {
    targetUrl += `&appid=${appId}`;
  }

  // 5. 统计
  if (!req.headers["user-agent"]?.startsWith("pipedream")) {
    distinctCount++;
    console.log(
      `user: ${targetUrl} host: ${req.headers.origin || "-"} count: ${distinctCount}`
    );
  }

  // 6. 代理请求
  try {
    const proxyResponse = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Cookie": `Steam_Language=${language}`
      },
    });

    if (!proxyResponse.ok) {
      return res.status(502).type("text/plain").send("502: Steam unavailable");
    }

    // 7. 设置响应头（与 CF Snippet 一致）
    const newHeaders = new Headers(proxyResponse.headers);
    newHeaders.set("Access-Control-Allow-Origin", "*");
    newHeaders.set("Access-Control-Allow-Methods", "GET");
    newHeaders.set("Cache-Control", "public, s-maxage=300");

    // Express 方式设置多个 header
    const responseHeaders = {};
    for (const [key, value] of newHeaders.entries()) {
      responseHeaders[key] = value;
    }

    res.set(responseHeaders);
    proxyResponse.body.pipe(res);
  } catch (err) {
    console.error("Proxy fetch error:", err);
    res.status(502).type("text/plain").send("502: Proxy error");
  }
});

// 启动
const listener = app.listen(3000, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
