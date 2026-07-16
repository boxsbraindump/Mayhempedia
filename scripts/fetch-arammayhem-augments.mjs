import { readFile, writeFile, mkdir, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'data')
const ICON_DIR = join(DATA_DIR, 'icons', 'augments')
const ROOT = 'https://arammayhem.com'
const SOURCE = `${ROOT}/augments/`

const RARITY_NUM = { silver: 0, gold: 1, prismatic: 2 }
const RARITY_LABEL_ZH = { 0: '银 Silver', 1: '金 Gold', 2: '棱彩 Prismatic' }
const RARITY_LABEL_EN = { 0: 'Silver', 1: 'Gold', 2: 'Prismatic' }

const ZH_AUGMENT_NAMES = {
  'Adaptive Ward': '自适应守卫',
  'Biggest Snowball Ever': '史上最大雪球',
  'BONK!': '当头一棒！',
  'Chain Reaction': '连锁反应',
  'Combusting Interest': '燃烧利息',
  'Critical Missile': '会心飞弹',
  'Critical Rhythm': '会心节奏',
  "Crit 'n Cast": '会心施法',
  Cruelty: '残忍',
  'Dimension Shift': '维度偏移',
  Donation: '捐赠',
  "Don't Change the Channel": '别换台',
  'Double Defense': '双重防御',
  'Double Tap': '双击',
  DropBear: '空降猛击',
  Dropkick: '飞身踢',
  'Echo Cast': '回声施法',
  'Empowered By The Faithful': '信众赋能',
  'Empyrean Promise': '苍穹誓约',
  'En Passant': '顺路一击',
  'Endless Decimation': '无尽屠戮',
  'Escape Plan': '逃生计划',
  'Final Form': '最终形态',
  'Flash 2': '闪现二连',
  Flashbang: '闪光弹',
  'Forged By The Master': '大师锻造',
  'From Downtown': '超远投射',
  'Get Excited!': '兴奋起来！',
  'Glass Cannon': '玻璃大炮',
  Goldrend: '裂金',
  'Growth Spurt': '快速成长',
  'Hand of Baron': '纳什男爵之手',
  Hellbent: '执念狂热',
  'Hextech Soul': '海克斯科技龙魂',
  'Hide on Bush': '藏身草丛',
  'Holy Snowball': '神圣雪球',
  "It's Go Time": '行动时刻',
  Juiced: '能量充盈',
  'Kill Secured': '击杀确认',
  'King Me': '加冕为王',
  "Lil' Extra Help": '一点小帮助',
  "Mercy's Strike": '仁慈一击',
  'Mighty Shield': '强力护盾',
  MountainSoul: '山脉龙魂',
  Multishot: '多重射击',
  'Nature is Healing': '自然疗愈',
  Nightstalking: '夜行猎手',
  'Ok Boomerang': '回旋飞镖',
  'Ominous Pact': '不祥契约',
  'One Trick Pony': '绝活专精',
  'Our Healing': '共同治疗',
  Overextender: '过度延伸',
  Overloaded: '过载',
  PandorasBox: '潘多拉魔盒',
  'Pin Cushion': '针垫',
  Pinball: '弹珠冲撞',
  Poltergeist: '灵异作祟',
  Porcupine: '尖刺护体',
  'Poro Stampede': '魄罗奔袭',
  'Pressure Cooker': '高压锅',
  'Prom Queen': '舞会女王',
  'Protein Shake': '蛋白奶昔',
  'Pursuit of Haste': '急速追猎',
  Quickstep: '轻快步伐',
  'Ravenous Bind': '贪食束缚',
  Rejuvenation: '焕发生机',
  'Rite of Ascension': '飞升仪式',
  'Scoped Weapons': '瞄准武器',
  'Scopier Weapons': '更远瞄准',
  'Shark Bait': '鲨鱼诱饵',
  'Shark Tempest': '鲨鱼风暴',
  'Shrink Engine': '缩小引擎',
  Siphon: '汲取',
  Snowblast: '雪球爆破',
  Snowday: '雪日',
  Sonata: '奏鸣曲',
  'Soul Eater': '灵魂吞噬',
  Spellsplit: '法术分裂',
  'Spin Me Right Round': '旋转不停',
  'Spirit Bomb': '元气弹',
  'Spiritual Purification': '灵魂净化',
  'Squishy Slappy Grab': '软泥拍抓',
  'Stay Resolute': '坚守不屈',
  'Stuck In Here With Me': '与我困斗',
  'Surge Field': '涌动力场',
  'Swift and Safe': '迅捷安稳',
  "Terrain'd": '地形制敌',
  Terror: '恐惧',
  "Titan's Resolve": '泰坦的坚决',
  'Tooth Fairy': '牙仙',
  'Triggered Inferno': '触发炼狱',
  Tripleshot: '三连射击',
  'Trusty Weapon': '可靠武器',
  'Twin Fire': '双生火力',
  'Ultimate Awakening': '终极觉醒',
  'Upgrade Collector': '升级收集者',
  'Upgrade Immolate': '升级献祭',
  'Upgrade Infinity Edge': '升级无尽之刃',
  'Upgrade Sheen': '升级耀光',
  "Upgrade Zhonya's": '升级中娅',
  'Void Immolation': '虚空献祭',
  'Warlock Juicebox': '术士饮盒',
  'Wee Woo Wee Woo': '急救鸣笛',
  "Windspeaker's Blessing": '风语者的祝福',
  'Yowch, My Coins!': '哎哟，我的金币！',
  Zealot: '狂热者',
}

