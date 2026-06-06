/**
 * SNS APP模块 — 社交动态应用
 * 负责：动态流展示、发布动态、涨粉机制
 */

Game.PhoneSNS = (() => {

  // 当前视图状态：'feed' | 'compose'
  let _view = 'feed';

  // ===== 预设动态数据 =====

  // 爱豆的官方动态（根据已设定的爱豆动态替换名字）
  function getFeedPosts() {
    const idols = Game.state.idols || [];
    const idolNames = idols.map(i => i.nickname || i.name);

    // 基础动态模板
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

    // 如果有爱豆，替换OFFCIAL的username
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
        ${posts.map((post, i) => `
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
        <button class="sns-new-post-btn" onclick="Game.PhoneSNS.renderCompose()">
          ✏️ 分享你的动态...
        </button>
      </div>
    `;
  }

  /**
   * 渲染发帖编辑界面
   */
  function renderCompose() {
    const container = document.getElementById('phone-app-content');
    if (!container) return;

    _view = 'compose';

    // 更新标题
    const titleEl = document.getElementById('phone-app-title');
    if (titleEl) titleEl.textContent = '📱 发新动态';

    // 添加发送按钮到header
    const headerActions = document.getElementById('phone-app-header-actions');
    if (headerActions) {
      headerActions.innerHTML = `
        <button class="phone-app-header-btn" onclick="Game.PhoneSNS.publishPost()">发布</button>
      `;
    }

    container.innerHTML = `
      <div class="sns-compose-form">
        <textarea class="sns-compose-textarea" id="sns-compose-textarea"
                  placeholder="想发什么动态？&#10;&#10;可以是日常碎碎念、暗戳戳秀恩爱、或者纯粹的追星日常..."
                  maxlength="500"></textarea>
        <p class="sns-compose-hint">
          💡 提示：发帖会吸引粉丝关注，但也可能增加嫌疑度。目前预设文案，API接入后可AI生成。
        </p>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-primary btn-block" onclick="Game.PhoneSNS.publishPost()">
            📮 发布动态
          </button>
          <button class="btn btn-secondary" onclick="Game.PhoneSNS.cancelCompose()">
            取消
          </button>
        </div>
      </div>
    `;

    // 聚焦输入框
    setTimeout(() => {
      const textarea = document.getElementById('sns-compose-textarea');
      if (textarea) textarea.focus();
    }, 300);
  }

  /**
   * 取消发帖，返回动态流
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
   * 发布动态
   */
  function publishPost() {
    const textarea = document.getElementById('sns-compose-textarea');
    const text = textarea ? textarea.value.trim() : '';

    if (!text) {
      // 随机生成一条预设动态
      publishRandomPost();
      return;
    }

    // 应用数值效果
    applyPostEffects(text);

    // 返回动态流
    const container = document.getElementById('phone-app-content');
    const titleEl = document.getElementById('phone-app-title');
    const headerActions = document.getElementById('phone-app-header-actions');

    if (titleEl) titleEl.textContent = '📱 SNS';
    if (headerActions) headerActions.innerHTML = '';

    if (container) {
      renderFeed(container);
      // 滚动到顶部显示提示
      setTimeout(() => {
        const feed = document.getElementById('sns-feed-list');
        if (feed) {
          const toast = document.createElement('div');
          toast.style.cssText = 'background:var(--color-safe-light);color:var(--color-safe);padding:12px;text-align:center;font-size:13px;font-weight:600;border-radius:8px;margin-bottom:8px;';
          toast.textContent = '✅ 动态已发布！粉丝数 +' + (50 + Math.floor(Math.random() * 200));
          feed.insertBefore(toast, feed.firstChild);
          setTimeout(() => toast.remove(), 3000);
        }
      }, 100);
    }
  }

  /**
   * 生成并发布随机预设动态
   */
  function publishRandomPost() {
    const idols = Game.state.idols || [];
    const idolName = idols.length > 0 ? (idols[0].nickname || idols[0].name) : '本命';

    const presets = [
      '今天也是元气满满的一天！☀️ 加油加油～',
      '深夜突然想听歌...有人推荐吗？🎧',
      '刚刷到' + idolName + '的新物料，太绝了ㅠㅠ',
      '买到了限定周边！！太幸福了💜 #追星快乐',
      '今天的天气也太适合出门约会了吧～🌸',
      '最近在学韩语，为了能听懂' + idolName + '说的每一句话！📚',
      '谁懂啊...看到爱豆对我这个方向挥手的那一刻，感觉一切都值了🥹',
      '深夜失眠中...脑子里全是编舞动作😵',
      '新入坑的姐妹在哪里？来互粉呀！💕',
      '今天的咖啡也好好喝☕ 一个人坐在窗边发呆也挺好的'
    ];

    const text = presets[Math.floor(Math.random() * presets.length)];
    applyPostEffects(text);

    const container = document.getElementById('phone-app-content');
    const titleEl = document.getElementById('phone-app-title');
    const headerActions = document.getElementById('phone-app-header-actions');

    if (titleEl) titleEl.textContent = '📱 SNS';
    if (headerActions) headerActions.innerHTML = '';

    if (container) {
      renderFeed(container);
      setTimeout(() => {
        const feed = document.getElementById('sns-feed-list');
        if (feed) {
          const toast = document.createElement('div');
          toast.style.cssText = 'background:var(--color-safe-light);color:var(--color-safe);padding:12px;text-align:center;font-size:13px;font-weight:600;border-radius:8px;margin-bottom:8px;';
          toast.textContent = '✅ 动态已发布！粉丝数 +' + (50 + Math.floor(Math.random() * 200));
          feed.insertBefore(toast, feed.firstChild);
          setTimeout(() => toast.remove(), 3000);
        }
      }, 100);
    }
  }

  /**
   * 应用发帖的数值效果
   */
  function applyPostEffects(text) {
    // 涨粉
    const followerGain = 50 + Math.floor(Math.random() * 200);
    Game.State.addFollowers(followerGain);

    // 发帖计数
    Game.State.incrementPosts();

    // 魅力微增
    Game.State.addCharm(1);

    // 嫌疑度微增（公开社交活动有暴露风险）
    Game.State.addSuspicion(Math.floor(Math.random() * 2));

    // 自动存档
    Game.State.autoSave();

    // 刷新个人面板
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
    renderCompose,
    publishPost,
    cancelCompose
  };

})();
