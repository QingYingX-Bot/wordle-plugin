import fs from 'fs';
import path from 'node:path';
import { createCanvas } from 'canvas';
import { parsePinyin } from '../data/pinyin.js';

/**
 * Wordle游戏渲染模块
 * 负责游戏界面的Canvas绘制
 */
class WordleRenderer {
  constructor() {
    this.canvasCache = new Map();
    this.maxCacheSize = 200; // 最大缓存数量
    this.utils = null;
    this.versionInfoCache = null; // 版本信息缓存
    this.initUtils();
  }

  async initUtils() {
    try {
      this.utils = await import('../utils.js').then(m => m.default || m);
    } catch (e) {
      console.error('[renderer.js] 动态加载 utils 失败', e);
    }
  }

  /**
   * 获取版本信息（带缓存）
   * @returns {Object} 包含版本信息的对象
   */
  async getVersionInfo() {
    if (this.versionInfoCache) return this.versionInfoCache;
    try {
      let pluginVersion = '5.1.4';
      let yunzaiName = 'Yunzai';
      let yunzaiVersion = '1.1.4';

      const pluginPackagePath = path.join(process.cwd(), './plugins/wordle-plugin/package.json');
      if (fs.existsSync(pluginPackagePath)) {
        const pluginPackage = JSON.parse(fs.readFileSync(pluginPackagePath, 'utf8'));
        pluginVersion = pluginPackage.version || pluginVersion;
      }

      try {
        const yunzaiPackagePath = path.join(process.cwd(), './package.json');
        if (fs.existsSync(yunzaiPackagePath)) {
          const yunzaiPackage = JSON.parse(fs.readFileSync(yunzaiPackagePath, 'utf8'));
          if (yunzaiPackage.name) {
            yunzaiName = yunzaiPackage.name.replace(/(^\w|-\w)/g, s => s.toUpperCase());
          }
          if (yunzaiPackage.version) {
            yunzaiVersion = yunzaiPackage.version;
          }
        }
      } catch (error) {
        logger.debug('无法读取云崽package.json:', error.message);
      }

      this.versionInfoCache = {
        pluginVersion,
        yunzaiName,
        yunzaiVersion
      };
      return this.versionInfoCache;
    } catch (error) {
      logger.error('获取版本信息时出错:', error);
      this.versionInfoCache = {
        pluginVersion: '5.1.4',
        yunzaiName: 'Yunzai',
        yunzaiVersion: '1.1.4'
      };
      return this.versionInfoCache;
    }
  }

  /**
   * 清理过期的canvas缓存
   * @private
   */
  _cleanCache() {
    if (this.canvasCache.size > this.maxCacheSize) {
      const entriesToDelete = [...this.canvasCache.entries()]
        .sort((a, b) => a[1].lastUsed - b[1].lastUsed)
        .slice(0, Math.floor(this.maxCacheSize * 0.2)); // 删除20%最旧的缓存

      for (const [key] of entriesToDelete) {
        this.canvasCache.delete(key);
      }
    }
  }

