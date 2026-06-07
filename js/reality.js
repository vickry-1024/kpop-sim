/**
 * 现实元素系统 — 查岗、私生/媒体、名场面、日常细节
 * 阶段8核心模块，负责回合结束时的随机现实事件触发
 */

Game.Reality = (() => {

  // ===== 名场面事件池 =====

  var FAMOUS_SCENES = [
    { id: 'airport', icon: '✈️', title: '机场时尚报道',
      text: '有媒体拍到你在机场的时尚造型，网友纷纷讨论你的穿搭风格。',
      effects: { followers: [20, 80] } },
    { id: 'win-speech', icon: '🏆', title: '音乐放送一位感言',
      text: '你喜欢的爱豆在音乐放送中获得一位！在感言中似乎提到了"特别的人"。粉丝们在猜测是谁...',
      effects: { followers: [50, 200], stress: [-3, 0] } },
    { id: 'bubble-leak', icon: '💭', title: 'Bubble消息泄露',
      text: '有粉丝截图了Bubble上的一条暧昧消息发布到论坛上，虽然没指名道姓，但评论区已经开始猜测了...',
      effects: { suspicion: [3, 8], stress: [3, 5] } },
    { id: 'reverse-support', icon: '🎁', title: '演唱会逆应援',
      text: '爱豆在演唱会上为粉丝准备了逆应援礼物！你也在现场，被粉丝拍到开心地举着应援棒的样子。',
      effects: { followers: [100, 500], charm: [1, 3] } },
    { id: 'isac', icon: '🏃', title: 'ISAC偶遇',
      text: '偶像运动会上，你和爱豆在观众席附近偶遇。有站姐拍到了你们短暂对视的瞬间...',
      effects: { affection: [1, 3], suspicion: [0, 3] } },
    { id: 'eye-contact', icon: '👀', title: '颁奖礼眼神交流',
      text: '年末颁奖礼上，镜头捕捉到爱豆看向观众席某处的温柔眼神。粉丝们开始逐帧分析...',
      effects: { suspicion: [5, 10], followers: [10, 50] } },
    { id: 'couple-item', icon: '👜', title: '同款物品被发现',
      text: '有眼尖的粉丝发现你和爱豆最近使用了同款手机壳/饰品，论坛上讨论热度飙升。',
      effects: { suspicion: [3, 8] } },
    { id: 'convenience', icon: '🏪', title: '深夜便利店被目击',
      text: '有网友发帖称在深夜便利店看到了"一个很像某爱豆的人和一个女生一起买东西"。',
      effects: { suspicion: [2, 5], stress: [2, 5] } },
    { id: 'selca-leak', icon: '🤳', title: '练习室自拍流出',
      text: '一张在练习室拍的模糊自拍照在SNS上传播，照片角落似乎能认出你的身影...',
      effects: { followers: [20, 80], suspicion: [0, 2] } },
    { id: 'fan-photo', icon: '📸', title: '偶遇粉丝求合影',
      text: '在街上被粉丝认出，她们热情地要求合影。照片被发到了粉丝群聊里，引发讨论。',
      effects: { followers: [30, 100], stress: [-2, 0], charm: [0, 2] } }
  ];

  // ===== 内部工具 =====

  /**
   * 通用Toast通知（插入日程页顶部）
   */
  function showToast(title, text, icon, effects, duration) {
    var container = document.getElementById('schedule-action-log');
    if (!container) return;

    var effectsHtml = '';
    if (effects) {
      var labels = { affection: '❤️好感', stress: '😰压力', suspicion: '🕵️嫌疑', charm: '💎魅力', followers: '👥粉丝' };
      effectsHtml = Object.keys(effects).map(function(key) {
        var range = effects[key];
        var label = labels[key] || key;
        // 判断是否为纯正面/纯负面
        var isPositive = range[0] >= 0 && range[1] >= 0;
        var isNegative = range[0] <= 0 && range[1] <= 0;
        var cls = isPositive ? 'effect-positive' : (isNegative ? 'effect-negative' : 'effect-mixed');
        return '<span class="reality-toast-effect ' + cls + '">' + label + '</span>';
      }).join('');
    }

    var toast = document.createElement('div');
    toast.className = 'reality-toast';
    toast.innerHTML = ''
      + '<div class="reality-toast-icon">' + (icon || '📢') + '</div>'
      + '<div class="reality-toast-body">'
      +   '<div class="reality-toast-title">' + escapeHtml(title) + '</div>'
      +   '<div class="reality-toast-text">' + escapeHtml(text) + '</div>'
      +   (effectsHtml ? '<div class="reality-toast-effects">' + effectsHtml + '</div>' : '')
      + '</div>';

    container.insertBefore(toast, container.firstChild);

    // 入场动画
    requestAnimationFrame(function() { toast.classList.add('reality-toast-show'); });

    // 自动消失
    setTimeout(function() {
      toast.classList.remove('reality-toast-show');
      setTimeout(function() {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 400);
    }, duration || 5000);
  }

  /**
   * 整数随机
   */
  function randInRange(range) {
    return range[0] + Math.floor(Math.random() * (range[1] - range[0] + 1));
  }

  /**
   * 检查是否需要评估出轨（当已婚状态下与其他爱豆互动）
   */
  function checkCheatingIfNeeded(idolIndex) {
    if (Game.Relationship && Game.Relationship.checkCheatingOnAction) {
      Game.Relationship.checkCheatingOnAction(idolIndex, 0);
    }
  }

  // ======================================================================
  //  📞 查岗系统
  // ======================================================================

  /**
   * 伴侣查岗触发（回合结束时调用）
   * 遍历所有恋爱/已婚爱豆，按概率触发查岗
   */
  function triggerPartnerCheckIns() {
    var idols = Game.state.idols || [];
    if (idols.length === 0) return;
    var currentTurn = Game.state.currentTurn || 0;

    for (var i = 0; i < idols.length; i++) {
      var idol = idols[i];
      var stage = idol.relationshipStage || 'pursuit';
      if (stage !== 'dating' && stage !== 'married') continue;

      // 检查冷却（至少2回合间隔）
      var lastTurn = Game.State.getLastCheckInTurn(i) || 0;
      if (currentTurn - lastTurn < 2) continue;

      // 触发概率 = 20% + min(15, suspicion/3)
      var suspicion = Game.state.player.stats.suspicion || 0;
      var chance = 20 + Math.min(15, Math.floor(suspicion / 3));
      if (Math.random() * 100 >= chance) continue;

      // 触发查岗！
      showCheckInModal(i);
      return; // 每回合最多1次
    }
  }

  /**
   * 显示查岗弹窗
   */
  function showCheckInModal(idolIndex) {
    var idol = Game.state.idols[idolIndex];
    if (!idol) return;

    var honorific = Game.Actions ? Game.Actions.getHonorific(idol.gender) : '欧巴';
    var idolName = escapeHtml(idol.nickname || idol.name);
    var stage = idol.relationshipStage || 'pursuit';
    var suspicion = Game.state.player.stats.suspicion || 0;

    // 查岗消息（根据嫌疑度和阶段变化）
    var messages = [];
    if (suspicion >= 60 && stage === 'married') {
      messages = [
        honorific + '～我今天感觉有点不对劲...你现在在哪？方便视频吗？',
        '亲爱的，我看到网上有人说...算了，你直接告诉我吧。你真的在忙吗？',
        honorific + '...我们结婚之后就很少聊天了。我现在有点担心。可以告诉我你在哪吗？'
      ];
    } else if (suspicion >= 40 && stage === 'dating') {
      messages = [
        honorific + '！我今天刷到一些奇怪的东西...你现在方便吗？想跟你确认一下',
        '嘿～你最近好像很忙的样子。现在在哪呢？我们好久没好好聊天了',
        honorific + '～突然很想你。你现在方便接电话吗？就一分钟...'
      ];
    } else {
      messages = [
        honorific + '！💕 你在干嘛呀～突然想你了',
        '嘿嘿 ' + honorific + '～今天过得怎么样？我在想你！',
        honorific + '～今天做了什么呢？想听你讲讲～',
        '你在哪呀～我刚刚在想要不要一起吃个饭？'
      ];
    }
    var message = messages[Math.floor(Math.random() * messages.length)];

    // 渲染弹窗
    var modal = document.getElementById('checkin-modal');
    var body = document.getElementById('checkin-modal-body');
    var actions = document.getElementById('checkin-modal-actions');
    if (!modal || !body || !actions) return;

    document.getElementById('checkin-modal-title').textContent = '📞 ' + idolName + ' 来查岗了';

    body.innerHTML = ''
      + '<div class="checkin-message">'
      +   '<div class="checkin-message-avatar">' + (idol.gender === 'female' ? '👩‍🎤' : '🧑‍🎤') + '</div>'
      +   '<div class="checkin-message-text">' + escapeHtml(message) + '</div>'
      + '</div>';

    actions.innerHTML = ''
      + '<button class="target-modal-btn checkin-option-honest" onclick="Game.Reality.handleCheckInReply(' + idolIndex + ', \'honest\')">'
      +   '<span class="checkin-option-icon">✅</span> 说实话'
      + '</button>'
      + '<button class="target-modal-btn checkin-option-evade" onclick="Game.Reality.handleCheckInReply(' + idolIndex + ', \'evade\')">'
      +   '<span class="checkin-option-icon">😅</span> 糊弄过去'
      + '</button>'
      + '<button class="target-modal-btn checkin-option-deflect" onclick="Game.Reality.handleCheckInReply(' + idolIndex + ', \'deflect\')">'
      +   '<span class="checkin-option-icon">💕</span> 撒娇转移话题'
      + '</button>';

    // 记录查岗回合（标记冷却开始）
    Game.State.recordPartnerCheckIn(idolIndex, { turn: Game.state.currentTurn, type: 'partner-check' });

    modal.style.display = 'flex';
  }

  /**
   * 处理玩家查岗回复选择
   */
  function handleCheckInReply(idolIndex, choice) {
    var modal = document.getElementById('checkin-modal');
    if (modal) modal.style.display = 'none';

    var idol = Game.state.idols[idolIndex];
    if (!idol) return;

    var idolName = escapeHtml(idol.nickname || idol.name);
    var suspicion = Game.state.player.stats.suspicion || 0;
    var hasSharing = Game.State.hasLocationSharing(idolIndex);

    switch (choice) {
      case 'honest':
        // 说实话: 好感微增，嫌疑微降
        Game.State.addAffection(idolIndex, randInRange([1, 3]));
        Game.State.addSuspicion(randInRange([-5, -3]));
        Game.State.recordPartnerCheckIn(idolIndex, {
          turn: Game.state.currentTurn, type: 'checkin-reply', choice: 'honest', outcome: 'trusted'
        });
        Game.State.addEventLog({ type: 'checkin', idolIndex: idolIndex, choice: 'honest',
          summary: '📞 ' + idolName + '来查岗，你坦诚回答。ta很满意，信任度上升。' });
        showToast('查岗通过 ✅', '你坦诚回答了' + idolName + '的查岗。ta很放心，心情不错～', '📞',
          { affection: [1, 3], suspicion: [-5, -3] }, 4000);
        break;

      case 'evade':
        // 糊弄: 中立
        Game.State.recordPartnerCheckIn(idolIndex, {
          turn: Game.state.currentTurn, type: 'checkin-reply', choice: 'evade', outcome: 'neutral'
        });
        Game.State.addEventLog({ type: 'checkin', idolIndex: idolIndex, choice: 'evade',
          summary: '📞 ' + idolName + '来查岗，你含糊其辞。ta似乎没有追问。' });
        showToast('糊弄成功...? 🤔', idolName + '没有继续追问，但你感觉ta似乎不太满意。', '📞', null, 4000);
        break;

      case 'deflect':
        // 撒娇: 嫌疑度高时可能被抓
        var catchChance = hasSharing ? 40 : 60; // 定位共享降低被抓概率
        if (suspicion >= 50 && Math.random() * 100 < catchChance) {
          // 被识破
          Game.State.addStress(randInRange([5, 10]));
          Game.State.addSuspicion(randInRange([1, 2]));
          Game.State.recordPartnerCheckIn(idolIndex, {
            turn: Game.state.currentTurn, type: 'checkin-reply', choice: 'deflect', outcome: 'caught'
          });
          Game.State.addEventLog({ type: 'checkin', idolIndex: idolIndex, choice: 'deflect', outcome: 'caught',
            summary: '📞 ' + idolName + '来查岗，你的撒娇被识破。ta有点生气了...' });
          showToast('被识破了 😰', idolName + '没有上当... "你在敷衍我吧？" ta的语气明显冷淡了。', '📞',
            { stress: [5, 10], suspicion: [1, 2] }, 4000);
        } else {
          // 蒙混过关
          Game.State.addAffection(idolIndex, randInRange([1, 2]));
          Game.State.recordPartnerCheckIn(idolIndex, {
            turn: Game.state.currentTurn, type: 'checkin-reply', choice: 'deflect', outcome: 'passed'
          });
          Game.State.addEventLog({ type: 'checkin', idolIndex: idolIndex, choice: 'deflect', outcome: 'passed',
            summary: '📞 ' + idolName + '来查岗，你的撒娇成功化解。ta笑得很开心。' });
          showToast('撒娇成功 💕', idolName + '被你逗笑了。"好啦好啦～我相信你～"', '📞',
            { affection: [1, 2] }, 4000);
        }
        break;
    }

    // 刷新面板
    if (Game.Relations) Game.Relations.refresh();
    if (Game.Profile) Game.Profile.refresh();
  }

  /**
   * 公司查岗（经纪人温和版）
   * 15%概率对已有经理人介入的爱豆触发
   */
  function triggerCompanyCheckIn() {
    var idols = Game.state.idols || [];
    var currentTurn = Game.state.currentTurn || 0;

    for (var i = 0; i < idols.length; i++) {
      if (!Game.State.hasManagerIntervened(i)) continue;

      var lastCI = Game.State.getCheckInCooldown(i) || 0;
      if (currentTurn - lastCI < 3) continue;

      if (Math.random() * 100 < 15) {
        var idol = idols[i];
        var idolName = escapeHtml(idol.nickname || idol.name);
        var managerName = (Game.State.getManagerIntervention(i) || {}).managerName || '经纪人';

        Game.State.setCheckInCooldown(i, currentTurn);
        Game.State.addSuspicion(randInRange([0, 3]));
        Game.State.addEventLog({ type: 'company-checkin', idolIndex: i,
          summary: '📞 ' + escapeHtml(managerName) + '（' + idolName + '的经纪人）打来电话询问你的近况。' });

        showToast(escapeHtml(managerName) + '来电 📞',
          '"没有特别的事，就是例行问一下。最近' + idolName + '的行程比较密集，注意别被拍到。"',
          '📋', { suspicion: [0, 3] }, 5000);
        return;
      }
    }
  }

  // ======================================================================
  //  🕵️ 私生/媒体系统
  // ======================================================================

  /**
   * D社预警
   */
  function checkDispatchWarning(idolIndex) {
    var idol = Game.state.idols[idolIndex];
    if (!idol) return;
    var idolName = escapeHtml(idol.nickname || idol.name);
    var honorific = Game.Actions ? Game.Actions.getHonorific(idol.gender) : '欧巴';

    Game.State.setMediaEventFlag(idolIndex, 'dispatchWarned');

    var modal = document.getElementById('media-event-modal');
    var title = document.getElementById('media-event-modal-title');
    var body = document.getElementById('media-event-modal-body');
    var actions = document.getElementById('media-event-modal-actions');
    if (!modal || !title || !body || !actions) return;

    title.textContent = '📰 D社预警';
    body.innerHTML = ''
      + '<div class="media-event-scene">'
      +   '<p>你收到了一条令人不安的消息：</p>'
      +   '<p><strong>Dispatch（D社）</strong>据说正在调查你和<strong>' + idolName + '</strong>的关系。</p>'
      +   '<p>有业内人士透露，他们手上有一些"不太好看"的照片。现在还有时间做出反应。</p>'
      + '</div>'
      + '<div class="media-event-warning">⚠️ 如果不处理，可能会被公开曝光</div>';

    actions.innerHTML = ''
      + '<button class="target-modal-btn media-option-safe" onclick="Game.Reality._resolveMediaEvent(' + idolIndex + ', \'dispatch\', \'laylow\')">'
      +   '🔒 低调行事<br><small>减少公开露面2回合，嫌疑度-5</small>'
      + '</button>'
      + '<button class="target-modal-btn media-option-risk" onclick="Game.Reality._resolveMediaEvent(' + idolIndex + ', \'dispatch\', \'ignore\')">'
      +   '😤 我行我素<br><small>不理睬，但嫌疑度+3</small>'
      + '</button>'
      + '<button class="target-modal-btn media-option-pay" onclick="Game.Reality._resolveMediaEvent(' + idolIndex + ', \'dispatch\', \'pay\')">'
      +   '💰 花重金打点<br><small>粉丝-10 或 压力+10，嫌疑度-15</small>'
      + '</button>';

    modal.style.display = 'flex';
  }

  /**
   * 被拍事件
   */
  function checkCaughtOnCamera(idolIndex) {
    var idol = Game.state.idols[idolIndex];
    if (!idol) return;
    var idolName = escapeHtml(idol.nickname || idol.name);

    Game.State.setMediaEventFlag(idolIndex, 'caughtOnCamera');

    var modal = document.getElementById('media-event-modal');
    var title = document.getElementById('media-event-modal-title');
    var body = document.getElementById('media-event-modal-body');
    var actions = document.getElementById('media-event-modal-actions');
    if (!modal || !title || !body || !actions) return;

    title.textContent = '📸 被拍事件';
    body.innerHTML = ''
      + '<div class="media-event-scene">'
      +   '<p>糟糕！有路人在SNS上发布了一张照片——</p>'
      +   '<p>照片中可以看到<strong>你和' + idolName + '</strong>在一起的画面。</p>'
      +   '<p>虽然照片有些模糊，但评论区已经开始有人认出' + idolName + '了。这条帖子正在迅速扩散...</p>'
      + '</div>'
      + '<div class="media-event-warning">⚠️ 照片已经在网上传播，需要立刻行动</div>';

    actions.innerHTML = ''
      + '<button class="target-modal-btn media-option-safe" onclick="Game.Reality._resolveMediaEvent(' + idolIndex + ', \'camera\', \'public\')">'
      +   '📢 公开承认<br><small>粉丝+50~200，但可能引发出轨检测</small>'
      + '</button>'
      + '<button class="target-modal-btn media-option-risk" onclick="Game.Reality._resolveMediaEvent(' + idolIndex + ', \'camera\', \'deny\')">'
      +   '🙅 迅速否认<br><small>声称是角度巧合，压力+10</small>'
      + '</button>'
      + '<button class="target-modal-btn media-option-pay" onclick="Game.Reality._resolveMediaEvent(' + idolIndex + ', \'camera\', \'suppress\')">'
      +   '🤐 找人压下去<br><small>粉丝-50~200，但事件平息</small>'
      + '</button>';

    modal.style.display = 'flex';
  }

  /**
   * 粉丝扒料
   */
  function checkFanInvestigation(idolIndex) {
    var idol = Game.state.idols[idolIndex];
    if (!idol) return;
    var idolName = escapeHtml(idol.nickname || idol.name);

    Game.State.setMediaEventFlag(idolIndex, 'fanInvestigated');

    var modal = document.getElementById('media-event-modal');
    var title = document.getElementById('media-event-modal-title');
    var body = document.getElementById('media-event-modal-body');
    var actions = document.getElementById('media-event-modal-actions');
    if (!modal || !title || !body || !actions) return;

    title.textContent = '🔍 粉丝扒料';
    body.innerHTML = ''
      + '<div class="media-event-scene">'
      +   '<p>你发现一些<strong>' + idolName + '的粉丝</strong>正在论坛上疯狂扒你的SNS账号。</p>'
      +   '<p>他们把你发帖的时间和' + idolName + '的行程做了对比，还截图了你的"可疑"动态。</p>'
      +   '<p>帖子热度正在上升...</p>'
      + '</div>'
      + '<div class="media-event-warning">⚠️ 如果被彻底扒出实锤，后果不堪设想</div>';

    actions.innerHTML = ''
      + '<button class="target-modal-btn media-option-safe" onclick="Game.Reality._resolveMediaEvent(' + idolIndex + ', \'fan\', \'delete\')">'
      +   '🗑️ 删除可疑帖子<br><small>粉丝-20~50，消除证据</small>'
      + '</button>'
      + '<button class="target-modal-btn media-option-risk" onclick="Game.Reality._resolveMediaEvent(' + idolIndex + ', \'fan\', \'clarify\')">'
      +   '📝 发澄清声明<br><small>粉丝+10~30，发帖数+1</small>'
      + '</button>'
      + '<button class="target-modal-btn media-option-pay" onclick="Game.Reality._resolveMediaEvent(' + idolIndex + ', \'fan\', \'ignore\')">'
      +   '🙈 无视<br><small>什么也不做，嫌疑度+5~10</small>'
      + '</button>';

    modal.style.display = 'flex';
  }

  /**
   * 处理媒体事件选择（内部函数，从HTML onclick调用）
   */
  function _resolveMediaEvent(idolIndex, eventType, choice) {
    var modal = document.getElementById('media-event-modal');
    if (modal) modal.style.display = 'none';

    var idol = Game.state.idols[idolIndex];
    if (!idol) return;
    var idolName = escapeHtml(idol.nickname || idol.name);

    switch (eventType + ':' + choice) {

      // D社预警
      case 'dispatch:laylow':
        Game.State.addSuspicion(-5);
        Game.State.setDatingActionLock(idolIndex, 2);
        Game.State.addEventLog({ type: 'media', idolIndex: idolIndex, event: 'dispatch', choice: 'laylow',
          summary: '📰 面对D社预警，你选择低调行事。约会行动锁定2回合。' });
        showToast('低调行事 🔒', '你减少了公开露面。D社的记者暂时失去了目标。约会行动锁定2回合。', '📰',
          { suspicion: [-5, -5] }, 5000);
        break;

      case 'dispatch:ignore':
        Game.State.addSuspicion(3);
        Game.State.addEventLog({ type: 'media', idolIndex: idolIndex, event: 'dispatch', choice: 'ignore',
          summary: '📰 面对D社预警，你选择无视。风险继续累积...' });
        showToast('我行我素 😤', '你继续公开活动。D社的调查仍在继续，风险加大了。', '📰',
          { suspicion: [3, 3] }, 5000);
        break;

      case 'dispatch:pay':
        if (Math.random() < 0.5) {
          Game.State.addFollowers(randInRange([-10, -5]));
          showToast('花重金打点 💰', '你动用了人脉和金钱来平息此事。虽然花了不少，但嫌疑度大幅下降。', '📰',
            { suspicion: [-15, -15], followers: [-10, -5] }, 5000);
        } else {
          Game.State.addStress(10);
          showToast('花重金打点 💰', '你花了很大力气去摆平这件事。虽然成功了，但身心俱疲。', '📰',
            { suspicion: [-15, -15], stress: [10, 10] }, 5000);
        }
        Game.State.addSuspicion(-15);
        Game.State.addEventLog({ type: 'media', idolIndex: idolIndex, event: 'dispatch', choice: 'pay',
          summary: '📰 面对D社预警，你花重金打点。嫌疑度大幅下降。' });
        break;

      // 被拍事件
      case 'camera:public':
        Game.State.addFollowers(randInRange([50, 200]));
        Game.State.addSuspicion(randInRange([3, 5]));
        // 如果玩家有其他伴侣，触发出轨检测
        checkCheatingIfNeeded(idolIndex);
        Game.State.addEventLog({ type: 'media', idolIndex: idolIndex, event: 'camera', choice: 'public',
          summary: '📸 被拍后你选择公开承认。粉丝数增加，但伴侣可能注意到...' });
        showToast('公开承认 📢', '你在SNS上大方承认了。部分粉丝表示支持，但也有人在扒你的感情状况。', '📸',
          { followers: [50, 200], suspicion: [3, 5] }, 5000);
        break;

      case 'camera:deny':
        Game.State.addStress(10);
        Game.State.addSuspicion(randInRange([0, 2]));
        Game.State.addEventLog({ type: 'media', idolIndex: idolIndex, event: 'camera', choice: 'deny',
          summary: '📸 被拍后你迅速否认。暂时过关，但压力增加了。' });
        showToast('迅速否认 🙅', '你声称那只是角度巧合。"大家不要过度解读啦～"虽然暂时平息了讨论，但你觉得心累。', '📸',
          { stress: [10, 10], suspicion: [0, 2] }, 5000);
        break;

      case 'camera:suppress':
        Game.State.addFollowers(randInRange([-200, -50]));
        Game.State.addEventLog({ type: 'media', idolIndex: idolIndex, event: 'camera', choice: 'suppress',
          summary: '📸 被拍后你找人压下了照片。粉丝减少，但事态平息。' });
        showToast('找人压下 🤐', '你动用关系把照片和相关帖子都压了下去。虽然损失了一些关注者，但至少没人再讨论了。', '📸',
          { followers: [-200, -50] }, 5000);
        break;

      // 粉丝扒料
      case 'fan:delete':
        Game.State.addFollowers(randInRange([-50, -20]));
        Game.State.addEventLog({ type: 'media', idolIndex: idolIndex, event: 'fan', choice: 'delete',
          summary: '🔍 面对粉丝扒料，你删除了可疑帖子。粉丝减少但证据消失。' });
        showToast('删除帖子 🗑️', '你悄悄删除了几条"嫌疑"帖子。虽然有些粉丝发现了并取关，但证据链被打断了。', '🔍',
          { followers: [-50, -20] }, 5000);
        break;

      case 'fan:clarify':
        Game.State.addFollowers(randInRange([10, 30]));
        Game.State.incrementPosts();
        Game.State.addEventLog({ type: 'media', idolIndex: idolIndex, event: 'fan', choice: 'clarify',
          summary: '🔍 面对粉丝扒料，你发了澄清声明。粉丝小幅增长。' });
        showToast('发澄清声明 📝', '你发了一篇诚恳的澄清声明。"感谢大家的关心，但请不要过度解读我的个人生活～"部分粉丝表示理解。', '🔍',
          { followers: [10, 30] }, 5000);
        break;

      case 'fan:ignore':
        Game.State.addSuspicion(randInRange([5, 10]));
        Game.State.addEventLog({ type: 'media', idolIndex: idolIndex, event: 'fan', choice: 'ignore',
          summary: '🔍 面对粉丝扒料，你选择无视。嫌疑度大幅上升。' });
        showToast('无视 🙈', '你假装什么都没发生。但论坛上的讨论越来越激烈，更多人开始关注你了...', '🔍',
          { suspicion: [5, 10] }, 5000);
        break;
    }

    // 刷新面板
    if (Game.Relations) Game.Relations.refresh();
    if (Game.Profile) Game.Profile.refresh();
  }

  // ======================================================================
  //  🍊 名场面系统
  // ======================================================================

  /**
   * 检查并触发名场面
   */
  function checkFamousScene() {
    var currentTurn = Game.state.currentTurn || 0;
    var lastTurn = Game.state.lastFamousSceneTurn || 0;

    // 冷却检查（至少2回合间隔）
    if (currentTurn - lastTurn < 2) return;

    // 12% 基础概率
    if (Math.random() * 100 >= 12) return;

    // 随机选一个名场面
    var scene = FAMOUS_SCENES[Math.floor(Math.random() * FAMOUS_SCENES.length)];

    // 记录冷却
    Game.state.lastFamousSceneTurn = currentTurn;

    // 应用效果
    var effects = scene.effects || {};
    if (effects.affection) {
      // 随机选一个爱豆（如果有的话）
      var idols = Game.state.idols || [];
      if (idols.length > 0) {
        var ri = Math.floor(Math.random() * idols.length);
        Game.State.addAffection(ri, randInRange(effects.affection));
      }
    }
    if (effects.suspicion) Game.State.addSuspicion(randInRange(effects.suspicion));
    if (effects.stress) Game.State.addStress(randInRange(effects.stress));
    if (effects.charm) Game.State.addCharm(randInRange(effects.charm));
    if (effects.followers) Game.State.addFollowers(randInRange(effects.followers));

    // 事件日志
    Game.State.addEventLog({ type: 'famous-scene', scene: scene.id,
      summary: '🍊 名场面：' + scene.title + ' — ' + scene.text });

    // 显示Toast
    showToast(scene.icon + ' ' + scene.title, scene.text, scene.icon, effects, 6000);
  }

  // ======================================================================
  //  🎭 日常细节系统
  // ======================================================================

  /**
   * 检查纪念日
   */
  function checkAnniversary(idolIndex) {
    var idol = Game.state.idols[idolIndex];
    if (!idol) return;

    var currentTurn = Game.state.currentTurn || 0;
    var stage = idol.relationshipStage || 'pursuit';

    // 恋爱纪念日（每5回合提醒一次）
    if (stage === 'dating' || stage === 'married') {
      var datingStart = Game.State.getAnniversaryTurn(idolIndex, 'datingStart');
      if (datingStart > 0 && currentTurn > datingStart) {
        var turnsSinceDating = currentTurn - datingStart;
        // 每6回合（3个月）纪念一次
        if (turnsSinceDating > 0 && turnsSinceDating % 6 === 0) {
          var idolName = escapeHtml(idol.nickname || idol.name);
          var months = Math.floor(turnsSinceDating / 2); // 1回合=半个月 → 2回合=1个月
          showToast('💕 恋爱纪念提醒', '今天是你和' + idolName + '在一起的第' + months + '个月！要不要做点什么特别的？',
            '💕', null, 5000);
          Game.State.addEventLog({ type: 'anniversary', idolIndex: idolIndex, kind: 'dating',
            summary: '💕 ' + idolName + ' — 恋爱' + months + '个月纪念日' });
        }
      }
    }

    // 结婚纪念日
    if (stage === 'married') {
      var marriedStart = Game.State.getAnniversaryTurn(idolIndex, 'marriedStart');
      if (marriedStart > 0 && currentTurn > marriedStart) {
        var turnsSinceMarried = currentTurn - marriedStart;
        if (turnsSinceMarried > 0 && turnsSinceMarried % 12 === 0) {
          var idolName = escapeHtml(idol.nickname || idol.name);
          var yearsMarried = Math.floor(turnsSinceMarried / 24); // 24回合=1年
          showToast('💍 结婚纪念日！', '今天是你和' + idolName + '结婚' + Math.max(1, yearsMarried) + '周年的日子！💍✨',
            '💍', null, 6000);
          Game.State.addEventLog({ type: 'anniversary', idolIndex: idolIndex, kind: 'married',
            summary: '💍 ' + idolName + ' — 结婚' + Math.max(1, yearsMarried) + '周年纪念日' });
        }
      }
    }
  }

  /**
   * 同款物品被发现
   */
  function checkCoupleItem(idolIndex) {
    var idol = Game.state.idols[idolIndex];
    if (!idol) return;

    var idolName = escapeHtml(idol.nickname || idol.name);
    var items = ['手机壳', '手链', '帽子', '卫衣', '戒指', '项链', '鞋子', '包包'];
    var item = items[Math.floor(Math.random() * items.length)];

    Game.State.addSuspicion(randInRange([2, 5]));
    Game.State.addFollowers(randInRange([10, 30]));

    Game.State.addEventLog({ type: 'couple-item', idolIndex: idolIndex,
      summary: '🎭 有人发现你和' + idolName + '用了同款' + item + '。论坛上开始讨论...' });

    showToast('👜 同款物品被发现', '有眼尖的粉丝发现你和' + idolName + '最近都使用了同一款' + item + '。这是巧合还是...？',
      '👜', { suspicion: [2, 5], followers: [10, 30] }, 5000);
  }

  /**
   * 爱豆生病探望
   */
  function checkSickVisit() {
    var idols = Game.state.idols || [];
    if (idols.length === 0) return;

    // 随机选一个爱豆
    var idx = Math.floor(Math.random() * idols.length);
    var idol = idols[idx];
    var idolName = escapeHtml(idol.nickname || idol.name);

    var modal = document.getElementById('media-event-modal');
    var title = document.getElementById('media-event-modal-title');
    var body = document.getElementById('media-event-modal-body');
    var actions = document.getElementById('media-event-modal-actions');
    if (!modal || !title || !body || !actions) return;

    title.textContent = '🏥 ' + idolName + ' 生病了';
    body.innerHTML = ''
      + '<div class="media-event-scene">'
      +   '<p>你听说<strong>' + idolName + '</strong>最近因为行程太满生病了。</p>'
      +   '<p>据说正在宿舍休息，状态不太好。要不要去探望一下？</p>'
      + '</div>';

    actions.innerHTML = ''
      + '<button class="target-modal-btn media-option-safe" onclick="Game.Reality._resolveSickVisit(' + idx + ', \'visit\')">'
      +   '🏃 去探望<br><small>好感+3~6，但有被拍风险</small>'
      + '</button>'
      + '<button class="target-modal-btn media-option-risk" onclick="Game.Reality._resolveSickVisit(' + idx + ', \'message\')">'
      +   '💬 发消息关心<br><small>好感+1~2，安全无风险</small>'
      + '</button>';

    modal.style.display = 'flex';
  }

  /**
   * 处理生病探望选择
   */
  function _resolveSickVisit(idolIndex, choice) {
    var modal = document.getElementById('media-event-modal');
    if (modal) modal.style.display = 'none';

    var idol = Game.state.idols[idolIndex];
    if (!idol) return;
    var idolName = escapeHtml(idol.nickname || idol.name);

    if (choice === 'visit') {
      Game.State.addAffection(idolIndex, randInRange([3, 6]));
      var extraSuspicious = Math.random() < 0.4 ? randInRange([1, 5]) : 0;
      if (extraSuspicious > 0) Game.State.addSuspicion(extraSuspicious);
      Game.State.addEventLog({ type: 'sick-visit', idolIndex: idolIndex, choice: 'visit',
        summary: '🏥 你亲自去探望生病的' + idolName + '。ta很感动。' + (extraSuspicious > 0 ? '（但被路人看到了）' : '') });
      showToast('探望成功 🏃', idolName + '看到你来了非常感动。"你怎么来了...谢谢' + (Game.Actions ? Game.Actions.getHonorific(idol.gender) : '') + '～"',
        '🏥', { affection: [3, 6], suspicion: extraSuspicious > 0 ? [1, 5] : [0, 0] }, 5000);
    } else {
      Game.State.addAffection(idolIndex, randInRange([1, 2]));
      Game.State.addEventLog({ type: 'sick-visit', idolIndex: idolIndex, choice: 'message',
        summary: '🏥 你发了消息关心生病的' + idolName + '。ta回复说谢谢。' });
      showToast('消息已发送 💬', '你发了暖心的消息给' + idolName + '。ta回复了一连串的❤️。', '🏥',
        { affection: [1, 2] }, 4000);
    }

    if (Game.Relations) Game.Relations.refresh();
    if (Game.Profile) Game.Profile.refresh();
  }

  /**
   * 定位共享建议（恋爱首回合50%触发）
   */
  function checkLocationSharing(idolIndex) {
    var idol = Game.state.idols[idolIndex];
    if (!idol) return;
    if (Game.State.hasLocationSharing(idolIndex)) return; // 已开启

    var idolName = escapeHtml(idol.nickname || idol.name);

    var modal = document.getElementById('media-event-modal');
    var title = document.getElementById('media-event-modal-title');
    var body = document.getElementById('media-event-modal-body');
    var actions = document.getElementById('media-event-modal-actions');
    if (!modal || !title || !body || !actions) return;

    title.textContent = '📍 定位共享';
    body.innerHTML = ''
      + '<div class="media-event-scene">'
      +   '<p><strong>' + idolName + '</strong>提议开启手机定位共享。</p>'
      +   '<p>"这样我们就能知道对方在哪儿了～比较安心嘛。而且万一被查岗也能马上证明清白～"</p>'
      + '</div>';

    actions.innerHTML = ''
      + '<button class="target-modal-btn media-option-safe" onclick="Game.Reality._resolveLocationSharing(' + idolIndex + ', true)">'
      +   '✅ 开启共享<br><small>查岗时撒娇被抓概率降低</small>'
      + '</button>'
      + '<button class="target-modal-btn media-option-risk" onclick="Game.Reality._resolveLocationSharing(' + idolIndex + ', false)">'
      +   '❌ 婉拒<br><small>"我觉得没必要吧..."</small>'
      + '</button>';

    modal.style.display = 'flex';
  }

  /**
   * 处理定位共享选择
   */
  function _resolveLocationSharing(idolIndex, enabled) {
    var modal = document.getElementById('media-event-modal');
    if (modal) modal.style.display = 'none';

    var idol = Game.state.idols[idolIndex];
    if (!idol) return;
    var idolName = escapeHtml(idol.nickname || idol.name);

    Game.State.setLocationSharing(idolIndex, enabled);
    Game.State.setAnniversaryTurn(idolIndex, 'locationSharing', Game.state.currentTurn);

    if (enabled) {
      showToast('定位共享已开启 📍', '你和' + idolName + '现在可以随时看到对方的实时位置了。查岗时更难被抓到破绽～', '📍', null, 4000);
    } else {
      showToast('婉拒了定位共享 ❌', idolName + '有点小失望，但表示理解。"没关系啦～我相信你"', '📍', null, 4000);
    }

    Game.State.addEventLog({ type: 'location-sharing', idolIndex: idolIndex, enabled: enabled,
      summary: '📍 定位共享：' + (enabled ? '与' + idolName + '开启' : '婉拒了' + idolName + '的提议') });
  }

  // ======================================================================
  //  公开API
  // ======================================================================

  function isDatingActionLocked(idolIndex) {
    return Game.State.isDatingActionLocked(idolIndex);
  }

  function hasMediaFlag(idolIndex, flagType) {
    return Game.State.hasMediaEventFlag(idolIndex, flagType);
  }

  function init() {
    console.log('[Reality] 现实元素系统初始化完成');
  }

  return {
    init,
    // 查岗
    triggerPartnerCheckIns,
    triggerCompanyCheckIn,
    handleCheckInReply,
    showCheckInModal,
    // 媒体事件
    checkDispatchWarning,
    checkCaughtOnCamera,
    checkFanInvestigation,
    _resolveMediaEvent,
    // 名场面
    checkFamousScene,
    // 日常细节
    checkAnniversary,
    checkCoupleItem,
    checkSickVisit,
    checkLocationSharing,
    _resolveSickVisit,
    _resolveLocationSharing,
    // 工具
    isDatingActionLocked,
    hasMediaFlag,
    showToast
  };

})();
