// components/role-badge/index.js

Component({
  properties: {
    // 角色类型
    role: {
      type: String,
      value: ''
    },
    // 显示大小
    size: {
      type: String,
      value: 'medium' // small, medium, large
    },
    // 是否显示文字
    showText: {
      type: Boolean,
      value: true
    },
    // 是否显示图标
    showIcon: {
      type: Boolean,
      value: true
    },
    // 自定义文字
    customText: {
      type: String,
      value: ''
    },
    // 是否可点击
    clickable: {
      type: Boolean,
      value: false
    },
    // 自定义样式类
    customClass: {
      type: String,
      value: ''
    }
  },

  data: {
    roleConfig: {
      admin: {
        name: '管理员',
        color: '#ff3b30',
        bgColor: '#ffebeb',
        borderColor: '#ff3b30',
        icon: 'admin'
      },
      social_worker: {
        name: '社工',
        color: '#007aff',
        bgColor: '#e6f3ff',
        borderColor: '#007aff',
        icon: 'service'
      },
      volunteer: {
        name: '志愿者',
        color: '#34c759',
        bgColor: '#e6f9e6',
        borderColor: '#34c759',
        icon: 'volunteer'
      },
      parent: {
        name: '家长',
        color: '#ff9500',
        bgColor: '#fff4e6',
        borderColor: '#ff9500',
        icon: 'family'
      },
      guest: {
        name: '访客',
        color: '#8e8e93',
        bgColor: '#f2f2f7',
        borderColor: '#8e8e93',
        icon: 'guest'
      }
    }
  },

  computed: {
    currentRoleConfig() {
      const role = this.data.role || 'guest';
      return this.data.roleConfig[role] || this.data.roleConfig.guest;
    },

    badgeClass() {
      const { size, clickable, customClass } = this.data;
      const { currentRoleConfig } = this;

      let classes = ['role-badge'];

      // 尺寸样式
      if (size) {
        classes.push(`role-badge--${size}`);
      }

      // 可点击样式
      if (clickable) {
        classes.push('role-badge--clickable');
      }

      // 自定义样式
      if (customClass) {
        classes.push(customClass);
      }

      return classes.join(' ');
    },

    badgeStyle() {
      const { currentRoleConfig } = this;
      return {
        '--role-color': currentRoleConfig.color,
        '--role-bg-color': currentRoleConfig.bgColor,
        '--role-border-color': currentRoleConfig.borderColor
      };
    },

    displayText() {
      const { customText, showText } = this.data;
      const { currentRoleConfig } = this;

      if (!showText) {
        return '';
      }

      return customText || currentRoleConfig.name;
    },

    iconUrl() {
      const { showIcon } = this.data;
      const { currentRoleConfig } = this;

      if (!showIcon) {
        return '';
      }

      return `/assets/icons/role-${currentRoleConfig.icon}.png`;
    }
  },

  methods: {
    /**
     * 处理徽章点击
     */
    onBadgeTap() {
      if (!this.data.clickable) {
        return;
      }

      this.triggerEvent('tap', {
        role: this.data.role,
        config: this.currentRoleConfig
      });
    },

    /**
     * 获取角色颜色
     */
    getRoleColor() {
      return this.currentRoleConfig.color;
    },

    /**
     * 获取角色名称
     */
    getRoleName() {
      return this.currentRoleConfig.name;
    },

    /**
     * 获取图标路径
     */
    getIconUrl() {
      return this.iconUrl;
    },

    /**
     * 检查是否为管理员角色
     */
    isAdmin() {
      return this.data.role === 'admin';
    },

    /**
     * 检查是否为社工角色
     */
    isSocialWorker() {
      return this.data.role === 'social_worker';
    },

    /**
     * 检查是否为志愿者角色
     */
    isVolunteer() {
      return this.data.role === 'volunteer';
    },

    /**
     * 检查是否为家长角色
     */
    isParent() {
      return this.data.role === 'parent';
    },

    /**
     * 检查是否为访客角色
     */
    isGuest() {
      return !this.data.role || this.data.role === 'guest';
    }
  }
});