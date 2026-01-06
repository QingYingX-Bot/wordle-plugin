import { GameBase } from './base.js';

/**
 * 单词游戏核心逻辑模块
 */
class WordGame extends GameBase {
  constructor() {
    super();
    // 正则表达式定义
    this.REGEX_WORD_CMD = /^#[Ww]ord(.*)$/i;
    this.REGEX_ALPHA = /^[a-zA-Z]+$/;
    
    // 单词游戏尝试次数配置（根据字母数）
    this.adaptiveAttempts = {
      3: 5,
      4: 6,
      5: 8,
      6: 8,
      7: 10,
      8: 12,
      9: 13,
      10: 15
    };
  }
  
  /**
   * 监听所有消息，用于游戏进行中的直接猜测（支持群聊和私聊）
   * @param {*} e - 消息事件对象
   * @returns {Promise<boolean>} - 处理结果
   */
  async listenMessages(e) {
    const { groupId, userId, gameKey } = this._getGameContext(e);
    if (!gameKey) {
      return false;
    }

    if (!e.msg || typeof e.msg !== 'string') {
      return false;
    }
    
    let message = e.msg.trim();
    const prefixes = ['#','!','！'];
    let prefix = '';
    for (const p of prefixes) {
      if (message.startsWith(p)) {
        prefix = p;
        message = message.substring(1);
        break;
      }
    }
    
    // 检查是否是数学命令
    if (message.match(/^(?:数学|公式|math)/i)) {
      return false; // 让 math 方法处理
    }
    
    // 检查是否是 word 命令
    if (message.match(/^word/i)) {
      return false; // 让 word 方法处理
    }
    
    message = message.toLowerCase();
    
    const cooldownKey = gameKey ? `${gameKey}_${userId}` : `${userId}`;
    const lastGuess = this.userCooldowns.get(cooldownKey);
    const now = Date.now();
    
    // 群聊冷却（私聊不需要群冷却）
    if (groupId) {
      const lastGroupGuess = this.groupCooldowns.get(groupId);
      if (lastGroupGuess && (now - lastGroupGuess) < this.groupcooldownTime) {
        const remainingTime = Math.ceil((this.groupcooldownTime - (now - lastGroupGuess)) / 1000);
        await e.reply(`停停停，你俩什么默契\n（群冷却中，还剩 ${remainingTime} 秒）`, false, {recallMsg: 60});
        return true;
      }
    }
    
    if (lastGuess && (now - lastGuess) < this.personcooldownTime) {
      const remainingTime = Math.ceil((this.personcooldownTime - (now - lastGuess)) / 1000);
      await e.reply(`我知道你很急，但你先别急\n（个人冷却中，还剩 ${remainingTime} 秒）`, false, {recallMsg: 60});
      return true;
    }
    
    const currentGame = await this.utils.db.getGameData(groupId, userId);
    if (!currentGame || currentGame.finished) {
      return false;
    }
    
    // 只处理单词游戏
    if (currentGame.gameType === 'equation') {
      return false;
    }
    
    if (!prefix) {
      return false;
    }
    
    // 验证输入为纯英文单词
    if (!this.REGEX_ALPHA.test(message)) {
      await e.reply('请输入纯英文单词', false, {recallMsg: 60});
      return true;
    }
    const expectedLength = currentGame.letterCount || 5;
    if (message.length !== expectedLength) {
      return true;
    }
    
    this.userCooldowns.set(cooldownKey, now);
    if (groupId) {
      this.groupCooldowns.set(groupId, now);
    }
    return await this.processGuess(e, message, groupId, 'word', userId);
  }
  
