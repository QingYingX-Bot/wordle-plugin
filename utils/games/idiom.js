import { GameBase } from './base.js';
import { parsePinyinString, parsePinyin } from '../data/pinyin.js';

/**
 * 成语游戏核心逻辑模块
 */
class IdiomGame extends GameBase {
  constructor() {
    super();
    // 正则表达式定义
    this.REGEX_IDIOM_CMD = /^#(?:idiom|Idiom|成语|汉兜)(.*)$/i;
    this.REGEX_CHINESE = /^[\u4e00-\u9fa5]+$/; // 中文字符正则
    
    // 成语游戏固定为4个字，固定10次尝试
    this.idiomLength = 4;
    this.maxAttempts = 10;
  }

  /**
   * 检查成语猜测结果（包含拼音级别的反馈）
   * @param {string} guess - 猜测的成语
   * @param {string} target - 目标成语
   * @param {string} guessPinyin - 猜测成语的拼音，如 "yī dīng bù shí"
   * @param {string} targetPinyin - 目标成语的拼音，如 "yī dīng bù shí"
   * @returns {Array} - 猜测结果数组，每个元素包含 {char, letter, status, pinyin: {initial, final, tone}}
   */
  checkIdiomGuess(guess, target, guessPinyin = '', targetPinyin = '') {
    if (!guess || !target || guess.length !== target.length) {
      return [];
    }

    const length = target.length;
    const result = new Array(length);
    const charFreq = Object.create(null);
    
    // 解析拼音
    const guessPinyinArray = guessPinyin ? parsePinyinString(guessPinyin) : [];
    const targetPinyinArray = targetPinyin ? parsePinyinString(targetPinyin) : [];

    // 第一次遍历：标记正确位置，并统计剩余字符频次
    for (let i = 0; i < length; i++) {
      const g = guess[i];
      const t = target[i];
      const guessPy = i < guessPinyinArray.length ? guessPinyinArray[i] : null;
      const targetPy = i < targetPinyinArray.length ? targetPinyinArray[i] : null;
      
      // 拼音级别的反馈信息
      const pinyinInfo = {
        initial: null,
        final: null,
        tone: null
      };
      
      if (guessPy && targetPy) {
        // 声母状态判断
        if (guessPy.initial === targetPy.initial) {
          // 声母正确，且位置正确（在同位置）
          pinyinInfo.initial = 'correct';
        } else {
          // 检查声母是否在其他位置存在
          let initialExists = false;
          for (let j = 0; j < length; j++) {
            if (j !== i && j < targetPinyinArray.length && targetPinyinArray[j].initial === guessPy.initial) {
              initialExists = true;
              break;
            }
          }
          pinyinInfo.initial = initialExists ? 'present' : 'absent';
        }
        
        // 韵母状态判断
        if (guessPy.final === targetPy.final) {
          // 韵母正确，且位置正确
          pinyinInfo.final = 'correct';
        } else {
          // 检查韵母是否在其他位置存在
          let finalExists = false;
          for (let j = 0; j < length; j++) {
            if (j !== i && j < targetPinyinArray.length && targetPinyinArray[j].final === guessPy.final) {
              finalExists = true;
              break;
            }
          }
          pinyinInfo.final = finalExists ? 'present' : 'absent';
        }
        
        // 声调状态判断
        if (guessPy.tone === targetPy.tone) {
          // 声调正确，且位置正确（在同位置，且韵母也正确）
          if (guessPy.final === targetPy.final) {
            pinyinInfo.tone = 'correct';
          } else {
            // 声调正确但韵母不对，检查是否有相同的韵母+声调组合
            let toneExists = false;
            for (let j = 0; j < length; j++) {
              if (j !== i && j < targetPinyinArray.length && 
                  targetPinyinArray[j].tone === guessPy.tone && 
                  targetPinyinArray[j].final === guessPy.final) {
                toneExists = true;
                break;
              }
            }
            pinyinInfo.tone = toneExists ? 'present' : 'correct'; // 声调本身正确
          }
        } else {
          // 检查声调是否在其他位置存在
          let toneExists = false;
          for (let j = 0; j < length; j++) {
            if (j !== i && j < targetPinyinArray.length && targetPinyinArray[j].tone === guessPy.tone) {
              toneExists = true;
              break;
            }
          }
          pinyinInfo.tone = toneExists ? 'present' : 'absent';
        }
      }
      
      if (g === t) {
        result[i] = {
          char: g,
          letter: g,
          status: 'correct',
          pinyin: pinyinInfo
        };
      } else {
        result[i] = {
          char: g,
          letter: g,
          status: 'pending',
          pinyin: pinyinInfo
        };
        charFreq[t] = (charFreq[t] || 0) + 1;
      }
    }

    // 第二次遍历：为非正确位置分配 present/absent
    for (let i = 0; i < length; i++) {
      if (result[i].status === 'pending') {
        const g = guess[i];
        if (charFreq[g] > 0) {
          result[i].status = 'present';
          charFreq[g] -= 1;
        } else {
          result[i].status = 'absent';
        }
      }
    }

    return result;
  }
  
