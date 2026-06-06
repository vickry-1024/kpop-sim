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

    infoEl.innerHTML = `
      <div class="profile-info-row">
        <span class="profile-info-label">🎭 身份</span>
        <span class="profile-info-value">${escapeHtml(identityText)}</span>
      </div>
      <div class="profile-info-row">
        <span class="profile-info-label">💬 性格</span>
        <span class="profile-info-value">${escapeHtml(personalityText)}</span>
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
          <div class="stat-bar-fill" style="width:${Math.min(stats[def.key], 100)}%; background:${def.color};"></div>
        </div>
      </div>
    `).join('');
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

    // 异步加载每个头像的预览
    for (let i = 0; i < idols.length; i++) {
      await renderAvatarPreview(i);
    }
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
      Game.Storage.saveGame(1, Game.state);
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
    Game.Storage.saveGame(1, Game.state);
  }

  // ===== 工具函数 =====

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  // ===== 初始化 =====

  function init() {
    // 监听选项卡切换，切换到"我的"时自动刷新
    document.addEventListener('pageChanged', (e) => {
      if (e.detail && e.detail.page === 'profile') {
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
    removeAvatar
  };

})();
