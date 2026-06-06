/**
 * 游戏状态管理模块 — 统一的数值修改入口
 * 负责：五大数值的增减（0-100截断）、自动存档、存档管理、版本迁移
 */

Game.State = (() => {

  // 当前使用的存档槽（自动存档时写入此槽）
  let _currentSlot = 1;

  // ===== 存档槽管理 =====

  /**
   * 设置当前存档槽
   */
  function setCurrentSlot(slot) {
    _currentSlot = slot;
    Game.state._saveSlot = slot;
  }

  /**
   * 获取当前存档槽
   */
  function getCurrentSlot() {
    return _currentSlot;
  }

  /**
   * 查找第一个空存档槽（用于新游戏）
   * @returns {number} 空槽编号（1-3），如果全满则返回1
   */
  function findEmptySlot() {
    const saves = Game.Storage.getAllSaves();
    for (let i = 0; i < saves.length; i++) {
      if (!saves[i].data) return saves[i].slot;
    }
    // 所有槽都满，返回槽1（开始新游戏时会覆盖）
    console.warn('[State] 所有存档槽已满，将覆盖槽1');
    return 1;
  }

  /**
   * 检查是否所有槽都已满
   */
  function allSlotsFull() {
    return Game.Storage.getAllSaves().every(s => s.data);
  }

  // ===== 数值修改（均自动截断到0-100，修改后自动存档） =====

  /**
   * 修改指定爱豆的好感度
   * @param {number} idolIndex - 爱豆索引
   * @param {number} delta - 变化量（正=增加，负=减少）
   */
  function addAffection(idolIndex, delta) {
    const idol = Game.state.idols[idolIndex];
    if (!idol) return;
    idol.stats.affection = clamp(idol.stats.affection + delta);
    autoSave();
  }

  /**
   * 修改玩家压力值
   */
  function addStress(delta) {
    Game.state.player.stats.stress = clamp(Game.state.player.stats.stress + delta);
    autoSave();
  }

  /**
   * 修改玩家嫌疑度
   */
  function addSuspicion(delta) {
    Game.state.player.stats.suspicion = clamp(Game.state.player.stats.suspicion + delta);
    autoSave();
  }

  /**
   * 修改玩家体力
   */
  function addStamina(delta) {
    Game.state.player.stats.stamina = clamp(Game.state.player.stats.stamina + delta);
    autoSave();
  }

  /**
   * 修改玩家魅力
   */
  function addCharm(delta) {
    Game.state.player.stats.charm = clamp(Game.state.player.stats.charm + delta);
    autoSave();
  }

  /**
   * 更新爱豆的关系阶段
   * @param {number} idolIndex
   * @param {'pursuit'|'dating'|'married'} stage
   */
  function setRelationshipStage(idolIndex, stage) {
    const idol = Game.state.idols[idolIndex];
    if (!idol) return;
    idol.relationshipStage = stage;
    autoSave();
  }

  /**
   * 修改社交账号粉丝数
   * @param {number} delta - 变化量（正=涨粉，负=掉粉）
   */
  function addFollowers(delta) {
    if (!Game.state.player.social) {
      Game.state.player.social = { followers: 100, posts: 0 };
    }
    Game.state.player.social.followers = Math.max(0, Game.state.player.social.followers + Math.round(delta));
    if (!Game.state.player.social.posts) Game.state.player.social.posts = 0;
    autoSave();
  }

  /**
   * 增加发帖计数
   */
  function incrementPosts() {
    if (!Game.state.player.social) {
      Game.state.player.social = { followers: 100, posts: 0 };
    }
    Game.state.player.social.posts = (Game.state.player.social.posts || 0) + 1;
    autoSave();
  }

  /**
   * 获取社交账号数据
   * @returns {{ followers: number, posts: number }}
   */
  function getSocialData() {
    const s = Game.state.player.social;
    return s ? { followers: s.followers || 0, posts: s.posts || 0 } : { followers: 0, posts: 0 };
  }

  // ===== 秘密手机管理 =====

  /**
   * 解锁秘密手机（随机事件触发）
   * @param {number} idolIndex - 哪个爱豆的经纪人给的手机
   */
  function unlockSecretPhone(idolIndex) {
    if (!Game.state.player.secretPhone) {
      Game.state.player.secretPhone = { unlocked: false, idolIndex: null };
    }
    Game.state.player.secretPhone.unlocked = true;
    Game.state.player.secretPhone.idolIndex = idolIndex;
    autoSave();
    console.log('[State] 秘密手机已解锁！爱豆索引：' + idolIndex);
  }

  /**
   * 获取秘密手机状态
   * @returns {{ unlocked: boolean, idolIndex: number|null }}
   */
  function getSecretPhone() {
    const sp = Game.state.player.secretPhone;
    return sp || { unlocked: false, idolIndex: null };
  }

  /**
   * 根据身份标签计算起始粉丝数
   * @param {string[]} identityTags - 身份标签数组
   * @returns {number}
   */
  function getStartingFollowers(identityTags) {
    if (!identityTags || identityTags.length === 0) return 500;
    const tag = identityTags[0];
    const map = {
      '素人粉丝': 100,
      '练习生': 2000,
      '站姐': 5000,
      '造型师': 800,
      '化妆师': 800,
      '记者': 3000,
      '综艺PD': 3000,
      '翻译': 500,
      '青梅竹马': 300,
      '学生': 200,
      '运动教练': 1000,
      '名门社交好友': 2000
    };
    return map[tag] || 500;
  }

  // ===== 好友管理 =====

  /**
   * 根据ID获取好友对象
   * @param {string} friendId
   * @returns {Object|null}
   */
  function getFriendById(friendId) {
    const friends = Game.state.friends || [];
    return friends.find(f => f.id === friendId) || null;
  }

  // ===== 经纪人介入管理 =====

  /**
   * 检查指定爱豆的经纪人是否已介入
   * @param {number} idolIndex
   * @returns {boolean}
   */
  function hasManagerIntervened(idolIndex) {
    const interventions = Game.state.managerInterventions || {};
    return !!(interventions[String(idolIndex)] && interventions[String(idolIndex)].triggered);
  }

  /**
   * 记录经纪人介入
   * @param {number} idolIndex
   * @param {Object} data - { action, managerName, managerPersonality }
   */
  function recordManagerIntervention(idolIndex, data) {
    if (!Game.state.managerInterventions) Game.state.managerInterventions = {};
    Game.state.managerInterventions[String(idolIndex)] = {
      triggered: true,
      turn: Game.state.currentTurn,
      ...data
    };
    autoSave();
  }

  /**
   * 获取某爱豆的经纪人介入信息
   * @param {number} idolIndex
   * @returns {Object|null}
   */
  function getManagerIntervention(idolIndex) {
    const interventions = Game.state.managerInterventions || {};
    return interventions[String(idolIndex)] || null;
  }

  // ===== Buff增益管理 =====

  /**
   * 添加活跃Buff
   * @param {Object} buff - { type: string, idolIndex: number, untilTurn: number }
   */
  function addBuff(buff) {
    if (!Game.state.activeBuffs) Game.state.activeBuffs = [];
    Game.state.activeBuffs.push(buff);
    autoSave();
  }

  /**
   * 检查指定类型的Buff是否活跃（自动清理过期buff）
   * @param {string} type
   * @param {number} idolIndex
   * @returns {boolean}
   */
  function hasActiveBuff(type, idolIndex) {
    if (!Game.state.activeBuffs) return false;
    var currentTurn = Game.state.currentTurn || 0;
    // 清理过期buff
    var valid = Game.state.activeBuffs.filter(function(b) {
      return b.untilTurn >= currentTurn;
    });
    if (valid.length !== Game.state.activeBuffs.length) {
      Game.state.activeBuffs = valid;
      autoSave();
    }
    return valid.some(function(b) {
      return b.type === type && b.idolIndex === idolIndex;
    });
  }

  // ===== 事件日志 =====

  /**
   * 添加事件日志条目
   * @param {Object} entry - 事件数据（会自动补上 turn 和 timestamp）
   */
  function addEventLog(entry) {
    if (!Game.state.eventLog) Game.state.eventLog = [];
    Game.state.eventLog.push({
      turn: Game.state.currentTurn,
      timestamp: Date.now(),
      ...entry
    });
    autoSave();
  }

  // ===== 关系阶段系统（阶段7） =====

  /**
   * 设置专属恋爱对象
   * @param {number} idolIndex
   */
  function setDatingIdol(idolIndex) {
    Game.state.datingIdolId = idolIndex;
    autoSave();
  }

  /**
   * 清除恋爱对象（分手）
   */
  function clearDatingIdol() {
    Game.state.datingIdolId = null;
    autoSave();
  }

  /**
   * 设置结婚对象及类型
   * @param {number} idolIndex
   * @param {'public'|'secret'} marriageType
   */
  function setMarriedIdol(idolIndex, marriageType) {
    Game.state.marriedIdolId = idolIndex;
    Game.state.marriageType = marriageType;
    autoSave();
  }

  /**
   * 清除结婚对象（离婚）
   */
  function clearMarriedIdol() {
    Game.state.marriedIdolId = null;
    Game.state.marriageType = null;
    autoSave();
  }

  /**
   * 获取当前独占伴侣（已婚优先于恋爱）
   * @returns {{ idolIndex: number|null, type: 'dating'|'married'|null }}
   */
  function getExclusivePartner() {
    if (Game.state.marriedIdolId !== null && Game.state.marriedIdolId !== undefined) {
      return { idolIndex: Game.state.marriedIdolId, type: 'married' };
    }
    if (Game.state.datingIdolId !== null && Game.state.datingIdolId !== undefined) {
      return { idolIndex: Game.state.datingIdolId, type: 'dating' };
    }
    return { idolIndex: null, type: null };
  }

  /**
   * 判断与某爱豆互动是否算出轨
   * @param {number} targetIdolIndex
   * @returns {boolean}
   */
  function isCheating(targetIdolIndex) {
    var partner = getExclusivePartner();
    if (partner.idolIndex === null) return false;
    return targetIdolIndex !== partner.idolIndex;
  }

  /**
   * 增加出轨嫌疑度（0-100截断）
   * @param {number} idolIndex
   * @param {number} amount
   */
  function addCheatingSuspicion(idolIndex, amount) {
    if (!Game.state.cheatingSuspicion) Game.state.cheatingSuspicion = {};
    var key = String(idolIndex);
    Game.state.cheatingSuspicion[key] = clamp((Game.state.cheatingSuspicion[key] || 0) + amount);
    autoSave();
  }

  /**
   * 查询出轨嫌疑度
   * @param {number} idolIndex
   * @returns {number}
   */
  function getCheatingSuspicion(idolIndex) {
    if (!Game.state.cheatingSuspicion) return 0;
    return Game.state.cheatingSuspicion[String(idolIndex)] || 0;
  }

  /**
   * 标记阶段事件已确认（防止重复触发）
   * @param {number} idolIndex
   * @param {'dating'|'proposal'} eventType
   */
  function confirmStageEvent(idolIndex, eventType) {
    if (!Game.state.confirmedStages) Game.state.confirmedStages = {};
    var key = String(idolIndex);
    if (!Game.state.confirmedStages[key]) Game.state.confirmedStages[key] = {};
    Game.state.confirmedStages[key][eventType === 'dating' ? 'datingConfirmed' : 'proposed'] = true;
    autoSave();
  }

  /**
   * 检查阶段事件是否已确认
   * @param {number} idolIndex
   * @param {'dating'|'proposal'} eventType
   * @returns {boolean}
   */
  function isStageEventConfirmed(idolIndex, eventType) {
    if (!Game.state.confirmedStages) return false;
    var entry = Game.state.confirmedStages[String(idolIndex)];
    if (!entry) return false;
    return eventType === 'dating' ? !!entry.datingConfirmed : !!entry.proposed;
  }

  // ===== 工具 =====

  function clamp(val) {
    return Math.max(0, Math.min(100, Math.round(val)));
  }

  function autoSave() {
    Game.state.currentTurn = Game.state.currentTurn || 0;
    Game.state._saveSlot = _currentSlot;
    Game.Storage.saveGame(_currentSlot, Game.state);
  }

  // ===== 存档版本迁移 =====

  /**
   * 将旧版本存档迁移到当前版本
   * 确保所有字段都存在，新字段使用默认值补齐
   * @param {Object} data - 从localStorage加载的原始存档数据
   * @returns {Object} 迁移后的数据
   */
  function migrate(data) {
    const loadedVersion = data.version || '0.0.0';
    const currentVersion = Game.version;

    // 版本相同，无需迁移
    if (loadedVersion === currentVersion) return data;

    console.log('[State] 存档版本迁移：' + loadedVersion + ' → ' + currentVersion);

    // 补齐顶层字段
    data.currentTurn = data.currentTurn || 0;
    data.initialized = true;
    data._saveSlot = data._saveSlot || _currentSlot;

    // 补齐玩家数据
    if (!data.player) {
      data.player = { name: '未知玩家', stats: {} };
    }
    data.player.identityTags = data.player.identityTags || [];
    data.player.identityCustom = data.player.identityCustom || '';
    data.player.personalityTags = data.player.personalityTags || [];
    data.player.personalityCustom = data.player.personalityCustom || '';
    data.player.identity = data.player.identity || data.player.identityTags.join('、');
    data.player.personality = data.player.personality || data.player.personalityTags.join('、');
    data.player.stats = data.player.stats || {};
    data.player.stats.stress = ensureNumber(data.player.stats.stress, 10);
    data.player.stats.suspicion = ensureNumber(data.player.stats.suspicion, 0);
    data.player.stats.stamina = ensureNumber(data.player.stats.stamina, 100);
    data.player.stats.charm = ensureNumber(data.player.stats.charm, 50);

    // 补齐身份修正值（阶段6 DeepSeek API生成，先给默认0）
    if (!data.player.identityModifiers) {
      data.player.identityModifiers = {
        affectionBonus: 0,
        suspicionMod: 0,
        staminaMod: 0,
        charmBonus: 0,
        stressResist: 0
      };
    }

    // 补齐爱豆数据
    if (!data.idols) data.idols = [];
    data.idols.forEach((idol, i) => {
      idol.id = idol.id || 'idol-' + i;
      idol.gender = idol.gender || 'male';
      idol.nickname = idol.nickname || '';
      idol.group = idol.group || '';
      idol.personalityTags = idol.personalityTags || [];
      idol.personalityCustom = idol.personalityCustom || '';
      idol.avatarId = idol.avatarId || null;
      idol.relationshipStage = idol.relationshipStage || 'pursuit';
      idol.marriagePublic = idol.marriagePublic || false;
      idol.stats = idol.stats || {};
      idol.stats.affection = ensureNumber(idol.stats.affection, 10);
    });

    // 补齐事件日志
    if (!data.eventLog) data.eventLog = [];

    // 补齐好友数据
    if (!data.friends) {
      data.friends = [
        { id: 'friend-bestie', name: '小美', type: 'bestie', personality: '活泼八卦', avatar: '👯', desc: '从小一起长大的闺蜜，什么话题都能聊' },
        { id: 'friend-1', name: '知恩', type: 'friend', personality: '温柔知性', avatar: '🌸', desc: '大学同学，偶尔约饭聊八卦' }
      ];
    }

    // 补齐社交账号数据
    if (!data.player.social) {
      data.player.social = {
        followers: getStartingFollowers(data.player.identityTags || []),
        posts: 0
      };
    }

    // 补齐秘密手机数据
    if (!data.player.secretPhone) {
      data.player.secretPhone = { unlocked: false, idolIndex: null };
    }

    // 补齐对话历史摘要（阶段6使用）
    if (!data.conversationSummaries) data.conversationSummaries = [];

    // 补齐经纪人介入追踪
    if (!data.managerInterventions) data.managerInterventions = {};

    // 补齐活跃增益效果
    if (!data.activeBuffs) data.activeBuffs = [];

    // 补齐关系阶段系统字段（阶段7）
    if (data.datingIdolId === undefined) data.datingIdolId = null;
    if (data.marriedIdolId === undefined) data.marriedIdolId = null;
    if (data.marriageType === undefined) data.marriageType = null;
    if (!data.cheatingSuspicion) data.cheatingSuspicion = {};
    if (!data.confirmedStages) data.confirmedStages = {};

    // 更新版本号
    data.version = currentVersion;

    console.log('[State] 存档迁移完成');
    return data;
  }

  function ensureNumber(val, defaultVal) {
    return (typeof val === 'number' && !isNaN(val)) ? val : defaultVal;
  }

  // ===== 存档管理 =====

  /**
   * 获取所有存档槽的摘要信息（供标题画面展示）
   * @returns {Array<{slot: number, summary: string, playerName: string, turn: number, time: string, hasData: boolean}>}
   */
  function getSaveSummaries() {
    return Game.Storage.getAllSaves().map(item => {
      if (!item.data || !item.data.player) {
        return { slot: item.slot, hasData: false, summary: '空', playerName: '', turn: 0, time: '' };
      }
      const d = item.data;
      const time = d.timestamp
        ? new Date(d.timestamp).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '未知';
      return {
        slot: item.slot,
        hasData: true,
        playerName: d.player.name,
        turn: d.currentTurn || 0,
        idolCount: d.idols ? d.idols.length : 0,
        time: time,
        summary: `${d.player.name} · 第${d.currentTurn || 0}回合 · ${time}`
      };
    });
  }

  /**
   * 从存档槽加载游戏（自动版本迁移）
   * @param {number} slot
   * @returns {boolean} 是否加载成功
   */
  function loadGame(slot) {
    const data = Game.Storage.loadGame(slot);
    if (!data) return false;

    // 版本迁移
    const migrated = migrate(data);

    // 恢复到全局状态
    Game.state = migrated;
    _currentSlot = migrated._saveSlot || slot;

    console.log('[State] 游戏已加载：槽' + slot + '，玩家：' + migrated.player.name + '，版本：' + migrated.version);
    return true;
  }

  /**
   * 删除存档
   * @param {number} slot
   */
  function deleteSave(slot) {
    Game.Storage.deleteGame(slot);
    // 如果删的是当前槽，重置槽位
    if (_currentSlot === slot) {
      _currentSlot = 1;
    }
    console.log('[State] 存档已删除：槽' + slot);
  }

  // ===== 公开API =====
  return {
    addAffection,
    addStress,
    addSuspicion,
    addStamina,
    addCharm,
    setRelationshipStage,
    addFollowers,
    incrementPosts,
    getSocialData,
    getStartingFollowers,
    unlockSecretPhone,
    getSecretPhone,
    getSaveSummaries,
    loadGame,
    deleteSave,
    autoSave,
    findEmptySlot,
    allSlotsFull,
    getCurrentSlot,
    setCurrentSlot,
    migrate,
    getFriendById,
    hasManagerIntervened,
    recordManagerIntervention,
    getManagerIntervention,
    addBuff,
    hasActiveBuff,
    addEventLog,
    setDatingIdol,
    clearDatingIdol,
    setMarriedIdol,
    clearMarriedIdol,
    getExclusivePartner,
    isCheating,
    addCheatingSuspicion,
    getCheatingSuspicion,
    confirmStageEvent,
    isStageEventConfirmed
  };

})();
