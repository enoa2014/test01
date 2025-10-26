const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const rootDir = path.resolve(__dirname, '..');
const envPath = path.join(rootDir, '.env');

if (!fs.existsSync(envPath)) {
  console.error('Missing .env file. Please configure environment variables first.');
  process.exit(1);
}

const envConfig = dotenv.parse(fs.readFileSync(envPath));

const requiredKeys = ['WECHAT_MINIAPP_ID', 'TCB_ENV'];
const missingKeys = requiredKeys.filter(key => !envConfig[key] || !envConfig[key].trim());

if (missingKeys.length > 0) {
  console.error(`Missing required environment variables: ${missingKeys.join(', ')}`);
  process.exit(1);
}

const miniAppId = envConfig.WECHAT_MINIAPP_ID.trim();
const cloudEnvId = envConfig.TCB_ENV.trim();
const runtimeEnv = (envConfig.NODE_ENV || 'development').trim();

// 根项目配置（作为唯一权威配置入口）
const projectConfig = {
  miniprogramRoot: 'wx-project/',
  cloudfunctionRoot: 'cloudfunctions/',
  setting: {
    urlCheck: true,
    es6: true,
    enhance: true,
    postcss: true,
    preloadBackgroundData: false,
    minified: true,
  },
  compileType: 'miniprogram',
  libVersion: 'latest',
  appid: miniAppId,
  projectname: 'wechat-miniapp',
  condition: {},
};

const projectConfigPath = path.join(rootDir, 'project.config.json');
fs.writeFileSync(projectConfigPath, JSON.stringify(projectConfig, null, 2) + '\n', 'utf-8');

// 生成一个干净的 DevTools 入口目录，避免根目录杂乱影响选择
const wrapperDir = path.join(rootDir, 'wx-project');
if (!fs.existsSync(wrapperDir)) {
  fs.mkdirSync(wrapperDir, { recursive: true });
}
const wrapperProjectConfig = {
  miniprogramRoot: '../wx-project/',
  cloudfunctionRoot: '../cloudfunctions/',
  setting: projectConfig.setting,
  compileType: 'miniprogram',
  libVersion: 'latest',
  appid: miniAppId,
  projectname: projectConfig.projectname,
  condition: {},
};
fs.writeFileSync(path.join(wrapperDir, 'project.config.json'), JSON.stringify(wrapperProjectConfig, null, 2) + '\n', 'utf-8');

// 生成/同步 wx-project 子目录的 project.config.json（用于误打开子目录时保持一致的 AppID）
const miniProjectConfigPath = path.join(rootDir, 'wx-project', 'project.config.json');
const miniProjectConfig = {
  setting: {
    es6: true,
    postcss: true,
    minified: true,
    enhance: true,
    babelSetting: {
      ignore: [],
      disablePlugins: [],
      outputPath: '',
    },
    useCompilerPlugins: false,
    minifyWXML: true,
  },
  compileType: 'miniprogram',
  appid: miniAppId,
  editorSetting: {},
};
fs.writeFileSync(miniProjectConfigPath, JSON.stringify(miniProjectConfig, null, 2) + '\n', 'utf-8');

const envListContent = `const envList = [
  {
    envId: "${cloudEnvId}",
    alias: "${runtimeEnv === 'production' ? 'prod' : 'dev'}"
  }
];

module.exports = {
  envList,
  cloudEnvId: "${cloudEnvId}",
  isProduction: ${runtimeEnv === 'production'}
};
`;

const miniprogramConfigDir = path.join(rootDir, 'wx-project', 'config');
if (!fs.existsSync(miniprogramConfigDir)) {
  fs.mkdirSync(miniprogramConfigDir, { recursive: true });
}

fs.writeFileSync(path.join(miniprogramConfigDir, 'envList.js'), envListContent, 'utf-8');

const cloudFunctionsDir = path.join(rootDir, 'cloudfunctions');
if (!fs.existsSync(cloudFunctionsDir)) {
  fs.mkdirSync(cloudFunctionsDir, { recursive: true });
}

fs.writeFileSync(path.join(cloudFunctionsDir, 'envList.js'), envListContent, 'utf-8');

const helloWorldConfigPath = path.join(cloudFunctionsDir, 'helloWorld', 'config.json');
const helloWorldConfig = {
  permissions: {
    openapi: ['security.getOpenData'],
  },
  environment: cloudEnvId,
};

const helloWorldDir = path.dirname(helloWorldConfigPath);
if (!fs.existsSync(helloWorldDir)) {
  fs.mkdirSync(helloWorldDir, { recursive: true });
}

fs.writeFileSync(helloWorldConfigPath, JSON.stringify(helloWorldConfig, null, 2) + '\n', 'utf-8');

console.log('Config sync complete based on .env.');
if (miniAppId === 'wx6fe6343a956db160') {
  console.warn('[sync-config] 注意：当前使用的 AppID 为开发者工具示例或保留 AppID，可能导致工具上报警告或模拟器异常。请确认是否为你的真实小程序 AppID。');
}