  /**
   * 监听所有消息，用于游戏进行中的直接猜测
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
    
    // 检查是否是其他游戏命令
    if (message.match(/^(?:数学|公式|math|word)/i)) {
      return false; // 让其他方法处理
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
    
    const currentGame = await this.utils.db.getGameData(groupId, userId);
    if (!currentGame || currentGame.finished) {
      return false;
    }
    
    // 只处理成语游戏
    if (currentGame.gameType !== 'idiom') {
      return false;
    }
    
    if (!prefix) {
      return false;
    }
    
    // 验证输入为中文成语（4个字）
    if (!this.REGEX_CHINESE.test(message) || message.length !== this.idiomLength) {
      await e.reply(`请输入${this.idiomLength}字成语！`, false, {recallMsg: 60});
      return true;
    }
    
    this.userCooldowns.set(cooldownKey, now);
    if (groupId) {
      this.groupCooldowns.set(groupId, now);
    }
    return await this.processGuess(e, message, groupId, 'idiom', userId);
  }

  /**
   * 成语游戏主函数
   * @param {*} e - 消息事件对象
   * @returns {Promise<boolean>} - 处理结果
   */
  async idiom(e) {
    const originalMsg = e.msg.toLowerCase();
    
    if (originalMsg.includes('答案') || originalMsg.includes('ans') || originalMsg.includes('放弃')) {
      return await this.giveUpGame(e);
    }
    
    const match = e.msg.match(this.REGEX_IDIOM_CMD);
    let input = match && match[1] ? match[1].trim() : '';
    
    if (input.includes('帮助') || input.includes('help')) {
      return await this.showHelp(e);
    }
    
    if (!input) {
      return await this.startNewIdiomGame(e);
    }
    
    // 检查是否是成语格式的猜测
    if (this.REGEX_CHINESE.test(input) && input.length === this.idiomLength) {
      const { groupId: idiomGroupId, userId: idiomUserId } = this._getGameContext(e);
      const currentGame = await this.utils.db.getGameData(idiomGroupId, idiomUserId);
      if (currentGame && currentGame.gameType === 'idiom') {
        return await this.processGuess(e, input, idiomGroupId, 'idiom', idiomUserId);
      }
    }
    
    return await this.showHelp(e);
  }

