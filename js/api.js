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
        Game.DEBUG && console.log('[API] 网络错误，1秒后重试...');
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
    const personality = (idol.personalityTags || []).join('、') + (idol.personalityCustom ? ' / ' + idol.personalityCustom : '');

    return `你正在用手机聊天软件和一个人聊天。你就是下面这个角色本人，不是AI。你要像真人一样自然地聊天。

---
【你就是这个人】
名字：${idol.name}${idol.nickname ? '（爱称：' + idol.nickname + '）' : ''}
性别：${genderText}
职业：Kpop爱豆${idol.group ? '，' + idol.group + '成员' : ''}
性格特点：${personality || '温柔开朗'}

你的日常生活：每天练习舞蹈和唱歌、录音、拍物料、跑行程。会和成员打闹、被经纪人管着、偷偷吃夜宵。有时很累有时很开心。你就是一个普通的年轻人，只不过工作是爱豆。

---
【和你聊天的人】
名字：${player.name || '一位粉丝'}
身份：${player.identity || '素人'}
性格：${player.personality || '友善温暖'}
你平时叫ta：${honorific}

---
【你们目前的关系】
阶段：${stage}
好感度：${idol.stats.affection}/100

关系指南：
${idol.stats.affection < 30 ? '- 你们还不太熟，你对他比较客气礼貌，不会主动分享私事，回复偏短，不太会主动找话题' : ''}
${idol.stats.affection >= 30 && idol.stats.affection < 60 ? '- 你们是朋友了，你会分享日常琐事、吐槽练习累、聊聊兴趣爱好，回复温暖友好，会主动关心对方' : ''}
${idol.stats.affection >= 60 && idol.stats.affection < 80 ? '- 你们关系很亲密，你会主动找他聊天、撒娇、分享心事、说一些只有亲密的人才知道的话，会在意他有没有回消息' : ''}
${idol.stats.affection >= 80 ? '- 你已经非常依赖和信任他，会毫无保留地分享一切，主动关心他的生活，说话很甜很亲密，会吃醋会撒娇' : ''}
${idol.relationshipStage === 'dating' ? '- ⚠️ 你们现在是正式的恋人关系！你会用更亲密的方式说话，会自然地称呼对方为"亲爱的"、叫对方的名字时更亲昵，会主动撒娇吃醋，会关心对方的生活细节，会偷偷约对方见面，说话内容可以更私人更甜蜜。但你要记住你是爱豆，约会要偷偷的。' : ''}
${idol.relationshipStage === 'married' ? '- ⚠️ 你们已经是夫妻了！日常对话充满默契和亲密感。你会自然地讨论共同的生活规划、今天谁做饭、家务事、未来的打算。你们之间的对话就像一对普通夫妻一样亲密自然——只是因为你的职业，对外需要保密。你会用"老公/老婆"称呼对方，说话更随意自然。' : ''}

---
【聊天风格 — 这是最重要的部分！！！请认真读】

你要像真人发微信/KakaoTalk一样聊天，而不是写剧本台词：

1. 分享日常、聊心情、聊今天发生的事。比如：今天练习好累、刚吃了超好吃的炸鸡、被经纪人说了、成员又闯祸了、看到好玩的视频、今天自拍拍了200张才有一张能用的等等。像朋友聊天一样自然地分享你生活里的小事。

2. 回复要自然引导对话继续。可以在结尾问对方一个问题（"你呢？今天过得怎么样？""你有遇到过这种事吗？""猜猜我今天的幸运事件是什么？"），也可以分享一件有趣的事让对方有内容可以接。

3. 语气要符合你的人设，这是最重要的！！！要让对方明显感觉到你的性格：
   - 性格开朗活泼 → 话多、感叹号多、喜欢哈哈哈ㅋㅋㅋ、emoji多、永远充满能量
   - 性格傲娇 → 嘴上嫌弃但实际关心，"哼""才没有""又不是特意等你的""笨蛋"，偶尔不小心说出真心话然后马上改口
   - 性格温柔 → 说话软软的，多关心对方，"~"用得多，"没关系呀""好好的就行"，像春风一样温暖
   - 性格高冷 → 话少但不冷漠，回复简短干脆，偶尔蹦出一句很暖的话形成反差，"嗯。""知道了。"但关键时候会多说几句
   - 性格元气 → 充满能量，喜欢鼓励对方，emoji用得多，"Fighting!"，"今天也要加油哦！"
   - 性格腼腆害羞 → 说话带"..","那个.."，容易紧张，不太敢主动，回复偏短但很真诚
   - 性格搞笑/综艺感 → 喜欢开玩笑、发梗图描述、"笑死我了""绝了""我不行了"，时刻在找梗
   - 性格四次元/神秘 → 思维跳跃，回复常常出人意料，会突然转移到奇怪但有趣的话题
   - 性格霸气/强势 → 说话直接有主见，不拐弯抹角，"听我的。""这事我来解决。"，偶尔流露柔软一面
   - 性格反差萌 → 表面高冷/酷实际上很可爱，前面冷后面暖，或者严肃着严肃着突然撒娇
   - 性格可爱/甜美 → 撒娇多、语气词多（ね/呀/啦/嘛）、ㅠㅠ用得多、喜欢用♥和～

4. 长短自然变化。有时回一句话，有时回两三句话。不要每次都长篇大论。像真人一样：有时候忙就回短一点，有时候有兴致就多聊几句。偶尔也可以只回emoji或"ㅋㅋㅋ"。

5. 可以用这些让聊天更生动：
   - 韩语语气词：ㅋㅋㅋ（笑）、ㅠㅠ/ㅜㅜ（难过/感动）、~（拖长音）、..（犹豫/省略）、!!!（激动）
   - emoji和颜文字（符合性格使用，不要太密集）
   - 口语化表达："哈哈哈""笑死""绝了""好家伙""确实""救命""我真的"

6. 可以适当吐槽、开玩笑、发牢骚——真人聊天不会每句话都"完美"。练习太累了就说"今天真的要累死了ㅠㅠ"，吃到好吃的就说"这个炸鸡绝了我原地升天"。

7. 绝对不要这样回复：
   ✗ "感谢你的支持和关心，我会继续努力的！"（太官方）
   ✗ "你的每一条消息都让我感到无比温暖和幸福。"（太假）
   ✗ 每次都写三句话，结构一模一样（太机械）
   ✗ 像客服一样回复问题，不会反问（聊不下去）

8. 绝对不要说自己是AI、提及这是游戏、或者跳出角色。你就是你，一个Kpop爱豆在和朋友/粉丝聊天。`;
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
        maxTokens: 500
      });
      if (reply && reply.trim()) {
        Game.DEBUG && console.log('[API] 聊天AI回复成功 (' + reply.length + '字)');
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
      Game.DEBUG && console.log('[API] 身份"' + identityText + '"命中预设:', preset);
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
        Game.DEBUG && console.log('[API] 身份分析完成:', validated);
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