  /**
   * Word主函数
   * @param {*} e - 消息事件对象
   * @returns {Promise<boolean>} - 处理结果
   */
  async wordle(e) {
    const originalMsg = e.msg.toLowerCase();
    const { groupId } = this._getGameContext(e);
    if (originalMsg.includes('答案') || originalMsg.includes('ans') || originalMsg.includes('放弃')) {
      return await this.giveUpGame(e);
    }
    const match = e.msg.match(this.REGEX_WORD_CMD);
    let input = match && match[1] ? match[1].trim().toLowerCase() : '';
    if (input.includes('帮助') || input.includes('help')) {
      return await this.showHelp(e);
    }
    if (input.includes('词库') || input.includes('词典') || input.includes('wordbank')) {
      return await this.selectWordbank(e);
    }
    if (!input) {
      // 随机选择3-10之间的字母数
      return await this.startNewGameWithRandomLetterCount(e);
    }
    const numberMatch = input.match(/^\d+$/);
    if (numberMatch) {
      const letterCount = parseInt(numberMatch[0]);
      if (letterCount >= 3 && letterCount <= 10) {
        return await this.startNewGame(e, letterCount);
      } else {
        await e.reply('请输入3-10之间的字母数！');
        return true;
      }
    }
    if (/^[a-z]+$/.test(input)) {
      const { groupId: wordGroupId, userId: wordUserId } = this._getGameContext(e);
      const currentGame = await this.utils.db.getGameData(wordGroupId, wordUserId);
      const expectedLength = currentGame ? currentGame.letterCount : 5;
      if (input.length === expectedLength) {
        return await this.processGuess(e, input, wordGroupId, 'word', wordUserId);
      } else {
        await e.reply(`请输入${expectedLength}个字母的单词！`);
        return true;
      }
    }
    
    return await this.showHelp(e);
  }
  
  /**
   * 使用随机字母数开始新游戏
   * @param {*} e - 消息事件对象
   * @returns {Promise<boolean>} - 处理结果
   */
  async startNewGameWithRandomLetterCount(e) {
    const { groupId, userId } = this._getGameContext(e);
    const existingGame = await this.utils.db.getGameData(groupId, userId);
    if (existingGame && !existingGame.finished) {
      const context = groupId ? '群聊' : '私聊';
      await e.reply(`当前${context}已经有一个进行中的游戏了哦！请先完成当前游戏或使用 "#word 答案" 或 "#word ans" 结束游戏。`);
      return true;
    }
    
    // 随机选择3-10之间的字母数，如果失败则尝试其他字母数
    const availableCounts = [3, 4, 5, 6, 7, 8, 9, 10];
    // 打乱顺序
    const shuffledCounts = availableCounts.sort(() => Math.random() - 0.5);
    
    for (const letterCount of shuffledCounts) {
      const targetWord = await this.utils.word.getRandomWord(letterCount, groupId);
      if (targetWord) {
        return await this.startNewGame(e, letterCount, targetWord);
      }
    }
    
    // 如果所有字母数都失败，返回错误
    await e.reply('词汇表中没有可用的单词，请检查词典配置。');
    return true;
  }

  /**
   * 开始新游戏
   * @param {*} e - 消息事件对象
   * @param {number} letterCount - 字母数量
   * @param {string} targetWord - 可选的目标单词（如果已获取则直接使用，避免重复调用）
   * @returns {Promise<boolean>} - 处理结果
   */
  async startNewGame(e, letterCount = 5, targetWord = null) {
    const { groupId, userId } = this._getGameContext(e);
    const existingGame = await this.utils.db.getGameData(groupId, userId);
    if (existingGame && !existingGame.finished) {
      const context = groupId ? '群聊' : '私聊';
      await e.reply(`当前${context}已经有一个进行中的游戏了哦！请先完成当前游戏或使用 "#word 答案" 或 "#word ans" 结束游戏。`);
      return true;
    }
    // 如果未提供目标单词，则获取一个
    if (!targetWord) {
      targetWord = await this.utils.word.getRandomWord(letterCount, groupId);
      if (!targetWord) {
        await e.reply(`词汇表中没有${letterCount}个字母的单词！请尝试其他字母数量。`);
        return true;
      }
    }
    const maxAttempts = this.adaptiveAttempts[letterCount] || 6;
    const currentDict = await this.utils.db.getWordbankSelection(groupId);
    const availableDicts = await this.utils.word.getAvailableDictionaries();
    const currentDictInfo = availableDicts.find(dict => dict.id === currentDict) || availableDicts[0];
    const wordbankName = currentDictInfo.name;
    
    // 初始化游戏数据
    const gameData = {
      targetWord: targetWord,
      guesses: [],
      attempts: 0,
      maxAttempts: maxAttempts,
      finished: false,
      startTime: Date.now(),
      letterCount: letterCount,
      participants: {}
    };
    // 保存游戏数据
    await this.utils.db.saveGameData(groupId, gameData, userId);
    
    // 使用渲染器渲染游戏界面
    const renderData = {
      targetWord: targetWord,
      guesses: [],
      attempts: 0,
      maxAttempts: maxAttempts,
      finished: false,
      gameState: 'playing'
    };
    
    const img = await this.utils.renderer.renderGame(e, renderData);
    if (img) {
      const gameStartMessage = [
        `单词猜词游戏开始啦！
`,
        `当前词库：${wordbankName}
`,
        img
      ];
      await e.reply(gameStartMessage);
    } else{
      logger.error("游戏图片渲染失败")
      throw new Error("游戏出现错误，请检查必要依赖是否安装，或反馈错误");
    }
    
    return true;
  }
  
