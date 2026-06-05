# Kpop嫂子模拟器 — API对接文档

> 版本：v1.0 | 最后更新：2026-06-06

---

## 一、API基本信息

| 项目 | 内容 |
|------|------|
| **API提供商** | DeepSeek |
| **接口地址** | `https://api.deepseek.com/v1/chat/completions` |
| **认证方式** | Bearer Token（API Key） |
| **模型** | `deepseek-chat` |
| **API Key管理** | 玩家在游戏设置中输入自己的Key，加密存储到浏览器本地 |

---

## 二、API调用封装

### 2.1 基础请求

```javascript
async function callDeepSeek(messages, options = {}) {
  const apiKey = await getApiKey(); // 从本地获取解密后的Key
  if (!apiKey) throw new Error('API Key未设置');

  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: messages,
      temperature: options.temperature ?? 0.8,
      max_tokens: options.maxTokens ?? 500,
      stream: false
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`API错误: ${error.error?.message || response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}
```

### 2.2 错误码处理

| HTTP状态码 | 含义 | 处理方式 |
|-----------|------|---------|
| 200 | 成功 | 正常解析 |
| 401 | API Key无效 | 提示用户检查Key |
| 402 | 余额不足 | 提示充值 |
| 429 | 请求频率限制 | 等待后重试（指数退避） |
| 500 | 服务器错误 | 降级到预设文本 |
| 超时 | 网络问题 | 重试1次，再失败→降级 |

---

## 三、系统提示词设计

### 3.1 聊天对话提示词

```
你是一个Kpop恋爱模拟游戏中的角色。请严格按照以下设定回复消息：

【你的角色设定】
- 姓名：{idolName}
- 性别：{idolGender}
- 所属团体：{idolGroup}
- 性格描述：{idolPersonality}
- 职业：Kpop爱豆（{idolGroup}成员）

【玩家设定】
- 姓名：{playerName}
- 身份：{playerIdentity}
- 性格：{playerPersonality}

【你们的关系】
- 当前阶段：{relationshipStage}（攻略期/恋爱期/结婚）
- 你对玩家的好感度：{affection}/100
- 婚姻状态：{marriageStatus}（仅结婚阶段）

【当前语境】
- 场景：{currentScene}
- 玩家刚才说："{playerMessage}"

【回复要求】
1. 回复必须使用韩语或中文（根据场景），输出统一用中文
2. 语气必须符合性格设定
3. 好感度影响回复温度：<30冷淡/30-60友好/60-80温暖/>80亲昵
4. 如果处于恋爱期，回复可以更亲密
5. 如果处于攻略期且好感度低，回复保持礼貌距离
6. 使用{他/她}和{哥哥/姐姐/欧尼/欧巴}等符合性别的称呼
7. 回复长度控制在1-3句话，像真实聊天消息
8. 不要跳出角色、不要提到"AI"或"游戏"
```

### 3.2 SNS动态生成提示词

```
你是一个Kpop娱乐社交平台的动态生成器。请生成一条符合以下设定的动态：

【发布者】
- 姓名：{idolName}
- 性别：{idolGender}
- 团体：{idolGroup}
- 性格：{idolPersonality}

【动态类型】{postType}（日常/宣传/互动/暗藏狗粮）

【要求】
1. 生成1条动态文字 + 可能的粉丝评论（2-3条）
2. 语气符合爱豆公众形象
3. 使用中文
4. 格式：{ "post": "动态内容", "comments": ["评论1", "评论2"] }
```

### 3.3 新闻生成提示词

```
你是一个Kpop娱乐新闻生成器。请生成一条娱乐新闻：

【相关爱豆】{idolName}（{idolGroup}成员，性别{idolGender}）
【新闻类型】{newsType}（回归/绯闻/综艺/日常/爆料）

【要求】
1. 新闻标题+正文
2. 娱乐媒体口吻
3. 使用中文
4. 如果涉及绯闻，使用{他/她}正确指代
```

### 3.4 结局文本生成提示词

```
你是一个Kpop恋爱模拟游戏的结局叙述者。请为玩家生成结局故事：

【玩家旅程总结】
- 玩家姓名：{playerName}
- 身份：{playerIdentity}
- 性格：{playerPersonality}
- 总回合数：{totalTurns}
- 最终恋人：{finalIdolName}
- 婚姻状态：{marriageStatus}
- 关键事件：{keyEvents}

【结局类型】{endingType}

【要求】
1. 以温暖的第三人称叙述
2. 回顾重要时刻
3. 描述未来的展望
4. 500-800字
5. 使用中文
6. 使用{他/她}正确指代爱豆性别
```

---

## 四、上下文管理

### 4.1 对话历史
- 每次聊天保存最近20轮对话（用户+AI）
- 超过20轮时，保留前2轮 + 后18轮（保留开头和最近）
- 对话历史随存档一起保存

### 4.2 Token控制

| 场景 | max_tokens | temperature |
|------|-----------|-------------|
| 聊天回复 | 300 | 0.8 |
| SNS动态 | 400 | 0.9 |
| 新闻 | 500 | 0.7 |
| 结局文本 | 800 | 0.9 |
| 随机事件 | 600 | 0.85 |

---

## 五、成本控制

### 5.1 估算（单次调用）

| 场景 | 输入Token | 输出Token | 估算成本 |
|------|----------|----------|---------|
| 聊天 | ~500 | ~200 | 极低 |
| SNS | ~300 | ~300 | 极低 |
| 新闻 | ~200 | ~400 | 极低 |
| 结局 | ~800 | ~600 | 低 |

> DeepSeek定价极低，一个完整游戏流程（约100次API调用）预计花费不到1元人民币。

### 5.2 保护措施

- 每次API调用前检查：Key是否有效、今日调用次数
- 自定义输入最长为500字
- 同一回合重复发相同内容不调用API（去重检测）
- 预设选项的对话如无需AI增强，使用预写回复

---

## 六、降级方案

当API不可用时，使用本地预设文本库：

### 6.1 聊天降级
预设模板根据：
- 好感度区间（低/中/高）
- 关系阶段（攻略/恋爱/结婚）
- 场景类型（日常/约会/查岗/吵架）

### 6.2 SNS降级
预设动态库（20+条，随机抽取）

### 6.3 新闻降级
预设新闻库（15+条，按类型分类）

### 6.4 结局降级
AI不可用时，使用模板拼合结局文本。

---

## 七、安全注意事项

- API Key使用简单的base64编码存储（非真正加密，但防止明文暴露）
- 提示用户：Key仅存储在浏览器本地，不上传任何服务器
- 网络请求仅在用户主动操作时发起
- 不收集任何用户数据
