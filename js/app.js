/**
 * Kpop嫂子模拟器 — 主入口文件
 * 负责全局命名空间、应用初始化
 */

/**
 * 全局游戏命名空间
 * 所有游戏模块挂载到此对象下
 */
window.Game = {
  // 版本号
  version: '0.1.0',

  // 当前开发阶段
  phase: '阶段2：角色设定系统',

  // 全局状态（简易，正式版由 game-state.js 管理）
  state: {
    initialized: false,
    currentTurn: 0,
    player: null,
    idols: []
  }
};

/**
 * 应用初始化
 * DOM加载完成后执行
 */
function initApp() {
  // 初始化路由（选项卡切换）
  if (Game.Router) {
    Game.Router.init();
  }

  // 初始化个人面板
  if (Game.Profile) {
    Game.Profile.init();
  }

  // 标记初始化完成
  Game.state.initialized = true;

  console.log('🎮 Kpop嫂子模拟器 v' + Game.version + ' 初始化完成');
  console.log('📱 在手机上打开可获得最佳体验');
  console.log('📋 当前阶段：' + Game.phase);
}

// DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', initApp);
