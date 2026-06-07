/**
 * 关系阶段系统模块 — 攻略→恋爱→结婚 三阶段推进
 * 负责：阶段转换检测、告白/求婚事件、出轨判定、分手/离婚
 */

Game.Relationship = (() => {

  // ===== 常量配置 =====

  var DATING_THRESHOLD = 33;       // 进入恋爱期的好感度门槛
  var PROPOSAL_THRESHOLD = 90;     // 进入结婚的好感度门槛
  var CHEATING_BASE = 3;           // 每次出轨基础嫌疑度
  var CHEATING_MEDIUM = 5;         // 中强度出轨额外+2
  var CHEATING_HEAVY = 8;          // 高强度出轨额外+3
  var BREAKUP_CHEATING_THRESHOLD = 25; // 出轨嫌疑度达到此值开始有概率被发现
  var BREAKUP_DISCOVERY_CHANCE = 0.5;  // 每次检查被发现的概率

  // ===== 阶段转换检测 =====

  /**
   * 每回合结束时调用，检查所有爱豆是否需要推进关系阶段
   */
  function checkAllStageTransitions() {
    var idols = Game.state.idols || [];
    for (var i = 0; i < idols.length; i++) {
      checkIdolTransition(i);
    }
  }

  /**
   * 检查单个爱豆的关系阶段推进
   * @param {number} idolIndex
   */
  function checkIdolTransition(idolIndex) {
    var idol = Game.state.idols[idolIndex];
    if (!idol) return;

    var aff = idol.stats.affection || 0;
    var stage = idol.relationshipStage || 'pursuit';

    // 攻略期 → 恋爱期：好感度达到33%，尚未确认告白
    if (stage === 'pursuit' && aff >= DATING_THRESHOLD
        && !Game.State.isStageEventConfirmed(idolIndex, 'dating')) {
      // 检查是否已有独占伴侣（已有伴侣时仍可触发，但会有出轨警告）
      triggerConfessionEvent(idolIndex);
      return;
    }

    // 恋爱期 → 结婚：好感度达到90%，尚未求婚，且当前爱豆是恋爱对象
    if (stage === 'dating' && aff >= PROPOSAL_THRESHOLD
        && !Game.State.isStageEventConfirmed(idolIndex, 'proposal')
        && Game.state.datingIdolId === idolIndex) {
      triggerProposalEvent(idolIndex);
      return;
    }
  }

  // ===== 告白事件 =====

  /**
   * 触发告白确认事件
   * @param {number} idolIndex
   */
  function triggerConfessionEvent(idolIndex) {
    var idol = Game.state.idols[idolIndex];
    if (!idol) return;
    showConfessionModal(idolIndex);
  }

  /**
   * 显示告白弹窗
   * @param {number} idolIndex
   */
  function showConfessionModal(idolIndex) {
    var idol = Game.state.idols[idolIndex];
    if (!idol) return;

    var partner = Game.State.getExclusivePartner();
    var isAlreadyTaken = partner.idolIndex !== null;

    var modal = document.getElementById('confession-modal');
    var title = document.getElementById('confession-modal-title');
    var body = document.getElementById('confession-modal-body');
    var actions = document.getElementById('confession-modal-actions');

    if (!modal || !title || !body || !actions) return;

    var idolName = idol.nickname || idol.name;
    var honorific = (Game.Actions && Game.Actions.getHonorific) ? Game.Actions.getHonorific(idol.gender) : '欧巴';

    title.textContent = '💕 告白事件';
    body.innerHTML = '<div class="confession-scene">' +
      '<p class="confession-text">' +
      escapeHtml(idolName) + '看着你，眼神有些闪烁...<br><br>' +
      '"' + escapeHtml(honorific) + '...我有些话想跟你说。<br>' +
      '这段时间和你在一起，我真的特别开心。<br>' +
      '我...我喜欢你。不是粉丝那种喜欢。<br>' +
      '是想要和你在一起的那种喜欢。"<br><br>' +
      escapeHtml(idolName) + '的脸微微泛红，但眼神很坚定。<br><br>' +
      '<span class="confession-question">你愿意和' + escapeHtml(idolName) + '正式交往吗？</span>' +
      '</p>' +
      (isAlreadyTaken ? '<div class="confession-warning">' +
        '⚠️ 注意：你现在正在和' + escapeHtml(getPartnerName()) + '交往中。<br>' +
        '如果你接受' + escapeHtml(idolName) + '的告白，将被视为出轨行为。' +
      '</div>' : '') +
    '</div>';

    actions.innerHTML = '<button class="btn btn-primary btn-block confession-accept"' +
      ' onclick="Game.Relationship.acceptConfession(' + idolIndex + ')">' +
      '💕 接受告白（正式交往）' +
    '</button>' +
    '<button class="btn btn-secondary btn-block confession-reject"' +
      ' onclick="Game.Relationship.rejectConfession(' + idolIndex + ')">' +
      '💔 委婉拒绝...' +
    '</button>';

    modal.style.display = 'flex';
  }

  /**
   * 接受告白
   * @param {number} idolIndex
   */
  function acceptConfession(idolIndex) {
    hideConfessionModal();
    var idol = Game.state.idols[idolIndex];
    if (!idol) return;

    var idolName = idol.nickname || idol.name;
    var partner = Game.State.getExclusivePartner();
    var isCheatingCase = partner.idolIndex !== null && partner.idolIndex !== idolIndex;

    if (isCheatingCase) {
      // 出轨行为：已有伴侣却接受他人告白
      Game.State.addCheatingSuspicion(idolIndex, 15);
      Game.State.addSuspicion(10);

      Game.State.addEventLog({
        type: 'cheating-start',
        idolIndex: idolIndex,
        idolName: idolName,
        partnerIdolIndex: partner.idolIndex,
        partnerName: getPartnerName(),
        message: '出轨行为：你已与' + getPartnerName() + '交往，却接受了' + idolName + '的告白。'
      });

      // 将恋爱对象切换到新爱豆
      Game.State.setRelationshipStage(idolIndex, 'dating');
      Game.State.setDatingIdol(idolIndex);
    } else {
      // 正常接受告白
      Game.State.setRelationshipStage(idolIndex, 'dating');
      Game.State.setDatingIdol(idolIndex);

      Game.State.addEventLog({
        type: 'confession-accepted',
        idolIndex: idolIndex,
        idolName: idolName,
        message: idolName + '向你告白了！你们正式成为了恋人关系。💕'
      });
    }

    Game.State.confirmStageEvent(idolIndex, 'dating');
    showCelebrationToast(idolName, 'dating');
    refreshAllPanels();
  }

  /**
   * 拒绝告白
   * @param {number} idolIndex
   */
  function rejectConfession(idolIndex) {
    hideConfessionModal();
    var idol = Game.state.idols[idolIndex];
    if (!idol) return;

    var idolName = idol.nickname || idol.name;

    // 好感度小幅下降
    Game.State.addAffection(idolIndex, -5);

    // 标记已处理，防止重复触发
    Game.State.confirmStageEvent(idolIndex, 'dating');

    Game.State.addEventLog({
      type: 'confession-rejected',
      idolIndex: idolIndex,
      idolName: idolName,
      message: '你委婉拒绝了' + idolName + '的告白。'
    });

    refreshAllPanels();
  }

  function hideConfessionModal() {
    var modal = document.getElementById('confession-modal');
    if (modal) modal.style.display = 'none';
  }

  // ===== 求婚事件 =====

  /**
   * 触发求婚事件
   * @param {number} idolIndex
   */
  function triggerProposalEvent(idolIndex) {
    var idol = Game.state.idols[idolIndex];
    if (!idol) return;
    showProposalModal(idolIndex);
  }

  /**
   * 显示求婚弹窗
   * @param {number} idolIndex
   */
  function showProposalModal(idolIndex) {
    var idol = Game.state.idols[idolIndex];
    if (!idol) return;

    var modal = document.getElementById('proposal-modal');
    var title = document.getElementById('proposal-modal-title');
    var body = document.getElementById('proposal-modal-body');
    var actions = document.getElementById('proposal-modal-actions');

    if (!modal || !title || !body || !actions) return;

    var idolName = idol.nickname || idol.name;
    var honorific = (Game.Actions && Game.Actions.getHonorific) ? Game.Actions.getHonorific(idol.gender) : '欧巴';

    title.textContent = '💍 求婚事件';
    body.innerHTML = '<div class="proposal-scene">' +
      '<p class="proposal-text">' +
      escapeHtml(idolName) + '突然变得很安静，然后从口袋里拿出一个小盒子...<br><br>' +
      '"' + escapeHtml(honorific) + '...<br>' +
      '和你在一起的每一天，都是我最幸福的日子。<br>' +
      '我知道我们是爱豆和粉丝的关系，但在我心里，你早就不只是粉丝了。<br>' +
      '我想和你共度一生。"<br><br>' +
      escapeHtml(idolName) + '单膝跪下，打开了戒指盒。<br><br>' +
      '<span class="proposal-question">"你愿意...嫁给我吗？"</span>' +
      '</p>' +
      '<div class="proposal-choice-section">' +
        '<p class="proposal-choice-label">如果答应，你希望：</p>' +
      '</div>' +
    '</div>';

    actions.innerHTML = '<button class="btn btn-primary btn-block proposal-accept-public"' +
      ' onclick="Game.Relationship.acceptProposal(' + idolIndex + ', \'public\')">' +
      '💍 我愿意！（公开结婚）' +
    '</button>' +
    '<button class="btn proposal-accept-secret btn-block"' +
      ' style="background: #2D1B3D; color: #C9A0DC; border: 1px solid #7B4F9D;"' +
      ' onclick="Game.Relationship.acceptProposal(' + idolIndex + ', \'secret\')">' +
      '🤫 我愿意...但保密（秘密结婚）' +
    '</button>' +
    '<button class="btn btn-secondary btn-block proposal-reject"' +
      ' onclick="Game.Relationship.rejectProposal(' + idolIndex + ')">' +
      '💧 我还没准备好...' +
    '</button>';

    modal.style.display = 'flex';
  }

  /**
   * 接受求婚
   * @param {number} idolIndex
   * @param {'public'|'secret'} marriageType
   */
  function acceptProposal(idolIndex, marriageType) {
    hideProposalModal();
    var idol = Game.state.idols[idolIndex];
    if (!idol) return;

    var idolName = idol.nickname || idol.name;

    // 清除恋爱状态，设为结婚
    Game.State.clearDatingIdol();
    Game.State.setRelationshipStage(idolIndex, 'married');
    Game.State.setMarriedIdol(idolIndex, marriageType);
    Game.State.confirmStageEvent(idolIndex, 'proposal');

    // 公开结婚大幅增加嫌疑度
    if (marriageType === 'public') {
      Game.State.addSuspicion(30);
    } else {
      Game.State.addSuspicion(5);
    }

    Game.State.addEventLog({
      type: 'proposal-accepted',
      idolIndex: idolIndex,
      idolName: idolName,
      marriageType: marriageType,
      message: '你答应了' + idolName + '的求婚！' +
        (marriageType === 'public' ? '你们公开了婚讯。💍' : '你们选择秘密结婚。🤫')
    });

    showCelebrationToast(idolName, 'married');
    refreshAllPanels();
  }

  /**
   * 拒绝求婚
   * @param {number} idolIndex
   */
  function rejectProposal(idolIndex) {
    hideProposalModal();
    var idol = Game.state.idols[idolIndex];
    if (!idol) return;

    var idolName = idol.nickname || idol.name;

    // 拒绝求婚好感度下降较多
    Game.State.addAffection(idolIndex, -10);
    Game.State.confirmStageEvent(idolIndex, 'proposal');

    Game.State.addEventLog({
      type: 'proposal-rejected',
      idolIndex: idolIndex,
      idolName: idolName,
      message: '你还没有准备好...拒绝了' + idolName + '的求婚。'
    });

    refreshAllPanels();
  }

  function hideProposalModal() {
    var modal = document.getElementById('proposal-modal');
    if (modal) modal.style.display = 'none';
  }

  // ===== 出轨检测 =====

  /**
   * 在行动产生好感后调用，检测是否为出轨行为
   * @param {number} targetIdolIndex - 互动的爱豆索引
   * @param {number} affectionGained - 本次增加的好感度
   */
  function checkCheatingOnAction(targetIdolIndex, affectionGained) {
    if (!Game.State.isCheating(targetIdolIndex)) return;

    // 根据好感度增加量分级计算嫌疑度
    var cheatingSuspicion = CHEATING_BASE;
    if (affectionGained >= 10) {
      cheatingSuspicion = CHEATING_HEAVY;
    } else if (affectionGained >= 5) {
      cheatingSuspicion = CHEATING_MEDIUM;
    }

    // 增加出轨嫌疑度（针对该爱豆）
    Game.State.addCheatingSuspicion(targetIdolIndex, cheatingSuspicion);

    // 同时增加全局嫌疑度（50%）
    Game.State.addSuspicion(Math.ceil(cheatingSuspicion * 0.5));

    // 记录事件日志
    var idol = Game.state.idols[targetIdolIndex];
    var idolName = idol ? (idol.nickname || idol.name) : '';
    Game.State.addEventLog({
      type: 'cheating-action',
      idolIndex: targetIdolIndex,
      idolName: idolName,
      suspicionGained: cheatingSuspicion,
      message: '出轨嫌疑：你与' + idolName + '的亲密互动引起了注意。（+' + cheatingSuspicion + '出轨嫌疑）'
    });

    // 检查是否触发分手阈值
    checkBreakupThreshold(targetIdolIndex);
  }

  /**
   * 检查出轨嫌疑是否达到分手阈值
   * @param {number} idolIndex - 出轨对象索引
   */
  function checkBreakupThreshold(idolIndex) {
    var suspicion = Game.State.getCheatingSuspicion(idolIndex);
    if (suspicion < BREAKUP_CHEATING_THRESHOLD) return;

    var partner = Game.State.getExclusivePartner();
    if (partner.idolIndex === null) return;

    // 50%概率被伴侣发现
    if (Math.random() > BREAKUP_DISCOVERY_CHANCE) return;

    var partnerIdol = Game.state.idols[partner.idolIndex];
    var cheatingIdol = Game.state.idols[idolIndex];
    if (!partnerIdol || !cheatingIdol) return;

    var partnerName = partnerIdol.nickname || partnerIdol.name;
    var cheatingName = cheatingIdol.nickname || cheatingIdol.name;

    Game.State.addEventLog({
      type: 'cheating-discovered',
      idolIndex: partner.idolIndex,
      partnerName: partnerName,
      cheatingWith: cheatingName,
      message: partnerName + '发现了你与' + cheatingName + '的关系！'
    });

    // 触发分手
    triggerBreakup(partner.idolIndex, 'cheating');
  }

  // ===== 分手/离婚 =====

  /**
   * 触发分手或离婚
   * @param {number} idolIndex - 伴侣索引
   * @param {'cheating'|'stress'|'player-choice'} reason
   */
  function triggerBreakup(idolIndex, reason) {
    var idol = Game.state.idols[idolIndex];
    if (!idol) return;

    var idolName = idol.nickname || idol.name;
    var stage = idol.relationshipStage || 'pursuit';
    var isMarried = stage === 'married';

    // 重置关系阶段
    Game.State.setRelationshipStage(idolIndex, 'pursuit');

    // 好感度大幅下降（40%）
    var currentAff = idol.stats.affection || 0;
    var drop = Math.round(currentAff * 0.4);
    Game.State.addAffection(idolIndex, -drop);

    // 压力增加
    Game.State.addStress(isMarried ? 20 : 15);

    // 出轨导致的额外嫌疑度
    if (reason === 'cheating') {
      Game.State.addSuspicion(20);
    }

    // 清除独占伴侣状态
    if (stage === 'dating' && Game.state.datingIdolId === idolIndex) {
      Game.State.clearDatingIdol();
    } else if (stage === 'married' && Game.state.marriedIdolId === idolIndex) {
      Game.State.clearMarriedIdol();
    }

    // 清除该爱豆的出轨嫌疑度
    if (Game.state.cheatingSuspicion) {
      Game.state.cheatingSuspicion[String(idolIndex)] = 0;
    }

    var eventType = isMarried ? 'divorce' : 'breakup';
    var label = isMarried ? '离婚' : '分手';
    Game.State.addEventLog({
      type: eventType,
      idolIndex: idolIndex,
      idolName: idolName,
      reason: reason,
      message: label + '：你与' + idolName + '的关系结束了。' +
        (reason === 'cheating' ? '出轨行为被发现。' : '')
    });

    // 显示通知
    showBreakupToast(idolName, isMarried);
    refreshAllPanels();
  }

  // ===== UI 通知 =====

  /**
   * 显示庆祝Toast
   * @param {string} idolName
   * @param {'dating'|'married'} stage
   */
  function showCelebrationToast(idolName, stage) {
    var container = document.getElementById('schedule-action-log');
    if (!container) return;

    var emoji = stage === 'dating' ? '💕' : '💍';
    var label = stage === 'dating' ? '正式交往！' : '结婚！';

    var toast = document.createElement('div');
    toast.className = 'celebration-toast';
    toast.innerHTML = '<div class="celebration-emoji">' + emoji + '</div>' +
      '<div class="celebration-text">' +
        '<strong>' + label + '</strong><br>' +
        '你和' + escapeHtml(idolName) + '的关系迈入了新阶段！' +
      '</div>';
    container.prepend(toast);

    // 6秒后自动消失
    setTimeout(function() {
      toast.style.transition = 'opacity 0.5s';
      toast.style.opacity = '0';
      setTimeout(function() { toast.remove(); }, 500);
    }, 6000);
  }

  /**
   * 显示分手/离婚通知
   * @param {string} idolName
   * @param {boolean} isMarried
   */
  function showBreakupToast(idolName, isMarried) {
    var container = document.getElementById('schedule-action-log');
    if (!container) return;

    var label = isMarried ? '离婚' : '分手';

    var toast = document.createElement('div');
    toast.className = 'breakup-toast';
    toast.innerHTML = '<div class="breakup-icon">💔</div>' +
      '<div class="breakup-text">' +
        '<strong>' + label + '...</strong><br>' +
        '你和' + escapeHtml(idolName) + '的关系结束了。' +
      '</div>';
    container.prepend(toast);

    setTimeout(function() {
      toast.style.transition = 'opacity 0.5s';
      toast.style.opacity = '0';
      setTimeout(function() { toast.remove(); }, 500);
    }, 6000);
  }

  // ===== 工具函数 =====

  /**
   * 获取当前伴侣的名字
   * @returns {string}
   */
  function getPartnerName() {
    var partner = Game.State.getExclusivePartner();
    if (partner.idolIndex === null) return '未知';
    var idol = Game.state.idols[partner.idolIndex];
    return idol ? (idol.nickname || idol.name) : '未知';
  }

  // escapeHtml 使用 app.js 中的全局定义，此处不再重复定义

  /**
   * 刷新所有相关面板
   */
  function refreshAllPanels() {
    if (Game.Relations) Game.Relations.refresh();
    if (Game.Profile) Game.Profile.refresh();
    if (Game.Turn) Game.Turn.refreshUI();
  }

  // ===== 初始化 =====

  function init() {
    console.log('[Relationship] 关系阶段系统初始化完成');
  }

  // ===== 公开API =====
  return {
    init: init,
    checkAllStageTransitions: checkAllStageTransitions,
    checkCheatingOnAction: checkCheatingOnAction,
    acceptConfession: acceptConfession,
    rejectConfession: rejectConfession,
    acceptProposal: acceptProposal,
    rejectProposal: rejectProposal
  };

})();
