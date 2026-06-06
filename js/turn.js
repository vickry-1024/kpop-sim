/**
 * 回合系统模块 — 日程页的核心逻辑
 * 负责：回合推进、行动执行、数值结算、UI刷新
 * 依赖：Game.Actions（行动定义）、Game.State（数值修改）
 */

Game.Turn = (() => {

  // 本回合已执行的行动记录
  // [{ actionId, actionName, targetName, effects: [{label, delta}] }]
  let _turnLog = [];

  // 当前待确认目标爱豆的行动ID（弹窗用）
  let _pendingActionId = null;

  // ===== 回合结算参数 =====
  const TURN_END_STAMINA_RECOVERY = 30;  // 每回合结束体力恢复量
  const TURN_END_STRESS_DECAY = -3;       // 每回合结束压力自然衰减
  const MAX_ACTIONS_PER_TURN = 20;        // 每回合最多行动次数（安全上限）

  // ===== 初始化 =====

  function init() {
    // 监听页面切换，切换到日程页时刷新
    document.addEventListener('pageChanged', (e) => {
      if (e.detail && e.detail.to === 'schedule') {
        refreshUI();
      }
    });
    console.log('[Turn] 回合系统初始化完成');
  }

  // ===== 回合管理 =====

  /**
   * 确保回合已开始（turn 0 → 1）
   */
  function ensureTurnStarted() {
    if (!Game.state.currentTurn || Game.state.currentTurn < 1) {
      Game.state.currentTurn = 1;
      Game.State.autoSave();
      console.log('[Turn] 游戏开始：第1回合');
    }
  }

  // ===== 行动执行 =====

  /**
   * 执行一个行动
   * @param {string} actionId - 行动ID
   * @param {number|null} targetIndex - 目标爱豆索引（可选）
   */
  function executeAction(actionId, targetIndex) {
    const action = Game.Actions.getAction(actionId);
    if (!action) {
      console.warn('[Turn] 未知行动：' + actionId);
      return false;
    }

    // 验证体力足够
    const staminaCost = getModifiedStaminaCost(action);
    const currentStamina = Game.state.player.stats.stamina;
    if (currentStamina < staminaCost) {
      console.warn('[Turn] 体力不足：需要' + staminaCost + '，当前' + currentStamina);
      return false;
    }

    // 验证行动次数上限
    if (_turnLog.length >= MAX_ACTIONS_PER_TURN) {
      console.warn('[Turn] 本回合行动次数已达上限');
      return false;
    }

    // 验证需要目标时是否提供了目标
    if (action.needsTarget && (targetIndex === null || targetIndex === undefined)) {
      console.warn('[Turn] 行动需要选择目标爱豆');
      return false;
    }

    // 验证目标爱豆存在
    if (action.needsTarget) {
      const idol = Game.state.idols[targetIndex];
      if (!idol) {
        console.warn('[Turn] 目标爱豆不存在：index=' + targetIndex);
        return false;
      }
    }

    // --- 执行行动 ---

    // 1. 扣除体力
    Game.State.addStamina(-staminaCost);

    // 2. 应用效果
    const effectLog = applyEffects(action, targetIndex);

    // 3. 记录日志
    const targetName = action.needsTarget
      ? (Game.state.idols[targetIndex].nickname || Game.state.idols[targetIndex].name)
      : null;

    _turnLog.push({
      actionId: action.id,
      actionName: action.name,
      icon: action.icon,
      targetName: targetName,
      effects: effectLog
    });

    // 4. 自动存档
    Game.State.autoSave();

    // 5. 刷新UI
    refreshUI();

    // 6. 同时刷新关系面板和我的面板（如果可见的话）
    if (Game.Relations) Game.Relations.refresh();
    if (Game.Profile) Game.Profile.refresh();

    console.log('[Turn] 行动完成：' + action.name + (targetName ? ' → ' + targetName : ''));
    return true;
  }

  /**
   * 应用行动效果到数值
   * @param {Object} action - 行动定义
   * @param {number|null} targetIndex - 目标爱豆索引
   * @returns {Array<{label: string, delta: number}>} 效果日志
   */
  function applyEffects(action, targetIndex) {
    const effects = action.effects;
    const mods = Game.state.player.identityModifiers || {};
    const log = [];

    // 遍历效果
    Object.keys(effects).forEach(key => {
      const range = effects[key];
      // 在范围内取随机值
      const rawDelta = randomInRange(range[0], range[1]);
      if (rawDelta === 0) return; // 无变化则跳过

      // 应用身份修正
      const delta = applyIdentityModifier(rawDelta, key, mods);
      if (delta === 0) return;

      // 根据key调用对应的数值修改函数
      switch (key) {
        case 'affection':
          if (targetIndex !== null && targetIndex !== undefined) {
            Game.State.addAffection(targetIndex, delta);
            const idolName = Game.state.idols[targetIndex].nickname || Game.state.idols[targetIndex].name;
            log.push({ label: idolName + ' 好感度', delta: delta });
          }
          break;
        case 'stress':
          Game.State.addStress(delta);
          log.push({ label: '压力', delta: delta });
          break;
        case 'suspicion':
          Game.State.addSuspicion(delta);
          log.push({ label: '嫌疑度', delta: delta });
          break;
        case 'stamina':
          Game.State.addStamina(delta);
          log.push({ label: '体力', delta: delta });
          break;
        case 'charm':
          Game.State.addCharm(delta);
          log.push({ label: '魅力', delta: delta });
          break;
      }
    });

    return log;
  }

  /**
   * 在[min, max]范围内取随机整数
   */
  function randomInRange(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * 应用身份修正值
   * @param {number} rawDelta - 原始变化量
   * @param {string} statKey - 数值键名
   * @param {Object} mods - 身份修正值对象
   * @returns {number} 修正后的变化量
   */
  function applyIdentityModifier(rawDelta, statKey, mods) {
    let multiplier = 1.0;

    switch (statKey) {
      case 'affection':
        // affectionBonus: 正数增加好感加成，负数削弱
        multiplier = 1 + (mods.affectionBonus || 0) / 100;
        break;
      case 'suspicion':
        // suspicionMod: 正数增加嫌疑度，负数降低
        multiplier = 1 + (mods.suspicionMod || 0) / 100;
        break;
      case 'stamina':
        // staminaMod: 正数=消耗更多体力，负数=消耗更少
        // 注意：这里传入的已经是-cost，所以修正值方向需要反过来
        multiplier = 1 + (mods.staminaMod || 0) / 100;
        break;
      case 'charm':
        // charmBonus: 正数增加魅力获取
        multiplier = 1 + (mods.charmBonus || 0) / 100;
        break;
      case 'stress':
        // stressResist: 正数=减少压力增长（抵抗）
        if (rawDelta > 0) {
          // 压力增加时，抵抗力削弱增幅
          multiplier = 1 - (mods.stressResist || 0) / 100;
        }
        // 压力减少时，不应用修正
        break;
    }

    return Math.round(rawDelta * multiplier);
  }

  /**
   * 获取经过身份修正的体力消耗
   */
  function getModifiedStaminaCost(action) {
    const base = action.staminaCost;
    const mods = Game.state.player.identityModifiers || {};
    const staminaMod = mods.staminaMod || 0;
    // staminaMod为正 → 消耗更多；为负 → 消耗更少
    return Math.max(0, Math.round(base * (1 + staminaMod / 100)));
  }

  // ===== 回合结束 =====

  /**
   * 结束当前回合
   */
  function endTurn() {
    ensureTurnStarted();

    // 1. 体力自然恢复
    Game.State.addStamina(TURN_END_STAMINA_RECOVERY);

    // 2. 压力自然衰减
    Game.State.addStress(TURN_END_STRESS_DECAY);

    // 3. 回合数+1
    Game.state.currentTurn++;

    // 4. 清空本回合行动日志
    _turnLog = [];

    // 5. 自动存档
    Game.State.autoSave();

    // 6. 刷新UI
    refreshUI();

    // 7. 刷新其他面板
    if (Game.Relations) Game.Relations.refresh();
    if (Game.Profile) Game.Profile.refresh();

    console.log('[Turn] 回合结束 → 第' + Game.state.currentTurn + '回合');
  }

  // ===== 目标选择弹窗 =====

  /**
   * 显示目标爱豆选择弹窗
   * @param {string} actionId - 待执行的行动ID
   */
  function showTargetModal(actionId) {
    const action = Game.Actions.getAction(actionId);
    if (!action) return;

    _pendingActionId = actionId;

    const modal = document.getElementById('target-modal');
    const title = document.getElementById('target-modal-title');
    const list = document.getElementById('target-modal-list');

    if (!modal || !title || !list) return;

    title.textContent = action.icon + ' ' + action.name + ' — 选择对象';

    const idols = Game.state.idols || [];
    list.innerHTML = idols.map((idol, i) => `
      <button class="target-option" onclick="Game.Turn.confirmTarget(${i})">
        <span class="target-option-icon">💜</span>
        <div class="target-option-info">
          <span class="target-option-name">${escapeHtml(idol.nickname || idol.name)}</span>
          <span class="target-option-affection">好感度: ${idol.stats.affection}</span>
        </div>
        <span class="target-option-arrow">→</span>
      </button>
    `).join('');

    modal.style.display = 'flex';
  }

  /**
   * 确认选择目标爱豆并执行行动
   * @param {number} targetIndex
   */
  function confirmTarget(targetIndex) {
    hideTargetModal();
    if (_pendingActionId) {
      executeAction(_pendingActionId, targetIndex);
      _pendingActionId = null;
    }
  }

  /**
   * 取消目标选择
   */
  function cancelTarget() {
    hideTargetModal();
    _pendingActionId = null;
  }

  function hideTargetModal() {
    const modal = document.getElementById('target-modal');
    if (modal) modal.style.display = 'none';
  }

  // ===== 点击行动卡片处理 =====

  /**
   * 处理行动卡片点击
   * @param {string} actionId
   */
  function onActionClick(actionId) {
    const action = Game.Actions.getAction(actionId);
    if (!action) return;

    // 检查体力
    const staminaCost = getModifiedStaminaCost(action);
    const currentStamina = Game.state.player.stats.stamina;
    if (currentStamina < staminaCost) {
      shakeElement(document.getElementById('schedule-stamina-bar'));
      return;
    }

    // 需要目标 → 弹出选择器
    if (action.needsTarget) {
      showTargetModal(actionId);
    } else {
      executeAction(actionId, null);
    }
  }

  function shakeElement(el) {
    if (!el) return;
    el.style.animation = 'none';
    el.offsetHeight;
    el.style.animation = 'shake 0.4s ease';
  }

  // ===== UI渲染 =====

  function refreshUI() {
    if (!Game.state.initialized) return;

    ensureTurnStarted();

    renderTurnHeader();
    renderStaminaBar();
    renderActionGrid();
    renderActionLog();
    renderEndTurnButton();
  }

  /**
   * 渲染回合信息头部
   */
  function renderTurnHeader() {
    const el = document.getElementById('schedule-turn-info');
    if (!el) return;
    el.innerHTML = `
      <span class="turn-label">📅 第 ${Game.state.currentTurn} 回合</span>
      <span class="turn-hint">半个月的行程</span>
    `;
  }

  /**
   * 渲染体力条
   */
  function renderStaminaBar() {
    const container = document.getElementById('schedule-stamina-bar');
    if (!container) return;

    const stamina = Game.state.player.stats.stamina;
    const barColor = stamina < 20 ? 'var(--color-danger)' :
                     stamina < 50 ? 'var(--color-warning)' : 'var(--color-stamina)';

    container.innerHTML = `
      <div class="stamina-header">
        <span class="stamina-label">⚡ 体力</span>
        <span class="stamina-value">${stamina} / 100</span>
      </div>
      <div class="stamina-bar-bg">
        <div class="stamina-bar-fill" style="width:${Math.min(stamina, 100)}%; background:${barColor};"></div>
      </div>
    `;
  }

  /**
   * 渲染行动网格
   */
  function renderActionGrid() {
    const container = document.getElementById('schedule-action-grid');
    if (!container) return;

    const groups = Game.Actions.getGroupedActions();
    const currentStamina = Game.state.player.stats.stamina;

    container.innerHTML = groups.map(group => {
      const cat = group.category;
      return `
        <div class="action-category">
          <div class="action-category-header" style="color:${cat.color}">
            <span>${cat.icon} ${cat.name}</span>
          </div>
          <div class="action-grid">
            ${group.actions.map(action => {
              const cost = getModifiedStaminaCost(action);
              const affordable = currentStamina >= cost;
              return `
                <button class="action-card category-${cat.id} ${!affordable ? 'action-disabled' : ''}"
                        onclick="Game.Turn.onActionClick('${action.id}')"
                        ${!affordable ? 'disabled' : ''}>
                  <span class="action-icon">${action.icon}</span>
                  <span class="action-name">${action.name}</span>
                  <span class="action-cost">${cost > 0 ? '-' + cost + ' ⚡' : '免费'}</span>
                </button>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * 渲染行动日志
   */
  function renderActionLog() {
    const container = document.getElementById('schedule-action-log');
    if (!container) return;

    if (_turnLog.length === 0) {
      container.innerHTML = `
        <div class="action-log-empty">
          <span>📋 本回合尚未行动</span>
          <span class="action-log-hint">选择上方的行动开始安排行程</span>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="action-log-header">📋 本回合行动记录</div>
      <div class="action-log-list">
        ${_turnLog.map(entry => `
          <div class="action-log-item">
            <span class="action-log-icon">${entry.icon}</span>
            <span class="action-log-desc">
              ${entry.actionName}${entry.targetName ? ' → ' + entry.targetName : ''}
            </span>
            <span class="action-log-effects">
              ${entry.effects.map(e => {
                const sign = e.delta > 0 ? '+' : '';
                const cls = e.delta > 0 ? 'effect-positive' : 'effect-negative';
                return `<span class="${cls}">${sign}${e.delta} ${e.label}</span>`;
              }).join(' ')}
            </span>
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * 渲染结束回合按钮
   */
  function renderEndTurnButton() {
    const container = document.getElementById('schedule-end-turn');
    if (!container) return;

    container.innerHTML = `
      <button class="btn btn-primary btn-block btn-lg" onclick="Game.Turn.endTurn()">
        📅 结束回合（第${Game.state.currentTurn}回合）→
      </button>
      <p class="turn-end-hint">结束回合后恢复30体力，压力-3</p>
    `;
  }

  // ===== 公开API =====
  return {
    init,
    refreshUI,
    executeAction,
    endTurn,
    onActionClick,
    showTargetModal,
    confirmTarget,
    cancelTarget,
    getTurnLog: () => _turnLog
  };

})();
