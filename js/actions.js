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
      subType: 'chat',  // 弹出聊天对话界面
      desc: '和爱豆发消息聊聊天，轻松愉快'
    },
    {
      id: 'date', category: 'idol', name: '约会见面', icon: '🥂',
      staminaCost: 20,
      effects: { affection: [10, 18], stress: [-10, -3], charm: [1, 3] },
      needsTarget: true,
      subType: 'select',  // 弹出子选项（约会地点）
      desc: '约爱豆出来见面，需要精心打扮'
    },
    {
      id: 'visit', category: 'idol', name: '探班应援', icon: '🏢',
      staminaCost: 15,
      effects: { affection: [7, 14], stress: [-3, 3], suspicion: [0, 5] },
      needsTarget: true,
      subType: 'select',  // 弹出子选项（探班方式）
      desc: '去公司/片场探班，可能被工作人员看到'
    },
    {
      id: 'videocall', category: 'idol', name: '视频通话', icon: '📹',
      staminaCost: 8,
      effects: { affection: [4, 8], stress: [-8, -2] },
      needsTarget: true,
      subType: 'chat',  // 弹出视频通话对话界面
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
      subType: 'select',  // 弹出子选项（发帖风格）
      desc: '在社交媒体上发动态，经营形象'
    },
    {
      id: 'fan-interact', category: 'social', name: '粉丝互动', icon: '💬',
      staminaCost: 10,
      effects: { charm: [2, 4], stress: [0, 5], followers: [50, 150] },
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
      subType: 'select',  // 弹出子选项（礼物类型）
      desc: '精心挑选一份礼物送给爱豆'
    },
    {
      id: 'coffee-truck', category: 'gift', name: '送咖啡车', icon: '☕',
      staminaCost: 15,
      effects: { affection: [8, 15], suspicion: [3, 8], charm: [1, 3] },
      needsTarget: true,
      subType: 'select',  // 弹出子选项（应援规模）
      desc: '给拍摄现场送咖啡车，场面大但容易引起注意'
    },

    // ---- 收集情报 ----
    {
      id: 'check-sns', category: 'intel', name: '刷爱豆SNS', icon: '📱',
      staminaCost: 8,
      effects: { stress: [-5, 0], suspicion: [0, 2] },
      needsTarget: true,
      subType: 'select',  // 弹出子选项（互动方式）
      desc: '刷刷爱豆的社交账号，了解近况'
    },
    {
      id: 'ask-around', category: 'intel', name: '打听消息', icon: '🕵️',
      staminaCost: 12,
      effects: { suspicion: [3, 10], stress: [0, 5] },
      needsTarget: true,
      subType: 'select',  // 弹出子选项（消息来源）
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

  // ===== 行动子选项定义 =====
  // 当行动的 subType 为 'select' 时，从这里取子选项列表
  const SUB_CHOICES = {
    date: [
      { id: 'date-cafe', label: '咖啡厅约会', icon: '☕',
        desc: '安静的咖啡厅角落，私密又舒适，不容易被认出来',
        effectMods: { affection: [2, 4], suspicion: [-3, 0] } },
      { id: 'date-cinema', label: '电影院', icon: '🎬',
        desc: '黑暗中独处，谁也看不清谁，心跳加速',
        effectMods: { affection: [3, 6], suspicion: [-2, 1], stress: [-3, 0] } },
      { id: 'date-restaurant', label: '高级餐厅', icon: '🍽️',
        desc: '体面又浪漫，但人多眼杂，可能被粉丝认出',
        effectMods: { affection: [1, 3], suspicion: [3, 8], charm: [2, 4] } },
      { id: 'date-park', label: '深夜汉江公园', icon: '🌙',
        desc: '夜晚的江边，浪漫又刺激，但要小心被跟拍',
        effectMods: { affection: [5, 10], suspicion: [5, 12], stress: [-5, -2] } }
    ],
    visit: [
      { id: 'visit-fan', label: '以粉丝身份应援', icon: '🎭',
        desc: '混在粉丝群里送咖啡，安全但不够特别',
        effectMods: { affection: [2, 4], suspicion: [0, 2] } },
      { id: 'visit-friend', label: '以朋友身份探班', icon: '🤝',
        desc: '大大方方说是圈外朋友，自然得体',
        effectMods: { affection: [4, 7], suspicion: [1, 4] } },
      { id: 'visit-secret', label: '悄悄溜进去', icon: '🤫',
        desc: '趁工作人员不注意溜进休息室，刺激又亲密',
        effectMods: { affection: [5, 9], suspicion: [-2, 1], stress: [-3, 0] } }
    ],
    'sns-post': [
      { id: 'sns-lovestagram', label: '暗戳戳秀恩爱', icon: '💕',
        desc: '发一张只有你们懂的暗示照，粉丝会疯狂解码',
        effectMods: { suspicion: [3, 8], stress: [-5, -2], followers: [50, 200], posts: [1, 1] } },
      { id: 'sns-fan', label: '以粉丝视角应援', icon: '📣',
        desc: '晒专辑、刷话题、宣传新歌，阳光正面',
        effectMods: { charm: [2, 5], suspicion: [-1, 0], followers: [200, 500], posts: [1, 1] } },
      { id: 'sns-daily', label: '晒日常美照', icon: '🌸',
        desc: '发自拍和生活碎片，自然经营社交形象',
        effectMods: { charm: [3, 6], suspicion: [0, 2], followers: [100, 300], posts: [1, 1] } }
    ],
    gift: [
      { id: 'gift-practical', label: '实用小物', icon: '🧤',
        desc: '送条围巾或手套，温暖又贴心，不张扬',
        effectMods: { affection: [1, 3], suspicion: [-2, 0] } },
      { id: 'gift-romantic', label: '浪漫礼物', icon: '💐',
        desc: '鲜花配手写卡片，浪漫满分但可能被队友看到',
        effectMods: { affection: [3, 6], suspicion: [1, 4] } },
      { id: 'gift-luxury', label: '贵重礼物', icon: '💎',
        desc: '名牌包包或手表，出手大方但容易引人注意',
        effectMods: { affection: [5, 10], suspicion: [3, 8], charm: [1, 3] } }
    ],
    'coffee-truck': [
      { id: 'coffee-quiet', label: '低调小型应援', icon: '🤫',
        desc: '以粉丝站名义低调送，只有咖啡和小零食',
        effectMods: { affection: [2, 5], suspicion: [-1, 1] } },
      { id: 'coffee-big', label: '高调大型应援', icon: '📣',
        desc: '定制横幅+人形立牌+专属咖啡杯套，阵仗很大',
        effectMods: { affection: [5, 9], suspicion: [5, 10], charm: [2, 4] } }
    ],
    'check-sns': [
      { id: 'sns-lurk', label: '默默浏览不互动', icon: '👀',
        desc: '只看看不留下痕迹，安全低调',
        effectMods: { suspicion: [-2, 0], stress: [-3, 0] } },
      { id: 'sns-engage', label: '点赞评论互动', icon: '💬',
        desc: '积极点赞评论，爱豆可能会注意到你',
        effectMods: { affection: [1, 3], suspicion: [1, 3] } },
      { id: 'sns-stan', label: '开小号疯狂安利', icon: '🔥',
        desc: '转发控评一条龙，沉浸式追星体验',
        effectMods: { affection: [2, 5], suspicion: [0, 2], stress: [-5, -2] } }
    ],
    'ask-around': [
      { id: 'ask-friend', label: '通过圈内朋友打听', icon: '👥',
        desc: '找认识的圈内人问问，安全但信息有限',
        effectMods: { suspicion: [1, 4], stress: [0, 3] } },
      { id: 'ask-sasaeng', label: '找私生渠道', icon: '🕶️',
        desc: '通过私生饭网络获取独家情报，高效但危险',
        effectMods: { suspicion: [5, 12], stress: [-5, 0] } },
      { id: 'ask-staff', label: '套工作人员的话', icon: '☕',
        desc: '请工作人员喝咖啡顺便聊天，温和又有效',
        effectMods: { suspicion: [0, 2], stress: [-2, 2] } }
    ]
  };

  // ===== 聊天对话剧本 =====
  // 按行动类型和好感度阶段组织
  const CHAT_DIALOGUES = {
    // 发消息聊天
    chat: {
      low: {
        messages: [
          { from: 'idol', text: '嗯？突然找我有什么事吗？' },
          { from: 'idol', text: '哦…就是想聊天啊。好吧，最近确实有点忙。' }
        ],
        replies: [
          { id: 'chat-warm', label: '💜 温暖问候', text: '辛苦了～就是想问问你最近好不好',
            effectMods: { affection: [1, 3], stress: [-3, 0] } },
          { id: 'chat-funny', label: '😄 轻松闲聊', text: '就想找你聊聊天，没什么特别的事～',
            effectMods: { affection: [2, 4], stress: [-5, -2] } },
          { id: 'chat-cool', label: '😐 简短收尾', text: '嗯，确认你还好就行。先忙吧。',
            effectMods: { affection: [-1, 1], stress: [0, 3] } }
        ]
      },
      mid: {
        messages: [
          { from: 'idol', text: '欧尼～怎么想起找我啦？' },
          { from: 'idol', text: '我刚结束练习，累死了ㅠㅠ 看到你的消息瞬间精神了！' },
          { from: 'idol', text: '你今天过得怎么样？' }
        ],
        replies: [
          { id: 'chat-warm', label: '💜 温柔关心', text: '这么累啊，要多休息！我给你点了外卖～',
            effectMods: { affection: [3, 5], stress: [-5, -2] } },
          { id: 'chat-flirty', label: '😏 撩一下', text: '想你当然就找你啦，还需要理由吗？',
            effectMods: { affection: [4, 7], stress: [-3, 0] } },
          { id: 'chat-casual', label: '😊 日常分享', text: '我今天也不错～看了你昨天的舞台，超棒的！',
            effectMods: { affection: [2, 4], stress: [-4, -1], charm: [0, 1] } }
        ]
      },
      high: {
        messages: [
          { from: 'idol', text: '欧尼！！💜 正在想你你就发消息来了！' },
          { from: 'idol', text: '今天一整天都在等你的消息呢…我是不是太粘人了？' },
          { from: 'idol', text: '好想见你…下次什么时候能见面？' }
        ],
        replies: [
          { id: 'chat-sweet', label: '💜 甜蜜回应', text: '我也好想你～很快就能见面了，等我！',
            effectMods: { affection: [5, 8], stress: [-8, -3] } },
          { id: 'chat-spicy', label: '🔥 更近一步', text: '这么想我？那今晚视频吧，想看你。',
            effectMods: { affection: [6, 10], stress: [-5, 0] } },
          { id: 'chat-plan', label: '📅 直接约下次', text: '那就这周末见面吧！我去找你～',
            effectMods: { affection: [4, 7], stress: [-3, 0], charm: [1, 2] } }
        ]
      }
    },
    // 视频通话
    videocall: {
      low: {
        messages: [
          { from: 'idol', text: '哦？突然打视频过来…有什么事吗？' },
          { from: 'idol', text: '（画面里看到爱豆素颜戴着眼镜，有点惊讶）' },
          { from: 'idol', text: '等一下！我还没化妆…算了，反正你也看到了。' }
        ],
        replies: [
          { id: 'vc-polite', label: '😊 礼貌回应', text: '打扰了～就是突然想看看你，不化妆也很好看',
            effectMods: { affection: [2, 4], stress: [-3, 0] } },
          { id: 'vc-casual', label: '😄 轻松聊天', text: '没事没事，素颜也好看！最近累不累？',
            effectMods: { affection: [3, 5], stress: [-5, -2] } },
          { id: 'vc-quick', label: '👋 简短通话', text: '啊抱歉打扰了，那我先挂啦，早点休息～',
            effectMods: { affection: [-1, 1], stress: [0, 3] } }
        ]
      },
      mid: {
        messages: [
          { from: 'idol', text: '欧尼～！（挥手）好开心你打过来！' },
          { from: 'idol', text: '我刚洗完澡，头发还是湿的…（不好意思地笑）' },
          { from: 'idol', text: '让我看看你～今天打扮得好漂亮！' }
        ],
        replies: [
          { id: 'vc-sweet', label: '💜 甜蜜互动', text: '想你了嘛～看到你的脸就瞬间治愈了',
            effectMods: { affection: [4, 7], stress: [-5, -2] } },
          { id: 'vc-deep', label: '🌙 深夜谈心', text: '最近压力大吗？有什么想聊的都可以跟我说',
            effectMods: { affection: [3, 6], stress: [-8, -3] } },
          { id: 'vc-fun', label: '😆 搞笑逗乐', text: '你头发湿着好像一只落汤猫，可爱死了！',
            effectMods: { affection: [5, 8], stress: [-3, 0] } }
        ]
      },
      high: {
        messages: [
          { from: 'idol', text: '（秒接）欧尼！！我今天一直在等你的电话！' },
          { from: 'idol', text: '我把灯调暗了，室友都睡了…所以只有我能看到你。' },
          { from: 'idol', text: '（靠近镜头小声说）其实…我好想你现在就在我身边。' }
        ],
        replies: [
          { id: 'vc-intimate', label: '💜 深情回应', text: '我也好想在你身边…很快就能见面了',
            effectMods: { affection: [6, 10], stress: [-8, -3] } },
          { id: 'vc-tease', label: '😏 撩拨一下', text: '这么想我啊？那想不想看我穿你送的那件…',
            effectMods: { affection: [7, 12], stress: [-5, 0] } },
          { id: 'vc-plan', label: '📅 定下次见面', text: '这周末有空吗？我去找你，就我们两个',
            effectMods: { affection: [5, 8], stress: [-3, 0], charm: [1, 2] } }
        ]
      }
    }
  };

  /**
   * 根据好感度获取聊天对话阶段
   * @param {number} affection - 好感度值
   * @returns {string} 'low' | 'mid' | 'high'
   */
  function getChatStage(affection) {
    if (affection >= 60) return 'high';
    if (affection >= 30) return 'mid';
    return 'low';
  }

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
    getSubChoices: (actionId) => SUB_CHOICES[actionId] || null,
    getChatDialogue: (actionId, affection) => {
      const stage = getChatStage(affection);
      const scripts = CHAT_DIALOGUES[actionId];
      if (scripts && scripts[stage]) return scripts[stage];
      // 降级：返回 chat 的对应阶段；再降级到 chat.low
      if (scripts) return scripts.low || scripts[Object.keys(scripts)[0]];
      return CHAT_DIALOGUES.chat ? (CHAT_DIALOGUES.chat[stage] || CHAT_DIALOGUES.chat.low) : null;
    },
    CATEGORIES
  };

})();
