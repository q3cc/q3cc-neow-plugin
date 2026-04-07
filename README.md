# q3cc-neow-plugin

一个带有“大喵喵”风格文案的游戏插件，目前主要提供账号信息系统、24 点题库玩法、密码破译玩法、Wordle 猜单词玩法与多人数字炸弹玩法。

当前版本：`v0.0.12`

## 功能简介

- 个人信息：`/my`
- Star 币排行榜：`/rank`
- 帮助菜单：`/nhelp`（兼容 `/neowhelp`）
- 在线检查：`/ping`
- 每日签到：`/sign`（兼容 `/签到`、`/qd`、`/checkin`）
- 查词：`/dict <单词>`（兼容 `/查词 <单词>`）
- 密码破译：`/ml`
- Wordle 猜单词：`/wordle`
- 数字炸弹：`/boom`
- 24 点菜单：`/24g`
- 24 点开局、五组题库抽题、难度切换、答题
- 好感度、体力、Star币 统一管理

## 指令列表

### 基础指令

- `/nhelp` - 获取帮助菜单
- `/neowhelp` - `/nhelp` 的兼容别名
- `/ping` - 检查插件是否在线
- `/my` - 查看自己的账号信息
- `/rank` - 查看 Star 币排行榜（优先发送图片，失败时降级文字；榜单优先显示昵称）
- `/sign` - 每日签到
- `/签到` / `/qd` / `/checkin` - 签到别名
- `/dict <英文单词>` - 查询有道词典释义、考试分类与词形变化
- `/查词 <英文单词>` - `/dict` 的中文别名
- `/ml` - 查看密码破译菜单
- `/ml start` - 开始一局密码破译
- `/ml difficulty` - 查看破译难度菜单
- `/ml difficulty <0-4>` - 设置破译难度
- `/ml mode` - 查看密码破译发送方式
- `/ml mode <auto|image|text>` - 设置密码破译发送方式
- `/ml <四位数字>` - 提交四位密码
- `/wordle` - 查看 Wordle 菜单
- `/wordle start` - 开始一局 Wordle
- `/wordle difficulty` - 查看 Wordle 难度菜单
- `/wordle difficulty <0-3>` - 设置 Wordle 难度
- `/wordle <五字母单词>` - 提交本局猜测
- `/boom` - 查看数字炸弹菜单或当前房间状态
- `/boom create` - 创建数字炸弹房间（兼容 `/boom creat`）
- `/boom join` - 加入当前群的数字炸弹房间
- `/boom start` - 房主开启 15 秒倒计时
- `/boom leave` - 退出房间，若已开局则视为主动 boom
- `/boom cancel` - 房主取消当前数字炸弹房间
- `/boom difficulty` - 查看数字炸弹难度菜单
- `/boom difficulty <0-3>` - 设置数字炸弹难度
- `/boom <数字>` - 在自己回合提交数字猜测

### 24 点指令

- `/24g` - 查看 24 点子菜单
- `/24g start` - 开始一局
- `/24g difficulty` - 查看难度菜单
- `/24g difficulty <0-3>` - 设置难度
- `/24g answer <答案>` - 提交答案

说明：
- 普通 / 困难模式下，回答 `y` 或 `n`
- 极限模式下，需要提交完整算式；若无解可回答 `no`
- 24 点会先从内置 `5` 个题库里随机选 `1` 个，再从该题库里抽题
- 每个题库各有 `1000` 道题
- 五个题库的有解/无解比例依次为：`0:10`、`3:7`、`5:5`、`7:3`、`10:0`
- 难度越高，越容易抽到高解率题库
- 极限模式仍然只校验你提交的算式结果是否为 `24`

## 难度规则

- `0 练习`：0 体力 / 0 奖励
- `1 普通`：10 体力 / 随机 `1-4 Star币`、`1-4 好感度`
- `2 困难`：20 体力 / 随机 `1-7 Star币`、`1-7 好感度`
- `3 极限`：30 体力 / 随机 `1-15 Star币`、`1-15 好感度`

24 点奖励缩减改为动态反作弊判定，会综合题目数字数量、是否要求算式、题库解率与作答时间计算。答错会扣除部分 Star币。

## 密码破译规则

- 输入格式：`/ml <四位数字>`
- 每局会生成一个 `4` 位密码
- `🟢` 表示数字和位置都正确
- `🟠` 表示数字存在但位置不对
- `🔴` 表示该数字不存在于答案中
- 不同难度拥有不同的体力消耗、时限与尝试次数限制
- 部分难度下，第 `5` 次答错会直接爆炸
- 可通过 `/ml mode auto|image|text` 设置优先使用图片或文字发送
- `4 另类极限` 会强制直接使用文字发送，避免限时场景被图片渲染拖慢
- 成功破译后会获得 `Star 币` 与好感度奖励
- 失败后会随机扣除一部分 `Star 币`

## Wordle 规则

