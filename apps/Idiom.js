const game = await import('../utils/games/idiom.js').then(m => m.default || m);

let utils;
let db;
(async () => {
  utils = await import('../utils/utils.js').then(m => m.default || m);
  db = await import('../utils/data/db.js').then(m => m.default || m);
})();

export class Idiom extends plugin {
  constructor() {
    super({
      name: 'Idiom',
      dsc: '成语猜谜游戏',
      event: 'message', 
      priority: 5000,
      rule: [
        {
          reg: /^#(?:idiom|Idiom|成语|汉兜).*(排行榜|榜|leaderboard|rank).*$/i,
          fnc: 'showLeaderboard'
        },
        {
          reg: /^#(?:idiom|Idiom|成语|汉兜)(.*)$/i,
          fnc: 'idiom'
        },
        {
          reg: /^[#!！][\u4e00-\u9fa5]{4}$/,
          fnc: 'listenMessages',
          log: false
        }
      ]
    });
    
    // 注入工具和游戏模块
    this.game = game;
    this.utils = utils;
    this.db = db;
  }

  /**
   * 检查群组是否启用Wordle游戏
   * @param {*} e - 消息事件对象
   * @returns {Promise<boolean>} - 是否启用
   */
  async checkEnabled(e) {
    const groupId = e.group_id || `private_${e.user_id}`;
    const dbModule = this.db || db;
    this.db = dbModule;
    return await dbModule.isGroupEnabled(groupId);
  }
  
  /**
   * 监听所有消息，用于游戏进行中的直接猜测
   * @param {*} e - 消息事件对象
   * @returns {Promise<boolean>} - 处理结果
   */
  async listenMessages(e) {
    // 私聊不处理
    if (!e.isGroup) {
      return false;
    }
    
    // 先检查群组是否启用游戏，如果未启用则不判断（优先级最高）
    const enabled = await this.checkEnabled(e);
    if (!enabled) {
      return false; // 未启用游戏，直接返回，不进行任何处理
    }
    
    // 此群可游玩 -> 若游戏开始则开始监听
    const { groupId, userId, gameKey } = this.game._getGameContext(e);
    if (!gameKey) {
      return false;
    }
    
    const utilsModule = this.utils || utils;
    this.utils = utilsModule;
    const currentGame = await utilsModule.db.getGameData(gameKey);
    if (!currentGame || currentGame.finished) {
      return false; // 没有进行中的游戏，直接返回
    }
    
    return await this.game.listenMessages(e);
  }

  /**
   * 成语游戏主函数
   * @param {*} e - 消息事件对象
   * @returns {Promise<boolean>} - 处理结果
   */
  async idiom(e) {
    const enabled = await this.checkEnabled(e);
    if (!enabled) {
      await e.reply('❌ Wordle游戏功能未启用，请先发送 #开启wordle游戏 来启用功能。');
      return true;
    }
    return await this.game.idiom(e);
  }

  async showLeaderboard(e) {
    const enabled = await this.checkEnabled(e);
    if (!enabled) {
      await e.reply('❌ Wordle游戏功能未启用，请先发送 #开启wordle游戏 来启用功能。');
      return true;
    }
    const groupId = e.group_id;
    const utilsModule = this.utils || utils;
    this.utils = utilsModule;
    
    if (!utilsModule?.leaderboard) {
      await e.reply('排行榜功能尚未加载完成，请稍后再试。');
      return true;
    }

    const msgLower = (e.msg || '').toLowerCase();
    const isGlobal = msgLower.includes('总') || msgLower.includes('全局') || msgLower.includes('global');

    if (!isGlobal && !groupId) {
      await e.reply('群排行榜功能仅支持群聊使用，请使用"#idiom总排行榜"查看全局排行榜。');
      return true;
    }

    let focus = 'wins';
    if (msgLower.includes('胜率') || msgLower.includes('rate')) {
      focus = 'rate';
    } else if (msgLower.includes('参') || msgLower.includes('game')) {
      focus = 'games';
    }

    let winsTop, gamesTop, rateTop;
    if (isGlobal) {
      winsTop = utilsModule.leaderboard.getGlobalLeaderboard('wins', 10);
      gamesTop = utilsModule.leaderboard.getGlobalLeaderboard('games', 10);
      rateTop = utilsModule.leaderboard.getGlobalLeaderboard('rate', 10);
    } else {
      winsTop = utilsModule.leaderboard.getLeaderboard(groupId, 'wins', 10);
      gamesTop = utilsModule.leaderboard.getLeaderboard(groupId, 'games', 10);
      rateTop = utilsModule.leaderboard.getLeaderboard(groupId, 'rate', 10);
    }

    if (!winsTop.length && !gamesTop.length && !rateTop.length) {
      const emptyMsg = isGlobal 
        ? '全局还没有任何 成语 战绩，快来开一局吧！'
        : '当前群聊还没有任何 成语 战绩，快来开一局吧！';
      await e.reply(emptyMsg);
      return true;
    }

    const getMedal = (index) => {
      if (index === 0) return '🥇';
      if (index === 1) return '🥈';
      if (index === 2) return '🥉';
      return `${index + 1}.`;
    };

    const formatList = (list) => list.map((player, index) => {
      const medal = getMedal(index);
      const name = player.nickname || `玩家${player.userId}`;
      const wins = typeof player.wins === 'number' ? player.wins : 0;
      const games = typeof player.gamesPlayed === 'number' ? player.gamesPlayed : 0;
      const winRateNumber = typeof player.winRate === 'number' ? player.winRate : 0;
      const safeWinRate = games > 0 && Number.isFinite(winRateNumber) ? winRateNumber : 0;
      const winRateText = safeWinRate.toFixed(2);
      return `${medal} ${name} - ${wins}胜 / ${games}局 (胜率${winRateText}%)`;
    }).join('\n');

    const sections = [
      { key: 'wins', title: '🏆 胜场榜', data: winsTop, empty: '暂无胜场数据' },
      { key: 'games', title: '👥 参与榜', data: gamesTop, empty: '暂无参与数据' },
      { key: 'rate', title: '🎯 胜率榜（至少3局）', data: rateTop, empty: '暂无胜率数据' }
    ];

    const title = isGlobal ? '🌍 成语 全局排行榜' : '📊 成语 群排行榜';
    const messageParts = [title];
    for (const section of sections) {
      const sectionTitle = section.key === focus ? `⭐ ${section.title}` : section.title;
      messageParts.push('', sectionTitle);
      if (section.data.length) {
        messageParts.push(formatList(section.data));
      } else {
        messageParts.push(section.empty);
      }
    }

    await e.reply(messageParts.join('\n'));
    return true;
  }
}

