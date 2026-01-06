let utils;
(async () => {
  try {
    utils = await import('../utils.js').then(m => m.default || m);
  } catch (e) {
    logger.error('[base.js] 动态加载 utils 失败', e);
  }
})();

/**
 * 游戏基础类 - 包含共用方法和工具
 */
export class GameBase {
  constructor() {
    // 配置
    this.groupcooldownTime = 1000;
    this.personcooldownTime = 4000;
    
    // 状态管理
    this.userCooldowns = new Map();
    this.groupCooldowns = new Map();
  }
  
  get utils() {
    if (!utils) {
      logger.error('[GameBase] utils 尚未加载完成');
    }
    return utils;
  }
  
  /**
   * 检查 utils 是否已加载
   * @returns {boolean}
   */
  _isUtilsReady() {
    return !!utils && !!utils.db;
  }
  
  /**
   * 获取游戏标识（支持群聊和私聊）
   * @param {*} e - 消息事件对象
   * @returns {Object} - {groupId, userId, gameKey}
   */
  _getGameContext(e) {
    const groupId = e.group_id || null;
    const userId = e.user_id || null;
    const gameKey = groupId || (userId ? `private_${userId}` : null);
    return { groupId, userId, gameKey };
  }

  _getUserId(e) {
    if (e?.user_id != null) return String(e.user_id);
    if (e?.sender?.user_id != null) return String(e.sender.user_id);
    return null;
  }

  _getDisplayName(e) {
    const card = e?.sender?.card;
    const nickname = e?.sender?.nickname;
    const userId = this._getUserId(e);
    if (card && typeof card === 'string' && card.trim().length > 0) {
      return card.trim();
    }
    if (nickname && typeof nickname === 'string' && nickname.trim().length > 0) {
      return nickname.trim();
    }
    return userId != null ? `玩家${userId}` : '未知玩家';
  }
  
  /**
   * 发送游戏结果消息
   * @param {*} e - 消息事件对象
   * @param {Object} gameData - 游戏数据
   * @param {boolean} isWin - 是否获胜
   * @param {*} result - 渲染结果或错误信息
   * @param {string} gameType - 游戏类型
   */
  async sendGameResultMessage(e, gameData, isWin, result, gameType = 'word') {
    if (result) {
      const resultMessage = await this.generateResultMessage(e, gameData, isWin, gameType);
      // 将文本消息和图片分开发送
      if (resultMessage) {
        await e.reply(resultMessage);
      }
      if (result != null) {
        await e.reply(result);
      }
    } else {
      await e.reply('渲染失败，请稍后再试或联系开发者获取帮助');
    }
    if (gameData.finished) {
      const { groupId: finishGroupId, userId: finishUserId } = this._getGameContext(e);
      setTimeout(async () => {
        await this.utils.db.deleteGameData(finishGroupId, finishUserId);
        const cacheKey = finishGroupId || `private_${finishUserId}`;
        if (this.utils.renderer.canvasCache && typeof this.utils.renderer.canvasCache === 'object') {
          this.utils.renderer.canvasCache.delete(cacheKey);
        }
      }, 100);
    }
  }
  
  /**
   * 生成结果消息
   * @param {*} e - 消息事件对象
   * @param {Object} gameData - 游戏数据
   * @param {boolean} isWin - 是否获胜
   * @param {string} gameType - 游戏类型
   * @returns {string} 结果消息
   */
  async generateResultMessage(e, gameData, isWin, gameType = 'word') {
    const target = gameData?.targetWord;
    if (isWin) {
      let message = `🎉 恭喜 ${e.sender.card} 猜中了！
答案是 ${target}`;
      
      if (gameType !== 'equation') {
        const definition = await this.utils.word.getWordDefinition(target);
        if (definition) {
          message += `\n${definition}`;
        }
      }
      
      message += `\n共猜了 ${gameData.attempts} 次
成绩不错，再来一局吧！`;
      return message;
    } else if (gameData.finished) {
      let message = `😔 很遗憾，没有人猜中
答案是 ${target}`;
      
      if (gameType !== 'equation') {
        const definition = await this.utils.word.getWordDefinition(target);
        if (definition) {
          message += `\n${definition}`;
        }
      }
      
      message += `\n别灰心，再来一局吧！`;
      return message;
    } else {
      return ``;
    }
  }

  async _updateLeaderboardStats(e, gameData, winnerId = null) {
    const groupId = e?.group_id;
    if (!groupId || !gameData || !this.utils?.leaderboard) return;

    const participants = gameData.participants || {};
    const participantsArray = Object.entries(participants).map(([userId, data]) => {
      if (typeof data === 'string') {
        return { userId, nickname: data };
      }
      if (data && typeof data === 'object') {
        return { userId, nickname: data.nickname || `玩家${userId}` };
      }
      return { userId, nickname: `玩家${userId}` };
    });

    const resolvedWinnerId = winnerId != null ? String(winnerId) : null;
    let winnerName = '';
    if (resolvedWinnerId) {
      const winnerData = participants[resolvedWinnerId];
      if (typeof winnerData === 'string') {
        winnerName = winnerData;
      } else if (winnerData && typeof winnerData === 'object' && winnerData.nickname) {
        winnerName = winnerData.nickname;
      } else {
        winnerName = this._getDisplayName(e);
      }
    }

    if (!participantsArray.length && !resolvedWinnerId) return;

    await this.utils.leaderboard.recordGameResult(groupId, participantsArray, resolvedWinnerId, winnerName);
  }
}

