#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * 自动创建微信小程序组件脚本
 * 用法: npm run component:create <component-name>
 */

function createComponent(componentName) {
  if (!componentName) {
    console.error('❌ 请提供组件名称');
    console.log('用法: npm run component:create <component-name>');
    process.exit(1);
  }

  // 验证组件名称格式
  if (!/^[a-z][a-z0-9-]*$/.test(componentName)) {
    console.error('❌ 组件名称必须以小写字母开头，只能包含小写字母、数字和连字符');
    process.exit(1);
  }

  const componentDir = path.join('wx-project', 'components', componentName);

  // 检查组件是否已存在
  if (fs.existsSync(componentDir)) {
    console.error(`❌ 组件 "${componentName}" 已存在`);
    process.exit(1);
  }

  // 创建组件目录
  fs.mkdirSync(componentDir, { recursive: true });

  // 生成组件文件内容
  const templates = {
    js: generateJSTemplate(componentName),
    json: generateJSONTemplate(),
    wxml: generateWXMLTemplate(componentName),
    wxss: generateWXSSTemplate(componentName),
    test: generateTestTemplate(componentName),
  };

  // 创建组件文件
  const files = [
    { name: `${componentName}.js`, content: templates.js },
    { name: `${componentName}.json`, content: templates.json },
    { name: `${componentName}.wxml`, content: templates.wxml },
    { name: `${componentName}.wxss`, content: templates.wxss },
  ];

  files.forEach(file => {
    fs.writeFileSync(path.join(componentDir, file.name), file.content);
  });

  // 创建测试文件
  const testDir = path.join('tests', 'unit', 'components');
  fs.mkdirSync(testDir, { recursive: true });
  fs.writeFileSync(path.join(testDir, `${componentName}.test.js`), templates.test);

  console.log(`✅ 组件 "${componentName}" 创建成功！`);
  console.log(`📁 组件位置: ${componentDir}`);
  console.log(`🧪 测试文件: tests/unit/components/${componentName}.test.js`);
  console.log('\n📋 下一步:');
  console.log(`1. 编辑组件逻辑: ${componentName}/${componentName}.js`);
  console.log(`2. 设计组件模板: ${componentName}/${componentName}.wxml`);
  console.log(`3. 添加组件样式: ${componentName}/${componentName}.wxss`);
  console.log(`4. 编写单元测试: tests/unit/components/${componentName}.test.js`);
}

function generateJSTemplate(componentName) {
  const pascalName = componentName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');

  return `// ${pascalName}组件
Component({
  /**
   * 组件的属性列表
   */
  properties: {
    // 示例属性
    text: {
      type: String,
      value: '默认文本'
    },
    disabled: {
      type: Boolean,
      value: false
    }
  },

  /**
   * 组件的初始数据
   */
  data: {
    // 内部状态
  },

  /**
   * 组件的方法列表
   */
  methods: {
    /**
     * 处理点击事件
     */
    handleTap() {
      if (this.data.disabled) {
        return;
      }

      // 触发自定义事件
      this.triggerEvent('tap', {
        text: this.properties.text
      });
    },

    /**
     * 外部方法示例
     */
    publicMethod() {
      return this.data;
    }
  },

  /**
   * 组件生命周期
   */
  lifetimes: {
    attached() {
      // 组件实例进入页面节点树时执行
    },

    detached() {
      // 组件实例被从页面节点树移除时执行
    }
  },

  /**
   * 组件所在页面的生命周期
   */
  pageLifetimes: {
    show() {
      // 组件所在的页面被展示时执行
    },

    hide() {
      // 组件所在的页面被隐藏时执行
    }
  }
});
`;
}

function generateJSONTemplate() {
  return `{
  "component": true,
  "usingComponents": {}
}
`;
}

function generateWXMLTemplate(componentName) {
  return `<!--${componentName}组件模板-->
<view class="${componentName}" bind:tap="handleTap">
  <text class="${componentName}__text">{{text}}</text>
</view>
`;
}

function generateWXSSTemplate(componentName) {
  return `/* ${componentName}组件样式 */
.${componentName} {
  /* 使用设计令牌 */
  padding: var(--spacing-md);
  border-radius: var(--border-radius-base);
  background-color: var(--color-bg-container);

  /* 基础样式 */
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 88rpx; /* 最小触摸目标 */

  /* 状态样式 */
  transition: all 0.2s ease;
}

.${componentName}:active {
  background-color: var(--color-bg-container-hover);
  transform: scale(0.98);
}

.${componentName}__text {
  color: var(--color-text);
  font-size: var(--font-size-base);
  line-height: var(--line-height-base);
}

/* 响应式设计 */
@media (max-width: 768rpx) {
  .${componentName} {
    padding: var(--spacing-sm);
  }
}
`;
}

function generateTestTemplate(componentName) {
  const pascalName = componentName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');

  return `// ${pascalName}组件测试
describe('${pascalName}组件', () => {
  let component;

  beforeEach(() => {
    // 模拟组件实例
    component = {
      properties: {
        text: '测试文本',
        disabled: false
      },
      data: {},
      triggerEvent: jest.fn(),
      setData: jest.fn()
    };
  });

  describe('属性测试', () => {
    test('应该设置默认文本', () => {
      expect(component.properties.text).toBe('测试文本');
    });

    test('应该设置disabled状态', () => {
      expect(component.properties.disabled).toBe(false);
    });
  });

  describe('事件测试', () => {
    test('应该处理点击事件', () => {
      // 模拟组件方法
      const handleTap = function() {
        if (this.properties.disabled) {
          return;
        }
        this.triggerEvent('tap', {
          text: this.properties.text
        });
      };

      // 执行点击处理
      handleTap.call(component);

      // 验证事件触发
      expect(component.triggerEvent).toHaveBeenCalledWith('tap', {
        text: '测试文本'
      });
    });

    test('disabled状态下不应该触发事件', () => {
      component.properties.disabled = true;

      const handleTap = function() {
        if (this.properties.disabled) {
          return;
        }
        this.triggerEvent('tap', {
          text: this.properties.text
        });
      };

      handleTap.call(component);

      expect(component.triggerEvent).not.toHaveBeenCalled();
    });
  });

  describe('方法测试', () => {
    test('publicMethod应该返回组件数据', () => {
      const publicMethod = function() {
        return this.data;
      };

      const result = publicMethod.call(component);
      expect(result).toBe(component.data);
    });
  });
});
`;
}

// 执行脚本
const componentName = process.argv[2];
createComponent(componentName);
