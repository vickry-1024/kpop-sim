/**
 * Kpop嫂子模拟器 — 主入口文件
 * 负责全局命名空间、应用初始化、标题画面/设定向导流程控制
 */

/**
 * 全局游戏命名空间
 * 所有游戏模块挂载到此对象下
 */
window.Game = {
  // 版本号
  version: '0.1.0',

  // 当前开发阶段
  phase: '阶段5 ✅ → 准备阶段6：DeepSeek API接入',

  // 全局状态
  state: {
    initialized: false,
    currentTurn: 0,
    player: null,
    idols: []
  }
};

// ===== 标题画面功能 =====

/**
 * 渲染标题画面的存档列表
 */
Game.renderTitleScreen = function() {
  const listEl = document.getElementById('title-save-list');
  const sectionEl = document.getElementById('title-save-section');
  if (!listEl || !sectionEl) return;

  const summaries = Game.State.getSaveSummaries();
  const hasSaves = summaries.some(s => s.hasData);

  if (!hasSaves) {
    // 无存档：隐藏存档区，只显示新游戏按钮
    sectionEl.style.display = 'none';
    return;
  }

  sectionEl.style.display = 'block';
  listEl.innerHTML = summaries
    .filter(s => s.hasData)
    .map(s => `
      <div class="save-card">
        <div class="save-card-info">
          <div class="save-card-title">📂 存档 ${s.slot}</div>
          <div class="save-card-detail">
            <span class="save-player-name">${escapeHtml(s.playerName)}</span>
            <span class="save-turn">第 ${s.turn} 回合</span>
          </div>
          <div class="save-card-time">🕐 ${s.time}</div>
        </div>
        <div class="save-card-actions">
          <button class="btn btn-primary btn-sm" onclick="Game.continueGame(${s.slot})">继续</button>
          <button class="btn btn-danger btn-sm" onclick="Game.confirmDeleteSave(${s.slot})">删除</button>
        </div>
      </div>
    `).join('');
};

/**
 * 继续游戏：加载存档并进入游戏主界面
 */
Game.continueGame = function(slot) {
  const success = Game.State.loadGame(slot);
  if (!success) {
    alert('存档加载失败，可能已损坏');
    return;
  }
  showAppScreen();
};

/**
 * 确认删除存档
 */
Game.confirmDeleteSave = function(slot) {
  const summary = Game.State.getSaveSummaries().find(s => s.slot === slot);
  const name = summary ? summary.playerName : '未知';
  if (confirm('确定要删除「' + name + '」的存档吗？此操作不可撤销！')) {
    Game.State.deleteSave(slot);
    Game.renderTitleScreen();
  }
};

/**
 * 返回标题画面（保存当前进度后返回）
 */
Game.returnToTitle = function() {
  // 先保存当前进度
  Game.State.autoSave();

  const titleScreen = document.getElementById('title-screen');
  const app = document.getElementById('app');

  if (app) {
    app.style.opacity = '0';
    app.style.transition = 'opacity 200ms ease-out';
    setTimeout(() => {
      app.style.display = 'none';
      if (titleScreen) {
        titleScreen.style.display = 'flex';
        titleScreen.style.opacity = '1';
      }
      Game.renderTitleScreen();
    }, 200);
  }

  console.log('[App] 返回标题画面，进度已保存（槽' + Game.State.getCurrentSlot() + '）');
};

/**
 * 开始新游戏：显示设定向导
 */
Game.startNewGame = function() {
  // 检查是否所有存档槽已满
  if (Game.State.allSlotsFull()) {
    if (!confirm('所有存档槽（1-3）都已满。开始新游戏将覆盖最早的存档，确定继续吗？\n\n建议：先在标题画面删除不需要的存档。')) {
      return;
    }
  }

  const titleScreen = document.getElementById('title-screen');
  const setupScreen = document.getElementById('setup-screen');

  if (titleScreen) titleScreen.style.display = 'none';
  if (setupScreen) {
    setupScreen.style.display = 'flex';
    setupScreen.style.opacity = '1';
    // 重置设定向导到第一步
    Game.Setup.init();
  }
};

// ===== 内部函数 =====

/**
 * 显示游戏主界面（隐藏所有覆盖层）
 */
function showAppScreen() {
  const titleScreen = document.getElementById('title-screen');
  const setupScreen = document.getElementById('setup-screen');
  const app = document.getElementById('app');

  if (titleScreen) titleScreen.style.display = 'none';
  if (setupScreen) setupScreen.style.display = 'none';
  if (app) {
    app.style.display = 'flex';
    app.style.opacity = '1';
  }

  // 刷新各面板
  if (Game.Profile) Game.Profile.refresh();
  if (Game.Relations) Game.Relations.refresh();
  if (Game.Turn) Game.Turn.refreshUI();

  console.log('[App] 游戏主界面已显示');
}

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

  // 初始化关系面板
  if (Game.Relations) {
    Game.Relations.init();
  }

  // 初始化关系阶段系统
  if (Game.Relationship) {
    Game.Relationship.init();
  }

  // 初始化回合系统
  if (Game.Turn) {
    Game.Turn.init();
  }

  // 初始化手机系统
  if (Game.Phone) {
    Game.Phone.init();
  }

  // 决定显示哪个画面：有存档→标题画面，无存档→设定向导
  const summaries = Game.State.getSaveSummaries();
  const hasSaves = summaries.some(s => s.hasData);

  const titleScreen = document.getElementById('title-screen');
  const setupScreen = document.getElementById('setup-screen');

  if (hasSaves) {
    // 有存档：显示标题画面
    if (titleScreen) titleScreen.style.display = 'flex';
    if (setupScreen) setupScreen.style.display = 'none';
    Game.renderTitleScreen();
  } else {
    // 无存档：显示设定向导（原有逻辑）
    if (titleScreen) titleScreen.style.display = 'none';
    if (setupScreen) setupScreen.style.display = 'flex';
    // Game.Setup.initAllListeners() 已在 DOMContentLoaded 中调用
  }

  console.log('🎮 Kpop嫂子模拟器 v' + Game.version + ' 初始化完成');
  console.log('📱 在手机上打开可获得最佳体验');
  console.log('📋 当前阶段：' + Game.phase);
}

/**
 * HTML转义工具
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

// DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', initApp);