const ZH_AUGMENT_DESCRIPTIONS = {
  ARAMMayhemDontChangeTheChannel: '每持续引导 1 秒，获得一层护盾。',
  ARAMMayhemForgedByTheMaster: '提升你的装备和增强造成的伤害。',
  ARAMMayhemHextechSoul: '获得海克斯科技龙魂；如果你已经拥有它，则改为获得另一个龙魂。',
  ARAMMayhemCritNCast: '获得相当于你 40% 暴击几率的技能急速。',
  ARAMMayhemKillSecured: '朝最大生命值低于 40% 的敌方英雄移动时，获得 60% 额外移动速度。',
  ARAMMayhemSiphon: '你的选定技能对敌方英雄造成伤害时，会治疗自身。',
  ARAMMayhemStayResolute: '你的选定技能对敌方英雄造成伤害时，获得护甲和魔法抗性。该效果可以叠加。',
  ARAMMayhemTrustyWeapon: '用选定技能命中敌方英雄会建立“友谊”。友谊越深，选定技能短时间内造成的伤害越高。',
  ARAMMayhemZealot: '获得 35%（每 100 法术强度额外 +5%）攻击速度，以及 25%（每 100 法术强度额外 +5%）暴击几率。',
  ARAMMayhemPoltergeist: '将一个召唤师技能替换为灵异作祟。',
  ARAMMayhemScopedWeapons: '获得 75/50 额外攻击距离。',
  ARAMMayhemJuiced: '普通攻击命中时消耗 2.5% 最大法力值，造成相当于 3.5% 最大法力值的额外魔法伤害。该伤害可以暴击。',
  ARAMMayhemMightyShield: '获得护盾时，获得 40 到 100 适应之力，持续 3 秒。',
  ARAMMayhemMountainsoul: '获得山脉龙魂；如果你已经拥有一个龙魂，则改为获得另一个龙魂。',
  ARAMMayhemFlashbang: '使用闪现会在落点产生爆炸，造成魔法伤害并减速附近敌人。阵亡后会重置闪现冷却。',
  ARAMMayhemFlash2: '将一个召唤师技能替换为闪现，并获得 70 召唤师技能急速。装备该增强时，你两个召唤师技能位都会拥有闪现，且冷却互不共享。',
  ARAMMayhemUpgradeCollector: '升级收集者：斩杀阈值会随击杀敌方英雄提升，金币收益也会提高。额外获得 250 金币。',
  ARAMMayhemUpgradeImmolate: '升级斑比的熔渣、残疫和日炎圣盾：献祭效果会按命中的敌方英雄数量提供金币。额外获得 250 金币。',
  ARAMMayhemUpgradeZhonyas: '升级探索者的护臂、灭世者的死亡之帽和中娅沙漏：凝滞期间可以移动并获得额外移动速度，同时中娅沙漏冷却缩短。',
  ARAMMayhemTwinFire: '伤害型技能会向目标发射爆竹飞弹。飞弹数量随暴击几率提升。额外获得 25% 暴击几率。',
  ARAMMayhemDoubleDefense: '你的选定技能提供的护盾更强，并会根据目标已损失生命值提升。',
  ARAMMayhemEscapePlan: '生命值低于 35% 时，获得基于最大生命值的护盾、巨额移动速度并缩小体型；效果会逐渐衰减。',
  ARAMMayhemItsGoTime: '激活选定技能时，在其持续期间获得移动速度。',
  ARAMMayhemSpinMeRightRound: '将一个召唤师技能替换为英勇摆荡。你可以向地形发射钩索并摆荡，期间向附近敌人射击；参与击杀会大幅缩短冷却。',
  ARAMMayhemSnowday: '你的雪球获得 100 技能急速，命中敌人时造成额外魔法伤害。如果你没有雪球，则获得雪球。',
  ARAMMayhemSwiftAndSafe: '冲刺或闪烁后获得持续 2 秒的护盾。',
  ARAMMayhemAdaptiveWard: '选定技能命中敌方英雄时，根据其伤害类型获得护甲或魔法抗性，持续数秒。该效果可以叠加。',
  ARAMMayhemYowchMyCoins: '参与击杀时，敌方英雄会掉落金币，你和队友都可以拾取。',
  ARAMMayhemHideOnBush: '进入草丛后，短时间内造成更多伤害。停留在草丛中会刷新该效果。',
  ARAMMayhemFromDowntown: '任务：用技能远距离命中敌方英雄。奖励：向被狙击的敌人降下流星，对其周围造成魔法伤害。',
  ARAMMayhemPinball: '你的标记改为投掷弹珠，造成额外真实伤害并可从地形反弹。每次反弹都会提升弹珠半径、伤害和距离，并缩短标记冷却。',
  ARAMMayhemBonk: '你的选定技能强化的攻击和技能会对目标及其附近敌人造成额外伤害。',
  ARAMMayhemTerraind: '你的选定技能会在周围区域造成伤害。',
  ARAMMayhemPressureCooker: '每秒对附近敌方英雄施加可叠加的灼烧，伤害随最大生命值提升。完成灼烧伤害任务后，体型和伤害会随任务等级提升。',
  ARAMMayhemScopierWeapons: '获得 200/100 额外攻击距离。',
  ARAMMayhemOurHealing: '附近任意单位获得治疗时，你会按其治疗量的一部分治疗自己。来自敌人的治疗会使效果翻倍。',
  ARAMMayhemOverextender: '回城会进入加农炮发射器，拥有更远射程、更快飞行速度和更高伤害。',
  ARAMMayhemRejuvenation: '使用选定技能会回复生命值。',
  ARAMMayhemCriticalMissile: '暴击会向目标发射爆竹飞弹。飞弹数量随暴击几率提升。额外获得 25% 暴击几率。',
  ARAMMayhemCriticalRhythm: '暴击会提供可叠加的攻击速度，最多叠加 10 层。额外获得 25% 暴击几率。',
  ARAMMayhemWeeWooWeeWoo: '朝低生命值友军移动时获得移动速度。你的治疗和护盾会根据目标已损失生命值增强。',
  ARAMMayhemPursuitOfHaste: '任务：用选定技能命中敌方英雄。奖励：按任务等级获得选定技能急速。',
  ARAMMayhemPorcupine: '受到英雄伤害时会积攒尖刺，随后向外爆发，对附近敌人造成伤害并减速。',
  ARAMMayhemDonation: '获得该增强时，立即获得 2500 金币。',
  ARAMMayhemGrowthSpurt: '将一个召唤师技能替换为快速成长。',
  ARAMMayhemSpiritualPurification: '参与击杀会让阵亡英雄周围爆炸，对范围内敌人造成适应性伤害，并留下减速区域。',
  ARAMMayhemSoulEater: '定身或缚地敌方英雄时，永久获得生命值。每次施放有独立冷却。',
  ARAMMayhemQuickstep: '使用选定技能时，会朝鼠标方向冲刺。',
  ARAMMayhemCombustingInterest: '对英雄施加灼烧或持续伤害时，会获得金币。',
  ARAMMayhemMercysStrike: '使用选定技能后，你的下一次普通攻击获得攻击距离、攻击速度，并造成额外最大生命值魔法伤害。',
  ARAMMayhemSharkTempest: '鲨鱼围绕你的雪球旋转，减速并伤害附近敌人。雪球命中英雄时，会把目标困在鲨鱼风暴中。',
  ARAMMayhemSharkBait: '阵亡数秒后，一条鲨鱼会撕咬附近敌人。阵亡后你仍可移动来调整鲨鱼攻击位置。',
  ARAMMayhemUpgradeInfinityEdge: '升级无尽之刃，获得神圣之剑效果。额外获得金币和暴击几率。',
  ARAMMayhemUpgradeSheen: '升级所有咒刃类装备，使咒刃额外造成基于目标最大生命值的物理伤害，并治疗自身。额外获得 250 金币。',
  ARAMMayhemWarlockJuicebox: '获得全能吸血。',
  ARAMMayhemDoubleTap: '暴击普通攻击会额外触发一次攻击特效。额外获得 25% 暴击几率。',
  ARAMMayhemShrinkEngine: '参与击杀会获得永久层数。每层提供技能急速和移动速度，并缩小体型；阵亡会损失部分层数。',
  ARAMMayhemRavenousBind: '用选定技能定身或缚地敌方英雄时，造成额外魔法伤害并治疗自身。',
  ARAMMayhemEndlessDecimation: '战斗中自动挥出环形斧刃，造成物理伤害。外圈命中会造成更高伤害并治疗你。',
  ARAMMayhemGetExcited: '参与击杀敌方英雄后，短时间内获得大量移动速度和总攻击速度。',
  ARAMMayhemSnowblast: '再次施放雪球会造成更高伤害，击飞目标并击退附近敌人。',
  ARAMMayhemToothFairy: '爆发伤害会让敌人掉落牙齿。拾取牙齿会永久获得穿甲和法术穿透。',
  ARAMMayhemNightstalking: '在伤害敌方英雄后的 3 秒内参与击杀，会进入隐形状态。攻击或施放技能会立刻结束隐形。',
  ARAMMayhemLilExtraHelp: '在选定技能持续期间，获得攻击距离和攻击速度。',
  ARAMMayhemNatureIsHealing: '站在草丛中时，每秒回复最大生命值。',
  ARAMMayhemSonata: '自动在坚毅咏叹调和迅捷奏鸣曲之间轮换施放，优先施放治疗效果。',
  ARAMMayhemGlassCannon: '你的最大生命值被限制为 70%，无法被任何方式提高；作为交换，你造成的伤害会附带额外真实伤害。',
  ARAMMayhemOminousPact: '施放技能会消耗当前生命值；作为交换，根据已损失生命值获得法术强度、移动速度和全能吸血。',
  ARAMMayhemCruelty: '定身或缚地敌方英雄会在其头顶召唤彗星，短暂延迟后落下并造成魔法伤害。',
  ARAMMayhemEmpyreanPromise: '将一个召唤师技能替换为苍穹誓约。主动：短暂延迟后冲向目标友军位置，并为你和该友军提供护盾。额外获得治疗和护盾强度。',
  ARAMMayhemTriggeredInferno: '用不同来源的普通攻击或技能伤害敌方英雄会叠加风格层数。满层时会向附近敌人快速射击，低生命值目标会被暴击。',
  ARAMMayhemPinCushion: '选定技能期间的攻击会施加标记，持续结束时爆炸造成伤害，并提供移动速度。',
  ARAMMayhemProteinShake: '获得治疗和护盾强度，该数值会随额外护甲和额外魔法抗性提升。',
  ARAMMayhemMultishot: '任务：用选定技能命中敌方英雄。奖励：按任务等级发射额外飞弹。',
  ARAMMayhemSpellSplit: '你的选定技能飞弹会在命中、达到最大距离或再次施放时分裂为两枚。',
  ARAMMayhemDropkick: '你的普通攻击和技能会处决低生命值敌方英雄，并将其尸体击飞。尸体撞到敌方英雄或地形时会爆炸造成魔法伤害；成功处决会治疗你。',
  ARAMMayhemRiteOfAscension: '参与击杀后，敌方英雄会留下精华。攻击精华会获得移动速度并重置基础技能冷却。',
  ARAMMayhemWindspeakersBlessing: '你或友军对你施加治疗/护盾，或你对友军施加治疗/护盾时，会使目标短时间获得护甲和魔法抗性。',
  ARAMMayhemOverloaded: '使用另一个技能会重置选定技能的冷却时间。',
  ARAMMayhemEchoCast: '施放选定技能时，会向鼠标位置派出一个分身并再次施放该技能。',
  ARAMMayhemKingMe: '第一次进入敌方基地附近的传送门或加农炮时，你会成为“国王”，获得一个随机棱彩增强，并强化背包中第一个符合条件的传说装备。',
  ARAMMayhemOneTrickPony: '该增强已在 26.12 版本加入；当前客户端文件尚未公开完整提示文本。',
  ARAMMayhemDropbear: '阵亡时，一个继承你全部增强的巨大提伯斯会从天而降，对附近敌人造成伤害。',
  ARAMMayhemTerror: '每当你施放选定技能时，恐惧你周围的敌人。',
  ARAMMayhemChainReaction: '被选定技能击退的目标若撞到其他英雄，会将其击飞并造成魔法伤害；撞到地形时击飞时间延长并造成额外伤害。',
  ARAMMayhemGoldrend: '普通攻击或技能伤害敌方英雄时，造成额外魔法伤害，并获得金币和短暂移动速度。',
  ARAMMayhemHandOfBaron: '获得 33% 适应之力。附近友方小兵会被大幅强化。',
  ARAMMayhemPandorasbox: '将你当前的增强转化为相同数量的完全随机棱彩增强。',
  ARAMMayhemPoroStampede: '任务：收集魄罗佳肴并喂给魄罗。奖励：获得魄罗冲锋召唤师技能，向敌方队伍发射魄罗浪潮；任务等级越高，浪潮越多。',
  ARAMMayhemSquishySlappyGrab: '周期性向附近所有敌方英雄伸出软泥手臂并连接他们。你的下一次攻击会把所有被连接的敌人拉向你。',
  ARAMMayhemTripleshot: '你的选定技能会额外瞄准前方 2 名敌人。',
  ARAMMayhemHolySnowball: '使用标记的冲刺后，抵达时获得 1 秒无敌。标记获得等同于 100 技能急速的冷却缩减；如果你没有标记，则获得标记。',
  ARAMMayhemBiggestSnowballEver: '将标记升级为巨型雪球，体积更大并可穿过非英雄单位。命中目标时爆炸，造成魔法伤害、击飞并减速附近敌人。',
  ARAMMayhemEnPassant: '周期性在敌方英雄身上标记破绽。用攻击或技能命中破绽会造成最大生命值真实伤害、治疗自身并提供移动速度。',
  ARAMMayhemTitansResolve: '承受或造成伤害会获得层数。每达到一定层数，获得适应之力、护甲、魔法抗性、体型和韧性。',
  ARAMMayhemDimensionShift: '获得召唤师技能“黑暗降临”。创造一个区域，将区域内所有单位传送到另一个维度。',
  ARAMMayhemPromQueen: '自动施放惊鸿过隙，使你短时间内获得幽灵化和移动速度；碰到的敌人会被魅惑。效果触发前会有王冠降临提示。',
  ARAMMayhemEmpoweredByTheFaithful: '为友方英雄提供治疗或护盾会祝福他们。被祝福的友军造成伤害时，你会积攒虔诚层数；满层后释放冲击波并处决低生命值敌人。',
  ARAMMayhemVoidImmolation: '任务：立即获得斑比的熔渣，并可以购买 2 件献祭装备。拥有日炎圣盾和残疫后，它们会合成为虚空献祭；击杀敌人会在周围造成魔法伤害。',
  ARAMMayhemSurgeField: '施放终极技能时生成一个区域，提供技能急速和移动速度。区域内会发射飞弹，按你的伤害比例造成魔法伤害。',
  ARAMMayhemStuckInHereWithMe: '施放终极技能时，在身边生成光环并获得伤害减免；持续结束后嘲讽光环内所有敌人。额外获得终极技能急速。',
  ARAMMayhemSpiritBomb: '治疗或护盾友方英雄会积攒元气弹。满层后将元气弹投向生命值最低的友军，治疗并护盾其及附近友军。',
  ARAMMayhemHellbent: '用攻击或技能伤害敌方英雄会获得层数。满层后，你阵亡时会以强化状态复活。',
  ARAMMayhemUltimateAwakening: '施放终极技能会重置所有基础技能冷却，并短时间内获得大量基础技能急速。额外获得终极技能急速。',
  ARAMMayhemFinalForm: '施放终极技能后进入强化状态，获得基于最大生命值的护盾、全能吸血和额外移动速度。',
}

