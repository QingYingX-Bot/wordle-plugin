#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成长度为12的特殊公式（复杂随机版）
必须包含 **（幂运算），总共至少4个运算符
支持运算符：+ 加 - 减 * 乘 / 除 ** 幂
公式不以**开头，需要足够的复杂度，随机生成
"""
import json
import os
import re
import random

TARGET_LENGTH = 12
TARGET_COUNT = 200

# 随机种子
random.seed()

# 预定义的幂运算
POWERS = [
    (2, 2, "2**2", 4),
    (2, 3, "2**3", 8),
    (3, 2, "3**2", 9),
    (4, 2, "4**2", 16),
    (5, 2, "5**2", 25),
]

def evaluate_expression(expr):
    """安全地计算表达式"""
    try:
        pattern = r'(\d+)\*\*(\d+)'
        while '**' in expr:
            match = re.search(pattern, expr)
            if not match:
                break
            base = int(match.group(1))
            exp = int(match.group(2))
            result = str(base ** exp)
            expr = expr.replace(match.group(0), result, 1)
        result = eval(expr)
        return int(result) if isinstance(result, (int, float)) and result == int(result) else None
    except:
        return None

def count_operators(expr):
    """正确计算运算符数量（将**视为一个运算符）"""
    if '**' not in expr:
        return len([c for c in expr if c in ['+', '-', '*', '/']])
    
    power_count = expr.count('**')
    expr_no_power = expr.replace('**', '')
    other_ops = len([c for c in expr_no_power if c in ['+', '-', '*', '/']])
    
    return power_count + other_ops

def extract_numbers(expr):
    """提取表达式中的所有数字"""
    pattern = r'\d+'
    return [int(m) for m in re.findall(pattern, expr)]

def is_difficult_enough(eq):
    """检查公式是否足够复杂 - 严格版本"""
    left = eq.split('=')[0]
    
    # 过滤简单的运算模式
    if '*1' in left or '/1' in left or '+0' in left or '-0' in left:
        return False
    
    # 提取所有数字
    numbers = extract_numbers(left.replace('**', ''))
    
    # 至少要有一些两位数的数字，或者较大的个位数
    if all(n < 10 for n in numbers):
        if max(numbers) < 6:
            return False
    
    # 不能有太多相同的数字
    if len(set(numbers)) < 3 and len(numbers) >= 4:
        return False
    
    # 检查是否有重复的简单模式
    if re.search(r'[+-]1\*[1-9]', left) or re.search(r'[+-][1-9]\*1', left):
        return False
    
    left_no_power = left.replace('**', '')
    ops = [c for c in left_no_power if c in ['+', '-', '*', '/']]
    
    if not ops or len(ops) < 3:
        return False
    
    # 必须包含 * 或 /
    if '*' not in ops and '/' not in ops:
        return False
    
    # 不能全是 + 或 -
    if all(op in ['+', '-'] for op in ops):
        return False
    
    # 连续 + 或 - 不能超过2个
    max_consecutive = 0
    current = 0
    for op in ops:
        if op in ['+', '-']:
            current += 1
            max_consecutive = max(max_consecutive, current)
        else:
            current = 0
    
    if max_consecutive > 2:
        return False
    
    # 检查结果是否太小
    try:
        result = int(eq.split('=')[1])
        if result < 6:
            return False
    except:
        pass
    
    return True

def generate_formulas():
    """随机生成复杂公式"""
    formulas = set()
    
    ops = ['+', '-', '*', '/']
    
    # 所有可能的运算符组合（至少4个运算符）
    op_combinations = []
    for op1 in ops:
        for op2 in ops:
            for op3 in ops:
                # 跳过全是+/-的组合
                if not (op1 in ['+', '-'] and op2 in ['+', '-'] and op3 in ['+', '-']):
                    op_combinations.append((op1, op2, op3))
    
    # 随机打乱组合
    random.shuffle(op_combinations)
    
    # 模式1: a op1 b**c op2 d op3 e = result
    print("生成模式1: a op1 b**c op2 d op3 e...")
    for op1, op2, op3 in op_combinations:
        for base, exp, power_str, _ in POWERS:
            # 随机选择数字范围，确保复杂度
            attempts = 0
            max_attempts = 2000
            
            while attempts < max_attempts and len(formulas) < TARGET_COUNT * 3:
                attempts += 1
                
                # 随机选择数字，偏向较大的数字
                a = random.randint(3, 99)
                d = random.randint(3, 49)
                e = random.randint(3, 19)
                
                # 避免使用1和2（太简单）
                if a <= 2 or d <= 2 or e <= 2:
                    continue
                
                a_str = str(a)
                d_str = str(d)
                e_str = str(e)
                
                # 检查长度限制
                if len(a_str) > 2 or len(d_str) > 2 or len(e_str) > 1:
                    continue
                
                expr = f"{a_str}{op1}{power_str}{op2}{d_str}{op3}{e_str}"
                result = evaluate_expression(expr)
                
                if result is not None and result >= 0:
                    result_str = str(result)
                    eq = f"{expr}={result_str}"
                    if len(eq) == TARGET_LENGTH:
                        if not eq.split('=')[0].startswith(('2**', '3**', '4**', '5**')):
                            formulas.add(eq)
                            if len(formulas) >= TARGET_COUNT * 3:
                                break
            
            if len(formulas) >= TARGET_COUNT * 3:
                break
    
    # 模式2: a op1 b op2 c**d op3 e = result
    print("生成模式2: a op1 b op2 c**d op3 e...")
    if len(formulas) < TARGET_COUNT * 3:
        random.shuffle(op_combinations)
        for op1, op2, op3 in op_combinations:
            for base, exp, power_str, _ in POWERS:
                attempts = 0
                max_attempts = 2000
                
                while attempts < max_attempts and len(formulas) < TARGET_COUNT * 3:
                    attempts += 1
                    
                    a = random.randint(3, 99)
                    b = random.randint(3, 49)
                    e = random.randint(3, 19)
                    
                    if a <= 2 or b <= 2 or e <= 2:
                        continue
                    
                    a_str = str(a)
                    b_str = str(b)
                    e_str = str(e)
                    
                    if len(a_str) > 2 or len(b_str) > 2 or len(e_str) > 1:
                        continue
                    
                    expr = f"{a_str}{op1}{b_str}{op2}{power_str}{op3}{e_str}"
                    result = evaluate_expression(expr)
                    
                    if result is not None and result >= 0:
                        result_str = str(result)
                        eq = f"{expr}={result_str}"
                        if len(eq) == TARGET_LENGTH:
                            if not eq.split('=')[0].startswith(('2**', '3**', '4**', '5**')):
                                formulas.add(eq)
                                if len(formulas) >= TARGET_COUNT * 3:
                                    break
                
                if len(formulas) >= TARGET_COUNT * 3:
                    break
    
    return formulas

def main():
    print(f"生成长度为 {TARGET_LENGTH} 的特殊公式（复杂随机版）...")
    print("要求：必须包含 **（幂运算），总共至少4个运算符，不以**开头，足够复杂")
    print(f"目标：生成 {TARGET_COUNT} 个有效公式\n")
    
    formulas = generate_formulas()
    print(f"\n生成候选公式: {len(formulas)} 个")
    
    # 验证并筛选
    valid_formulas = []
    formulas_list = list(formulas)
    random.shuffle(formulas_list)  # 随机打乱候选公式
    
    for eq in formulas_list:
        if len(eq) != TARGET_LENGTH:
            continue
        
        parts = eq.split('=')
        if len(parts) != 2:
            continue
        
        left = parts[0]
        if '**' not in left:
            continue
        
        if left.startswith(('2**', '3**', '4**', '5**', '6**', '7**', '8**', '9**', '10**')):
            continue
        
        expected = int(parts[1])
        actual = evaluate_expression(left)
        
        if actual is not None and actual == expected and actual >= 0:
            ops_count = count_operators(left)
            if ops_count >= 4 and is_difficult_enough(eq):
                valid_formulas.append(eq)
                if len(valid_formulas) >= TARGET_COUNT * 2:
                    break
    
    # 随机打乱并去重
    valid_formulas = list(set(valid_formulas))
    random.shuffle(valid_formulas)
    valid_formulas = valid_formulas[:TARGET_COUNT]
    
    print(f"有效公式: {len(valid_formulas)} 个")
    
    if len(valid_formulas) == 0:
        print("\n调试信息：")
        if formulas:
            sample = random.sample(list(formulas), min(5, len(formulas)))
            print(f"  候选公式示例: {sample}")
            for eq in sample:
                left = eq.split('=')[0]
                ops_count = count_operators(left)
                print(f"    {eq} -> 运算符数: {ops_count}, 难度检查: {is_difficult_enough(eq)}")
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    plugin_dir = os.path.dirname(script_dir)  # 向上到达插件根目录
    output_dir = os.path.join(plugin_dir, 'resources/math/special')
    os.makedirs(output_dir, exist_ok=True)
    
    output_file = os.path.join(output_dir, f'length_{TARGET_LENGTH}.json')
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(valid_formulas, f, ensure_ascii=False, indent=2)
    
    print(f"✓ 已保存到 {output_file}")
    
    if valid_formulas:
        print("\n示例公式（前10个，已随机排序）：")
        for i, eq in enumerate(valid_formulas[:10]):
            ops_count = count_operators(eq.split('=')[0])
            nums = extract_numbers(eq.split('=')[0])
            print(f"  {i+1}. {eq} (运算符数: {ops_count}, 数字: {nums})")
    else:
        print("\n警告: 未生成任何有效公式！")

if __name__ == '__main__':
    main()