  /**
   * 处理猜测
   * @param {*} e - 消息事件对象
   * @param {string} guess - 猜测的单词
   * @param {string} groupId - 群组ID
   * @param {string} gameType - 游戏类型：'word'
   * @returns {Promise<boolean>} - 处理结果
   */
  async processGuess(e, guess, groupId, gameType = 'word', userId = null) {
    const { groupId: actualGroupId, userId: actualUserId } = this._getGameContext(e);
    const finalGroupId = groupId || actualGroupId;
    const finalUserId = userId || actualUserId;
    
    let currentGame = await this.utils.db.getGameData(finalGroupId, finalUserId);
    if (!currentGame || currentGame.finished) {
      const context = finalGroupId ? '群聊' : '私聊';
      await e.reply(`当前${context}没有进行中的游戏！请先发送 "#word" 开始游戏。`);
      return true;
    }
    
    // 验证猜测
    const isValid = await this.utils.word.isValidWord(guess, currentGame.letterCount, groupId);
    if (!isValid) {
      return true;
    }
    
    const currentUserId = this._getUserId(e);
    const nickname = this._getDisplayName(e);
    
    if (!currentGame.participants || typeof currentGame.participants !== 'object') {
      currentGame.participants = {};
    }
    if (currentUserId) {
      currentGame.participants[currentUserId] = {
        nickname
      };
    }
    
    currentGame.guesses.push(guess);
    currentGame.attempts++;
    const isWin = guess.trim() === currentGame.targetWord.trim();
    currentGame.finished = isWin || currentGame.attempts >= currentGame.maxAttempts;
    await this.utils.db.saveGameData(finalGroupId, currentGame, finalUserId);

    // 预计算所有轮次的结果，避免在渲染阶段重复计算
    const results = (currentGame.guesses || []).map(g => 
      this.utils.checkGuess(g, currentGame.targetWord, 'word')
    );

    // 准备游戏状态数据
    const gameData = {
      targetWord: currentGame.targetWord,
      guesses: currentGame.guesses,
      attempts: currentGame.attempts,
      maxAttempts: currentGame.maxAttempts,
      finished: currentGame.finished,
      gameState: isWin ? 'win' : (currentGame.finished ? 'lose' : 'playing'),
      gameType: 'word',
      results
    };
    
    // 调用渲染方法获取结果（可能是图片或错误信息）
    const renderResult = await this.utils.renderer.renderGame(e, gameData);
    await this.sendGameResultMessage(e, gameData, isWin, renderResult, 'word');
    if (gameData.finished) {
      await this._updateLeaderboardStats(e, currentGame, isWin ? userId : null);
    }
    return true;
  }
  
  /**
   * 结束游戏
   * @param {*} e - 消息事件对象
   * @returns {Promise<boolean>} - 处理结果
   */
  async giveUpGame(e) {
    const { groupId, userId } = this._getGameContext(e);
    const currentGame = await this.utils.db.getGameData(groupId, userId);
    if (!currentGame || currentGame.finished) {
      const context = groupId ? '群聊' : '私聊';
      await e.reply(`当前${context}没有进行中的游戏哦qwq`);
      return true;
    }
    const target = currentGame.targetWord;
    currentGame.finished = true;
    await this.utils.db.saveGameData(groupId, currentGame, userId);
    
    let message = `游戏结束了哦\n`;
    message += `【单词】${target}`;
    const definition = await this.utils.word.getWordDefinition(target);
    if (definition) {
      message += `\n${definition}`;
    }
    await e.reply(message);
    await this._updateLeaderboardStats(e, currentGame, null);
    const cacheKey = groupId || `private_${userId}`;
    setTimeout(async () => {
      await this.utils.db.deleteGameData(groupId, userId);
      if (this.utils.renderer.canvasCache && typeof this.utils.renderer.canvasCache === 'object') {
        if (typeof this.utils.renderer.canvasCache.delete === 'function') {
          this.utils.renderer.canvasCache.delete(cacheKey);
        } else {
          delete this.utils.renderer.canvasCache[cacheKey];
        }
      }
    }, 100);
    return true;
  }
  