const LOCAL_AUGMENT_OVERRIDES = {
  archmage: {
    id: 900001,
    apiName: 'MayhemArchmage',
    zhName: '大法师',
    rarity: 2,
    iconLocal: 'assets/mayhem-augments/archmage-prismatic.webp',
  },
  'purist-caster': {
    id: 900002,
    apiName: 'MayhemPuristCaster',
    zhName: '纯粹主义者',
    rarity: 0,
    iconLocal: 'assets/mayhem-augments/purist-caster.webp',
  },
  'infinite-recursion': {
    id: 900003,
    apiName: 'MayhemInfiniteRecursion',
    zhName: '无限循环往复',
    rarity: 2,
    iconLocal: 'assets/mayhem-augments/infinite-recursion.webp',
  },
  'high-roller': {
    id: 900004,
    apiName: 'MayhemHighRoller',
    zhName: '掷筛狂人',
    rarity: 2,
    iconLocal: 'assets/mayhem-augments/high-roller.webp',
  },
  'combusting-interest': { zhName: '燃烧利息', iconLocal: 'assets/mayhem-augments/combusting-interest.webp' },
  bonk: { zhName: '当头一棒！', rarity: 1, iconLocal: 'assets/mayhem-augments/bonk-gold.webp' },
  'double-tap': { zhName: '双击', rarity: 1, iconLocal: 'assets/mayhem-augments/double-tap-gold.webp' },
  'from-downtown': { zhName: '超远投射', iconLocal: 'assets/mayhem-augments/from-downtown.webp' },
  'glass-cannon': { zhName: '玻璃大炮', iconLocal: 'assets/mayhem-augments/glass-cannon.webp' },
  'ok-boomerang': { zhName: '回旋飞镖' },
  'pin-cushion': { zhName: '大头针垫', iconLocal: 'assets/mayhem-augments/pin-cushion.webp' },
  'pressure-cooker': { zhName: '高压锅', iconLocal: 'assets/mayhem-augments/pressure-cooker.webp' },
  quickstep: { zhName: '轻快步伐', iconLocal: 'assets/mayhem-augments/quickstep.webp' },
  'spirit-bomb': { zhName: '元气弹', iconLocal: 'assets/mayhem-augments/spirit-bomb.webp' },
  'tooth-fairy': { zhName: '牙仙', iconLocal: 'assets/mayhem-augments/tooth-fairy.webp' },
  'twin-fire': { zhName: '双生火力', iconLocal: 'assets/mayhem-augments/twin-fire.webp' },
  terror: { zhName: '恐惧', rarity: 2, iconLocal: 'assets/mayhem-augments/terror-prismatic.webp' },
  'void-immolation': { zhName: '虚空献祭', iconLocal: 'assets/mayhem-augments/void-immolation.webp' },
  'yowch-my-coins': { zhName: '哎哟，我的金币！', iconLocal: 'assets/mayhem-augments/yowch-my-coins.webp' },
}

