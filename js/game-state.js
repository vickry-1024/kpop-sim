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

    // 补齐事件日志（阶段9使用）
    if (!data.eventLog) data.eventLog = [];

    // 补齐对话历史摘要（阶段6使用）
    if (!data.conversationSummaries) data.conversationSummaries = [];

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
    getSaveSummaries,
    loadGame,
    deleteSave,
    autoSave,
    findEmptySlot,
    allSlotsFull,
    getCurrentSlot,
    setCurrentSlot,
    migrate
  };

})();