- 输入格式：`/wordle <五字母英文单词>`
- 每局会从答案词库中随机生成一个 `5` 字母英文单词
- 只要输入单词存在于合法猜测词库中，就可以提交，不要求必须属于答案词库
- 难度 `0` 使用高考基础词库
- 难度 `1` 使用“高考基础词库 + 四级附加词库”
- 难度 `2` 使用“高考基础词库 + 四级附加词库 + 六级附加词库”
- 难度 `3` 使用原版 Wordle 答案词库
- `🟢` 表示字母和位置都正确
- `🟠` 表示字母存在但位置不对
- `🔴` 表示该字母不存在于答案中
- 色情或低俗英文词汇不会出现在题库中，也不能作为合法猜测提交
- 不同难度拥有不同的体力消耗、时限与尝试次数限制
- 结算时会显示答案单词的英/美音标与中文释义
- 成功猜出后会获得 `Star 币` 与好感度奖励
- 失败后会随机扣除一部分 `Star 币`

## 查词规则

- 输入格式：`/dict <英文单词>` 或 `/查词 <英文单词>`
- 使用有道词典接口查询单词
- 返回内容包含：单词本身、英/美音标、中文释义、考试分类、常见词形变化
- 色情或低俗英文词汇会被直接屏蔽，不返回查词结果
- 查询失败或词典暂无结果时，会提示重新换词

## 数字炸弹规则

- 仅支持群聊游玩，至少需要 `2` 人参与
- 建房指令：`/boom create`，加入指令：`/boom join`
- 房主使用 `/boom start` 后会进入 `15` 秒倒计时，倒计时内仍可继续加入
- 房间创建后若 `30` 分钟内仍未正式开始，会自动取消
- 玩家需要至少 `40` 枚 `Star 币` 才能建房或加入
- 开局时会按每位玩家的数字炸弹难度随机扣除部分 `Star 币` 填入奖池
- 炸弹固定藏在 `1-100` 之间，玩家按回合猜测 `/boom <数字>`
- 若猜中炸弹，则该玩家当场 `boom`，本局立刻结束
- 所有未爆玩家平分当前奖池，不额外发放好感度
- 数字炸弹与 `/ml`、`/wordle`、`/24g` 互斥，参加房间后不能再开启这三类游戏

## 文件结构

- `index.js` - 插件入口与版本日志
- `apps/neow.js` - Yunzai 实际注册的主插件类
- `utils/user-data.js` - 用户数据、UID 分配、好感度、体力、签到、帮助文案
- `utils/game24.js` - 24 点玩法配置、题库读取与奖励计算
- `utils/ml-game.js` - 密码破译玩法配置、状态与奖励计算
- `utils/ml-render.js` - 密码破译棋盘图片渲染
- `utils/blocked-words.js` - 统一管理色情/低俗英文词汇屏蔽
- `utils/wordle-game.js` - Wordle 猜单词配置、答案词/合法猜测词校验、状态与奖励计算
- `utils/wordle-dict.js` - 有道词典查询、释义解析与格式化
- `utils/wordle-render.js` - Wordle 棋盘与键盘图片渲染
- `utils/rank-render.js` - Star 币排行榜图片渲染与预览数据（榜单优先显示昵称）
- `utils/boom-game.js` - 数字炸弹房间状态、回合规则与奖池结算
- `utils/render-browser.js` - Puppeteer 浏览器实例复用
- `resources/rank-render-preview.html` - 排行榜图片预览 HTML
- `resources/wordle-words.json` - Wordle 答案词库
- `resources/wordle-allowed-guesses.json` - Wordle 合法猜测词库
- `resources/wordle-cn-gaokao-words.json` - Wordle 高考基础词库
- `resources/wordle-cn-cet4-words.json` - Wordle 四级附加词库（已去重）
- `resources/wordle-cn-cet6-words.json` - Wordle 六级附加词库（已去重）
- `scripts/generate-game24-bank.mjs` - 24 点单个题库生成脚本
- `scripts/generate-rank-render-preview.mjs` - 生成排行榜预览 HTML
- `SPEC.md` - 当前规则说明
- `AGENTS.md` - 协作与贡献说明

## 使用说明

1. 将插件放入机器人插件目录
2. 确保入口文件为 `index.js`
3. 重启机器人后查看日志：

```txt
---------^_^---------
neow插件v0.0.12初始化~
```

## 开发

修改后建议执行：

```bash
node --check index.js
node --check apps/neow.js
node --check utils/user-data.js
node --check utils/game24.js
node --check utils/ml-game.js
node --check utils/ml-render.js
node --check utils/rank-render.js
node --check utils/boom-game.js
node --check utils/blocked-words.js
node --check utils/wordle-dict.js
node --check utils/wordle-game.js
node --check utils/wordle-render.js
node --check utils/render-browser.js
node --check scripts/generate-rank-render-preview.mjs
node --test tests/blocked-words.test.js tests/boom-game.test.js tests/ml-game.test.js tests/user-data.test.js tests/wordle-dict.test.js tests/wordle-game.test.js tests/rank-render.test.js
node scripts/generate-rank-render-preview.mjs
```
