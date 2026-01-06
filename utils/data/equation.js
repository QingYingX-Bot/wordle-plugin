import fs from 'fs';
import path from 'node:path';
import { fileURLToPath } from 'url';

/**
 * 数学公式数据管理模块
 * 负责加载公式数据、获取随机公式、验证公式、分类管理等操作
 */
class EquationData {
  constructor() {
    this.__filename = fileURLToPath(import.meta.url);
    this.__dirname = path.dirname(this.__filename);
    this.mathPath = path.resolve(this.__dirname, '../../resources/math');
    
    // 数据缓存
    this.equationsCache = {}; // {文件路径: 公式数组}
    this.categoryCache = null;
    
    // 注入的方法（由utils注入）
    this.getCategorySelection = null;
  }

  /**
   * 加载公式文件
   * @param {string} filePath - JSON文件路径
   * @returns {Promise<Array>} - 公式数组
   */
  async loadEquationFile(filePath) {
    if (this.equationsCache[filePath]) {
      return this.equationsCache[filePath];
    }

    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const equations = Array.isArray(data) ? data : [];
      this.equationsCache[filePath] = equations;
      return equations;
    } catch (error) {
      logger.error(`[EquationData] 加载公式文件失败 ${filePath}: ${error.message}`);
      this.equationsCache[filePath] = [];
      return [];
    }
  }

  /**
   * 获取随机公式（按长度）
   * @param {number} length - 公式长度
   * @param {string} groupId - 群组ID（可选，用于获取用户选择的分类）
   * @returns {Promise<string|null>} - 随机公式或null
   */
  async getRandomEquation(length, groupId = null) {
    try {
      // 如果用户选择了分类，使用分类选择
      if (groupId && this.getCategorySelection) {
        const selectedCategory = await this.getCategorySelection(groupId);
        if (selectedCategory && selectedCategory.type && selectedCategory.id) {
          return await this.getRandomEquationByCategory(selectedCategory.type, selectedCategory.id);
        }
      }

      // 默认从长度分类中获取
      const lengthFile = path.join(this.mathPath, 'length', `length_${length}.json`);
      
      // 如果长度文件不存在，尝试从all.json中筛选
      if (!fs.existsSync(lengthFile)) {
        const allFile = path.join(this.mathPath, 'all.json');
        if (fs.existsSync(allFile)) {
          const allEquations = await this.loadEquationFile(allFile);
          const filtered = allEquations.filter(eq => eq && eq.length === length);
          if (filtered.length > 0) {
            const randomIndex = Math.floor(Math.random() * filtered.length);
            return filtered[randomIndex];
          }
        }
        return null;
      }

      const equations = await this.loadEquationFile(lengthFile);
      if (equations.length === 0) {
        return null;
      }

      const randomIndex = Math.floor(Math.random() * equations.length);
      return equations[randomIndex] || null;
    } catch (error) {
      logger.error(`[EquationData] 获取随机公式失败: ${error.message}`);
      return null;
    }
  }

  /**
   * 按分类获取随机公式
   * @param {string} category - 分类类型：'length', 'operator', 'difficulty', 'special'
   * @param {string} categoryId - 分类ID，如 'length_12', 'special_14'
   * @returns {Promise<string|null>} - 随机公式或null
   */
  async getRandomEquationByCategory(category, categoryId) {
    try {
      let filePath;
      
      if (category === 'special') {
        // 特殊分类
        const length = categoryId.replace('special_', '');
        filePath = path.join(this.mathPath, 'special', `length_${length}.json`);
      } else if (category === 'length') {
        // 长度分类
        filePath = path.join(this.mathPath, 'length', `${categoryId}.json`);
      } else if (category === 'operator') {
        // 运算符分类
        filePath = path.join(this.mathPath, 'operator', `${categoryId}.json`);
      } else if (category === 'difficulty') {
        // 难度分类
        filePath = path.join(this.mathPath, 'difficulty', `${categoryId}.json`);
      } else {
        logger.error(`[EquationData] 未知的分类类型: ${category}`);
        return null;
      }

      if (!fs.existsSync(filePath)) {
        logger.warn(`[EquationData] 公式文件不存在: ${filePath}`);
        return null;
      }

      const equations = await this.loadEquationFile(filePath);
      
      // 对于特殊分类，需要验证长度
      if (category === 'special' && categoryId) {
        const expectedLength = parseInt(categoryId.replace('special_', ''));
        const filtered = equations.filter(eq => eq && eq.length === expectedLength);
        if (filtered.length > 0) {
          const randomIndex = Math.floor(Math.random() * filtered.length);
          return filtered[randomIndex];
        }
        return null;
      }

      if (equations.length === 0) {
        return null;
      }

      const randomIndex = Math.floor(Math.random() * equations.length);
      return equations[randomIndex] || null;
    } catch (error) {
      logger.error(`[EquationData] 按分类获取随机公式失败: ${error.message}`);
      return null;
    }
  }

  /**
   * 验证公式格式是否正确
   * @param {string} equation - 待验证的公式
   * @returns {boolean} - 是否为有效公式格式
   */
  isValidEquation(equation) {
    if (!equation || typeof equation !== 'string') {
      return false;
    }

    // 必须包含等号
    if (!equation.includes('=')) {
      return false;
    }

    // 只允许数字、运算符和等号
    if (!/^[0-9+\-*/\*\*=]+$/.test(equation)) {
      return false;
    }

    // 尝试计算验证（简单验证）
    try {
      const parts = equation.split('=');
      if (parts.length !== 2) {
        return false;
      }
      // 这里可以添加更严格的验证逻辑
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 验证公式是否在指定列表中
   * @param {string} equation - 待验证的公式
   * @param {number} length - 公式长度
   * @param {string|null} category - 分类（'special' 或其他），null表示不限制分类
   * @returns {Promise<boolean>} - 是否在列表中
   */
  async isValidEquationInList(equation, length, category = null) {
    if (!this.isValidEquation(equation)) {
      return false;
    }

    try {
      // 如果指定了special分类，只在special文件夹中查找
      if (category === 'special') {
        const specialFile = path.join(this.mathPath, 'special', `length_${length}.json`);
        if (fs.existsSync(specialFile)) {
          const equations = await this.loadEquationFile(specialFile);
          return equations.includes(equation);
        }
        // 如果special文件不存在，也检查special/all.json
        const specialAllFile = path.join(this.mathPath, 'special', 'all.json');
        if (fs.existsSync(specialAllFile)) {
          const equations = await this.loadEquationFile(specialAllFile);
          const filtered = equations.filter(eq => eq && eq.length === length);
          return filtered.includes(equation);
        }
        return false;
      }

      // 否则在all.json中查找
      const allFile = path.join(this.mathPath, 'all.json');
      if (fs.existsSync(allFile)) {
        const equations = await this.loadEquationFile(allFile);
        return equations.includes(equation);
      }

      return false;
    } catch (error) {
      logger.error(`[EquationData] 验证公式是否在列表中失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 获取可用分类
   * @returns {Promise<Object>} - 分类对象 {length: [...], operator: [...], difficulty: [...], special: [...]}
   */
  async getAvailableCategories() {
    if (this.categoryCache) {
      return this.categoryCache;
    }

    const categories = {
      length: [],
      operator: [],
      difficulty: [],
      special: []
    };

    try {
      // 扫描长度分类
      const lengthDir = path.join(this.mathPath, 'length');
      if (fs.existsSync(lengthDir)) {
        const files = fs.readdirSync(lengthDir).filter(f => f.endsWith('.json'));
        for (const file of files) {
          const length = file.replace('length_', '').replace('.json', '');
          categories.length.push({
            id: `length_${length}`,
            name: `长度 ${length}`,
            type: 'length'
          });
        }
      }

      // 扫描运算符分类
      const operatorDir = path.join(this.mathPath, 'operator');
      if (fs.existsSync(operatorDir)) {
        const files = fs.readdirSync(operatorDir).filter(f => f.endsWith('.json'));
        for (const file of files) {
          const name = file.replace('.json', '');
          categories.operator.push({
            id: name,
            name: name,
            type: 'operator'
          });
        }
      }

      // 扫描难度分类
      const difficultyDir = path.join(this.mathPath, 'difficulty');
      if (fs.existsSync(difficultyDir)) {
        const files = fs.readdirSync(difficultyDir).filter(f => f.endsWith('.json'));
        for (const file of files) {
          const name = file.replace('.json', '');
          categories.difficulty.push({
            id: name,
            name: name,
            type: 'difficulty'
          });
        }
      }

      // 扫描特殊分类
      const specialDir = path.join(this.mathPath, 'special');
      if (fs.existsSync(specialDir)) {
        const files = fs.readdirSync(specialDir).filter(f => f.endsWith('.json'));
        for (const file of files) {
          if (file.startsWith('length_')) {
            const length = file.replace('length_', '').replace('.json', '');
            categories.special.push({
              id: `special_${length}`,
              name: `特殊 ${length}`,
              type: 'special'
            });
          }
        }
      }

      this.categoryCache = categories;
      return categories;
    } catch (error) {
      logger.error(`[EquationData] 获取可用分类失败: ${error.message}`);
      return categories;
    }
  }

  /**
   * 检查公式猜测结果（类似Wordle的字母位置反馈）
   * @param {string} guess - 猜测的公式
   * @param {string} target - 目标公式
   * @returns {Array} - 猜测结果数组，每个元素包含 {letter: string, status: 'correct'|'present'|'absent'}
   */
  checkGuess(guess, target) {
    if (!guess || !target || guess.length !== target.length) {
      return [];
    }

    const length = target.length;
    const result = new Array(length);
    const freq = Object.create(null);

    // 第一次遍历：标记正确位置，并统计剩余字符频次
    for (let i = 0; i < length; i++) {
      const g = guess[i];
      const t = target[i];
      if (g === t) {
        result[i] = { letter: g, status: 'correct' };
      } else {
        result[i] = { letter: g, status: 'pending' };
        freq[t] = (freq[t] || 0) + 1;
      }
    }

    // 第二次遍历：为非正确位置分配 present/absent
    for (let i = 0; i < length; i++) {
      if (result[i].status === 'pending') {
        const g = guess[i];
        if (freq[g] > 0) {
          result[i].status = 'present';
          freq[g] -= 1;
        } else {
          result[i].status = 'absent';
        }
      }
    }

    return result;
  }

  /**
   * 注入获取分类选择的方法（由utils注入）
   * @param {Function} method - getCategorySelection方法
   */
  injectGetCategorySelection(method) {
    if (typeof method === 'function') {
      this.getCategorySelection = method;
    }
  }
}

export default new EquationData();