function decodeHtml(value = '') {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function normalizeName(value) {
  return decodeHtml(value)
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function apiNameFromSlug(slug) {
  return (
    'ARAMMayhem' +
    slug
      .split('-')
      .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ''))
      .join('')
      .replace(/[^A-Za-z0-9]/g, '')
  )
}

function stripDescriptionMarkup(value = '') {
  return decodeHtml(value)
    .replace(/\[\/b\]/g, '')
    .replace(/\[b\]/g, '')
    .replace(/\[\/stat\]/g, '')
    .replace(/\[stat:[^\]]+\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' }, redirect: 'follow' })
  if (!response.ok) throw new Error(`${response.status} ${url}`)
  return response.text()
}

async function download(url, file) {
  if (existsSync(file) && (await stat(file)).size > 0) return
  const response = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' }, redirect: 'follow' })
  if (!response.ok) throw new Error(`${response.status} ${url}`)
  await writeFile(file, Buffer.from(await response.arrayBuffer()))
}

async function loadJson(file) {
  return JSON.parse(await readFile(join(DATA_DIR, file), 'utf8'))
}

function parseLiveAugments(html) {
  const blocks = [...html.matchAll(/<a href="(\/augments\/[^"]+)" class="augment-rank-row[\s\S]*?<\/a>/g)].map(
    (match) => match[0],
  )
  const live = []
  for (const block of blocks) {
    const href = block.match(/<a href="(\/augments\/[^"]+)"/)?.[1]
    const image = block.match(/<img src="(\/augments\/[^"]+_mayhem_augment\.webp)" alt="([^"]+)"/)
    const rarity = block.match(/data-rarity="([^"]+)"/)?.[1]
    const availability = block.match(/data-availability="([^"]+)"/)?.[1]
    const liveRank = block.match(/data-live-rank="([^"]*)"/)?.[1]
    if (!href || !image || !rarity || availability !== 'live') continue
    live.push({
      href,
      slug: href.replace(/^\/augments\//, '').replace(/\/?$/, ''),
      imagePath: image[1],
      name: decodeHtml(image[2]),
      rarity,
      liveRank: Number(liveRank || 9999),
    })
  }
  return [...new Map(live.map((augment) => [augment.slug, augment])).values()].sort(
    (a, b) => a.liveRank - b.liveRank || a.name.localeCompare(b.name),
  )
}

