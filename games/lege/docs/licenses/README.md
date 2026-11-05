# 第三方许可 / Third-party licenses

《美少女了个美》用到的第三方工具与语音模型的许可原文与作者条款（2026-10-11 从 AivisHub 模型清单、作者官方页面与官方仓库获取）。出品：狸猫。

| 文件 | 内容 |
|---|---|
| [Lida-voice-model.txt](Lida-voice-model.txt) | 「リダ / Lida」作者自定义条款全文：商用・非商用可；须署名「リダ」+ https://youtube.com/channel/UC2tX473Zo09ZCnhAUNdAvjA/join ；**条款可能随时变更** |
| [Kogane-Emi-voice-model.txt](Kogane-Emi-voice-model.txt) | 「黄金笑」(Tαkoeプロジェクト) 利用規約全文：商用・法人利用可；须著作权表示「Tαkoe:AivisSpeech:黄金笑」 |
| [AivisSpeech-Engine-terms.txt](AivisSpeech-Engine-terms.txt) | AivisSpeech Engine 的许可说明与官方 README 节选 |
| [AivisSpeech-Engine-LGPL-3.0.txt](AivisSpeech-Engine-LGPL-3.0.txt) | AivisSpeech Engine 的 LICENSE 全文（GNU LGPL v3.0） |
| [GPL-3.0.txt](GPL-3.0.txt) | GNU GPL v3.0 全文（LGPL v3.0 以 GPL v3.0 为基础，一并附上） |

## 声线选择依据（2026-10-11 核实）

本作由公司主体出品，只采用**条款明确允许法人 / 商用、且不需要事先联系权利方**的语音模型：

| 模型 | 结论 | 依据 |
|---|---|---|
| リダ / Lida | ✅ 采用 | 模型自定义许可：「使用条件及び、禁止事項の範囲内でご自由に商用・非商用問わずご利用いただけます」，条件是署名「リダ」+ URL（[模型页](https://hub.aivis-project.com/aivm-models/446d2053-14ca-4b68-897c-380faf555b59)） |
| 黄金笑 (Tαkoe) | ✅ 采用 | Tαkoeプロジェクト利用規約「利用許諾」：「非商用利用及び商用利用」「法人（法人格の無い団体等を含みます）の利用」，条件是著作权表示（[模型页](https://hub.aivis-project.com/aivm-models/734c12b6-eaf2-4dbd-8596-8663c72d2afa)，http://wedst.pj.ymhk.jp/tos.html） |
| コハク / まお (Trippy・Oz Chat) | ❌ 不再使用 | [Oz Chat 二次創作ガイドライン](https://0z.chat/wiki/fan_guidelines) 第4条2：「法人または営利事業者が二次創作活動を行う場合は、事前に当社窓口までお問い合わせください」；第7条把收益化限定在非营利范围 |
| 凛音エル (電脳天使工業) | ❌ 不再使用 | [官方利用規約](https://docs.google.com/document/d/1WyTx_lfrI-i2BFTlHDVlFTm27iSrLcwpOgHx45lYWhw/edit)（BOOTH 商品页指定）：「企業などでの利用については、電脳天使工業運営のXアカウント（@wangoroge_333）まで連絡をください」 |
| らせつん / みちのくあいり (こずかた学園) | ❌ 不再使用 | [こずかた学園プロジェクト ガイドライン](https://lit.link/en/kozukata-gakuen-guideline)：「企業、団体が長期にわたり商用利用する場合」须向运营方咨询 |

旧版 (v3.2 及以前) 用过的上述模型的语音已全部重新生成并替换，游戏包中不再包含。

说明：
- 全部台词都是用 AivisSpeech Engine 1.2.0 和上述模型预先合成好的 MP3（`assets/audio/voice/`）。游戏不包含、也不分发模型文件或引擎程序。
- 语音为 AI 合成，与 VTuber 本人及官方角色无关。
- 未使用 VOICEVOX 与 リアボVC 系列模型。
- BGM、音效、卡牌立绘、代码均为本作原创；Windows 桌面版使用的 Electron 自带 LICENSE 与 LICENSES.chromium.html（在 exe 同目录）。
