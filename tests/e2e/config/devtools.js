const path = require("path");

module.exports = {
  wsEndpoint: process.env.WX_DEVTOOLS_WS || "ws://127.0.0.1:9421",
  projectPath: process.env.WX_MINIAPP_PROJECT || path.resolve(__dirname, '../../..'),
  reconnectTries: Number(process.env.WX_DEVTOOLS_RETRIES || 10),
  reconnectInterval: Number(process.env.WX_DEVTOOLS_RETRY_INTERVAL || 1000)
};