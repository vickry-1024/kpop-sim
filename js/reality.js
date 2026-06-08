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
  //  👥 亲友社交圈
  // ======================================================================

  /**
   * 闺蜜态度事件
   * 每5-8回合触发一次，根据嫌疑度和关系阶段变化内容
   */
  function checkBestFriendReaction() {
    var currentTurn = Game.state.currentTurn || 0;
    var lastTurn = Game.State.getBestFriendCooldown();
    if (currentTurn - lastTurn < 5) return;
    if (Math.random() * 100 > 30) return;

    Game.State.setBestFriendCooldown(currentTurn);

    var suspicion = Game.state.player.stats.suspicion || 0;
    var idols = Game.state.idols || [];
    var friendName = '小美'; // 默认闺蜜名（后续可从存档读取）
    var friendData = Game.State.getFriendById ? Game.State.getFriendById('friend-bestie') : null;
    if (friendData && friendData.name) friendName = friendData.name;

    // 根据情况选择不同的闺蜜对话
    var message = '';
    var options = [];

    if (suspicion >= 60) {
      message = '喂喂喂！我跟你讲，最近论坛上好多人都在传你的事情...你是不是有事情没告诉我啊？😳';
      options = [
        { label: '📞 全盘托出', choice: 'confide_all',
          desc: '把最近的经历都告诉闺蜜。压力-5~10，嫌疑度-3' },
        { label: '😅 含糊其辞', choice: 'evade',
          desc: '"没什么大事啦～你想多了"' },
        { label: '🤐 坚决否认', choice: 'deny',
          desc: '"那都是乱传的，别信" 压力+5' }
      ];
    } else if (suspicion >= 20 || hasAnyDatingOrMarried()) {
      message = '嘿～我听说你最近跟那个爱豆走得挺近的嘛...怎么样怎么样？给我更新一下近况呗！🤭';
      options = [
        { label: '💬 分享一下', choice: 'share',
          desc: '和闺蜜聊聊近况。压力-3~8，心情变好' },
        { label: '🙊 保持神秘', choice: 'mystery',
          desc: '"时机到了自然告诉你啦～"' },
        { label: '😤 嫌她太八卦', choice: 'annoyed',
          desc: '"你能不能别这么八卦啊" 压力+3' }
      ];
    } else {
      message = '你这几天怎么老是盯着手机傻笑？是不是有什么好事瞒着我呀～我请你喝奶茶，你讲给我听！🧋';
      options = [
        { label: '🧋 跟她聊聊', choice: 'chat',
          desc: '和闺蜜聊聊天放松。压力-2~5' },
        { label: '😊 微笑不语', choice: 'smile',
          desc: '保持神秘感' }
      ];
    }

    showSocialModal('👯 闺蜜 ' + escapeHtml(friendName), message, options, function(choice) {
      resolveBestFriend(choice, friendName);
    });
  }

  function hasAnyDatingOrMarried() {
    var idols = Game.state.idols || [];
    for (var i = 0; i < idols.length; i++) {
      var s = idols[i].relationshipStage || 'pursuit';
      if (s === 'dating' || s === 'married') return true;
    }
    return false;
  }

  function resolveBestFriend(choice, friendName) {
    switch (choice) {
      case 'confide_all':
        Game.State.addStress(randInRange([-10, -5]));
        Game.State.addSuspicion(randInRange([-3, -1]));
        showToast('全盘托出 💬', '你跟' + escapeHtml(friendName) + '把事情的来龙去脉都说了。她认真地听完，拍了拍你的肩膀。"不管怎样，我都支持你！"',
          '👯', { stress: [-10, -5], suspicion: [-3, -1] }, 4000);
        break;
      case 'evade':
        showToast('含糊其辞 😅', escapeHtml(friendName) + '翻了个白眼。"行行行，你不说我也能猜到七八分..."',
          '👯', null, 4000);
        break;
      case 'deny':
        Game.State.addStress(randInRange([3, 5]));
        showToast('坚决否认 🤐', '虽然嘴上否认了，但' + escapeHtml(friendName) + '明显不信。你心里也觉得对闺蜜撒谎不太好...',
          '👯', { stress: [3, 5] }, 4000);
        break;
      case 'share':
        Game.State.addStress(randInRange([-8, -3]));
        showToast('分享近况 💬', escapeHtml(friendName) + '听得眼睛发亮。"天哪天哪天哪！这也太甜了吧！！"',
          '👯', { stress: [-8, -3] }, 4000);
        break;
      case 'mystery':
        showToast('保持神秘 🙊', escapeHtml(friendName) + '做了个鬼脸。"哼，小气鬼！不过看你开心的样子，应该还不错～"',
          '👯', null, 4000);
        break;
      case 'annoyed':
        Game.State.addStress(randInRange([2, 3]));
        showToast('嫌她八卦 😤', escapeHtml(friendName) + '愣了一下，有点委屈。"我...我只是关心你而已嘛。"',
          '👯', { stress: [2, 3] }, 4000);
        break;
      default:
        // chat / smile
        Game.State.addStress(randInRange([-5, -2]));
        showToast('闺蜜时光 💕', '和' + escapeHtml(friendName) + '聊了会儿天，心情好了不少。有好朋友真好～',
          '👯', { stress: [-5, -2] }, 4000);
    }

    Game.State.addEventLog({ type: 'best-friend', choice: choice,
      summary: '👯 闺蜜' + escapeHtml(friendName) + '找你聊天（' + choice + '）' });
  }

  /**
   * 家人反应事件
   * 嫌疑度>=30且有恋爱/已婚关系时，15%概率触发
   */
  function checkFamilyReaction() {
    var currentTurn = Game.state.currentTurn || 0;
    var idols = Game.state.idols || [];
    var suspicion = Game.state.player.stats.suspicion || 0;

    if (suspicion < 30) return;

    // 找到第一个有家人反应价值的爱豆
    var targetIndex = -1;
    for (var i = 0; i < idols.length; i++) {
      var stage = idols[i].relationshipStage || 'pursuit';
      if (stage !== 'dating' && stage !== 'married') continue;
      if (Game.State.getFamilyReaction(i)) continue; // 已触发过
      targetIndex = i;
      break;
    }
    if (targetIndex < 0) return;

    // 15%概率
    if (Math.random() * 100 > 15) return;

    var idol = idols[targetIndex];
    var idolName = escapeHtml(idol.nickname || idol.name);
    var stage = idol.relationshipStage || 'pursuit';
    var isMarried = stage === 'married';

    var message, options;
    if (suspicion >= 70) {
      message = '家里来电话了...爸妈好像看到了网上的那些传言。\n\n"我们听说了你的事情。我们不是反对，但是...和一个爱豆在一起，你想过后果吗？你的事业、你的生活...你真的准备好了吗？"';
      options = [
        { label: '❤️ 坦诚沟通', choice: 'honest',
          desc: '认真跟家人解释你们的关系。压力+5，但嫌疑度-8' },
        { label: '😰 闪烁其词', choice: 'evade',
          desc: '"那都是网上乱传的..." 压力+10' },
        { label: '💪 坚定表态', choice: 'firm',
          desc: '"我考虑清楚了，请相信我" 嫌疑度-3，好感+1~2' }
      ];
    } else if (suspicion >= 40) {
      message = '妈妈打来电话，语气有些担忧。\n\n"宝贝，妈妈看到你最近在SNS上的一些动态...那个人，是认真的吗？妈妈只是不想你受伤。"';
      options = [
        { label: '💕 安抚解释', choice: 'reassure',
          desc: '让家人放心。压力-3，嫌疑度-2' },
        { label: '😤 不耐烦', choice: 'impatient',
          desc: '"妈你别管了！" 压力+3' }
      ];
    } else {
      message = '回家吃饭时，父母似乎有话想问又不敢问。\n\n"那个...最近是不是谈恋爱了？看起来挺开心的样子。"空气安静了几秒。';
      options = [
        { label: '😊 大方承认', choice: 'admit',
          desc: '"嗯，在和一个很好的人交往。"' },
        { label: '🙊 暂时不说', choice: 'deflect',
          desc: '"吃饭吃饭～别聊这个啦"' }
      ];
    }

    showSocialModal('👨‍👩‍👧 家人的关心', message, options, function(choice) {
      resolveFamilyReaction(targetIndex, choice, idolName, isMarried);
    });
  }

  function resolveFamilyReaction(idolIndex, choice, idolName, isMarried) {
    switch (choice) {
      case 'honest':
        Game.State.addStress(randInRange([3, 5]));
        Game.State.addSuspicion(randInRange([-8, -5]));
        Game.State.setFamilyReaction(idolIndex, 'supportive');
        showToast('坦诚沟通 ❤️', '你花了很长时间跟家人解释了你们的关系。虽然他们还有些担心，但最终表示理解。"只要是你自己的选择，我们支持你。"',
          '👨‍👩‍👧', { stress: [3, 5], suspicion: [-8, -5] }, 5000);
        break;
      case 'evade':
        Game.State.addStress(randInRange([8, 10]));
        Game.State.setFamilyReaction(idolIndex, 'worried');
        showToast('闪烁其词 😰', '电话那头的沉默让你很不舒服。你知道他们只是关心你，但你现在还没准备好说清楚...',
          '👨‍👩‍👧', { stress: [8, 10] }, 5000);
        break;
      case 'firm':
        Game.State.addSuspicion(randInRange([-3, -1]));
        Game.State.addAffection(idolIndex, randInRange([1, 2]));
        Game.State.setFamilyReaction(idolIndex, 'supportive');
        showToast('坚定表态 💪', '你的坚定让家人沉默了。最后爸爸叹了口气："行吧，你长大了。有事情随时跟我们说。"',
          '👨‍👩‍👧', { suspicion: [-3, -1], affection: [1, 2] }, 5000);
        break;
      case 'reassure':
        Game.State.addStress(randInRange([-3, -1]));
        Game.State.addSuspicion(randInRange([-2, -1]));
        Game.State.setFamilyReaction(idolIndex, 'supportive');
        showToast('安抚解释 💕', '"妈你放心吧，我挺好的。等时机合适，我带ta回来给你们看看。"电话那头的声音轻松了不少。',
          '👨‍👩‍👧', { stress: [-3, -1], suspicion: [-2, -1] }, 5000);
        break;
      case 'impatient':
        Game.State.addStress(randInRange([2, 3]));
        Game.State.setFamilyReaction(idolIndex, 'worried');
        showToast('不耐烦 😤', '挂了电话后你觉得有点愧疚。他们只是关心你而已...',
          '👨‍👩‍👧', { stress: [2, 3] }, 4000);
        break;
      default:
        // admit / deflect
        Game.State.setFamilyReaction(idolIndex, choice === 'admit' ? 'supportive' : 'neutral');
        showToast(choice === 'admit' ? '大方承认 😊' : '暂时不说 🙊',
          choice === 'admit' ? '父母相视一笑。"好吧，有空带回来吃顿饭。"' : '你机智地把话题转移到了今天的菜色上。父母也没再追问。',
          '👨‍👩‍👧', null, 4000);
    }

    Game.State.addEventLog({ type: 'family-reaction', idolIndex: idolIndex,
      summary: '👨‍👩‍👧 家人对' + escapeHtml(idolName) + '的关系产生了反应（' + choice + '）' });
    refreshPanels();
  }

  /**
   * 队友态度事件
   * 当与某爱豆恋爱/结婚时，其队友可能表态
   */
  function checkTeammateAttitude() {
    var currentTurn = Game.state.currentTurn || 0;
    var idols = Game.state.idols || [];

    for (var i = 0; i < idols.length; i++) {
      var stage = idols[i].relationshipStage || 'pursuit';
      if (stage !== 'dating' && stage !== 'married') continue;
      if (Game.State.getTeammateAttitude(i)) continue; // 已触发

      // 15%概率
      if (Math.random() * 100 > 15) continue;

      var idol = idols[i];
      var idolName = escapeHtml(idol.nickname || idol.name);
      var isMarried = stage === 'married';

      // 随机队友名
      var teammateNames = ['知秀', '泰民', '秀雅', '珉奎', '多贤', '志勋', '彩瑛', '范洙', '娜恩', '圣俊'];
      var teammateName = teammateNames[Math.floor(Math.random() * teammateNames.length)];

      // 60% 支持 / 40% 警惕
      var isSupportive = Math.random() < 0.6;

      var message, options;
      if (isSupportive) {
        message = '你收到了一条来自' + escapeHtml(teammateName) + '（' + idolName + '的队友）的私信：\n\n"嘿！我是' + escapeHtml(teammateName) + '～' + idolName + '跟我们提起过你。听说你们在一起了，真心为你们高兴！💕\n\n以后有什么事可以找我帮忙哦～我帮你们打掩护！"';
        options = [
          { label: '🙏 表示感谢', choice: 'thank',
            desc: '感谢队友的支持。' + idolName + '好感和魅力+1~2' },
          { label: '😊 友好回应', choice: 'friendly',
            desc: '礼貌回应。好感+1' }
        ];
      } else {
        message = '你收到了一条来自' + escapeHtml(teammateName) + '（' + idolName + '的队友）的消息：\n\n"听着，我是' + escapeHtml(teammateName) + '，' + idolName + '的队友。我知道你们的事了。\n\n说实话，我很担心。我们团现在正是上升期，如果' + idolName + '的恋情曝光，对全团都是打击。我不是针对你，但...请你们务必小心。不要影响团队。"';
        options = [
          { label: '🤝 表达理解', choice: 'understand',
            desc: '表示理解队友的担心。嫌疑度-2，但压力+3' },
          { label: '😤 感到不满', choice: 'offended',
            desc: '"你凭什么干涉我们？" 嫌疑度+3' },
          { label: '😐 已读不回', choice: 'ignore',
            desc: '选择无视这条消息' }
        ];
      }

      showSocialModal('🎤 ' + escapeHtml(teammateName) + '（队友）的消息', message, options, function(choice) {
        resolveTeammateAttitude(i, choice, idolName, teammateName, isSupportive, isMarried);
      });
      return; // 每回合最多1次
    }
  }

  function resolveTeammateAttitude(idolIndex, choice, idolName, teammateName, isSupportive, isMarried) {
    if (isSupportive) {
      switch (choice) {
        case 'thank':
          Game.State.addAffection(idolIndex, randInRange([1, 2]));
          Game.State.addCharm(randInRange([1, 2]));
          Game.State.setTeammateAttitude(idolIndex, 'supportive');
          showToast('队友支持 💕', escapeHtml(teammateName) + '回了一个笑脸。"不客气！你们要一直幸福下去哦～❤️"',
            '🎤', { affection: [1, 2], charm: [1, 2] }, 4000);
          break;
        default:
          Game.State.addAffection(idolIndex, 1);
          Game.State.setTeammateAttitude(idolIndex, 'supportive');
          showToast('友好回应 😊', escapeHtml(teammateName) + '显得很高兴。"以后就是自己人了！"',
            '🎤', { affection: [1, 1] }, 4000);
      }
    } else {
      switch (choice) {
        case 'understand':
          Game.State.addSuspicion(randInRange([-2, -1]));
          Game.State.addStress(randInRange([2, 3]));
          Game.State.setTeammateAttitude(idolIndex, 'neutral');
          showToast('表达理解 🤝', '你回复了一段诚恳的消息，表示理解团队的压力。' + escapeHtml(teammateName) + '回复："谢谢你能理解。我会尽量帮你们的。"',
            '🎤', { suspicion: [-2, -1], stress: [2, 3] }, 4000);
          break;
        case 'offended':
          Game.State.addSuspicion(randInRange([2, 3]));
          Game.State.setTeammateAttitude(idolIndex, 'hostile');
          showToast('感到不满 😤', '你的强硬回复让' + escapeHtml(teammateName) + '很不满。未来的团队氛围可能会更紧张...',
            '🎤', { suspicion: [2, 3] }, 4000);
          break;
        default:
          Game.State.setTeammateAttitude(idolIndex, 'neutral');
          showToast('已读不回 😐', '你没有回复。也许沉默是最好的回应...至少目前是这样。',
            '🎤', null, 4000);
      }
    }

    Game.State.addEventLog({ type: 'teammate-attitude', idolIndex: idolIndex,
      summary: '🎤 ' + idolName + '的队友' + escapeHtml(teammateName) + '表态（' + (isSupportive ? '支持' : '警惕') + '）' });
    refreshPanels();
  }

  // ======================================================================
  //  🏢 公司干涉完整版
  // ======================================================================

  /**
   * 禁爱令事件
   * 高嫌疑度下公司可能介入，强制禁爱
   */
  function checkDatingBan() {
    var currentTurn = Game.state.currentTurn || 0;
    var suspicion = Game.state.player.stats.suspicion || 0;
    var idols = Game.state.idols || [];

    if (suspicion < 50) return;

    // 找恋爱/已婚爱豆，且未被禁爱
    for (var i = 0; i < idols.length; i++) {
      var stage = idols[i].relationshipStage || 'pursuit';
      if (stage !== 'dating' && stage !== 'married') continue;
      if (Game.State.hasDatingBan(i)) continue;

      // 12%概率
      if (Math.random() * 100 > 12) continue;

      var idol = idols[i];
      var idolName = escapeHtml(idol.nickname || idol.name);
      var companyName = (idol.group || '所属公司') + '娱乐';

      var message = '你收到了一封来自' + escapeHtml(companyName) + '的正式通知：\n\n"经公司内部讨论，鉴于近期舆论环境，公司决定对旗下艺人' + idolName + '实施禁爱令管理。请在以下选项中做出选择：\n\n如不配合，公司将采取进一步措施。"';
      var options = [
        { label: '📝 配合禁爱令', choice: 'comply',
          desc: '遵守规定，约会行动锁定3回合' },
        { label: '💼 协商谈判', choice: 'negotiate',
          desc: '尝试与公司协商。粉丝-10~30，禁爱令缩短为1回合' },
        { label: '🚫 坚决对抗', choice: 'defy',
          desc: '"我不会放弃的。" 嫌疑度+10，可能触发公司进一步行动' }
      ];

      showSocialModal('🏢 禁爱令通知', message, options, function(choice) {
        resolveDatingBan(i, choice, idolName, companyName);
      });
      return;
    }
  }

  function resolveDatingBan(idolIndex, choice, idolName, companyName) {
    switch (choice) {
      case 'comply':
        Game.State.setDatingBan(idolIndex, 3);
        Game.State.addStress(randInRange([5, 10]));
        Game.State.addSuspicion(randInRange([-5, -3]));
        showToast('配合禁爱令 📝', '你签了字，同意在接下来的一个半月内减少与' + idolName + '的公开接触。虽然心里难受，但至少暂时安全了。',
          '🏢', { stress: [5, 10], suspicion: [-5, -3] }, 5000);
        break;
      case 'negotiate':
        Game.State.addFollowers(randInRange([-30, -10]));
        Game.State.setDatingBan(idolIndex, 1);
        Game.State.addStress(randInRange([3, 5]));
        showToast('协商谈判 💼', '经过一番艰难的谈判，公司同意缩短限制时间，但要求你在SNS上配合公司宣传作为交换。粉丝有轻微流失。',
          '🏢', { followers: [-30, -10], stress: [3, 5] }, 5000);
        break;
      case 'defy':
        Game.State.addSuspicion(randInRange([8, 10]));
        Game.State.addStress(randInRange([5, 10]));
        showToast('坚决对抗 🚫', '你态度强硬地拒绝了禁爱令。' + escapeHtml(companyName) + '的负责人脸色铁青。"你会后悔的。"',
          '🏢', { suspicion: [8, 10], stress: [5, 10] }, 5000);
        break;
    }

    Game.State.addEventLog({ type: 'dating-ban', idolIndex: idolIndex,
      summary: '🏢 ' + escapeHtml(companyName) + '对' + idolName + '发布禁爱令（选择：' + choice + '）' });
    refreshPanels();
  }

  /**
   * 封口协议事件
   * 媒体压力大时公司可能要求签署保密协议
   */
  function checkGagOrder() {
    var currentTurn = Game.state.currentTurn || 0;
    var suspicion = Game.state.player.stats.suspicion || 0;
    var idols = Game.state.idols || [];

    if (suspicion < 40) return;

    for (var i = 0; i < idols.length; i++) {
      var stage = idols[i].relationshipStage || 'pursuit';
      if (stage !== 'dating' && stage !== 'married') continue;
      if (Game.State.hasGagOrder(i)) continue;

      // 18%概率
      if (Math.random() * 100 > 18) continue;

      var idol = idols[i];
      var idolName = escapeHtml(idol.nickname || idol.name);
      var companyName = (idol.group || '所属公司') + '娱乐';

      var message = '一位自称是' + escapeHtml(companyName) + '法务部的人联系了你：\n\n"您好，关于您与本公司旗下艺人' + idolName + '的关系，公司希望与您签署一份保密协议（NDA）。\n\n协议内容：您不得向任何第三方透露与该艺人的关系细节，不得在任何公开平台发布相关信息。违反协议将面临法律后果。"';
      var options = [
        { label: '✍️ 签署协议', choice: 'sign',
          desc: '签署NDA。压力+10，嫌疑度-10，但SNS发帖功能受限2回合' },
        { label: '🤔 暂不签署', choice: 'delay',
          desc: '"我需要时间考虑。" 嫌疑度+3' },
        { label: '❌ 拒绝签署', choice: 'refuse',
          desc: '"我没什么好藏的。" 嫌疑度+8，但自由度不变' }
      ];

      showSocialModal('📄 保密协议', message, options, function(choice) {
        resolveGagOrder(i, choice, idolName, companyName);
      });
      return;
    }
  }

  function resolveGagOrder(idolIndex, choice, idolName, companyName) {
    switch (choice) {
      case 'sign':
        Game.State.setGagOrder(idolIndex);
        Game.State.addStress(randInRange([8, 10]));
        Game.State.addSuspicion(randInRange([-10, -7]));
        // 签署后2回合SNS发帖受限（通过锁定约会行动来体现）
        Game.State.setDatingActionLock(idolIndex, 2);
        showToast('签署协议 ✍️', '你签下了自己的名字。从现在起，你不能再在SNS上随意发言了。虽然憋得慌，但至少暂时把风险压下去了。',
          '📄', { stress: [8, 10], suspicion: [-10, -7] }, 5000);
        break;
      case 'delay':
        Game.State.addSuspicion(randInRange([2, 3]));
        showToast('暂不签署 🤔', '"我需要仔细看看条款。"法务部的人皱了皱眉，但没再说什么。不过你知道这只是暂时的。',
          '📄', { suspicion: [2, 3] }, 4000);
        break;
      case 'refuse':
        Game.State.addSuspicion(randInRange([6, 8]));
        showToast('拒绝签署 ❌', '法务部的人脸色一沉。"您知道这样做的后果吗？公司有权采取进一步行动保护艺人权益。"',
          '📄', { suspicion: [6, 8] }, 5000);
        break;
    }

    Game.State.addEventLog({ type: 'gag-order', idolIndex: idolIndex,
      summary: '📄 ' + escapeHtml(companyName) + '要求签署关于' + idolName + '的保密协议（选择：' + choice + '）' });
    refreshPanels();
  }

  /**
   * 限制接触事件
   * 公司或经纪人限制你接触爱豆
   */
  function checkContactRestriction() {
    var currentTurn = Game.state.currentTurn || 0;
    var suspicion = Game.state.player.stats.suspicion || 0;
    var idols = Game.state.idols || [];

    if (suspicion < 45) return;

    for (var i = 0; i < idols.length; i++) {
      var stage = idols[i].relationshipStage || 'pursuit';
      if (stage !== 'dating' && stage !== 'married') continue;
      if (Game.State.hasContactRestriction(i)) continue;

      // 15%概率，有禁爱令或封口协议时提高到25%
      var baseChance = 15;
      if (Game.State.hasDatingBan(i) || Game.State.hasGagOrder(i)) baseChance = 25;
      if (Math.random() * 100 > baseChance) continue;

      var idol = idols[i];
      var idolName = escapeHtml(idol.nickname || idol.name);
      var managerName = '经纪人';
      var intervention = Game.State.getManagerIntervention(i);
      if (intervention && intervention.managerName) managerName = intervention.managerName;

      var message = escapeHtml(managerName) + '发来了一条消息：\n\n"最近风声太紧了。公司要求我加强对' + idolName + '的行程管理。接下来的几周，你们见面会比较困难。\n\n这是为了保护你们，请理解。"';
      var options = [
        { label: '😔 接受安排', choice: 'accept',
          desc: '接受限制。约会对' + idolName + '的好感获取减半3回合' },
        { label: '🔍 找其他方式', choice: 'workaround',
          desc: '想办法绕开限制。体力-20，维持正常好感获取' },
        { label: '😤 抗议', choice: 'protest',
          desc: '"这太不合理了！" 压力+5，嫌疑度+3' }
      ];

      showSocialModal('🚧 接触限制', message, options, function(choice) {
        resolveContactRestriction(i, choice, idolName, managerName);
      });
      return;
    }
  }

  function resolveContactRestriction(idolIndex, choice, idolName, managerName) {
    switch (choice) {
      case 'accept':
        Game.State.setContactRestriction(idolIndex, 2, 3); // 中度限制3回合
        Game.State.addStress(randInRange([3, 5]));
        Game.State.addSuspicion(randInRange([-3, -1]));
        showToast('接受安排 😔', '你回复"好的，我理解。"虽然心里一万个不愿意，但为了长远的打算，暂时的忍耐是值得的。',
          '🚧', { stress: [3, 5], suspicion: [-3, -1] }, 5000);
        break;
      case 'workaround':
        Game.State.addStamina(randInRange([-25, -20]));
        showToast('找其他方式 🔍', '你花了很大精力安排了秘密见面的方式。修改了行程、找了中间人传话...虽然累，但至少能维持联系。',
          '🚧', { stamina: [-25, -20] }, 5000);
        break;
      case 'protest':
        Game.State.addStress(randInRange([4, 5]));
        Game.State.addSuspicion(randInRange([2, 3]));
        showToast('抗议 😤', escapeHtml(managerName) + '叹了口气。"我是为了你们好。如果你执意这样，后果自负。"',
          '🚧', { stress: [4, 5], suspicion: [2, 3] }, 5000);
        break;
    }

    Game.State.addEventLog({ type: 'contact-restriction', idolIndex: idolIndex,
      summary: '🚧 ' + escapeHtml(managerName) + '限制了你与' + idolName + '的接触（选择：' + choice + '）' });
    refreshPanels();
  }

  // ======================================================================
  //  通用社交弹窗（亲友社交圈 & 公司干涉共用）
  // ======================================================================

  /**
   * 通用社交事件弹窗
   * 复用 media-event-modal
   */
  function showSocialModal(title, message, options, callback) {
    var modal = document.getElementById('media-event-modal');
    var titleEl = document.getElementById('media-event-modal-title');
    var bodyEl = document.getElementById('media-event-modal-body');
    var actionsEl = document.getElementById('media-event-modal-actions');

    if (!modal || !titleEl || !bodyEl || !actionsEl) return;

    titleEl.textContent = title;
    bodyEl.innerHTML = '<div class="media-event-scene">' +
      '<p style="white-space:pre-line">' + escapeHtml(message) + '</p>' +
      '</div>';

    var actionsHtml = '';
    for (var i = 0; i < options.length; i++) {
      var opt = options[i];
      var cls = 'media-option-safe';
      if (i === options.length - 1 && options.length > 2) cls = 'media-option-pay';
      else if (i === 1 && options.length === 3) cls = 'media-option-risk';
      actionsHtml += '<button class="target-modal-btn ' + cls + '" data-choice="' + opt.choice + '">' +
        escapeHtml(opt.label) + '<br><small>' + escapeHtml(opt.desc || '') + '</small>' +
        '</button>';
    }
    actionsEl.innerHTML = actionsHtml;

    // 绑定事件（使用一次性监听避免重复绑定）
    actionsEl._callback = callback;
    if (!actionsEl._listenerBound) {
      actionsEl._listenerBound = true;
      actionsEl.addEventListener('click', function(e) {
        var btn = e.target.closest('button');
        if (!btn) return;
        var choice = btn.dataset.choice;
        if (!choice) return;
        modal.style.display = 'none';
        if (actionsEl._callback) {
          actionsEl._callback(choice);
          actionsEl._callback = null;
        }
      });
    }

    modal.style.display = 'flex';
  }

  /**
   * 刷新面板
   */
  function refreshPanels() {
    if (Game.Relations) Game.Relations.refresh();
    if (Game.Profile) Game.Profile.refresh();
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
    Game.DEBUG && console.log('[Reality] 现实元素系统初始化完成');
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
    // 亲友社交圈
    checkBestFriendReaction,
    checkFamilyReaction,
    checkTeammateAttitude,
    // 公司干涉
    checkDatingBan,
    checkGagOrder,
    checkContactRestriction,
    // 工具
    isDatingActionLocked,
    hasMediaFlag,
    showToast
  };

})();
