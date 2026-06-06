/**
 * 角色设定模块 — 新玩家首次进入时的设定向导
 * 负责：女主设定、爱豆设定、照片上传、确认页
 */

Game.Setup = (() => {
  // ===== 步骤管理 =====
  const STEP_IDS = [
    'welcome',
    'player-name',
    'player-tags',
    'idols',
    'extras',
    'confirm'
  ];

  let _currentStep = 0;

  // ===== 暂存数据（确认后才写入Game.state） =====
  let _playerData = {
    name: '',
    identityTags: [],
    identityCustom: '',
    personalityTags: [],
    personalityCustom: ''
  };

  let _idolCount = 2;
  let _idolsData = [];        // [{ name, gender, personalityTags, personalityCustom, group, nickname, avatarFile, avatarId }]
  let _wallpaperFile = null;

  // ===== 预设标签 =====
  const IDENTITY_TAGS = [
    '素人粉丝', '练习生', '造型师', '记者', '翻译', '站姐',
    '综艺PD', '青梅竹马', '学生', '化妆师', '运动教练', '名门社交好友'
  ];

  const PERSONALITY_TAGS = [
    '直球勇敢', '温柔体贴', '傲娇高冷', '腹黑心机', '社恐慢热'
  ];

  const IDOL_PERSONALITY_TAGS = [
    '高冷主舞', '阳光主唱', '四次元Rapper', '温柔门面',
    '反差萌忙内', '霸气队长', '可爱领舞', '神秘ACE'
  ];

  const IDOL_GROUPS = [
    'NOVA', 'ECLIPSE', 'VELVET', 'STARDUST', 'AURORA'
  ];

  // ===== 初始化 =====
  function init() {
    _currentStep = 0;
    showStep(_currentStep);
    console.log('[Setup] 设定向导初始化完成');
  }

  // ===== 步骤导航 =====

  /**
   * 显示指定步骤
   */
  function showStep(index) {
    // 隐藏所有步骤
    document.querySelectorAll('.setup-step').forEach(el => el.classList.remove('active'));
    // 显示目标步骤
    const stepId = STEP_IDS[index];
    const stepEl = document.getElementById('setup-step-' + stepId);
    if (stepEl) {
      stepEl.classList.add('active');
      // 滚动到顶部
      stepEl.scrollTop = 0;
    }
    _currentStep = index;

    // 特殊步骤初始化
    if (stepId === 'idols') renderIdolCards();
    if (stepId === 'extras') renderExtras();
    if (stepId === 'confirm') renderConfirm();
  }

  /**
   * 下一步
   */
  function next() {
    if (_currentStep < STEP_IDS.length - 1) {
      showStep(_currentStep + 1);
    }
  }

  /**
   * 上一步
   */
  function prev() {
    if (_currentStep > 0) {
      showStep(_currentStep - 1);
    }
  }

  // ===== 步骤2：保存玩家姓名 =====

  function savePlayerName() {
    const input = document.getElementById('input-player-name');
    const name = input.value.trim();
    if (!name) return;

    _playerData.name = name;
    next();
  }

  // 监听姓名输入，控制下一步按钮
  function _initPlayerNameListeners() {
    const input = document.getElementById('input-player-name');
    const btn = document.getElementById('btn-player-name-next');
    if (!input || !btn) return;

    input.addEventListener('input', () => {
      const hasValue = input.value.trim().length > 0;
      btn.disabled = !hasValue;
      const hint = document.getElementById('player-name-hint');
      if (hint) {
        hint.textContent = hasValue ? '✓ 好听的名字！' : '';
      }
    });

    // 回车键下一步
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && input.value.trim()) {
        savePlayerName();
      }
    });
  }

  // ===== 步骤3：标签选择 =====

  function _initTagListeners() {
    // 身份标签
    _bindTagGrid('tag-identity', (selected) => {
      _playerData.identityTags = selected;
    });
    // 性格标签
    _bindTagGrid('tag-personality', (selected) => {
      _playerData.personalityTags = selected;
    });
    // 自定义输入监听
    _bindCustomInput('input-identity-custom', (val) => { _playerData.identityCustom = val; });
    _bindCustomInput('input-personality-custom', (val) => { _playerData.personalityCustom = val; });
  }

  /**
   * 绑定标签网格的点击事件
   */
  function _bindTagGrid(containerId, onChange) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.addEventListener('click', (e) => {
      const tag = e.target.closest('.tag-item');
      if (!tag) return;

      tag.classList.toggle('selected');
      const selected = Array.from(container.querySelectorAll('.tag-item.selected'))
        .map(t => t.dataset.value);
      onChange(selected);
    });
  }

  /**
   * 绑定自定义输入
   */
  function _bindCustomInput(inputId, onChange) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.addEventListener('input', () => onChange(input.value.trim()));
  }

  function savePlayerTags() {
    // 至少选一个身份标签
    if (_playerData.identityTags.length === 0 && !_playerData.identityCustom) {
      _shakeElement(document.getElementById('tag-identity'));
      return;
    }
    next();
  }

  /**
   * 抖动提示（未选择时）
   */
  function _shakeElement(el) {
    if (!el) return;
    el.style.animation = 'none';
    el.offsetHeight; // 强制回流
    el.style.animation = 'shake 0.4s ease';
  }

  // ===== 步骤4：爱豆设定 =====

  function _initIdolCountListeners() {
    const container = document.getElementById('idol-count-selector');
    if (!container) return;

    container.addEventListener('click', (e) => {
      const btn = e.target.closest('.count-btn');
      if (!btn) return;

      container.querySelectorAll('.count-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _idolCount = parseInt(btn.dataset.count);
      renderIdolCards();
    });
  }

  /**
   * 渲染爱豆卡片
   */
  function renderIdolCards() {
    const container = document.getElementById('idol-cards-container');
    if (!container) return;

    // 保留已有数据
    const oldData = [..._idolsData];

    // 初始化/调整_idolsData数组大小
    _idolsData = [];
    for (let i = 0; i < _idolCount; i++) {
      _idolsData.push(oldData[i] || {
        name: '',
        gender: i === 0 ? 'male' : 'female', // 默认交替
        personalityTags: [],
        personalityCustom: '',
        group: IDOL_GROUPS[i % IDOL_GROUPS.length],
        nickname: '',
        avatarFile: null,
        avatarId: 'idol-' + i + '-avatar'
      });
    }

    // 生成卡片HTML
    container.innerHTML = _idolsData.map((idol, i) => `
      <div class="idol-card active-edit" id="idol-card-${i}">
        <div class="idol-card-header">
          <span class="idol-card-number">${i + 1}</span>
          <span class="idol-card-title">爱豆 ${i + 1}</span>
        </div>
        <div class="idol-card-fields">
          <div class="idol-field-row">
            <input type="text"
                   class="setup-input"
                   placeholder="姓名"
                   value="${escapeHtml(idol.name)}"
                   data-idol="${i}"
                   data-field="name"
                   onchange="Game.Setup.updateIdolField(${i}, 'name', this.value)">
            <div class="gender-toggle" data-idol="${i}">
              <button class="gender-btn ${idol.gender === 'male' ? 'selected' : ''}"
                      onclick="Game.Setup.setIdolGender(${i}, 'male', this)">♂ 男</button>
              <button class="gender-btn ${idol.gender === 'female' ? 'selected' : ''}"
                      onclick="Game.Setup.setIdolGender(${i}, 'female', this)">♀ 女</button>
            </div>
          </div>
          <label class="setup-label" style="margin-top:4px;">🎵 所属团体</label>
          <input type="text"
                 class="setup-input"
                 placeholder="例如：NOVA、BTS、BLACKPINK..."
                 value="${escapeHtml(idol.group)}"
                 data-idol="${i}"
                 data-field="group"
                 onchange="Game.Setup.updateIdolField(${i}, 'group', this.value)">
          <label class="setup-label" style="margin-top:4px;">性格标签</label>
          <div class="idol-tag-grid" id="idol-tags-${i}">
            ${IDOL_PERSONALITY_TAGS.map(tag => `
              <button class="tag-item ${idol.personalityTags.includes(tag) ? 'selected' : ''}"
                      data-value="${tag}"
                      data-idol="${i}">${tag}</button>
            `).join('')}
          </div>
          <input type="text"
                 class="setup-input setup-input-sm"
                 placeholder="或自行输入性格描述..."
                 value="${escapeHtml(idol.personalityCustom)}"
                 data-idol="${i}"
                 data-field="personalityCustom"
                 onchange="Game.Setup.updateIdolField(${i}, 'personalityCustom', this.value)">
        </div>
      </div>
    `).join('');

    // 绑定性格标签点击
    _idolsData.forEach((_, i) => {
      const tagGrid = document.getElementById('idol-tags-' + i);
      if (tagGrid) {
        tagGrid.addEventListener('click', (e) => {
          const tag = e.target.closest('.tag-item');
          if (!tag) return;
          tag.classList.toggle('selected');
          const selected = Array.from(tagGrid.querySelectorAll('.tag-item.selected'))
            .map(t => t.dataset.value);
          _idolsData[i].personalityTags = selected;
        });
      }
    });
  }

  /**
   * 更新爱豆字段
   */
  function updateIdolField(index, field, value) {
    if (_idolsData[index]) {
      _idolsData[index][field] = value.trim();
    }
  }

  /**
   * 设置爱豆性别
   */
  function setIdolGender(index, gender, btnEl) {
    _idolsData[index].gender = gender;
    // 更新按钮状态
    const toggle = btnEl.parentElement;
    if (toggle) {
      toggle.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('selected'));
      btnEl.classList.add('selected');
    }
  }

  /**
   * 保存爱豆数据并进入下一步
   */
  function saveIdols() {
    // 验证每个爱豆至少填了名字
    const emptyIdx = _idolsData.findIndex(idol => !idol.name.trim());
    if (emptyIdx >= 0) {
      const card = document.getElementById('idol-card-' + emptyIdx);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth' });
        card.style.borderColor = 'var(--color-danger)';
        setTimeout(() => { card.style.borderColor = 'transparent'; }, 1500);
      }
      return;
    }
    next();
  }

  // ===== 步骤5：照片与额外设置 =====

  function renderExtras() {
    const container = document.getElementById('extras-list');
    if (!container) return;

    container.innerHTML = _idolsData.map((idol, i) => `
      <div class="extra-card">
        <div class="extra-card-title">💜 ${idol.name || '爱豆 ' + (i + 1)}</div>
        <div class="extra-card-row">
          <!-- 聊天头像 -->
          <div class="photo-upload-row">
            <button class="btn btn-secondary btn-sm"
                    onclick="document.getElementById('input-avatar-${i}').click()">
              📷 聊天头像
            </button>
            <span class="photo-name" id="avatar-name-${i}">
              ${idol.avatarFile ? '✓ 已选择' : '未上传（可选）'}
            </span>
            <input type="file" id="input-avatar-${i}" accept="image/*" style="display:none"
                   onchange="Game.Setup.handleAvatarUpload(${i}, this)">
          </div>
          ${idol.avatarFile ? `
            <div class="photo-preview" id="avatar-preview-${i}">
              <img src="${URL.createObjectURL(idol.avatarFile)}" alt="头像预览">
              <button class="photo-remove" onclick="Game.Setup.removeAvatar(${i})">✕</button>
            </div>
          ` : '<div class="photo-preview" id="avatar-preview-${i}" style="display:none"></div>'}

          <!-- 备注/爱称 -->
          <input type="text"
                 class="setup-input setup-input-sm"
                 placeholder="设置备注/爱称（可选）"
                 value="${escapeHtml(idol.nickname)}"
                 onchange="Game.Setup.updateIdolField(${i}, 'nickname', this.value)">
        </div>
      </div>
    `).join('');

    // 更新壁纸状态
    updateWallpaperUI();
  }

  /**
   * 处理头像上传
   */
  function handleAvatarUpload(index, input) {
    const file = input.files[0];
    if (!file) return;

    // 限制文件大小（5MB）
    if (file.size > 5 * 1024 * 1024) {
      alert('图片大小不能超过5MB');
      return;
    }

    _idolsData[index].avatarFile = file;

    // 显示预览
    const preview = document.getElementById('avatar-preview-' + index);
    const nameEl = document.getElementById('avatar-name-' + index);
    if (preview) {
      preview.style.display = 'block';
      preview.innerHTML = `
        <img src="${URL.createObjectURL(file)}" alt="头像预览">
        <button class="photo-remove" onclick="Game.Setup.removeAvatar(${index})">✕</button>
      `;
    }
    if (nameEl) nameEl.textContent = '✓ ' + file.name;
  }

  /**
   * 移除头像
   */
  function removeAvatar(index) {
    _idolsData[index].avatarFile = null;
    const preview = document.getElementById('avatar-preview-' + index);
    const nameEl = document.getElementById('avatar-name-' + index);
    if (preview) preview.style.display = 'none';
    if (nameEl) nameEl.textContent = '未上传（可选）';

    // 重置文件选择input
    const fileInput = document.getElementById('input-avatar-' + index);
    if (fileInput) fileInput.value = '';
  }

  /**
   * 处理壁纸上传
   */
  function handleWallpaperUpload(input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('图片大小不能超过5MB');
      return;
    }
    _wallpaperFile = file;
    updateWallpaperUI();
  }

  function removeWallpaper() {
    _wallpaperFile = null;
    const input = document.getElementById('input-wallpaper');
    if (input) input.value = '';
    updateWallpaperUI();
  }

  function updateWallpaperUI() {
    const preview = document.getElementById('wallpaper-preview');
    const nameEl = document.getElementById('wallpaper-name');
    const img = document.getElementById('wallpaper-preview-img');

    if (_wallpaperFile) {
      if (preview) preview.style.display = 'block';
      if (img) img.src = URL.createObjectURL(_wallpaperFile);
      if (nameEl) nameEl.textContent = '✓ ' + _wallpaperFile.name;
    } else {
      if (preview) preview.style.display = 'none';
      if (nameEl) nameEl.textContent = '未选择';
    }
  }

  // ===== 步骤6：确认页 =====

  function goToConfirm() {
    showStep(5); // 确认页
  }

  function renderConfirm() {
    const container = document.getElementById('confirm-content');
    if (!container) return;

    const identityDisplay = _playerData.identityTags.length > 0
      ? _playerData.identityTags.join('、') + (_playerData.identityCustom ? ' / ' + _playerData.identityCustom : '')
      : _playerData.identityCustom || '未设置';

    const personalityDisplay = _playerData.personalityTags.length > 0
      ? _playerData.personalityTags.join('、') + (_playerData.personalityCustom ? ' / ' + _playerData.personalityCustom : '')
      : _playerData.personalityCustom || '未设置';

    container.innerHTML = `
      <!-- 女主设定 -->
      <div class="confirm-section">
        <div class="confirm-section-title">👤 你的设定</div>
        <div class="confirm-row"><span class="label">姓名</span><span class="value">${escapeHtml(_playerData.name)}</span></div>
        <div class="confirm-row"><span class="label">身份</span><span class="value">${escapeHtml(identityDisplay)}</span></div>
        <div class="confirm-row"><span class="label">性格</span><span class="value">${escapeHtml(personalityDisplay)}</span></div>
      </div>

      <!-- 爱豆设定 -->
      ${_idolsData.map((idol, i) => `
        <div class="confirm-section">
          <div class="confirm-section-title">💜 ${idol.name || '爱豆 ' + (i + 1)}</div>
          <div class="confirm-row"><span class="label">姓名</span><span class="value">${escapeHtml(idol.name)}</span></div>
          <div class="confirm-row"><span class="label">性别</span><span class="value">${idol.gender === 'male' ? '♂ 男' : '♀ 女'}</span></div>
          <div class="confirm-row"><span class="label">团体</span><span class="value">${escapeHtml(idol.group)}</span></div>
          <div class="confirm-row"><span class="label">备注</span><span class="value">${idol.nickname ? escapeHtml(idol.nickname) : '（未设置）'}</span></div>
          <div class="confirm-tags">
            ${idol.personalityTags.map(t => `<span class="mini-tag">${t}</span>`).join('')}
            ${idol.personalityCustom ? `<span class="mini-tag">${escapeHtml(idol.personalityCustom)}</span>` : ''}
          </div>
          ${idol.avatarFile ? '<div style="margin-top:8px;font-size:12px;color:var(--color-safe);">📷 头像已上传</div>' : ''}
        </div>
      `).join('')}

      <!-- 壁纸状态 -->
      <div class="confirm-section">
        <div class="confirm-section-title">📱 其他</div>
        <div class="confirm-row">
          <span class="label">手机壁纸</span>
          <span class="value">${_wallpaperFile ? '✓ 已设置' : '未设置'}</span>
        </div>
      </div>
    `;
  }

  // ===== 显示游戏主界面 =====

  /**
   * 隐藏所有覆盖层，显示游戏App主界面
   */
  function showGameUI() {
    // 隐藏标题画面
    const titleScreen = document.getElementById('title-screen');
    if (titleScreen) {
      titleScreen.style.display = 'none';
    }

    // 隐藏设定向导
    const setupScreen = document.getElementById('setup-screen');
    if (setupScreen) {
      setupScreen.style.opacity = '0';
      setupScreen.style.transition = 'opacity 300ms ease-out';
      setTimeout(() => {
        setupScreen.style.display = 'none';
      }, 300);
    }

    // 显示App主界面
    const app = document.getElementById('app');
    if (app) {
      app.style.display = 'flex';
      app.style.opacity = '0';
      app.style.transition = 'opacity 300ms ease-out';
      requestAnimationFrame(() => {
        app.style.opacity = '1';
      });
    }
  }

  // ===== 开始游戏 =====

  async function startGame() {
    console.log('[Setup] 开始游戏...');

    // 1. 保存照片到IndexedDB
    for (let i = 0; i < _idolsData.length; i++) {
      if (_idolsData[i].avatarFile) {
        try {
          await Game.Storage.savePhoto(_idolsData[i].avatarFile, _idolsData[i].avatarId);
          console.log('[Setup] 头像已保存: idol-' + i);
        } catch (e) {
          console.warn('[Setup] 头像保存失败: idol-' + i, e);
        }
      }
    }

    if (_wallpaperFile) {
      try {
        await Game.Storage.savePhoto(_wallpaperFile, 'wallpaper');
        console.log('[Setup] 壁纸已保存');
      } catch (e) {
        console.warn('[Setup] 壁纸保存失败', e);
      }
    }

    // 2. 构建游戏初始状态
    Game.state.player = {
      name: _playerData.name,
      identity: _playerData.identityTags.join('、'),
      identityTags: [..._playerData.identityTags],
      identityCustom: _playerData.identityCustom,
      personality: _playerData.personalityTags.join('、'),
      personalityTags: [..._playerData.personalityTags],
      personalityCustom: _playerData.personalityCustom,
      stats: {
        stress: 10,
        suspicion: 0,
        stamina: 100,
        charm: 50
      }
    };

    Game.state.idols = _idolsData.map((idol, i) => ({
      id: 'idol-' + i,
      name: idol.name,
      gender: idol.gender,
      nickname: idol.nickname || '',
      group: idol.group,
      personality: idol.personalityTags.join('、'),
      personalityTags: [...idol.personalityTags],
      personalityCustom: idol.personalityCustom,
      avatarId: idol.avatarFile ? idol.avatarId : null,
      stats: {
        affection: 10  // 初始好感度
      },
      relationshipStage: 'pursuit',  // 攻略期
      marriagePublic: false
    }));

    Game.state.currentTurn = 0;
    Game.state.initialized = true;

    // 3. 选择空存档槽并保存
    const slot = Game.State.findEmptySlot();
    Game.State.setCurrentSlot(slot);
    Game.State.autoSave();
    console.log('[Setup] 新游戏使用存档槽' + slot);

    // 4. 隐藏所有覆盖层，显示游戏主界面
    showGameUI();

    // 5. 刷新各面板
    if (Game.Profile) {
      Game.Profile.refresh();
    }
    if (Game.Relations) {
      Game.Relations.refresh();
    }

    console.log('[Setup] 游戏开始！玩家：' + _playerData.name + '，攻略爱豆：' + _idolsData.length + '位');
  }

  // ===== 演示模式 =====
  function loadDemo() {
    _playerData = {
      name: '小妍',
      identityTags: ['站姐'],
      identityCustom: '',
      personalityTags: ['直球勇敢'],
      personalityCustom: ''
    };
    _idolCount = 2;
    _idolsData = [
      {
        name: '智旻', gender: 'male', personalityTags: ['高冷主舞'], personalityCustom: '',
        group: 'NOVA', nickname: '🐰兔子', avatarFile: null, avatarId: 'idol-0-avatar'
      },
      {
        name: '秀雅', gender: 'female', personalityTags: ['阳光主唱'], personalityCustom: '',
        group: 'NOVA', nickname: '', avatarFile: null, avatarId: 'idol-1-avatar'
      }
    ];
    _wallpaperFile = null;
    startGame();
  }


  // ===== 全局初始化 =====
  function initAllListeners() {
    _initPlayerNameListeners();
    _initTagListeners();
    _initIdolCountListeners();
  }

  // ===== 公开API =====
  return {
    init,
    next,
    prev,
    savePlayerName,
    savePlayerTags,
    saveIdols,
    goToConfirm,
    startGame,
    loadDemo,
    // 爱豆相关
    updateIdolField,
    setIdolGender,
    renderIdolCards,
    // 照片相关
    handleAvatarUpload,
    removeAvatar,
    handleWallpaperUpload,
    removeWallpaper,
    // 初始化
    initAllListeners
  };
})();

// 页面加载完成后初始化设定向导
document.addEventListener('DOMContentLoaded', () => {
  Game.Setup.initAllListeners();
});
