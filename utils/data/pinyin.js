/**
 * 拼音解析模块
 * 用于解析拼音字符串，提取声母、韵母和声调
 */

/**
 * 解析单个拼音字符串
 * @param {string} pinyin - 拼音字符串，如 "zhōng", "yī", "dīng"
 * @returns {Object} - {initial: string, final: string, tone: number}
 */
export function parsePinyin(pinyin) {
  if (!pinyin || typeof pinyin !== 'string') {
    return { initial: '', final: '', tone: 0 };
  }

  // 去除空格
  pinyin = pinyin.trim();

  // 提取声调（1-4，或轻声0）
  let tone = 0;
  const toneMap = {
    'ā': 1, 'á': 2, 'ǎ': 3, 'à': 4,
    'ē': 1, 'é': 2, 'ě': 3, 'è': 4,
    'ī': 1, 'í': 2, 'ǐ': 3, 'ì': 4,
    'ō': 1, 'ó': 2, 'ǒ': 3, 'ò': 4,
    'ū': 1, 'ú': 2, 'ǔ': 3, 'ù': 4,
    'ǖ': 1, 'ǘ': 2, 'ǚ': 3, 'ǜ': 4
  };

  // 移除声调标记并记录声调
  let cleanedPinyin = '';
  for (const char of pinyin) {
    if (toneMap[char]) {
      tone = toneMap[char];
      // 将带声调的字母转换为普通字母
      const baseMap = {
        'ā': 'a', 'á': 'a', 'ǎ': 'a', 'à': 'a',
        'ē': 'e', 'é': 'e', 'ě': 'e', 'è': 'e',
        'ī': 'i', 'í': 'i', 'ǐ': 'i', 'ì': 'i',
        'ō': 'o', 'ó': 'o', 'ǒ': 'o', 'ò': 'o',
        'ū': 'u', 'ú': 'u', 'ǔ': 'u', 'ù': 'u',
        'ǖ': 'u', 'ǘ': 'u', 'ǚ': 'u', 'ǜ': 'u'
      };
      cleanedPinyin += baseMap[char] || char;
    } else {
      cleanedPinyin += char;
    }
  }

  // 如果没找到声调标记，尝试通过数字提取
  if (tone === 0) {
    const toneMatch = pinyin.match(/([1-4])$/);
    if (toneMatch) {
      tone = parseInt(toneMatch[1]);
      cleanedPinyin = cleanedPinyin.replace(/[1-4]$/, '');
    }
  }

  // 声母表
  const initials = ['b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 
                   'j', 'q', 'x', 'zh', 'ch', 'sh', 'r', 'z', 'c', 's', 'y', 'w'];

  // 提取声母
  let initial = '';
  for (const init of initials) {
    if (cleanedPinyin.startsWith(init)) {
      initial = init;
      cleanedPinyin = cleanedPinyin.substring(init.length);
      break;
    }
  }

  // 剩余部分就是韵母
  const final = cleanedPinyin || '';

  return { initial, final, tone };
}

/**
 * 解析拼音字符串（多个拼音）
 * @param {string} pinyinString - 拼音字符串，如 "yī dīng bù shí"
 * @returns {Array<Object>} - 拼音对象数组
 */
export function parsePinyinString(pinyinString) {
  if (!pinyinString || typeof pinyinString !== 'string') {
    return [];
  }

  // 按空格分割
  const pinyinParts = pinyinString.trim().split(/\s+/);
  
  // 解析每个拼音
  return pinyinParts.map(parsePinyin);
}

export default {
  parsePinyin,
  parsePinyinString
};

