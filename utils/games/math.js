import { GameBase } from './base.js';

/**
 * 数学公式游戏核心逻辑模块
 */
class MathGame extends GameBase {
  constructor() {
    super();
    // 正则表达式定义
    this.REGEX_MATH_CMD = /^#(?:math|Math|数学|公式)(.*)$/i;
    this.REGEX_EQUATION = /^[0-9+\-*/\*\*=]+$/; // 公式格式：数字、运算符、等号
    
    // 公式游戏尝试次数配置（根据公式长度）
    this.equationAttempts = {
      8: 6,
      9: 6,
      10: 7,
      11: 7,
      12: 8,
      13: 8,
      14: 9,
      15: 9,
      16: 10
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
    if (message.match(/^(?:math|Math|数学|公式)/i)) {
      return false; // 让 math 方法处理
    }
    
    // 检查是否是 word 命令
    if (message.match(/^word/i)) {
      return false; // 让 word 方法处理
    }
    
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
    
    // 检查 utils 是否已加载
    if (!this.utils || !this.utils.db) {
      logger.error('[MathGame] utils 尚未加载完成');
      return false;
    }
    
    const currentGame = await this.utils.db.getGameData(groupId, userId);
    if (!currentGame || currentGame.finished) {
      return false;
    }
    
    // 只处理数学游戏
    if (currentGame.gameType !== 'equation') {
      return false;
    }
    
    if (!prefix) {
      return false;
    }
    
    // 验证输入为数学公式
    if (!this.REGEX_EQUATION.test(message) || !message.includes('=')) {
      await e.reply('请输入有效的数学公式（例如：123+456=579）！', false, {recallMsg: 60});
      return true;
    }
    const expectedLength = currentGame.letterCount || 12;
    if (message.length !== expectedLength) {
      await e.reply(`请输入长度为${expectedLength}的公式！`, false, {recallMsg: 60});
      return true;
    }
    
    this.userCooldowns.set(cooldownKey, now);
    if (groupId) {
      this.groupCooldowns.set(groupId, now);
    }
    return await this.processGuess(e, message, groupId, 'equation', userId);
  }

  /**
   * 数学公式游戏主函数
   * @param {*} e - 消息事件对象
   * @returns {Promise<boolean>} - 处理结果
   */
  async math(e) {
    const originalMsg = e.msg.toLowerCase();
    
    if (originalMsg.includes('答案') || originalMsg.includes('ans') || originalMsg.includes('放弃')) {
      return await this.giveUpGame(e);
    }
    
    const match = e.msg.match(this.REGEX_MATH_CMD);
    let input = match && match[1] ? match[1].trim().toLowerCase() : '';
    
    if (input.includes('帮助') || input.includes('help')) {
      return await this.showMathHelp(e);
    }
    
    if (input.includes('分类') || input.includes('category')) {
      return await this.selectCategory(e);
    }
    
    // 检查是否是特殊分类命令：特殊、special
    const specialMatch = input.match(/^(?:特殊|special)\s*(\d+)?$/i);
    if (specialMatch) {
      const specialLength = specialMatch[1] ? parseInt(specialMatch[1]) : null;
      if (specialLength) {
        // 指定长度的特殊分类
        return await this.startSpecialEquationGame(e, specialLength);
      } else {
        // 没有指定长度，显示特殊分类列表
        return await this.showSpecialCategories(e);
      }
    }
    
    if (!input) {
      return await this.startNewEquationGame(e, 12);
    }
    
    const numberMatch = input.match(/^\d+$/);
    if (numberMatch) {
      const length = parseInt(numberMatch[0]);
      // 支持的长度：5-12（普通公式），以及特殊分类的12、14、16（包含幂运算）
      if (length >= 5 && length <= 12) {
        return await this.startNewEquationGame(e, length);
      } else if (length === 14 || length === 16) {
        // 特殊长度需要使用特殊命令
        await e.reply(`长度 ${length} 属于特殊分类（包含幂运算 **）。\n\n请使用：\n#math 特殊 ${length}\n\n或查看所有特殊分类：\n#math 特殊`);
        return true;
      } else {
        await e.reply('请输入5-12之间的长度（普通公式），或使用 "#math 特殊 [长度]" 使用特殊分类（支持长度：12、14、16）。');
        return true;
      }
    }
    
    // 检查是否是公式格式的猜测
    if (this.REGEX_EQUATION.test(input) && input.includes('=')) {
      // 检查 utils 是否已加载
      if (!this.utils || !this.utils.db) {
        logger.error('[MathGame] utils 尚未加载完成（math命令）');
        return false;
      }
      
      const { groupId: mathGroupId, userId: mathUserId } = this._getGameContext(e);
      const currentGame = await this.utils.db.getGameData(mathGroupId, mathUserId);
      if (currentGame && currentGame.gameType === 'equation') {
        const expectedLength = currentGame.letterCount || 12;
        if (input.length === expectedLength) {
          return await this.processGuess(e, input, mathGroupId, 'equation', mathUserId);
        } else {
          await e.reply(`请输入长度为${expectedLength}的公式！`);
          return true;
        }
      }
    }
    
    return await this.showMathHelp(e);
  }

  /**
   * 开始新数学公式游戏
   * @param {*} e - 消息事件对象
   * @param {number} length - 公式长度
   * @returns {Promise<boolean>} - 处理结果
   */
  async startNewEquationGame(e, length = 12) {
    // 检查 utils 是否已加载
    if (!this.utils || !this.utils.db) {
      logger.error('[MathGame] utils 尚未加载完成（startNewEquationGame）');
      await e.reply('游戏模块正在加载中，请稍后再试。');
      return true;
    }
    
    const { groupId, userId } = this._getGameContext(e);
    const existingGame = await this.utils.db.getGameData(groupId, userId);
    if (existingGame && !existingGame.finished) {
      const context = groupId ? '群聊' : '私聊';
      await e.reply(`当前${context}已经有一个进行中的游戏了哦！请先完成当前游戏或使用 "#math 答案" 或 "#math ans" 结束游戏。`);
      return true;
    }
    
    const targetEquation = await this.utils.equation.getRandomEquation(length, groupId);
    if (!targetEquation) {
      await e.reply(`公式库中没有长度为${length}的公式！请尝试其他长度（8-16）。`);
      return true;
    }
    
    const maxAttempts = this.equationAttempts[length] || 8;
    
    // 初始化游戏数据
    const gameData = {
      targetWord: targetEquation,
      guesses: [],
      attempts: 0,
      maxAttempts: maxAttempts,
      finished: false,
      startTime: Date.now(),
      letterCount: length,
      gameType: 'equation', // 标记为公式游戏
      participants: {}
    };
    
    // 保存游戏数据
    await this.utils.db.saveGameData(groupId, gameData, userId);
    
    // 使用渲染器渲染游戏界面
    const renderData = {
      targetWord: targetEquation,
      guesses: [],
      attempts: 0,
      maxAttempts: maxAttempts,
      finished: false,
      gameState: 'playing',
      gameType: 'equation'
    };
    
    const img = await this.utils.renderer.renderGame(e, renderData);
    if (img) {
      const gameStartMessage = [
        `数学公式猜谜游戏开始啦！
`,
        `公式长度：${length} 字符
`,
        img
      ];
      await e.reply(gameStartMessage);
    } else {
      logger.error("游戏图片渲染失败")
      throw new Error("游戏出现错误，请检查必要依赖是否安装，或反馈错误");
    }
    
    return true;
  }
  
  /**
   * 处理猜测
   * @param {*} e - 消息事件对象
   * @param {string} guess - 猜测的公式
   * @param {string} groupId - 群组ID
   * @param {string} gameType - 游戏类型：'equation'
   * @returns {Promise<boolean>} - 处理结果
   */
  async processGuess(e, guess, groupId, gameType = 'equation', userId = null) {
    // 检查 utils 是否已加载
    if (!this.utils || !this.utils.db) {
      logger.error('[MathGame] utils 尚未加载完成');
      await e.reply('游戏模块正在加载中，请稍后再试。');
      return true;
    }
    
    const { groupId: actualGroupId, userId: actualUserId } = this._getGameContext(e);
    const finalGroupId = groupId || actualGroupId;
    const finalUserId = userId || actualUserId;
    
    let currentGame = await this.utils.db.getGameData(finalGroupId, finalUserId);
    if (!currentGame || currentGame.finished) {
      const context = finalGroupId ? '群聊' : '私聊';
      await e.reply(`当前${context}没有进行中的游戏！请先发送 "#math" 开始游戏。`);
      return true;
    }
    
    // 验证猜测
    // 特殊分类模式下，只在 special 文件夹中验证
    const category = currentGame.category || null;
    const isValid = await this.utils.equation.isValidEquationInList(guess, currentGame.letterCount, category);
    if (!isValid) {
      // 检查是否是有效公式格式
      if (this.utils.equation.isValidEquation(guess)) {
        await e.reply('公式格式正确，但不在公式库中！', false, {recallMsg: 60});
      } else {
        await e.reply('请输入有效的数学公式（例如：123+456=579）！', false, {recallMsg: 60});
      }
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
      this.utils.checkGuess(g, currentGame.targetWord, 'equation')
    );

    // 准备游戏状态数据
    const gameData = {
      targetWord: currentGame.targetWord,
      guesses: currentGame.guesses,
      attempts: currentGame.attempts,
      maxAttempts: currentGame.maxAttempts,
      finished: currentGame.finished,
      gameState: isWin ? 'win' : (currentGame.finished ? 'lose' : 'playing'),
      gameType: 'equation',
      results
    };
    
    // 调用渲染方法获取结果（可能是图片或错误信息）
    const renderResult = await this.utils.renderer.renderGame(e, gameData);
    await this.sendGameResultMessage(e, gameData, isWin, renderResult, 'equation');
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
    message += `【公式】${target}`;
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
   * 显示数学公式游戏帮助
   * @param {*} e - 消息事件对象
   * @returns {Promise<boolean>} - 处理结果
   */
  async showMathHelp(e) {
    await e.reply(`数学公式猜谜游戏帮助

📋 基本命令：
#math - 开始新游戏（默认长度12）
#math [长度] - 开始指定长度的游戏（支持5-12）
#math 特殊 [长度] - 开始特殊分类游戏（支持12、14、16，包含幂运算）
#math ans - 结束游戏
#math 分类 - 查看公式分类

🎯 提交猜测方式：
• 使用前缀：#123+456=579 !123+456=579

📱 使用示例：
#math 12 - 开始长度12的游戏
#math 特殊 14 - 开始长度14的特殊公式游戏（包含幂运算）
#123+456=579 - 使用前缀猜测公式
#math 答案 - 结束当前游戏

💡 提示：
• 公式包含数字、运算符（+、-、*、/、**）和等号
• 需要猜测正确的数学等式
• 支持幂运算（**）
• 也可使用 #数学 或 #公式 作为命令别名`);
    return true;
  }

  /**
   * 选择公式分类
   * @param {*} e - 消息事件对象
   * @returns {Promise<boolean>} - 处理结果
   */
  async selectCategory(e) {
    const groupId = e.group_id;
    const input = e.msg.trim().toLowerCase();
    
    const categories = await this.utils.equation.getAvailableCategories();
    
    // 列出所有分类
    let message = '📚 可用的公式分类：\n\n';
    
    if (categories.length && categories.length.length > 0) {
      message += '📏 按长度分类：\n';
      for (const cat of categories.length) {
        message += `  - ${cat.name}\n`;
      }
      message += '\n';
    }
    
    if (categories.operator && categories.operator.length > 0) {
      message += '🔧 按运算符分类：\n';
      for (const cat of categories.operator) {
        message += `  - ${cat.name}\n`;
      }
      message += '\n';
    }
    
    if (categories.difficulty && categories.difficulty.length > 0) {
      message += '📊 按难度分类：\n';
      for (const cat of categories.difficulty) {
        message += `  - ${cat.name}\n`;
      }
      message += '\n';
    }
    
    if (categories.special && categories.special.length > 0) {
      message += '⭐ 特殊分类（包含幂运算）：\n';
      for (const cat of categories.special) {
        message += `  - ${cat.name}\n`;
      }
    }
    
    await e.reply(message);
    return true;
  }

  /**
   * 显示特殊分类列表
   * @param {*} e - 消息事件对象
   * @returns {Promise<boolean>} - 处理结果
   */
  async showSpecialCategories(e) {
    const categories = await this.utils.equation.getAvailableCategories();
    
    if (!categories.special || categories.special.length === 0) {
      await e.reply('暂无特殊分类可用。');
      return true;
    }
    
    let message = '⭐ 特殊分类（包含幂运算 **）\n\n';
    message += '可用长度：\n';
    for (const cat of categories.special) {
      const length = cat.id.replace('special_', '');
      message += `  • 长度 ${length}：${cat.name}\n`;
    }
    message += '\n使用方法：\n';
    message += '#math 特殊 12  - 开始长度12的特殊公式游戏\n';
    message += '#math 特殊 14  - 开始长度14的特殊公式游戏\n';
    message += '#math 特殊 16  - 开始长度16的特殊公式游戏';
    
    await e.reply(message);
    return true;
  }

  /**
   * 开始特殊分类的公式游戏
   * @param {*} e - 消息事件对象
   * @param {number} length - 公式长度
   * @returns {Promise<boolean>} - 处理结果
   */
  async startSpecialEquationGame(e, length) {
    const { groupId, userId } = this._getGameContext(e);
    const existingGame = await this.utils.db.getGameData(groupId, userId);
    if (existingGame && !existingGame.finished) {
      const context = groupId ? '群聊' : '私聊';
      await e.reply(`当前${context}已经有一个进行中的游戏了哦！请先完成当前游戏或使用 "#math 答案" 结束游戏。`);
      return true;
    }
    
    // 从特殊分类获取公式
    const categoryId = `special_${length}`;
    const targetEquation = await this.utils.equation.getRandomEquationByCategory('special', categoryId);
    
    if (!targetEquation) {
      await e.reply(`特殊分类中没有长度为 ${length} 的公式！\n\n支持的特殊长度：12、14、16\n请使用 "#math 特殊" 查看详细信息。`);
      return true;
    }
    
    // 验证获取到的公式长度，必须匹配
    const actualLength = targetEquation.length;
    if (actualLength !== length) {
      logger.error(`[Wordle] 错误：请求特殊分类长度 ${length}，但获取到的公式长度为 ${actualLength}: ${targetEquation}`);
      await e.reply(`获取公式失败：请求长度为 ${length}，但获取到的公式长度为 ${actualLength}。请重试或联系管理员。`);
      return true;
    }
    
    // 使用请求的长度（应该与实际长度一致）
    const finalLength = length;
    const maxAttempts = this.equationAttempts[finalLength] || 10;
    
    // 初始化游戏数据
    const gameData = {
      targetWord: targetEquation,
      guesses: [],
      attempts: 0,
      maxAttempts: maxAttempts,
      finished: false,
      startTime: Date.now(),
      letterCount: finalLength,  // 使用实际公式长度
      gameType: 'equation', // 标记为公式游戏
      category: 'special', // 标记为特殊分类
      participants: {}
    };
    
    // 保存游戏数据
    await this.utils.db.saveGameData(groupId, gameData, userId);
    
    // 使用渲染器渲染游戏界面
    const renderData = {
      targetWord: targetEquation,
      guesses: [],
      attempts: 0,
      maxAttempts: maxAttempts,
      finished: false,
      gameState: 'playing',
      gameType: 'equation',
      letterCount: finalLength  // 确保渲染器使用正确的长度
    };
    
    const img = await this.utils.renderer.renderGame(e, renderData);
    if (img) {
      const gameStartMessage = [
        `⭐ 特殊数学公式猜谜游戏开始啦！
`,
        `📏 公式长度：${finalLength} 字符
🎯 特殊分类：包含幂运算（**）的复杂公式
📊 最多尝试：${maxAttempts} 次
`,
        img
      ];
      await e.reply(gameStartMessage);
    }
    
    return true;
  }
}

export default new MathGame();

