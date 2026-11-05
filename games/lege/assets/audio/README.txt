音频文件说明 (《美少女了个美》AnimeStack v3.3)

voice/<id>.mp3  角色语音 25 句。AivisSpeech 合成：tools/generate_voices.mjs (情绪标签 -> 风格, 语速 1.15~1.22x, 短停顿, 每句 8 个版本)
                -> tools/voice_post.py (混响/EQ/-20 LUFS) -> tools/pick_voice_takes.py (语音识别过滤读错的版本, 挑表现力最强的一条)。
                台词、声线与署名见 src/config/VoiceConfig.js；游戏内「设置 -> 制作人员」显示 CV 与署名。
                署名：リダ https://youtube.com/channel/UC2tX473Zo09ZCnhAUNdAvjA/join (作者规约：商用可，须署名，禁止暴力/色情用途)；
                      Tαkoe:AivisSpeech:黄金笑 (Tαkoeプロジェクト利用規約：商用・法人可，须著作权表示)。
                只使用允许法人直接商用的模型 (v3.3 起)；条款原文见 docs/licenses/。
                未使用 リアボVC 系列模型。合成语音，与 VTuber 本人及原作无关。
bgm/bgm_{menu,game,hell}.ogg / .mp3  原创 BGM《樱花便当》《午休三连》《满槽警报》，由 tools/compose_bgm.py 程序化作曲，-22 LUFS，无缝循环。
音效：不使用文件，由 src/systems/SfxEngine.js 用 WebAudio 实时合成；响度校准值在 src/config/SfxTrim.js (node tools/measure_audio.mjs --calibrate)。
