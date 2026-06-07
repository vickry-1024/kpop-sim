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

  // 当前已确认的目标爱豆索引（用于先选目标再选子选项的流程）
  let _pendingTargetIndex = null;

  // 当前待选子选项的行动ID
  let _pendingSubActionId = null;

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

    // 随机事件：秘密手机解锁检测
    _checkSecretPhoneEvent(action, targetIndex);

    // 邂逅检测：圈内活动行动
    if (action.id === 'attend-event' && Game.Encounter) {
      if (Math.random() * 100 < 60) {
        console.log('[Turn] 圈内活动触发邂逅！');
        setTimeout(function() { Game.Encounter.triggerEncounter('action'); }, 500);
      }
    }

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
      let delta = applyIdentityModifier(rawDelta, key, mods);

      // 粉丝数对嫌疑度加成（粉丝越多越容易被盯上）
      if (key === 'suspicion' && delta > 0) {
        const followers = Game.state.player.social ? Game.state.player.social.followers : 0;
        const followerMult = getFollowerSuspicionMultiplier(followers);
        delta = Math.round(delta * followerMult);
        // 检查经纪人帮助隐瞒buff（嫌疑度增幅减半）
        if (targetIndex !== null && targetIndex !== undefined && Game.State.hasActiveBuff('suspicionRateHalved', targetIndex)) {
          delta = Math.round(delta / 2);
          console.log('[Turn] 经纪人buff生效：嫌疑度增幅减半（idolIndex=' + targetIndex + '）');
        }
      }

      if (delta === 0) return;

      // 根据key调用对应的数值修改函数
      switch (key) {
        case 'affection':
          if (targetIndex !== null && targetIndex !== undefined) {
            // 好感度越高，获得好感越难（边际递减）
            if (delta > 0) {
              var currentAff = Game.state.idols[targetIndex].stats.affection || 0;
              if (currentAff >= 90) {
                delta = Math.round(delta * 0.3);
              } else if (currentAff >= 75) {
                delta = Math.round(delta * 0.5);
              } else if (currentAff >= 50) {
                delta = Math.round(delta * 0.7);
              }
            }
            if (delta === 0) return;
            Game.State.addAffection(targetIndex, delta);
            const idolName = Game.state.idols[targetIndex].nickname || Game.state.idols[targetIndex].name;
            log.push({ label: idolName + ' 好感度', delta: delta });
            // 出轨检测：如果玩家在排他关系中与非伴侣爱豆互动
            if (delta > 0 && Game.Relationship) {
              Game.Relationship.checkCheatingOnAction(targetIndex, delta);
            }
            // 被拍风险：高嫌疑度下约会行动有8%额外触发
            if (delta > 0 && Game.Reality && Game.state.player.stats.suspicion >= 70) {
              var idol = Game.state.idols[targetIndex];
              var stage = idol ? (idol.relationshipStage || 'pursuit') : 'pursuit';
              if ((stage === 'dating' || stage === 'married') && !Game.Reality.hasMediaFlag(targetIndex, 'caughtOnCamera')) {
                if (Math.random() * 100 < 8) {
                  setTimeout(function() { Game.Reality.checkCaughtOnCamera(targetIndex); }, 800);
                }
              }
            }
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
        case 'followers':
          Game.State.addFollowers(delta);
          log.push({ label: '粉丝数', delta: delta });
          break;
        case 'posts':
          Game.State.incrementPosts();
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

    // 1. 体力回满
    Game.state.player.stats.stamina = 100;

    // 2. 压力自然衰减
    Game.State.addStress(TURN_END_STRESS_DECAY);

    // 2.5. 检查未回复消息 → 降低好感度
    _checkUnrepliedPenalties();

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

    // 8. 随机爱豆主动发消息（fire-and-forget，不阻塞）
    _triggerProactiveMessages();

    // 9. 好友主动发消息
    _triggerFriendProactiveMessages();

    // 10. 经纪人介入检查
    _checkManagerInterventions();

    // 11. 经纪人跟进消息
    _triggerManagerFollowups();

    // 12. 关系阶段推进检测
    if (Game.Relationship) {
      Game.Relationship.checkAllStageTransitions();
    }

    // 13. 随机邂逅检测
    _checkRandomEncounters();

    // 14. 查岗系统（阶段8）
    if (Game.Reality) {
      Game.Reality.triggerPartnerCheckIns();
      Game.Reality.triggerCompanyCheckIn();
    }

    // 15. 私生/媒体事件检测（阶段8）
    if (Game.Reality) {
      _checkMediaEvents();
    }

    // 16. 名场面随机事件（阶段8）
    if (Game.Reality) {
      Game.Reality.checkFamousScene();
    }

    // 17. 日常细节检测（阶段8）
    if (Game.Reality) {
      _checkDailyDetails();
    }

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
   * 确认选择目标爱豆并继续流程
   * @param {number} targetIndex
   */
  function confirmTarget(targetIndex) {
    hideTargetModal();
    _pendingTargetIndex = targetIndex;

    const actionId = _pendingSubActionId || _pendingActionId;
    if (!actionId) {
      _pendingTargetIndex = null;
      return;
    }

    const action = Game.Actions.getAction(actionId);
    if (!action) {
      _pendingTargetIndex = null;
      return;
    }

    // 检查是否有子选项
    if (action.subType === 'chat') {
      // 显示聊天对话界面
      showChatModal(actionId, targetIndex);
      return;
    }

    if (action.subType === 'select') {
      // 显示子选项选择界面
      showSubChoiceModal(actionId);
      return;
    }

    // 无子选项 → 直接执行
    executeAction(actionId, targetIndex);
    _pendingActionId = null;
    _pendingSubActionId = null;
    _pendingTargetIndex = null;
  }

  /**
   * 取消目标选择
   */
  function cancelTarget() {
    hideTargetModal();
    _pendingActionId = null;
    _pendingSubActionId = null;
    _pendingTargetIndex = null;
  }

  function hideTargetModal() {
    const modal = document.getElementById('target-modal');
    if (modal) modal.style.display = 'none';
  }

  // ===== 子选项选择弹窗（date/visit/sns-post 用） =====

  /**
   * 显示子选项选择弹窗
   * @param {string} actionId
   */
  function showSubChoiceModal(actionId) {
    const action = Game.Actions.getAction(actionId);
    if (!action) return;

    const subChoices = Game.Actions.getSubChoices(actionId);
    if (!subChoices || subChoices.length === 0) return;

    _pendingSubActionId = actionId;

    const modal = document.getElementById('sub-choice-modal');
    const title = document.getElementById('sub-choice-title');
    const list = document.getElementById('sub-choice-list');

    if (!modal || !title || !list) return;

    title.textContent = action.icon + ' ' + action.name + ' — 选择方式';

    list.innerHTML = subChoices.map(sc => `
      <button class="sub-choice-option" onclick="Game.Turn.confirmSubChoice('${sc.id}')">
        <span class="sub-choice-icon">${sc.icon}</span>
        <div class="sub-choice-info">
          <span class="sub-choice-label">${sc.label}</span>
          <span class="sub-choice-desc">${sc.desc}</span>
          <span class="sub-choice-effects">
            ${Object.entries(sc.effectMods).map(([key, range]) => {
              const label = statLabel(key);
              const sign0 = range[0] >= 0 ? '+' : '';
              const sign1 = range[1] >= 0 ? '+' : '';
              return `<span class="${range[0] >= 0 ? 'effect-positive' : 'effect-negative'}">${label} ${sign0}${range[0]}~${sign1}${range[1]}</span>`;
            }).join(' ')}
          </span>
        </div>
        <span class="sub-choice-arrow">→</span>
      </button>
    `).join('');

    modal.style.display = 'flex';
  }

  /**
   * 确认子选项选择并执行行动
   * @param {string} subChoiceId
   */
  function confirmSubChoice(subChoiceId) {
    hideSubChoiceModal();

    const actionId = _pendingSubActionId;
    if (!actionId) return;

    const action = Game.Actions.getAction(actionId);
    if (!action) return;

    const subChoices = Game.Actions.getSubChoices(actionId);
    if (!subChoices) return;

    const choice = subChoices.find(sc => sc.id === subChoiceId);
    if (!choice) return;

    // 合并基础效果和子选项修正
    const mergedEffects = mergeEffects(action.effects, choice.effectMods);

    // 用合并后的效果执行行动
    const targetIndex = _pendingTargetIndex;
    executeActionWithEffects(action, targetIndex, mergedEffects, choice.label);

    _pendingActionId = null;
    _pendingSubActionId = null;
    _pendingTargetIndex = null;
  }

  function hideSubChoiceModal() {
    const modal = document.getElementById('sub-choice-modal');
    if (modal) modal.style.display = 'none';
  }

  /**
   * 取消子选项选择
   */
  function cancelSubChoice() {
    hideSubChoiceModal();
    _pendingActionId = null;
    _pendingSubActionId = null;
    _pendingTargetIndex = null;
  }

  // ===== 聊天对话弹窗 =====

  /**
   * 显示聊天对话界面
   * @param {string} actionId
   * @param {number} targetIndex
   */
  function showChatModal(actionId, targetIndex) {
    const action = Game.Actions.getAction(actionId);
    const idol = Game.state.idols[targetIndex];
    if (!action || !idol) return;

    const idolName = idol.nickname || idol.name;
    const affection = idol.stats.affection || 0;
    const dialogue = Game.Actions.getChatDialogue(actionId, affection, idol.gender);

    const modal = document.getElementById('chat-modal');
    const title = document.getElementById('chat-modal-title');
    const bubbleArea = document.getElementById('chat-bubbles');
    const replyArea = document.getElementById('chat-replies');

    if (!modal || !title || !bubbleArea || !replyArea) return;

    _pendingSubActionId = actionId;
    _pendingTargetIndex = targetIndex;

    title.textContent = '💬 ' + idolName;

    // 渲染爱豆消息
    bubbleArea.innerHTML = dialogue.messages.map((msg, i) => `
      <div class="chat-bubble ${msg.from === 'idol' ? 'chat-bubble-idol' : 'chat-bubble-me'}"
           style="animation-delay: ${i * 0.3}s">
        <span class="chat-bubble-sender">${msg.from === 'idol' ? idolName : '我'}</span>
        <span class="chat-bubble-text">${msg.text}</span>
      </div>
    `).join('');

    // 渲染回复选项
    replyArea.innerHTML = dialogue.replies.map(reply => `
      <button class="chat-reply-option" onclick="Game.Turn.confirmChatReply('${reply.id}')">
        <span class="chat-reply-label">${reply.label}</span>
        <span class="chat-reply-text">"${reply.text}"</span>
      </button>
    `).join('');

    modal.style.display = 'flex';

    // 滚动到底部
    setTimeout(() => {
      bubbleArea.scrollTop = bubbleArea.scrollHeight;
    }, 100);
  }

  /**
   * 确认聊天回复
   * @param {string} replyId
   */
  function confirmChatReply(replyId) {
    const actionId = _pendingSubActionId;
    const targetIndex = _pendingTargetIndex;
    if (!actionId || targetIndex === null || targetIndex === undefined) return;

    const action = Game.Actions.getAction(actionId);
    const idol = Game.state.idols[targetIndex];
    if (!action || !idol) return;

    const affection = idol.stats.affection || 0;
    const dialogue = Game.Actions.getChatDialogue(actionId, affection, idol.gender);
    const reply = dialogue.replies.find(r => r.id === replyId);
    if (!reply) return;

    // 把玩家回复添加到气泡区
    const bubbleArea = document.getElementById('chat-bubbles');
    const replyArea = document.getElementById('chat-replies');
    if (bubbleArea) {
      const bubble = document.createElement('div');
      bubble.className = 'chat-bubble chat-bubble-me';
      bubble.innerHTML = `
        <span class="chat-bubble-sender">我</span>
        <span class="chat-bubble-text">${reply.text}</span>
      `;
      bubbleArea.appendChild(bubble);
      bubbleArea.scrollTop = bubbleArea.scrollHeight;
    }
    if (replyArea) replyArea.innerHTML = '';

    // 短暂延迟后关闭弹窗并执行效果
    setTimeout(() => {
      hideChatModal();
      // 合并基础效果和回复修正
      const mergedEffects = mergeEffects(action.effects, reply.effectMods);
      executeActionWithEffects(action, targetIndex, mergedEffects, reply.label);

      _pendingActionId = null;
      _pendingSubActionId = null;
      _pendingTargetIndex = null;
    }, 800);
  }

  function hideChatModal() {
    const modal = document.getElementById('chat-modal');
    if (modal) modal.style.display = 'none';
  }

  /**
   * 取消聊天（×按钮）
   */
  function cancelChat() {
    hideChatModal();
    _pendingActionId = null;
    _pendingSubActionId = null;
    _pendingTargetIndex = null;
  }

  // ===== 效果合并工具 =====

  /**
   * 合并基础效果和子选项修正效果
   * @param {Object} baseEffects - { key: [min, max] }
   * @param {Object} modEffects - { key: [min, max] }
   * @returns {Object} 合并后的效果
   */
  function mergeEffects(baseEffects, modEffects) {
    const merged = {};
    // 复制基础效果
    for (const [key, range] of Object.entries(baseEffects)) {
      merged[key] = [...range];
    }
    // 叠加修正效果
    for (const [key, range] of Object.entries(modEffects)) {
      if (merged[key]) {
        merged[key][0] += range[0];
        merged[key][1] += range[1];
      } else {
        merged[key] = [...range];
      }
    }
    return merged;
  }

  /**
   * 使用指定的效果数据执行行动（跳过随机取值，直接用合并后的范围）
   * @param {Object} action - 行动定义
   * @param {number|null} targetIndex
   * @param {Object} mergedEffects - 合并后的 effects
   * @param {string} subLabel - 子选项标签（日志用）
   */
  function executeActionWithEffects(action, targetIndex, mergedEffects, subLabel) {
    if (!action) return false;

    const staminaCost = getModifiedStaminaCost(action);
    const currentStamina = Game.state.player.stats.stamina;
    if (currentStamina < staminaCost) return false;

    if (_turnLog.length >= MAX_ACTIONS_PER_TURN) return false;

    if (action.needsTarget && (targetIndex === null || targetIndex === undefined)) return false;
    if (action.needsTarget) {
      const idol = Game.state.idols[targetIndex];
      if (!idol) return false;
    }

    // 扣除体力
    Game.State.addStamina(-staminaCost);

    // 应用效果（使用合并后的效果）
    const effectLog = applyMergedEffects(mergedEffects, targetIndex);

    // 记录日志
    const targetName = action.needsTarget
      ? (Game.state.idols[targetIndex].nickname || Game.state.idols[targetIndex].name)
      : null;

    _turnLog.push({
      actionId: action.id,
      actionName: action.name + (subLabel ? ' · ' + subLabel : ''),
      icon: action.icon,
      targetName: targetName,
      effects: effectLog
    });

    Game.State.autoSave();
    refreshUI();
    if (Game.Relations) Game.Relations.refresh();
    if (Game.Profile) Game.Profile.refresh();

    // 随机事件：秘密手机解锁检测
    _checkSecretPhoneEvent(action, targetIndex);

    // 邂逅检测：圈内活动行动
    if (action.id === 'attend-event' && Game.Encounter) {
      if (Math.random() * 100 < 60) {
        console.log('[Turn] 圈内活动触发邂逅！');
        setTimeout(function() { Game.Encounter.triggerEncounter('action'); }, 500);
      }
    }

    console.log('[Turn] 行动完成：' + action.name + (subLabel ? ' · ' + subLabel : '') + (targetName ? ' → ' + targetName : ''));
    return true;
  }

  /**
   * 应用合并后的效果（与 applyEffects 类似，但效果范围已确定）
   */
  function applyMergedEffects(mergedEffects, targetIndex) {
    const mods = Game.state.player.identityModifiers || {};
    const log = [];

    Object.keys(mergedEffects).forEach(key => {
      const range = mergedEffects[key];
      const rawDelta = randomInRange(range[0], range[1]);
      if (rawDelta === 0) return;

      let delta = applyIdentityModifier(rawDelta, key, mods);

      // 粉丝数对嫌疑度加成（粉丝越多越容易被盯上）
      if (key === 'suspicion' && delta > 0) {
        const followers = Game.state.player.social ? Game.state.player.social.followers : 0;
        const followerMult = getFollowerSuspicionMultiplier(followers);
        delta = Math.round(delta * followerMult);
        // 检查经纪人帮助隐瞒buff（嫌疑度增幅减半）
        if (targetIndex !== null && targetIndex !== undefined && Game.State.hasActiveBuff('suspicionRateHalved', targetIndex)) {
          delta = Math.round(delta / 2);
          console.log('[Turn] 经纪人buff生效：嫌疑度增幅减半（idolIndex=' + targetIndex + '）');
        }
      }

      if (delta === 0) return;

      switch (key) {
        case 'affection':
          if (targetIndex !== null && targetIndex !== undefined) {
            // 好感度越高，获得好感越难（边际递减）
            if (delta > 0) {
              var currentAff2 = Game.state.idols[targetIndex].stats.affection || 0;
              if (currentAff2 >= 90) {
                delta = Math.round(delta * 0.3);
              } else if (currentAff2 >= 75) {
                delta = Math.round(delta * 0.5);
              } else if (currentAff2 >= 50) {
                delta = Math.round(delta * 0.7);
              }
            }
            if (delta === 0) return;
            Game.State.addAffection(targetIndex, delta);
            const idolName = Game.state.idols[targetIndex].nickname || Game.state.idols[targetIndex].name;
            log.push({ label: idolName + ' 好感度', delta: delta });
            // 出轨检测：如果玩家在排他关系中与非伴侣爱豆互动
            if (delta > 0 && Game.Relationship) {
              Game.Relationship.checkCheatingOnAction(targetIndex, delta);
            }
            // 被拍风险：高嫌疑度下约会行动有8%额外触发
            if (delta > 0 && Game.Reality && Game.state.player.stats.suspicion >= 70) {
              var idol = Game.state.idols[targetIndex];
              var stage = idol ? (idol.relationshipStage || 'pursuit') : 'pursuit';
              if ((stage === 'dating' || stage === 'married') && !Game.Reality.hasMediaFlag(targetIndex, 'caughtOnCamera')) {
                if (Math.random() * 100 < 8) {
                  setTimeout(function() { Game.Reality.checkCaughtOnCamera(targetIndex); }, 800);
                }
              }
            }
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
        case 'followers':
          // 涨粉/掉粉
          Game.State.addFollowers(delta);
          log.push({ label: '粉丝数', delta: delta });
          break;
        case 'posts':
          // 发帖计数（不显示在效果日志中）
          Game.State.incrementPosts();
          break;
      }
    });

    return log;
  }

  /**
   * 根据粉丝数获取嫌疑度倍率
   * 粉丝越多，一举一动越容易被放大解读
   * @param {number} followers
   * @returns {number}
   */
  function getFollowerSuspicionMultiplier(followers) {
    if (followers >= 100000) return 2.0;
    if (followers >= 10000) return 1.5;
    if (followers >= 1000) return 1.2;
    return 1.0;
  }

  /**
   * 数值键 → 中文标签
   */
  function statLabel(key) {
    const map = {
      affection: '好感',
      stress: '压力',
      suspicion: '嫌疑',
      stamina: '体力',
      charm: '魅力',
      followers: '粉丝'
    };
    return map[key] || key;
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

    // 需要目标 → 先弹出目标选择器
    if (action.needsTarget) {
      _pendingSubActionId = actionId; // 记住行动ID，等选完目标再继续
      showTargetModal(actionId);
      return;
    }

    // 不需要目标 → 检查是否有子选项
    if (action.subType === 'select') {
      _pendingSubActionId = actionId;
      _pendingTargetIndex = null;
      showSubChoiceModal(actionId);
      return;
    }

    if (action.subType === 'chat') {
      // 聊天也需要目标，这里不应该走到（needsTarget=true 已处理）
      executeAction(actionId, null);
      return;
    }

    // 无子选项 → 直接执行
    executeAction(actionId, null);
  }

  /**
   * 检测秘密手机解锁随机事件
   * 触发条件：探班/送咖啡车/送礼物行动，好感度≥20，秘密手机未解锁
   * 基础15%概率，每10点好感度+1%
   */
  function _checkSecretPhoneEvent(action, targetIndex) {
    // 只对特定行动类型检测
    const triggerActions = ['visit', 'coffee-truck', 'gift'];
    if (!triggerActions.includes(action.id)) return;

    // 需要目标爱豆
    if (targetIndex === null || targetIndex === undefined) return;

    // 检查秘密手机是否已解锁
    const sp = Game.State.getSecretPhone();
    if (sp && sp.unlocked) return;

    // 检查好感度门槛
    const idol = Game.state.idols[targetIndex];
    if (!idol || idol.stats.affection < 20) return;

    // 计算触发概率：15% + 每10好感度+1%，最高40%
    const baseChance = 15;
    const bonusChance = Math.floor(idol.stats.affection / 10);
    const totalChance = Math.min(baseChance + bonusChance, 40);

    const roll = Math.floor(Math.random() * 100);
    if (roll >= totalChance) return;

    // 触发！解锁秘密手机
    Game.State.unlockSecretPhone(targetIndex);
    const idolName = idol.nickname || idol.name;
    console.log('[Turn] 🎉 秘密手机事件触发！' + idolName + '的经纪人悄悄递来一部手机...');

    // 显示提示
    _showSecretPhoneNotification(idolName);
  }

  /**
   * 显示秘密手机解锁通知
   */
  function _showSecretPhoneNotification(idolName) {
    // 在日程页显示浮动通知
    const logContainer = document.getElementById('schedule-action-log');
    if (!logContainer) return;

    const notice = document.createElement('div');
    notice.style.cssText = `
      background: linear-gradient(135deg, #1A1A2E, #16213E);
      color: #E0E0E0;
      padding: 16px;
      border-radius: 12px;
      margin-bottom: 12px;
      font-size: 13px;
      line-height: 1.5;
      animation: chatBubbleIn 0.5s ease-out;
      border: 1px solid rgba(187,134,252,0.4);
    `;
    notice.innerHTML = `
      <div style="font-size:20px;margin-bottom:6px;">📱🔒</div>
      <div style="font-weight:700;margin-bottom:4px;">${escapeHtml(idolName)}的经纪人悄悄找到你...</div>
      <div style="color:#BB86FC;font-size:12px;">"这是加密手机，用这个联系更安全。别让其他人知道。"</div>
      <div style="margin-top:8px;font-size:11px;color:#8E8E93;">📱 手机页面已解锁「秘密手机」— 加密通讯，嫌疑度风险大幅降低</div>
    `;

    // 插入到日志区域最前面
    if (logContainer.firstChild) {
      logContainer.insertBefore(notice, logContainer.firstChild);
    } else {
      logContainer.appendChild(notice);
    }

    // 8秒后自动消失
    setTimeout(() => {
      notice.style.transition = 'opacity 0.5s';
      notice.style.opacity = '0';
      setTimeout(() => notice.remove(), 500);
    }, 8000);
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
      <p class="turn-end-hint">结束回合后体力回满，压力-3</p>
    `;
  }

  // ===== 爱豆主动消息 =====

  /**
   * 回合结束时随机触发爱豆主动发消息
   * 每个爱豆独立判断概率，好感度越高越可能主动联系
   * fire-and-forget：不阻塞回合结束流程
   */
  function _triggerProactiveMessages() {
    if (!Game.PhoneChat || !Game.PhoneChat.tryProactiveMessage) return;

    const idols = Game.state.idols || [];
    if (idols.length === 0) return;

    // 打乱顺序，避免总是第一个爱豆发消息
    const indices = idols.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    // 最多2个爱豆在同一回合发消息（避免轰炸）
    let sentCount = 0;
    const maxPerTurn = 2;

    for (const idx of indices) {
      if (sentCount >= maxPerTurn) break;

      // 同时检查主手机和秘密手机
      const sp = Game.State.getSecretPhone();
      const isSecretContact = sp && sp.unlocked && sp.idolIndex === idx;
      const phoneType = isSecretContact ? 'secret' : 'main';

      // fire-and-forget
      Game.PhoneChat.tryProactiveMessage(idx, phoneType).then(sent => {
        if (sent) {
          console.log('[Turn] ' + (idols[idx].nickname || idols[idx].name) + ' 主动发来消息（' + phoneType + '）');
        }
      }).catch(() => {});

      sentCount++;
    }
  }


  // ===== 好友主动消息 =====

  /**
   * 回合结束时随机触发好友主动发消息
   */
  function _triggerFriendProactiveMessages() {
    if (!Game.PhoneChat || !Game.PhoneChat.tryFriendProactiveMessage) return;

    const friends = Game.state.friends || [];
    if (friends.length === 0) return;

    // 打乱顺序
    const shuffled = [...friends].sort(() => Math.random() - 0.5);
    let sentCount = 0;
    const maxPerTurn = 2;

    for (const friend of shuffled) {
      if (sentCount >= maxPerTurn) break;
      Game.PhoneChat.tryFriendProactiveMessage(friend.id).then(sent => {
        if (sent) console.log('[Turn] 好友' + friend.name + ' 主动发来消息');
      }).catch(() => {});
      sentCount++;
    }
  }

  // ===== 经纪人介入检查 =====

  /**
   * 检查是否需要触发经纪人介入（嫌疑度>=30，每个爱豆只触发一次）
   */
  function _checkManagerInterventions() {
    const idols = Game.state.idols || [];
    const suspicion = Game.state.player.stats.suspicion;
    const THRESHOLD = 30;

    for (let i = 0; i < idols.length; i++) {
      // 已经介入过则跳过
      if (Game.State.hasManagerIntervened(i)) continue;
      // 嫌疑度不足则跳过
      if (suspicion < THRESHOLD) continue;
      // 触发经纪人介入
      _triggerManagerIntervention(i);
    }
  }

  /**
   * 触发经纪人介入事件
   */
  async function _triggerManagerIntervention(idolIndex) {
    const idol = Game.state.idols[idolIndex];
    if (!idol) return;

    // 随机选择一个行动
    const action = MANAGER_ACTIONS[Math.floor(Math.random() * MANAGER_ACTIONS.length)];

    // 生成经纪人名字
    const managerName = Game.PhoneChat.generateManagerName();

    // 构建消息文本
    const honorific = Game.Actions.getHonorific(idol.gender);
    const idolPronoun = idol.gender === 'male' ? '他' : '她';
    const message = action.messageTemplate
      .replace('{honorific}', honorific)
      .replace('{idolName}', idol.nickname || idol.name)
      .replace(/{idolPronoun}/g, idolPronoun);

    // 记录到游戏状态
    Game.State.recordManagerIntervention(idolIndex, {
      action: action.id,
      managerName: managerName,
      managerPersonality: action.personality,
      lastMessage: message
    });

    // 添加事件日志
    Game.State.addEventLog({
      type: 'manager-intervention',
      idolIndex: idolIndex,
      idolName: idol.nickname || idol.name,
      managerName: managerName,
      action: action.id,
      label: action.label,
      message: '经纪人介入：' + managerName + '因为嫌疑度过高介入——' + action.label
    });

    // 保存经纪人消息到聊天历史
    try {
      const history = await Game.PhoneChat.loadManagerHistory(idolIndex);
      history.push({ from: 'manager', text: message, time: Date.now() });
      await Game.PhoneChat.saveManagerHistory(idolIndex, history);
    } catch (e) { /* IndexedDB 不可用 */ }

    // 增加经纪人未读计数
    Game.PhoneChat.incrementManagerUnread(idolIndex);

    // 应用效果
    if (action.effects.suspicion) {
      Game.State.addSuspicion(action.effects.suspicion);
    }
    if (action.effects.stress) {
      Game.State.addStress(action.effects.stress);
    }
    if (action.effects.affection) {
      Game.State.addAffection(idolIndex, action.effects.affection);
    }
    if (action.effects.suspicionRateHalved) {
      Game.State.addBuff({
        type: 'suspicionRateHalved',
        idolIndex: idolIndex,
        untilTurn: Game.state.currentTurn + (action.effects.turns || 3)
      });
    }
    if (action.effects.triggerCrisis) {
      // 触发危机事件
      Game.State.addEventLog({
        type: 'manager-crisis',
        idolIndex: idolIndex,
        message: '经纪人威胁曝光，关系面临严重危机'
      });
    }

    console.log('[Turn] 经纪人介入！' + managerName + ' → ' + (idol.nickname || idol.name) + '（' + action.label + '）');
  }

  // ===== 经纪人跟进消息 =====

  /**
   * 回合结束时检查已介入经纪人是否发跟进消息
   */
  function _triggerManagerFollowups() {
    if (!Game.PhoneChat || !Game.PhoneChat.tryManagerFollowup) return;

    const idols = Game.state.idols || [];
    for (let i = 0; i < idols.length; i++) {
      if (Game.State.hasManagerIntervened(i)) {
        Game.PhoneChat.tryManagerFollowup(i).catch(() => {});
      }
    }
  }

  // ===== 经纪人行动定义（供介入系统使用） =====

  const MANAGER_ACTIONS = [
    {
      id: 'warn',
      label: '警告',
      messageTemplate: '{honorific}是{idolName}的经纪人。你们最近走得太近了，小心点。公司那边已经有人在注意了。',
      effects: { suspicion: -5, stress: 5 },
      personality: '严厉谨慎'
    },
    {
      id: 'help',
      label: '帮助隐瞒',
      messageTemplate: '{honorific}是{idolName}的经纪人。说实话我理解你们的关系，但这样下去会出事的。我会帮你们打掩护，你们自己也要注意分寸。',
      effects: { suspicionRateHalved: true, turns: 3 },
      personality: '通情达理'
    },
    {
      id: 'pressure',
      label: '催分手',
      messageTemplate: '{honorific}是{idolName}的经纪人。你们的事我已经知道了。为了{idolPronoun}的前途，你必须和{idolPronoun}断了。这对谁都没有好处。',
      effects: { stress: 15, affection: -3 },
      personality: '冷漠强硬'
    },
    {
      id: 'threaten',
      label: '威胁曝光',
      messageTemplate: '{honorific}是{idolName}的经纪人。我已经忍了很久了。再继续下去我就直接告诉公司高层，后果你们自己承担。',
      effects: { stress: 20, triggerCrisis: true },
      personality: '愤怒威胁'
    },
    {
      id: 'friendly',
      label: '友善提醒',
      messageTemplate: '{honorific}是{idolName}的经纪人。别紧张，我不是来找麻烦的。只是以过来人的身份提醒你们注意安全，别被拍到。小心驶得万年船。',
      effects: { suspicion: -3 },
      personality: '温和友善'
    }
  ];

  // ===== 未回复消息惩罚（功能1） =====

  /**
   * 检查是否有未回复的爱豆消息，如有则降低好感度
   * 在回合结束时调用（回合数+1之前）
   */
  function _checkUnrepliedPenalties() {
    var pending = Game.state.pendingReplies || {};
    if (Object.keys(pending).length === 0) return;

    var currentTurn = Game.state.currentTurn;
    var idols = Game.state.idols || [];

    Object.keys(pending).forEach(function(key) {
      var entry = pending[key];
      // 检查是否是上一回合（或更早）的未回复
      if (entry.turnReceived < currentTurn) {
        var idx = parseInt(key, 10);
        var idol = idols[idx];
        if (!idol) return;

        // 好感度减少2-5点
        var penalty = 2 + Math.floor(Math.random() * 4); // 2~5
        Game.State.addAffection(idx, -penalty);

        // 添加到事件日志
        var idolName = idol.nickname || idol.name;
        Game.State.addEventLog({
          type: 'unreplied-penalty',
          idolIndex: idx,
          idolName: idolName,
          penalty: penalty,
          label: '未回复' + idolName + '的消息，好感度-' + penalty,
          timestamp: Date.now()
        });

        console.log('[Turn] ' + idolName + ' 的消息被忽略' + entry.turnReceived + '回合，好感度-' + penalty);

        // 清除pending标记（只惩罚一次）
        Game.State.clearPendingReply(idx);
      }
    });
  }

  // ===== 随机邂逅检测（功能4） =====

  /**
   * 回合结束时随机触发邂逅事件
   */
  function _checkRandomEncounters() {
    if (!Game.Encounter || !Game.Encounter.triggerEncounter) return;

    var idolCount = (Game.state.idols || []).length;
    // 基础概率15%，每多一个爱豆-3%，最少5%
    var chance = Math.max(5, 15 - (idolCount - 1) * 3);

    if (Math.random() * 100 < chance) {
      console.log('[Turn] 随机邂逅事件触发！当前爱豆数：' + idolCount + '，概率：' + chance + '%');
      Game.Encounter.triggerEncounter('random');
    }
  }

  // ===== 媒体事件检测（阶段8） =====

  /**
   * 每回合检测私生/媒体事件
   * 按优先级检查，每回合最多触发1个
   */
  function _checkMediaEvents() {
    var idols = Game.state.idols || [];
    var suspicion = Game.state.player.stats.suspicion || 0;

    for (var i = 0; i < idols.length; i++) {
      var idol = idols[i];
      var stage = idol.relationshipStage || 'pursuit';
      // 只对恋爱/已婚阶段的爱豆触发媒体事件
      if (stage !== 'dating' && stage !== 'married') continue;

      // D社预警: suspicion >= 50, 10-15%
      if (suspicion >= 50 && !Game.Reality.hasMediaFlag(i, 'dispatchWarned')) {
        if (Math.random() * 100 < (10 + Math.floor(Math.random() * 6))) {
          Game.Reality.checkDispatchWarning(i);
          return;
        }
      }

      // 被拍事件: suspicion >= 70, 8-12%
      if (suspicion >= 70 && !Game.Reality.hasMediaFlag(i, 'caughtOnCamera')) {
        if (Math.random() * 100 < (8 + Math.floor(Math.random() * 5))) {
          Game.Reality.checkCaughtOnCamera(i);
          return;
        }
      }

      // 粉丝扒料: suspicion >= 40, 15%
      if (suspicion >= 40 && !Game.Reality.hasMediaFlag(i, 'fanInvestigated')) {
        if (Math.random() * 100 < 15) {
          Game.Reality.checkFanInvestigation(i);
          return;
        }
      }
    }
  }

  // ===== 日常细节检测（阶段8） =====

  /**
   * 每回合检测日常细节事件（纪念日/情侣物品/生病/定位共享）
   */
  function _checkDailyDetails() {
    var idols = Game.state.idols || [];
    var currentTurn = Game.state.currentTurn || 0;

    for (var i = 0; i < idols.length; i++) {
      var stage = idols[i].relationshipStage || 'pursuit';
      // 攻略期只触发生病探望
      if (stage === 'pursuit') continue;

      // 纪念日检查
      Game.Reality.checkAnniversary(i);

      // 定位共享提议（恋爱首回合50%概率，仅触发一次）
      if (stage === 'dating' && !Game.State.hasLocationSharing(i)) {
        var lsTurn = Game.State.getAnniversaryTurn(i, 'locationSharing') || 0;
        if (lsTurn === 0 && Math.random() * 100 < 50 && currentTurn - (Game.State.getAnniversaryTurn(i, 'datingStart') || currentTurn) <= 2) {
          Game.Reality.checkLocationSharing(i);
          Game.State.setAnniversaryTurn(i, 'locationSharing', currentTurn); // 标记已提示
          return;
        }
      }

      // 情侣物品: 10%
      if (Math.random() * 100 < 10) {
        Game.Reality.checkCoupleItem(i);
        return;
      }
    }

    // 生病探望: 8%（任意阶段任意爱豆）
    if (idols.length > 0 && Math.random() * 100 < 8) {
      Game.Reality.checkSickVisit();
    }
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
    showSubChoiceModal,
    confirmSubChoice,
    cancelSubChoice,
    showChatModal,
    confirmChatReply,
    cancelChat,
    getTurnLog: () => _turnLog
  };

})();
