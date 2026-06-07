/**
 * 结局系统模块 — 15个结局条件检测、结局展示、结局回顾
 * 阶段10核心模块
 * 依赖：Game.State（状态管理）、Game.Relationship（分手/离婚逻辑）
 */

Game.Endings = (() => {

  // ===== 常量：15个结局定义 =====

  /** 结局优先级分组（数字越小优先级越高） */
  var PRIORITY_EXPOSURE = 1;
  var PRIORITY_BREAKUP = 2;
  var PRIORITY_MARRIAGE = 3;
  var PRIORITY_CHEATING = 4;
  var PRIORITY_CAREER = 5;
  var PRIORITY_UNEXPECTED = 6;
  var PRIORITY_SOLO = 7;

  /** 结局分类标签 */
  var CATEGORY_LABELS = {
    'marriage': '💒 婚姻',
    'breakup': '💔 分离',
    'divorce': '💍 破裂',
    'career-peak': '🌟 事业',
    'exposure': '🔥 曝光',
    'cheating': '😈 修罗场',
    'solo': '🏃 独自美丽',
    'unexpected': '🎭 意外'
  };

  /** 结局分类CSS类 */
  var CATEGORY_BADGE_CLASS = {
    'marriage': 'ending-badge-marriage',
    'breakup': 'ending-badge-breakup',
    'divorce': 'ending-badge-breakup',
    'career-peak': 'ending-badge-career',
    'exposure': 'ending-badge-exposure',
    'cheating': 'ending-badge-cheating',
    'solo': 'ending-badge-solo',
    'unexpected': 'ending-badge-unexpected'
  };

  /** 15个结局定义表 */
  var ENDINGS = [
    // === 曝光类（优先级最高：1） ===
    {
      id: 'forced-public',
      name: '被迫公开',
      icon: '🔥',
      category: 'exposure',
      priority: PRIORITY_EXPOSURE,
      checkGroup: 'exposure',
      desc: '嫌疑度突破临界点，媒体曝光了你的秘密恋情'
    },
    {
      id: 'company-split',
      name: '公司拆散',
      icon: '🏢',
      category: 'exposure',
      priority: PRIORITY_EXPOSURE,
      checkGroup: 'exposure',
      desc: '经纪公司多次介入，最终强行拆散了你们'
    },
    {
      id: 'fan-boycott',
      name: '粉丝抵制',
      icon: '📢',
      category: 'exposure',
      priority: PRIORITY_EXPOSURE,
      checkGroup: 'exposure',
      desc: '粉丝群体联合抵制，你们的关系被迫终止'
    },

    // === 分手/离婚类（优先级：2） ===
    {
      id: 'cheating-exposed',
      name: '出轨败露',
      icon: '💔',
      category: 'breakup',
      priority: PRIORITY_BREAKUP,
      checkGroup: 'breakup',
      desc: '出轨行为被伴侣发现，恋情以分手告终'
    },
    {
      id: 'marriage-breakdown',
      name: '婚姻破裂',
      icon: '💍',
      category: 'divorce',
      priority: PRIORITY_BREAKUP,
      checkGroup: 'breakup',
      desc: '婚后出轨导致离婚，曾经的誓言化为泡影'
    },
    {
      id: 'stress-breakdown',
      name: '压力崩溃',
      icon: '😰',
      category: 'breakup',
      priority: PRIORITY_BREAKUP,
      checkGroup: 'breakup',
      desc: '巨大的压力压垮了你们的感情，关系走向终结'
    },

    // === 结婚类（优先级：3） ===
    {
      id: 'sweet-wedding',
      name: '甜蜜婚礼',
      icon: '💒',
      category: 'marriage',
      priority: PRIORITY_MARRIAGE,
      checkGroup: 'marriage',
      desc: '公开结婚，在所有人的祝福中走向幸福'
    },
    {
      id: 'secret-marriage',
      name: '秘密婚姻',
      icon: '🤫',
      category: 'marriage',
      priority: PRIORITY_MARRIAGE,
      checkGroup: 'marriage',
      desc: '选择秘密结婚，在无人知晓的角落里守护爱情'
    },

    // === 修罗场类（优先级：4） ===
    {
      id: 'perfect-crime',
      name: '完美犯罪',
      icon: '😈',
      category: 'cheating',
      priority: PRIORITY_CHEATING,
      checkGroup: 'cheating',
      desc: '周旋于多个爱豆之间却全身而退，堪称"完美犯罪"'
    },
    {
      id: 'ruined-reputation',
      name: '身败名裂',
      icon: '📰',
      category: 'cheating',
      priority: PRIORITY_CHEATING,
      checkGroup: 'cheating',
      desc: '多线操作被曝光，名誉扫地，众叛亲离'
    },

    // === 事业巅峰类（优先级：5） ===
    {
      id: 'life-winner',
      name: '人生赢家',
      icon: '🌟',
      category: 'career-peak',
      priority: PRIORITY_CAREER,
      checkGroup: 'career',
      desc: '事业与爱情双丰收，成为真正的人生赢家'
    },
    {
      id: 'career-queen',
      name: '事业女王',
      icon: '💼',
      category: 'career-peak',
      priority: PRIORITY_CAREER,
      checkGroup: 'career',
      desc: '放弃了感情，在事业上登顶巅峰'
    },

    // === 意外结局（优先级：6） ===
    {
      id: 'elopement',
      name: '私奔天涯',
      icon: '✈️',
      category: 'unexpected',
      priority: PRIORITY_UNEXPECTED,
      checkGroup: 'unexpected',
      desc: '秘密婚姻被察觉，你们双双退圈私奔'
    },

    // === 独自美丽（优先级：7） ===
    {
      id: 'solo-beauty',
      name: '独美人生',
      icon: '🏃',
      category: 'solo',
      priority: PRIORITY_SOLO,
      checkGroup: 'solo',
      desc: '谁也没选，专注自己，活出了精彩的人生'
    },
    {
      id: 'return-to-normal',
      name: '归隐田园',
      icon: '🌿',
      category: 'solo',
      priority: PRIORITY_SOLO,
      checkGroup: 'solo',
      desc: '离开了娱乐圈的喧嚣，回归普通而平静的生活'
    }
  ];

  // ===== 结局条件检测 =====

  /**
   * 主入口：按优先级检测所有结局条件
   * @returns {Object|null} 触发的结局定义，或null
   */
  function checkEndings() {
    // 如果已触发过结局，不再检测
    if (Game.state.endingTriggered) return null;

    // 按优先级分组检测
    var groups = ['exposure', 'breakup', 'marriage', 'cheating', 'career', 'unexpected', 'solo'];
    for (var g = 0; g < groups.length; g++) {
      var checkFn = '_checkGroup_' + groups[g];
      if (typeof _groupCheckers[checkFn] === 'function') {
        var result = _groupCheckers[checkFn]();
        if (result) {
          _triggerEnding(result);
          return result;
        }
      }
    }

    return null;
  }

  /**
   * 分组检测函数映射表
   */
  var _groupCheckers = {};

  /**
   * 曝光类结局检测（8, 9, 10）
   */
  _groupCheckers._checkGroup_exposure = function() {
    var state = Game.state;
    var player = state.player;
    var partner = Game.State.getExclusivePartner();
    var susp = player.stats.suspicion || 0;
    var followers = player.social ? player.social.followers : 0;

    // 结局8：被迫公开 — susp ≥ 90 + 有恋人
    if (susp >= 90 && partner.idolIndex !== null) {
      return getEndingById('forced-public');
    }

    // 结局9：公司拆散 — 3+次经纪人介入 + susp ≥ 70 + 有恋人
    var interventionCount = _countManagerInterventions();
    if (interventionCount >= 3 && susp >= 70 && partner.idolIndex !== null) {
      return getEndingById('company-split');
    }

    // 结局10：粉丝抵制 — susp ≥ 80 + followers ≤ 1000 + 有恋人
    if (susp >= 80 && followers <= 1000 && partner.idolIndex !== null) {
      return getEndingById('fan-boycott');
    }

    return null;
  };

  /**
   * 分手/离婚类结局检测（3, 4, 5）
   */
  _groupCheckers._checkGroup_breakup = function() {
    var state = Game.state;

    // 结局3/4：由relationship.js的triggerBreakup标记
    if (state._pendingEnding) {
      var endingId = state._pendingEnding;
      state._pendingEnding = null; // 清除标记
      return getEndingById(endingId);
    }

    // 结局5：压力崩溃 — stress ≥ 90 + 有恋人 → 自动分手
    var stress = (state.player && state.player.stats) ? state.player.stats.stress : 0;
    var partner = Game.State.getExclusivePartner();
    if (stress >= 90 && partner.idolIndex !== null) {
      // 触发自动分手
      if (Game.Relationship && Game.Relationship.triggerBreakup) {
        Game.Relationship.triggerBreakup(partner.idolIndex, 'stress');
      }
      return getEndingById('stress-breakdown');
    }

    return null;
  };

  /**
   * 结婚类结局检测（1, 2）
   */
  _groupCheckers._checkGroup_marriage = function() {
    var state = Game.state;

    // 检查是否已婚
    if (state.marriedIdolId === null && state.marriedIdolId === undefined) return null;
    var marriedIdolIndex = state.marriedIdolId;
    if (marriedIdolIndex === null || marriedIdolIndex === undefined) return null;
    var idol = state.idols[marriedIdolIndex];
    if (!idol) return null;
    if (idol.relationshipStage !== 'married') return null;

    // 结局1 or 2
    if (state.marriageType === 'public') {
      return getEndingById('sweet-wedding');
    } else if (state.marriageType === 'secret') {
      return getEndingById('secret-marriage');
    }

    return null;
  };

  /**
   * 修罗场类结局检测（11, 12）
   */
  _groupCheckers._checkGroup_cheating = function() {
    var state = Game.state;
    var idols = state.idols || [];
    var eventLog = state.eventLog || [];

    // 统计总共和几个爱豆交往过（含已分手的）
    var datedIdolIndices = {};
    for (var i = 0; i < idols.length; i++) {
      // 检查爱豆是否曾经达到过dating阶段（通过eventLog回溯）
      for (var j = 0; j < eventLog.length; j++) {
        if (eventLog[j].type === 'confession-accepted' && eventLog[j].idolIndex === i) {
          datedIdolIndices[i] = true;
          break;
        }
      }
      // 当前正在dating或married也算
      if (idols[i].relationshipStage === 'dating' || idols[i].relationshipStage === 'married') {
        datedIdolIndices[i] = true;
      }
    }
    var datedCount = Object.keys(datedIdolIndices).length;

    // 统计出轨被发现的次数
    var caughtCount = 0;
    for (var k = 0; k < eventLog.length; k++) {
      if (eventLog[k].type === 'cheating-discovered') {
        caughtCount++;
      }
    }

    var currentTurn = state.currentTurn || 0;

    // 结局11：完美犯罪 — 交往≥3人 + 从未被发现 + turn ≥ 36
    if (datedCount >= 3 && caughtCount === 0 && currentTurn >= 36) {
      return getEndingById('perfect-crime');
    }

    // 结局12：身败名裂 — 出轨被发现≥2次
    if (caughtCount >= 2) {
      return getEndingById('ruined-reputation');
    }

    return null;
  };

  /**
   * 事业巅峰类结局检测（6, 7）
   */
  _groupCheckers._checkGroup_career = function() {
    var state = Game.state;
    var player = state.player;
    var followers = player.social ? player.social.followers : 0;
    var charm = player.stats.charm || 0;
    var stress = player.stats.stress || 0;
    var currentTurn = state.currentTurn || 0;

    // 结局6：人生赢家 — 已婚 + followers ≥ 5000 + charm ≥ 80 + stress ≤ 40 + turn ≥ 24
    if (state.marriedIdolId !== null && state.marriedIdolId !== undefined &&
        followers >= 5000 && charm >= 80 && stress <= 40 && currentTurn >= 24) {
      return getEndingById('life-winner');
    }

    // 结局7：事业女王 — followers ≥ 10000 + 从未交往 + turn ≥ 36
    var hasDated = _hasEverDated();
    if (followers >= 10000 && !hasDated && currentTurn >= 36) {
      return getEndingById('career-queen');
    }

    return null;
  };

  /**
   * 意外结局检测（15）
   */
  _groupCheckers._checkGroup_unexpected = function() {
    var state = Game.state;
    var susp = state.player ? state.player.stats.suspicion : 0;

    // 结局15：私奔天涯 — 秘密结婚 + susp ≥ 85
    if (state.marriageType === 'secret' &&
        state.marriedIdolId !== null && state.marriedIdolId !== undefined &&
        susp >= 85) {
      return getEndingById('elopement');
    }

    return null;
  };

  /**
   * 独自美丽类结局检测（13, 14）
   */
  _groupCheckers._checkGroup_solo = function() {
    var state = Game.state;
    var player = state.player;
    var followers = player.social ? player.social.followers : 0;
    var stress = player.stats.stress || 0;
    var currentTurn = state.currentTurn || 0;
    var hasDated = _hasEverDated();

    // 结局13：独美人生 — turn ≥ 36 + 从未交往 + followers ≥ 2000
    if (currentTurn >= 36 && !hasDated && followers >= 2000) {
      return getEndingById('solo-beauty');
    }

    // 结局14：归隐田园 — stress ≥ 90 + followers ≤ 500 + turn ≥ 24 + 未结婚
    var isMarried = state.marriedIdolId !== null && state.marriedIdolId !== undefined;
    if (stress >= 90 && followers <= 500 && currentTurn >= 24 && !isMarried) {
      return getEndingById('return-to-normal');
    }

    return null;
  };

  // ===== 辅助检测函数 =====

  /**
   * 统计经纪人介入次数
   */
  function _countManagerInterventions() {
    var interventions = Game.state.managerInterventions || {};
    var count = 0;
    for (var key in interventions) {
      if (interventions.hasOwnProperty(key) && interventions[key]) {
        count++;
      }
    }
    return count;
  }

  /**
   * 是否曾经与任何人交往过
   */
  function _hasEverDated() {
    var idols = Game.state.idols || [];
    var eventLog = Game.state.eventLog || [];

    // 检查当前状态
    for (var i = 0; i < idols.length; i++) {
      if (idols[i].relationshipStage === 'dating' || idols[i].relationshipStage === 'married') {
        return true;
      }
    }

    // 通过事件日志检查历史交往（含已分手的）
    for (var j = 0; j < eventLog.length; j++) {
      if (eventLog[j].type === 'confession-accepted') {
        return true;
      }
    }

    return false;
  }

  // ===== 结局触发 =====

  /**
   * 触发结局：写入状态、日志、渲染画面
   * @param {Object} ending
   */
  function _triggerEnding(ending) {
    if (!ending) return;

    // 写入状态
    Game.state.endingTriggered = true;
    Game.state.endingId = ending.id;
    Game.state.endingTurn = Game.state.currentTurn || 0;
    Game.State.autoSave();

    // 写入事件日志
    var eventType = 'ending-' + ending.id;
    Game.State.addEventLog({
      type: eventType,
      endingId: ending.id,
      endingName: ending.name,
      label: '【结局】' + ending.name,
      summary: ending.desc,
      message: '🎬 游戏结束 — ' + ending.name + '：' + ending.desc
    });

    // 延迟渲染结局画面（让当前回合的UI先更新）
    setTimeout(function() {
      renderEndingScreen(ending);
    }, 300);

    Game.DEBUG && console.log('[Endings] 结局触发：' + ending.name + '（' + ending.id + '）');
  }

  // ===== 结局叙述文本生成 =====

  /**
   * 获取结局叙述文本（静态模板 + 动态插值）
   * @param {Object} ending
   * @returns {string}
   */
  function getEndingText(ending) {
    var state = Game.state;
    var player = state.player;
    var playerName = player ? player.name : '你';
    var currentTurn = state.currentTurn || 0;
    var year = Math.floor(currentTurn / 24) + 1;
    var followers = player && player.social ? player.social.followers : 0;
    var charm = player ? player.stats.charm : 0;
    var stress = player ? player.stats.stress : 0;

    // 获取伴侣信息
    var partnerName = '';
    var partnerGroup = '';
    var partnerGender = 'male';
    var partnerIndex = state.marriedIdolId !== null && state.marriedIdolId !== undefined
      ? state.marriedIdolId
      : state.datingIdolId;
    if (partnerIndex !== null && partnerIndex !== undefined && state.idols[partnerIndex]) {
      var partner = state.idols[partnerIndex];
      partnerName = partner.nickname || partner.name;
      partnerGroup = partner.group || '未知团体';
      partnerGender = partner.gender || 'male';
    }
    var pronoun = partnerGender === 'female' ? '她' : '他';
    var honorific = partnerGender === 'female' ? '姐姐' : '欧巴';

    // 各结局的叙述模板
    var templates = {};

    // 💒 甜蜜婚礼
    templates['sweet-wedding'] =
      '第' + year + '年，你与' + partnerName + '的婚礼在首尔最豪华的酒店举行。\n\n' +
      '媒体闪光灯此起彼伏，粉丝们在会场外举着应援牌。' + partnerName + '穿着礼服站在你面前，' + pronoun + '的眼中有泪光闪烁。\n\n' +
      '"感谢你一直以来的陪伴。"' + pronoun + '轻声说，"从今天起，我不只是爱豆，更是' + honorific + '的伴侣。"\n\n' +
      '你们的婚讯登上了热搜第一。有人说这是童话成真，有人说不看好。但那都不重要——重要的是，你们选择了在阳光下牵手。\n\n' +
      '粉丝数：' + followers.toLocaleString() + ' | 魅力值：' + charm + ' | 游玩回合：' + currentTurn + '\n\n' +
      '🎬 这就是属于你们的甜蜜婚礼结局。';

    // 🤫 秘密婚姻
    templates['secret-marriage'] =
      '没有盛大的婚礼，没有媒体的闪光灯。\n\n' +
      '你和' + partnerName + '在只有两个人的地方交换了戒指。' + pronoun + '说："这样就够了。只要我们心里有彼此。"\n\n' +
      '秘密婚姻意味着在公开场合你们依然是"爱豆与粉丝"。但在私下，' + pronoun + '会在只有你听得到的距离里，轻声叫你"亲爱的"。\n\n' +
      '这份秘密，是你们共同的宝藏。虽然有时候会想，如果能大声说出来该多好——但想到这是为了保护彼此，一切都值得了。\n\n' +
      '粉丝数：' + followers.toLocaleString() + ' | 魅力值：' + charm + ' | 游玩回合：' + currentTurn + '\n\n' +
      '🎬 秘密，有时是最深情的告白。';

    // 💔 出轨败露
    templates['cheating-exposed'] =
      partnerName + '看着手机里的照片，' + pronoun + '的手在发抖。\n\n' +
      '"我那么信任你..."' + pronoun + '的声音很平静，平静得让人害怕。\n\n' +
      '那是一条粉丝发来的爆料——你与另一个爱豆的亲密照片。' + pronoun + '没有给你解释的机会，因为已经没有解释的必要了。\n\n' +
      '"我们到此为止吧。"' + pronoun + '转身离开，留下了这句话。\n\n' +
      '在那一刻你突然明白，有些伤害一旦造成，就再也无法挽回。不是因为不够爱，而是因为信任碎了。\n\n' +
      '压力值：' + stress + ' | 游玩回合：' + currentTurn + '\n\n' +
      '🎬 不是所有故事都有完美结局。有些结局，是成长。';

    // 💍 婚姻破裂
    templates['marriage-breakdown'] =
      '婚后的生活本应是新的开始。但当你以为"结了婚就安全了"的时候，一切已经开始崩塌。\n\n' +
      partnerName + '摘下戒指，放在桌上。"我没想到我们会走到这一步。"\n\n' +
      '婚姻没有让出轨的伤害变小——相反，它让背叛更加沉重。那些誓言，那些承诺，在真相面前变得苍白无力。\n\n' +
      '媒体报道铺天盖地。"爱豆' + partnerName + '离婚"的词条在热搜上挂了整整一周。粉丝们分成了两派，争吵不休。\n\n' +
      '但你最在意的，是' + pronoun + '离开时没有回头。\n\n' +
      '压力值：' + stress + ' | 游玩回合：' + currentTurn + '\n\n' +
      '🎬 婚姻是承诺，而承诺需要两个人一起守护。';

    // 😰 压力崩溃
    templates['stress-breakdown'] =
      '你看着镜子里的自己，觉得好累。\n\n' +
      '不是不爱了。只是每一天都像走在钢丝上——要躲避狗仔队、要应付经纪公司、要维持表面上的"偶像与粉丝"关系。\n\n' +
      partnerName + '看着你，' + pronoun + '也累了。\n\n' +
      '"我们...要不要停下来？"' + pronoun + '说，声音里满是疲惫。\n\n' +
      '你们没有吵架，没有第三者。只是Kpop行业的巨大压力，把你们的感情一点一点碾碎了。\n\n' +
      '分手那天，你们反而都松了一口气。不是因为不爱，而是因为太累了。\n\n' +
      '压力值：' + stress + ' | 游玩回合：' + currentTurn + '\n\n' +
      '🎬 有些感情不是败给了不爱，而是败给了现实。';

    // 🌟 人生赢家
    templates['life-winner'] =
      '你站在颁奖典礼的舞台上，手中捧着年度最佳制作人的奖杯。' + partnerName + '在台下微笑着为你鼓掌。\n\n' +
      '回想起来，这一路真的太不容易。从默默无闻的粉丝到行业顶尖的制作人，从暗恋到光明正大的婚姻——你几乎实现了所有梦想。\n\n' +
      '颁奖礼结束后，' + partnerName + '在后台抱住了你。"我就知道你做得到。"\n\n' +
      '你有成功的事业，有深爱的伴侣，有忠实的粉丝。你不需要证明什么了——因为你已经是人生的赢家。\n\n' +
      '粉丝数：' + followers.toLocaleString() + ' | 魅力值：' + charm + ' | 压力值：' + stress + ' | 游玩回合：' + currentTurn + '\n\n' +
      '🎬 最好的结局，是事业与爱情都握在手中。';

    // 💼 事业女王
    templates['career-queen'] =
      '你选择了一个人走这条路。\n\n' +
      '没有恋情的分心，没有约会的时间成本。你把所有的精力都投入到事业中——学制作、经营SNS、出席活动、建立人脉。\n\n' +
      '现在的你，已经不再是谁的"粉丝"。你是行业里公认的顶级制作人，' + followers.toLocaleString() + '粉丝追随你的每一个动态。\n\n' +
      '偶尔被问到感情状态，你只是笑笑："我嫁给了事业。"\n\n' +
      '这不是孤独——这是选择。是你自己选择了成为女王。\n\n' +
      '粉丝数：' + followers.toLocaleString() + ' | 魅力值：' + charm + ' | 游玩回合：' + currentTurn + '\n\n' +
      '🎬 谁说必须有爱情才算完整？你就是自己人生的主角。';

    // 🔥 被迫公开
    templates['forced-public'] =
      'D社的那篇报道，像一颗炸弹。\n\n' +
      '你与' + partnerName + '的约会照被刊登在头版。"独家：顶流爱豆的秘密恋情"。\n\n' +
      '经纪公司紧急召开会议。' + partnerName + '被叫去谈了整整两天。粉丝们在网上发起了请愿——有人祝福，有人抵制。\n\n' +
      '"对不起，我们只能公开了。"' + pronoun + '打电话给你，声音沙哑。\n\n' +
      '公开来得猝不及防。你们的关系不再是秘密，但代价是——所有的隐私都变成了公共话题。每次约会都有人跟拍，每句话都被放大解读。\n\n' +
      '嫌疑度：' + (Game.state.player ? Game.state.player.stats.suspicion : '??') + ' | 游玩回合：' + currentTurn + '\n\n' +
      '🎬 曝光不是结束，但从此一切都变了。';

    // 🏢 公司拆散
    templates['company-split'] =
      '经纪公司的会议室里，社长看着你们，叹了一口气。\n\n' +
      '"我理解你们的感情。但我必须为团队和公司负责。"\n\n' +
      '这已经是第三次被叫来谈话了。禁爱令、限制接触、调离工作安排——公司用尽了所有方式试图拆散你们。这一次，是最后通牒。\n\n' +
      partnerName + '低着头，' + pronoun + '知道如果选择你，可能意味着放弃多年的练习和出道机会。而你，也不想成为' + pronoun + '的绊脚石。\n\n' +
      '"我们...先分开一段时间吧。"这大概是你们说过的最痛的一句话。\n\n' +
      '游玩回合：' + currentTurn + '\n\n' +
      '🎬 Kpop行业的残忍之处在于——爱情，有时候是被规则杀死的。';

    // 📢 粉丝抵制
    templates['fan-boycott'] =
      '当你的个人信息被扒出来后，粉丝的反应比想象中更激烈。\n\n' +
      '"她不配！""请' + partnerName + '擦亮眼睛！""抵制到底！"\n\n' +
      '' + partnerName + '的社交账号评论区沦陷了。粉丝们联合发起了"保护' + partnerName + '"的请愿。你的SNS账号被举报到封禁。\n\n' +
      '' + pronoun + '尝试在直播中解释，但弹幕刷屏太快，没有人想听解释。\n\n' +
      '"也许我们真的不适合公开在一起。"' + pronoun + '在电话里沉默了很长时间。粉丝的爱，有时候比什么都残酷。\n\n' +
      '粉丝数：' + followers.toLocaleString() + ' | 游玩回合：' + currentTurn + '\n\n' +
      '🎬 当全世界都在反对，坚持变成了一种奢侈。';

    // 😈 完美犯罪
    templates['perfect-crime'] =
      '没有人发现。\n\n' +
      '你周旋于几个爱豆之间，在每个关系中游刃有余。你学会了分辨谁在什么时间有空，学会了如何在SNS上发布模糊的动态，学会了在危险边缘精准地跳舞。\n\n' +
      '有些人说你"渣"，但你也付出了你的感情——只不过是给了不同的人。\n\n' +
      '没有狗仔拍到证据，没有粉丝扒出蛛丝马迹，没有经纪人起过疑心。你像一个完美的魔术师，让一切都消失在了时间里。\n\n' +
      '现在，一切都结束了。没有人知道。\n\n' +
      '游玩回合：' + currentTurn + '\n\n' +
      '🎬 你全身而退。但这真的是你想要的结局吗？';

    // 📰 身败名裂
    templates['ruined-reputation'] =
      '当第二条出轨新闻被爆出时，整个Kpop圈都炸了。\n\n' +
      '不是一条，而是多条。不同的人，不同的时间线，但都指向一个共同的名字——你。\n\n' +
      '热搜词条从#" + partnerName + "恋情"变成了"时间管理大师"。粉丝们愤怒地焚烧你的照片。曾经和你交往过的爱豆们，一个接一个地发声明切割。\n\n' +
      '你成了Kpop圈最大的丑闻。没有人再敢和你扯上关系。\n\n' +
      '身败名裂——这就是最彻底的坠落。\n\n' +
      '游玩回合：' + currentTurn + '\n\n' +
      '🎬 所有选择都有后果。有些后果，是你无法承受的。';

    // 🏃 独美人生
    templates['solo-beauty'] =
      '你从来没有选择过任何人。\n\n' +
      '不是因为没人追——而是因为你知道自己想要什么。你想要自由，想要不被定义的活法，想要成为不需要依附任何人的女性。\n\n' +
      '现在的你，有事业、有朋友、有' + followers.toLocaleString() + '粉丝。你可以独自旅行，可以深夜和朋友喝酒聊天，可以做任何想做的事而不需要向谁报备。\n\n' +
      '偶尔也有人问："你不孤独吗？"但孤独和独美，是完全不同的两件事。\n\n' +
      '你是完整的。不需要另一半来"完整"你。\n\n' +
      '粉丝数：' + followers.toLocaleString() + ' | 游玩回合：' + currentTurn + '\n\n' +
      '🎬 一个人，也可以是最好的结局。';

    // 🌿 归隐田园
    templates['return-to-normal'] =
      '你删掉了所有的社交账号。\n\n' +
      '不再更新动态，不再参加活动，不再出现在任何娱乐圈的场合。那些曾经让你兴奋的闪光灯和关注，现在只会让你感到疲惫。\n\n' +
      '你做了一份普通的工作，住在一个没人认识你的小镇上。每天早睡早起，周末去市场买菜。这种平凡的日常，反而让你觉得安心。\n\n' +
      '偶尔在电视上看到Kpop演出，你会想起那些日子。但你想的更多的是——还好，我做回了自己。\n\n' +
      '压力值：' + stress + ' | 游玩回合：' + currentTurn + '\n\n' +
      '🎬 离开，有时候反而是最勇敢的选择。';

    // ✈️ 私奔天涯
    templates['elopement'] =
      '当嫌疑度逼近临界点时，你们做了一个疯狂的决定。\n\n' +
      partnerName + '在凌晨三点敲响你的门。"我们走吧。"' + pronoun + '只带了一个小行李箱，眼睛红红的。\n\n' +
      '你们买了最早一班飞往海外的航班。目的地？不重要。重要的是两个人在一起，远离所有狗仔、经纪公司、和粉丝的视线。\n\n' +
      '飞机起飞的那一刻，' + pronoun + '靠在你肩上笑了。"你知道吗？这大概是我做过最疯狂的决定。"\n\n' +
      '' + partnerGroup + '很快宣布了' + partnerName + '的无限期休息。而你们，已经在世界某个角落的咖啡馆里，开始了新的生活。\n\n' +
      '游玩回合：' + currentTurn + '\n\n' +
      '🎬 有些爱情，需要私奔到天涯海角才能自由。';

    return templates[ending.id] || ('【' + ending.name + '】\n\n' +
      ending.desc + '\n\n' +
      '这是一个属于你的故事。每一个选择，每一次心动，都引领你走到了这里。\n\n' +
      '游玩回合：' + currentTurn + '\n\n' +
      '🎬 感谢游玩。');
  }

  // ===== 结局展示画面 =====

  /**
   * 渲染全屏结局展示画面
   * @param {Object} ending
   */
  function renderEndingScreen(ending) {
    var overlay = document.getElementById('ending-overlay');
    if (!overlay) {
      // 如果HTML还没添加，动态创建
      overlay = _createEndingOverlay();
    }

    // 填充内容
    var badge = document.getElementById('ending-badge');
    var title = document.getElementById('ending-title');
    var narrative = document.getElementById('ending-narrative');
    var stats = document.getElementById('ending-stats');

    if (badge) {
      badge.textContent = CATEGORY_LABELS[ending.category] || '结局';
      badge.className = 'ending-badge ' + (CATEGORY_BADGE_CLASS[ending.category] || 'ending-badge-marriage');
    }

    if (title) {
      title.textContent = ending.icon + ' ' + ending.name;
    }

    if (narrative) {
      narrative.textContent = getEndingText(ending);
    }

    if (stats) {
      stats.innerHTML = _buildStatsHTML();
    }

    // 显示覆盖层
    overlay.style.display = 'flex';
    // 触发淡入动画
    requestAnimationFrame(function() {
      overlay.style.opacity = '1';
      var screen = overlay.querySelector('.ending-screen');
      if (screen) {
        screen.style.transform = 'translateY(0)';
        screen.style.opacity = '1';
      }
    });

    // 隐藏底部导航（结局画面完全接管）
    var nav = document.querySelector('.bottom-nav');
    if (nav) nav.style.display = 'none';
  }

  /**
   * 动态创建结局覆盖层（兜底）
   */
  function _createEndingOverlay() {
    var overlay = document.createElement('div');
    overlay.id = 'ending-overlay';
    overlay.className = 'ending-overlay';
    overlay.innerHTML =
      '<div class="ending-screen">' +
        '<div class="ending-badge" id="ending-badge"></div>' +
        '<h1 class="ending-title" id="ending-title"></h1>' +
        '<div class="ending-divider"></div>' +
        '<div class="ending-narrative" id="ending-narrative"></div>' +
        '<div class="ending-stats" id="ending-stats"></div>' +
        '<div class="ending-actions">' +
          '<button class="btn btn-primary btn-block" id="ending-return-btn">🏠 返回标题画面</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    // 绑定按钮（等到模块初始化后）
    var btn = document.getElementById('ending-return-btn');
    if (btn) {
      btn.addEventListener('click', returnToTitle);
    }

    return overlay;
  }

  /**
   * 构建结局统计面板HTML
   */
  function _buildStatsHTML() {
    var state = Game.state;
    var player = state.player;
    var currentTurn = state.currentTurn || 0;
    var year = Math.floor(currentTurn / 24) + 1;
    var followers = player && player.social ? player.social.followers : 0;
    var charm = player ? player.stats.charm : 0;
    var stress = player ? player.stats.stress : 0;
    var suspicion = player ? player.stats.suspicion : 0;

    // 统计交往过的爱豆数
    var idols = state.idols || [];
    var datedCount = 0;
    var eventLog = state.eventLog || [];
    var datedMap = {};
    for (var i = 0; i < idols.length; i++) {
      if (idols[i].relationshipStage === 'dating' || idols[i].relationshipStage === 'married') {
        datedMap[i] = true;
      }
    }
    for (var j = 0; j < eventLog.length; j++) {
      if (eventLog[j].type === 'confession-accepted' && eventLog[j].idolIndex !== undefined) {
        datedMap[eventLog[j].idolIndex] = true;
      }
    }
    datedCount = Object.keys(datedMap).length;

    var partner = Game.State.getExclusivePartner();
    var relationshipLabel = '单身';
    if (state.marriedIdolId !== null && state.marriedIdolId !== undefined) {
      relationshipLabel = state.marriageType === 'public' ? '已婚（公开）' : '已婚（秘密）';
    } else if (partner && partner.idolIndex !== null) {
      relationshipLabel = '恋爱中';
    }

    return '<div class="ending-stat-grid">' +
      '<div class="ending-stat-item">' +
        '<div class="ending-stat-value">' + year + '年</div>' +
        '<div class="ending-stat-label">游戏时间</div>' +
      '</div>' +
      '<div class="ending-stat-item">' +
        '<div class="ending-stat-value">' + currentTurn + '</div>' +
        '<div class="ending-stat-label">总回合数</div>' +
      '</div>' +
      '<div class="ending-stat-item">' +
        '<div class="ending-stat-value">' + followers.toLocaleString() + '</div>' +
        '<div class="ending-stat-label">粉丝数</div>' +
      '</div>' +
      '<div class="ending-stat-item">' +
        '<div class="ending-stat-value">' + relationshipLabel + '</div>' +
        '<div class="ending-stat-label">最终感情状态</div>' +
      '</div>' +
      '<div class="ending-stat-item">' +
        '<div class="ending-stat-value">' + datedCount + '</div>' +
        '<div class="ending-stat-label">交往人数</div>' +
      '</div>' +
      '<div class="ending-stat-item">' +
        '<div class="ending-stat-value">' + (idols.length || 0) + '</div>' +
        '<div class="ending-stat-label">认识的爱豆</div>' +
      '</div>' +
      '<div class="ending-stat-item">' +
        '<div class="ending-stat-value">' + charm + '/' + stress + '/' + suspicion + '</div>' +
        '<div class="ending-stat-label">魅力/压力/嫌疑</div>' +
      '</div>' +
      '<div class="ending-stat-item">' +
        '<div class="ending-stat-value">' + (player ? player.name : '') + '</div>' +
        '<div class="ending-stat-label">玩家</div>' +
      '</div>' +
    '</div>';
  }

  // ===== 返回标题画面 =====

  /**
   * 从结局画面返回标题画面
   */
  function returnToTitle() {
    var overlay = document.getElementById('ending-overlay');
    if (overlay) {
      overlay.style.opacity = '0';
      setTimeout(function() {
        overlay.style.display = 'none';
      }, 300);
    }

    // 恢复底部导航
    var nav = document.querySelector('.bottom-nav');
    if (nav) nav.style.display = '';

    // 返回标题
    if (Game.returnToTitle) {
      Game.returnToTitle();
    }
  }

  // ===== 结局回顾（事件选项卡内） =====

  /**
   * 渲染结局回顾区域
   * 在事件选项卡中显示已触发的结局
   */
  function renderEndingsReview() {
    var container = document.getElementById('endings-review-section');
    if (!container) return;

    var state = Game.state;

    // 检查是否已触发结局
    if (!state.endingTriggered || !state.endingId) {
      container.innerHTML = '';
      container.style.display = 'none';
      return;
    }

    container.style.display = 'block';
    var ending = getEndingById(state.endingId);
    if (!ending) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML =
      '<div class="endings-review-card">' +
        '<div class="endings-review-header">' +
          '<span class="endings-review-icon">🎬</span>' +
          '<span class="endings-review-label">已达成结局</span>' +
        '</div>' +
        '<div class="endings-review-content">' +
          '<div class="endings-review-title">' + ending.icon + ' ' + ending.name + '</div>' +
          '<div class="endings-review-desc">' + ending.desc + '</div>' +
          '<div class="endings-review-meta">' +
            '触发于第 ' + (state.endingTurn || 0) + ' 回合 · ' +
            (CATEGORY_LABELS[ending.category] || '') +
          '</div>' +
          '<button class="btn btn-sm btn-secondary endings-review-replay-btn" ' +
            'onclick="Game.Endings.renderEndingScreen(Game.Endings.getEndingById(\'' + ending.id + '\'))">' +
            '📖 重新回顾结局' +
          '</button>' +
        '</div>' +
      '</div>';
  }

  // ===== 工具函数 =====

  /**
   * 根据ID获取结局定义
   * @param {string} id
   * @returns {Object|undefined}
   */
  function getEndingById(id) {
    for (var i = 0; i < ENDINGS.length; i++) {
      if (ENDINGS[i].id === id) return ENDINGS[i];
    }
    return undefined;
  }

  /**
   * 检查游戏是否已触发结局
   * @returns {boolean}
   */
  function hasEndingTriggered() {
    return !!(Game.state.endingTriggered);
  }

  /**
   * 获取所有结局定义（供事件选项卡筛选使用）
   * @returns {Array}
   */
  function getAllEndings() {
    return ENDINGS;
  }

  // ===== 初始化 =====

  function init() {
    // 监听页面切换，刷新结局回顾
    document.addEventListener('pageChanged', function(e) {
      if (e.detail && e.detail.page === 'events') {
        // 延迟渲染，等待events.js先完成
        setTimeout(function() {
          // 确保结局回顾容器存在
          _ensureReviewContainer();
          renderEndingsReview();
        }, 100);
      }
    });

    // 绑定返回按钮（HTML已渲染的情况）
    var btn = document.getElementById('ending-return-btn');
    if (btn) {
      btn.addEventListener('click', returnToTitle);
    }

    // 页面加载时如果有已触发的结局，直接显示结局画面
    if (Game.state.endingTriggered && Game.state.endingId) {
      var ending = getEndingById(Game.state.endingId);
      if (ending) {
        setTimeout(function() {
          renderEndingScreen(ending);
        }, 500);
      }
    }

    Game.DEBUG && console.log('[Endings] 结局系统就绪（15个结局）');
  }

  /**
   * 确保结局回顾容器存在于事件页面中
   */
  function _ensureReviewContainer() {
    var eventsContent = document.getElementById('events-content');
    if (!eventsContent) return;

    var container = document.getElementById('endings-review-section');
    if (!container) {
      container = document.createElement('div');
      container.id = 'endings-review-section';
      container.className = 'endings-review-section';
      eventsContent.appendChild(container);
    }
  }

  // ===== 公开API =====
  return {
    checkEndings,
    getEndingById,
    getAllEndings,
    hasEndingTriggered,
    getEndingText,
    renderEndingScreen,
    renderEndingsReview,
    returnToTitle,
    init
  };

})();
