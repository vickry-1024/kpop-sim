/**
 * 邂逅系统模块 — 中期认识新爱豆
 * 负责：邂逅触发、新爱豆定制表单、添加到游戏状态
 */

Game.Encounter = (() => {

  var IDOL_PERSONALITY_TAGS = [
    '高冷主舞', '阳光主唱', '四次元Rapper', '温柔门面',
    '反差萌忙内', '霸气队长', '可爱领舞', '神秘ACE'
  ];

  var DEFAULT_GROUPS = [
    'NOVA', 'ECLIPSE', 'VELVET', 'STARDUST', 'AURORA',
    'COSMOS', 'PHANTOM', 'LUMINA'
  ];

  /**
   * 主入口：触发邂逅
   * @param {string} source - 'action' | 'random'
   */
  function triggerEncounter(source) {
    // 防止邂逅队列堆积
    var queue = Game.state.encounterQueue || [];
    if (queue.length > 0 && source !== queue[0].source) {
      // 已有待处理的邂逅，先不堆叠
      return;
    }
    Game.State.queueEncounter(source);
    showEncounterModal({ source: source });
  }

  /**
   * 显示邂逅自定义弹窗
   */
  function showEncounterModal(encounter) {
    var sourceLabel = encounter.source === 'action' ? '圈内活动' : '偶然相遇';

    var modal = document.getElementById('encounter-modal');
    var body = document.getElementById('encounter-modal-body');
    if (!modal || !body) return;

    var defaultName = generateRandomName();
    var defaultGroup = DEFAULT_GROUPS[Math.floor(Math.random() * DEFAULT_GROUPS.length)];

    body.innerHTML =
      '<div class="encounter-intro">' +
        '<div class="encounter-icon">✨</div>' +
        '<p class="encounter-title">' + sourceLabel + '中，你注意到一个人...</p>' +
        '<p class="encounter-desc">你感受到一种莫名的吸引力。这是认识新爱豆的机会！在认识之前，先设定名字和人设吧。</p>' +
      '</div>' +
      '<div class="encounter-form">' +
        '<label class="setup-label">姓名</label>' +
        '<input type="text" id="encounter-name" class="setup-input" value="' + escapeHtml(defaultName) + '" maxlength="20">' +
        '<label class="setup-label">性别</label>' +
        '<div class="gender-toggle" id="encounter-gender">' +
          '<button type="button" class="gender-btn selected" data-gender="male" onclick="Game.Encounter.selectGender(\'male\')">♂ 男</button>' +
          '<button type="button" class="gender-btn" data-gender="female" onclick="Game.Encounter.selectGender(\'female\')">♀ 女</button>' +
        '</div>' +
        '<label class="setup-label">所属团体</label>' +
        '<input type="text" id="encounter-group" class="setup-input" value="' + escapeHtml(defaultGroup) + '" maxlength="30">' +
        '<label class="setup-label">性格标签（可多选，至少选一个）</label>' +
        '<div class="idol-tag-grid" id="encounter-tags">' +
          IDOL_PERSONALITY_TAGS.map(function(t) {
            return '<button class="tag-item" data-value="' + t + '">' + t + '</button>';
          }).join('') +
        '</div>' +
        '<label class="setup-label">爱称/备注（选填）</label>' +
        '<input type="text" id="encounter-nickname" class="setup-input" placeholder="给爱豆取个爱称..." maxlength="20">' +
        '<label class="setup-label">自定义性格描述（选填）</label>' +
        '<input type="text" id="encounter-personality-custom" class="setup-input" placeholder="或自行输入性格..." maxlength="50">' +
      '</div>' +
      '<div class="encounter-actions">' +
        '<button class="btn btn-primary btn-block" onclick="Game.Encounter.confirmEncounter()">' +
          '✨ 认识 TA' +
        '</button>' +
        '<button class="btn btn-text" onclick="Game.Encounter.skipEncounter()">' +
          '算了，当没看到' +
        '</button>' +
      '</div>';

    modal.style.display = 'flex';

    // 绑定标签点击
    var tagGrid = document.getElementById('encounter-tags');
    if (tagGrid) {
      tagGrid.addEventListener('click', function(e) {
        var tag = e.target.closest('.tag-item');
        if (!tag) return;
        tag.classList.toggle('selected');
      });
    }

    // 存储默认性别
    body.dataset.gender = 'male';
  }

  /**
   * 性别切换
   */
  function selectGender(gender) {
    // 更新按钮样式
    var toggle = document.getElementById('encounter-gender');
    if (toggle) {
      var buttons = toggle.querySelectorAll('.gender-btn');
      for (var i = 0; i < buttons.length; i++) {
        if (buttons[i].dataset.gender === gender) {
          buttons[i].classList.add('selected');
        } else {
          buttons[i].classList.remove('selected');
        }
      }
    }
    // 存储选择的性别
    var body = document.getElementById('encounter-modal-body');
    if (body) {
      body.dataset.gender = gender;
    }
    Game.DEBUG && console.log('[Encounter] 性别选择: ' + gender);
  }

  /**
   * 确认创建新爱豆
   */
  function confirmEncounter() {
    var body = document.getElementById('encounter-modal-body');
    var nameEl = document.getElementById('encounter-name');
    var groupEl = document.getElementById('encounter-group');
    var nicknameEl = document.getElementById('encounter-nickname');
    var customEl = document.getElementById('encounter-personality-custom');
    var tagGrid = document.getElementById('encounter-tags');

    var name = nameEl ? nameEl.value.trim() : '';
    if (!name) {
      alert('请输入爱豆姓名');
      return;
    }

    var selectedTags = [];
    if (tagGrid) {
      tagGrid.querySelectorAll('.tag-item.selected').forEach(function(t) {
        selectedTags.push(t.dataset.value);
      });
    }
    if (selectedTags.length === 0) selectedTags.push('神秘ACE');

    var newIndex = Game.state.idols.length;
    var newIdol = {
      id: 'idol-' + newIndex,
      name: name,
      gender: body ? (body.dataset.gender || 'male') : 'male',
      nickname: nicknameEl ? nicknameEl.value.trim() : '',
      group: groupEl ? groupEl.value.trim() : '',
      personality: selectedTags.join('、'),
      personalityTags: selectedTags,
      personalityCustom: customEl ? customEl.value.trim() : '',
      avatarId: null,
      stats: {
        affection: Math.floor(Math.random() * 6) // 0-5 初始好感
      },
      relationshipStage: 'pursuit',
      marriagePublic: false,
      birthMonth: Math.floor(Math.random() * 12) + 1,
      birthHalf: Math.random() < 0.5 ? 1 : 2
    };

    Game.state.idols.push(newIdol);

    // 事件日志
    Game.State.addEventLog({
      type: 'new-idol',
      idolName: name,
      label: '认识了新爱豆：' + name + '（' + newIdol.group + '）',
      timestamp: Date.now()
    });

    // 移除已处理的邂逅
    Game.State.popEncounter();

    // 关闭弹窗
    hideEncounterModal();

    // 刷新UI
    if (Game.Relations) Game.Relations.refresh();
    if (Game.Profile) Game.Profile.refresh();
    Game.State.autoSave();

    Game.DEBUG && console.log('[Encounter] 新爱豆已添加：' + name + '（idol-' + newIndex + '）');
  }

  /**
   * 跳过邂逅
   */
  function skipEncounter() {
    Game.State.popEncounter();
    hideEncounterModal();
    Game.DEBUG && console.log('[Encounter] 玩家跳过了邂逅');
  }

  /**
   * 关闭邂逅弹窗
   */
  function hideEncounterModal() {
    var modal = document.getElementById('encounter-modal');
    if (modal) modal.style.display = 'none';
  }

  /**
   * 生成随机韩国风格名字
   */
  function generateRandomName() {
    var surnames = ['金', '李', '朴', '崔', '郑', '姜', '赵', '尹'];
    var givensMale = ['泰民', '珉豪', '知勋', '正国', '秀彬', '然峻', '范洙', '圣俊', '泰亨', '智旻'];
    var givensFemale = ['智秀', '彩英', '多贤', '娜妍', '秀智', '恩智', '裕贞', '素希', '美娜', '世熙'];
    var surname = surnames[Math.floor(Math.random() * surnames.length)];
    var givenPool = Math.random() < 0.5 ? givensMale : givensFemale;
    var given = givenPool[Math.floor(Math.random() * givenPool.length)];
    return surname + given;
  }

  // escapeHtml 使用 app.js 中的全局定义，此处不再重复定义

  // ===== 公开API =====
  return {
    triggerEncounter,
    showEncounterModal,
    confirmEncounter,
    skipEncounter,
    selectGender,
    hideEncounterModal
  };

})();
