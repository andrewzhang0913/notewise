# NoteWise (智记) - 您的 AI 智慧副驾

[![GitHub release](https://img.shields.io/github/v/release/andrewzhang0913/notewise?style=flat-square)](https://github.com/andrewzhang0913/notewise/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Sponsor](https://img.shields.io/badge/支持作者-%E2%9D%A4-pink?style=flat-square)](https://github.com/sponsors/andrewzhang0913)

**NoteWise (智记)** 是一款为 Obsidian 打造的智能语音伴侣。它的名字蕴含"智慧记录"与"知己"双重含义，旨在通过 AI 技术更懂您的想法，将碎片化的语音转化为井井有条的智慧笔记。

> 🌏 [English README](./README.md)

---

## 💡 关于 NoteWise 与作者

你好，我是 **Andrew**——一名曾经的半导体工程师。

2024 年，我经历了职业生涯中最艰难的一章：失业。但我没有放弃，而是选择在家自学 AI 开发，独自踏上了创业之路。

**NoteWise 诞生于真实的需求。** 作为一个"想得比打字快"的人，我发现自己淹没在散乱的语音备忘和半成品笔记中。我需要一个工具能够：

- 在我**说话的同时**捕捉思绪
- 将混乱的语音转化为**结构化、专业的文字**
- 与我的 **Obsidian 第二大脑**无缝协作

于是，我亲手打造了它——在 AI 的辅助下，边学边做。

**这不是一个有融资的创业产品**——它是一个独立开发者在人生低谷期的心血之作。如果 NoteWise 对你有帮助，**请考虑支持它的持续开发**。每一份鼓励都是我坚持下去的动力。

---

## ✨ 核心功能

### 1. 🎙️ 智能语音捕获

- **自动切片录音**: 每 10 秒自动分割并上传，防止长录音数据丢失。
- **上下文连续对话**: 流式转写，支持对话上下文理解。
- **可视化反馈**: 实时音频波形显示录音状态。

### 2. 🎭 场景化润色模板

一键将口语转化为专业笔记：

| 模式 | 说明 |
|------|------|
| **📝 日记 (Journal)** | 将碎片想法整理为通顺的第一人称日记 |
| **👥 会议 (Meeting)** | 自动提取摘要、重点和待办事项 |
| **✅ 清单 (Checklist)** | 将口述指令拆解为 Markdown 任务列表 |

### 3. 🌐 智能互译 (Smart Swap)

- **零配置翻译**: 点击界面上的 **地球仪 (🌐)** 按钮即可开启。
- **自动逻辑**:
  - 输入 **中文** → 自动输出 **英文**
  - 输入 **英文** → 自动输出 **中文**
  - 关闭开关 → 严格保持 **原语言**

### 4. 🧠 双引擎支持

- **SiliconFlow (硅基流动)**: 推荐使用。低成本、高性能的 LLM 推理服务。
- **Dify (自建大脑)**: 支持连接您私有部署的 AI 工作流。

---

1. 从 [GitHub Releases](https://github.com/andrewzhang0913/notewise/releases) 下载最新版本
2. 解压到 `.obsidian/plugins/homenet-sync`
3. 在 Obsidian 设置中启用插件

---

## ❤️ 支持这个项目

如果 NoteWise 对您有帮助，请考虑支持它的持续开发。作为一个在职业转型期独自开发的个人项目，您的每一份支持对我来说都意义非凡。

### 🌟 支持方式

| 平台 | 链接 |
|------|------|
| **GitHub Sponsors** | [![Sponsor](https://img.shields.io/badge/Sponsor-GitHub-pink?style=flat-square&logo=github)](https://github.com/sponsors/andrewzhang0913) |
| **Buy Me a Coffee** | [![Buy Me a Coffee](https://img.shields.io/badge/请我喝咖啡-FFDD00?style=flat-square&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/andrewzhang0913) |
| **Star 仓库** | ⭐ 在 GitHub 上给项目点个星！ |

---

## 🛠️ 配置说明

| 设置项 | 说明 | 推荐值 |
| :--- | :--- | :--- |
| **SiliconFlow Key** | API 密钥 | (您的密钥) |
| **Refine Model** | 润色模型 | `Qwen/Qwen2.5-7B-Instruct` |
| **Save Audio** | 是否保存录音原文件 | `True` (开启) |

---

## 🤝 参与贡献

欢迎任何形式的贡献！无论是 Bug 反馈、功能建议还是代码 PR。

- 🐛 [报告问题](https://github.com/Andrew3QZ/notewise/issues)
- 💡 [功能建议](https://github.com/Andrew3QZ/notewise/issues)
- 🔧 [提交 PR](https://github.com/Andrew3QZ/notewise/pulls)

---

## 📄 开源协议

MIT License © 2024 [Andrew](https://github.com/Andrew3QZ)

---

*NoteWise (智记) - 更懂您的 AI 智慧伴侣。* 🧠✨
