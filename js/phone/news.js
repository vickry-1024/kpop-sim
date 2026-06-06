/**
 * 新闻APP模块 — 娱乐新闻应用
 * 负责：新闻列表、详情查看、分类筛选
 */

Game.PhoneNews = (() => {

  // 当前详情展开的新闻索引（-1 = 列表视图）
  let _detailIndex = -1;

  // ===== 预设新闻数据 =====

  function getArticles() {
    const idols = Game.state.idols || [];
    const idolNames = idols.map(i => i.nickname || i.name);

    const articles = [
      {
        category: 'comeback',
        title: '大势团体宣布下月携正规专辑回归',
        summary: '据所属社透露，新专辑将展现与以往完全不同的风格，引发粉丝热烈讨论。',
        source: 'StarNews',
        time: '1小时前',
        body: '<p>经纪公司今日通过官方SNS公开了回归预告照。黑白风格的画报暗示着这次将是一次概念性的蜕变。</p><p>据悉，主打曲由曾与多位国际艺人合作过的知名制作人操刀，编舞则由世界级编舞家负责。业内人士透露："这次回归的规模将会是前所未有的。"</p><p>预售将于下周一开始，粉丝们已经做好了抢购的准备。各大唱片预售网站预计将迎来一波访问高峰。</p>'
      },
      {
        category: 'scandal',
        title: '知名爱豆深夜约会？某粉丝目击爆料引发热议',
        summary: '有网友发帖称在某高级餐厅偶遇某当红爱豆与圈外人士单独用餐，疑似交往中。',
        source: 'Dispatch风格',
        time: '3小时前',
        body: '<p>昨晚，某匿名网友在SNS上发布了一张模糊的远景照片，称在某高级日料店偶遇当红爱豆与一位圈外人士共进晚餐。照片中两人对坐，气氛融洽。</p><p>该帖子迅速传播，引发了粉丝两极化的讨论。部分粉丝认为"爱豆也是人，有私生活很正常"，另一部分则表达了失望和担忧。</p><p>所属社目前尚未对此事作出回应。业内人士提醒："在没有确认的情况下不要过度猜测。"</p>'
      },
      {
        category: 'variety',
        title: '年末歌谣大赏阵容确定！超豪华出演名单',
        summary: '各大电视台年末颁奖礼阵容陆续公布，神仙打架场面即将上演。',
        source: '综艺日报',
        time: '5小时前',
        body: '<p>随着年末的临近，三大电视台的歌谣大赏筹备工作进入最后阶段。目前已公布的出演名单包括多组顶级团体和SOLO歌手。</p><p>SBS歌谣大赏将以"音乐的力量"为主题，MBC则主打"家族盛宴"概念。KBS方面表示将以全新的舞台设计为观众带来视觉盛宴。</p><p>投票通道将于下月开放，粉丝们可以为自己喜欢的艺人投票。各大粉丝站已经开始组织投票策略。</p>'
      },
      {
        category: 'general',
        title: '新人练习生选拔启动！多家公司开启全球海选',
        summary: '包括HYBE、SM、JYP在内的多家大型企划社宣布启动新一轮全球练习生选拔。',
        source: 'Kpop Insider',
        time: '昨天',
        body: '<p>据悉，此次选拔将覆盖韩国、日本、中国、美国等多个国家。选拔范围包括歌唱、舞蹈、说唱等多个领域。</p><p>业内人士表示，随着Kpop全球化进程加速，各公司对有国际背景的练习生需求不断增加。此次选拔的规模也是近年来最大的一次。</p><p>报名通道已通过各公司官网开放。最终合格者将有机会进入公司练习生系统，接受专业训练。</p>'
      },
      {
        category: 'comeback',
        title: '前卫概念预告公开！粉丝惊呼"破格变身"',
        summary: '新公开的预告照展现了完全颠覆的形象，引发粉丝和网友的热烈讨论。',
        source: 'SportsSeoul',
        time: '昨天',
        body: '<p>预告照中展现的暗黑风格与此前清新形象形成鲜明对比。发型、妆容、服装风格全部改变，让粉丝们又惊又喜。</p><p>音乐评论家表示："这种程度的形象转变需要很大的勇气。但也是偶像不断进化的表现。非常期待完整作品的呈现。"</p><p>预告视频将于今晚0点公开。粉丝们已经开始在线倒计时。</p>'
      },
      {
        category: 'scandal',
        title: '私生饭闯宿舍事件再起！经纪公司强硬表态',
        summary: '近日又发生私生饭跟踪爱豆私人行程事件，业界呼吁加强艺人隐私保护。',
        source: 'TenAsia',
        time: '2天前',
        body: '<p>据悉，某团体成员在下班回宿舍的路上遭到私生饭跟踪。保安人员及时发现并制止，但类似事件已不是第一次发生。</p><p>经纪公司发表强硬声明："我们将对侵犯艺人隐私的行为采取法律手段，绝不姑息。"同时也呼吁粉丝理性追星。</p><p>粉丝们也纷纷表示支持公司的决定，并发起了"尊重艺人隐私"的倡议活动。</p>'
      },
      {
        category: 'variety',
        title: '新综艺首播收视率破纪录！下期嘉宾引期待',
        summary: '由知名PD操刀的全新综艺节目首播即创下同时段收视冠军。',
        source: 'OSEN',
        time: '3天前',
        body: '<p>该节目以全新形式打破了传统综艺的模式，首期播出后好评如潮。制作组透露下期将邀请重磅嘉宾出演。</p><p>节目的创新点在于将音乐、游戏、访谈融为一体，既有娱乐性又有感动点。观众们纷纷表示"很久没有能看到不跳过的综艺了"。</p><p>第二期预计将于下周播出，嘉宾身份目前仍在保密中，引发各种猜测。</p>'
      },
      {
        category: 'general',
        title: '首尔时装周星光熠熠！爱豆们的前排穿搭',
        summary: '多位爱豆以品牌大使身份亮相首尔时装周，独特的时尚品味引发热议。',
        source: 'Vogue Korea',
        time: '3天前',
        body: '<p>本次首尔时装周吸引了众多品牌的参与。多组爱豆以品牌大使或邀请嘉宾身份出席，展示了各具特色的时尚风格。</p><p>从经典黑白到大胆撞色，爱豆们的前排穿搭成为了时尚媒体争相报道的焦点。某奢侈品牌负责人表示："Kpop偶像的时尚影响力已经不可忽视。"</p><p>相关话题在社交媒体上持续霸榜，粉丝们对自担的造型赞不绝口。</p>'
      }
    ];

    return articles;
  }

  // ===== 渲染 =====

  /**
   * 渲染新闻列表
   */
  function renderList(container) {
    _detailIndex = -1;

    // 更新标题
    const titleEl = document.getElementById('phone-app-title');
    if (titleEl) titleEl.textContent = '📰 新闻';

    const articles = getArticles();

    container.innerHTML = `
      <div class="news-list">
        ${articles.map((article, i) => `
          <button class="news-item" onclick="Game.PhoneNews.renderDetail(${i})">
            <div class="news-item-header">
              <span class="news-item-category ${article.category}">${getCategoryLabel(article.category)}</span>
              <span class="news-item-source">${article.source}</span>
            </div>
            <div class="news-item-title">${escapeHtml(article.title)}</div>
            <div class="news-item-summary">${escapeHtml(article.summary)}</div>
            <div class="news-item-time">🕐 ${article.time}</div>
          </button>
        `).join('')}
      </div>
    `;
  }

  /**
   * 渲染新闻详情
   */
  function renderDetail(index) {
    _detailIndex = index;

    const container = document.getElementById('phone-app-content');
    if (!container) return;

    const articles = getArticles();
    const article = articles[index];
    if (!article) return;

    const titleEl = document.getElementById('phone-app-title');
    if (titleEl) titleEl.textContent = '📰 新闻详情';

    container.innerHTML = `
      <div class="news-detail">
        <h1 class="news-detail-title">${escapeHtml(article.title)}</h1>
        <div class="news-detail-meta">
          <span class="news-item-category ${article.category}">${getCategoryLabel(article.category)}</span>
          <span>${article.source}</span>
          <span>🕐 ${article.time}</span>
        </div>
        <div class="news-detail-body">
          ${article.body}
        </div>
      </div>
    `;
  }

  // ===== 工具 =====

  function getCategoryLabel(cat) {
    const map = {
      comeback: '🎵 回归',
      scandal: '🔥 绯闻',
      variety: '📺 综艺',
      general: '📋 综合'
    };
    return map[cat] || '📋 综合';
  }

  // ===== 公开API =====

  return {
    renderList,
    renderDetail
  };

})();