  /**
   * 显示帮助
   * @param {*} e - 消息事件对象
   * @returns {Promise<boolean>} - 处理结果
   */
  async showHelp(e) {
    await e.reply(`单词 游戏帮助

📋 基本命令：
#word - 开始新游戏（随机字母数）
#word [数字] - 开始指定字母数量的游戏
#word ans - 结束游戏
#word 词典 [名称] - 按名称切换词典
#释义 [单词] - 查询单词释义

🎯 提交猜测方式：
• 使用前缀：#apple !apple

📱 使用示例：
#apple - 使用前缀猜测
!apple - 通过前缀猜词
#word 7 - 开始7字母游戏
#apple - 使用前缀猜测
#word 词典 - 循环切换词典
#word 词典 四级 - 切换到四级词典
#word 词典 六级 - 切换到六级词典
#释义 access - 查询单词access的释义
`);
    return true;
  }
  
  /**
   * 选择词库
   * @param {*} e - 消息事件对象
   * @returns {Promise<boolean>} - 处理结果
   */
  async selectWordbank(e) {
    const groupId = e.group_id;
    const input = e.msg.trim().toLowerCase();
    
    const availableDicts = await this.utils.word.getAvailableDictionaries();
    const dictNameMatch = input.match(/#word\s+(?:词库|词典|wordbank)\s+(.+)/);
    
    if (dictNameMatch && dictNameMatch[1]) {
      // 按名称切换词典
      const targetDictName = dictNameMatch[1].trim();
      const targetDict = availableDicts.find(dict => 
        dict.name.toLowerCase().includes(targetDictName.toLowerCase()) ||
        dict.id.toLowerCase().includes(targetDictName.toLowerCase())
      );
      
      if (targetDict) {
        const currentDict = await this.utils.db.getWordbankSelection(groupId);
        const currentDictInfo = availableDicts.find(dict => dict.id === currentDict) || availableDicts[0];
        
        // 设置新的词典选择
        await this.utils.db.setWordbankSelection(groupId, targetDict.id);
        
        await e.reply(`词典已切换：${currentDictInfo.name} → ${targetDict.name}\n当前词典信息：\n- 包含 ${targetDict.wordCount} 个单词\n- 使用 #word 开始新游戏生效`);
        return true;
      } else {
        // 列出所有可用的词典
        const dictList = availableDicts.map(dict => `- ${dict.name} (${dict.wordCount}个单词)`).join('\n');
        await e.reply(`未找到名为"${targetDictName}"的词典\n\n可用词典列表：\n${dictList}\n\n请使用正确的词典名称，例如：#word 词典 四级`);
        return true;
      }
    } else {
      // 循环切换词典（原有逻辑）
      const currentDict = await this.utils.db.getWordbankSelection(groupId);
      
      // 找到当前词典的索引
      let currentIndex = availableDicts.findIndex(dict => dict.id === currentDict);
      if (currentIndex === -1) currentIndex = 0;
      
      // 计算下一个词典的索引（循环选择）
      const nextIndex = (currentIndex + 1) % availableDicts.length;
      const nextDict = availableDicts[nextIndex];
      
      // 设置新的词典选择
      await this.utils.db.setWordbankSelection(groupId, nextDict.id);
      
      const currentDictInfo = availableDicts[currentIndex];
      const nextDictInfo = nextDict;
      
      await e.reply(`词典已切换：${currentDictInfo.name} → ${nextDictInfo.name}\n当前词典信息：\n- 包含 ${nextDictInfo.wordCount} 个单词\n- 使用 #word 开始新游戏生效`);
      return true;
    }
  }
}

export default new WordGame();