async function main() {
  await mkdir(ICON_DIR, { recursive: true })

  const previousZh = await loadJson('augments.json')
  const previousEn = await loadJson(join('en', 'augments.json'))
  const oldEnByName = new Map(previousEn.map((augment) => [normalizeName(augment.name), augment]))
  const oldZhById = new Map(previousZh.map((augment) => [augment.id, augment]))

  const page = await fetchText(SOURCE)
  const liveRows = parseLiveAugments(page)
  if (liveRows.length !== 199) throw new Error(`Expected 199 live augments from arammayhem.com, got ${liveRows.length}`)

  const zh = []
  const en = []
  const snapshot = []
  let generatedIndex = 0

  for (const row of liveRows) {
    const detailUrl = `${ROOT}${row.href}`
    const detail = await fetchText(detailUrl)
    const descriptionRaw = detail.match(/props="\{&quot;description&quot;:\[0,&quot;([\s\S]*?)&quot;\]\}"/)?.[1] ?? ''
    const description = stripDescriptionMarkup(descriptionRaw)
    const local = oldEnByName.get(normalizeName(row.name))
    const override = LOCAL_AUGMENT_OVERRIDES[row.slug]
    const id = override?.id ?? local?.id ?? 910000 + generatedIndex++
    const apiName = override?.apiName ?? local?.apiName ?? apiNameFromSlug(row.slug)
    const rarity = override?.rarity ?? local?.rarity ?? RARITY_NUM[row.rarity]
    const iconName = `${apiName}_arammayhem.webp`
    const iconLocal = override?.iconLocal ?? local?.iconLargeLocal ?? `icons/augments/${iconName}`
    const iconSmallLocal = override?.iconLocal ?? local?.iconSmallLocal ?? iconLocal

    if (!override?.iconLocal && !local?.iconLargeLocal) {
      await download(`${ROOT}${row.imagePath}`, join(ICON_DIR, iconName))
    }

    const base = {
      id,
      apiName,
      name: row.name,
      rarity,
      desc: description,
      tooltip: description,
      descRaw: descriptionRaw ? decodeHtml(descriptionRaw) : description,
      availability: 'live',
      source: 'arammayhem.com',
      sourceUrl: detailUrl,
      iconLargeUrl: `${ROOT}${row.imagePath}`,
      iconSmallUrl: `${ROOT}${row.imagePath}`,
      iconLargeLocal: iconLocal,
      iconSmallLocal,
    }
    en.push({ ...base, rarityLabel: RARITY_LABEL_EN[rarity] })

    const oldZh = local ? oldZhById.get(local.id) : null
    const zhDesc = ZH_AUGMENT_DESCRIPTIONS[apiName]
    zh.push({
      ...base,
      name: override?.zhName ?? oldZh?.name ?? ZH_AUGMENT_NAMES[row.name] ?? row.name,
      rarityLabel: RARITY_LABEL_ZH[rarity],
      desc: zhDesc ?? oldZh?.desc ?? description,
      tooltip: zhDesc ?? oldZh?.tooltip ?? description,
      descRaw: zhDesc ?? oldZh?.descRaw ?? base.descRaw,
    })

    snapshot.push({
      id,
      apiName,
      name: row.name,
      rarity: row.rarity,
      liveRank: row.liveRank,
      slug: row.slug,
      matchedLocal: Boolean(local),
    })
  }

  const liveIds = new Set(en.map((augment) => augment.id))
  const legacyZh = previousZh
    .filter((augment) => augment.rarity !== 4 && !liveIds.has(augment.id))
    .map((augment) => ({ ...augment, availability: 'legacy', source: augment.source ?? 'legacy-cdragon' }))
  const legacyEn = previousEn
    .filter((augment) => augment.rarity !== 4 && !liveIds.has(augment.id))
    .map((augment) => ({ ...augment, availability: 'legacy', source: augment.source ?? 'legacy-cdragon' }))

  const order = (a, b) => a.rarity - b.rarity || a.name.localeCompare(b.name)
  await writeFile(join(DATA_DIR, 'augments.json'), JSON.stringify([...zh.sort(order), ...legacyZh], null, 2) + '\n')
  await writeFile(join(DATA_DIR, 'en', 'augments.json'), JSON.stringify([...en.sort(order), ...legacyEn], null, 2) + '\n')
  await writeFile(
    join(DATA_DIR, 'arammayhem-augments.snapshot.json'),
    JSON.stringify(
      {
        source: SOURCE,
        fetchedAt: new Date().toISOString(),
        total: snapshot.length,
        matchedLocal: snapshot.filter((augment) => augment.matchedLocal).length,
        augments: snapshot,
      },
      null,
      2,
    ) + '\n',
  )

  console.log(
    `arammayhem augments: ${snapshot.length} live, ${legacyEn.length} hidden legacy, ${
      snapshot.filter((augment) => augment.matchedLocal).length
    } matched local ids`,
  )
}

main().catch((error) => {
  console.error('failed:', error)
  process.exit(1)
})
