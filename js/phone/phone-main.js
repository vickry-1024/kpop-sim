/**
 * 手机主屏幕模块 — 手机系统的入口
 * 负责：APP图标网格、主屏幕↔APP内页导航、主手机↔秘密手机切换
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
        renderHomeScreen();
      }
    });
    console.log('[Phone] 手机系统初始化完成');
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
    const switchBtn = document.getElementById('phone-switch-btn');
    const switchHint = document.getElementById('phone-switch-hint');

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
      appGrid.innerHTML = apps.map(app => `
        <button class="phone-app-icon" onclick="Game.Phone.openApp('${app.id}')">
          <span class="phone-app-icon-bg" style="background:${app.color}20; color:${app.color};">
            ${app.icon}
          </span>
          <span class="phone-app-icon-name">${app.name}</span>
        </button>
      `).join('');
    }

    // 切换按钮
    if (switchBtn) {
      const isSecret = _phoneType === 'secret';
      switchBtn.textContent = isSecret ? '🔒 秘密手机' : '📱 主手机';
      switchBtn.className = 'phone-switch-btn' + (isSecret ? ' secret-mode' : '');
    }

    if (switchHint) {
      switchHint.textContent = _phoneType === 'main'
        ? '点击切换 → 秘密手机（加密通讯）'
        : '点击切换 → 回到主手机';
    }
  }

  // ===== APP导航 =====

  /**
   * 打开一个APP
   * @param {string} appId - APP标识
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

    // 渲染APP内容
    renderAppContent(appId, appContent);
  }

  /**
   * 关闭当前APP，返回主屏幕
   */
  function closeApp() {
    _currentApp = null;
    renderHomeScreen();
  }

  /**
   * 根据APP ID渲染对应内容
   */
  function renderAppContent(appId, container) {
    switch (appId) {
      case 'chat':
      case 'secret-chat':
        if (Game.PhoneChat) Game.PhoneChat.renderContactList(container, _phoneType);
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
    _phoneType = _phoneType === 'main' ? 'secret' : 'main';
    _currentApp = null;
    renderHomeScreen();
    console.log('[Phone] 切换到：' + (_phoneType === 'main' ? '主手机' : '秘密手机'));
  }

  // ===== 相册（简单版） =====

  /**
   * 渲染相册（显示壁纸 + 爱豆头像）
   */
  async function renderGallery(container) {
    container.innerHTML = '<div class="gallery-grid" id="gallery-grid">加载中...</div>';
    const grid = document.getElementById('gallery-grid');
    if (!grid) return;

    const items = [];

    // 壁纸
    try {
      const wallpaper = await Game.Storage.getPhoto('wallpaper');
      if (wallpaper) {
        items.push({ id: 'wallpaper', label: '📱', blob: wallpaper.blob });
      }
    } catch (e) { /* 无壁纸则跳过 */ }

    // 各爱豆头像
    const idols = Game.state.idols || [];
    for (const idol of idols) {
      try {
        if (idol.avatarId) {
          const photo = await Game.Storage.getPhoto(idol.avatarId);
          if (photo) {
            items.push({ id: idol.avatarId, label: '💜', blob: photo.blob });
          }
        }
      } catch (e) { /* 无头像则跳过 */ }
    }

    if (items.length === 0) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-hint);">还没有照片</div>';
      return;
    }

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
    getPhoneType: () => _phoneType
  };

})();
