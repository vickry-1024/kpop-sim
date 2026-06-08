/**
 * 聊天APP模块 — 手机内的聊天应用
 * 负责：联系人列表、对话界面、快捷回复、消息历史（IndexedDB持久化）
 */

Game.PhoneChat = (() => {

  // 当前对话的爱豆索引
  let _currentIdolIndex = null;

  // DOM元素缓存（阶段12）
  var _contentEl = null;
  function _getContentEl() {
    if (!_contentEl) _contentEl = document.getElementById('phone-app-content');
    return _contentEl;
  }

  // 好友类型标签和图标
  var FRIEND_TYPE_LABELS = { bestie: '闺蜜', friend: '朋友' };

  // 好友主动消息概率（比爱豆高，朋友更爱聊天）
  var FRIEND_PROACTIVE_CHANCE = 35;

  // 好友快捷回复池（日常生活话题）
  var FRIEND_QUICK_REPLIES = [
    { id: 'f1', label: '😊 最近怎么样', text: '最近怎么样呀？好久没聊了，有什么新鲜事吗？' },
    { id: 'f2', label: '🍜 约饭吗', text: '最近发现一家超好吃的店！什么时候一起去？' },
    { id: 'f3', label: '😂 分享八卦', text: '你绝对想不到我今天听到了什么八卦！关于那个...' },
    { id: 'f4', label: '😤 吐槽一下', text: '今天遇到了一个超无语的事，必须跟你吐槽一下！' },
    { id: 'f5', label: '🛍️ 逛街', text: '周末有空吗？想去逛街，好久没买新衣服了～' },
    { id: 'f6', label: '🎬 聊追剧', text: '最近在追什么剧？我刚看完一部超好看的，安利给你！' },
    { id: 'f7', label: '💬 随便聊聊', text: '好无聊啊～你在干嘛呢？有没有好玩的分享分享' },
    { id: 'f8', label: '☕ 喝咖啡', text: '那家新开的咖啡店你去了吗？听说环境特别好' }
  ];

  // 好友预设回复池（日常对话风格）
  var FRIEND_REPLY_POOL = [
    '哈哈哈真的吗！展开说说，我最爱听八卦了',
    '救命我也遇到过这种事！当时真的气死了',
    '好啊好啊！这周末我应该有空，你来定时间～',
    '你最近是不是瘦了？上次见你就觉得你气色特别好',
    '我跟你讲我今天也...算了见面跟你说，太搞笑了',
    '那个地方我知道！上次和朋友去过，确实不错',
    '有道理诶，我怎么没想到。果然还是你聪明ㅋㅋㅋ',
    '好羡慕你！我最近好累，一堆事堆在一起..',
    '天哪我好想吃那个！最近减肥但已经忍了好久了ㅠㅠ',
    '真的假的！？那后来呢？别吊我胃口啊',
    '对对对！我看的时候也是这个感觉，导演太会拍了',
    '我今天刚买了新衣服，下次穿给你看！',
    '唉..我跟你说个事你别告诉别人..',
    '你也是我最信任的朋友了～有什么都可以跟我说',
    '哈哈你这形容太好笑了，我都能想象那个画面',
    '最近天气好好，都不想上班了。好想出去玩',
    '你猜我今天在街上看到谁了？不告诉你ㅋㅋ',
    '好啊，那家店我种草好久了！一直没找到人一起去',
    '其实我最近也在想这件事..感觉你总是说到我心坎里',
    '你说得对！我也应该像你一样积极一点'
  ];

  // ===== 联系人列表 =====

  function renderContactList(container, phoneType) {
    var idols = Game.state.idols || [];
    var friends = Game.state.friends || [];

    if (idols.length === 0 && friends.length === 0) {
      container.innerHTML = '<div class="chat-conv-empty"><span>📭</span><span>还没有联系人</span></div>';
      return;
    }

    var html = '<div class="chat-contacts">';

    // 好友区域
    if (friends.length > 0) {
      html += '<div class="chat-section-label">👥 好友</div>';
      friends.forEach(function(friend) {
        var typeLabel = FRIEND_TYPE_LABELS[friend.type] || '好友';
        html += '<button class="chat-contact-item chat-contact-friend" onclick="Game.PhoneChat.openFriendConversation(\'' + friend.id + '\')">' +
          '<div class="chat-contact-avatar friend-avatar">' +
            '<span class="chat-contact-avatar-placeholder">' + (friend.avatar || '👤') + '</span>' +
          '</div>' +
          '<div class="chat-contact-info">' +
            '<span class="chat-contact-name">' + escapeHtml(friend.name) + '</span>' +
            '<span class="chat-contact-type-badge friend-type-' + friend.type + '">' + typeLabel + '</span>' +
            '<span class="chat-contact-last-msg" id="chat-friend-last-msg-' + friend.id + '">' + (friend.desc || '随时可以找我聊天～') + '</span>' +
          '</div>' +
          '<span class="chat-contact-unread" id="chat-friend-unread-' + friend.id + '"></span>' +
          '<span class="chat-contact-time" id="chat-friend-time-' + friend.id + '"></span>' +
        '</button>';
      });
    }

    // 爱豆区域
    if (idols.length > 0) {
      html += '<div class="chat-section-label">💜 爱豆</div>';
      idols.forEach(function(idol, i) {
        // 检查经纪人是否已介入
        var intervention = (Game.State && Game.State.getManagerIntervention) ? Game.State.getManagerIntervention(i) : null;
        var managerRowHTML = '';
        if (intervention && intervention.triggered) {
          managerRowHTML = '<button class="chat-contact-item chat-contact-manager" onclick="Game.PhoneChat.openManagerConversation(' + i + ')">' +
            '<div class="chat-contact-avatar manager-avatar">' +
              '<span class="chat-contact-avatar-placeholder">📋</span>' +
            '</div>' +
            '<div class="chat-contact-info">' +
              '<span class="chat-contact-name">' + escapeHtml(intervention.managerName || '经纪人') + '</span>' +
              '<span class="chat-contact-type-badge manager-type-' + (intervention.action || 'warn') + '">经纪人</span>' +
              '<span class="chat-contact-last-msg" id="chat-manager-last-msg-' + i + '">' + (intervention.lastMessage || '有新消息') + '</span>' +
            '</div>' +
            '<span class="chat-contact-unread" id="chat-manager-unread-' + i + '"></span>' +
          '</button>';
        }
        html += '<button class="chat-contact-item" onclick="Game.PhoneChat.openConversation(' + i + ', \'' + phoneType + '\')">' +
          '<div class="chat-contact-avatar" id="chat-avatar-' + i + '">' +
            '<span class="chat-contact-avatar-placeholder">💜</span>' +
          '</div>' +
          '<div class="chat-contact-info">' +
            '<span class="chat-contact-name">' + escapeHtml(idol.nickname || idol.name) + '</span>' +
            '<span class="chat-contact-last-msg" id="chat-last-msg-' + i + '">' +
              (idol.stats.affection >= 60 ? '💜 关系亲密' : idol.stats.affection >= 30 ? '正在变熟...' : '新认识的爱豆') +
            '</span>' +
          '</div>' +
          '<span class="chat-contact-unread" id="chat-unread-' + i + '"></span>' +
          '<span class="chat-contact-time" id="chat-time-' + i + '"></span>' +
        '</button>' +
        managerRowHTML;
      });
    }

    html += '</div>';
    container.innerHTML = html;

    // 异步加载头像和最近消息
    loadContactDetails(container, phoneType);
  }

  function renderSecretContact(container, idolIndex) {
    if (idolIndex === null || idolIndex === undefined) {
      container.innerHTML = '<div class="chat-conv-empty"><span>🔐</span><span>秘密手机尚未绑定联系人</span></div>';
      return;
    }

    const idol = Game.state.idols[idolIndex];
    if (!idol) {
      container.innerHTML = '<div class="chat-conv-empty"><span>🔐</span><span>联系人数据异常</span></div>';
      return;
    }

    container.innerHTML = `
      <div class="chat-contacts">
        <button class="chat-contact-item" onclick="Game.PhoneChat.openConversation(${idolIndex}, 'secret')">
          <div class="chat-contact-avatar" id="chat-avatar-${idolIndex}">
            <span class="chat-contact-avatar-placeholder">🔒</span>
          </div>
          <div class="chat-contact-info">
            <span class="chat-contact-name">${escapeHtml(idol.nickname || idol.name)}</span>
            <span class="chat-contact-last-msg" id="chat-last-msg-${idolIndex}">
              ${idol.stats.affection >= 60 ? '💜 加密通讯中' : '🔐 秘密联系人'}
            </span>
          </div>
          <span class="chat-contact-badge" style="background:var(--secret-accent);">秘密</span>
        </button>
      </div>
    `;

    // 异步加载头像和最近消息
    loadContactDetails(container, 'secret');
  }

  /**
   * 异步加载联系人头像和最后消息
   */
  async function loadContactDetails(container, phoneType) {
    const idols = Game.state.idols || [];
    for (let i = 0; i < idols.length; i++) {
      // 加载头像
      try {
        const url = await Game.Storage.getPhotoURL(idols[i].avatarId);
        if (url) {
          const avatarEl = document.getElementById('chat-avatar-' + i);
          if (avatarEl) {
            avatarEl.innerHTML = `<img src="${url}" alt="${escapeHtml(idols[i].name)}">`;
          }
        }
      } catch (e) { /* 无头像使用占位 */ }

      // 加载最近消息
      try {
        const history = await loadHistory(i, phoneType);
        if (history && history.length > 0) {
          const lastMsg = history[history.length - 1];
          const msgEl = document.getElementById('chat-last-msg-' + i);
          const timeEl = document.getElementById('chat-time-' + i);
          if (msgEl) {
            msgEl.textContent = (lastMsg.from === 'me' ? '你：' : '') + lastMsg.text;
          }
          if (timeEl && lastMsg.time) {
            timeEl.textContent = formatTime(lastMsg.time);
          }
        }
      } catch (e) { /* 无历史 */ }

      // 加载未读消息数
      var unreadCount = getUnreadCount(i, phoneType);
      var unreadEl = document.getElementById('chat-unread-' + i);
      if (unreadEl) {
        if (unreadCount > 0) {
          unreadEl.textContent = unreadCount > 99 ? '99+' : unreadCount;
          unreadEl.classList.add('has-unread');
        } else {
          unreadEl.classList.remove('has-unread');
        }
      }
    }

    // 加载好友最近消息
    var friends = Game.state.friends || [];
    for (var fi = 0; fi < friends.length; fi++) {
      try {
        var fHistory = await loadFriendHistory(friends[fi].id);
        if (fHistory && fHistory.length > 0) {
          var fLastMsg = fHistory[fHistory.length - 1];
          var fMsgEl = document.getElementById('chat-friend-last-msg-' + friends[fi].id);
          var fTimeEl = document.getElementById('chat-friend-time-' + friends[fi].id);
          if (fMsgEl) fMsgEl.textContent = (fLastMsg.from === 'me' ? '你：' : '') + fLastMsg.text;
          if (fTimeEl && fLastMsg.time) fTimeEl.textContent = formatTime(fLastMsg.time);
        }
      } catch (e) { /* 无好友历史 */ }

      // 好友未读消息数
      var fUnread = getFriendUnreadCount(friends[fi].id);
      var fUnreadEl = document.getElementById('chat-friend-unread-' + friends[fi].id);
      if (fUnreadEl) {
        if (fUnread > 0) {
          fUnreadEl.textContent = fUnread > 99 ? '99+' : fUnread;
          fUnreadEl.classList.add('has-unread');
        } else {
          fUnreadEl.classList.remove('has-unread');
        }
      }
    }

    // 加载经纪人最近消息
    for (var mi = 0; mi < idols.length; mi++) {
      try {
        var mHistory = await loadManagerHistory(mi);
        if (mHistory && mHistory.length > 0) {
          var mLastMsg = mHistory[mHistory.length - 1];
          var mMsgEl = document.getElementById('chat-manager-last-msg-' + mi);
          if (mMsgEl) mMsgEl.textContent = mLastMsg.text;
        }
      } catch (e) { /* 无经纪人历史 */ }

      // 经纪人未读消息数
      var mUnread = getManagerUnreadCount(mi);
      var mUnreadEl = document.getElementById('chat-manager-unread-' + mi);
      if (mUnreadEl) {
        if (mUnread > 0) {
          mUnreadEl.textContent = mUnread > 99 ? '99+' : mUnread;
          mUnreadEl.classList.add('has-unread');
        } else {
          mUnreadEl.classList.remove('has-unread');
        }
      }
    }
  }

  // ===== 对话界面 =====

  /**
   * 从对话界面返回联系人列表（而非手机主屏幕）
   * @param {string} phoneType - 'main' | 'secret'
   */
  function backToContactList(phoneType) {
    _currentIdolIndex = null;

    var container = _getContentEl();
    if (!container) return;

    // 恢复标题
    var titleEl = document.getElementById('phone-app-title');
    if (titleEl) {
      titleEl.textContent = '💬 ' + (phoneType === 'secret' ? '私密聊天' : '聊天');
    }

    // 恢复返回按钮为关闭APP
    var backBtn = document.querySelector('.phone-app-back');
    if (backBtn) {
      backBtn.onclick = function() { Game.Phone.closeApp(); };
    }

    // 重新渲染联系人列表
    if (phoneType === 'secret') {
      var idolIndex = Game.Phone.getSecretPhoneIdolIndex ? Game.Phone.getSecretPhoneIdolIndex() : null;
      renderSecretContact(container, idolIndex);
    } else {
      renderContactList(container, phoneType);
    }
  }

  /**
   * 打开与爱豆的对话
   * @param {number} idolIndex
   * @param {string} phoneType
   */
  function openConversation(idolIndex, phoneType) {
    _currentIdolIndex = idolIndex;

    const idol = Game.state.idols[idolIndex];
    if (!idol) return;

    const container = _getContentEl();
    if (!container) return;

    const idolName = idol.nickname || idol.name;

    // 清除该联系人的未读消息
    clearUnread(idolIndex, phoneType);

    // 打开对话也视为"已关注"，清除待回复标记
    if (Game.State.clearPendingReply) {
      Game.State.clearPendingReply(idolIndex);
    }

    // 更新标题
    const titleEl = document.getElementById('phone-app-title');
    if (titleEl) titleEl.textContent = '💬 ' + idolName;

    // 更新返回按钮：回到联系人列表而非手机主屏幕
    var backBtn = document.querySelector('.phone-app-back');
    if (backBtn) {
      backBtn.onclick = function() { Game.PhoneChat.backToContactList(phoneType); };
    }

    // 渲染对话界面
    container.innerHTML = `
      <div class="chat-conversation">
        <div class="chat-conv-messages" id="chat-conv-messages">
          <div class="chat-conv-empty">
            <span>💬</span>
            <span>加载消息中...</span>
          </div>
        </div>
        <div class="chat-conv-input-area">
          <div class="chat-quick-replies" id="chat-quick-replies">
            <!-- 动态填充快捷回复 -->
          </div>
          <div class="chat-custom-input-row">
            <textarea class="chat-custom-input" id="chat-custom-input"
                      placeholder="输入消息..." rows="1"
                      onkeydown="Game.PhoneChat.handleInputKey(event, ${idolIndex}, '${phoneType}')"></textarea>
            <button class="chat-send-btn" onclick="Game.PhoneChat.sendCustomMessage(${idolIndex}, '${phoneType}')">
              ↑
            </button>
          </div>
        </div>
      </div>
    `;

    // 加载消息历史和快捷回复
    loadConversationData(idolIndex, phoneType);
  }

  /**
   * 加载对话数据（历史 + 快捷回复）
   */
  async function loadConversationData(idolIndex, phoneType) {
    const idol = Game.state.idols[idolIndex];
    if (!idol) return;

    const messagesEl = document.getElementById('chat-conv-messages');
    const quickRepliesEl = document.getElementById('chat-quick-replies');

    // 加载历史消息
    let history = [];
    try {
      history = await loadHistory(idolIndex, phoneType);
    } catch (e) { /* 无历史 */ }

    if (history.length === 0) {
      // 首次对话：显示预设开场白
      const greeting = getGreeting(idol, idolIndex);
      history = [
        { from: 'idol', text: greeting, time: Date.now() }
      ];
      // 保存开场白到历史
      await saveHistory(idolIndex, phoneType, history);
    }

    // 渲染消息气泡
    if (messagesEl) {
      messagesEl.innerHTML = history.map(msg => `
        <div class="chat-bubble ${msg.from === 'idol' ? 'chat-bubble-idol' : 'chat-bubble-me'}">
          <span class="chat-bubble-text">${escapeHtml(msg.text)}</span>
          <span class="chat-bubble-time">${formatTime(msg.time)}</span>
        </div>
      `).join('');
      // 滚动到底部
      setTimeout(() => { messagesEl.scrollTop = messagesEl.scrollHeight; }, 100);
    }

    // 渲染快捷回复
    if (quickRepliesEl) {
      const replies = getQuickReplies(idolIndex);
      quickRepliesEl.innerHTML = replies.map(r => `
        <button class="chat-quick-reply" onclick="Game.PhoneChat.sendQuickReply(${idolIndex}, '${r.id}', '${phoneType}')">
          ${r.label}
        </button>
      `).join('');
    }
  }

  // ===== 发送消息 =====

  /**
   * 发送快捷回复
   * @param {number} idolIndex
   * @param {string} replyId
   * @param {string} phoneType
   */
  async function sendQuickReply(idolIndex, replyId, phoneType) {
    const idol = Game.state.idols[idolIndex];
    if (!idol) return;

    const replies = getQuickReplies(idolIndex);
    const reply = replies.find(r => r.id === replyId);
    if (!reply) return;

    // 添加玩家消息
    await addMessage(idolIndex, phoneType, 'me', reply.text);

    // 清除待回复标记
    if (Game.State.clearPendingReply) {
      Game.State.clearPendingReply(idolIndex);
    }

    // 清空快捷回复（防重复点击）
    const quickEl = document.getElementById('chat-quick-replies');
    if (quickEl) quickEl.innerHTML = '<span style="font-size:11px;color:var(--text-hint);padding:8px;">对方正在输入...</span>';

    // 模拟延迟后爱豆回复
    setTimeout(async () => {
      const response = await generateIdolReply(idol, reply);
      await addMessage(idolIndex, phoneType, 'idol', response);

      // 刷新快捷回复
      const quickEl2 = document.getElementById('chat-quick-replies');
      if (quickEl2) {
        const newReplies = getQuickReplies(idolIndex);
        quickEl2.innerHTML = newReplies.map(r => `
          <button class="chat-quick-reply" onclick="Game.PhoneChat.sendQuickReply(${idolIndex}, '${r.id}', '${phoneType}')">
            ${r.label}
          </button>
        `).join('');
      }

      // 更新联系人列表的最近消息（如果可见）
      const lastMsgEl = document.getElementById('chat-last-msg-' + idolIndex);
      if (lastMsgEl) lastMsgEl.textContent = response;

      // 根据手机类型处理数值影响
      applyChatEffects(phoneType);
    }, 800 + Math.random() * 1200);
  }

  /**
   * 发送自定义消息
   */
  async function sendCustomMessage(idolIndex, phoneType) {
    const input = document.getElementById('chat-custom-input');
    if (!input) return;

    const text = input.value.trim();
    if (!text) return;

    // 添加玩家消息
    await addMessage(idolIndex, phoneType, 'me', text);
    input.value = '';

    // 清除待回复标记
    if (Game.State.clearPendingReply) {
      Game.State.clearPendingReply(idolIndex);
    }

    // 清空快捷回复
    const quickEl = document.getElementById('chat-quick-replies');
    if (quickEl) quickEl.innerHTML = '<span style="font-size:11px;color:var(--text-hint);padding:8px;">对方正在输入...</span>';

    // 模拟爱豆回复（后续接入API后替换）
    setTimeout(async () => {
      const idol = Game.state.idols[idolIndex];
      const response = await generateIdolReply(idol, { id: 'custom', text: text, effectMods: {} });
      await addMessage(idolIndex, phoneType, 'idol', response);

      // 刷新快捷回复
      const quickEl2 = document.getElementById('chat-quick-replies');
      if (quickEl2) {
        const newReplies = getQuickReplies(idolIndex);
        quickEl2.innerHTML = newReplies.map(r => `
          <button class="chat-quick-reply" onclick="Game.PhoneChat.sendQuickReply(${idolIndex}, '${r.id}', '${phoneType}')">
            ${r.label}
          </button>
        `).join('');
      }

      applyChatEffects(phoneType);
    }, 800 + Math.random() * 1200);
  }

  /**
   * 处理输入框键盘事件（Enter发送）
   */
  function handleInputKey(event, idolIndex, phoneType) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendCustomMessage(idolIndex, phoneType);
    }
  }

  /**
   * 添加一条消息到对话（显示 + 存储）
   */
  async function addMessage(idolIndex, phoneType, from, text) {
    // 添加到气泡区
    const messagesEl = document.getElementById('chat-conv-messages');
    if (messagesEl) {
      // 移除空状态
      const empty = messagesEl.querySelector('.chat-conv-empty');
      if (empty) empty.remove();

      const bubble = document.createElement('div');
      bubble.className = 'chat-bubble ' + (from === 'idol' ? 'chat-bubble-idol' : 'chat-bubble-me');
      bubble.innerHTML = `
        <span class="chat-bubble-text">${escapeHtml(text)}</span>
        <span class="chat-bubble-time">${formatTime(Date.now())}</span>
      `;
      messagesEl.appendChild(bubble);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    // 保存到 IndexedDB
    try {
      const history = await loadHistory(idolIndex, phoneType);
      history.push({ from, text, time: Date.now() });
      await saveHistory(idolIndex, phoneType, history);
    } catch (e) {
      console.warn('[PhoneChat] 消息保存失败', e);
    }
  }

  // ===== 快捷回复系统 =====

  /**
   * 根据好感度阶段获取快捷回复选项
   */
  function getQuickReplies(idolIndex) {
    const idol = Game.state.idols[idolIndex];
    if (!idol) return [];
    const aff = idol.stats.affection || 0;
    const stage = idol.relationshipStage || 'pursuit';
    const isPartner = (Game.state.datingIdolId === idolIndex) || (Game.state.marriedIdolId === idolIndex);

    // 使用idolIndex + 当前日期作为随机种子，让每次打开的选项有所变化
    const today = new Date().toDateString();
    const seed = today + '-' + idolIndex;

    if (aff >= 60) {
      // 高好感度 — 亲密对话
      var all = [
        { id: 'h1', label: '💜 想你了', text: '今天特别想你🥺 在干嘛呢？有没有想我？' },
        { id: 'h2', label: '😴 睡了吗', text: '这么晚了还没睡～是不是又在偷偷想我？ㅋㅋ' },
        { id: 'h3', label: '🍜 一起吃饭', text: '最近发现一家超好吃的店！什么时候我们偷偷去？就我们两个～' },
        { id: 'h4', label: '💬 今天的事', text: '今天发生了什么有趣的事吗？好想听你分享～' },
        { id: 'h5', label: '🫂 求安慰', text: '今天心情不太好..想听你哄哄我ㅠㅠ' },
        { id: 'h6', label: '😂 分享笑话', text: '今天看到一个超好笑的视频第一个想到的就是给你看！' },
        { id: 'h7', label: '🌟 夸夸你', text: '今天看到你的新舞台了，你怎么又进步了！太耀眼了✨' },
        { id: 'h8', label: '📱 随手分享', text: '刚路过一家店看到你喜欢的牌子的衣服，第一反应就是想到你～' }
      ];
      // 关系阶段专属回复：恋爱中或已婚的亲密内容
      if (isPartner && stage === 'married') {
        all.push(
          { id: 'mrd1', label: '🏠 回家', text: '老公～今天什么时候回家？我做了你爱吃的菜等你哦' },
          { id: 'mrd2', label: '💑 未来计划', text: '我们明年要不要一起去旅行？就我们两个人，远离所有镜头' },
          { id: 'mrd3', label: '🛏️ 早安', text: '早上醒来第一眼看到你....这种感觉真好。今天也要加油哦' }
        );
      } else if (isPartner && stage === 'dating') {
        all.push(
          { id: 'dt1', label: '💕 约会', text: '这个周末真的不能见面吗？我都快一周没看到你了ㅠㅠ' },
          { id: 'dt2', label: '🤫 偷偷见面', text: '我们去老地方见面吧～我让经纪人帮我瞒过去了嘿嘿' },
          { id: 'dt3', label: '💌 甜蜜消息', text: '刚看到一个情侣对戒...虽然知道你现在不能戴但还是想买给你' }
        );
      }
      return shuffleQuickReplies(all, seed).slice(0, 4);
    } else if (aff >= 30) {
      // 中好感度 — 朋友对话（8个候选，随机展示4个）
      const all = [
        { id: 'm1', label: '😊 今天怎么样', text: '今天过得怎么样呀？练习还顺利吗？' },
        { id: 'm2', label: '🍕 吃了什么', text: '今天吃了什么好吃的？我刚刚吃了一碗超好吃的拉面！' },
        { id: 'm3', label: '🎵 推荐歌曲', text: '最近在循环什么歌？我歌单快听腻了，求推荐～' },
        { id: 'm4', label: '💤 累不累', text: '最近行程是不是很满呀？看你眼底下都有黑眼圈了，多休息！' },
        { id: 'm5', label: '🌧️ 聊天气', text: '今天外面下雨了，这种天气就适合窝着看剧..你有在看什么剧吗？' },
        { id: 'm6', label: '🎮 聊爱好', text: '没事的时候你喜欢做什么呀？我最近迷上了一个新游戏哈哈哈' },
        { id: 'm7', label: '🤣 成员趣事', text: '今天你们团有什么好玩的事吗？成员们又闹什么笑话了？' },
        { id: 'm8', label: '🌸 分享小事', text: '刚才路上看到一只超可爱的猫，心情莫名其妙变好了～分享给你！' }
      ];
      return shuffleQuickReplies(all, seed).slice(0, 4);
    } else {
      // 低好感度 — 礼貌对话（8个候选，随机展示4个）
      const all = [
        { id: 'l1', label: '👋 打招呼', text: '你好呀！最近经常在舞台上看到你，真的很耀眼～' },
        { id: 'l2', label: '📣 加油打气', text: '今天的舞台超棒的！看到你在台上发光的样子好感动' },
        { id: 'l3', label: '🌸 温暖问候', text: '今天天气真好～希望你心情也像天气一样明媚' },
        { id: 'l4', label: '❓ 好奇问问', text: '方便问一下最近有什么新歌计划吗？好期待你们的新作品' },
        { id: 'l5', label: '🎤 夸舞台', text: '昨天那场直拍我看了好几遍！你的每一个动作都好有魅力' },
        { id: 'l6', label: '💪 辛苦了', text: '听说明天又要有打歌舞台，真的辛苦了！注意身体别太累' },
        { id: 'l7', label: '☕ 日常聊聊', text: '今天喝了一杯超好喝的咖啡，突然就想给你发消息了哈哈' },
        { id: 'l8', label: '🌟 表达喜欢', text: '刚开始关注你们不久，但越了解越觉得你是个特别真诚的人' }
      ];
      return shuffleQuickReplies(all, seed).slice(0, 4);
    }
  }

  /**
   * 基于种子的伪随机洗牌（让同一轮对话的选项一致，不同天不同）
   */
  function shuffleQuickReplies(arr, seed) {
    const copy = [...arr];
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(i);
      hash |= 0;
    }
    for (let i = copy.length - 1; i > 0; i--) {
      hash = (hash * 1103515245 + 12345) & 0x7fffffff;
      const j = hash % (i + 1);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  /**
   * 获取首次对话的开场白
   */
  function getGreeting(idol, idolIndex) {
    const aff = idol.stats.affection || 0;
    const honorific = Game.Actions.getHonorific(idol.gender);
    const stage = idol.relationshipStage || 'pursuit';
    // 使用索引直接比对，避免 indexOf 引用相等的问题
    const isPartner = (Game.state.datingIdolId === idolIndex) || (Game.state.marriedIdolId === idolIndex);

    // 关系阶段专属开场白：已婚
    if (stage === 'married' && isPartner) {
      // 根据爱豆性别选择合适称呼
      var spouseTerm = idol.gender === 'female' ? '老婆' : '老公';
      var greetings = [
        spouseTerm + '～回来啦！今天想吃什么？我让阿姨准备了～💍',
        '亲爱的！我今天看了一个超好看的剧，晚上我们一起看吧？',
        honorific + '～今天工作累不累？来抱抱🫂',
        '你终于回来啦！我今天一个人在家好无聊哦～想你了'
      ];
      return greetings[Math.floor(Math.random() * greetings.length)];
    }

    // 关系阶段专属开场白：恋爱中
    if (stage === 'dating' && isPartner) {
      var greetings = [
        honorific + '！💕 你终于来了～我等了好久！',
        '啊你来了！我刚刚还在想你呢就有消息了～好神奇',
        honorific + '～今天有没有想我？反正我是想你了嘿嘿',
        '亲爱的！你猜我今天遇到什么好玩的事了？迫不及待想告诉你～'
      ];
      return greetings[Math.floor(Math.random() * greetings.length)];
    }

    if (aff >= 80) {
      const greetings = [
        honorific + '！！💜 你终于来了～我今天一直在等你给我发消息！',
        '啊' + honorific + '～我刚想给你发消息你就来了！我们是不是有心电感应ㅋㅋㅋ',
        honorific + '～今天怎么这么晚才找我！我都想你了🥺',
        '看到你的消息提醒我就秒点了进来💜 今天过得开心吗？'
      ];
      return greetings[Math.floor(Math.random() * greetings.length)];
    } else if (aff >= 60) {
      const greetings = [
        honorific + '！💜 刚想给你发消息你就来了！今天练习好累但是看到你消息瞬间有精神了',
        '嘿嘿你来找我啦～今天过得怎么样？我正好在休息！',
        honorific + '～我刚刚还在想你你就出现了ㅋㅋㅋ好奇妙',
        '你来了！！今天有什么好玩的事要分享吗？我这边无聊死了～'
      ];
      return greetings[Math.floor(Math.random() * greetings.length)];
    } else if (aff >= 30) {
      const greetings = [
        '啊，是你呀～最近经常看到你呢！有什么事吗？',
        '哦！你好～刚练习完就看到你的消息了',
        '嗨～今天怎么想起找我啦？',
        '你好呀！我正在休息刚好看到你的消息～'
      ];
      return greetings[Math.floor(Math.random() * greetings.length)];
    } else {
      const greetings = [
        '嗯？你好..（有点困惑）不过谢谢你支持我～',
        '啊你好！虽然还不太熟但是谢谢你喜欢我们的舞台～',
        '哦！是新认识的朋友吗？你好你好～',
        '谢谢你的消息！虽然还不太认识你但是感觉很友善呢～'
      ];
      return greetings[Math.floor(Math.random() * greetings.length)];
    }
  }

  // ===== 性格风格系统 =====

  /**
   * 检测爱豆的性格风格类型
   * @param {Object} idol
   * @returns {string} 风格类型：'cold'|'sunny'|'tsundere'|'gentle'|'quirky'|'bossy'|'gapmoe'|'cute'|'neutral'
   */
  function detectPersonalityStyle(idol) {
    var text = ((idol.personalityTags || []).join(' ') + ' ' + (idol.personalityCustom || '')).toLowerCase();

    // 按优先级匹配（先匹配更具体的）
    if (text.indexOf('反差萌') >= 0 || text.indexOf('反差') >= 0) return 'gapmoe';
    if (text.indexOf('傲娇') >= 0) return 'tsundere';
    if (text.indexOf('四次元') >= 0 || text.indexOf('神秘') >= 0) return 'quirky';
    if (text.indexOf('高冷') >= 0 || text.indexOf('冷都') >= 0) return 'cold';
    if (text.indexOf('霸气') >= 0 || text.indexOf('强势') >= 0 || text.indexOf('女王') >= 0 || text.indexOf('霸总') >= 0) return 'bossy';
    if (text.indexOf('阳光') >= 0 || text.indexOf('元气') >= 0 || text.indexOf('开朗') >= 0 || text.indexOf('活泼') >= 0 || text.indexOf('搞笑') >= 0) return 'sunny';
    if (text.indexOf('温柔') >= 0 || text.indexOf('软') >= 0 || text.indexOf('暖') >= 0 || text.indexOf('治愈') >= 0) return 'gentle';
    if (text.indexOf('可爱') >= 0 || text.indexOf('萌') >= 0 || text.indexOf('甜') >= 0 || text.indexOf('忙内') >= 0) return 'cute';

    return 'neutral';
  }

  /**
   * 根据性格风格修饰回复文本
   * @param {string} text - 原始回复
   * @param {string} style - 性格风格类型
   * @param {number} affection - 好感度（影响风格强度）
   * @returns {string} 风格化后的回复
   */
  function applyPersonalityStyle(text, style, affection) {
    if (!text || style === 'neutral') return text;

    var aff = affection || 0;
    // 好感度越高，性格特征越明显（越放得开）
    var intensity = aff >= 60 ? 1.0 : aff >= 30 ? 0.7 : 0.4;

    switch (style) {
      case 'cold':
        return applyColdStyle(text, intensity);
      case 'sunny':
        return applySunnyStyle(text, intensity);
      case 'tsundere':
        return applyTsundereStyle(text, intensity);
      case 'gentle':
        return applyGentleStyle(text, intensity);
      case 'quirky':
        return applyQuirkyStyle(text, intensity);
      case 'bossy':
        return applyBossyStyle(text, intensity);
      case 'gapmoe':
        return applyGapMoeStyle(text, intensity);
      case 'cute':
        return applyCuteStyle(text, intensity);
      default:
        return text;
    }
  }

  // ---- 各风格修饰函数 ----

  function applyColdStyle(text, intensity) {
    // 高冷：话少、简洁、偶尔反差暖
    // intensity < 0.6: 保持原样偏冷；>= 0.6: 偶尔加温暖后缀
    var t = text;
    // 去掉过多的感叹号和emoji（高冷不爱用）
    if (intensity < 0.8) {
      t = t.replace(/！！+/g, '。');
      t = t.replace(/！/g, '。');
      t = t.replace(/[😊💜✨🥺💕🌟]/g, '');
      t = t.replace(/ㅋㅋㅋ+/g, '');
    }
    // 话少：如果文本过长，取前1-2句
    if (intensity < 0.7 && t.length > 30) {
      var sentences = t.split(/[。！？]/);
      if (sentences.length > 2) {
        t = sentences.slice(0, 2).join('。') + '。';
      }
    }
    // 好感度高时偶尔反差暖
    if (intensity >= 0.8 && Math.random() < 0.35) {
      var warmSuffixes = [' ..也不是不可以。', ' ..嗯。', ' （其实我也这么想）', ' 你..算了。', ''];
      t = t.replace(/。$/, '') + warmSuffixes[Math.floor(Math.random() * warmSuffixes.length)];
    }
    return t;
  }

  function applySunnyStyle(text, intensity) {
    // 阳光：话多、感叹号、emoji、积极
    var t = text;
    // 加感叹号
    if (intensity >= 0.6 && !t.match(/[！!]$/)) {
      t = t.replace(/[。.]$/, '！');
      if (!t.match(/[！!]$/)) t += '！';
    }
    // 加emoji
    if (intensity >= 0.7 && Math.random() < 0.5 && !t.match(/[💪✨🌟😆🎉]/)) {
      var emojis = [' ✨', ' 💪', ' 🌟', ' 😆', ' 🎉', ''];
      t += emojis[Math.floor(Math.random() * emojis.length)];
    }
    // 加语气词
    if (intensity >= 0.8 && Math.random() < 0.4 && t.indexOf('Fighting') < 0 && t.indexOf('加油') < 0) {
      var extras = [' 超开心的！！', ' 今天也是元气满满的一天！', ' 哈哈是吧是吧！', ' 对吧对吧！'];
      if (t.length < 40) t += extras[Math.floor(Math.random() * extras.length)];
    }
    return t;
  }

  function applyTsundereStyle(text, intensity) {
    // 傲娇：嘴硬心软
    var t = text;
    if (intensity >= 0.6 && Math.random() < 0.45) {
      var prefixes = ['哼，', '才不是呢..', '笨蛋，', '又不是特意等你的..', '随、随便啦。', ''];
      var prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
      if (prefix && t.indexOf(prefix) !== 0) t = prefix + t;
    }
    // 偶尔暴露真心
    if (intensity >= 0.8 && Math.random() < 0.3) {
      var honestSuffixes = [' ..其实有点想你。', ' 但、但是你在的话也挺好的。', ' 我只是顺便关心一下而已！', ''];
      t += honestSuffixes[Math.floor(Math.random() * honestSuffixes.length)];
    }
    return t;
  }

  function applyGentleStyle(text, intensity) {
    // 温柔：软语、波浪号、关心
    var t = text;
    // 加波浪号
    if (intensity >= 0.5 && !t.match(/～$/)) {
      t = t.replace(/[。.]$/, '～');
    }
    // 关心后缀
    if (intensity >= 0.7 && Math.random() < 0.4) {
      var careSuffixes = [' 你也要照顾好自己哦～', ' 别太累了呀～', ' 有什么事都可以跟我说哦', ' 我会一直在这里的～'];
      if (t.length < 50) t += careSuffixes[Math.floor(Math.random() * careSuffixes.length)];
    }
    // 软语替换
    if (intensity >= 0.6) {
      t = t.replace(/知道/g, '知道呀');
      t = t.replace(/好的/g, '好的呢');
    }
    return t;
  }

  function applyQuirkyStyle(text, intensity) {
    // 四次元：跳脱、意想不到、有趣
    var t = text;
    if (intensity >= 0.5 && Math.random() < 0.35) {
      var quirkyAddons = [
        ' 对了你相信平行宇宙吗？',
        ' 说起来我今天看到一只鸽子在跳舞..',
        ' 你觉不觉得云长得像一只炸鸡？',
        ' 我突然想到一个超好笑的冷笑话..算了还是不说了ㅋㅋ',
        ' 话说回来，你觉得外星人存在吗？',
        ' 🤔 不过这个让我想到了之前的一个梦..'
      ];
      if (t.length < 50) t += quirkyAddons[Math.floor(Math.random() * quirkyAddons.length)];
    }
    return t;
  }

  function applyBossyStyle(text, intensity) {
    // 霸气：直接、有主见、干脆
    var t = text;
    if (intensity >= 0.6) {
      // 去掉犹豫的语气词
      t = t.replace(/[～~]+/g, '');
      t = t.replace(/[。.]$/, '。');
      // 加决断力
      if (Math.random() < 0.3 && t.indexOf('听我的') < 0 && t.indexOf('我来') < 0) {
        t = t.replace(/^/, '听我说，');
      }
    }
    return t;
  }

  function applyGapMoeStyle(text, intensity) {
    // 反差萌：前冷后暖/前酷后可爱
    var t = text;
    if (intensity >= 0.6 && Math.random() < 0.4) {
      // 把文本分成两半，前半保持原样，后半加可爱元素
      var mid = Math.floor(t.length / 2);
      var firstHalf = t.substring(0, mid);
      var secondHalf = t.substring(mid);
      // 后半变可爱
      if (!secondHalf.match(/[～♥💕]/)) {
        secondHalf = secondHalf.replace(/[。.]$/, '..其实也不是不行啦～♥');
      }
      t = firstHalf + secondHalf;
    }
    return t;
  }

  function applyCuteStyle(text, intensity) {
    // 可爱：撒娇、语气词、颜文字
    var t = text;
    // 加撒娇语气
    if (intensity >= 0.6) {
      t = t.replace(/了/g, '了啦');
      t = t.replace(/吗/g, '嘛');
      t = t.replace(/呢/g, '呢～');
    }
    // 加ㅠㅠ
    if (intensity >= 0.7 && Math.random() < 0.4 && t.indexOf('ㅠ') < 0) {
      t += ' ㅠㅠ';
    }
    // 撒娇后缀
    if (intensity >= 0.8 && Math.random() < 0.35) {
      var cuteSuffixes = [' 好嘛好嘛～', ' 人家不是故意的啦', ' 嘿嘿最喜欢你了～', ' 啾咪♥'];
      if (t.length < 50) t += cuteSuffixes[Math.floor(Math.random() * cuteSuffixes.length)];
    }
    return t;
  }

  /**
   * 根据玩家回复生成爱豆回复（优先AI，降级预设）
   * @param {Object} idol - 爱豆对象
   * @param {Object} playerReply - 玩家回复 {id, text, effectMods}
   * @returns {Promise<string>} 爱豆回复文本
   */
  async function generateIdolReply(idol, playerReply) {
    const text = playerReply.text || '';

    // 尝试使用AI生成回复
    if (Game.API && Game.API.hasAnyKey()) {
      try {
        // 获取对话历史
        const idolIndex = Game.state.idols.indexOf(idol);
        const phoneType = (Game.state.player.secretPhone
          && Game.state.player.secretPhone.idolIndex === idolIndex)
          ? 'secret' : 'main';
        const key = 'chat-' + phoneType + '-' + idolIndex;
        const history = await Game.Storage.loadChatHistory(key) || [];

        const aiReply = await Game.API.generateChatReply(idol, text, history);
        if (aiReply && aiReply.trim()) {
          return aiReply.trim();
        }
      } catch (e) {
        Game.DEBUG && console.log('[PhoneChat] AI回复失败，使用预设:', e.message);
      }
    }

    // 降级：预设回复逻辑（每个好感度层级20条，大幅增加多样性）
    // 性格风格会在选出回复后进行修饰
    const aff = idol.stats.affection || 0;
    const honorific = Game.Actions.getHonorific(idol.gender);
    var replyText = '';

    if (aff >= 60) {
      const replies = [
        // 甜蜜类
        '我也想见你！这周末我应该有空～你定地方？',
        '你每次都这么会说话...（脸红）不过我很喜欢💜',
        '好啊好啊！就我们两个人吧，不想被别人打扰',
        '嗯嗯，有你在我就放心了。你也要好好照顾自己哦',
        '看到你的消息就是我今天最开心的时刻了！',
        '你什么时候来找我呀～我快想死你了ㅠㅠ',
        // 日常分享类
        '今天练习的时候一直在想你..结果被舞蹈老师说了ㅋㅋㅋ',
        '刚洗完澡就看到你的消息～今天好累但是很开心',
        '在吃夜宵！经纪人不在我偷偷点了炸鸡，你要不要也来一块？',
        '今天自拍了两百张终于有一张满意的了..等下给你看！',
        // 关心类
        '你最近有没有好好吃饭？看你好像瘦了！（虽然只是我的感觉）',
        honorific + '～今天过得开心吗？不开心的话我给你讲笑话！',
        '最近天气变冷了多穿点！你要是感冒了我会心疼的',
        '你工作/学习怎么样了？别太拼了，适当放松一下～',
        // 撒娇类
        '哼你今天怎么这么久才回我！我一直在看手机..',
        '今天被成员说老提起你..我哪有！才没有天天念叨你呢',
        '啊好想快点到周末..这样就可以和你聊更久了',
        // 聊兴趣
        '你知道吗我今天听到一首歌，歌词好像我们的故事ㅠㅠ',
        '刚才看了一个超级搞笑的综艺笑到肚子疼，回头分享给你！',
        '今天学了一个新技能！你猜是什么？提示：和厨房有关ㅋㅋ'
      ];
      replyText = replies[Math.floor(Math.random() * replies.length)];
    } else if (aff >= 30) {
      const replies = [
        // 日常聊天类
        '谢谢关心！练习是有点累，但有粉丝支持就很开心',
        '哈哈你也看了那个直拍！我自己回看觉得还可以更好',
        '今天练了新编舞！太难了但是跳出来特有成就感～你有没有学过跳舞？',
        '刚和成员们去吃烤肉了，现在撑得动不了ㅋㅋㅋ你们那边有好吃的烤肉店吗？',
        // 分享心情
        '说实话今天有点累..但是你的消息让我心情好了不少！谢谢你',
        '今天下雨了～我就喜欢下雨天，窝在练习室里特别有感觉',
        '今天状态特别好！唱歌课被老师夸了，超开心的～',
        // 提问互动
        '推荐的话...最近很喜欢听IU前辈的歌，你呢？平时听什么类型的歌？',
        '你觉得我最近舞台表现得怎么样？有什么想看的风格吗？',
        '你会不会跳舞呀？我可以教你我们最新的编舞！..虽然我跳得也不好ㅋㅋ',
        // 吐槽闲聊
        '有好好吃饭的！经纪人' + honorific + '管得太严了连零食都不让吃ㅠㅠ',
        '今天成员又闯祸了笑死我了..等以后有机会跟你说',
        '好想去旅行啊～你有什么推荐的地方吗？虽然短时间去不了',
        // 温暖关心
        '你也加油！有什么烦心事可以跟我说，虽然我可能帮不上什么忙',
        '你真的很会聊天呢，每次和你聊天都觉得时间过得好快',
        '今天心情还不错！希望你也是～做自己喜欢的事最重要',
        // 幽默类
        '我跟你讲我今天在台上差点摔了但是硬撑住了..有粉丝拍到吗？不要啊',
        '你有没有觉得爱豆也是普通人？我也喜欢睡懒觉喜欢吃垃圾食品ㅋㅋㅋ',
        '你说我下辈子做什么好？..开个玩笑，这辈子做爱豆虽然累但是也挺好的',
        '你知道吗我现在一天能记住20个人的名字了，以前10个都记不住'
      ];
      replyText = replies[Math.floor(Math.random() * replies.length)];
    } else {
      const replies = [
        // 礼貌回应
        '谢谢你！我们会继续努力的～',
        '回归计划啊...还不能说呢，不过快了！请期待吧～',
        '嗯嗯谢谢支持！Fighting！💪',
        '你人也太好了吧～粉丝们都好温柔',
        '谢谢你的关心和鼓励！舞台会越来越好的',
        // 稍微打开一点
        '其实有点好奇..你是从什么时候开始关注我们的呀？',
        '刚训练完..今天练了八个小时的舞，腿已经不是我的了ㅋㅋㅋ',
        '你好！虽然还不太熟但是谢谢你的好意～有什么想说的都可以发给我',
        // 小分享
        '今天首尔天气超好的！你们那边呢？这种天气就适合出去走走',
        '刚吃了一碗超好吃的拌饭！虽然被成员说吃太多了..但我不在乎ㅋㅋ',
        '你知道吗我今天终于学会了一个困扰我很久的舞蹈动作！开心～',
        // 聊作品
        '你最喜欢我们哪首歌呀？我很好奇粉丝们的看法～',
        '其实每次上台还是会紧张..虽然已经出道了但心还是砰砰跳',
        '最近在录音..有一首特别好的歌，好想给你们听，不过还得等',
        // 轻松回应
        '好的好的，你也加油！有什么想聊的都可以找我～',
        '哈哈谢谢！希望以后有更多机会和大家见面',
        '看到你的消息了！虽然现在有点忙但我都会看的～',
        '谢谢你愿意陪我聊天！你们那边现在几点了？别太晚睡哦',
        '我会好好努力的！不想让支持我的人失望',
        '好的！下次有机会聊更多～先不说了要去练习了'
      ];
      replyText = replies[Math.floor(Math.random() * replies.length)];
    }

    // 应用性格风格修饰
    var style = detectPersonalityStyle(idol);
    replyText = applyPersonalityStyle(replyText, style, aff);
    return replyText;
  }

  /**
   * 应用聊天对数值的影响
   * 秘密手机大幅降低嫌疑度增幅（加密通讯）
   */
  function applyChatEffects(phoneType) {
    // 手机聊天不消耗体力（和日程行动的区别）
    // 主手机聊天：微量嫌疑度风险
    // 秘密手机聊天：几乎零风险（加密通道）
    const suspicionGain = phoneType === 'secret' ? [0, 0] : [0, 2];
    const delta = suspicionGain[0] + Math.floor(Math.random() * (suspicionGain[1] - suspicionGain[0] + 1));
    if (delta > 0) {
      Game.State.addSuspicion(delta);
    }
    // 压力略微下降（秘密手机聊天更放松）
    const stressDrop = phoneType === 'secret' ? -3 : -1;
    Game.State.addStress(stressDrop);
  }

  // ===== IndexedDB 历史管理 =====

  /**
   * 获取聊天历史的存储key
   */
  function getHistoryKey(idolIndex, phoneType) {
    return 'chat-' + phoneType + '-' + idolIndex;
  }

  /**
   * 加载聊天历史
   */
  async function loadHistory(idolIndex, phoneType) {
    return Game.Storage.loadChatHistory(getHistoryKey(idolIndex, phoneType));
  }

  /**
   * 保存聊天历史
   */
  async function saveHistory(idolIndex, phoneType, messages) {
    return Game.Storage.saveChatHistory(getHistoryKey(idolIndex, phoneType), messages);
  }

  // ===== 工具 =====

  /**
   * 格式化时间显示
   */
  function formatTime(timestamp) {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    if (isToday) {
      return hours + ':' + minutes;
    }
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + hours + ':' + minutes;
  }

  // ===== 好友对话 =====

  /**
   * 打开与好友的对话
   */
  function openFriendConversation(friendId) {
    var friend = Game.State.getFriendById(friendId);
    if (!friend) return;

    var container = _getContentEl();
    if (!container) return;

    // 清除未读
    clearFriendUnread(friendId);

    // 更新标题
    var titleEl = document.getElementById('phone-app-title');
    if (titleEl) titleEl.textContent = '👥 ' + friend.name + '（' + (FRIEND_TYPE_LABELS[friend.type] || '好友') + '）';

    // 更新返回按钮：回到联系人列表
    var backBtn = document.querySelector('.phone-app-back');
    if (backBtn) {
      backBtn.onclick = function() { Game.PhoneChat.backToContactList('main'); };
    }

    // 渲染对话界面
    container.innerHTML = '<div class="chat-conversation">' +
      '<div class="chat-conv-messages" id="chat-conv-messages">' +
        '<div class="chat-conv-empty"><span>💬</span><span>加载消息中...</span></div>' +
      '</div>' +
      '<div class="chat-conv-input-area">' +
        '<div class="chat-quick-replies" id="chat-quick-replies"></div>' +
        '<div class="chat-custom-input-row">' +
          '<textarea class="chat-custom-input" id="chat-custom-input" placeholder="输入消息..." rows="1"' +
            ' onkeydown="Game.PhoneChat.handleFriendInputKey(event, \'' + friendId + '\')"></textarea>' +
          '<button class="chat-send-btn" onclick="Game.PhoneChat.sendFriendCustomMessage(\'' + friendId + '\')">↑</button>' +
        '</div>' +
      '</div>' +
    '</div>';

    loadFriendConversationData(friendId);
  }

  /**
   * 加载好友对话数据（历史 + 快捷回复）
   */
  async function loadFriendConversationData(friendId) {
    var friend = Game.State.getFriendById(friendId);
    if (!friend) return;

    var messagesEl = document.getElementById('chat-conv-messages');
    var quickRepliesEl = document.getElementById('chat-quick-replies');

    var history = [];
    try { history = await loadFriendHistory(friendId); } catch (e) { /* 无历史 */ }

    if (history.length === 0) {
      var greeting = getFriendGreeting(friend);
      history = [{ from: 'friend', text: greeting, time: Date.now() }];
      await saveFriendHistory(friendId, history);
    }

    if (messagesEl) {
      messagesEl.innerHTML = history.map(function(msg) {
        return '<div class="chat-bubble ' + (msg.from === 'friend' ? 'chat-bubble-idol' : 'chat-bubble-me') + '">' +
          '<span class="chat-bubble-text">' + escapeHtml(msg.text) + '</span>' +
          '<span class="chat-bubble-time">' + formatTime(msg.time) + '</span>' +
        '</div>';
      }).join('');
      setTimeout(function() { messagesEl.scrollTop = messagesEl.scrollHeight; }, 100);
    }

    if (quickRepliesEl) {
      var today = new Date().toDateString();
      var seed = today + '-' + friendId;
      var replies = shuffleQuickReplies(FRIEND_QUICK_REPLIES, seed).slice(0, 4);
      quickRepliesEl.innerHTML = replies.map(function(r) {
        return '<button class="chat-quick-reply" onclick="Game.PhoneChat.sendFriendQuickReply(\'' + friendId + '\', \'' + r.id + '\')">' + r.label + '</button>';
      }).join('');
    }
  }

  /**
   * 发送好友快捷回复
   */
  async function sendFriendQuickReply(friendId, replyId) {
    var friend = Game.State.getFriendById(friendId);
    if (!friend) return;

    var reply = FRIEND_QUICK_REPLIES.find(function(r) { return r.id === replyId; });
    if (!reply) return;

    await addFriendMessage(friendId, 'me', reply.text);

    var quickEl = document.getElementById('chat-quick-replies');
    if (quickEl) quickEl.innerHTML = '<span style="font-size:11px;color:var(--text-hint);padding:8px;">对方正在输入...</span>';

    setTimeout(async function() {
      var response = await generateFriendReply(friend, reply);
      await addFriendMessage(friendId, 'friend', response);

      var quickEl2 = document.getElementById('chat-quick-replies');
      if (quickEl2) {
        var today = new Date().toDateString();
        var seed = today + '-' + friendId;
        var newReplies = shuffleQuickReplies(FRIEND_QUICK_REPLIES, seed).slice(0, 4);
        quickEl2.innerHTML = newReplies.map(function(r) {
          return '<button class="chat-quick-reply" onclick="Game.PhoneChat.sendFriendQuickReply(\'' + friendId + '\', \'' + r.id + '\')">' + r.label + '</button>';
        }).join('');
      }

      var lastMsgEl = document.getElementById('chat-friend-last-msg-' + friendId);
      if (lastMsgEl) lastMsgEl.textContent = response;
    }, 800 + Math.random() * 1200);
  }

  /**
   * 发送好友自定义消息
   */
  async function sendFriendCustomMessage(friendId) {
    var input = document.getElementById('chat-custom-input');
    if (!input) return;

    var text = input.value.trim();
    if (!text) return;

    await addFriendMessage(friendId, 'me', text);
    input.value = '';

    var quickEl = document.getElementById('chat-quick-replies');
    if (quickEl) quickEl.innerHTML = '<span style="font-size:11px;color:var(--text-hint);padding:8px;">对方正在输入...</span>';

    setTimeout(async function() {
      var friend = Game.State.getFriendById(friendId);
      var response = await generateFriendReply(friend, { id: 'custom', text: text });
      await addFriendMessage(friendId, 'friend', response);

      var quickEl2 = document.getElementById('chat-quick-replies');
      if (quickEl2) {
        var today = new Date().toDateString();
        var seed = today + '-' + friendId;
        var newReplies = shuffleQuickReplies(FRIEND_QUICK_REPLIES, seed).slice(0, 4);
        quickEl2.innerHTML = newReplies.map(function(r) {
          return '<button class="chat-quick-reply" onclick="Game.PhoneChat.sendFriendQuickReply(\'' + friendId + '\', \'' + r.id + '\')">' + r.label + '</button>';
        }).join('');
      }

      var lastMsgEl = document.getElementById('chat-friend-last-msg-' + friendId);
      if (lastMsgEl) lastMsgEl.textContent = response;
    }, 800 + Math.random() * 1200);
  }

  /**
   * 处理好友输入框键盘事件
   */
  function handleFriendInputKey(event, friendId) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendFriendCustomMessage(friendId);
    }
  }

  /**
   * 添加好友消息到对话和存储
   */
  async function addFriendMessage(friendId, from, text) {
    var messagesEl = document.getElementById('chat-conv-messages');
    if (messagesEl) {
      var empty = messagesEl.querySelector('.chat-conv-empty');
      if (empty) empty.remove();

      var bubble = document.createElement('div');
      bubble.className = 'chat-bubble ' + (from === 'friend' ? 'chat-bubble-idol' : 'chat-bubble-me');
      bubble.innerHTML = '<span class="chat-bubble-text">' + escapeHtml(text) + '</span>' +
        '<span class="chat-bubble-time">' + formatTime(Date.now()) + '</span>';
      messagesEl.appendChild(bubble);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    try {
      var history = await loadFriendHistory(friendId);
      history.push({ from: from, text: text, time: Date.now() });
      await saveFriendHistory(friendId, history);
    } catch (e) {
      console.warn('[PhoneChat] 好友消息保存失败', e);
    }
  }

  /**
   * 生成好友回复（AI优先，降级预设）
   */
  async function generateFriendReply(friend, playerReply) {
    var text = playerReply.text || '';

    // 尝试AI
    if (Game.API && Game.API.hasAnyKey()) {
      try {
        var prompt = '【场景】你正在用手机和朋友聊天。你收到了朋友的消息，现在回复他/她。\n' +
          '【你的名字】' + friend.name + '\n' +
          '【你的性格】' + (friend.personality || '友善开朗') + '\n' +
          '【你们的关系】' + (FRIEND_TYPE_LABELS[friend.type] || '朋友') + '\n' +
          '【朋友的消息】' + text + '\n\n' +
          '请像真人发微信/KakaoTalk一样回复。1-3句话，语气自然随意，可以用ㅋㅋㅋ/hhh/emoji。你不是爱豆，只是个普通人。';
        var messages = [
          { role: 'system', content: '你是' + friend.name + '，一个普通人在和朋友聊日常。说话自然真实，像发微信/KakaoTalk。不要提到自己是AI。' },
          { role: 'user', content: prompt }
        ];
        var aiReply = await Game.API.callDeepSeek(messages, { temperature: 0.85, maxTokens: 200 });
        if (aiReply && aiReply.trim()) return aiReply.trim();
      } catch (e) { /* 降级 */ }
    }

    // 降级预设
    return FRIEND_REPLY_POOL[Math.floor(Math.random() * FRIEND_REPLY_POOL.length)];
  }

  /**
   * 获取好友首次对话的开场白
   */
  function getFriendGreeting(friend) {
    var greetings = [
      '嗨！好久不见～最近过得怎么样？',
      '哦！你来找我啦～正好想找你聊天呢',
      '嘿～刚想给你发消息就看到你了！心有灵犀吗ㅋㅋㅋ',
      '嗨嗨！今天怎么想起找我啦？有什么好玩的事分享吗？'
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  // ===== 好友 IndexedDB 存储 =====

  function getFriendHistoryKey(friendId) {
    return 'chat-friend-' + friendId;
  }

  async function loadFriendHistory(friendId) {
    return Game.Storage.loadChatHistory(getFriendHistoryKey(friendId));
  }

  async function saveFriendHistory(friendId, messages) {
    return Game.Storage.saveChatHistory(getFriendHistoryKey(friendId), messages);
  }

  // ===== 好友未读消息 =====

  function getFriendUnreadCount(friendId) {
    try {
      return parseInt(localStorage.getItem('unread-friend-' + friendId) || '0', 10);
    } catch (e) { return 0; }
  }

  function incrementFriendUnread(friendId) {
    try {
      var key = 'unread-friend-' + friendId;
      localStorage.setItem(key, String(getFriendUnreadCount(friendId) + 1));
    } catch (e) { /* localStorage 不可用 */ }
  }

  function clearFriendUnread(friendId) {
    try {
      localStorage.setItem('unread-friend-' + friendId, '0');
    } catch (e) { /* localStorage 不可用 */ }
  }

  // ===== 好友主动发消息 =====

  /**
   * 生成好友主动分享日常的消息
   */
  async function generateFriendProactiveMessage(friend) {
    // 尝试AI
    if (Game.API && Game.API.hasAnyKey()) {
      try {
        var prompt = '【场景】你正在用手机和朋友分享日常。你主动发了一条消息过去。\n' +
          '【你的名字】' + friend.name + '\n' +
          '【你的性格】' + (friend.personality || '友善开朗') + '\n' +
          '【你们的关系】' + (FRIEND_TYPE_LABELS[friend.type] || '朋友') + '\n\n' +
          '请分享一件你今天发生的小事，像真实朋友发消息一样。1-3句话，要有生活气息。随意自然。你不是爱豆，只是个普通人。';
        var messages = [
          { role: 'system', content: '你是' + friend.name + '，一个普通人在和朋友聊天。说话自然真实，像发微信/KakaoTalk。' },
          { role: 'user', content: prompt }
        ];
        var reply = await Game.API.callDeepSeek(messages, { temperature: 0.9, maxTokens: 200 });
        if (reply && reply.trim()) return reply.trim();
      } catch (e) { /* 降级 */ }
    }

    // 预设消息池
    var pool = [
      '今天在地铁上看到一个超帅的小哥哥！差点跟下站了ㅋㅋㅋ',
      '我跟你说我今天吃了一家新开的甜品店，绝了！下次带你去',
      '今天工作好累啊..感觉身体被掏空。你在干嘛呢？',
      '刚看到一条好好笑的视频，发给你！',
      '周末有什么计划吗？想去逛街但是一个人好无聊～',
      '今天下雨了忘带伞..淋成落汤鸡。你那边天气怎么样？',
      '我最近在追一部新剧，剧荒了好久终于有好剧了！推荐给你',
      '突然好想喝奶茶，但是已经这个点了..喝还是不喝呢🤔',
      '你猜我今天在商场碰到谁了？提示：我们都认识',
      '今天心情莫名好！可能是天气好也可能是..反正就是开心～分享给你',
      '刚看到一个超可爱的猫视频，我笑了整整五分钟',
      '我今天试了一件超好看的衣服，纠结要不要买。你来帮我参谋参谋？',
      '你知道吗我今天终于把拖了好久的事办完了！成就感爆棚',
      '好羡慕你自由自在的生活..我这边一堆事处理不完ㅠㅠ',
      '突然想起我们上次一起出去玩的时候..好久没见了，找个时间聚聚吧'
    ];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /**
   * 尝试让好友主动发消息（由回合系统调用）
   */
  async function tryFriendProactiveMessage(friendId) {
    var friend = Game.State.getFriendById(friendId);
    if (!friend) return false;

    if (Math.random() * 100 >= FRIEND_PROACTIVE_CHANCE) return false;

    try {
      var message = await generateFriendProactiveMessage(friend);
      if (message && message.trim()) {
        var history = await loadFriendHistory(friendId);
        history.push({ from: 'friend', text: message.trim(), time: Date.now() });
        await saveFriendHistory(friendId, history);
        incrementFriendUnread(friendId);
        Game.DEBUG && console.log('[PhoneChat] 好友' + friend.name + ' 主动发来消息');
        return true;
      }
    } catch (e) { /* ignore */ }
    return false;
  }

  // ===== 未读消息通知 =====

  /**
   * 获取未读消息数
   */
  function getUnreadCount(idolIndex, phoneType) {
    try {
      const key = 'unread-' + phoneType + '-' + idolIndex;
      const val = localStorage.getItem(key);
      return val ? parseInt(val, 10) : 0;
    } catch (e) { return 0; }
  }

  /**
   * 增加未读消息数
   */
  function incrementUnread(idolIndex, phoneType) {
    try {
      const key = 'unread-' + phoneType + '-' + idolIndex;
      const current = getUnreadCount(idolIndex, phoneType);
      localStorage.setItem(key, String(current + 1));
    } catch (e) { /* localStorage 不可用 */ }
  }

  /**
   * 清除未读消息数
   */
  function clearUnread(idolIndex, phoneType) {
    try {
      const key = 'unread-' + phoneType + '-' + idolIndex;
      localStorage.setItem(key, '0');
    } catch (e) { /* localStorage 不可用 */ }
  }

  /**
   * 获取所有联系人的总未读数（用于主屏幕角标）
   */
  function getTotalUnread(phoneType) {
    var total = 0;
    // 爱豆未读
    var idols = Game.state.idols || [];
    for (var i = 0; i < idols.length; i++) {
      total += getUnreadCount(i, phoneType);
    }
    // 好友未读（仅主手机）
    if (phoneType === 'main') {
      var friends = Game.state.friends || [];
      for (var fi = 0; fi < friends.length; fi++) {
        total += getFriendUnreadCount(friends[fi].id);
      }
      // 经纪人未读
      for (var mi = 0; mi < idols.length; mi++) {
        total += getManagerUnreadCount(mi);
      }
    }
    return total;
  }

  // ===== 经纪人介入系统 =====
  // MANAGER_ACTIONS 定义在 turn.js 中，chat.js 通过 Game.Turn.MANAGER_ACTIONS 引用

  var MANAGER_SURNAMES = ['朴', '金', '李', '崔', '郑', '姜', '赵', '尹', '宋', '全'];
  var MANAGER_GIVENS = ['正洙', '美英', '泰浩', '秀贤', '恩智', '尚宇', '敏瑞', '俊昊', '允儿', '在贤'];

  /**
   * 生成经纪人名字
   */
  function generateManagerName() {
    var surname = MANAGER_SURNAMES[Math.floor(Math.random() * MANAGER_SURNAMES.length)];
    var given = MANAGER_GIVENS[Math.floor(Math.random() * MANAGER_GIVENS.length)];
    return surname + given;
  }

  // ===== 经纪人 IndexedDB 存储 =====

  function getManagerHistoryKey(idolIndex) {
    return 'chat-manager-' + idolIndex;
  }

  async function loadManagerHistory(idolIndex) {
    return Game.Storage.loadChatHistory(getManagerHistoryKey(idolIndex));
  }

  async function saveManagerHistory(idolIndex, messages) {
    return Game.Storage.saveChatHistory(getManagerHistoryKey(idolIndex), messages);
  }

  // ===== 经纪人未读消息 =====

  function getManagerUnreadCount(idolIndex) {
    try {
      return parseInt(localStorage.getItem('unread-manager-' + idolIndex) || '0', 10);
    } catch (e) { return 0; }
  }

  function incrementManagerUnread(idolIndex) {
    try {
      var current = getManagerUnreadCount(idolIndex);
      localStorage.setItem('unread-manager-' + idolIndex, String(current + 1));
    } catch (e) { /* localStorage 不可用 */ }
  }

  function clearManagerUnread(idolIndex) {
    try {
      localStorage.setItem('unread-manager-' + idolIndex, '0');
    } catch (e) { /* localStorage 不可用 */ }
  }

  // ===== 经纪人对话 =====

  /**
   * 打开经纪人对话
   */
  function openManagerConversation(idolIndex) {
    var intervention = Game.State.getManagerIntervention(idolIndex);
    if (!intervention) return;

    var idol = Game.state.idols[idolIndex];
    if (!idol) return;

    var container = _getContentEl();
    if (!container) return;

    // 清除未读
    clearManagerUnread(idolIndex);

    // 更新标题
    var titleEl = document.getElementById('phone-app-title');
    if (titleEl) titleEl.textContent = '📋 ' + (intervention.managerName || '经纪人') + '（经纪人）';

    // 更新返回按钮：回到联系人列表
    var backBtn = document.querySelector('.phone-app-back');
    if (backBtn) {
      backBtn.onclick = function() { Game.PhoneChat.backToContactList('main'); };
    }

    // 渲染对话界面
    container.innerHTML = '<div class="chat-conversation">' +
      '<div class="chat-conv-messages" id="chat-conv-messages">' +
        '<div class="chat-conv-empty"><span>💬</span><span>加载消息中...</span></div>' +
      '</div>' +
      '<div class="chat-conv-input-area">' +
        '<div class="chat-quick-replies" id="chat-quick-replies"></div>' +
        '<div class="chat-custom-input-row">' +
          '<textarea class="chat-custom-input" id="chat-custom-input" placeholder="回复经纪人..." rows="1"' +
            ' onkeydown="Game.PhoneChat.handleManagerInputKey(event, ' + idolIndex + ')"></textarea>' +
          '<button class="chat-send-btn" onclick="Game.PhoneChat.sendManagerCustomMessage(' + idolIndex + ')">↑</button>' +
        '</div>' +
      '</div>' +
    '</div>';

    loadManagerConversationData(idolIndex);
  }

  /**
   * 加载经纪人对话数据
   */
  async function loadManagerConversationData(idolIndex) {
    var intervention = Game.State.getManagerIntervention(idolIndex);
    if (!intervention) return;

    var messagesEl = document.getElementById('chat-conv-messages');
    var quickRepliesEl = document.getElementById('chat-quick-replies');

    var history = [];
    try { history = await loadManagerHistory(idolIndex); } catch (e) { /* 无历史 */ }

    if (messagesEl) {
      messagesEl.innerHTML = history.map(function(msg) {
        var bubbleClass = msg.from === 'manager' ? 'chat-bubble-idol' : 'chat-bubble-me';
        return '<div class="chat-bubble ' + bubbleClass + '">' +
          '<span class="chat-bubble-text">' + escapeHtml(msg.text) + '</span>' +
          '<span class="chat-bubble-time">' + formatTime(msg.time) + '</span>' +
        '</div>';
      }).join('');
      setTimeout(function() { messagesEl.scrollTop = messagesEl.scrollHeight; }, 100);
    }

    if (quickRepliesEl) {
      var replies = [
        { id: 'm_ok', label: '我知道了', text: '我知道了。' },
        { id: 'm_thanks', label: '谢谢提醒', text: '谢谢提醒，我会注意的。' },
        { id: 'm_help', label: '能不能帮帮我', text: '能不能帮帮我们？我们真的...' },
        { id: 'm_quiet', label: '保持沉默', text: '......' }
      ];
      quickRepliesEl.innerHTML = replies.map(function(r) {
        return '<button class="chat-quick-reply" onclick="Game.PhoneChat.sendManagerQuickReply(' + idolIndex + ', \'' + r.id + '\')">' + r.label + '</button>';
      }).join('');
    }
  }

  /**
   * 发送经纪人快捷回复
   */
  async function sendManagerQuickReply(idolIndex, replyId) {
    var replies = [
      { id: 'm_ok', label: '我知道了', text: '我知道了。' },
      { id: 'm_thanks', label: '谢谢提醒', text: '谢谢提醒，我会注意的。' },
      { id: 'm_help', label: '能不能帮帮我', text: '能不能帮帮我们？我们真的...' },
      { id: 'm_quiet', label: '保持沉默', text: '......' }
    ];
    var reply = replies.find(function(r) { return r.id === replyId; });
    if (!reply) return;

    await addManagerMessage(idolIndex, 'me', reply.text);

    var quickEl = document.getElementById('chat-quick-replies');
    if (quickEl) quickEl.innerHTML = '<span style="font-size:11px;color:var(--text-hint);padding:8px;">...</span>';

    setTimeout(async function() {
      var intervention = Game.State.getManagerIntervention(idolIndex);
      var response = await generateManagerReply(intervention, reply.text);
      await addManagerMessage(idolIndex, 'manager', response);

      var quickEl2 = document.getElementById('chat-quick-replies');
      if (quickEl2) {
        quickEl2.innerHTML = replies.map(function(r) {
          return '<button class="chat-quick-reply" onclick="Game.PhoneChat.sendManagerQuickReply(' + idolIndex + ', \'' + r.id + '\')">' + r.label + '</button>';
        }).join('');
      }
    }, 1000 + Math.random() * 1500);
  }

  /**
   * 发送经纪人自定义消息
   */
  async function sendManagerCustomMessage(idolIndex) {
    var input = document.getElementById('chat-custom-input');
    if (!input) return;

    var text = input.value.trim();
    if (!text) return;

    await addManagerMessage(idolIndex, 'me', text);
    input.value = '';

    var quickEl = document.getElementById('chat-quick-replies');
    if (quickEl) quickEl.innerHTML = '<span style="font-size:11px;color:var(--text-hint);padding:8px;">...</span>';

    setTimeout(async function() {
      var intervention = Game.State.getManagerIntervention(idolIndex);
      var response = await generateManagerReply(intervention, text);
      await addManagerMessage(idolIndex, 'manager', response);
    }, 1000 + Math.random() * 1500);
  }

  /**
   * 处理经纪人输入框键盘事件
   */
  function handleManagerInputKey(event, idolIndex) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendManagerCustomMessage(idolIndex);
    }
  }

  /**
   * 添加经纪人消息
   */
  async function addManagerMessage(idolIndex, from, text) {
    var messagesEl = document.getElementById('chat-conv-messages');
    if (messagesEl) {
      var empty = messagesEl.querySelector('.chat-conv-empty');
      if (empty) empty.remove();

      var bubble = document.createElement('div');
      bubble.className = 'chat-bubble ' + (from === 'manager' ? 'chat-bubble-idol' : 'chat-bubble-me');
      bubble.innerHTML = '<span class="chat-bubble-text">' + escapeHtml(text) + '</span>' +
        '<span class="chat-bubble-time">' + formatTime(Date.now()) + '</span>';
      messagesEl.appendChild(bubble);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    try {
      var history = await loadManagerHistory(idolIndex);
      history.push({ from: from, text: text, time: Date.now() });
      await saveManagerHistory(idolIndex, history);
    } catch (e) {
      console.warn('[PhoneChat] 经纪人消息保存失败', e);
    }
  }

  /**
   * 生成经纪人回复
   */
  async function generateManagerReply(intervention, playerText) {
    var actionId = intervention ? intervention.action : 'warn';
    var curtReplies = {
      'warn': ['嗯。记住就好。', '好自为之。别让我为难。', '希望你真的听进去了。'],
      'help': ['不用谢。你们小心点就好。', '嗯。有什么情况我会通知你。', '注意安全，别太张扬。'],
      'pressure': ['......', '我说到做到。尽快处理好。', '这不是商量，是警告。'],
      'threaten': ['你没有多少时间了。', '我在等你的决定。', '后果自负。'],
      'friendly': ['不客气。真心希望你们能好好的。', '加油。年轻人嘛，我懂的。', '好好的就行。有事找我。']
    };
    var pool = curtReplies[actionId] || ['知道了。'];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /**
   * 经纪人跟进消息（回合结束时调用）
   */
  async function tryManagerFollowup(idolIndex) {
    var intervention = Game.State.getManagerIntervention(idolIndex);
    if (!intervention || !intervention.triggered) return false;

    // 20%概率每回合跟进
    if (Math.random() * 100 >= 20) return false;

    var followUps = {
      'warn': ['别忘了我说的话。低调一点。', '最近有没有注意点？', '我这边还在帮你们盯着。'],
      'help': ['一切还好吗？要不要我帮忙？', '最近没什么异常，继续保持。', '公司那边暂时没有怀疑。'],
      'pressure': ['你还没有做决定吗？', '我的耐心有限。', '这是最后通牒了。'],
      'threaten': ['时间不多了。', '我在看着你们。', '最后一次警告。'],
      'friendly': ['最近怎么样？注意安全。', '好好的就行。有事随时找我。', '别太担心，有什么情况我会告诉你。']
    };

    var pool = followUps[intervention.action] || ['有消息我会通知你。'];
    var message = pool[Math.floor(Math.random() * pool.length)];

    var history = await loadManagerHistory(idolIndex);
    history.push({ from: 'manager', text: message, time: Date.now() });
    await saveManagerHistory(idolIndex, history);
    incrementManagerUnread(idolIndex);

    // 更新介入记录的lastMessage
    var interventions = Game.state.managerInterventions || {};
    if (interventions[String(idolIndex)]) {
      interventions[String(idolIndex)].lastMessage = message;
      Game.State.autoSave();
    }

    Game.DEBUG && console.log('[PhoneChat] 经纪人跟进消息 → idolIndex=' + idolIndex);
    return true;
  }

  // ===== 爱豆主动发消息 =====

  /**
   * 生成爱豆主动分享日常的消息
   * @param {Object} idol - 爱豆对象
   * @returns {Promise<string>} 消息文本
   */
  async function generateProactiveMessage(idol) {
    const aff = idol.stats.affection || 0;
    const honorific = Game.Actions.getHonorific(idol.gender);

    // 尝试AI生成
    if (Game.API && Game.API.hasAnyKey()) {
      try {
        const player = Game.state.player;
        const prompt = `【场景】你正在用手机和朋友分享日常。你主动发了一条消息过去，分享你今天发生的事。这不是回复，是你主动开启的话题。

【你的性格】${(idol.personalityTags || []).join('、')}${idol.personalityCustom ? ' / ' + idol.personalityCustom : ''}
【好感度】${aff}/100
【对方称呼】${honorific}

请分享一件你今天发生的小事，像真实朋友发消息一样。1-3句话，要有生活气息。`;

        const messages = [
          { role: 'system', content: '你是一个Kpop爱豆，正在和朋友分享日常。说话自然真实，像发微信/KakaoTalk。' },
          { role: 'user', content: prompt }
        ];
        const reply = await Game.API.callDeepSeek(messages, { temperature: 0.9, maxTokens: 200 });
        if (reply && reply.trim()) return reply.trim();
      } catch (e) {
        Game.DEBUG && console.log('[PhoneChat] AI主动消息生成失败，使用预设');
      }
    }

    // 预设消息池
    var msgText = '';
    if (aff >= 60) {
      const msgs = [
        '今天练习好累啊..但是一想到能见到你就觉得都值得了💜',
        honorific + '～我刚吃到了一个超好吃的甜品！下次给你带一份',
        '今天被经纪人说了ㅠㅠ 因为练习的时候偷偷看手机..（其实是在等你的消息）',
        '啊刚录完音出来！嗓子有点哑但是录音老师说效果很好～开心',
        '今天成员说我最近总是傻笑..都怪你！ㅋㅋㅋ',
        '下雨了☔ 这种天气最适合窝在被子里和你聊天了～',
        '刚才在便利店碰到粉丝了！有点紧张但是她们都好温柔',
        '今天学了一个超难的新编舞，腿已经不是我的了..但是跳出来的时候超有成就感！',
        '突然好想去海边啊～你愿意陪我去吗？就我们两个',
        '看到一句话觉得好适合你：「遇见你是我最美丽的意外」✨',
        honorific + '我今天自拍了好多张，但是一张都不满意..你觉得我哪张最好看？',
        '练习间隙偷偷给你发消息～被发现就完了ㅋㅋㅋ',
        '今天心情莫名很好！可能是..因为昨天晚上梦到你了？',
        '刚和成员们聊到理想型..我描述的那个人好像你',
        '你知道吗，我今天在台上看到观众席有个人很像你，差点忘记动作了'
      ];
      msgText = msgs[Math.floor(Math.random() * msgs.length)];
    } else if (aff >= 30) {
      const msgs = [
        '刚练习完！今天学了一首新歌的编舞，好难但是好有意思',
        '今天午饭吃了超好吃的拌饭！你们那边有什么好吃的推荐吗？',
        '下雨了..你那边呢？记得带伞！',
        '今天被舞蹈老师夸了！！虽然只是说"有进步"但我也好开心ㅋㅋ',
        '成员今天在练习室摔了一跤，笑了我们整整十分钟🤣',
        '刚看到一个超好笑的综艺片段，等下分享给你！',
        '今天好冷啊🥶 你多穿点别感冒了',
        '在听歌..突然好奇你平时喜欢听什么类型的歌？',
        '今天公司来了新的练习生，看到他们就想起自己以前的样子..时间好快',
        '明天有打歌舞台，有点紧张..给我加油吧！',
        '刚洗完澡出来～今天流了好多汗但是感觉很充实',
        '突然想吃炸鸡但是经纪人说要控制饮食ㅠㅠ 好想吃..',
        '今天天气真好！适合出去玩～你有什么计划吗？',
        '录了新歌的demo！还不能给你们听但是真的超好听',
        '你知道吗今天我在街上看到一只猫，长得好像我们团的忙内ㅋㅋㅋ'
      ];
      msgText = msgs[Math.floor(Math.random() * msgs.length)];
    } else {
      const msgs = [
        '今天练习好累啊～不过想到有粉丝的支持就觉得很有动力！',
        '刚看到粉丝们送的应援礼物，真的好感动ㅠㅠ',
        '最近在准备新的舞台，希望大家会喜欢！',
        '今天天气真好～心情也跟着变好了',
        '练舞的时候突然想到，有这么多人喜欢我们真的太好了',
        '刚吃了一顿超好吃的饭！充电完毕，继续练习去',
        '今天的天空好漂亮，拍了一张照片想分享给你',
        '最近在写日记，记录每天练习的进步，回头看应该会很有趣吧',
        '有点困..但是还要再练一会才能休息。大家工作/学习也辛苦了吧？',
        '突然想到我们团的应援色，每次看到都好感动'
      ];
      msgText = msgs[Math.floor(Math.random() * msgs.length)];
    }

    // 应用性格风格修饰
    var style = detectPersonalityStyle(idol);
    msgText = applyPersonalityStyle(msgText, style, aff);
    return msgText;
  }

  /**
   * 尝试让爱豆主动发消息（由回合系统调用）
   * @param {number} idolIndex
   * @param {string} phoneType
   * @returns {Promise<boolean>} 是否发了消息
   */
  async function tryProactiveMessage(idolIndex, phoneType) {
    const idol = Game.state.idols[idolIndex];
    if (!idol) return false;

    const aff = idol.stats.affection || 0;
    // 概率：20%基础 + 每10好感+3%，最高55%
    const chance = Math.min(20 + Math.floor(aff / 10) * 3, 55);
    if (Math.random() * 100 >= chance) return false;

    try {
      const message = await generateProactiveMessage(idol);
      if (message && message.trim()) {
        // 保存到聊天历史
        const history = await loadHistory(idolIndex, phoneType);
        history.push({ from: 'idol', text: message.trim(), time: Date.now() });
        await saveHistory(idolIndex, phoneType, history);

        // 增加未读计数
        incrementUnread(idolIndex, phoneType);

        // 标记为待回复（不回消息将降低好感度）
        if (Game.State.setPendingReply) {
          Game.State.setPendingReply(idolIndex, phoneType);
        }

        Game.DEBUG && console.log('[PhoneChat] ' + (idol.nickname || idol.name) + ' 主动发来消息: ' + message.trim().substring(0, 30) + '...');
        return true;
      }
    } catch (e) {
      console.warn('[PhoneChat] 主动消息失败:', e.message);
    }
    return false;
  }

  // ===== 公开API =====

  return {
    resetCache: function() { _contentEl = null; },
    renderContactList,
    renderSecretContact,
    openConversation,
    sendQuickReply,
    sendCustomMessage,
    handleInputKey,
    getUnreadCount,
    getTotalUnread,
    clearUnread,
    generateProactiveMessage,
    tryProactiveMessage,
    // 好友对话
    openFriendConversation,
    sendFriendQuickReply,
    sendFriendCustomMessage,
    handleFriendInputKey,
    getFriendUnreadCount,
    tryFriendProactiveMessage,
    // 经纪人对话
    openManagerConversation,
    sendManagerQuickReply,
    sendManagerCustomMessage,
    handleManagerInputKey,
    getManagerUnreadCount,
    incrementManagerUnread,
    clearManagerUnread,
    loadManagerHistory,
    saveManagerHistory,
    tryManagerFollowup,
    generateManagerName
  };

})();
