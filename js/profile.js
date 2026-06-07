/**
 * 个人面板模块 — "我的"选项卡内容
 * 负责：玩家信息展示、数值面板、照片管理（壁纸+头像修改）
 */

Game.Profile = (() => {

  // ===== 刷新整个"我的"页面 =====

  function refresh() {
    if (!Game.state.initialized) return;
    renderPlayerInfo();
    renderStats();
    renderApiSettings();
    renderPhotoManagement();
  }

  /**
   * 渲染玩家基本信息卡片
   */
  function renderPlayerInfo() {
    const player = Game.state.player;
    if (!player) return;

    // 名字
    const nameEl = document.getElementById('profile-player-name-display');
    if (nameEl) nameEl.textContent = player.name;

    // 详细信息
    const infoEl = document.getElementById('profile-player-info');
    if (!infoEl) return;

    const identityText = player.identityTags.length > 0
      ? player.identityTags.join('、') + (player.identityCustom ? ' / ' + player.identityCustom : '')
      : player.identityCustom || '未设置';

    const personalityText = player.personalityTags.length > 0
      ? player.personalityTags.join('、') + (player.personalityCustom ? ' / ' + player.personalityCustom : '')
      : player.personalityCustom || '未设置';

    // 获取感情状态
    var relationshipStatus = '';
    var partner = (Game.State && Game.State.getExclusivePartner) ? Game.State.getExclusivePartner() : { idolIndex: null, type: null };
    if (partner.type === 'married') {
      var partnerIdol = Game.state.idols[partner.idolIndex];
      var partnerName = partnerIdol ? (partnerIdol.nickname || partnerIdol.name) : '未知';
      var isSecret = Game.state.marriageType === 'secret' ? '（秘密）' : '（公开）';
      relationshipStatus = '<span style="color:#FFD700;">💍 已婚 — ' + escapeHtml(partnerName) + isSecret + '</span>';
    } else if (partner.type === 'dating') {
      var partnerIdol = Game.state.idols[partner.idolIndex];
      var partnerName = partnerIdol ? (partnerIdol.nickname || partnerIdol.name) : '未知';
      relationshipStatus = '<span style="color:#F8A5C2;">💕 恋爱中 — ' + escapeHtml(partnerName) + '</span>';
    } else {
      relationshipStatus = '<span style="color:#7EC8E3;">💫 单身（攻略期）</span>';
    }

    infoEl.innerHTML = `
      <div class="profile-info-row">
        <span class="profile-info-label">🎭 身份</span>
        <span class="profile-info-value">${escapeHtml(identityText)}</span>
      </div>
      <div class="profile-info-row">
        <span class="profile-info-label">💬 性格</span>
        <span class="profile-info-value">${escapeHtml(personalityText)}</span>
      </div>
      <div class="profile-info-row">
        <span class="profile-info-label">💜 感情</span>
        <span class="profile-info-value">${relationshipStatus}</span>
      </div>
    `;
  }

  /**
   * 渲染数值面板
   */
  function renderStats() {
    const player = Game.state.player;
    if (!player) return;

    const container = document.getElementById('profile-stats');
    if (!container) return;

    const stats = player.stats;

    // 基于数值阈值动态获取属性条颜色（阶段11）
    function getStatBarColor(key, value) {
      switch (key) {
        case 'stress':
          if (value > 80) return 'var(--color-danger)';
          if (value > 60) return 'var(--color-warning)';
          return 'var(--color-stress)';
        case 'suspicion':
          if (value > 80) return 'var(--color-danger)';
          if (value > 50) return 'var(--color-warning)';
          return 'var(--color-suspicion)';
        case 'stamina':
          if (value < 20) return 'var(--color-danger)';
          if (value < 50) return 'var(--color-warning)';
          return 'var(--color-stamina)';
        case 'charm':
          return 'var(--color-charm)';
        default:
          return 'var(--color-affection)';
      }
    }

    const statDefs = [
      { key: 'stamina', label: '⚡ 体力', color: 'var(--color-stamina, #4ECDC4)' },
      { key: 'charm',   label: '✨ 魅力', color: 'var(--color-charm, #FF6B9D)' },
      { key: 'stress',  label: '😰 压力', color: 'var(--color-stress, #FF8A80)' },
      { key: 'suspicion', label: '🕵️ 嫌疑度', color: 'var(--color-suspicion, #FFD93D)' },
    ];

    container.innerHTML = statDefs.map(def => `
      <div class="stat-item">
        <div class="stat-header">
          <span class="stat-label">${def.label}</span>
          <span class="stat-value">${stats[def.key]}</span>
        </div>
        <div class="stat-bar-bg">
          <div class="stat-bar-fill" style="width:${Math.min(stats[def.key], 100)}%; background:${getStatBarColor(def.key, stats[def.key])};"></div>
        </div>
      </div>
    `).join('');

    // 社交账号信息
    const social = Game.State.getSocialData();
    const socialEl = document.getElementById('profile-social');
    if (socialEl) {
      const followerK = social.followers >= 10000
        ? (social.followers / 10000).toFixed(1) + '万'
        : social.followers.toLocaleString();
      socialEl.innerHTML = `
        <div class="profile-social-row">
          <span class="profile-social-icon">📱</span>
          <div class="profile-social-info">
            <span class="profile-social-label">社交账号粉丝</span>
            <span class="profile-social-value">${followerK}</span>
          </div>
          <span class="profile-social-posts">${social.posts} 条帖子</span>
        </div>
        <p class="profile-social-hint">粉丝越多，一举一动越容易被放大</p>
      `;
    }
  }

  /**
   * 渲染照片管理区域（壁纸预览 + 各爱豆头像）
   */
  async function renderPhotoManagement() {
    // 壁纸
    await renderWallpaperPreview();

    // 各爱豆头像
    const container = document.getElementById('profile-avatars-container');
    if (!container) return;

    const idols = Game.state.idols || [];

    container.innerHTML = idols.map((idol, i) => `
      <div class="photo-manage-item">
        <span class="photo-manage-label">💜 ${escapeHtml(idol.nickname || idol.name)} 的头像</span>
        <div class="photo-upload-row">
          <button class="btn btn-secondary btn-sm"
                  onclick="document.getElementById('profile-input-avatar-${i}').click()">
            📷 更换头像
          </button>
          <span class="photo-name" id="profile-avatar-name-${i}">${idol.avatarId ? '✓ 已设置' : '未上传'}</span>
          <input type="file" id="profile-input-avatar-${i}" accept="image/*" style="display:none"
                 onchange="Game.Profile.handleAvatarChange(${i}, this)">
        </div>
        <div id="profile-avatar-preview-${i}" class="photo-preview" style="display:none">
          <!-- 动态填充 -->
        </div>
      </div>
    `).join('');

    // 并行加载所有头像预览
    await Promise.all(idols.map((_, i) => renderAvatarPreview(i).catch(() => {})));
  }

  /**
   * 渲染壁纸预览
   */
  async function renderWallpaperPreview() {
    const preview = document.getElementById('profile-wallpaper-preview');
    const img = document.getElementById('profile-wallpaper-preview-img');
    const nameEl = document.getElementById('profile-wallpaper-name');

    try {
      const photo = await Game.Storage.getPhoto('wallpaper');
      if (photo && preview && img) {
        preview.style.display = 'block';
        img.src = URL.createObjectURL(photo.blob);
        if (nameEl) nameEl.textContent = '✓ 已设置（点击上方按钮更换）';
      } else {
        if (preview) preview.style.display = 'none';
        if (nameEl) nameEl.textContent = '当前未设置';
      }
    } catch (e) {
      if (preview) preview.style.display = 'none';
      if (nameEl) nameEl.textContent = '当前未设置';
    }
  }

  /**
   * 渲染单个爱豆头像预览
   */
  async function renderAvatarPreview(index) {
    const idol = Game.state.idols[index];
    if (!idol) return;

    const preview = document.getElementById('profile-avatar-preview-' + index);
    if (!preview) return;

    try {
      const photo = await Game.Storage.getPhoto(idol.avatarId);
      if (photo) {
        preview.style.display = 'block';
        preview.innerHTML = `
          <img src="${URL.createObjectURL(photo.blob)}" alt="头像预览">
          <button class="photo-remove" onclick="Game.Profile.removeAvatar(${index})">✕</button>
        `;
      } else {
        preview.style.display = 'none';
        preview.innerHTML = '';
      }
    } catch (e) {
      preview.style.display = 'none';
      preview.innerHTML = '';
    }
  }

  // ===== 壁纸修改 =====

  async function handleWallpaperChange(input) {
    const file = input.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('图片大小不能超过5MB');
      return;
    }

    try {
      await Game.Storage.replacePhoto(file, 'wallpaper');
      console.log('[Profile] 壁纸已更新');
      await renderWallpaperPreview();
    } catch (e) {
      console.error('[Profile] 壁纸更新失败', e);
      alert('壁纸更新失败，请重试');
    }
  }

  async function removeWallpaper() {
    try {
      await Game.Storage.deletePhoto('wallpaper');
      console.log('[Profile] 壁纸已删除');
      await renderWallpaperPreview();
    } catch (e) {
      console.error('[Profile] 壁纸删除失败', e);
    }
  }

  // ===== 头像修改 =====

  async function handleAvatarChange(index, input) {
    const file = input.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('图片大小不能超过5MB');
      return;
    }

    const idol = Game.state.idols[index];
    if (!idol) return;

    // 如果之前没上传过头像，生成新的avatarId
    if (!idol.avatarId) {
      idol.avatarId = 'idol-' + index + '-avatar';
    }

    try {
      await Game.Storage.replacePhoto(file, idol.avatarId);
      console.log('[Profile] 头像已更新: idol-' + index);

      // 更新预览
      await renderAvatarPreview(index);

      // 更新文件名显示
      const nameEl = document.getElementById('profile-avatar-name-' + index);
      if (nameEl) nameEl.textContent = '✓ ' + file.name;

      // 自动存档
      Game.State.autoSave();
    } catch (e) {
      console.error('[Profile] 头像更新失败', e);
      alert('头像更新失败，请重试');
    }
  }

  async function removeAvatar(index) {
    const idol = Game.state.idols[index];
    if (!idol) return;

    if (idol.avatarId) {
      try {
        await Game.Storage.deletePhoto(idol.avatarId);
        console.log('[Profile] 头像已删除: idol-' + index);
      } catch (e) {
        console.error('[Profile] 头像删除失败', e);
      }
    }

    idol.avatarId = null;

    // 更新预览
    const preview = document.getElementById('profile-avatar-preview-' + index);
    if (preview) {
      preview.style.display = 'none';
      preview.innerHTML = '';
    }

    // 更新文件名显示
    const nameEl = document.getElementById('profile-avatar-name-' + index);
    if (nameEl) nameEl.textContent = '未上传';

    // 自动存档
    Game.State.autoSave();
  }

  // ===== API Key 设置 =====

  /**
   * 渲染API Key设置区域
   */
  function renderApiSettings() {
    const container = document.getElementById('profile-api-settings');
    if (!container) return;

    const hasPlayerKey = Game.Storage.hasApiKey();
    const hasAnyKey = Game.API ? Game.API.hasAnyKey() : false;
    const stats = Game.API ? Game.API.getUsageStats() : null;

    let statusHtml = '';
    if (hasAnyKey) {
      const source = Game.Storage.hasApiKey() ? '自定义Key' : '默认Key';
      statusHtml = '<span class="profile-api-status profile-api-status-active">● 已启用 (' + source + ')</span>';
    } else {
      statusHtml = '<span class="profile-api-status profile-api-status-inactive">○ 未启用 — 使用预设对话</span>';
    }

    container.innerHTML = `
      <h3 class="profile-section-title">🔑 AI对话设置</h3>
      <p class="profile-section-desc">接入DeepSeek API让爱豆对话更真实自然</p>

      <div style="margin-top: var(--spacing-sm);">
        ${statusHtml}
      </div>

      <div style="margin-top: var(--spacing-sm);">
        <input type="password"
               id="profile-api-key-input"
               class="setup-input"
               placeholder="${hasPlayerKey ? '已设置自定义Key（输入新Key覆盖）' : '输入你的DeepSeek API Key...'}"
               maxlength="64"
               autocomplete="off"
               style="width:100%; box-sizing:border-box;">
        <div style="display:flex; gap: var(--spacing-xs); margin-top: var(--spacing-xs);">
          <button class="btn btn-primary btn-sm" onclick="Game.Profile.saveApiKey()" style="flex:1;">
            💾 保存Key
          </button>
          ${hasPlayerKey ? `
            <button class="btn btn-secondary btn-sm" onclick="Game.Profile.clearApiKey()">
              🗑️ 清除
            </button>
          ` : ''}
          <button class="btn btn-secondary btn-sm" onclick="Game.Profile.testApiConnection()">
            🔍 测试
          </button>
        </div>
        ${stats ? `
          <p style="font-size: var(--font-size-xs); color: var(--text-hint); margin-top: 4px;">
            📊 今日调用：${stats.dailyCalls}/${stats.maxDailyCalls}
          </p>
        ` : ''}
        <p style="font-size: var(--font-size-xs); color: var(--text-hint); margin-top: 4px;">
          没有Key？访问 <a href="https://platform.deepseek.com" target="_blank" style="color: var(--color-primary);">platform.deepseek.com</a> 获取（新用户有免费额度）
        </p>
      </div>
    `;
  }

  /**
   * 保存API Key
   */
  function saveApiKey() {
    const input = document.getElementById('profile-api-key-input');
    if (!input) return;

    const key = input.value.trim();
    if (!key) {
      alert('请输入API Key');
      return;
    }

    // 简单验证：DeepSeek Key 通常以 sk- 开头
    if (!key.startsWith('sk-')) {
      if (!confirm('API Key通常以"sk-"开头，你输入的似乎不是标准格式。确定保存吗？')) {
        return;
      }
    }

    Game.Storage.saveApiKey(key);
    input.value = '';
    renderApiSettings();
    console.log('[Profile] API Key已保存');
  }

  /**
   * 清除自定义API Key
   */
  function clearApiKey() {
    if (!confirm('确定要清除自定义API Key吗？游戏将使用默认Key或预设对话。')) {
      return;
    }
    localStorage.removeItem('kpop-sim:api-key');
    renderApiSettings();
    console.log('[Profile] API Key已清除');
  }

  /**
   * 测试API连接
   */
  async function testApiConnection() {
    if (!Game.API) {
      alert('API模块未加载');
      return;
    }

    // 如果输入框有内容，先保存
    const input = document.getElementById('profile-api-key-input');
    if (input && input.value.trim()) {
      Game.Storage.saveApiKey(input.value.trim());
      input.value = '';
    }

    const btn = document.querySelector('#profile-api-settings .btn');
    if (btn) {
      btn.textContent = '⏳ 测试中...';
      btn.disabled = true;
    }

    try {
      const result = await Game.API.testConnection();
      alert(result.message);
      renderApiSettings();
    } catch (e) {
      alert('测试失败: ' + e.message);
    } finally {
      if (btn) {
        btn.textContent = '🔍 测试';
        btn.disabled = false;
      }
    }
  }

  function init() {
    // 监听选项卡切换，切换到"我的"时自动刷新
    document.addEventListener('pageChanged', (e) => {
      if (e.detail && e.detail.to === 'profile') {
        refresh();
      }
    });
  }

  // ===== 公开API =====
  return {
    init,
    refresh,
    handleWallpaperChange,
    removeWallpaper,
    handleAvatarChange,
    removeAvatar,
    saveApiKey,
    clearApiKey,
    testApiConnection
  };

})();
