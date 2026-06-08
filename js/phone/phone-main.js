/**
 * 手机主屏幕模块 — 手机系统的入口
 * 负责：APP图标网格、主屏幕↔APP内页导航、主手机↔秘密手机切换（条件解锁）
 */

Game.Phone = (() => {

  // 当前手机类型：'main' | 'secret'
  let _phoneType = 'main';

  // 当前打开的APP（null = 在主屏幕）
  let _currentApp = null;

  // ===== APP定义 =====

  const APPS = {
    main: [
      { id: 'chat', name: '聊天', icon: '💬', color: '#34C759' },
      { id: 'sns', name: 'SNS', icon: '📱', color: '#FF6B9D' },
      { id: 'news', name: '新闻', icon: '📰', color: '#4ECDC4' },
      { id: 'call', name: '通话', icon: '📞', color: '#FFA502' },
      { id: 'gallery', name: '相册', icon: '🖼️', color: '#A78BFA' },
    ],
    secret: [
      { id: 'secret-chat', name: '私密聊天', icon: '🔒', color: '#BB86FC' },
      { id: 'secret-album', name: '隐藏相册', icon: '📷', color: '#CF6679' },
    ]
  };

  // ===== 初始化 =====

  function init() {
    // 监听页面切换，切换到手机页时刷新主屏幕
    document.addEventListener('pageChanged', (e) => {
      if (e.detail && e.detail.to === 'phone') {
        _currentApp = null;
        // 如果当前在秘密手机但已失效，切回主手机
        if (_phoneType === 'secret' && !isSecretPhoneUnlocked()) {
          _phoneType = 'main';
        }
        renderHomeScreen();
      }
    });
    Game.DEBUG && console.log('[Phone] 手机系统初始化完成');
  }

  // ===== 秘密手机状态 =====

  function isSecretPhoneUnlocked() {
    const sp = Game.State.getSecretPhone();
    return sp && sp.unlocked;
  }

  function getSecretPhoneIdolIndex() {
    const sp = Game.State.getSecretPhone();
    return sp ? sp.idolIndex : null;
  }

  // ===== 渲染主屏幕 =====

  /**
   * 渲染手机主屏幕（APP图标网格 + 切换按钮）
   */
  function renderHomeScreen() {
    const home = document.getElementById('phone-home');
    const appView = document.getElementById('phone-app-view');
    const statusTime = document.getElementById('phone-status-time');
    const appGrid = document.getElementById('phone-app-grid');
    const switchArea = document.getElementById('phone-switch-area');

    if (!home || !appView) return;

    // 显示主屏幕，隐藏APP内页
    home.style.display = 'flex';
    appView.style.display = 'none';

    // 秘密手机主题
    if (_phoneType === 'secret') {
      home.classList.add('secret-theme');
    } else {
      home.classList.remove('secret-theme');
    }

    // 更新时间
    if (statusTime) {
      const now = new Date();
      statusTime.textContent = now.getHours().toString().padStart(2, '0') + ':'
        + now.getMinutes().toString().padStart(2, '0');
    }

    // 渲染APP图标
    const apps = APPS[_phoneType] || APPS.main;
    if (appGrid) {
      appGrid.innerHTML = apps.map(app => {
        // 检查聊天APP的未读消息数
        let badgeHTML = '';
        if ((app.id === 'chat' || app.id === 'secret-chat') && Game.PhoneChat) {
          const phoneTypeForBadge = app.id === 'secret-chat' ? 'secret' : 'main';
          const unread = Game.PhoneChat.getTotalUnread(phoneTypeForBadge);
          if (unread > 0) {
            badgeHTML = `<span class="phone-app-badge">${unread > 99 ? '99+' : unread}</span>`;
          }
        }
        return `
        <button class="phone-app-icon" onclick="Game.Phone.openApp('${app.id}')">
          <span class="phone-app-icon-bg" style="background:${app.color}20; color:${app.color};">
            ${app.icon}
            ${badgeHTML}
          </span>
          <span class="phone-app-icon-name">${app.name}</span>
        </button>
      `;
      }).join('');
    }

    // 切换按钮区域
    if (switchArea) {
      const unlocked = isSecretPhoneUnlocked();
      if (unlocked) {
        // 秘密手机已解锁 → 显示切换按钮
        const idolIndex = getSecretPhoneIdolIndex();
        const idol = (idolIndex !== null && Game.state.idols[idolIndex])
          ? Game.state.idols[idolIndex] : null;
        const idolName = idol ? (idol.nickname || idol.name) : '';

        switchArea.style.display = 'block';
        const isSecret = _phoneType === 'secret';
        switchArea.innerHTML = `
          <button class="phone-switch-btn${isSecret ? ' secret-mode' : ''}"
                  id="phone-switch-btn" onclick="Game.Phone.switchPhone()">
            ${isSecret ? '🔒 秘密手机' : '📱 主手机'}
          </button>
          <p class="phone-switch-hint" id="phone-switch-hint">
            ${isSecret
              ? '← 点击回到主手机'
              : (idolName ? '→ 切换到 ' + escapeHtml(idolName) + ' 经纪人给的秘密手机' : '→ 切换到秘密手机')}
          </p>
        `;
      } else {
        // 秘密手机未解锁 → 显示主手机标识 + 锁定提示
        switchArea.style.display = 'block';
        switchArea.innerHTML = `
          <div class="phone-current-label">
            <span class="phone-current-icon">📱</span>
            <span class="phone-current-text">主手机</span>
          </div>
          <div class="phone-switch-locked">
            <span class="phone-switch-locked-icon">🔐</span>
            <span class="phone-switch-locked-text">秘密手机尚未获得</span>
            <span class="phone-switch-locked-hint">或许有经纪人会悄悄给你一部...</span>
          </div>
        `;
      }
    }
  }

  // ===== APP导航 =====

  /**
   * 打开一个APP
   */
  function openApp(appId) {
    _currentApp = appId;

    const home = document.getElementById('phone-home');
    const appView = document.getElementById('phone-app-view');
    const appTitle = document.getElementById('phone-app-title');
    const appContent = document.getElementById('phone-app-content');

    if (!home || !appView || !appContent) return;

    // 找到APP定义
    const allApps = [...(APPS.main || []), ...(APPS.secret || [])];
    const app = allApps.find(a => a.id === appId);
    if (!app) return;

    // 显示APP内页
    home.style.display = 'none';
    appView.style.display = 'flex';

    // 秘密手机主题
    if (_phoneType === 'secret') {
      appView.classList.add('secret-theme');
    } else {
      appView.classList.remove('secret-theme');
    }

    // 设置标题
    if (appTitle) appTitle.textContent = app.icon + ' ' + app.name;

    // 确保返回按钮恢复为关闭APP（可能在对话中被修改过）
    var backBtn = document.querySelector('.phone-app-back');
    if (backBtn) {
      backBtn.onclick = function() { Game.Phone.closeApp(); };
    }

    // 渲染APP内容
    renderAppContent(appId, appContent);
  }

  /**
   * 关闭当前APP，返回主屏幕
   */
  function closeApp() {
    _currentApp = null;
    // 重置各APP的DOM缓存（阶段12）
    if (Game.PhoneChat && Game.PhoneChat.resetCache) Game.PhoneChat.resetCache();
    if (Game.PhoneSNS && Game.PhoneSNS.resetCache) Game.PhoneSNS.resetCache();
    if (Game.PhoneNews && Game.PhoneNews.resetCache) Game.PhoneNews.resetCache();
    renderHomeScreen();
  }

  /**
   * 根据APP ID渲染对应内容
   */
  function renderAppContent(appId, container) {
    switch (appId) {
      case 'chat':
        if (Game.PhoneChat) Game.PhoneChat.renderContactList(container, 'main');
        break;
      case 'secret-chat':
        if (Game.PhoneChat) {
          // 秘密手机只显示特定爱豆
          const idolIndex = getSecretPhoneIdolIndex();
          Game.PhoneChat.renderSecretContact(container, idolIndex);
        }
        break;
      case 'sns':
        if (Game.PhoneSNS) Game.PhoneSNS.renderFeed(container);
        break;
      case 'news':
        if (Game.PhoneNews) Game.PhoneNews.renderList(container);
        break;
      case 'call':
        if (Game.PhoneCall) Game.PhoneCall.renderContacts(container);
        break;
      case 'gallery':
      case 'secret-album':
        renderGallery(container);
        break;
      default:
        container.innerHTML = '<div class="placeholder-card"><p class="placeholder-text">开发中...</p></div>';
    }
  }

  // ===== 手机切换 =====

  /**
   * 切换主手机 ↔ 秘密手机
   */
  function switchPhone() {
    if (_phoneType === 'main' && !isSecretPhoneUnlocked()) {
      console.warn('[Phone] 秘密手机尚未解锁');
      return;
    }
    _phoneType = _phoneType === 'main' ? 'secret' : 'main';
    _currentApp = null;
    renderHomeScreen();
    // 刷新全局视觉主题（阶段11）
    if (Game.Visual && Game.Visual.refreshAtmosphere) {
      Game.Visual.refreshAtmosphere();
    }
    Game.DEBUG && console.log('[Phone] 切换到：' + (_phoneType === 'main' ? '主手机' : '秘密手机'));
  }

  // ===== 相册 =====

  async function renderGallery(container) {
    container.innerHTML = '<div class="gallery-grid" id="gallery-grid">加载中...</div>';
    const grid = document.getElementById('gallery-grid');
    if (!grid) return;

    const items = [];

    try {
      const wallpaper = await Game.Storage.getPhoto('wallpaper');
      if (wallpaper) {
        items.push({ id: 'wallpaper', label: '📱', blob: wallpaper.blob });
      }
    } catch (e) { /* 无壁纸 */ }

    const idols = Game.state.idols || [];
    for (const idol of idols) {
      try {
        if (idol.avatarId) {
          const photo = await Game.Storage.getPhoto(idol.avatarId);
          if (photo) {
            items.push({ id: idol.avatarId, label: '💜', blob: photo.blob });
          }
        }
      } catch (e) { /* 无头像 */ }
    }

    if (items.length === 0) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-hint);">还没有照片</div>';
      return;
    }

    // 回收旧blob URL防止内存泄漏（阶段12）
    Game.revokeElementBlobURLs(grid);
    grid.innerHTML = items.map(item => `
      <div class="gallery-item">
        <img src="${URL.createObjectURL(item.blob)}" alt="${item.label}">
      </div>
    `).join('');
  }

  // ===== 公开API =====

  return {
    init,
    openApp,
    closeApp,
    switchPhone,
    renderHomeScreen,
    getPhoneType: () => _phoneType,
    isSecretPhoneUnlocked
  };

})();
