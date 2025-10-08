const path = require('path');

module.exports = {
  plugins: [
    ['@mpflow/plugin-babel'],
    [
      '@mpflow/plugin-e2e-test',
      {
        projectPath: path.resolve(__dirname, 'miniprogram'),
        devtoolsCliPath: 'C:\\Program Files (x86)\\Tencent\\???web?????????\\cli.bat',
        wsEndpoint: 'ws://127.0.0.1:9421',
        reconnectTries: 40,
        reconnectInterval: 2000,
      },
    ],
  ],
};
