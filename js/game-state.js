/**
 * 游戏状态管理模块 — 统一的数值修改入口
 * 负责：五大数值的增减（0-100截断）、自动存档、存档管理、版本迁移
 */

Game.State = (() => {

  // 当前使用的存档槽（自动存档时写入此槽）
  var _currentSlot = 1;

  // 防抖保存（阶段12）：合并多次autoSave调用为一次写入
  var _dirty = false;
  var _saveTimer = null;
  var _SAVE_DEBOUNCE_MS = 250;

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
    Game.DEBUG && console.log('[State] 秘密手机已解锁！爱豆索引：' + idolIndex);
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

  // ===== 待回复消息追踪（功能1：不回消息降好感度） =====

  /**
   * 标记爱豆的消息为待回复
   * @param {number} idolIndex
   * @param {string} phoneType
   */
  function setPendingReply(idolIndex, phoneType) {
    if (!Game.state.pendingReplies) Game.state.pendingReplies = {};
    var key = String(idolIndex);
    var existing = Game.state.pendingReplies[key];
    Game.state.pendingReplies[key] = {
      turnReceived: Game.state.currentTurn,
      phoneType: phoneType || 'main',
      messageCount: (existing ? existing.messageCount : 0) + 1
    };
    autoSave();
  }

  /**
   * 清除爱豆的待回复标记（玩家回复后）
   * @param {number} idolIndex
   */
  function clearPendingReply(idolIndex) {
    if (!Game.state.pendingReplies) return;
    delete Game.state.pendingReplies[String(idolIndex)];
    autoSave();
  }

  /**
   * 获取爱豆的待回复信息
   * @param {number} idolIndex
   * @returns {Object|null}
   */
  function getPendingReply(idolIndex) {
    if (!Game.state.pendingReplies) return null;
    return Game.state.pendingReplies[String(idolIndex)] || null;
  }

  // ===== 邂逅系统（功能4：可认识新爱豆） =====

  /**
   * 将邂逅事件加入队列
   * @param {string} source - 'action' | 'random'
   */
  function queueEncounter(source) {
    if (!Game.state.encounterQueue) Game.state.encounterQueue = [];
    Game.state.encounterQueue.push({
      source: source,
      turnQueued: Game.state.currentTurn
    });
    autoSave();
  }

  /**
   * 从队列中取出一个邂逅事件
   * @returns {Object|null}
   */
  function popEncounter() {
    if (!Game.state.encounterQueue || Game.state.encounterQueue.length === 0) return null;
    var encounter = Game.state.encounterQueue.shift();
    autoSave();
    return encounter;
  }

  // ===== 玩家发帖记录（功能5：玩家SNS账号页面） =====

  /**
   * 保存一条玩家发帖记录
   * @param {string} text - 帖子内容
   * @param {string} styleId - 发帖风格ID
   */
  function addPlayerPost(text, styleId) {
    if (!Game.state.playerPosts) Game.state.playerPosts = [];
    Game.state.playerPosts.push({
      text: text,
      styleId: styleId || 'custom',
      turn: Game.state.currentTurn,
      timestamp: Date.now(),
      likes: 0,
      comments: 0
    });
    autoSave();
  }

  /**
   * 获取玩家所有发帖（最新在前）
   * @returns {Array}
   */
  function getPlayerPosts() {
    var posts = Game.state.playerPosts || [];
    // 返回副本，最新在前
    return posts.slice().reverse();
  }

  /**
   * 给玩家帖子点赞数+1
   * @param {number} postIndex - 在 getPlayerPosts() 返回的顺序中的索引
   */
  function addPlayerPostLike(postIndex) {
    var posts = Game.state.playerPosts;
    if (!posts) return;
    // postIndex 对应 getPlayerPosts 中的顺序（最新在前）
    var reversedIndex = posts.length - 1 - postIndex;
    if (reversedIndex >= 0 && reversedIndex < posts.length) {
      posts[reversedIndex].likes = (posts[reversedIndex].likes || 0) + 1;
      autoSave();
    }
  }

  /**
   * 给玩家帖子评论数+1
   * @param {number} postIndex - 在 getPlayerPosts() 返回的顺序中的索引
   */
  function addPlayerPostComment(postIndex) {
    var posts = Game.state.playerPosts;
    if (!posts) return;
    var reversedIndex = posts.length - 1 - postIndex;
    if (reversedIndex >= 0 && reversedIndex < posts.length) {
      posts[reversedIndex].comments = (posts[reversedIndex].comments || 0) + 1;
      autoSave();
    }
  }

  // ===== 现实元素系统（阶段8） =====

  /**
   * 记录伴侣查岗事件
   * @param {number} idolIndex
   * @param {Object} data - { turn, type, choice, outcome }
   */
  function recordPartnerCheckIn(idolIndex, data) {
    if (!Game.state.partnerCheckIns) Game.state.partnerCheckIns = {};
    var key = String(idolIndex);
    if (!Game.state.partnerCheckIns[key]) Game.state.partnerCheckIns[key] = { lastTurn: 0, history: [] };
    Game.state.partnerCheckIns[key].lastTurn = data.turn || Game.state.currentTurn;
    Game.state.partnerCheckIns[key].history.push(data);
    // 保持最近10条记录
    if (Game.state.partnerCheckIns[key].history.length > 10) {
      Game.state.partnerCheckIns[key].history.shift();
    }
    autoSave();
  }

  /**
   * 获取上次查岗回合
   */
  function getLastCheckInTurn(idolIndex) {
    var ci = Game.state.partnerCheckIns || {};
    var entry = ci[String(idolIndex)];
    return entry ? entry.lastTurn : 0;
  }

  /**
   * 设置媒体事件标记
   */
  function setMediaEventFlag(idolIndex, flagType) {
    if (!Game.state.mediaEventFlags) Game.state.mediaEventFlags = {};
    var key = String(idolIndex);
    if (!Game.state.mediaEventFlags[key]) Game.state.mediaEventFlags[key] = {};
    Game.state.mediaEventFlags[key][flagType] = true;
    autoSave();
  }

  /**
   * 检查媒体事件标记
   */
  function hasMediaEventFlag(idolIndex, flagType) {
    var flags = Game.state.mediaEventFlags || {};
    var entry = flags[String(idolIndex)];
    return entry ? !!entry[flagType] : false;
  }

  /**
   * 锁定约会行动N回合
   */
  function setDatingActionLock(idolIndex, turns) {
    Game.state.datingActionLock = {
      idolIndex: idolIndex,
      untilTurn: Game.state.currentTurn + turns
    };
    autoSave();
  }

  /**
   * 检查约会行动是否锁定（自动清除过期）
   */
  function isDatingActionLocked(idolIndex) {
    var lock = Game.state.datingActionLock;
    if (!lock) return false;
    // 自动清除过期锁定
    if (Game.state.currentTurn > lock.untilTurn) {
      Game.state.datingActionLock = null;
      autoSave();
      return false;
    }
    return lock.idolIndex === idolIndex;
  }

  /**
   * 强制清除约会锁定
   */
  function clearDatingActionLock() {
    Game.state.datingActionLock = null;
    autoSave();
  }

  /**
   * 设置纪念日回合
   */
  function setAnniversaryTurn(idolIndex, type, turn) {
    if (!Game.state.anniversaryTurns) Game.state.anniversaryTurns = {};
    var key = String(idolIndex);
    if (!Game.state.anniversaryTurns[key]) Game.state.anniversaryTurns[key] = {};
    Game.state.anniversaryTurns[key][type] = turn;
    autoSave();
  }

  /**
   * 获取纪念日回合
   */
  function getAnniversaryTurn(idolIndex, type) {
    var at = Game.state.anniversaryTurns || {};
    var entry = at[String(idolIndex)];
    return entry ? (entry[type] || 0) : 0;
  }

  /**
   * 设置定位共享状态
   */
  function setLocationSharing(idolIndex, enabled) {
    if (!Game.state.locationSharing) Game.state.locationSharing = {};
    Game.state.locationSharing[String(idolIndex)] = enabled;
    autoSave();
  }

  /**
   * 检查定位共享状态
   */
  function hasLocationSharing(idolIndex) {
    var ls = Game.state.locationSharing || {};
    return !!ls[String(idolIndex)];
  }

  /**
   * 获取/设置查岗冷却
   */
  function setCheckInCooldown(idolIndex, turn) {
    if (!Game.state.checkInCooldowns) Game.state.checkInCooldowns = {};
    Game.state.checkInCooldowns[String(idolIndex)] = turn;
    autoSave();
  }

  function getCheckInCooldown(idolIndex) {
    var cd = Game.state.checkInCooldowns || {};
    return cd[String(idolIndex)] || 0;
  }

  // ===== 亲友社交圈 & 公司干涉（阶段8补充） =====

  /**
   * 禁爱令：设置/获取/清除
   */
  function hasDatingBan(idolIndex) {
    var bans = Game.state.datingBans || {};
    var ban = bans[String(idolIndex)];
    if (!ban) return false;
    if ((Game.state.currentTurn || 0) >= ban.untilTurn) return false; // 已过期
    return true;
  }

  function setDatingBan(idolIndex, turns) {
    if (!Game.state.datingBans) Game.state.datingBans = {};
    Game.state.datingBans[String(idolIndex)] = {
      untilTurn: (Game.state.currentTurn || 0) + turns,
      startedTurn: Game.state.currentTurn || 0,
      totalTurns: turns
    };
    autoSave();
  }

  function getDatingBanRemaining(idolIndex) {
    if (!hasDatingBan(idolIndex)) return 0;
    var bans = Game.state.datingBans || {};
    var ban = bans[String(idolIndex)];
    return Math.max(0, ban.untilTurn - (Game.state.currentTurn || 0));
  }

  function clearDatingBan(idolIndex) {
    if (!Game.state.datingBans) return;
    delete Game.state.datingBans[String(idolIndex)];
    autoSave();
  }

  /**
   * 封口协议：设置/获取
   */
  function hasGagOrder(idolIndex) {
    var orders = Game.state.gagOrders || {};
    return !!orders[String(idolIndex)];
  }

  function setGagOrder(idolIndex) {
    if (!Game.state.gagOrders) Game.state.gagOrders = {};
    Game.state.gagOrders[String(idolIndex)] = {
      signed: true,
      turn: Game.state.currentTurn || 0
    };
    autoSave();
  }

  function getGagOrder(idolIndex) {
    var orders = Game.state.gagOrders || {};
    return orders[String(idolIndex)] || null;
  }

  /**
   * 限制接触：设置/获取
   * level: 1=轻度(好感获取-30%), 2=中度(好感获取-50%), 3=重度(好感获取-70%)
   */
  function hasContactRestriction(idolIndex) {
    var restrictions = Game.state.contactRestrictions || {};
    var r = restrictions[String(idolIndex)];
    if (!r) return false;
    if ((Game.state.currentTurn || 0) >= r.untilTurn) return false;
    return true;
  }

  function setContactRestriction(idolIndex, level, turns) {
    if (!Game.state.contactRestrictions) Game.state.contactRestrictions = {};
    Game.state.contactRestrictions[String(idolIndex)] = {
      level: level || 1,
      untilTurn: (Game.state.currentTurn || 0) + (turns || 3),
      startedTurn: Game.state.currentTurn || 0
    };
    autoSave();
  }

  function getContactRestriction(idolIndex) {
    if (!hasContactRestriction(idolIndex)) return null;
    var restrictions = Game.state.contactRestrictions || {};
    return restrictions[String(idolIndex)] || null;
  }

  /**
   * 家人反应：记录/获取
   */
  function setFamilyReaction(idolIndex, reaction) {
    if (!Game.state.familyReactions) Game.state.familyReactions = {};
    Game.state.familyReactions[String(idolIndex)] = {
      reaction: reaction,
      turn: Game.state.currentTurn || 0
    };
    autoSave();
  }

  function getFamilyReaction(idolIndex) {
    var reactions = Game.state.familyReactions || {};
    return reactions[String(idolIndex)] || null;
  }

  /**
   * 队友态度：记录/获取
   */
  function setTeammateAttitude(idolIndex, attitude) {
    if (!Game.state.teammateAttitudes) Game.state.teammateAttitudes = {};
    Game.state.teammateAttitudes[String(idolIndex)] = {
      attitude: attitude,
      turn: Game.state.currentTurn || 0
    };
    autoSave();
  }

  function getTeammateAttitude(idolIndex) {
    var attitudes = Game.state.teammateAttitudes || {};
    return attitudes[String(idolIndex)] || null;
  }

  /**
   * 闺蜜态度冷却
   */
  function setBestFriendCooldown(turn) {
    Game.state.lastBestFriendTurn = turn || Game.state.currentTurn || 0;
    autoSave();
  }

  function getBestFriendCooldown() {
    return Game.state.lastBestFriendTurn || 0;
  }

  // ===== 事件系统通用标记（阶段9） =====

  /**
   * 设置事件去重标记
   * @param {string} flagId - 标记ID（如 'birthday-0-y1', 'susp-60'）
   * @param {*} value - 标记值，默认true
   */
  function setEventFlag(flagId, value) {
    if (!Game.state.eventFlags) Game.state.eventFlags = {};
    Game.state.eventFlags[flagId] = (value !== undefined) ? value : true;
    autoSave();
  }

  /**
   * 检查事件去重标记是否存在
   * @param {string} flagId
   * @returns {boolean}
   */
  function hasEventFlag(flagId) {
    return !!(Game.state.eventFlags && Game.state.eventFlags[flagId]);
  }

  // ===== 回归期追踪（阶段9） =====

  /**
   * 添加回归期记录
   * @param {number} idolIndex
   * @param {number} startTurn
   * @param {number} endTurn
   */
  function addComeback(idolIndex, startTurn, endTurn) {
    if (!Game.state.comebacks) Game.state.comebacks = [];
    Game.state.comebacks.push({ idolIndex: idolIndex, startTurn: startTurn, endTurn: endTurn });
    autoSave();
  }

  /**
   * 获取指定爱豆当前活跃的回归期
   * @param {number} idolIndex
   * @returns {Object|null}
   */
  function getActiveComeback(idolIndex) {
    var comebacks = Game.state.comebacks || [];
    var currentTurn = Game.state.currentTurn || 0;
    for (var i = 0; i < comebacks.length; i++) {
      var cb = comebacks[i];
      if (cb.idolIndex === idolIndex && cb.startTurn <= currentTurn && cb.endTurn > currentTurn) {
        return cb;
      }
    }
    return null;
  }

  /**
   * 获取所有活跃的回归期（自动清理过期）
   * @returns {Array}
   */
  function getActiveComebacks() {
    var comebacks = Game.state.comebacks || [];
    var currentTurn = Game.state.currentTurn || 0;
    return comebacks.filter(function(cb) {
      return cb.endTurn > currentTurn;
    });
  }

  // ===== 工具 =====

  function clamp(val) {
    return Math.max(0, Math.min(100, Math.round(val)));
  }

  /**
   * 自动存档（防抖版 — 阶段12）
   * 多次快速调用合并为一次写入，250ms内无新调用才实际写入
   * 关键路径（returnToTitle、endTurn）请使用 flushSave() 确保立即写入
   */
  function autoSave() {
    _dirty = true;
    if (!_saveTimer) {
      _saveTimer = setTimeout(function() {
        Game.state.currentTurn = Game.state.currentTurn || 0;
        Game.state._saveSlot = _currentSlot;
        Game.Storage.saveGame(_currentSlot, Game.state);
        _dirty = false;
        _saveTimer = null;
        // 刷新视觉氛围（阶段11）
        if (Game.Visual && Game.Visual.refreshAtmosphere) {
          Game.Visual.refreshAtmosphere();
        }
      }, _SAVE_DEBOUNCE_MS);
    }
  }

  /**
   * 强制立即保存（阶段12）
   * 用于关键路径：返回标题画面、回合结束、页面关闭
   */
  function flushSave() {
    if (_saveTimer) {
      clearTimeout(_saveTimer);
      _saveTimer = null;
    }
    if (_dirty || !Game.state._saveSlot) {
      Game.state.currentTurn = Game.state.currentTurn || 0;
      Game.state._saveSlot = _currentSlot;
      Game.Storage.saveGame(_currentSlot, Game.state);
      _dirty = false;
    }
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

    Game.DEBUG && console.log('[State] 存档版本迁移：' + loadedVersion + ' → ' + currentVersion);

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

    // 补齐待回复消息追踪（功能1）
    if (!data.pendingReplies) data.pendingReplies = {};

    // 补齐邂逅队列（功能4）
    if (!data.encounterQueue) data.encounterQueue = [];

    // 补齐玩家发帖记录（功能5：玩家SNS账号页面）
    if (!data.playerPosts) data.playerPosts = [];
    // 修复旧存档中 turn 为 0 或缺失的帖子
    var currentTurn = data.currentTurn || 0;
    for (var pi = 0; pi < data.playerPosts.length; pi++) {
      if (!data.playerPosts[pi].turn || data.playerPosts[pi].turn === 0) {
        data.playerPosts[pi].turn = Math.max(1, currentTurn);
      }
    }

    // 补齐现实元素系统字段（阶段8）
    if (!data.partnerCheckIns) data.partnerCheckIns = {};
    if (!data.mediaEventFlags) data.mediaEventFlags = {};
    if (data.datingActionLock === undefined) data.datingActionLock = null;
    if (!data.anniversaryTurns) data.anniversaryTurns = {};
    if (!data.locationSharing) data.locationSharing = {};
    if (!data.checkInCooldowns) data.checkInCooldowns = {};
    if (data.lastFamousSceneTurn === undefined) data.lastFamousSceneTurn = 0;
    // 亲友社交圈 & 公司干涉字段（阶段8补充）
    if (!data.datingBans) data.datingBans = {};
    if (!data.gagOrders) data.gagOrders = {};
    if (!data.contactRestrictions) data.contactRestrictions = {};
    if (!data.familyReactions) data.familyReactions = {};
    if (!data.teammateAttitudes) data.teammateAttitudes = {};
    if (data.lastBestFriendTurn === undefined) data.lastBestFriendTurn = 0;
    // 补填已有恋爱/已婚关系纪念日（估算值，避免立即触发）
    (data.idols || []).forEach(function(idol, i) {
      var key = String(i);
      if (!data.anniversaryTurns[key]) data.anniversaryTurns[key] = {};
      if (idol.relationshipStage === 'dating' || idol.relationshipStage === 'married') {
        if (!data.anniversaryTurns[key].datingStart) {
          data.anniversaryTurns[key].datingStart = Math.max(1, currentTurn - 5);
        }
      }
      if (idol.relationshipStage === 'married') {
        if (!data.anniversaryTurns[key].marriedStart) {
          data.anniversaryTurns[key].marriedStart = Math.max(1, currentTurn - 2);
        }
      }
    });

    // 补齐事件系统字段（阶段9）
    if (!data.eventFlags) data.eventFlags = {};
    if (!data.comebacks) data.comebacks = [];
    if (data.lastBreakingNewsTurn === undefined) data.lastBreakingNewsTurn = 0;
    // 为已有爱豆随机补填生日（估算值）

    // 补齐结局系统字段（阶段10）
    if (data.endingTriggered === undefined) data.endingTriggered = false;
    if (data.endingId === undefined) data.endingId = null;
    if (data.endingTurn === undefined) data.endingTurn = 0;
    if (data._pendingEnding === undefined) data._pendingEnding = null;
    // 为已有爱豆随机补填生日（估算值）
    (data.idols || []).forEach(function(idol) {
      if (idol.birthMonth === undefined) idol.birthMonth = Math.floor(Math.random() * 12) + 1;
      if (idol.birthHalf === undefined) idol.birthHalf = Math.random() < 0.5 ? 1 : 2;
    });

    // 更新版本号
    data.version = currentVersion;

    Game.DEBUG && console.log('[State] 存档迁移完成');
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

    Game.DEBUG && console.log('[State] 游戏已加载：槽' + slot + '，玩家：' + migrated.player.name + '，版本：' + migrated.version);
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
    Game.DEBUG && console.log('[State] 存档已删除：槽' + slot);
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
    flushSave,
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
    isStageEventConfirmed,
    setPendingReply,
    clearPendingReply,
    getPendingReply,
    queueEncounter,
    popEncounter,
    addPlayerPost,
    getPlayerPosts,
    addPlayerPostLike,
    addPlayerPostComment,
    // 现实元素系统（阶段8）
    recordPartnerCheckIn,
    getLastCheckInTurn,
    setMediaEventFlag,
    hasMediaEventFlag,
    setDatingActionLock,
    isDatingActionLocked,
    clearDatingActionLock,
    setAnniversaryTurn,
    getAnniversaryTurn,
    setLocationSharing,
    hasLocationSharing,
    setCheckInCooldown,
    getCheckInCooldown,
    // 亲友社交圈 & 公司干涉（阶段8补充）
    hasDatingBan,
    setDatingBan,
    getDatingBanRemaining,
    clearDatingBan,
    hasGagOrder,
    setGagOrder,
    getGagOrder,
    hasContactRestriction,
    setContactRestriction,
    getContactRestriction,
    setFamilyReaction,
    getFamilyReaction,
    setTeammateAttitude,
    getTeammateAttitude,
    setBestFriendCooldown,
    getBestFriendCooldown,
    // 事件系统（阶段9）
    setEventFlag,
    hasEventFlag,
    addComeback,
    getActiveComeback,
    getActiveComebacks
  };

})();