  /**
   * 使用Canvas渲染游戏界面
   * @param {Object} e - 消息事件对象
   * @param {Object} gameData - 游戏数据
   * @returns {Promise<*>} - 渲染结果
   */
  async renderGame(e, gameData, checkGuessFunc) {
    const startTime = Date.now();
    try {
      const guesses = Array.isArray(gameData.guesses) ? gameData.guesses : [];
      const guessesPinyin = Array.isArray(gameData.guessesPinyin) ? gameData.guessesPinyin : [];
      // 优先使用预计算结果，否则使用传入函数或utils进行计算
      let results = Array.isArray(gameData.results) ? gameData.results : null;
      const gameType = gameData.gameType || 'word';
      // 优先使用 letterCount，如果没有则从 targetWord 获取
      const letterCount = gameData.letterCount || (gameData.targetWord ? gameData.targetWord.length : 5);

      if (!results) {
        const checker = typeof checkGuessFunc === 'function' ? checkGuessFunc : (this.utils?.checkGuess?.bind(this.utils));
        results = [];
        if (checker) {
          for (let i = 0; i < guesses.length; i++) {
            results.push(checker(guesses[i], gameData.targetWord, gameType));
          }
        }
      }

      const maxAttempts = gameData.maxAttempts || 6;
      // 成语游戏需要更大的格子以容纳拼音和汉字
      const boxSize = gameType === 'idiom' ? 80 : 60;
      const gap = 8;
      const padding = 40;
      const versionInfoHeight = 25;
      
      // 公式游戏和成语游戏不显示键盘
      const showKeyboard = gameType !== 'equation' && gameType !== 'idiom';
      const keyboardHeight = showKeyboard ? 180 : 0;
      const height = maxAttempts * boxSize + (maxAttempts - 1) * gap + 2 * padding + keyboardHeight + 15 + versionInfoHeight;
      const wordBasedWidth = letterCount * boxSize + (letterCount - 1) * gap + 2 * padding;
      const keyWidth = 36;
      const keyGap = 5;
      const keyboardLayout = [
        ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
        ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
        ['Z', 'X', 'C', 'V', 'B', 'N', 'M']
      ];
      let maxKeyboardRowWidth = 0;
      for (const row of keyboardLayout)
        maxKeyboardRowWidth = Math.max(maxKeyboardRowWidth, row.length * keyWidth + (row.length - 1) * keyGap);
      const keyboardBasedWidth = maxKeyboardRowWidth + 2 * padding;
      const width = Math.max(wordBasedWidth, keyboardBasedWidth);
      // 支持群聊和私聊的缓存键
      const groupId = e.group_id;
      const userId = e.user_id;
      const cacheKey = groupId || (userId ? `private_${userId}` : null);
      
      let canvas, ctx;
      if (cacheKey && this.canvasCache.has(cacheKey)) {
        const cacheItem = this.canvasCache.get(cacheKey);
        canvas = cacheItem.canvas;
        ctx = canvas.getContext('2d');
        cacheItem.lastUsed = Date.now();
        
        if (canvas.width !== width || canvas.height !== height) {
          canvas = createCanvas(width, height);
          ctx = canvas.getContext('2d');
          this.canvasCache.set(cacheKey, { canvas, lastUsed: Date.now() });
        } else {
          ctx.fillStyle = '#f8f8f8';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
      } else {
        canvas = createCanvas(width, height);
        ctx = canvas.getContext('2d');
        if (cacheKey) {
          this.canvasCache.set(cacheKey, { canvas, lastUsed: Date.now() });
        }
        this._cleanCache();
      }
      ctx.fillStyle = '#f8f8f8';
      ctx.fillRect(0, 0, width, height);
      const boardWidth = letterCount * boxSize + (letterCount - 1) * gap;
      const startX = (width - boardWidth) / 2;
      for (let row = 0; row < maxAttempts; row++) {
        for (let col = 0; col < letterCount; col++) {
          const x = startX + col * (boxSize + gap);
          const y = padding + row * (boxSize + gap);
          let bgColor = '#ffffff';
          let borderColor = '#d3d6da';
          let letter = '';
          if (row < guesses.length && typeof guesses[row] === 'string' && col < guesses[row].length) {
            letter = guesses[row][col];
            if (results && results[row] && results[row][col]) {
              const resultItem = results[row][col];
              // 支持两种格式：{letter, status} 或 {char, status}
              const char = resultItem.letter || resultItem.char || letter;
              const status = resultItem.status;
              letter = char; // 使用结果中的字符
              switch (status) {
                case 'correct':
                  bgColor = '#6aaa64';
                  borderColor = '#6aaa64';
                  break;
                case 'present':
                  bgColor = '#c9b458';
                  borderColor = '#c9b458';
                  break;
                case 'absent':
                  bgColor = '#787c7e';
                  borderColor = '#787c7e';
                  break;
              }
            }
          }
          ctx.fillStyle = bgColor;
          ctx.fillRect(x, y, boxSize, boxSize);
          ctx.strokeStyle = borderColor;
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, boxSize, boxSize);
          if (letter) {
            ctx.fillStyle = bgColor === '#ffffff' ? '#1a1a1b' : '#ffffff';
            ctx.textAlign = 'center';
            
            // 成语游戏显示拼音和汉字（支持拼音级别的反馈）
            if (gameType === 'idiom') {
              // 获取当前字的拼音
              let pinyin = '';
              let pinyinInfo = null;
              if (row < guessesPinyin.length && guessesPinyin[row]) {
                const pinyinParts = guessesPinyin[row].split(/\s+/);
                if (col < pinyinParts.length) {
                  pinyin = pinyinParts[col];
                  pinyinInfo = parsePinyin(pinyin);
                }
              }
              
              // 获取拼音级别的反馈状态
              const resultItem = results && results[row] && results[row][col] ? results[row][col] : null;
              const pinyinFeedback = resultItem && resultItem.pinyin ? resultItem.pinyin : null;
              
              // 绘制拼音（上方，支持声母、韵母、声调的颜色反馈）
              if (pinyin) {
                ctx.textAlign = 'center';
                
                // 获取拼音部分的颜色（根据反馈状态）
                const getPinyinPartColor = (status) => {
                  if (!status) return bgColor === '#ffffff' ? '#666666' : '#ffffff';
                  switch (status) {
                    case 'correct':
                      return bgColor === '#ffffff' ? '#0d8e8e' : '#80e5d4'; // 青色（正确）
                    case 'present':
                      return bgColor === '#ffffff' ? '#fb923c' : '#fbbf24'; // 橙色（存在但位置错误）
                    case 'absent':
                    default:
                      return bgColor === '#ffffff' ? '#999999' : '#cccccc'; // 灰色（不存在）
                  }
                };
                
                // 如果有拼音反馈信息，分别显示声母、韵母、声调
                if (pinyinInfo && pinyinFeedback) {
                  const fontSize = 15;
                  ctx.font = `bold ${fontSize}px "Noto Serif SC", "Source Han Serif SC", serif`;
                  ctx.textBaseline = 'alphabetic';
                  
                  const initial = pinyinInfo.initial || '';
                  const original = pinyinInfo.original || pinyin;
                  
                  // 如果声母、韵母、声调的状态不同，分开显示
                  const initialStatus = pinyinFeedback.initial;
                  const finalStatus = pinyinFeedback.final;
                  const hasDifferentStatus = initialStatus && finalStatus && initialStatus !== finalStatus;
                  
                  if (hasDifferentStatus && initial) {
                    // 分开显示：声母、韵母+声调
                    const centerX = x + boxSize / 2;
                    const finalPart = original.substring(initial.length);
                    
                    // 计算总宽度以居中
                    ctx.font = `bold ${fontSize}px "Noto Serif SC", "Source Han Serif SC", serif`;
                    const initialWidth = ctx.measureText(initial).width;
                    const finalWidth = ctx.measureText(finalPart).width;
                    const totalWidth = initialWidth + finalWidth;
                    
                    // 绘制声母
                    ctx.fillStyle = getPinyinPartColor(initialStatus);
                    ctx.fillText(initial, centerX - totalWidth / 2 + initialWidth / 2, y + 20);
                    
                    // 绘制韵母+声调
                    ctx.fillStyle = getPinyinPartColor(finalStatus);
                    ctx.fillText(finalPart, centerX + totalWidth / 2 - finalWidth / 2, y + 20);
                  } else {
                    // 整体显示拼音，使用整体状态颜色（优先使用韵母状态）
                    const overallStatus = finalStatus || initialStatus || pinyinFeedback.tone;
                    ctx.fillStyle = getPinyinPartColor(overallStatus);
                    ctx.fillText(original, x + boxSize / 2, y + 20);
                  }
                } else {
                  // 没有反馈信息，正常显示
                  ctx.font = 'bold 15px "Noto Serif SC", "Source Han Serif SC", serif';
                  ctx.textBaseline = 'alphabetic';
                  ctx.fillStyle = bgColor === '#ffffff' ? '#666666' : '#ffffff';
                  ctx.fillText(pinyin, x + boxSize / 2, y + 20);
                }
              }
              
              // 绘制汉字（中间偏下，稍大一些）
              ctx.font = 'bold 38px "Noto Serif SC", "Source Han Serif SC", serif';
              ctx.textBaseline = 'alphabetic';
              ctx.textAlign = 'center';
              ctx.fillStyle = bgColor === '#ffffff' ? '#1a1a1b' : '#ffffff';
              ctx.fillText(letter, x + boxSize / 2, y + 62);
            } else {
              // 非成语游戏使用原有逻辑
              ctx.font = 'bold 32px Arial';
              ctx.textBaseline = 'middle';
              // 公式游戏和成语游戏不转大写，单词游戏转大写
              const displayChar = gameType === 'equation' ? letter : letter.toUpperCase();
              ctx.fillText(displayChar, x + boxSize / 2, y + boxSize / 2);
            }
          }
        }
      }

      // 确保 utils 已加载（在需要使用前）
      if (!this.utils) {
        await this.initUtils();
      }

      // 公式游戏不显示键盘
      if (showKeyboard) {
        await this.drawKeyboardHint(ctx, width, height - keyboardHeight - versionInfoHeight - 10, guesses, results);
      }
      
      // 使用优化后的版本信息获取方法
      const versionInfo = await this.getVersionInfo();
      ctx.fillStyle = '#787c7e';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        `${versionInfo.yunzaiName} v${versionInfo.yunzaiVersion} & Wordle-Plugin ${versionInfo.pluginVersion}`,
        width / 2,
        height - versionInfoHeight / 2
      );
      
      const buffer = canvas.toBuffer('image/png');
      const imageSegment = {
        type: 'image',
        file: buffer,
        url: 'data:image/png;base64,' + buffer.toString('base64'),
        filename: `wordle-${Date.now()}.png`
      };
      
      return imageSegment;
    } catch (err) {
      return this.handleRenderError(e, err);
    } finally {
      this.logPerformanceWarning(e, startTime);
    }
  }

  /**
   * 处理渲染错误
   * @private
   */
  async handleRenderError(e, err) {
    const errMsg = err.toString();
    logger.error(`[Wordle] 渲染错误 [群:${e.group_id}]`, err);
    
    const errorMessages = [
      `🚨 渲染错误！请尝试安装canvas依赖或更新插件\n`,
      `错误详情：${errMsg}\n`,
      `请将以下完整错误日志提供给开发者以便修复问题：\n`,
      `[Wordle] 渲染错误 [群:${e.group_id}] ${errMsg}\n`,
      `Node.js版本：${process.version}\n`
    ];
    
    try {
      const common = (await import('../../../lib/common/common.js')).default;
      return await common.makeForwardMsg(e, errorMessages, 'Wordle渲染错误日志');
    } catch (importErr) {
      logger.error(`导入common模块失败：`, importErr);
      return errorMessages;
    }
  }

  /**
   * 记录性能警告日志
   * @private
   */
  logPerformanceWarning(e, startTime) {
    const renderTime = Date.now() - startTime;
    if (renderTime > 1500) {
      logger.warn(`[Wordle] 渲染性能警告 [群:${e.group_id}] 耗时:${renderTime}ms`);
    }
  }
  
  /**
   * 在Canvas上绘制键盘提示
   * @param {CanvasRenderingContext2D} ctx - Canvas上下文
   * @param {number} width - 画布宽度
   * @param {number} startY - 起始Y坐标
   * @param {Array<string>} guesses - 已猜测的单词数组
   * @param {Array<Array<{letter:string,status:string}>>} results - 与每次猜测对应的结果
   */
  async drawKeyboardHint(ctx, width, startY, guesses, results) {
    const keyboardLayout = [
      ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
      ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
      ['Z', 'X', 'C', 'V', 'B', 'N', 'M']
    ];
    const letterStatus = this.utils.getLetterStatusFromResults(guesses, results);
    const keyWidth = 36;
    const keyHeight = 42;
    const keyGap = 5;
    const rowGap = 8;
    for (let rowIndex = 0; rowIndex < keyboardLayout.length; rowIndex++) {
      const row = keyboardLayout[rowIndex];
      const rowWidth = row.length * keyWidth + (row.length - 1) * keyGap;
      const startX = (width - rowWidth) / 2;
      for (let colIndex = 0; colIndex < row.length; colIndex++) {
        const letter = row[colIndex];
        const status = letterStatus.get(letter.toLowerCase());
        const x = startX + colIndex * (keyWidth + keyGap);
        const y = startY + rowIndex * (keyHeight + rowGap);
        let bgColor = '#d3d6da';
        switch (status) {
          case 'correct':
            bgColor = '#6aaa64';
            break;
          case 'present':
            bgColor = '#c9b458';
            break;
          case 'absent':
            bgColor = '#787c7e';
            break;
        }
        ctx.fillStyle = bgColor;
        ctx.beginPath();
        ctx.roundRect(x, y, keyWidth, keyHeight, 6);
        ctx.fill();
        ctx.fillStyle = bgColor === '#d3d6da' ? '#1a1a1b' : '#ffffff';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(letter, x + keyWidth / 2, y + keyHeight / 2);
      }
    }
  }
}

export default new WordleRenderer();