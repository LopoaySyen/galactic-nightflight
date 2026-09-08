"""Individually scored revisions of the twelve companion pieces.

Phrase starts are seconds; note positions and accompaniment offsets are beats.
R = regional motif, M = album motif, A = the piece's own answering melody.
The notation deliberately includes rests, solo passages and changing voicings.
"""


def phrase(start, source, rhythm, chord=None, voicing='root', level=.9,
           variant='original', register=0, sustain=4.8):
    return dict(start=start, source=source, rhythm=rhythm, chord=chord,
                voicing=voicing, level=level, variant=variant,
                register=register, sustain=sustain)


def glow(start, duration, notes, level=.0023):
    return dict(kind='harmonic-glow', start=start, duration=duration,
                notes=notes, level=level)


def air(start, duration, kind='sail-air', level=.0017):
    return dict(kind=kind, start=start, duration=duration, level=level)


ARRANGEMENTS = {
    '01-stellar-tides': dict(
        character='温暖琴音 · 星潮舒展', colour='warm', room=(.085, .72),
        description='琴句逐渐舒展，再收成片段；两次低柔和声在间歇中浮起。',
        phrases=[
            phrase(2.5, 'R', [0,2.4,5.5], 'D', level=.78, variant='fragment'),
            phrase(19, 'A', [0,2,4.5,7,10], 'B', 'open', .87),
            phrase(37, 'R', [0,2.8,5,8,11.5], 'G', 'answer', .95),
            phrase(56, 'M', [0,2.5,5.8,8.7,12], 'D', 'open', 1.02),
            phrase(77, 'R', [0,2.3,4.9,8,11], 'G', 'third', .96, 'answer'),
            phrase(96, 'A', [0,3.2,7], level=.80),
            phrase(116, 'M', [0,3.8,9], 'D', level=.70, variant='fragment'),
        ], cues=[glow(44,11,[50,57]), glow(102,12,[55,62],.0019)]),
    '02-golden-orbits': dict(
        character='轻缓三拍 · 温柔回旋', colour='soft', room=(.075, .66),
        description='三拍琴句在高低声部间回旋；改变重音与结尾，保留纯钢琴。',
        phrases=[
            phrase(3, 'R', [0,2,4.5,7,10], 'G', 'answer', .82, 'answer'),
            phrase(19, 'A', [0,2.5,5,8,11], 'A', level=.9),
            phrase(36, 'R', [0,3,7], level=.77, variant='fragment'),
            phrase(54, 'M', [0,2,4.5,7,10.5], 'D', 'open', .98),
            phrase(75, 'R', [0,2.5,5.5,8.5,12], 'B', 'answer', .91, 'retrograde'),
            phrase(94, 'A', [0,3,6,9,12.5], 'G', level=.83),
            phrase(116, 'M', [0,3,8], 'D', level=.69, variant='fragment'),
        ], cues=[]),
    '03-nebula-lanterns': dict(
        character='疏落灯影 · 低柔和声', colour='soft', room=(.10, .86),
        description='孤立的短句渐渐相遇；两处柔和泛音像远处的灯，避免明亮敲击声。',
        phrases=[
            phrase(4, 'R', [0,3.4,7.5], level=.78, variant='fragment'),
            phrase(26, 'A', [0,2.7,5.5,8.8,12.3], 'B', level=.86),
            phrase(48, 'R', [0,3.2,7,10.2,14], 'E', 'open', .90, 'answer'),
            phrase(73, 'M', [0,3,6.4,10,14], 'E', 'third', .96, 'rising-sequence'),
            phrase(97, 'R', [0,4,8.5], level=.80, variant='fragment'),
            phrase(124, 'M', [0,3.7,9], 'D', level=.70, variant='fragment'),
        ], cues=[glow(58,12,[59,66],.0019), glow(111,10,[57,64],.0016)]),
    '04-heart-of-light': dict(
        character='暖光渐盛 · 安静回落', colour='warm', room=(.07, .64),
        description='中段通过开放和声与稍完整的句子升温，尾声撤去伴奏并放慢收束。',
        phrases=[
            phrase(3, 'R', [0,2.6,6], 'D', level=.78, variant='fragment'),
            phrase(19, 'A', [0,2,4.6,7.5,10.5], 'G', level=.86),
            phrase(35, 'R', [0,2.7,5,8,11.2], 'B', 'open', .93, 'answer'),
            phrase(52, 'R', [0,2.5,5.3,8.5,12], 'D', 'third', .99),
            phrase(72, 'M', [0,2.8,6.2,9,13], 'G', 'open', 1.02),
            phrase(91, 'A', [0,3,6,9.5,13], 'B', 'answer', .91),
            phrase(108, 'R', [0,3.5,8], level=.76, variant='fragment'),
            phrase(126, 'M', [0,4.5], 'D', level=.66, variant='head'),
        ], cues=[glow(62,11,[50,57],.0021)]),
    '05-spiral-letters': dict(
        character='琴句问答 · 远行与回望', colour='soft', room=(.09, .83),
        description='高声部写下一句，低声部稍后回应；结尾只留下共同动机的两个音。',
        phrases=[
            phrase(3, 'R', [0,2.6,6,9,12], 'D', 'answer', .84),
            phrase(24, 'A', [0,3.4,6.8,10,13.5], 'G', level=.9),
            phrase(45, 'R', [0,4,9], level=.75, variant='fragment'),
            phrase(68, 'M', [0,3.2,6.4,10,14], 'B', 'open', .94),
            phrase(93, 'R', [0,3.5,7,10.7,14.5], 'E', 'answer', .83, 'retrograde'),
            phrase(120, 'M', [0,7], level=.68, variant='head', sustain=6),
        ], cues=[]),
    '06-dust-sails': dict(
        character='稀疏琴音 · 轻风过帆', colour='distant', room=(.085, .92),
        description='三拍的重心逐渐松开，长句之间偶有低柔气流经过，尾音慢慢远去。',
        phrases=[
            phrase(5, 'R', [0,3.5,8,12,16], level=.80, sustain=5.5),
            phrase(32, 'A', [0,3,6.7,10.5,14.5], 'B', level=.87, sustain=5.5),
            phrase(62, 'M', [0,3.5,7.5,11.5,16], 'E', 'open', .92, sustain=5.5),
            phrase(93, 'R', [0,4,8.5,13,17], level=.80, variant='inversion', sustain=5.8),
            phrase(121, 'M', [0,3.8,8.2], 'D', level=.68, variant='fragment', sustain=5.5),
        ], cues=[air(22,8.5,level=.0038), air(82,9,level=.0038), air(130,8.5,level=.0032)]),
    '07-blue-crossing': dict(
        character='两岸琴音 · 轻声相望', colour='soft', room=(.08, .78),
        description='主旋律与低音回答交换位置；共同动机在中段低一个八度出现。',
        phrases=[
            phrase(2, 'R', [0,3,7], 'E', level=.80, variant='fragment'),
            phrase(23, 'A', [0,2.7,5.7,9,12.5], 'D', 'answer', .90),
            phrase(45, 'R', [0,3.3,6.8,10.2,14], 'G', level=.85, variant='answer'),
            phrase(67, 'M', [0,3,6.6,10.5,14.5], level=.88, register=-12, sustain=5.4),
            phrase(91, 'A', [0,3.1,6.5,10,13.8], 'B', 'answer', .88),
            phrase(115, 'M', [0,4,9.5], 'D', level=.68, variant='fragment', sustain=5.5),
        ], cues=[]),
    '08-small-blue-home': dict(
        character='温柔摇曳 · 归家回应', colour='warm', room=(.065, .6),
        description='以柔软的三度和声回应短句，中段轻轻展开，最后落回安稳的主音。',
        phrases=[
            phrase(2.5, 'R', [0,2.7,6], 'D', level=.81, variant='fragment'),
            phrase(22, 'A', [0,2.6,5.2,8.4,12], 'G', 'third', .91),
            phrase(44, 'R', [0,3.1,6.5,10,13.5], 'B', 'answer', .87, 'answer'),
            phrase(66, 'M', [0,3,6.3,9.6,13.5], 'D', 'third', .97),
            phrase(89, 'A', [0,3.2,6.6,10.3,14], 'G', level=.86),
            phrase(115, [62,69,64,62], [0,3.2,7,11], 'D', level=.71, sustain=5.5),
        ], cues=[]),
    '09-leaves-in-starlight': dict(
        character='柔软三拍 · 叶间微风', colour='soft', room=(.07, .72),
        description='错开三拍句尾的停顿，用少量叶间窸窣连接段落，生机来自起伏而非繁忙音符。',
        phrases=[
            phrase(3.5, 'R', [0,2.8,6.4], 'G', level=.8, variant='fragment'),
            phrase(24, 'A', [0,2.5,5.3,8.6,12.5], 'B', 'answer', .90),
            phrase(46, 'R', [0,3.3,6.8,10.4,14.5], level=.85, variant='answer'),
            phrase(69, 'M', [0,3,6.4,10.2,14.5], 'E', 'third', .95, 'rising-sequence'),
            phrase(92, 'A', [0,3.5,7,10.8,15], 'D', level=.84),
            phrase(116, 'M', [0,4.2,9], 'D', level=.69, variant='fragment'),
        ], cues=[air(16,6.5,'leaf-air',.0045), air(57,8,'leaf-air',.005), air(128,6,'leaf-air',.0035)]),
    '11-distant-snow': dict(
        character='孤远琴音 · 缓缓飘落', colour='distant', room=(.11, 1.04),
        description='减少低音支撑，逐渐放大音符间距；只有钢琴与较远的自然尾音。',
        phrases=[
            phrase(5, 'R', [0,4,9], level=.8, variant='fragment', sustain=6.4),
            phrase(34, 'A', [0,3.5,7.2,11,15], 'E', level=.87, sustain=6.4),
            phrase(65, 'M', [0,3,6.6,10.2,14], 'B', level=.9, sustain=6.5),
            phrase(96, 'R', [0,4,8.5,13.5], level=.78, variant='retrograde', sustain=6.7),
            phrase(120, 'M', [0,4,8.5], level=.66, variant='fragment', sustain=6),
        ], cues=[]),
    '12-unanswered-light': dict(
        character='未尽琴句 · 更长的安静', colour='distant', room=(.10, 1.1),
        description='四段不等长的独白，中间留出较长等待；末尾停在悬而未决的片段。',
        phrases=[
            phrase(6, 'R', [0,4,8,13], level=.82, sustain=6.8),
            phrase(42, 'R', [0,4.3,9,14], 'E', level=.84, variant='inversion', sustain=6.8),
            phrase(79, 'M', [0,3,6.5,10.5,15.5], 'B', level=.9, sustain=6.8),
            phrase(120, 'M', [0,4,10.5], level=.66, variant='fragment', sustain=6.4),
        ], cues=[]),
    '13-last-lighthouse': dict(
        character='远处五度 · 最后的归音', colour='soft', room=(.105, 1.0),
        description='孤立的五度间歇归来，回答声逐次变轻，最终用低声主音收束。',
        phrases=[
            phrase(4, 'R', [0,6], level=.79, variant='head', sustain=6.5),
            phrase(32, 'A', [0,3.5,7,10.5,15], 'G', level=.86, sustain=6.2),
            phrase(65, 'M', [0,3.2,6.8,11,15.5], 'D', level=.93, sustain=6.2),
            phrase(99, 'R', [0,3.7,7.7,11], level=.77, sustain=6.5),
            phrase(130, [57,62,50], [0,4.5,9], level=.68, sustain=6.2),
        ], cues=[]),
}
