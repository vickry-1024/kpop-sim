/**
 * 行动定义库 — 所有可选行动的数据定义
 * 负责：行动静态数据（名称/消耗/效果范围）、分类查询
 */

Game.Actions = (() => {

  // ===== 行动分类配置 =====
  const CATEGORIES = [
    { id: 'idol',      name: '爱豆互动', icon: '💬', color: '#F8A5C2' },
    { id: 'self',      name: '自我提升', icon: '🏋️', color: '#A78BFA' },
    { id: 'social',    name: '社交经营', icon: '📱', color: '#4ECDC4' },
    { id: 'work',      name: '工作学业', icon: '💼', color: '#FFA502' },
    { id: 'gift',      name: '礼物应援', icon: '🎁', color: '#FF6B6B' },
    { id: 'intel',     name: '收集情报', icon: '🔍', color: '#7EC8E3' },
    { id: 'rest',      name: '休息恢复', icon: '🏥', color: '#2ED573' }
  ];

  // ===== 行动定义 =====
  // effects 中的值为 [min, max] 范围，执行时随机取值
  // needsTarget: true 表示需要选择目标爱豆
  const ACTIONS = [
    // ---- 爱豆互动 ----
    {
      id: 'chat', category: 'idol', name: '发消息聊天', icon: '💬',
      staminaCost: 10,
      effects: { affection: [5, 10], stress: [-5, 0] },
      needsTarget: true,
      desc: '和爱豆发消息聊聊天，轻松愉快'
    },
    {
      id: 'date', category: 'idol', name: '约会见面', icon: '🥂',
      staminaCost: 20,
      effects: { affection: [10, 18], stress: [-10, -3], charm: [1, 3] },
      needsTarget: true,
      desc: '约爱豆出来见面，需要精心打扮'
    },
    {
      id: 'visit', category: 'idol', name: '探班应援', icon: '🏢',
      staminaCost: 15,
      effects: { affection: [7, 14], stress: [-3, 3], suspicion: [0, 5] },
      needsTarget: true,
      desc: '去公司/片场探班，可能被工作人员看到'
    },
    {
      id: 'videocall', category: 'idol', name: '视频通话', icon: '📹',
      staminaCost: 8,
      effects: { affection: [4, 8], stress: [-8, -2] },
      needsTarget: true,
      desc: '深夜视频通话，私密又温馨'
    },

    // ---- 自我提升 ----
    {
      id: 'gym', category: 'self', name: '去健身房', icon: '💪',
      staminaCost: 20,
      effects: { charm: [3, 7], stress: [5, 12], stamina: [-5, 0] },
      needsTarget: false,
      desc: '挥洒汗水，提升魅力'
    },
    {
      id: 'talent', category: 'self', name: '学才艺/舞蹈', icon: '🎵',
      staminaCost: 18,
      effects: { charm: [4, 8], stress: [3, 8] },
      needsTarget: false,
      desc: '学一门才艺，说不定能和爱豆同台'
    },
    {
      id: 'skincare', category: 'self', name: '护肤美容', icon: '✨',
      staminaCost: 10,
      effects: { charm: [2, 5], stress: [-5, -2] },
      needsTarget: false,
      desc: '做个护肤，让自己更美'
    },
    {
      id: 'reading', category: 'self', name: '读书充电', icon: '📚',
      staminaCost: 12,
      effects: { charm: [1, 4], stress: [-3, 5] },
      needsTarget: false,
      desc: '充实自己，提升内在魅力'
    },

    // ---- 社交经营 ----
    {
      id: 'sns-post', category: 'social', name: '发SNS动态', icon: '📸',
      staminaCost: 8,
      effects: { charm: [1, 3], suspicion: [0, 3], stress: [-3, 1] },
      needsTarget: false,
      desc: '在社交媒体上发动态，经营形象'
    },
    {
      id: 'fan-interact', category: 'social', name: '粉丝互动', icon: '💬',
      staminaCost: 10,
      effects: { charm: [2, 4], stress: [0, 5] },
      needsTarget: false,
      desc: '和粉丝互动，增加人气'
    },

    // ---- 工作学业 ----
    {
      id: 'work', category: 'work', name: '上班/接活', icon: '💻',
      staminaCost: 20,
      effects: { charm: [1, 3], stress: [8, 15] },
      needsTarget: false,
      desc: '认真工作赚钱，虽然累但有必要'
    },
    {
      id: 'study', category: 'work', name: '上课学习', icon: '📖',
      staminaCost: 18,
      effects: { charm: [2, 5], stress: [5, 10], stamina: [-5, 0] },
      needsTarget: false,
      desc: '好好学习，提升自己'
    },
    {
      id: 'overtime', category: 'work', name: '加班/赶工', icon: '😫',
      staminaCost: 25,
      effects: { charm: [0, 2], stress: [12, 20], stamina: [-10, -5] },
      needsTarget: false,
      desc: '紧急加班，消耗很大但没办法'
    },

    // ---- 礼物应援 ----
    {
      id: 'gift', category: 'gift', name: '送礼物', icon: '🎀',
      staminaCost: 12,
      effects: { affection: [6, 12], charm: [0, 2] },
      needsTarget: true,
      desc: '精心挑选一份礼物送给爱豆'
    },
    {
      id: 'coffee-truck', category: 'gift', name: '送咖啡车', icon: '☕',
      staminaCost: 15,
      effects: { affection: [8, 15], suspicion: [3, 8], charm: [1, 3] },
      needsTarget: true,
      desc: '给拍摄现场送咖啡车，场面大但容易引起注意'
    },

    // ---- 收集情报 ----
    {
      id: 'check-sns', category: 'intel', name: '刷爱豆SNS', icon: '📱',
      staminaCost: 8,
      effects: { stress: [-5, 0], suspicion: [0, 2] },
      needsTarget: true,
      desc: '刷刷爱豆的社交账号，了解近况'
    },
    {
      id: 'ask-around', category: 'intel', name: '打听消息', icon: '🕵️',
      staminaCost: 12,
      effects: { suspicion: [3, 10], stress: [0, 5] },
      needsTarget: true,
      desc: '通过人脉打听爱豆行程，有风险'
    },

    // ---- 休息恢复 ----
    {
      id: 'rest', category: 'rest', name: '好好休息', icon: '😴',
      staminaCost: 0,
      effects: { stamina: [25, 40], stress: [-10, -5] },
      needsTarget: false,
      desc: '在家睡个好觉，恢复体力'
    },
    {
      id: 'vacation', category: 'rest', name: '出门度假', icon: '🏖️',
      staminaCost: 5,
      effects: { stamina: [30, 50], stress: [-20, -10], charm: [0, 2] },
      needsTarget: false,
      desc: '出去旅行放松，彻底充电'
    }
  ];

  // ===== 查询方法 =====

  /**
   * 根据ID获取单个行动定义
   * @param {string} id
   * @returns {Object|undefined}
   */
  function getAction(id) {
    return ACTIONS.find(a => a.id === id);
  }

  /**
   * 获取所有行动
   * @returns {Array}
   */
  function getAll() {
    return ACTIONS;
  }

  /**
   * 按分类获取行动列表
   * @param {string} categoryId
   * @returns {Array}
   */
  function getActionsByCategory(categoryId) {
    return ACTIONS.filter(a => a.category === categoryId);
  }

  /**
   * 按分类分组的行动列表
   * @returns {Array<{category: Object, actions: Array}>}
   */
  function getGroupedActions() {
    return CATEGORIES.map(cat => ({
      category: cat,
      actions: ACTIONS.filter(a => a.category === cat.id)
    })).filter(g => g.actions.length > 0);
  }

  // ===== 公开API =====
  return {
    getAction,
    getAll,
    getActionsByCategory,
    getGroupedActions,
    CATEGORIES
  };

})();
