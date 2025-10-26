const path = require('path');

module.exports = {
  plugins: [
    ['@mpflow/plugin-babel'],
    [
      '@mpflow/plugin-e2e-test',
      {
        // 使用干净入口目录，避免根目录噪音影响 DevTools 自动化
        projectPath: path.resolve(__dirname, 'wx-project'),
        devtoolsCliPath: 'C:\\Program Files (x86)\\Tencent\\???web?????????\\cli.bat',
        wsEndpoint: 'ws://127.0.0.1:9421',
        reconnectTries: 40,
        reconnectInterval: 2000,
      },
    ],
  ],
};
