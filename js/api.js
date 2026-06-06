/**
 * DeepSeek API 对接模块
 * 负责：API调用封装、聊天AI、身份分析AI、降级方案
 * 依赖：Game.Actions（getHonorific）、Game.Storage（getApiKey）
 */

Game.API = (() => {

  // ===== 配置常量 =====

  const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/v1/chat/completions';
  const MODEL = 'deepseek-chat';
  const REQUEST_TIMEOUT = 15000; // 15秒超时

  /**
   * 开发者默认API Key（base64编码）
   * 替换方法：运行 btoa('your-deepseek-api-key') 在浏览器控制台，将结果粘贴到这里
   * 留空则不提供默认Key，玩家需自行设置
   */
  const DEFAULT_KEY_BASE64 = 'c2stYTEyODZlOWQ3MmFiNDQ1Njk4M2M4ZjA1MmM5ZmU3N2Y='; // 开发者默认Key

  /**
   * 上次API调用时间戳（防刷保护）
   */
  let _lastCallTime = 0;
  const MIN_CALL_INTERVAL = 1500; // 两次调用至少间隔1.5秒

  /**
   * 每日调用计数
   */
  let _dailyCallCount = 0;
  const MAX_DAILY_CALLS = 200;
  let _dailyResetDate = new Date().toDateString();

  // ===== 身份分析预设修正表（API失败时降级使用） =====

  const PRESET_IDENTITY_MODIFIERS = {
    // 粉丝类身份
    '站姐':   { affectionBonus: 5,  suspicionMod: 8,  staminaMod: 2,  charmBonus: 0,  stressResist: 0 },
    '私生饭': { affectionBonus: -5, suspicionMod: 15, staminaMod: 5,  charmBonus: -5, stressResist: 10 },
    '粉丝':   { affectionBonus: 2,  suspicionMod: 2,  staminaMod: 0,  charmBonus: 0,  stressResist: 0 },
    '路人粉': { affectionBonus: -2, suspicionMod: 0,  staminaMod: 0,  charmBonus: 0,  stressResist: 0 },

    // 行业相关
    '记者':   { affectionBonus: -5, suspicionMod: 12, staminaMod: 3,  charmBonus: 0,  stressResist: 5 },
    '造型师': { affectionBonus: 8,  suspicionMod: 3,  staminaMod: 5,  charmBonus: 5,  stressResist: 0 },
    '化妆师': { affectionBonus: 5,  suspicionMod: 2,  staminaMod: 3,  charmBonus: 3,  stressResist: 0 },
    '编舞家': { affectionBonus: 5,  suspicionMod: 1,  staminaMod: 8,  charmBonus: 2,  stressResist: 0 },
    '经纪人': { affectionBonus: 3,  suspicionMod: 5,  staminaMod: 10, charmBonus: -3, stressResist: 8 },
    '制作人': { affectionBonus: 3,  suspicionMod: 3,  staminaMod: 8,  charmBonus: 0,  stressResist: 5 },

    // 普通职业
    '上班族': { affectionBonus: 0,  suspicionMod: 0,  staminaMod: 5,  charmBonus: 0,  stressResist: 5 },
    '学生':   { affectionBonus: 2,  suspicionMod: -2, staminaMod: -2,  charmBonus: 0,  stressResist: -5 },
    '自由职业': { affectionBonus: 0, suspicionMod: -3, staminaMod: -5,  charmBonus: 3,  stressResist: -3 },
    '练习生': { affectionBonus: 5,  suspicionMod: 3,  staminaMod: 10, charmBonus: 5,  stressResist: 8 },

    // 默认
    '素人':   { affectionBonus: 0,  suspicionMod: 0,  staminaMod: 0,  charmBonus: 0,  stressResist: 0 }
  };

  // ===== 工具函数 =====

  /**
   * 获取当前可用的API Key
   * 优先级：玩家自定义Key > 开发者默认Key
   * @returns {string|null}
   */
  function getActiveApiKey() {
    // 优先使用玩家自行设置的Key
    try {
      const playerKey = Game.Storage.getApiKey();
      if (playerKey && playerKey.trim()) {
        return playerKey.trim();
      }
    } catch (e) {
      // Storage模块可能未就绪
    }

    // 使用开发者默认Key
    if (DEFAULT_KEY_BASE64) {
      try {
        const decoded = atob(DEFAULT_KEY_BASE64);
        if (decoded && decoded.trim()) {
          return decoded.trim();
        }
      } catch (e) {
        console.warn('[API] 开发者默认Key解码失败');
      }
    }

    return null;
  }

  /**
   * 是否有任何可用的API Key
   * @returns {boolean}
   */
  function hasAnyKey() {
    return !!getActiveApiKey();
  }

  /**
   * 检查调用频率限制
   * @returns {string|null} 限制原因，null表示可以调用
   */
  function checkRateLimit() {
    // 重置每日计数
    const today = new Date().toDateString();
    if (today !== _dailyResetDate) {
      _dailyCallCount = 0;
      _dailyResetDate = today;
    }

    // 频率限制
    const now = Date.now();
    if (now - _lastCallTime < MIN_CALL_INTERVAL) {
      return '请求太频繁，请稍后再试';
    }

    // 每日上限
    if (_dailyCallCount >= MAX_DAILY_CALLS) {
      return '今日API调用次数已达上限（' + MAX_DAILY_CALLS + '次）';
    }

    return null;
  }

  /**
   * 从AI回复中提取JSON（处理可能在markdown代码块中的情况）
   */
  function extractJSON(text) {
    if (!text) return null;
    // 尝试匹配 ```json ... ``` 或直接 {...}
    const codeBlock = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlock) {
      try { return JSON.parse(codeBlock[1]); } catch (e) { /* 继续 */ }
    }
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try { return JSON.parse(jsonMatch[0]); } catch (e) { /* 继续 */ }
    }
    return null;
  }

  /**
   * 验证并钳制身份修正值
   */
  function validateModifiers(mods) {
    if (!mods || typeof mods !== 'object') return null;
    const keys = ['affectionBonus', 'suspicionMod', 'staminaMod', 'charmBonus', 'stressResist'];
    const result = {};
    for (const k of keys) {
      const v = Number(mods[k]);
      result[k] = isNaN(v) ? 0 : Math.max(-20, Math.min(20, Math.round(v)));
    }
    return result;
  }

  // ===== 核心API调用 =====

  /**
   * 调用DeepSeek Chat API
   * @param {Array} messages - [{role, content}] 格式的消息数组
   * @param {Object} options - {temperature, maxTokens}
   * @returns {Promise<string>} AI回复文本
   * @throws {Error} 各种错误情况
   */
  async function callDeepSeek(messages, options = {}) {
    const { temperature = 0.8, maxTokens = 300 } = options;

    // 检查Key
    const apiKey = getActiveApiKey();
    if (!apiKey) {
      throw new Error('NO_API_KEY');
    }

    // 检查频率限制
    const rateLimitError = checkRateLimit();
    if (rateLimitError) {
      throw new Error('RATE_LIMIT: ' + rateLimitError);
    }

    // 记录调用
    _lastCallTime = Date.now();
    _dailyCallCount++;

    // 创建AbortController用于超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      const response = await fetch(DEEPSEEK_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + apiKey
        },
        body: JSON.stringify({
          model: MODEL,
          messages: messages,
          temperature: temperature,
          max_tokens: maxTokens,
          stream: false
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // HTTP错误处理
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        switch (response.status) {
          case 401:
            throw new Error('AUTH_ERROR: API Key无效，请检查Key是否正确');
          case 402:
            throw new Error('BALANCE_ERROR: API余额不足，请充值');
          case 429:
            throw new Error('RATE_ERROR: 请求过于频繁，请稍后再试');
          case 500:
          case 502:
          case 503:
            throw new Error('SERVER_ERROR: API服务器暂时不可用');
          default:
            throw new Error('HTTP_ERROR: ' + response.status + ' ' + errorText);
        }
      }

      const data = await response.json();

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('RESPONSE_ERROR: API返回格式异常');
      }

      return data.choices[0].message.content;

    } catch (e) {
      clearTimeout(timeoutId);

      // AbortError → 超时
      if (e.name === 'AbortError') {
        throw new Error('TIMEOUT: API请求超时（' + (REQUEST_TIMEOUT / 1000) + '秒）');
      }

      // 网络错误，重试一次
      if (e.message && e.message.startsWith('TypeError') && e.message.includes('fetch')) {
        console.log('[API] 网络错误，1秒后重试...');
        await new Promise(r => setTimeout(r, 1000));
        try {
          const retryResponse = await fetch(DEEPSEEK_ENDPOINT, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + apiKey
            },
            body: JSON.stringify({
              model: MODEL,
              messages: messages,
              temperature: temperature,
              max_tokens: maxTokens,
              stream: false
            })
          });
          if (retryResponse.ok) {
            const retryData = await retryResponse.json();
            return retryData.choices[0].message.content;
          }
        } catch (retryErr) {
          // 重试也失败，继续抛出原始错误
        }
      }

      throw e;
    }
  }

  // ===== 聊天AI =====

  /**
   * 构建聊天系统提示词
   * @param {Object} idol - 爱豆对象
   * @param {Object} player - 玩家对象
   * @returns {string} 系统提示词
   */
  function buildChatSystemPrompt(idol, player) {
    const honorific = Game.Actions.getHonorific(idol.gender);
    const stageLabels = { pursuit: '攻略期', dating: '恋爱期', married: '已婚' };
    const stage = stageLabels[idol.relationshipStage] || '攻略期';
    const genderText = idol.gender === 'male' ? '男' : '女';

    return `你是Kpop恋爱模拟游戏中的角色。请严格按照以下设定回复消息：

【你的角色】
- 姓名：${idol.name}${idol.nickname ? '（' + idol.nickname + '）' : ''}
- 性别：${genderText}
- 所属团体：${idol.group || '未公开'}
- 性格：${idol.personalityTags ? idol.personalityTags.join('、') : '未设定'}${idol.personalityCustom ? ' / ' + idol.personalityCustom : ''}
- 职业：Kpop爱豆${idol.group ? '（' + idol.group + '成员）' : ''}

【对方（玩家）】
- 姓名：${player.name || '未设定'}
- 身份：${player.identity || '未设定'}
- 性格：${player.personality || '未设定'}

【你们的关系】
- 阶段：${stage}
- 玩家对你的好感度：${idol.stats.affection}/100

【回复要求】
1. 使用中文回复（可以夹杂简单韩语语气词如ㅋㅋ、ㅠㅠ、~等）
2. 语气严格符合你的性格：${idol.personalityTags ? idol.personalityTags.join('、') : ''}
3. 好感度影响态度：<30礼貌疏离 / 30-60友好温暖 / 60-80亲密关心 / >80深情依赖
4. 称呼玩家时用"${honorific}"（韩语敬称，对应性别：${genderText}）
5. 1-3句话，像真实的手机聊天消息（不要太长）
6. 不要跳出角色扮演，不要说自己是AI或提到这是游戏
7. 可以适当使用颜文字和emoji（符合角色性格即可）`;
  }

  /**
   * 生成AI聊天回复
   * @param {Object} idol - 目标爱豆对象
   * @param {string} playerMessage - 玩家发送的消息
   * @param {Array} history - 历史消息数组 [{from, text, time}, ...]
   * @returns {Promise<string|null>} AI回复文本，失败返回null
   */
  async function generateChatReply(idol, playerMessage, history) {
    if (!idol || !playerMessage) return null;

    const player = Game.state.player;
    if (!player) return null;

    // 构建系统提示词
    const systemPrompt = buildChatSystemPrompt(idol, player);

    // 构建消息数组
    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    // 添加近期对话历史（最近40条 = 20轮对话）
    if (history && history.length > 0) {
      const recent = history.slice(-40);
      for (const msg of recent) {
        if (msg.from === 'me') {
          messages.push({ role: 'user', content: msg.text });
        } else {
          messages.push({ role: 'assistant', content: msg.text });
        }
      }
    }

    // 添加当前玩家消息
    messages.push({ role: 'user', content: playerMessage });

    // 根据好感度调整temperature（好感度越高越温暖）
    const aff = idol.stats.affection || 0;
    let temperature = 0.8;
    if (aff < 30) temperature = 0.5;   // 低好感：更克制
    else if (aff < 60) temperature = 0.7; // 中等：友好
    else if (aff < 80) temperature = 0.85; // 较高：温暖
    else temperature = 0.9;              // 很高：深情

    try {
      const reply = await callDeepSeek(messages, {
        temperature: temperature,
        maxTokens: 300
      });
      if (reply && reply.trim()) {
        console.log('[API] 聊天AI回复成功 (' + reply.length + '字)');
        return reply.trim();
      }
      return null;
    } catch (e) {
      // 降级：返回null，由调用方使用预设回复
      if (e.message.startsWith('AUTH_ERROR') || e.message.startsWith('BALANCE_ERROR')) {
        console.warn('[API] Key问题，使用预设回复:', e.message);
      } else if (e.message.startsWith('TIMEOUT')) {
        console.warn('[API] 超时，使用预设回复');
      } else if (e.message === 'NO_API_KEY') {
        // 没有Key是正常情况，不打印警告
      } else {
        console.warn('[API] 聊天回复生成失败，使用预设:', e.message);
      }
      return null;
    }
  }

  // ===== 身份分析AI =====

  /**
   * 构建身份分析提示词
   */
  function buildIdentityPrompt(identityText, personalityText) {
    return `你是一个角色分析专家。请分析以下人物的身份和性格，输出一个JSON对象，包含5个数值修正（范围-20到+20）：

【人物信息】
身份：${identityText}
性格：${personalityText}

【修正项说明】
- affectionBonus: 好感获取加成（正数=爱豆更容易对ta产生好感，如造型师+8，记者-5）
- suspicionMod: 嫌疑度修正（正数=更容易被媒体/公司怀疑，如私生饭+15，素人0）
- staminaMod: 体力消耗修正（正数=行动消耗更多体力，如练习生+10，学生-2）
- charmBonus: 魅力获取加成（正数=更容易提升魅力值，如造型师+5，经纪人-3）
- stressResist: 压力抵抗（正数=更抗压，如经纪人+8，学生-5更易焦虑）

【分析原则】
1. 职业越靠近娱乐圈核心，嫌疑度越高
2. 体力消耗大的职业，stamina修正越高
3. 越有资源/地位的职业，魅力加成越高
4. 工作压力大或需要抗压的职业，压力抵抗越高
5. 粉丝类身份好感加成较低，圈内人身份好感加成较高

请只输出JSON，不要其他文字：
{"affectionBonus": 0, "suspicionMod": 0, "staminaMod": 0, "charmBonus": 0, "stressResist": 0}`;
  }

  /**
   * 在预设表中模糊匹配身份
   * @param {string} identityText - 身份文本
   * @returns {Object|null} 匹配到的修正值，或null
   */
  function matchPresetIdentity(identityText) {
    if (!identityText) return null;
    // 精确匹配
    if (PRESET_IDENTITY_MODIFIERS[identityText]) {
      return PRESET_IDENTITY_MODIFIERS[identityText];
    }
    // 模糊匹配：遍历预设键，看身份文本是否包含这些键
    for (const [key, mods] of Object.entries(PRESET_IDENTITY_MODIFIERS)) {
      if (key !== '素人' && identityText.includes(key)) {
        return mods;
      }
    }
    // 返回默认值（素人）
    return PRESET_IDENTITY_MODIFIERS['素人'];
  }

  /**
   * 分析玩家身份，返回数值修正
   * @param {string} identityText - 身份文本（标签+自定义）
   * @param {string} personalityText - 性格文本
   * @returns {Promise<Object>} 修正值对象
   */
  async function analyzeIdentity(identityText, personalityText) {
    if (!identityText) {
      return PRESET_IDENTITY_MODIFIERS['素人'];
    }

    // 先尝试预设匹配
    const preset = matchPresetIdentity(identityText);
    // 如果精确匹配到非默认预设，直接使用（节省API调用）
    if (preset && preset !== PRESET_IDENTITY_MODIFIERS['素人']) {
      console.log('[API] 身份"' + identityText + '"命中预设:', preset);
      return preset;
    }

    // 自定义身份 → 调用API分析
    const prompt = buildIdentityPrompt(identityText, personalityText);

    try {
      const result = await callDeepSeek(
        [{ role: 'user', content: prompt }],
        { temperature: 0.3, maxTokens: 200 }
      );

      const parsed = extractJSON(result);
      if (parsed) {
        const validated = validateModifiers(parsed);
        console.log('[API] 身份分析完成:', validated);
        return validated;
      }
    } catch (e) {
      console.warn('[API] 身份分析失败，使用预设:', e.message);
    }

    // 降级：返回模糊匹配的预设或素人默认值
    return preset || PRESET_IDENTITY_MODIFIERS['素人'];
  }

  /**
   * 测试API连接
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async function testConnection() {
    if (!hasAnyKey()) {
      return { success: false, message: '未设置API Key' };
    }

    try {
      const result = await callDeepSeek(
        [{ role: 'user', content: '你好，请回复"连接成功"两个字。' }],
        { temperature: 0.1, maxTokens: 10 }
      );
      if (result && result.includes('连接成功')) {
        return { success: true, message: '✅ API连接正常' };
      }
      return { success: true, message: '✅ API响应正常（但返回内容异常）' };
    } catch (e) {
      return { success: false, message: '❌ 连接失败: ' + e.message };
    }
  }

  /**
   * 获取今日API调用统计
   */
  function getUsageStats() {
    const today = new Date().toDateString();
    if (today !== _dailyResetDate) {
      _dailyCallCount = 0;
      _dailyResetDate = today;
    }
    return {
      dailyCalls: _dailyCallCount,
      maxDailyCalls: MAX_DAILY_CALLS,
      date: _dailyResetDate
    };
  }

  // ===== 公开API =====
  return {
    callDeepSeek,
    getActiveApiKey,
    hasAnyKey,
    buildChatSystemPrompt,
    generateChatReply,
    analyzeIdentity,
    testConnection,
    getUsageStats,
    // 暴露预设表供外部参考
    PRESET_IDENTITY_MODIFIERS
  };

})();
