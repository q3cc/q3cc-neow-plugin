# q3cc-neow-plugin

一个带有“大喵喵”风格文案的游戏插件，目前主要提供账号信息系统、种田玩法、24 点题库玩法、密码破译玩法、Wordle 猜单词玩法与多人数字炸弹玩法。

当前版本：`v0.0.12`

## 功能简介

- 个人信息：`/my`
- Star 币排行榜：`/rank`
- 帮助菜单：`/nhelp`（兼容 `/neowhelp`）
- 在线检查：`/ping`
- 每日签到：`/sign`（兼容 `/签到`、`/qd`、`/checkin`）
- 查词：`/dict <词语>`（兼容 `/查词 <词语>`，支持 `/dict 1` 继续查看搜索结果）
- 种田：`/farm`
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
- `/dict <词语>` - 优先精确查词，失败时自动返回搜索结果
- `/dict <词语> -s` - 强制进入搜索模式
- `/dict <1-5>` - 查看上一轮搜索结果中对应编号的详细释义
- `/查词 <词语>` - `/dict` 的中文别名
- `/farm` - 查看农田总览
- `/farm help` - 查看种田指令帮助
- `/farm shop` - 查看当前等级可购买的种子商店
- `/farm buy <作物别名> [数量]` - 购买种子
- `/farm plant <地块号> <作物别名>` - 在指定地块播种
- `/farm water <地块号|all>` - 给一块地或全部可浇水地块浇水
- `/farm harvest <地块号|all>` - 收获成熟作物
- `/farm bag` - 查看农场背包（含宠物粮）
- `/farm sell seed <作物别名> <数量|all>` - 回收背包里的种子
- `/farm sell <作物别名> <数量|all>` - 卖出背包里的作物
- `/farm order` - 查看订单板
- `/farm deliver <订单号>` - 交付订单
- `/farm quest` - 查看三条主线任务进度
- `/farm land` - 查看 15 块地与购买条件
- `/farm buyplot <地块号>` - 购买已解锁地块
- `/farm visit <UID>` - 参观目标农场
- `/farm steal <UID> <地块号>` - 尝试偷成熟作物
- `/farm pet` - 查看宠物与看家状态
- `/farm pet shop` - 查看宠物与宠物粮商店
- `/farm pet buy <petAlias>` - 购买宠物
- `/farm pet food buy <foodAlias> [数量]` - 购买宠物粮
- `/farm pet use <petAlias>` - 切换当前驻守宠物
- `/farm pet feed <foodAlias> [数量]` - 给当前驻守宠物喂食
- `/farm addon` - 管理员查看 farm 附加件状态
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

## 种田规则

- 种田是长期养成系统，不与 `/ml`、`/wordle`、`/boom`、`/24g` 互斥
- 农场按用户维度持久化，首次进入默认拥有 `5` 块普通地，并发放新手种子包：`白萝卜 x4`、`卷心菜 x2`、`番茄 x2`
- 农场等级与主账号等级分离，经验主要来自收获、卖出、交订单、偷菜成功与主线奖励
- core addon 现内置 `25` 种作物，按 `Lv1 / Lv10 / Lv20 / Lv30 / Lv40` 五档解锁；`/farm shop` 会同时展示种子买入价、种子回收价与果实卖出价
- 农场总地块固定 `15` 块：`1-5` 普通地、`6-10` 黄土地、`11-15` 黑土地；使用 `/farm land` 查看解锁等级与价格，使用 `/farm buyplot` 购买
- 土地收益固定为：普通地 `产量 x1.0 / 成长 x1.0`、黄土地 `产量 x1.5`、黑土地 `产量 x2.0 / 成长 x0.85`
- `/farm order` 固定展示 `5` 个共享 `6` 小时倒计时的订单，订单会同时需求多种作物，使用 `/farm deliver <订单号>` 一次性交齐
- `/farm` 总览页默认展示快捷操作，完整指令说明统一放在 `/farm help`
- `/farm quest` 会展示 `新手教程 / 农场扩张 / 守卫家园` 三条一次性主线；完成教程末步后会自动补足到 `Lv20`
- `/farm visit` 与 `/farm steal` 在 `Lv20` 开放：每天最多 `5` 次尝试，每块地每轮作物最多成功被偷 `1` 次，且地主至少保留 `1` 个收成
- `/farm pet` 系统同样在 `Lv20` 开放：同一时间只能有 `1` 只宠物驻守，宠物粮会延长 `guardUntil`，总看家时长上限 `48h`
- `/farm bag` 会同时展示种子、作物与宠物粮；种子支持用 `/farm sell seed` 按买入价 `50%` 回收，且不会提供农场经验
- 地块、背包、订单都带快照，即使附加件被删除，旧存档仍可继续收获、卖出与交付

