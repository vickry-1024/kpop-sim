/**
 * SNS APP模块 — 社交动态应用
 * 负责：动态流展示、发布动态（含风格选择）、涨粉机制
 */

Game.PhoneSNS = (() => {

  // 当前视图状态：'feed' | 'style-select' | 'compose'
  let _view = 'feed';

  // 当前选中的发帖风格（null=自定义）
  let _selectedStyle = null;

  // AI评论缓存（key: postIndex, value: comments array）
  var _commentCache = {};

  // 当前查看的帖子索引（用于评论提交）
  var _currentPostIndex = null;

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
        ${posts.map((post, postIndex) => `
          <div class="sns-post-card" onclick="Game.PhoneSNS.showPostDetail(${postIndex})" style="cursor:pointer;">
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

  // ===== SNS 动态详情（功能2增强：AI评论 + 玩家评论 + 风险） =====

  /**
   * 根据帖子类别获取静态评论（API不可用时的fallback，扩展为5-8条）
   */
  function getStaticComments(postIndex, category) {
    var pool = {
      update: [
        { username: '铁血粉丝', text: '太棒了！！今天也辛苦了💜 永远支持你！' },
        { username: '深夜追星人', text: '好感动ㅠㅠ 这周的舞台都看了，每次都在进步' },
        { username: '评论区常驻用户', text: '第一！前排表白，今天也是被治愈的一天' },
        { username: '音乐治愈师', text: '看到这个动态心情瞬间变好了✨' },
        { username: '舞台粉一枚', text: '昨天那场舞台我看了十遍！每一个动作都好绝' },
        { username: '海外粉丝', text: 'From overseas! Love you so much 💜' },
        { username: '今天也爱你', text: '早点休息呀！身体最重要，不要太累了' },
        { username: '追星日记', text: '截图了截图了！！今天的物料够我回味一周' }
      ],
      teaser: [
        { username: '解码大师', text: '我猜是夏日清凉风！！看背景的颜色和服装风格' },
        { username: '音乐爱好家', text: '能不能剧透一下回归日期啊 等不及了' },
        { username: '吃瓜群众', text: '据说这次是两首歌一起出 有人脉说的 不知道真假' },
        { username: '数据粉', text: '已经开始存钱买专辑了！！这次一定要冲初动' },
        { username: '好奇宝宝', text: '会是什么风格呢？暗黑？清新？复古？好期待' },
        { username: '站姐预备役', text: '回归期我要去蹲上下班！！谁一起？' }
      ],
      fan: [
        { username: '同担姐妹', text: '好羡慕！！我没抽到本命小卡ㅠㅠ' },
        { username: '换卡达人', text: '我有多的XX卡，换吗？？私信你了' },
        { username: '追星元老', text: '这个角度拍得真好！请问是用什么相机拍的？' },
        { username: '小卡收藏家', text: '这次的小卡真的太好看了！！设计师加鸡腿' },
        { username: '新入坑的', text: '刚入坑不久 就被小卡吸引了 这个团好有意思' }
      ],
      news: [
        { username: '理智追星人', text: '消息靠谱吗...先观望一下 等官方确认' },
        { username: '八卦小能手', text: '业内人士说的是谁啊？解码一下关键字' },
        { username: '热心网友', text: '等官方消息吧，不要乱传谣言' },
        { username: '老韩娱人', text: '每年都这么说 结果每年阵容都差不多 别抱太大期待' },
        { username: '路人甲', text: '吃瓜吃瓜🍉 有没有人给科普一下背景？' }
      ],
      rumor: [
        { username: '匿名吃瓜', text: '我也看到了那张图！！不知道是真是假但是好激动' },
        { username: '理性分析', text: '先别急着下定论 等当事人回应再说' },
        { username: '显微镜女孩', text: '我分析了一波时间线，感觉有戏！衣服和配饰对得上' },
        { username: '吃瓜不信瓜', text: '就算是真的又怎样 爱豆也有私生活啊' },
        { username: '佛系追星', text: '当没看到吧 不影响我听歌就行' },
        { username: '热搜预定', text: '这个要是真的 明天绝对热搜第一' },
        { username: '深夜吃瓜群众', text: '半夜醒来看到这个 睡不着了！！' }
      ]
    };
    var comments = pool[category] || [
      { username: '网友A', text: '有意思！关注一下后续发展' },
      { username: '路人B', text: '蹲一个后续' },
      { username: '热心观众', text: '展开说说？我也想知道更多' }
    ];
    // 使用postIndex作为种子随机选5-8条
    var seed = postIndex * 7 + 3;
    var count = 5 + (seed % 4); // 5-8条
    var shuffled = comments.slice().sort(function() { return 0.5 - ((seed++ * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; });
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }

  /**
   * 调用DeepSeek API生成评论
   */
  async function generateAIComments(post, postIndex) {
    // 如果有缓存直接返回
    if (_commentCache[postIndex]) return _commentCache[postIndex];

    // 如果没有API，用静态评论
    if (!Game.API || !Game.API.hasAnyKey || !Game.API.hasAnyKey()) {
      var staticComments = getStaticComments(postIndex, post.category);
      _commentCache[postIndex] = staticComments;
      return staticComments;
    }

    try {
      var categoryLabels = {
        update: '日常更新', teaser: '预告', fan: '粉丝动态',
        news: '娱乐新闻', rumor: '绯闻/传闻'
      };
      var categoryLabel = categoryLabels[post.category] || '动态';

      var messages = [
        { role: 'system', content: '你是韩国Kpop娱乐平台SNS的评论生成器。请根据帖子内容，生成6-8条不同粉丝的评论。每条评论格式：{"username":"用户名","text":"评论内容"}。\n\n要求：\n- 用户名多样化（韩文名/中文名/英文名都有）\n- 评论风格多样（支持鼓励/理性分析/质疑/吃瓜/幽默/感动）\n- 评论要符合帖子内容，不能跑题\n- 每条评论20-60字\n- 必须返回严格的JSON数组格式，不要有其他文字\n- 评论区氛围要真实，像真实的社交媒体评论区' },
        { role: 'user', content: '帖子内容（' + categoryLabel + '）：\n发布者：' + post.username + '\n正文：' + post.body + '\n\n请生成6-8条评论：' }
      ];

      var response = await Game.API.callDeepSeek(messages, { temperature: 0.9, maxTokens: 800 });
      if (response && response.trim()) {
        // 解析JSON
        var cleaned = response.trim();
        if (cleaned.startsWith('```')) {
          cleaned = cleaned.replace(/```\w*\n?/g, '').replace(/```/g, '');
        }
        var parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed) && parsed.length > 0) {
          _commentCache[postIndex] = parsed;
          return parsed;
        }
      }
    } catch (e) {
      console.warn('[SNS] AI评论生成失败，使用静态评论:', e.message);
    }

    // fallback
    var fallback = getStaticComments(postIndex, post.category);
    _commentCache[postIndex] = fallback;
    return fallback;
  }

  /**
   * 渲染评论区域HTML
   */
  function renderCommentsHTML(comments) {
    if (!comments || comments.length === 0) return '';
    return comments.map(function(c) {
      return '<div class="sns-detail-comment">' +
        '<span class="sns-detail-comment-user">' + escapeHtml(c.username) + '</span>' +
        '<span class="sns-detail-comment-text">' + escapeHtml(c.text) + '</span>' +
      '</div>';
    }).join('');
  }

  /**
   * 显示帖子详情（子页面模式，异步加载AI评论）
   */
  function showPostDetail(postIndex) {
    var posts = getFeedPosts();
    var post = posts[postIndex];
    if (!post) return;

    _view = 'detail';
    _currentPostIndex = postIndex;

    var container = document.getElementById('phone-app-content');
    var titleEl = document.getElementById('phone-app-title');
    var headerActions = document.getElementById('phone-app-header-actions');

    if (!container) return;
    if (titleEl) titleEl.textContent = '📱 动态详情';
    if (headerActions) headerActions.innerHTML = '';

    // 覆盖返回按钮：返回feed而不是关闭app
    var backBtn = document.querySelector('.phone-app-back');
    if (backBtn) {
      backBtn.setAttribute('onclick', 'Game.PhoneSNS.backToFeed()');
    }

    // 先渲染基本结构（评论显示加载中）
    container.innerHTML =
      '<div class="sns-post-detail">' +
        '<div class="sns-detail-header">' +
          '<div class="sns-detail-avatar">' + post.userIcon + '</div>' +
          '<div class="sns-detail-user-info">' +
            '<span class="sns-detail-username">' + escapeHtml(post.username) + '</span>' +
            '<span class="sns-detail-time">' + post.time + '</span>' +
          '</div>' +
        '</div>' +
        (post.image ? '<div class="sns-detail-image">' + post.image + '</div>' : '') +
        '<div class="sns-detail-body">' + escapeHtml(post.body) + '</div>' +
        '<div class="sns-detail-actions">' +
          '<button class="sns-detail-action-btn" id="sns-detail-like-btn" onclick="Game.PhoneSNS.likePost()">' +
            '❤️ ' + formatCount(post.likes) +
          '</button>' +
          '<button class="sns-detail-action-btn" onclick="Game.PhoneSNS.sharePost()">' +
            '🔗 分享' +
          '</button>' +
        '</div>' +
        '<div class="sns-detail-comments-section" id="sns-detail-comments-section">' +
          '<div class="sns-detail-comments-title">💬 评论</div>' +
          '<div class="sns-detail-comments-loading" id="sns-comments-loading">' +
            '⏳ AI生成评论中...' +
          '</div>' +
          '<div id="sns-comments-list"></div>' +
        '</div>' +
        '<div class="sns-comment-input-area">' +
          '<textarea class="sns-comment-input" id="sns-comment-input"' +
            ' placeholder="写评论...（注意：评论内容可能暴露你的身份！）"' +
            ' maxlength="200"></textarea>' +
          '<button class="btn btn-primary btn-sm" id="sns-comment-submit-btn" ' +
            ' onclick="Game.PhoneSNS.submitComment()">发送</button>' +
        '</div>' +
      '</div>';

    // 异步加载评论
    generateAIComments(post, postIndex).then(function(comments) {
      var loadingEl = document.getElementById('sns-comments-loading');
      var listEl = document.getElementById('sns-comments-list');
      var titleEl2 = document.querySelector('.sns-detail-comments-title');

      if (loadingEl) loadingEl.style.display = 'none';
      if (listEl) listEl.innerHTML = renderCommentsHTML(comments);
      if (titleEl2) titleEl2.textContent = '💬 评论 (' + comments.length + '条)';
    }).catch(function() {
      var loadingEl = document.getElementById('sns-comments-loading');
      if (loadingEl) loadingEl.textContent = '加载评论失败';
    });
  }

  /**
   * 分析玩家评论的风险等级
   * @returns {{ level: 'low'|'medium'|'high', suspicion: number, followers: number, reason: string }}
   */
  function analyzeCommentRisk(text) {
    var idols = Game.state.idols || [];
    var idolNames = [];
    idols.forEach(function(idol) {
      idolNames.push(idol.name);
      if (idol.nickname) idolNames.push(idol.nickname);
    });

    // 高风险关键词：暗示私人关系、内部信息
    var highRiskPatterns = [
      /我(男|女)朋友/, /我(老公|老婆)/, /约会/, /在一起了/, /交往/,
      /昨晚.*和[他她]/, /[他她].*房间/, /偷偷/, /秘密恋爱/,
      /好想[他她]/, /想[他她]了/, /等[他她]回来/,
      /我家的/, /私底下/, /后台/, /休息室/, /只有我们/,
      /欧巴.*我的/, /欧尼.*我的/, /亲爱的/,
      /[他她]昨晚/, /[他她]今天/, /我和[他她]/
    ];

    // 中风险关键词：示爱、暧昧暗示
    var mediumRiskPatterns = [
      /好帅/, /好美/, /心动/, /心跳加速/, /太迷人了/,
      /想你了/, /等你/, /❤️/, /💕/, /😍/, /🥰/,
      /最爱的/, /本命/, /唯一/, /眼里只有/,
      /看[他她]的眼神/, /太配了/, /在一起吧/,
      /每天.*想/, /梦里.*见/
    ];

    // 检查是否提到具体爱豆名字
    var mentionedIdol = null;
    for (var i = 0; i < idolNames.length; i++) {
      if (idolNames[i] && text.indexOf(idolNames[i]) !== -1) {
        mentionedIdol = idolNames[i];
        break;
      }
    }

    // 高风险检测
    for (var h = 0; h < highRiskPatterns.length; h++) {
      if (highRiskPatterns[h].test(text)) {
        var reason = '评论暗示了与爱豆的私人关系，被粉丝截图分析';
        if (mentionedIdol) {
          reason = '评论提到了"' + mentionedIdol + '"并暗示亲密关系，被粉丝扒出关联账号';
        }
        return { level: 'high', suspicion: 5 + Math.floor(Math.random() * 6), followers: 0, reason: reason };
      }
    }

    // 中风险检测
    for (var m = 0; m < mediumRiskPatterns.length; m++) {
      if (mediumRiskPatterns[m].test(text)) {
        var mReason = '评论带有明显的暧昧暗示，有粉丝开始注意你的账号';
        if (mentionedIdol) {
          mReason = '评论提到"' + mentionedIdol + '"且语气暧昧，被路人截图发帖讨论';
        }
        return { level: 'medium', suspicion: 2 + Math.floor(Math.random() * 4), followers: 5 + Math.floor(Math.random() * 20), reason: mReason };
      }
    }

    // 低风险：正常评论
    return { level: 'low', suspicion: Math.random() < 0.3 ? 1 : 0, followers: 10 + Math.floor(Math.random() * 30), reason: '' };
  }

  /**
   * 玩家提交评论
   */
  function submitComment() {
    var input = document.getElementById('sns-comment-input');
    var btn = document.getElementById('sns-comment-submit-btn');
    if (!input) return;

    var text = input.value.trim();
    if (!text) return;

    // 分析风险
    var risk = analyzeCommentRisk(text);

    // 应用效果
    if (risk.suspicion > 0) {
      Game.State.addSuspicion(risk.suspicion);
    }
    if (risk.followers > 0) {
      Game.State.addFollowers(risk.followers);
    }

    // 把玩家评论插入评论列表
    var listEl = document.getElementById('sns-comments-list');
    if (listEl) {
      var commentEl = document.createElement('div');
      commentEl.className = 'sns-detail-comment sns-detail-comment-self';
      commentEl.innerHTML =
        '<span class="sns-detail-comment-user" style="color:var(--color-primary);">🧑‍🎤 我</span>' +
        '<span class="sns-detail-comment-text">' + escapeHtml(text) + '</span>';
      listEl.appendChild(commentEl);
      listEl.scrollTop = listEl.scrollHeight;
    }

    // 清空输入
    input.value = '';

    // 禁用按钮短暂冷却
    if (btn) {
      btn.disabled = true;
      btn.textContent = '已发送';
      setTimeout(function() {
        if (btn) { btn.disabled = false; btn.textContent = '发送'; }
      }, 3000);
    }

    // 更新评论数
    var titleEl = document.querySelector('.sns-detail-comments-title');
    if (titleEl) {
      var currentCount = parseInt(titleEl.textContent.match(/\d+/)) || 0;
      titleEl.textContent = '💬 评论 (' + (currentCount + 1) + '条)';
    }

    // 风险提示Toast
    if (risk.level !== 'low') {
      var toast = document.createElement('div');
      var bgColor = risk.level === 'high' ? 'rgba(255,107,107,0.95)' : 'rgba(255,165,2,0.95)';
      toast.style.cssText = 'position:fixed;bottom:120px;left:50%;transform:translateX(-50%);background:' + bgColor + ';color:#FFF;padding:12px 20px;border-radius:12px;font-size:12px;z-index:600;max-width:280px;text-align:center;line-height:1.5;animation:celebrationIn 0.3s ease-out;';
      toast.innerHTML = '⚠️ ' + risk.reason + '<br><span style="font-size:11px;opacity:0.85;">嫌疑度 +' + risk.suspicion + '</span>';
      document.body.appendChild(toast);
      setTimeout(function() {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(function() { toast.remove(); }, 300);
      }, 4000);
    } else if (risk.followers > 0) {
      // 低风险涨粉提示
      var toast2 = document.createElement('div');
      toast2.style.cssText = 'position:fixed;bottom:120px;left:50%;transform:translateX(-50%);background:rgba(78,205,196,0.9);color:#FFF;padding:10px 20px;border-radius:12px;font-size:12px;z-index:600;animation:celebrationIn 0.3s ease-out;';
      toast2.textContent = '💬 评论成功！粉丝 +' + risk.followers;
      document.body.appendChild(toast2);
      setTimeout(function() {
        toast2.style.opacity = '0';
        toast2.style.transition = 'opacity 0.3s';
        setTimeout(function() { toast2.remove(); }, 300);
      }, 2000);
    }

    // 自动存档
    Game.State.autoSave();
    if (Game.Profile) Game.Profile.refresh();

    console.log('[SNS] 玩家评论，风险等级：' + risk.level + '，嫌疑度+' + risk.suspicion + '，粉丝+' + risk.followers);
  }

  /**
   * 点赞按钮交互
   */
  function likePost() {
    var btn = document.getElementById('sns-detail-like-btn');
    if (!btn) return;
    btn.innerHTML = '❤️ +1';
    btn.style.transform = 'scale(1.3)';
    btn.style.color = '#FF6B6B';
    btn.style.transition = 'all 0.2s ease';
    setTimeout(function() {
      btn.innerHTML = '❤️ 已赞';
      btn.style.transform = 'scale(1)';
      btn.style.color = '#FF6B6B';
      btn.disabled = true;
    }, 300);
  }

  /**
   * 分享按钮交互
   */
  function sharePost() {
    var detail = document.querySelector('.sns-post-detail');
    if (!detail) return;
    var toast = document.createElement('div');
    toast.style.cssText = 'position:fixed;bottom:100px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.75);color:#FFF;padding:10px 24px;border-radius:20px;font-size:13px;z-index:600;';
    toast.textContent = '✅ 已分享到你的主页';
    document.body.appendChild(toast);
    setTimeout(function() {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(function() { toast.remove(); }, 300);
    }, 1500);
  }

  /**
   * 从详情页返回动态流
   */
  function backToFeed() {
    var container = document.getElementById('phone-app-content');
    var titleEl = document.getElementById('phone-app-title');
    if (titleEl) titleEl.textContent = '📱 SNS';

    // 恢复返回按钮
    var backBtn = document.querySelector('.phone-app-back');
    if (backBtn) {
      backBtn.setAttribute('onclick', 'Game.Phone.closeApp()');
    }

    // 清除评论缓存（下次打开重新生成）
    _commentCache = {};
    _currentPostIndex = null;

    if (container) renderFeed(container);
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
    cancelCompose,
    showPostDetail,
    likePost,
    sharePost,
    backToFeed,
    submitComment
  };

})();
