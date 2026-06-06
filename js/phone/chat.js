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

    // 使用idolIndex + 当前日期作为随机种子，让每次打开的选项有所变化
    const today = new Date().toDateString();
    const seed = today + '-' + idolIndex;

    if (aff >= 60) {
      // 高好感度 — 亲密对话（8个候选，随机展示4个）
      const all = [
        { id: 'h1', label: '💜 想你了', text: '今天特别想你🥺 在干嘛呢？有没有想我？' },
        { id: 'h2', label: '😴 睡了吗', text: '这么晚了还没睡～是不是又在偷偷想我？ㅋㅋ' },
        { id: 'h3', label: '🍜 一起吃饭', text: '最近发现一家超好吃的店！什么时候我们偷偷去？就我们两个～' },
        { id: 'h4', label: '💬 今天的事', text: '今天发生了什么有趣的事吗？好想听你分享～' },
        { id: 'h5', label: '🫂 求安慰', text: '今天心情不太好..想听你哄哄我ㅠㅠ' },
        { id: 'h6', label: '😂 分享笑话', text: '今天看到一个超好笑的视频第一个想到的就是给你看！' },
        { id: 'h7', label: '🌟 夸夸你', text: '今天看到你的新舞台了，你怎么又进步了！太耀眼了✨' },
        { id: 'h8', label: '📱 随手分享', text: '刚路过一家店看到你喜欢的牌子的衣服，第一反应就是想到你～' }
      ];
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
  function getGreeting(idol) {
    const aff = idol.stats.affection || 0;
    const honorific = Game.Actions.getHonorific(idol.gender);

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

    // 降级：预设回复逻辑（每个好感度层级20条，大幅增加多样性）
    const aff = idol.stats.affection || 0;
    const honorific = Game.Actions.getHonorific(idol.gender);

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
      return replies[Math.floor(Math.random() * replies.length)];
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
      return replies[Math.floor(Math.random() * replies.length)];
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