  /**
   * 开始新游戏
   * @param {*} e - 消息事件对象
   * @returns {Promise<boolean>} - 处理结果
   */
  async startNewIdiomGame(e) {
    const { groupId, userId } = this._getGameContext(e);
    const existingGame = await this.utils.db.getGameData(groupId, userId);
    if (existingGame && !existingGame.finished) {
      const context = groupId ? '群聊' : '私聊';
      await e.reply(`当前${context}已经有一个进行中的游戏了哦！请先完成当前游戏或使用 "#idiom 答案" 结束游戏。`);
      return true;
    }
    
    const targetIdiom = await this.utils.idiom.getRandomIdiom();
    if (!targetIdiom) {
      await e.reply('成语库加载失败，请稍后再试！');
      return true;
    }
    
    // 获取成语的拼音
    const targetPinyin = await this.utils.idiom.getIdiomPinyin(targetIdiom);
    
    // 初始化游戏数据
    const gameData = {
      targetWord: targetIdiom,
      targetPinyin: targetPinyin, // 保存拼音信息
      guesses: [],
      guessesPinyin: [], // 保存每个猜测的拼音
      attempts: 0,
      maxAttempts: this.maxAttempts,
      finished: false,
      startTime: Date.now(),
      letterCount: this.idiomLength,
      gameType: 'idiom', // 标记为成语游戏
      participants: {}
    };
    
    // 保存游戏数据
    await this.utils.db.saveGameData(groupId, gameData, userId);
    
    // 使用渲染器渲染游戏界面
    const renderData = {
      targetWord: targetIdiom,
      targetPinyin: targetPinyin,
      guesses: [],
      guessesPinyin: [],
      attempts: 0,
      maxAttempts: this.maxAttempts,
      finished: false,
      gameState: 'playing',
      gameType: 'idiom'
    };
    
    const img = await this.utils.renderer.renderGame(e, renderData);
    if (img) {
      const gameStartMessage = [
        `成语猜谜游戏开始啦！
`,
        `成语长度：${this.idiomLength} 字
最多尝试：${this.maxAttempts} 次
`,
        `📋 游戏规则：
• 猜一个${this.idiomLength}字成语
• 使用前缀提交猜测：#[成语] 或 ![成语]
• 根据颜色反馈逐步缩小范围
• 颜色含义：
  🟩 青色 = 正确位置
  🟨 橙色 = 存在但位置错误
  ⬜ 灰色 = 不存在
• 拼音反馈：声母、韵母、声调独立判断
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
   * @param {string} guess - 猜测的成语
   * @param {string} groupId - 群组ID
   * @param {string} gameType - 游戏类型：'idiom'
   * @param {string} userId - 用户ID
   * @returns {Promise<boolean>} - 处理结果
   */
  async processGuess(e, guess, groupId, gameType = 'idiom', userId = null) {
    const { groupId: actualGroupId, userId: actualUserId } = this._getGameContext(e);
    const finalGroupId = groupId || actualGroupId;
    const finalUserId = userId || actualUserId;
    
    let currentGame = await this.utils.db.getGameData(finalGroupId, finalUserId);
    if (!currentGame || currentGame.finished) {
      const context = finalGroupId ? '群聊' : '私聊';
      await e.reply(`当前${context}没有进行中的游戏！请先发送 "#idiom" 开始游戏。`);
      return true;
    }
    
    // 验证猜测是否为有效成语
    const isValid = await this.utils.idiom.isValidIdiom(guess);
    if (!isValid) {
      await e.reply('请输入有效的四字成语！', false, {recallMsg: 60});
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
    
    // 获取猜测成语的拼音
    const guessPinyin = await this.utils.idiom.getIdiomPinyin(guess);
    
    currentGame.guesses.push(guess);
    // 保存每个猜测的拼音
    if (!currentGame.guessesPinyin) {
      currentGame.guessesPinyin = [];
    }
    currentGame.guessesPinyin.push(guessPinyin || '');
    
    currentGame.attempts++;
    const isWin = guess.trim() === currentGame.targetWord.trim();
    currentGame.finished = isWin || currentGame.attempts >= currentGame.maxAttempts;
    await this.utils.db.saveGameData(finalGroupId, currentGame, finalUserId);

    // 计算猜测结果（包含拼音级别的反馈）
    const results = [];
    for (let i = 0; i < currentGame.guesses.length; i++) {
      const guess = currentGame.guesses[i];
      const guessPinyin = (currentGame.guessesPinyin && currentGame.guessesPinyin[i]) || '';
      const result = this.checkIdiomGuess(guess, currentGame.targetWord, guessPinyin, currentGame.targetPinyin || '');
      results.push(result);
    }

    // 准备游戏状态数据
    const gameData = {
      targetWord: currentGame.targetWord,
      targetPinyin: currentGame.targetPinyin,
      guesses: currentGame.guesses,
      guessesPinyin: currentGame.guessesPinyin || [],
      attempts: currentGame.attempts,
      maxAttempts: currentGame.maxAttempts,
      finished: currentGame.finished,
      gameState: isWin ? 'win' : (currentGame.finished ? 'lose' : 'playing'),
      gameType: 'idiom',
      results
    };
    
    // 调用渲染方法获取结果（可能是图片或错误信息）
    const renderResult = await this.utils.renderer.renderGame(e, gameData);
    await this.sendGameResultMessage(e, gameData, isWin, renderResult, 'idiom');
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
    const pinyin = currentGame.targetPinyin || '';
    currentGame.finished = true;
    await this.utils.db.saveGameData(groupId, currentGame, userId);
    
    let message = `游戏结束了哦\n`;
    message += `【成语】${target}`;
    if (pinyin) {
      message += `\n【拼音】${pinyin}`;
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
   * 显示帮助信息
   * @param {*} e - 消息事件对象
   * @returns {Promise<boolean>} - 处理结果
   */
  async showHelp(e) {
    await e.reply(`成语猜谜游戏帮助

📋 基本命令：
#idiom - 开始新游戏
#idiom ans - 结束游戏
#idiom 帮助 - 查看帮助

🎯 提交猜测方式：
• 使用前缀：#高山流水 !高山流水

📱 使用示例：
#idiom - 开始新游戏
#高山流水 - 使用前缀猜测成语
#idiom 答案 - 结束当前游戏

💡 提示：
• 猜一个四字成语
• 根据颜色提示逐步缩小范围
• 青色=正确位置，橙色=存在但位置错误，灰色=不存在
• 也可以使用 #成语 或 #汉兜 作为命令别名`);
    return true;
  }
}

export default new IdiomGame();

