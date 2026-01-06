# <img width="25px" src="resources/wordle.png"> Wordle 游戏插件 

> **版本：** fork-1.0.12  
> **更新日期：** 2026-01-06

基于原Wordle网页版的云崽Bot改版，原网页参考 https://wordle.org

## ✨ 功能特性

- 🎮 **单词游戏**：猜英文单词，支持 3-10 字母，多种词典可选
- 🔢 **数学公式游戏**：猜数学等式，支持普通公式和特殊公式（包含幂运算）
- 🀄 **成语游戏（汉兜）**：猜四字成语，支持拼音显示和拼音级别反馈
- 📊 **排行榜系统**：群排行榜和全局排行榜，支持胜场榜、参与榜、胜率榜
- 📚 **词典管理**：支持多种词典切换（四级、六级、专四、专八、GRE、TOEFL 等）
- 💬 **双场景支持**：支持群聊和私聊两种游戏场景
- 🎨 **可视化界面**：Canvas 渲染的游戏界面，直观显示猜测结果

如果插件使用有问题请反馈！关于 `canvas` 问题的可以看[这里](#-常见问题)

## 安装方法

### 1. 下载插件

#### Github源

```console
git clone --depth=1 https://github.com/QingYingX-Bot/wordle-plugin.git ./plugins/wordle-plugin
```

### 2. 安装依赖（By 千奈千祁）

#### Linux安装

##### I. Ubuntu / Debian

```console
sudo apt update
sudo apt install -y build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
```

##### I. CentOS / RHEL

```console
sudo yum install -y gcc-c++ cairo-devel pango-devel libjpeg-turbo-devel giflib-devel librsvg2-devel
```

##### II. 编译安装canvas

```console
cd plugins/wordle-plugin
npm i
npm install canvas --build-from-source
```

#### Windows & Other

```console
cd plugins/wordle-plugin
pnpm i
pnpm approve-builds
```

### 3. 重启云崽之后就可以食用啦

## 📚 常见问题

如果渲染报错，请尝试使用pnpm安装canvas依赖
```console
pnpm i canvas
```

如果报错日志里面的有 `canvas.node` 字样请考虑安装完依赖之后运行安装脚本……
```console
pnpm approve-builds
```

canvas还是有问题那就自己问AI自求多福吧……因为我也被canvas折磨好久才装上的……

## 🚀 使用方法

> 📖 **详细命令参考：** 查看 [COMMANDS.md](./COMMANDS.md) 获取完整命令列表和使用示例

<details>
<summary><b>📝 单词游戏命令（点击展开）</b></summary>

#### 开始游戏
```log
#word                # 开始新游戏（随机字母数）
#word 7              # 开始7字母游戏（支持3-10字母）
```

#### 提交猜测
```log
#apple               # 使用 # 前缀猜测单词
!apple               # 使用 ! 前缀猜测单词
```

#### 游戏管理
```log
#word 答案           # 结束当前游戏（显示答案）
#word ans            # 结束当前游戏（缩写）
#word 放弃           # 放弃当前游戏
```

#### 查看帮助
```log
#word 帮助           # 查看详细帮助信息
#word help           # 查看帮助（英文）
```

#### 词典管理
```log
#word 词典           # 循环切换词典
#word 词库           # 循环切换词库（同词典）
#word wordbank       # 循环切换词典（英文）
#word 词典 四级      # 切换到四级词典
#word 词典 六级      # 切换到六级词典
```

#### 排行榜
```log
#word 排行榜         # 查看群排行榜（默认胜场榜）
#word 榜             # 查看群排行榜（简写）
#word 排行榜 胜率    # 查看群胜率榜
#word 排行榜 参与    # 查看群参与榜
#word 总排行榜       # 查看全局排行榜
#word 总排行榜 胜率  # 查看全局胜率榜
```

#### 查询释义
```log
#释义 access         # 查询单词 access 的释义
```

</details>

---

<details>
<summary><b>🔢 数学公式游戏命令（点击展开）</b></summary>

#### 开始游戏
```log
#math                # 开始新游戏（默认长度12）
#Math                # 开始新游戏（首字母大写）
#数学                # 开始新游戏（中文）
#公式                # 开始新游戏（别名）
#math 10             # 开始长度10的游戏（支持5-12）
#math 特殊 14        # 开始长度14的特殊公式游戏（包含幂运算）
```

#### 提交猜测
```log
#123+456=579         # 使用 # 前缀猜测公式
!123+456=579         # 使用 ! 前缀猜测公式
```

#### 游戏管理
```log
#math 答案           # 结束当前游戏（显示答案）
#math ans            # 结束当前游戏（缩写）
#math 放弃           # 放弃当前游戏
```

#### 查看帮助
```log
#math 帮助           # 查看详细帮助信息
#math help           # 查看帮助（英文）
```

#### 分类管理
```log
#math 分类           # 查看所有公式分类
#math category       # 查看分类（英文）
```

#### 排行榜
```log
#math 排行榜         # 查看群排行榜（默认胜场榜）
#math 榜             # 查看群排行榜（简写）
#math 总排行榜       # 查看全局排行榜
```

</details>

---

<details>
<summary><b>🀄 成语游戏命令（点击展开）</b></summary>

#### 开始游戏
```log
#idiom                # 开始新游戏（默认四字成语）
#成语                 # 开始新游戏（中文）
#汉兜                 # 开始新游戏（别名）
```

#### 提交猜测
```log
#高山流水             # 使用 # 前缀猜测成语
!高山流水             # 使用 ! 前缀猜测成语
```

#### 游戏管理
```log
#idiom 答案           # 结束当前游戏（显示答案）
#idiom ans            # 结束当前游戏（缩写）
#idiom 放弃           # 放弃当前游戏
```

#### 查看帮助
```log
#idiom 帮助           # 查看详细帮助信息
#idiom help           # 查看帮助（英文）
```

#### 排行榜
```log
#idiom 排行榜         # 查看群排行榜（默认胜场榜）
#idiom 榜             # 查看群排行榜（简写）
#idiom 总排行榜       # 查看全局排行榜
```

</details>

---

### 💡 使用提示

1. **游戏模式**
   - 单词游戏：猜英文单词，支持 3-10 字母
   - 公式游戏：猜数学等式，支持 8-16 字符长度
   - 成语游戏：猜四字成语，支持拼音显示和反馈

2. **提交猜测**
   - 单词游戏：使用 `#单词` 或 `!单词` 格式
   - 公式游戏：使用 `#公式` 或 `!公式` 格式（必须包含等号）
   - 成语游戏：使用 `#成语` 或 `!成语` 格式（四字成语）

3. **支持场景**
   - ✅ 群聊：多人游戏，共享排行榜
   - ✅ 私聊：单人游戏，独立记录

4. **颜色提示**
   - 🟩 绿色：字符正确且位置正确
   - 🟨 黄色：字符存在但位置错误
   - ⬜ 灰色：字符不存在

5. **冷却时间**
   - 群冷却：1秒（防止刷屏）
   - 个人冷却：4秒（防止过快猜测）

---

## 🎉 正在使用本插件的Bot

- 小米糕 [官方群](https://qm.qq.com/q/1cHb5M08k)


## 👀 插件效果预览

<img src="https://gitee.com/pimeng/wordle-plugin/raw/main/resources/game-preview.png" width="60%" />

## 📝 更新日志

详细的更新日志请查看 [CHANGELOG.md](./CHANGELOG.md)

## 🤝 贡献

欢迎提交Issue和Pull Request来改进这个插件！

## 📄 许可证

本项目基于GPL-3.0许可证开源，您可以在遵守许可证条款的前提下自由使用、修改和分发本项目的代码。

## 🔗 联系我

- https://github.com/QingYingX
- https://gitee.com/QingYingX

> 本插件大量代码均由AI编写
