const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const rootDir = path.resolve(__dirname, "..");
const envPath = path.join(rootDir, ".env");

if (!fs.existsSync(envPath)) {
  console.error("Missing .env file. Please configure environment variables first.");
  process.exit(1);
}

const envConfig = dotenv.parse(fs.readFileSync(envPath));

const requiredKeys = ["WECHAT_MINIAPP_ID", "TCB_ENV"];
const missingKeys = requiredKeys.filter((key) => !envConfig[key] || !envConfig[key].trim());

if (missingKeys.length > 0) {
  console.error(`Missing required environment variables: ${missingKeys.join(", ")}`);
  process.exit(1);
}

const miniAppId = envConfig.WECHAT_MINIAPP_ID.trim();
const cloudEnvId = envConfig.TCB_ENV.trim();
const runtimeEnv = (envConfig.NODE_ENV || "development").trim();

const projectConfig = {
  miniprogramRoot: "miniprogram/",
  cloudfunctionRoot: "cloudfunctions/",
  setting: {
    urlCheck: true,
    es6: true,
    enhance: true,
    postcss: true,
    preloadBackgroundData: false,
    minified: true
  },
  compileType: "miniprogram",
  libVersion: "latest",
  appid: miniAppId,
  projectname: "wechat-miniapp",
  condition: {}
};

const projectConfigPath = path.join(rootDir, "project.config.json");
fs.writeFileSync(projectConfigPath, JSON.stringify(projectConfig, null, 2) + "\n", "utf-8");

const envListContent = `const envList = [
  {
    envId: "${cloudEnvId}",
    alias: "${runtimeEnv === "production" ? "prod" : "dev"}"
  }
];

module.exports = {
  envList,
  cloudEnvId: "${cloudEnvId}",
  isProduction: ${runtimeEnv === "production"}
};
`;

const miniprogramConfigDir = path.join(rootDir, "miniprogram", "config");
if (!fs.existsSync(miniprogramConfigDir)) {
  fs.mkdirSync(miniprogramConfigDir, { recursive: true });
}

fs.writeFileSync(path.join(miniprogramConfigDir, "envList.js"), envListContent, "utf-8");

const cloudFunctionsDir = path.join(rootDir, "cloudfunctions");
if (!fs.existsSync(cloudFunctionsDir)) {
  fs.mkdirSync(cloudFunctionsDir, { recursive: true });
}

fs.writeFileSync(path.join(cloudFunctionsDir, "envList.js"), envListContent, "utf-8");

const helloWorldConfigPath = path.join(cloudFunctionsDir, "helloWorld", "config.json");
const helloWorldConfig = {
  permissions: {
    openapi: [
      "security.getOpenData"
    ]
  },
  environment: cloudEnvId
};

const helloWorldDir = path.dirname(helloWorldConfigPath);
if (!fs.existsSync(helloWorldDir)) {
  fs.mkdirSync(helloWorldDir, { recursive: true });
}

fs.writeFileSync(helloWorldConfigPath, JSON.stringify(helloWorldConfig, null, 2) + "\n", "utf-8");

console.log("Config sync complete based on .env.");