## farm 附加件

- farm 内容继续走“引擎 + 附加件数据包”模式，内置基础包位于 `resources/farm-core-addon.json`
- 外部附加件目录固定为 `data/q3cc-neow-plugin/addons/farm/*.json`，目录变更会触发自动热重载
- 当前同时兼容 `schemaVersion: 1` 与 `schemaVersion: 2`
- schema v2 在 v1 基础上新增：`crops[].unlockLevel`、`pets[]`、`petFoods[]`、`mainQuestChapters[]`
- `orderTemplates` 在 schema v1 / v2 下都兼容两种写法：旧的单作物 `cropAlias + qtyMin + qtyMax`，以及多作物 `requirements[]`
- 附加件仍然只允许声明固定字段，不支持任意脚本执行
- 冲突与错误处理保持“坏包跳过、旧 registry 保留”策略：重复 `id` 跳过、冲突 `alias` 整包跳过、坏引用模板单条跳过、整体重建失败则继续保留上一份可用 registry

## 查词规则

- 输入格式：`/dict <词语>`、`/查词 <词语>`、`/dict <词语> -s`、`/dict <1-5>`
- 默认先走有道 `jsonapi` 精确查词，查不到时自动回退到 suggest 搜索
- 使用 `-s` 时会直接跳过精确查词，强制返回搜索结果
- 精确查词命中时，返回内容包含：单词本身、英/美音标、中文释义、考试分类、常见词形变化
- 搜索模式同时支持中文和英文查询，默认展示前 `5` 条候选
- 搜索结果会临时缓存 `5` 分钟，可继续输入 `/dict 1` 查看第 `1` 条候选的详细释义
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
- `utils/farm-game.js` - farm 引擎、附加件装载、热重载与农场持久化
- `utils/game24.js` - 24 点玩法配置、题库读取与奖励计算
- `utils/ml-game.js` - 密码破译玩法配置、状态与奖励计算
- `utils/ml-render.js` - 密码破译棋盘图片渲染
- `utils/blocked-words.js` - 统一管理色情/低俗英文词汇屏蔽
- `utils/dict-selection.js` - 管理查词搜索结果的临时选择状态
- `utils/wordle-game.js` - Wordle 猜单词配置、答案词/合法猜测词校验、状态与奖励计算
- `utils/wordle-dict.js` - 有道词典查询、释义解析与格式化
- `utils/wordle-render.js` - Wordle 棋盘与键盘图片渲染
- `utils/rank-render.js` - Star 币排行榜图片渲染与预览数据（榜单优先显示昵称）
- `utils/boom-game.js` - 数字炸弹房间状态、回合规则与奖池结算
- `utils/render-browser.js` - Puppeteer 浏览器实例复用
- `resources/farm-core-addon.json` - farm 内置基础附加件
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
node --check utils/farm-game.js
node --check utils/user-data.js
node --check utils/game24.js
node --check utils/ml-game.js
node --check utils/ml-render.js
node --check utils/rank-render.js
node --check utils/boom-game.js
node --check utils/blocked-words.js
node --check utils/dict-selection.js
node --check utils/wordle-dict.js
node --check utils/wordle-game.js
node --check utils/wordle-render.js
node --check utils/render-browser.js
node --check scripts/generate-rank-render-preview.mjs
node --test tests/blocked-words.test.js tests/boom-game.test.js tests/dict-selection.test.js tests/farm-game.test.js tests/ml-game.test.js tests/user-data.test.js tests/wordle-dict.test.js tests/wordle-game.test.js tests/rank-render.test.js
node scripts/generate-rank-render-preview.mjs
```
