/**
 * 游戏状态管理模块 — 统一的数值修改入口
 * 负责：五大数值的增减（0-100截断）、自动存档、存档管理
 */

Game.State = (() => {

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
    Game.Storage.saveGame(1, Game.state);
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
      const time = item.data.timestamp
        ? new Date(item.data.timestamp).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
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
   * 从存档槽加载游戏
   * @param {number} slot
   * @returns {boolean} 是否加载成功
   */
  function loadGame(slot) {
    const data = Game.Storage.loadGame(slot);
    if (!data) return false;

    // 恢复到全局状态
    Game.state = data;
    Game.state.initialized = true;

    console.log('[State] 游戏已加载：槽' + slot + '，玩家：' + data.player.name);
    return true;
  }

  /**
   * 删除存档
   * @param {number} slot
   */
  function deleteSave(slot) {
    Game.Storage.deleteGame(slot);
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
    autoSave
  };

})();
