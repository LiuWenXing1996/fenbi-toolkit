# COMMITTING.md — 项目提交规则

面向 AI 协作的提交约束，共两条：**敏感信息检查**与**提交信息规范**。任何 `git commit` 前必须先通过检查并按规范书写，未通过禁止提交，不得以「样本数据」「历史归档」等理由放行。

## 一、敏感信息检查

待提交的全部文件（`git status` 中的 staged + untracked），涵盖但不限于：`src/`、`samples/`（抓包样例）、`legacy/`（归档）、`package.json` 等配置文件。只检查将被提交的内容，`node_modules/`、`dist/` 已被 `.gitignore` 排除，无需扫描。

### 必须拦截并处置的项

| 类别 | 特征 / 示例 | 处置 |
|---|---|---|
| 凭据 | 密码、Cookie、`Authorization`/`Bearer`、`session id`、`access_token` | 一律剔除 |
| 密钥前缀 | `ghp_`(GitHub)、`sk-`(OpenAI)、`AKIA`(AWS)、`eyJ`(JWT)、`-----BEGIN …PRIVATE KEY-----` | 一律剔除 |
| 个人数据 | 11 位真实手机号（`1[3-9]` 开头）、邮箱、18 位身份证号、学员/用户私密资料 | 一律剔除 |
| 持久标识 | `deviceId`、`openid`/`unionid` 等可关联账号/设备的参数 | 打码为占位符，如 `v1_masked_device_id` |
| 时效签名 URL | 如腾讯云 VOD `episodeVideoUrl` 中的 `t/us/sign` 防盗链签名 | 仓库非私有前视为风险；按需打码或移除 |

### 常见误报（无需拦截）

- 13 位时间戳（如 `1783990800000`）——易被手机号正则误匹配
- `materialIdBinary` 等 18 位业务 ID
- `avatar` 哈希文件名（如 `19407933436c6d4.jpg`）——前 11 位可能形似手机号
- 匿名接口随机参数（`exercise`/`solution` 的 `key=`，无用户绑定）

### 执行流程

1. `git status --short` 确认本次待提交清单与范围。
2. 对清单内全部文本执行扫描（见下方命令模板）。
3. 逐条命中判定：真实敏感 → 打码 / 剔除 / 说明保留理由；命中但属上表「常见误报」→ 放行并注明。
4. 全部确认干净后，才允许 `git add` + `git commit`。

### 扫描命令模板

在项目根目录执行（已排除 `node_modules`、`dist`、锁文件；命中后逐行人工判定）：

```bash
# 1) 凭据与密钥特征（含已知密钥前缀 / JWT / 私钥块）
grep -rniE --exclude-dir={node_modules,dist,.git} --exclude=package-lock.json \
  '(ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{20,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|BEGIN (RSA|OPENSSH|PRIVATE) KEY|"password"|"passwd"|set-cookie|cookie[:=]|session[_-]?id|authorization[:=]|bearer )' .

# 2) 持久标识残留（如 deviceId 原始值）
grep -rniE --exclude-dir={node_modules,dist,.git} 'deviceId=v1_|openid|unionid' .

# 3) 手机号 / 邮箱 / 身份证（注意排除误报后再判定）
grep -rnE --exclude-dir={node_modules,dist,.git} \
  '([^0-9]|^)(1[3-9][0-9]{9})([^0-9]|$)|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|[0-9]{17}[0-9Xx]' .

# 4) 时效签名 URL（腾讯云 VOD 等）
grep -rnE --exclude-dir={node_modules,dist,.git} '[?&](sign|sig|token|t)=[A-Za-z0-9]+' samples/
```

## 二、提交信息规范（Commit Message）

提交信息使用中文，遵循 Conventional Commits 前缀格式。

- **单行摘要**：`<type>: <subject>`，如 `docs: 补充提交规则`、`chore: 样例数据脱敏`
- **type 取值**：`feat` 新功能 / `fix` 缺陷修复 / `refactor` 行为等价重构 / `docs` 文档与注释 / `chore` 构建、配置与杂项（含样例数据打码）/ `test` 测试 / `perf` 性能
- **subject**：简洁中文短语，直陈完成的事，不加句末标点
- **正文（可选）**：需要说明动机或破坏性变更（标注 `BREAKING CHANGE`）时，空一行后以要点补充
- **克制**：小改动（单文件打码、注释修订等）单行摘要即可，不为凑篇幅堆正文
