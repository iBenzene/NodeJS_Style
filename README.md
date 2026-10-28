# 个人 Node.js 项目代码风格规范

以主流推荐规则集为基础，个人偏好优先，仅配置必要差异。统一使用 Prettier 格式化，并禁用 lint 中与之冲突的规则。

## 基础规则集

| 范围                          | 基础规则集                                                          |
| ----------------------------- | ------------------------------------------------------------------- |
| JavaScript / JSX              | ESLint `recommended`                                                |
| TypeScript / TSX / Vue Script | JS 推荐集 + TypeScript ESLint `flat/recommended`                    |
| Vue Template                  | Vue `flat/recommended`                                              |
| JSON / JSONC                  | JSONC 插件对应的 `recommended-with-json` / `recommended-with-jsonc` |
| CSS                           | `stylelint-config-standard`                                         |
| SCSS / Less                   | `stylelint-config-standard-scss` / `stylelint-config-standard-less` |
| 排版                          | Prettier 默认规则 + 下述项目偏好                                    |

TypeScript 使用不依赖类型信息的推荐集。JSX/TSX 暂未加入 React 专项规则。

## 引号规则

| 文件类型                          | 约定                                     |
| --------------------------------- | ---------------------------------------- |
| JS / MJS / CJS / TS               | 字符串优先单引号，插值使用模板字符串     |
| JSX / TSX                         | JS/TS 字符串单引号，JSX 属性双引号       |
| Vue                               | Script 字符串单引号，Template 属性双引号 |
| HTML                              | 属性双引号                               |
| Pug                               | 属性字符串优先单引号                     |
| CSS / SCSS / Sass / Less / Stylus | 字符串优先双引号                         |
| JSON / JSONC                      | 字符串和属性名必须双引号                 |
| YAML / YML                        | 无引号优先，保留类型或内容所需的引号     |
| .env                              | 无引号优先，特殊值按解析器规则加引号     |

允许用另一种引号减少转义，例如 JS 的 `"it's fine"`。YAML 中 `'1.0'` 等字符串不能因去掉引号而改变类型。

## 自定义规则

| 项目       | 规范                                                |
| ---------- | --------------------------------------------------- |
| 缩进       | 使用 4 个空格，禁止 Tab                             |
| 尾随逗号   | 禁止尾随逗号                                        |
| 属性排序   | 对象键与样式属性按字母升序排列，`package.json` 除外 |
| 箭头函数   | 单参数省略括号，禁止 `function` 回调                |
| 变量声明   | 禁止 `var`，优先使用 `const`                        |
| 未使用变量 | 禁止未使用的变量、参数及 `catch` 绑定               |
