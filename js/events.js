/**
 * 事件系统完整版 — 日历、固定事件、数值门槛事件、突发新闻、事件日志UI
 * 阶段9核心模块
 * 依赖：Game.State（状态管理）、Game.Reality（Toast复用）
 */

Game.Events = (() => {

  // ===== 常量 =====

  /** 月份标签 */
  var MONTH_LABELS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

  /** 季节标签 */
  var SEASON_LABELS = ['❄️冬','🌸春','🌞夏','🍂秋'];

  /** 半月标签 */
  var HALF_LABELS = ['上半月', '下半月'];

  /** 事件类型 → 分类映射 */
  var TYPE_CATEGORY = {
    'birthday': 'fixed',
    'comeback-start': 'fixed',
    'comeback-end': 'fixed',
    'award-ceremony': 'fixed',
    'anniversary': 'fixed',
    'new-idol': 'random',
    'breaking-news': 'random',
    'famous-scene': 'random',
    'couple-item': 'random',
    'sick-visit': 'random',
    'location-sharing': 'random',
    'aff-50': 'threshold',
    'aff-80': 'threshold',
    'susp-60': 'threshold',
    'susp-90': 'threshold',
    'stress-70': 'threshold',
    'stress-90': 'threshold',
    'confession-accepted': 'stage',
    'confession-rejected': 'stage',
    'proposal-accepted': 'stage',
    'proposal-rejected': 'stage',
    'cheating-start': 'stage',
    'cheating-action': 'stage',
    'cheating-discovered': 'stage',
    'breakup': 'stage',
    'divorce': 'stage',
    'checkin': 'reality',
    'company-checkin': 'reality',
    'media': 'reality',
    'unreplied-penalty': 'negative',
    'manager-intervention': 'negative',
    'manager-crisis': 'negative'
  };

  /** 分类显示名 */
  var CATEGORY_NAMES = {
    'fixed': '固定事件',
    'random': '随机事件',
    'threshold': '门槛事件',
    'stage': '关系阶段',
    'reality': '现实元素',
    'negative': '负面事件'
  };

  /** 分类颜色条class */
  var CATEGORY_BAR_CLASS = {
    'fixed': 'event-card-bar-fixed',
    'random': 'event-card-bar-random',
    'threshold': 'event-card-bar-threshold',
    'stage': 'event-card-bar-stage',
    'reality': 'event-card-bar-reality',
    'negative': 'event-card-bar-negative'
  };

  /** 事件类型 → 显示图标 */
  var TYPE_ICONS = {
    'birthday': '🎂',
    'comeback-start': '🎤',
    'comeback-end': '✅',
    'award-ceremony': '🏆',
    'anniversary': '💝',
    'new-idol': '✨',
    'breaking-news': '📰',
    'famous-scene': '🍊',
    'couple-item': '👕',
    'sick-visit': '🏥',
    'location-sharing': '📍',
    'aff-50': '💕',
    'aff-80': '💗',
    'susp-60': '⚠️',
    'susp-90': '🚨',
    'stress-70': '😰',
    'stress-90': '💔',
    'confession-accepted': '💘',
    'confession-rejected': '💔',
    'proposal-accepted': '💍',
    'proposal-rejected': '😢',
    'cheating-start': '🌪️',
    'cheating-action': '🕵️',
    'cheating-discovered': '💥',
    'breakup': '🔚',
    'divorce': '📄',
    'checkin': '📞',
    'company-checkin': '🏢',
    'media': '📸',
    'unreplied-penalty': '📵',
    'manager-intervention': '👔',
    'manager-crisis': '🔴'
  };

  /** 事件类型 → 显示标题 */
  var TYPE_TITLES = {
    'birthday': '爱豆生日',
    'comeback-start': '回归期开始',
    'comeback-end': '回归期结束',
    'award-ceremony': '颁奖典礼',
    'anniversary': '纪念日',
    'new-idol': '邂逅新爱豆',
    'breaking-news': '突发新闻',
    'famous-scene': 'Kpop名场面',
    'couple-item': '同款物品',
    'sick-visit': '生病探望',
    'location-sharing': '定位共享',
    'aff-50': '心动信号',
    'aff-80': '深度羁绊',
    'susp-60': '公司警告',
    'susp-90': '濒临曝光',
    'stress-70': '身心俱疲',
    'stress-90': '崩溃边缘',
    'confession-accepted': '告白成功',
    'confession-rejected': '告白被拒',
    'proposal-accepted': '求婚成功',
    'proposal-rejected': '求婚被拒',
    'cheating-start': '出轨风险',
    'cheating-action': '暧昧互动',
    'cheating-discovered': '出轨暴露',
    'breakup': '分手',
    'divorce': '离婚',
    'checkin': '爱豆查岗',
    'company-checkin': '公司查岗',
    'media': '媒体事件',
    'unreplied-penalty': '未回消息',
    'manager-intervention': '经纪人介入',
    'manager-crisis': '经纪人危机'
  };

  /** 突发新闻事件池 */
  var BREAKING_NEWS = [
    { id: 'rival-scandal', icon: '📰', title: '对家团恋爱曝光',
      body: '另一个偶像团体成员被曝出恋爱传闻。粉丝圈陷入混乱，但对你的关注度暂时降低了。',
      effects: { suspicion: [-5, -2] }, category: 'scandal' },
    { id: 'new-group-debut', icon: '🎤', title: '新人团体出道',
      body: '又一支新人团体宣布出道。饭圈注意力被分散，对你的关注度略有下降。',
      effects: { suspicion: [-3, 0] }, category: 'industry' },
    { id: 'military-notice', icon: '🪖', title: '入伍公告',
      body: '有同代男团成员宣布即将入伍。粉丝们开始讨论兵役对爱豆事业的影响。',
      effects: null, category: 'military' },
    { id: 'award-nominee', icon: '🏆', title: '颁奖礼提名公布',
      body: '年度音乐大赏提名名单公布。你关注的团体榜上有名，粉丝们正在疯狂投票。',
      effects: { followers: [5, 20] }, category: 'award' },
    { id: 'company-merger', icon: '🏢', title: '经纪公司合并',
      body: '两大娱乐公司宣布合并。业界震动，艺人合约面临重新谈判。',
      effects: null, category: 'industry' },
    { id: 'world-tour', icon: '🌍', title: '世界巡演宣布',
      body: '人气团体宣布世界巡演计划，将在12个国家举办演唱会。粉丝们已经开始抢票。',
      effects: { followers: [5, 15] }, category: 'industry' },
    { id: 'chart-record', icon: '📊', title: '音源新纪录',
      body: '最新回归曲在各大音源榜上刷新纪录。粉丝们在社交媒体上疯狂庆祝。',
      effects: { followers: [5, 20] }, category: 'industry' },
    { id: 'dating-rumor', icon: '💬', title: '恋爱传闻四起',
      body: '有网友扒出某爱豆的"恋爱证据"。虽然指向的是别人，但整个饭圈都提高了警惕。',
      effects: { suspicion: [2, 5] }, category: 'scandal' },
    { id: 'plastic-surgery', icon: '🏥', title: '整容争议',
      body: '网友热议某爱豆外貌变化。整容与否的争论在各大论坛刷屏。',
      effects: null, category: 'scandal' },
    { id: 'lip-sync', icon: '🎵', title: '假唱风波',
      body: '音乐节目中被质疑假唱。粉丝和黑粉在网络上激烈交锋。',
      effects: null, category: 'scandal' },
    { id: 'military-return', icon: '🎉', title: '退伍回归',
      body: '服役期满的爱豆正式退伍。粉丝们翘首以盼的回归即将到来。',
      effects: { followers: [5, 10] }, category: 'military' },
    { id: 'rookie-award', icon: '🌟', title: '新人奖揭晓',
      body: '年度新人奖揭晓，新一代爱豆崭露头角。饭圈格局正在悄然变化。',
      effects: { followers: [10, 20] }, category: 'award' },
    { id: 'daesang', icon: '👑', title: '大赏得主',
      body: '年度大赏结果出炉！获奖感言感动全场，粉丝们纷纷转发。',
      effects: { followers: [20, 50] }, category: 'award' },
    { id: 'variety-guest', icon: '📺', title: '综艺出演',
      body: '人气爱豆将在热门综艺中担任特别嘉宾。预告片已经引发热议。',
      effects: { followers: [10, 20] }, category: 'variety' },
    { id: 'reality-show', icon: '🎬', title: '团综上新',
      body: '团体自制综艺更新了新一季。粉丝们正在逐帧分析每个细节。',
      effects: { followers: [5, 15] }, category: 'variety' }
  ];

  // ===== 内部状态 =====

  /** 当前事件tab的筛选条件 */
  var _currentFilter = 'all';
  var _currentIdolFilter = -1; // -1 = 全部爱豆

  // ===== 日历系统 =====

  /**
   * 根据回合数推导日历信息
   * 1回合 = 半个月，24回合 = 1年
   * @param {number} turn - 回合数
   * @returns {{ year: number, month: number, half: number, season: number }}
   */
  function getCalendar(turn) {
    var t = turn || Game.state.currentTurn || 0;
    if (t === 0) {
      return { year: 1, month: 1, half: 1, season: 4 };
    }
    var year = Math.floor((t - 1) / 24) + 1;
    var month = Math.floor(((t - 1) % 24) / 2) + 1;
    var half = ((t - 1) % 2 === 0) ? 1 : 2;
    var season = Math.floor((month - 1) / 3) + 1;
    return { year: year, month: month, half: half, season: season };
  }

  /**
   * 格式化日期为显示字符串
   * @param {number} turn
   * @returns {string}
   */
  function formatDate(turn) {
    var cal = getCalendar(turn);
    return '第' + cal.year + '年' + MONTH_LABELS[cal.month - 1] + HALF_LABELS[cal.half - 1] + ' · ' + SEASON_LABELS[cal.season - 1];
  }

  /**
   * 获取当前游戏日历
   * @returns {{ year: number, month: number, half: number, season: number }}
   */
  function getCurrentCalendar() {
    return getCalendar(Game.state.currentTurn);
  }

  // ===== 工具函数 =====

  /**
   * 在[min, max]范围内取随机整数
   */
  function randInRange(range) {
    if (!range || !Array.isArray(range) || range.length < 2) return 0;
    return Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0];
  }

  // ===== 固定事件：爱豆生日 =====

  /**
   * 检查是否有爱豆今天过生日
   */
  function checkBirthdays() {
    var cal = getCalendar(Game.state.currentTurn);
    var idols = Game.state.idols || [];
    var triggered = false;

    for (var i = 0; i < idols.length; i++) {
      var idol = idols[i];
      if (idol.birthMonth === cal.month && idol.birthHalf === cal.half) {
        // 检查今年是否已触发
        var flagKey = 'birthday-' + i + '-y' + cal.year;
        if (Game.State.hasEventFlag(flagKey)) continue;

        // 设置去重标记
        Game.State.setEventFlag(flagKey);

        // 记录事件日志
        Game.State.addEventLog({
          type: 'birthday',
          idolIndex: i,
          idolName: idol.nickname || idol.name,
          summary: '今天是' + (idol.nickname || idol.name) + '的生日！',
          birthMonth: cal.month,
          birthHalf: cal.half
        });

        // 显示生日弹窗
        showBirthdayModal(i, idol);
        triggered = true;
        break; // 每回合最多一个生日事件
      }
    }
    return triggered;
  }

  /**
   * 显示生日弹窗
   */
  function showBirthdayModal(idolIndex, idol) {
    var modal = document.getElementById('media-event-modal');
    if (!modal) return;

    var idolName = idol.nickname || idol.name;

    // 更新弹窗内容
    var titleEl = modal.querySelector('.media-event-title');
    var bodyEl = modal.querySelector('.media-event-body');
    var actionsEl = modal.querySelector('.media-event-actions');

    if (titleEl) titleEl.textContent = '🎂 爱豆生日';
    if (bodyEl) {
      bodyEl.innerHTML = '<div class="media-event-scene">' +
        '<p>今天是 <strong>' + escapeHtml(idolName) + '</strong> 的生日！</p>' +
        '<p>在' + MONTH_LABELS[idol.birthMonth - 1] + HALF_LABELS[idol.birthHalf - 1] + '这个特别的日子里，你要不要送点什么呢？</p>' +
        '</div>';
    }
    if (actionsEl) {
      actionsEl.innerHTML = '<button class="btn media-option-safe" id="birthday-gift-btn">🎁 送礼物（-10体力, +3~8好感）</button>' +
        '<button class="btn media-option-risk" id="birthday-skip-btn">💬 发祝福就好</button>';
    }

    modal.style.display = 'flex';

    // 绑定事件
    var giftBtn = document.getElementById('birthday-gift-btn');
    var skipBtn = document.getElementById('birthday-skip-btn');

    var cleanup = function() {
      if (giftBtn) giftBtn.removeEventListener('click', onGift);
      if (skipBtn) skipBtn.removeEventListener('click', onSkip);
    };

    var onGift = function() {
      cleanup();
      modal.style.display = 'none';
      Game.State.addStamina(-10);
      var affDelta = Math.floor(Math.random() * 6) + 3; // 3-8
      Game.State.addAffection(idolIndex, affDelta);
      if (Game.Reality) {
        Game.Reality.showToast('🎁 生日礼物', '送了精心准备的礼物给' + idolName + '，ta很开心！好感度+' + affDelta, '🎂', null, 4000);
      }
    };

    var onSkip = function() {
      cleanup();
      modal.style.display = 'none';
      if (Game.Reality) {
        Game.Reality.showToast('💬 生日祝福', '给' + idolName + '发了生日祝福。ta回了感谢消息。', '🎂', null, 3000);
      }
    };

    if (giftBtn) giftBtn.addEventListener('click', onGift);
    if (skipBtn) skipBtn.addEventListener('click', onSkip);
  }

  // ===== 固定事件：回归期 =====

  /**
   * 检查是否需要触发新的回归期
   */
  function checkComebacks() {
    var idols = Game.state.idols || [];
    if (idols.length === 0) return false;

    // 清理过期的回归期
    var activeComebacks = Game.State.getActiveComebacks();
    var currentTurn = Game.state.currentTurn;

    // 检查是否有回归期刚好结束
    var comebacks = Game.state.comebacks || [];
    for (var i = comebacks.length - 1; i >= 0; i--) {
      if (comebacks[i].endTurn === currentTurn) {
        var endedIdol = idols[comebacks[i].idolIndex];
        if (endedIdol) {
          Game.State.addEventLog({
            type: 'comeback-end',
            idolIndex: comebacks[i].idolIndex,
            idolName: endedIdol.nickname || endedIdol.name,
            summary: (endedIdol.nickname || endedIdol.name) + '的回归期结束了。'
          });
          if (Game.Reality) {
            Game.Reality.showToast('🎤 回归期结束', (endedIdol.nickname || endedIdol.name) + '的回归活动告一段落。', '✅', null, 4000);
          }
        }
      }
    }

    // 清理已结束的回归期
    Game.state.comebacks = (Game.state.comebacks || []).filter(function(cb) {
      return cb.endTurn > currentTurn;
    });

    // 每6-8回合有概率触发新回归期
    if (Math.random() * 100 >= 35) return false; // 35%基础概率

    // 随机选一个不在回归期且冷却已过的爱豆
    var nowActive = Game.State.getActiveComebacks();
    var activeIndices = {};
    for (var a = 0; a < nowActive.length; a++) {
      activeIndices[nowActive[a].idolIndex] = true;
    }

    var candidates = [];
    for (var j = 0; j < idols.length; j++) {
      if (activeIndices[j]) continue;
      // 检查冷却
      var cooldownKey = 'comeback-cooldown-' + j;
      var cooldownUntil = Game.State.hasEventFlag(cooldownKey) ? Game.state.eventFlags[cooldownKey] : 0;
      if (currentTurn < cooldownUntil) continue;
      candidates.push(j);
    }

    if (candidates.length === 0) return false;

    var chosenIdx = candidates[Math.floor(Math.random() * candidates.length)];
    var chosenIdol = idols[chosenIdx];
    var duration = 2; // 2回合回归期

    Game.State.addComeback(chosenIdx, currentTurn, currentTurn + duration);

    // 设置冷却（结束后再等10回合才能再次回归）
    Game.State.setEventFlag('comeback-cooldown-' + chosenIdx, currentTurn + duration + 10);

    Game.State.addEventLog({
      type: 'comeback-start',
      idolIndex: chosenIdx,
      idolName: chosenIdol.nickname || chosenIdol.name,
      summary: (chosenIdol.nickname || chosenIdol.name) + '进入了回归期！',
      startTurn: currentTurn,
      endTurn: currentTurn + duration
    });

    if (Game.Reality) {
      Game.Reality.showToast('🎤 回归期开始！',
        (chosenIdol.nickname || chosenIdol.name) + '进入了' + duration + '回合的回归期。这段时间ta很忙，但也更容易在活动中遇到。',
        '🎵', null, 5000);
    }

    return true;
  }

  // ===== 固定事件：颁奖礼 =====

  /**
   * 检查当前回合是否为颁奖礼回合
   */
  function checkAwardCeremonies() {
    var currentTurn = Game.state.currentTurn;
    var cal = getCalendar(currentTurn);
    var year = cal.year;

    // 年中音乐节：第11-12回合（6月下半月～7月上半月）
    var isMidYear = (currentTurn >= 11 && currentTurn <= 12);
    // 年末颁奖礼：第23-24回合（12月下半月～1月上半月）
    var isYearEnd = (currentTurn >= 23 && currentTurn <= 24);

    if (!isMidYear && !isYearEnd) return false;

    var eventType = isMidYear ? 'mid' : 'end';
    var flagKey = 'award-' + eventType + '-y' + year;

    if (Game.State.hasEventFlag(flagKey)) return false;

    // 只在窗口的第一个回合触发
    var windowStart = isMidYear ? 11 : 23;
    if (currentTurn !== windowStart) return false;

    Game.State.setEventFlag(flagKey);

    var title = isMidYear ? '年中音乐节' : '年末颁奖礼';
    var icon = isMidYear ? '🎵' : '🏆';

    Game.State.addEventLog({
      type: 'award-ceremony',
      eventType: eventType,
      summary: title + '来临！作为圈内人，你收到了邀请。'
    });

    showAwardModal(eventType, title, icon);
    return true;
  }

  /**
   * 显示颁奖礼弹窗
   */
  function showAwardModal(eventType, title, icon) {
    var modal = document.getElementById('media-event-modal');
    if (!modal) return;

    // 检查是否有恋人
    var partnerIdx = Game.State.getExclusivePartner();
    var hasPartner = partnerIdx !== null && partnerIdx !== undefined;

    var titleEl = modal.querySelector('.media-event-title');
    var bodyEl = modal.querySelector('.media-event-body');
    var actionsEl = modal.querySelector('.media-event-actions');

    if (titleEl) titleEl.textContent = icon + ' ' + title;

    var partnerText = '';
    if (hasPartner) {
      var partner = Game.state.idols[partnerIdx];
      partnerText = '<p style="margin-top:8px;color:var(--color-warning);">✨ ' +
        (partner.nickname || partner.name) + '也参加了这次活动。获奖时ta往你这边看了一眼...</p>';
    }

    if (bodyEl) {
      bodyEl.innerHTML = '<div class="media-event-scene">' +
        '<p>' + title + '来临！作为圈内人，你收到了邀请函。</p>' +
        '<p>这是一个曝光率极高的场合，但也会引起更多关注...</p>' +
        partnerText +
        '</div>';
    }

    if (actionsEl) {
      actionsEl.innerHTML = '<button class="btn media-option-risk" id="award-high-btn">✨ 盛装出席（粉丝+50~200, 嫌疑+5~10）</button>' +
        '<button class="btn media-option-safe" id="award-low-btn">🤫 低调观礼（粉丝+10~30, 安全）</button>';
    }

    modal.style.display = 'flex';

    var highBtn = document.getElementById('award-high-btn');
    var lowBtn = document.getElementById('award-low-btn');

    var cleanup = function() {
      if (highBtn) highBtn.removeEventListener('click', onHigh);
      if (lowBtn) lowBtn.removeEventListener('click', onLow);
    };

    var onHigh = function() {
      cleanup();
      modal.style.display = 'none';
      var followersDelta = Math.floor(Math.random() * 151) + 50;
      Game.State.addFollowers(followersDelta);
      Game.State.addSuspicion(Math.floor(Math.random() * 6) + 5);
      if (hasPartner && partnerIdx !== null && partnerIdx !== undefined) {
        Game.State.addAffection(partnerIdx, Math.floor(Math.random() * 3) + 3);
      }
      if (Game.Reality) {
        Game.Reality.showToast('✨ 盛装出席', '你盛装出席了' + title + '。闪光灯下的你很耀眼！粉丝+' + followersDelta, icon, null, 4000);
      }
    };

    var onLow = function() {
      cleanup();
      modal.style.display = 'none';
      Game.State.addFollowers(Math.floor(Math.random() * 21) + 10);
      if (Game.Reality) {
        Game.Reality.showToast('🤫 低调观礼', '你低调地参加了' + title + '。安静地欣赏了整场演出。粉丝+10~30', icon, null, 4000);
      }
    };

    if (highBtn) highBtn.addEventListener('click', onHigh);
    if (lowBtn) lowBtn.addEventListener('click', onLow);
  }

  /**
   * 固定事件统一入口
   */
  function checkFixedEvents() {
    if (checkBirthdays()) return;
    checkComebacks();
    checkAwardCeremonies();
  }

  // ===== 数值门槛事件 =====

  /**
   * 检查所有数值门槛事件
   */
  function checkThresholdEvents() {
    checkAffectionThresholds();
    checkSuspicionThresholds();
    checkStressThresholds();
  }

  /**
   * 好感度门槛检测
   */
  function checkAffectionThresholds() {
    var idols = Game.state.idols || [];
    for (var i = 0; i < idols.length; i++) {
      var aff = idols[i].stats.affection || 0;
      var idolName = idols[i].nickname || idols[i].name;

      // aff >= 50: 心动信号（每爱豆一次）
      if (aff >= 50 && !Game.State.hasEventFlag('aff-50-' + i)) {
        Game.State.setEventFlag('aff-50-' + i);
        Game.State.addCharm(1);
        Game.State.addFollowers(5);
        Game.State.addEventLog({
          type: 'aff-50',
          idolIndex: i,
          idolName: idolName,
          summary: idolName + '对你的好感度达到50！ta开始用不一样的眼神看你。'
        });
        if (Game.Reality) {
          Game.Reality.showToast('💕 心动信号', idolName + '开始对你展现出特别的关注。魅力+1，粉丝+5', '💕', [{ label: '魅力', delta: 1 }, { label: '粉丝', delta: 5 }], 5000);
        }
      }

      // aff >= 80: 深度羁绊（每爱豆一次）
      if (aff >= 80 && !Game.State.hasEventFlag('aff-80-' + i)) {
        Game.State.setEventFlag('aff-80-' + i);
        Game.State.addCharm(3);
        Game.State.addEventLog({
          type: 'aff-80',
          idolIndex: i,
          idolName: idolName,
          summary: idolName + '对你的好感度达到80！ta和你分享了内心深处的秘密。'
        });
        showAff80Modal(i, idols[i]);
      }
    }
  }

  /**
   * 好感度80深度羁绊弹窗
   */
  function showAff80Modal(idolIndex, idol) {
    var modal = document.getElementById('media-event-modal');
    if (!modal) return;

    var idolName = idol.nickname || idol.name;
    var secrets = [
      'ta和你分享了练习生时期的辛酸往事...那些在地下室练到凌晨的日子，ta第一次对别人说出口。',
      'ta告诉你ta其实对现在的人气感到不安。舞台上的光芒万丈，台下却是深深的自我怀疑。',
      'ta向你展示了手腕上的一道旧伤。那是练习时期留下的，ta说你是第一个知道这个秘密的人。',
      'ta和你聊起了家人的事。原来ta已经很久没回家了，每次打电话都报喜不报忧。'
    ];
    var secret = secrets[Math.floor(Math.random() * secrets.length)];

    var titleEl = modal.querySelector('.media-event-title');
    var bodyEl = modal.querySelector('.media-event-body');
    var actionsEl = modal.querySelector('.media-event-actions');

    if (titleEl) titleEl.textContent = '💗 深度羁绊';
    if (bodyEl) {
      bodyEl.innerHTML = '<div class="media-event-scene">' +
        '<p><strong>' + escapeHtml(idolName) + '</strong> 的好感度达到了80。</p>' +
        '<p style="margin-top:8px;font-style:italic;color:var(--color-text-secondary);">' + secret + '</p>' +
        '<p style="margin-top:8px;">你们的羁绊已经超越了普通朋友。魅力+3</p>' +
        '</div>';
    }
    if (actionsEl) {
      actionsEl.innerHTML = '<button class="btn media-option-safe" id="aff80-ok-btn">💗 感受到了</button>';
    }

    modal.style.display = 'flex';

    var okBtn = document.getElementById('aff80-ok-btn');
    if (okBtn) {
      okBtn.addEventListener('click', function() {
        modal.style.display = 'none';
      });
    }
  }

  /**
   * 嫌疑度门槛检测
   */
  function checkSuspicionThresholds() {
    var susp = Game.state.player.stats.suspicion || 0;

    // susp >= 60: 公司警告（全局一次）
    if (susp >= 60 && !Game.State.hasEventFlag('susp-60')) {
      Game.State.setEventFlag('susp-60');
      Game.State.addStress(10);
      // 锁定约会行动1回合
      for (var i = 0; i < (Game.state.idols || []).length; i++) {
        Game.State.setDatingActionLock(i, 1);
      }
      Game.State.addEventLog({
        type: 'susp-60',
        summary: '嫌疑度达到60！公司发出了正式警告。压力+10，约会行动锁定1回合。'
      });
      showSuspModal(60);
    }

    // susp >= 90: 濒临曝光（全局一次）
    if (susp >= 90 && !Game.State.hasEventFlag('susp-90')) {
      Game.State.setEventFlag('susp-90');
      Game.State.addStress(20);
      for (var j = 0; j < (Game.state.idols || []).length; j++) {
        Game.State.setDatingActionLock(j, 2);
      }
      Game.State.addEventLog({
        type: 'susp-90',
        summary: '嫌疑度达到90！D社即将发布确凿证据，这是最后的机会...压力+20，约会行动锁定2回合。'
      });
      showSuspModal(90);
    }
  }

  /**
   * 嫌疑度门槛弹窗
   */
  function showSuspModal(level) {
    var modal = document.getElementById('media-event-modal');
    if (!modal) return;

    var is60 = level === 60;
    var titleEl = modal.querySelector('.media-event-title');
    var bodyEl = modal.querySelector('.media-event-body');
    var actionsEl = modal.querySelector('.media-event-actions');

    if (titleEl) titleEl.textContent = is60 ? '⚠️ 公司警告' : '🚨 濒临曝光';
    if (bodyEl) {
      bodyEl.innerHTML = '<div class="media-event-scene">' +
        (is60
          ? '<p>公司已经注意到了你与爱豆之间过于亲密的关系。</p><p style="color:var(--color-warning);">"请保持距离，否则将采取进一步措施。"</p><p>压力+10 · 约会行动锁定1回合</p>'
          : '<p style="color:var(--color-danger);">D社已经拿到了确凿证据，即将发布。这是最后的机会...</p><p>"如果不立即处理，明天你和ta的照片就会出现在头条。"</p><p>压力+20 · 约会行动锁定2回合</p>') +
        '</div>';
    }
    if (actionsEl) {
      actionsEl.innerHTML = '<button class="btn media-option-pay" id="susp-ok-btn">' + (is60 ? '😰 知道了...' : '💀 必须想办法...') + '</button>';
    }

    modal.style.display = 'flex';

    var okBtn = document.getElementById('susp-ok-btn');
    if (okBtn) {
      okBtn.addEventListener('click', function() {
        modal.style.display = 'none';
      });
    }
  }

  /**
   * 压力值门槛检测
   */
  function checkStressThresholds() {
    var stress = Game.state.player.stats.stress || 0;
    var currentTurn = Game.state.currentTurn;

    // stress >= 70: 身心俱疲（可重复，冷却12回合）
    if (stress >= 70) {
      var last70 = Game.State.hasEventFlag('stress-70-last') ? Game.state.eventFlags['stress-70-last'] : 0;
      if (currentTurn - last70 >= 12) {
        Game.State.setEventFlag('stress-70-last', currentTurn);
        Game.State.addCharm(-2);
        Game.State.addEventLog({
          type: 'stress-70',
          summary: '压力值达到70！身心俱疲。本回合好感获取减半，魅力-2。'
        });
        if (Game.Reality) {
          Game.Reality.showToast('😰 身心俱疲', '你感到身心俱疲。继续在这个圈子里周旋，压力只会越来越大...本回合好感获取减半，魅力-2', '😰', [{ label: '魅力', delta: -2 }], 5000);
        }
      }
    }

    // stress >= 90: 崩溃边缘（可重复，冷却24回合）
    if (stress >= 90) {
      var last90 = Game.State.hasEventFlag('stress-90-last') ? Game.state.eventFlags['stress-90-last'] : 0;
      if (currentTurn - last90 >= 24) {
        Game.State.setEventFlag('stress-90-last', currentTurn);
        Game.State.addEventLog({
          type: 'stress-90',
          summary: '压力值达到90！濒临崩溃边缘。'
        });
        showStress90Modal();
      }
    }
  }

  /**
   * 压力90崩溃边缘弹窗
   */
  function showStress90Modal() {
    var modal = document.getElementById('media-event-modal');
    if (!modal) return;

    var titleEl = modal.querySelector('.media-event-title');
    var bodyEl = modal.querySelector('.media-event-body');
    var actionsEl = modal.querySelector('.media-event-actions');

    if (titleEl) titleEl.textContent = '💔 崩溃边缘';
    if (bodyEl) {
      bodyEl.innerHTML = '<div class="media-event-scene">' +
        '<p>你感觉快要崩溃了。再这样下去，你可能会做出不理智的事...</p>' +
        '<p style="color:var(--color-danger);">你的身心都在发出警告信号。</p>' +
        '</div>';
    }
    if (actionsEl) {
      actionsEl.innerHTML = '<button class="btn media-option-safe" id="stress-rest-btn">🛌 好好休息（压力-30, 体力+50）</button>' +
        '<button class="btn media-option-risk" id="stress-push-btn">😤 咬牙坚持（压力+10, 所有爱豆好感-10）</button>';
    }

    modal.style.display = 'flex';

    var restBtn = document.getElementById('stress-rest-btn');
    var pushBtn = document.getElementById('stress-push-btn');

    var cleanup = function() {
      if (restBtn) restBtn.removeEventListener('click', onRest);
      if (pushBtn) pushBtn.removeEventListener('click', onPush);
    };

    var onRest = function() {
      cleanup();
      modal.style.display = 'none';
      Game.State.addStress(-30);
      Game.State.addStamina(50);
      if (Game.Reality) {
        Game.Reality.showToast('🛌 好好休息', '你选择暂时放下一切，好好休息。压力-30，体力+50', '😌', [{ label: '压力', delta: -30 }, { label: '体力', delta: 50 }], 5000);
      }
    };

    var onPush = function() {
      cleanup();
      modal.style.display = 'none';
      Game.State.addStress(10);
      var idols = Game.state.idols || [];
      for (var i = 0; i < idols.length; i++) {
        Game.State.addAffection(i, -10);
      }
      if (Game.Reality) {
        Game.Reality.showToast('😤 咬牙坚持', '你选择咬牙坚持，但身边的人感受到了你的疏远...压力+10，所有爱豆好感-10', '💔', [{ label: '压力', delta: 10 }], 5000);
      }
    };

    if (restBtn) restBtn.addEventListener('click', onRest);
    if (pushBtn) pushBtn.addEventListener('click', onPush);
  }

  // ===== 突发新闻 =====

  /**
   * 检查是否触发突发新闻
   */
  function checkBreakingNews() {
    var currentTurn = Game.state.currentTurn;
    var lastTurn = Game.state.lastBreakingNewsTurn || 0;

    // 冷却检查：至少间隔2回合
    if (currentTurn - lastTurn < 2) return false;

    // 25%概率
    if (Math.random() * 100 >= 25) return false;

    // 随机选一条新闻
    var news = BREAKING_NEWS[Math.floor(Math.random() * BREAKING_NEWS.length)];

    // 更新冷却
    Game.state.lastBreakingNewsTurn = currentTurn;

    // 应用效果
    var effectsLog = null;
    if (news.effects) {
      effectsLog = [];
      Object.keys(news.effects).forEach(function(key) {
        var delta = randInRange(news.effects[key]);
        if (delta === 0) return;
        switch (key) {
          case 'suspicion':
            Game.State.addSuspicion(delta);
            effectsLog.push({ label: '嫌疑度', delta: delta });
            break;
          case 'followers':
            Game.State.addFollowers(delta);
            effectsLog.push({ label: '粉丝', delta: delta });
            break;
        }
      });
    }

    // 记录日志
    Game.State.addEventLog({
      type: 'breaking-news',
      newsId: news.id,
      summary: news.title + '：' + news.body
    });

    // 显示Toast
    if (Game.Reality) {
      Game.Reality.showToast(news.icon + ' ' + news.title, news.body, news.icon, effectsLog, 5000);
    }

    return true;
  }

  // ===== 好感度修正查询（供 turn.js 使用） =====

  /**
   * 获取目标爱豆当前是否在回归期
   * @param {number} idolIndex
   * @returns {Object|null} 活跃回归期对象，或null
   */
  function getActiveComeback(idolIndex) {
    return Game.State.getActiveComeback(idolIndex);
  }

  /**
   * 检查当前回合是否有stress-70惩罚（好感获取减半）
   * @returns {boolean}
   */
  function hasStress70Penalty() {
    var last70 = Game.State.hasEventFlag('stress-70-last') ? Game.state.eventFlags['stress-70-last'] : 0;
    return last70 === Game.state.currentTurn;
  }

  // ===== 事件选项卡UI =====

  /**
   * 渲染事件tab内容
   */
  function renderEventsTab() {
    var container = document.getElementById('events-content');
    if (!container) return;

    var eventLog = Game.state.eventLog || [];
    if (eventLog.length === 0) {
      container.innerHTML = '<div class="event-empty">' +
        '<div class="event-empty-icon">📖</div>' +
        '<p class="event-empty-text">暂无事件记录</p>' +
        '<p class="event-empty-hint">随着游戏推进，这里会记录所有发生的事件</p>' +
        '</div>';
      return;
    }

    // 筛选
    var filtered = filterEvents(eventLog);

    // 按turn分组（最新在前）
    var grouped = groupByTurn(filtered);

    // 渲染
    var html = renderFilterBar() + renderTimeline(grouped);
    container.innerHTML = html;

    // 绑定筛选事件
    bindFilterEvents();
  }

  /**
   * 根据当前筛选条件过滤事件
   */
  function filterEvents(eventLog) {
    return eventLog.filter(function(ev) {
      // 分类筛选
      if (_currentFilter !== 'all') {
        var cat = TYPE_CATEGORY[ev.type] || 'reality';
        if (cat !== _currentFilter) return false;
      }
      // 爱豆筛选
      if (_currentIdolFilter >= 0) {
        if (ev.idolIndex !== _currentIdolFilter) return false;
      }
      return true;
    }).reverse(); // 最新在前
  }

  /**
   * 按turn分组
   */
  function groupByTurn(events) {
    var groups = {};
    events.forEach(function(ev) {
      var t = ev.turn || 0;
      if (!groups[t]) groups[t] = [];
      groups[t].push(ev);
    });
    // 按turn降序
    var result = [];
    Object.keys(groups).sort(function(a, b) { return Number(b) - Number(a); }).forEach(function(t) {
      result.push({ turn: Number(t), events: groups[t] });
    });
    return result;
  }

  /**
   * 渲染筛选栏
   */
  function renderFilterBar() {
    var filters = [
      { key: 'all', label: '全部' },
      { key: 'fixed', label: '固定事件' },
      { key: 'random', label: '随机事件' },
      { key: 'threshold', label: '门槛事件' },
      { key: 'stage', label: '关系阶段' },
      { key: 'reality', label: '现实元素' },
      { key: 'negative', label: '负面事件' }
    ];

    var pillsHtml = filters.map(function(f) {
      var activeClass = _currentFilter === f.key ? ' active' : '';
      return '<button class="event-filter-pill' + activeClass + '" data-filter="' + f.key + '">' + f.label + '</button>';
    }).join('');

    // 爱豆筛选下拉
    var idols = Game.state.idols || [];
    var idolOptions = '<option value="-1"' + (_currentIdolFilter === -1 ? ' selected' : '') + '>全部爱豆</option>';
    idols.forEach(function(idol, i) {
      var selected = _currentIdolFilter === i ? ' selected' : '';
      idolOptions += '<option value="' + i + '"' + selected + '>' + (idol.nickname || idol.name) + '</option>';
    });

    return '<div class="event-filter-bar">' +
      '<div class="event-filter-pills">' + pillsHtml + '</div>' +
      '<div class="event-idol-filter-wrap">' +
      '<select class="event-idol-filter" id="event-idol-select">' + idolOptions + '</select>' +
      '</div>' +
      '</div>';
  }

  /**
   * 渲染时间线
   */
  function renderTimeline(grouped) {
    if (grouped.length === 0) {
      return '<div class="event-empty">' +
        '<div class="event-empty-icon">🔍</div>' +
        '<p class="event-empty-text">暂无此类事件记录</p>' +
        '</div>';
    }

    var html = '<div class="event-timeline">';
    grouped.forEach(function(group) {
      html += '<div class="event-turn-header">' +
        '<span class="event-turn-label">📅 第' + group.turn + '回合</span>' +
        '<span class="event-turn-date">' + formatDate(group.turn) + '</span>' +
        '<span class="event-turn-count">' + group.events.length + ' 个事件</span>' +
        '</div>';

      group.events.forEach(function(ev, idx) {
        var cat = TYPE_CATEGORY[ev.type] || 'reality';
        var barClass = CATEGORY_BAR_CLASS[cat] || 'event-card-bar-reality';
        var icon = TYPE_ICONS[ev.type] || '📌';
        var title = TYPE_TITLES[ev.type] || ev.type;
        var summary = ev.summary || ev.label || '';
        var eventId = 'event-' + group.turn + '-' + idx;

        html += '<div class="event-card ' + barClass + '" id="' + eventId + '" data-event-id="' + eventId + '">' +
          '<div class="event-card-bar"></div>' +
          '<div class="event-card-content">' +
          '<div class="event-card-header-row">' +
          '<span class="event-card-icon">' + icon + '</span>' +
          '<span class="event-card-title">' + title + '</span>' +
          '<span class="event-card-cat-tag cat-' + cat + '">' + (CATEGORY_NAMES[cat] || cat) + '</span>' +
          '</div>' +
          '<div class="event-card-body">' + escapeHtml(summary) + '</div>' +
          '</div>' +
          '</div>';
      });
    });
    html += '</div>';
    return html;
  }

  /**
   * 绑定筛选事件
   */
  function bindFilterEvents() {
    // 分类筛选pill
    var pills = document.querySelectorAll('.event-filter-pill');
    pills.forEach(function(pill) {
      pill.addEventListener('click', function() {
        _currentFilter = this.dataset.filter;
        renderEventsTab();
      });
    });

    // 爱豆筛选
    var select = document.getElementById('event-idol-select');
    if (select) {
      select.addEventListener('change', function() {
        _currentIdolFilter = parseInt(this.value, 10);
        renderEventsTab();
      });
    }

    // 事件卡片点击展开（简化：点击日志到控制台）
    var cards = document.querySelectorAll('.event-card');
    cards.forEach(function(card) {
      card.addEventListener('click', function() {
        this.classList.toggle('expanded');
      });
    });
  }

  // ===== 初始化 =====

  /**
   * 初始化事件系统
   * 监听页面切换到事件tab时自动刷新
   */
  function init() {
    document.addEventListener('pageChanged', function(e) {
      if (e.detail && e.detail.to === 'events') {
        renderEventsTab();
      }
    });

    console.log('[Events] 事件系统完整版初始化完成');
  }

  // ===== 公开API =====
  return {
    init,
    getCalendar,
    getCurrentCalendar,
    formatDate,
    checkFixedEvents,
    checkThresholdEvents,
    checkBreakingNews,
    getActiveComeback,
    hasStress70Penalty,
    renderEventsTab
  };

})();
