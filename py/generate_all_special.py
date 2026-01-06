#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
运行所有特殊公式生成脚本
生成长度为 12、14、16 的公式（每个都包含**，至少4个运算符）

功能：
- 如果文件已存在，读取已有公式
- 继续生成新公式
- 合并新旧公式并去重
- 最后合并所有公式到 all.json，并随机排序
"""
import subprocess
import os
import sys
import json
import random

def load_existing_formulas(length, plugin_dir):
    """加载已存在的公式"""
    output_dir = os.path.join(plugin_dir, 'resources/math/special')
    length_file = os.path.join(output_dir, f'length_{length}.json')
    
    if not os.path.exists(length_file):
        return []
    
    try:
        with open(length_file, 'r', encoding='utf-8') as f:
            formulas = json.load(f)
            if isinstance(formulas, list):
                return formulas
            else:
                return []
    except:
        return []

def merge_and_save_formulas(length, existing_formulas, new_formulas, plugin_dir):
    """合并新旧公式并保存"""
    output_dir = os.path.join(plugin_dir, 'resources/math/special')
    length_file = os.path.join(output_dir, f'length_{length}.json')
    
    # 合并所有公式并去重
    all_formulas = list(set(existing_formulas + new_formulas))
    
    # 随机打乱
    random.shuffle(all_formulas)
    
    # 保存
    os.makedirs(output_dir, exist_ok=True)
    with open(length_file, 'w', encoding='utf-8') as f:
        json.dump(all_formulas, f, ensure_ascii=False, indent=2)
    
    return len(all_formulas), len(new_formulas)

def load_generated_formulas(length, plugin_dir):
    """加载生成脚本刚刚生成的公式"""
    output_dir = os.path.join(plugin_dir, 'resources/math/special')
    length_file = os.path.join(output_dir, f'length_{length}.json')
    
    if not os.path.exists(length_file):
        return []
    
    try:
        with open(length_file, 'r', encoding='utf-8') as f:
            formulas = json.load(f)
            if isinstance(formulas, list):
                return formulas
            else:
                return []
    except:
        return []

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))  # py/ 目录
    plugin_dir = os.path.dirname(script_dir)  # 插件根目录
    output_dir = os.path.join(plugin_dir, 'resources/math/special')
    
    # 确保输出目录存在
    os.makedirs(output_dir, exist_ok=True)
    
    scripts_config = [
        ('generate_length_12.py', 12),
        ('generate_length_14.py', 14),
        ('generate_length_16.py', 16)
    ]
    
    print("=" * 60)
    print("生成所有特殊公式（长度 12、14、16）")
    print("要求：必须包含 **（幂运算），总共至少4个运算符")
    print("每种长度生成 200 个公式")
    print("=" * 60)
    
    # 切换到脚本目录
    original_dir = os.getcwd()
    os.chdir(script_dir)
    
    try:
        for script, length in scripts_config:
            script_path = os.path.join(script_dir, script)
            length_file = os.path.join(output_dir, f'length_{length}.json')
            
            # 加载已存在的公式
            existing_formulas = load_existing_formulas(length, plugin_dir)
            existing_count = len(existing_formulas)
            
            if existing_count > 0:
                print(f"\n✓ length_{length}.json 已存在 ({existing_count} 个公式)")
                print(f"  继续生成新公式...")
            else:
                print(f"\n执行 {script}...")
            
            if not os.path.exists(script_path):
                print(f"\n✗ 找不到文件: {script}")
                continue
            
            # 运行生成脚本
            try:
                result = subprocess.run(
                    [sys.executable, script_path],
                    cwd=script_dir,
                    capture_output=True,
                    text=True,
                    timeout=600  # 10分钟超时
                )
                if result.stdout:
                    # 只显示关键信息
                    for line in result.stdout.split('\n'):
                        if '有效公式:' in line or '示例公式' in line or '警告:' in line:
                            print(f"  {line}")
                if result.stderr:
                    print(f"  警告: {result.stderr}")
            except subprocess.TimeoutExpired:
                print(f"  ⚠ {script} 执行超时")
                continue
            except Exception as e:
                print(f"  ✗ {script} 执行失败: {e}")
                continue
            
            # 加载新生成的公式（生成脚本会覆盖文件）
            new_formulas = load_generated_formulas(length, plugin_dir)
            new_count = len(new_formulas)
            
            if new_count > 0 or existing_count > 0:
                # 合并并保存（合并旧公式和新公式）
                total_count, _ = merge_and_save_formulas(
                    length, existing_formulas, new_formulas, plugin_dir
                )
                if existing_count > 0:
                    unique_new = total_count - existing_count
                    print(f"  ✓ 合并完成: 原有 {existing_count} 个，新增 {new_count} 个，去重后总计 {total_count} 个（实际新增 {unique_new} 个不重复公式）")
                else:
                    print(f"  ✓ 生成完成: 共 {total_count} 个公式")
            else:
                print(f"  ⚠ 未生成任何公式")
    finally:
        os.chdir(original_dir)
    
    print("\n" + "=" * 60)
    print("所有脚本执行完成！")
    print("=" * 60)
    
    # 合并所有文件
    print("\n合并所有公式到 all.json...")
    merge_all_formulas(plugin_dir)

def merge_all_formulas(plugin_dir=None):
    """合并所有长度的公式到一个文件"""
    if plugin_dir:
        output_dir = os.path.join(plugin_dir, 'resources/math/special')
    else:
        # 如果未提供插件目录，从当前脚本位置推导
        script_dir = os.path.dirname(os.path.abspath(__file__))
        plugin_dir = os.path.dirname(script_dir)
        output_dir = os.path.join(plugin_dir, 'resources/math/special')
    
    os.makedirs(output_dir, exist_ok=True)
    
    all_formulas = []
    
    for length in [12, 14, 16]:
        length_file = os.path.join(output_dir, f'length_{length}.json')
        if os.path.exists(length_file):
            try:
                with open(length_file, 'r', encoding='utf-8') as f:
                    formulas = json.load(f)
                    if isinstance(formulas, list) and len(formulas) > 0:
                        all_formulas.extend(formulas)
                        print(f"  ✓ 加载 length_{length}.json ({len(formulas)} 个公式)")
                    else:
                        print(f"  ⚠ length_{length}.json 为空或格式错误")
            except Exception as e:
                print(f"  ✗ 加载 {length_file} 失败: {e}")
        else:
            print(f"  ⚠ 找不到文件: length_{length}.json")
    
    # 去重并随机打乱
    all_formulas = list(set(all_formulas))
    random.shuffle(all_formulas)
    
    all_file = os.path.join(output_dir, 'all.json')
    with open(all_file, 'w', encoding='utf-8') as f:
        json.dump(all_formulas, f, ensure_ascii=False, indent=2)
    
    print(f"  ✓ 保存 all.json ({len(all_formulas)} 个公式，已随机排序)")

if __name__ == '__main__':
    main()
