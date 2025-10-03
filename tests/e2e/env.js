const NodeEnvironment = require('jest-environment-node');
const automator = require('miniprogram-automator');
const path = require('path');

class DevtoolsEnvironment extends NodeEnvironment {
  constructor(config, context) {
    super(config, context);
    const options = {
      ...(config.projectConfig?.testEnvironmentOptions || {}),
      ...(config.testEnvironmentOptions || {}),
    };
    this.wsEndpoint = options.wsEndpoint || process.env.WX_DEVTOOLS_WS || 'ws://127.0.0.1:9421';
    this.projectPath = options.projectPath || path.resolve(process.cwd(), 'miniprogram');
    this.cliPath = options.cliPath || process.env.WX_DEVTOOLS_CLI;
  }

  async setup() {
    await super.setup();
    if (this.wsEndpoint) {
      this.global.miniProgram = await automator.connect({ wsEndpoint: this.wsEndpoint });
    } else {
      this.global.miniProgram = await automator.launch({
        projectPath: this.projectPath,
        cliPath: this.cliPath,
      });
    }

    this.global.__coverage__ = this.global.__coverage__ || {};

    if (this.global.miniProgram && typeof this.global.miniProgram.evaluate === 'function') {
      try {
        await this.global.miniProgram.evaluate(() => {
          if (typeof globalThis !== 'undefined') {
            globalThis.__coverage__ = globalThis.__coverage__ || {};
          } else if (typeof global !== 'undefined') {
            global.__coverage__ = global.__coverage__ || {};
          }
        });
      } catch (error) {
        // ignore evaluation failures
      }
    }
  }

  async teardown() {
    if (this.global.miniProgram) {
      if (typeof this.global.miniProgram.disconnect === 'function') {
        await this.global.miniProgram.disconnect();
      } else if (typeof this.global.miniProgram.close === 'function') {
        await this.global.miniProgram.close();
      }
    }
    await super.teardown();
  }
}

module.exports = DevtoolsEnvironment;
