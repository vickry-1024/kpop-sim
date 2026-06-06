/**
 * 聊天APP模块 — 手机内的聊天应用
 * 负责：联系人列表、对话界面、快捷回复、消息历史（IndexedDB持久化）
 */

Game.PhoneChat = (() => {

  // 当前对话的爱豆索引
  let _currentIdolIndex = null;

  // ===== 联系人列表 =====

  /**
   * 渲染联系人列表
   * @param {HTMLElement} container
   * @param {string} phoneType - 'main' | 'secret'
   */
  function renderContactList(container, phoneType) {
    const idols = Game.state.idols || [];

    if (idols.length === 0) {
      container.innerHTML = '<div class="chat-conv-empty"><span>📭</span><span>还没有爱豆联系人</span></div>';
      return;
    }

    container.innerHTML = `
      <div class="chat-contacts">
        ${idols.map((idol, i) => `
          <button class="chat-contact-item" onclick="Game.PhoneChat.openConversation(${i}, '${phoneType}')">
            <div class="chat-contact-avatar" id="chat-avatar-${i}">
              <span class="chat-contact-avatar-placeholder">💜</span>
            </div>
            <div class="chat-contact-info">
              <span class="chat-contact-name">${escapeHtml(idol.nickname || idol.name)}</span>
              <span class="chat-contact-last-msg" id="chat-last-msg-${i}">
                ${idol.stats.affection >= 60 ? '💜 关系亲密' : idol.stats.affection >= 30 ? '正在变熟...' : '新认识的爱豆'}
              </span>
            </div>
            <span class="chat-contact-time" id="chat-time-${i}"></span>
          </button>
        `).join('')}
      </div>
    `;

    // 异步加载头像和最近消息
    loadContactDetails(container, phoneType);
  }

  /**
   * 渲染秘密手机联系人（仅显示特定爱豆）
   * @param {HTMLElement} container
   * @param {number|null} idolIndex - 经纪人指定的爱豆索引
   */
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
    }
  }

  // ===== 对话界面 =====

  /**
   * 打开与爱豆的对话
   * @param {number} idolIndex
   * @param {string} phoneType
   */
  function openConversation(idolIndex, phoneType) {
    _currentIdolIndex = idolIndex;

    const idol = Game.state.idols[idolIndex];
    if (!idol) return;

    const container = document.getElementById('phone-app-content');
    if (!container) return;

    const idolName = idol.nickname || idol.name;

    // 更新标题
    const titleEl = document.getElementById('phone-app-title');
    if (titleEl) titleEl.textContent = '💬 ' + idolName;

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
      const greeting = getGreeting(idol);
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

    // 清空快捷回复
    const quickEl = document.getElementById('chat-quick-replies');
    if (quickEl) quickEl.innerHTML = '<span style="font-size:11px;color:var(--text-hint);padding:8px;">对方正在输入...</span>';

    // 模拟爱豆回复（后续接入API后替换）
    setTimeout(async () => {
      const idol = Game.state.idols[idolIndex];
      const response = generateIdolReply(idol, { id: 'custom', text: text, effectMods: {} });
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

    if (aff >= 60) {
      // 高好感度 — 亲密对话
      return [
        { id: 'high-warm', label: '💜 想你了', text: '最近好想你啊～什么时候能见面？' },
        { id: 'high-sweet', label: '💕 甜蜜互动', text: '今天看到你的舞台了，太帅了！心跳加速...' },
        { id: 'high-date', label: '📅 约见面', text: '周末有空吗？有家新开的餐厅想和你一起去' },
        { id: 'high-care', label: '🫂 关心你', text: '听说你最近行程很满，记得好好休息啊' }
      ];
    } else if (aff >= 30) {
      // 中好感度 — 朋友对话
      return [
        { id: 'mid-chat', label: '😊 日常聊天', text: '今天过得怎么样？练习辛苦吗？' },
        { id: 'mid-cheer', label: '📣 应援打气', text: '看到你昨天的直拍了！真的太棒了👏' },
        { id: 'mid-food', label: '🍕 聊吃的', text: '有没有好好吃饭？别只顾着练习忘了吃饭' },
        { id: 'mid-hobby', label: '🎵 聊兴趣', text: '最近在听什么歌？给我推荐几首吧～' }
      ];
    } else {
      // 低好感度 — 礼貌对话
      return [
        { id: 'low-greet', label: '👋 打招呼', text: '你好！最近经常看到你的舞台，真的很棒' },
        { id: 'low-support', label: '📣 粉丝应援', text: '我会一直支持你的！Fighting！💪' },
        { id: 'low-ask', label: '❓ 好奇问问', text: '可以问一下最近有什么回归计划吗？' },
        { id: 'low-nice', label: '🌸 温柔问候', text: '今天天气很好，希望你心情也不错～' }
      ];
    }
  }

  /**
   * 获取首次对话的开场白
   */
  function getGreeting(idol) {
    const aff = idol.stats.affection || 0;
    if (aff >= 60) {
      return Game.Actions.getHonorific(idol.gender) + '！💜 刚想给你发消息你就来了！我们是不是有心电感应？';
    } else if (aff >= 30) {
      return '啊，是你呀～最近经常看到你呢。有什么事吗？';
    } else {
      return '嗯？你是谁啊...（有点困惑）不过谢谢你支持我～';
    }
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
        console.log('[PhoneChat] AI回复失败，使用预设:', e.message);
      }
    }

    // 降级：预设回复逻辑
    const aff = idol.stats.affection || 0;

    if (aff >= 60) {
      const replies = [
        '我也想见你！这周末我应该有空～',
        '你每次都这么会说话...（脸红）不过我很喜欢💜',
        '好啊好啊！就我们两个人吧，不想被别人打扰',
        '嗯嗯，有你在我就放心了。你也要好好照顾自己哦',
        '看到你的消息就是我今天最开心的时刻了！'
      ];
      return replies[Math.floor(Math.random() * replies.length)];
    } else if (aff >= 30) {
      const replies = [
        '谢谢关心！练习是有点累，但有粉丝支持就很开心',
        '哈哈你也看了那个直拍！我自己回看觉得还可以更好',
        '有好好吃饭的！经纪人' + Game.Actions.getHonorific(idol.gender) + '管得很严ㅋㅋ',
        '推荐的话...最近很喜欢听IU前辈的歌，你呢？',
        '你真的很温柔呢，每次聊天都让人心情很好'
      ];
      return replies[Math.floor(Math.random() * replies.length)];
    } else {
      const replies = [
        '谢谢你！我们会继续努力的～',
        '回归计划啊...还不能说呢，不过快了！请期待吧',
        '嗯嗯谢谢支持！Fighting！',
        '你人也太好了吧～粉丝们都好温柔',
        '好的好的，你也加油！'
      ];
      return replies[Math.floor(Math.random() * replies.length)];
    }
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

  // ===== 公开API =====

  return {
    renderContactList,
    renderSecretContact,
    openConversation,
    sendQuickReply,
    sendCustomMessage,
    handleInputKey
  };

})();
