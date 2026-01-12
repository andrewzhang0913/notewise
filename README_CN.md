# NoteWise (智记) - 您的隐私优先 AI 智慧副驾

[![GitHub release](https://img.shields.io/github/v/release/andrewzhang0913/notewise?style=flat-square)](https://github.com/andrewzhang0913/notewise/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Sponsor](https://img.shields.io/badge/支持作者-%E2%9D%A4-pink?style=flat-square)](https://github.com/sponsors/andrewzhang0913)

**NoteWise (智记)** 是一款为 Obsidian 打造的智能语音伴侣，更是您连接 **HomeNet 私有云生态** 的入口。它旨在通过本地 AI 技术，在完全保护隐私的前提下，将您碎片化的语流转化为井井有条的智慧笔记。

> 🌏 [English README](./README.md)

---

## 🔒 隐私宣言与开源初心

在这个数据被随意搜刮的云时代，NoteWise 坚守 **"数据主权" (Data Sovereignty)**。我们认为，您的思想和记忆只属于您自己。

- **隐私优先 (Privacy First)**: 支持 **Ollama**、**Dify** 本地私有化部署。您的语音和文字可以完全不经过任何第三方服务器。
- **低门槛本地化**: 您不需要昂贵的服务器。只要有一台**中等性能的笔记本**（如 MacBook Air M1 或 16G 内存的 PC），即可通过本地大模型流畅运行，**不受网络限制**，断网亦可使用。
- **HomeNet 愿景**: NoteWise 是 **HomeNet 计划**的一部分——旨在构建一个独立、自治、智能的家庭数字大脑。本插件是连接您的大脑与数字知识库 (Brain) 的神经末梢。

---

## ✨ 核心功能

### 1. 🎙️ 智能语音捕获

- **自动切片**: 长录音自动分割保护，防止意外丢失。
- **上下文感知**: 像真正的秘书一样，根据您当前的笔记上下文进行转写。
- **可视化波形**: 沉浸式的录音体验。

### 2. 🧠 双引擎架构 (Hybrid Brain)

- **本地模式 (推荐)**:
  - 对接本地运行的 **Ollama** 或 **Dify**。
  - 体验 **0 延迟、0 成本、100% 隐私安全** 的 AI 服务。
- **云端模式 (便捷)**:
  - 同时也支持 **SiliconFlow (硅基流动)** 或 Groq 等高性能云服务，适合移动办公场景。

### 3. 🎭 场景化润色

一键将口语转化为专业笔记：

| 模式 | 说明 |
|------|------|
| **📝 日记 (Journal)** | 将碎片想法整理为通顺的第一人称日记 |
| **👥 会议 (Meeting)** | 自动提取摘要、重点和待办事项 |
| **✅ 清单 (Checklist)** | 将口述指令拆解为 Markdown 任务列表 |

### 4. 🌐 智能互译 (Smart Swap)

- **零配置翻译**: 点击 **地球仪 (🌐)** 即可启用。
- **智能逻辑**: 自动识别并互换中英文 (CN ↔ EN)，无需手动选择源语言。

---

## 🚀 快速上手

### 1. 安装

1. 在 Obsidian 社区插件市场搜索 **NoteWise** (审核中)。
2. 或从 [Release 页面](https://github.com/andrewzhang0913/notewise/releases) 下载 `main.js`, `manifest.json`, `styles.css` 放入 `.obsidian/plugins/notewise` 目录。

### 2. 推荐配置 (本地隐私版)

- **大模型服务**: 推荐安装 [Ollama](https://ollama.com)。
- **设置**: 在插件设置中选择 API Provider 为 **Local/Custom**，填入 `http://localhost:11434`。
- **硬件要求**: 任何 Apple Silicon Mac 或 近年发布的 Windows 笔记本 (推荐 16GB+ 内存)。

---

## ❤️ 支持 HomeNet 计划

**NoteWise** 是由 **Andrew** 独立开发的开源项目，也是 HomeNet 生态的第一块拼图。

如果您认同**"隐私为先"**和**"个人数字主权"**的理念，您的支持将帮助我继续完善这个生态系统。

| 平台 | 链接 |
|------|------|
| **GitHub Sponsors** | [![Sponsor](https://img.shields.io/badge/Sponsor-GitHub-pink?style=flat-square&logo=github)](https://github.com/sponsors/andrewzhang0913) |
| **Buy Me a Coffee** | [![Buy Me a Coffee](https://img.shields.io/badge/请我喝咖啡-FFDD00?style=flat-square&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/andrewzhang0913) |
| **Star 仓库** | ⭐ 为开源精神点亮一颗星！ |

---

## 🤝 参与贡献

欢迎每一位 HomeNet 架构师参与共建！

- 🐛 [报告问题](https://github.com/andrewzhang0913/notewise/issues)
- 🔧 [提交 PR](https://github.com/andrewzhang0913/notewise/pulls)

---

## 📄 开源协议

MIT License © 2024-2026 [Andrew](https://github.com/Andrew3QZ) | **HomeNet Ecosystem**
