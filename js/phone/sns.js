/**
 * SNS APP模块 — 社交动态应用
 * 负责：动态流展示、发布动态（含风格选择）、涨粉机制
 */

Game.PhoneSNS = (() => {

  // 当前视图状态：'feed' | 'style-select' | 'compose'
  let _view = 'feed';

  // 当前选中的发帖风格（null=自定义）
  let _selectedStyle = null;

  // ===== 发帖风格定义 =====
  const POST_STYLES = [
    {
      id: 'lovestagram',
      label: '暗戳戳秀恩爱',
      icon: '💕',
      desc: '发一张只有你们懂的暗示照，粉丝会疯狂解码。嫌疑度风险高但刺激。',
      effectMods: { followers: [50, 200], suspicion: [3, 8], stress: [-5, -2] },
      color: '#FF6B9D'
    },
    {
      id: 'fan-support',
      label: '粉丝视角应援',
      icon: '📣',
      desc: '晒专辑、刷话题、宣传新歌。阳光正面，涨粉最多最安全。',
      effectMods: { followers: [200, 500], charm: [2, 5], suspicion: [-1, 0] },
      color: '#4ECDC4'
    },
    {
      id: 'daily-life',
      label: '晒日常美照',
      icon: '🌸',
      desc: '发自拍和生活碎片，自然经营社交形象。稳妥涨粉。',
      effectMods: { followers: [100, 300], charm: [3, 6], suspicion: [0, 2] },
      color: '#A78BFA'
    },
    {
      id: 'custom',
      label: '自定义发文',
      icon: '✏️',
      desc: '自己写想发的内容，自由发挥。效果根据内容而定。',
      effectMods: { followers: [50, 200], charm: [1, 3], suspicion: [0, 2] },
      color: '#8E8E93'
    }
  ];

  // 每种风格的预设文案池
  const STYLE_TEXTS = {
    'lovestagram': [
      '今天的风景真美...和你一起看的每一个瞬间都值得珍藏 💕',
      '有些秘密只属于我们俩 🤫✨ #lucky',
      '深夜的歌单暴露了心情 🎵 你懂吗？',
      '两个人的世界，不需要第三个人懂 🌙',
      '最近好喜欢"偶然"遇见某人呢...☕'
    ],
    'fan-support': [
      '新歌循环播放中！！太好听了ㅠㅠ 大家快去听 🎧',
      '永远支持你们！每一步都算数 💪✨ #Fighting',
      '今天也认真投票了！粉丝的爱是认真的 💜',
      '专辑买到手软但幸福！！每一版都要收藏 📀',
      '为爱豆学了新技能！追星使我进步 📚✨'
    ],
    'daily-life': [
      '今日份自拍 ☀️ 天气好心情也好～',
      '在咖啡店发呆的下午 ☕ 一个人的时间也很珍贵',
      '新买的小物件让生活充满仪式感 🌸 #日常',
      '今天的OOTD！感觉还不错 👗✨',
      '下班路上的夕阳太美了 🌇 忍不住拍了一张'
    ]
  };

  // ===== 预设动态数据 =====

  function getFeedPosts() {
    const idols = Game.state.idols || [];
    const idolNames = idols.map(i => i.nickname || i.name);

    const templates = [
      {
        userType: 'idol',
        username: 'OFFICIAL',
        userIcon: '⭐',
        time: '10分钟前',
        likes: 15420,
        comments: 2301,
        body: '今天练习到很晚，但想到很快就能见到大家了，一点都不累！💪',
        image: '🎤',
        category: 'update'
      },
      {
        userType: 'fan',
        username: '真爱站姐',
        userIcon: '📸',
        time: '1小时前',
        likes: 3200,
        comments: 456,
        body: '今天的上班路！太美了ㅠㅠㅠㅠ 预览图先来一张，高清正在修 #每日打卡',
        image: '📷',
        category: 'fan'
      },
      {
        userType: 'idol',
        username: 'OFFICIAL',
        userIcon: '⭐',
        time: '3小时前',
        likes: 28300,
        comments: 4102,
        body: '新专辑准备中...猜猜这次是什么风格？🎵',
        image: '🎵',
        category: 'teaser'
      },
      {
        userType: 'news',
        username: 'Kpop新闻速报',
        userIcon: '📰',
        time: '5小时前',
        likes: 8900,
        comments: 1204,
        body: '据业内人士透露，某大势团体将于下月回归！粉丝们准备好了吗？',
        image: '🔥',
        category: 'news'
      },
      {
        userType: 'fan',
        username: '追星少女日常',
        userIcon: '💕',
        time: '6小时前',
        likes: 1200,
        comments: 89,
        body: '买了新专辑！！抽到了本命小卡ㅠㅠ 今天是我的幸运日 #拆专 #小卡',
        image: '💿',
        category: 'fan'
      },
      {
        userType: 'idol',
        username: 'OFFICIAL',
        userIcon: '⭐',
        time: '昨天',
        likes: 35200,
        comments: 5670,
        body: '深夜放个自拍🤳 晚安啦大家，做个好梦～',
        image: '🤳',
        category: 'update'
      },
      {
        userType: 'fan',
        username: '匿名追星er',
        userIcon: '🫣',
        time: '昨天',
        likes: 780,
        comments: 56,
        body: '有人也看到昨晚那对了吗...偶遇图已经在韩网传疯了。不说名字，懂得都懂 👀',
        image: '🕵️',
        category: 'rumor'
      },
      {
        userType: 'news',
        username: '娱乐早知道',
        userIcon: '📡',
        time: '2天前',
        likes: 12400,
        comments: 2310,
        body: '年末颁奖典礼阵容公布！你家爱豆入围了吗？来看看完整名单 👇',
        image: '🏆',
        category: 'news'
      }
    ];

    if (idolNames.length > 0) {
      return templates.map(t => {
        if (t.userType === 'idol') {
          return { ...t, username: idolNames[Math.floor(Math.random() * idolNames.length)] };
        }
        return t;
      });
    }

    return templates;
  }

  // ===== 渲染 =====

  /**
   * 渲染SNS动态流
   */
  function renderFeed(container) {
    _view = 'feed';

    const posts = getFeedPosts();

    container.innerHTML = `
      <div class="sns-feed" id="sns-feed-list">
        ${posts.map(post => `
          <div class="sns-post-card">
            <div class="sns-post-header">
              <div class="sns-post-avatar">${post.userIcon}</div>
              <div class="sns-post-user">
                <span class="sns-post-username">${escapeHtml(post.username)}</span>
                <span class="sns-post-time">${post.time}</span>
              </div>
            </div>
            ${post.image ? `<div class="sns-post-image">${post.image}</div>` : ''}
            <div class="sns-post-body">${escapeHtml(post.body)}</div>
            <div class="sns-post-actions">
              <span class="sns-post-action">
                <span class="sns-post-action-icon">❤️</span> ${formatCount(post.likes)}
              </span>
              <span class="sns-post-action">
                <span class="sns-post-action-icon">💬</span> ${formatCount(post.comments)}
              </span>
              <span class="sns-post-action">
                <span class="sns-post-action-icon">🔗</span> 分享
              </span>
            </div>
          </div>
        `).join('')}

        <!-- 发帖入口 -->
        <button class="sns-new-post-btn" onclick="Game.PhoneSNS.renderStyleSelect()">
          ✏️ 分享你的动态...
        </button>
      </div>
    `;
  }

  /**
   * 渲染发帖风格选择界面
   */
  function renderStyleSelect() {
    const container = document.getElementById('phone-app-content');
    if (!container) return;

    _view = 'style-select';
    _selectedStyle = null;

    const titleEl = document.getElementById('phone-app-title');
    if (titleEl) titleEl.textContent = '📱 发新动态';

    const headerActions = document.getElementById('phone-app-header-actions');
    if (headerActions) headerActions.innerHTML = '';

    container.innerHTML = `
      <div class="sns-style-select">
        <p class="sns-style-hint">选择发帖风格</p>
        ${POST_STYLES.map(style => `
          <button class="sns-style-option" onclick="Game.PhoneSNS.selectStyle('${style.id}')"
                  style="border-left: 4px solid ${style.color};">
            <span class="sns-style-icon">${style.icon}</span>
            <div class="sns-style-info">
              <span class="sns-style-label">${style.label}</span>
              <span class="sns-style-desc">${style.desc}</span>
              <span class="sns-style-effects">
                ${Object.entries(style.effectMods).map(([key, range]) => {
                  const labels = { followers: '粉丝', charm: '魅力', suspicion: '嫌疑度', stress: '压力' };
                  const sign0 = range[0] >= 0 ? '+' : '';
                  const sign1 = range[1] >= 0 ? '+' : '';
                  const cls = key === 'suspicion' && range[1] > 0 ? 'effect-negative' : 'effect-positive';
                  return `<span class="${cls}">${labels[key] || key} ${sign0}${range[0]}~${sign1}${range[1]}</span>`;
                }).join(' ')}
              </span>
            </div>
            <span class="sns-style-arrow">→</span>
          </button>
        `).join('')}
      </div>
    `;
  }

  /**
   * 选择发帖风格
   */
  function selectStyle(styleId) {
    if (styleId === 'custom') {
      // 自定义 → 打开文字输入界面
      renderCompose();
      return;
    }

    // 预设风格 → 直接发布
    const style = POST_STYLES.find(s => s.id === styleId);
    if (!style) return;

    _selectedStyle = style;

    // 从文案池随机选一条
    const texts = STYLE_TEXTS[styleId] || [];
    const text = texts.length > 0
      ? texts[Math.floor(Math.random() * texts.length)]
      : '今天也是美好的一天～';

    // 发布
    publishWithStyle(style, text);
  }

  /**
   * 渲染自定义发帖编辑界面
   */
  function renderCompose() {
    const container = document.getElementById('phone-app-content');
    if (!container) return;

    _view = 'compose';
    _selectedStyle = POST_STYLES.find(s => s.id === 'custom');

    const titleEl = document.getElementById('phone-app-title');
    if (titleEl) titleEl.textContent = '📱 自定义发文';

    const headerActions = document.getElementById('phone-app-header-actions');
    if (headerActions) {
      headerActions.innerHTML = `
        <button class="phone-app-header-btn" onclick="Game.PhoneSNS.publishCustomPost()">发布</button>
      `;
    }

    container.innerHTML = `
      <div class="sns-compose-form">
        <textarea class="sns-compose-textarea" id="sns-compose-textarea"
                  placeholder="想发什么动态？&#10;&#10;可以是日常碎碎念、暗戳戳秀恩爱、或者纯粹的追星日常..."
                  maxlength="500"></textarea>
        <p class="sns-compose-hint">
          💡 提示：发帖会吸引粉丝关注，但也可能增加嫌疑度。
        </p>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-primary btn-block" onclick="Game.PhoneSNS.publishCustomPost()">
            📮 发布动态
          </button>
          <button class="btn btn-secondary" onclick="Game.PhoneSNS.cancelCompose()">
            取消
          </button>
        </div>
      </div>
    `;

    setTimeout(() => {
      const textarea = document.getElementById('sns-compose-textarea');
      if (textarea) textarea.focus();
    }, 300);
  }

  /**
   * 发布自定义内容
   */
  function publishCustomPost() {
    const textarea = document.getElementById('sns-compose-textarea');
    const text = textarea ? textarea.value.trim() : '';

    if (!text) {
      // 空内容 → 用日常风格的随机文案
      const dailyTexts = STYLE_TEXTS['daily-life'] || [];
      const fallback = dailyTexts[Math.floor(Math.random() * dailyTexts.length)] || '今天也是美好的一天～';
      publishWithStyle(POST_STYLES.find(s => s.id === 'custom'), fallback);
      return;
    }

    publishWithStyle(POST_STYLES.find(s => s.id === 'custom'), text);
  }

  /**
   * 取消发帖
   */
  function cancelCompose() {
    const container = document.getElementById('phone-app-content');
    const titleEl = document.getElementById('phone-app-title');
    const headerActions = document.getElementById('phone-app-header-actions');

    if (titleEl) titleEl.textContent = '📱 SNS';
    if (headerActions) headerActions.innerHTML = '';

    if (container) renderFeed(container);
  }

  /**
   * 用指定风格发布
   */
  function publishWithStyle(style, text) {
    // 应用风格特定的数值效果
    applyStyleEffects(style);

    // 返回动态流
    const container = document.getElementById('phone-app-content');
    const titleEl = document.getElementById('phone-app-title');
    const headerActions = document.getElementById('phone-app-header-actions');

    if (titleEl) titleEl.textContent = '📱 SNS';
    if (headerActions) headerActions.innerHTML = '';

    if (container) {
      renderFeed(container);
      // 显示提示
      setTimeout(() => {
        const feed = document.getElementById('sns-feed-list');
        if (feed) {
          const toast = document.createElement('div');
          toast.style.cssText = 'background:var(--color-safe-light);color:var(--color-safe);padding:12px;text-align:center;font-size:13px;font-weight:600;border-radius:8px;margin-bottom:8px;';
          const followersGain = style.effectMods.followers
            ? style.effectMods.followers[0] + Math.floor(Math.random() * (style.effectMods.followers[1] - style.effectMods.followers[0] + 1))
            : 100;
          toast.textContent = '✅ ' + style.label + ' · 已发布！粉丝数 +' + followersGain;
          feed.insertBefore(toast, feed.firstChild);
          setTimeout(() => toast.remove(), 3000);
        }
      }, 100);
    }
  }

  /**
   * 应用风格的数值效果
   */
  function applyStyleEffects(style) {
    if (!style || !style.effectMods) return;

    // 涨粉
    if (style.effectMods.followers) {
      const range = style.effectMods.followers;
      const gain = range[0] + Math.floor(Math.random() * (range[1] - range[0] + 1));
      Game.State.addFollowers(gain);
    }

    // 发帖计数
    Game.State.incrementPosts();

    // 魅力
    if (style.effectMods.charm) {
      const range = style.effectMods.charm;
      const gain = range[0] + Math.floor(Math.random() * (range[1] - range[0] + 1));
      Game.State.addCharm(gain);
    }

    // 嫌疑度
    if (style.effectMods.suspicion) {
      const range = style.effectMods.suspicion;
      const gain = range[0] + Math.floor(Math.random() * (range[1] - range[0] + 1));
      Game.State.addSuspicion(gain);
    }

    // 压力
    if (style.effectMods.stress) {
      const range = style.effectMods.stress;
      const gain = range[0] + Math.floor(Math.random() * (range[1] - range[0] + 1));
      Game.State.addStress(gain);
    }

    // 自动存档 + 刷新面板
    Game.State.autoSave();
    if (Game.Profile) Game.Profile.refresh();
  }

  // ===== 工具 =====

  function formatCount(n) {
    if (n >= 10000) return (n / 10000).toFixed(1) + '万';
    if (n >= 1000) return (n / 1000).toFixed(1) + '千';
    return n.toString();
  }

  // ===== 公开API =====

  return {
    renderFeed,
    renderStyleSelect,
    selectStyle,
    renderCompose,
    publishCustomPost,
    cancelCompose
  };

})();
