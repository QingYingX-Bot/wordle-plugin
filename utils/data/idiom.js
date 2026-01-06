import fs from 'fs';
import path from 'node:path';
import { fileURLToPath } from 'url';

/**
 * 成语数据管理模块
 * 负责加载成语数据、获取随机成语、验证成语、获取拼音等操作
 */
class IdiomData {
  constructor() {
    this.__filename = fileURLToPath(import.meta.url);
    this.__dirname = path.dirname(this.__filename);
    this.idiomsPath = path.resolve(this.__dirname, '../../resources/汉兜/idioms.json');
    this.pinyinPath = path.resolve(this.__dirname, '../../resources/汉兜/pinyin.json');
    
    this.idiomsCache = null;
    this.pinyinCache = null;
    this.idiomSet = null; // 成语集合，用于快速查找
  }

  /**
   * 加载成语数据（带缓存）
   * @returns {Promise<Array>} - 成语数组
   */
  async loadIdioms() {
    if (this.idiomsCache) {
      return this.idiomsCache;
    }

    try {
      const idiomsData = JSON.parse(fs.readFileSync(this.idiomsPath, 'utf-8'));
      this.idiomsCache = Array.isArray(idiomsData) ? idiomsData : [];
      
      // 创建成语集合（用于快速查找）
      this.idiomSet = new Set();
      for (const item of this.idiomsCache) {
        if (item.idiom && typeof item.idiom === 'string') {
          this.idiomSet.add(item.idiom);
        }
      }
      
      logger.info(`[IdiomData] 加载成语数据成功，共 ${this.idiomsCache.length} 个成语`);
      return this.idiomsCache;
    } catch (error) {
      logger.error(`[IdiomData] 加载成语数据失败: ${error.message}`);
      this.idiomsCache = [];
      this.idiomSet = new Set();
      return [];
    }
  }

  /**
   * 加载拼音数据（带缓存）
   * @returns {Promise<Object>} - 拼音映射对象 {成语: 拼音字符串}
   */
  async loadPinyin() {
    if (this.pinyinCache) {
      return this.pinyinCache;
    }

    try {
      const pinyinData = JSON.parse(fs.readFileSync(this.pinyinPath, 'utf-8'));
      this.pinyinCache = {};
      
      if (Array.isArray(pinyinData)) {
        for (const item of pinyinData) {
          if (item.term && item.pinyin) {
            this.pinyinCache[item.term] = item.pinyin;
          }
        }
      }
      
      logger.info(`[IdiomData] 加载拼音数据成功，共 ${Object.keys(this.pinyinCache).length} 个词条`);
      return this.pinyinCache;
    } catch (error) {
      logger.error(`[IdiomData] 加载拼音数据失败: ${error.message}`);
      this.pinyinCache = {};
      return {};
    }
  }

  /**
   * 获取随机成语
   * @returns {Promise<string>} - 随机成语字符串
   */
  async getRandomIdiom() {
    await this.loadIdioms();
    
    if (this.idiomsCache.length === 0) {
      return null;
    }
    
    const randomIndex = Math.floor(Math.random() * this.idiomsCache.length);
    const item = this.idiomsCache[randomIndex];
    
    return item && item.idiom ? item.idiom : null;
  }

  /**
   * 验证成语是否有效
   * @param {string} idiom - 待验证的成语
   * @returns {Promise<boolean>} - 是否为有效成语
   */
  async isValidIdiom(idiom) {
    if (!idiom || typeof idiom !== 'string') {
      return false;
    }
    
    // 必须是4个字
    if (idiom.length !== 4) {
      return false;
    }
    
    // 必须全部是中文
    if (!/^[\u4e00-\u9fa5]+$/.test(idiom)) {
      return false;
    }
    
    await this.loadIdioms();
    
    // 检查是否在成语集合中
    return this.idiomSet && this.idiomSet.has(idiom);
  }

  /**
   * 获取成语的拼音
   * @param {string} idiom - 成语
   * @returns {Promise<string>} - 拼音字符串，如 "yī dīng bù shí"
   */
  async getIdiomPinyin(idiom) {
    if (!idiom || typeof idiom !== 'string') {
      return '';
    }
    
    await this.loadPinyin();
    
    // 先从拼音数据中查找
    if (this.pinyinCache && this.pinyinCache[idiom]) {
      return this.pinyinCache[idiom];
    }
    
    // 如果没找到，尝试从成语数据中查找
    await this.loadIdioms();
    for (const item of this.idiomsCache) {
      if (item.idiom === idiom && item.pinyin) {
        return item.pinyin;
      }
    }
    
    // 如果还是没找到，返回空字符串
    return '';
  }
}

export default new IdiomData();

