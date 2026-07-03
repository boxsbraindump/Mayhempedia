import type { Archetype, Augment } from './data'

export type AugmentTag =
  | 'ap'
  | 'ad'
  | 'crit'
  | 'attackSpeed'
  | 'onHit'
  | 'abilityHaste'
  | 'burst'
  | 'burn'
  | 'mobility'
  | 'tank'
  | 'health'
  | 'healing'
  | 'shield'
  | 'control'
  | 'mana'
  | 'summon'
  | 'poke'
  | 'execute'
  | 'melee'
  | 'marksman'
  | 'survival'

export type DecisionGrade = 'S' | 'A' | 'B' | 'C' | 'D' | 'Trap'
export type DecisionTone = 'recommend' | 'good' | 'avoid' | 'neutral'

export interface DecisionPick {
  augment: Augment
  score: number
  grade: DecisionGrade
  tone: DecisionTone
  label: string
  reason: string
  tags: AugmentTag[]
  comboNotes: string[]
  /** true = 命中人工核对过的 core/good/trap 数据；false = 没有真实数据支撑，纯关键词规则猜的评级，
   *  UI 必须区分显示，不能让用户以为两者可信度一样。 */
  verified: boolean
}

const TAG_LABEL: Record<AugmentTag, string> = {
  ap: '法强',
  ad: '攻击力',
  crit: '暴击',
  attackSpeed: '攻速',
  onHit: '普攻/命中',
  abilityHaste: '技能急速',
  burst: '爆发',
  burn: '灼烧',
  mobility: '位移/移速',
  tank: '坦度',
  health: '生命值',
  healing: '回复',
  shield: '护盾',
  control: '控制',
  mana: '资源',
  summon: '召唤物',
  poke: '消耗',
  execute: '斩杀',
  melee: '近战',
  marksman: '射手',
  survival: '保命',
}

export function augmentTagLabel(tag: AugmentTag): string {
  return TAG_LABEL[tag]
}

const DEFAULT_WEIGHTS: Partial<Record<AugmentTag, number>> = {
  survival: 8,
  mobility: 6,
  abilityHaste: 5,
}

const RARITY_BONUS: Record<number, number> = {
  0: 0,
  1: 3,
  2: 6,
  4: 4,
}

function hasAny(text: string, needles: string[]): boolean {
  return needles.some((n) => text.includes(n.toLowerCase()))
}

function addTag(tags: Set<AugmentTag>, text: string, tag: AugmentTag, needles: string[]) {
  if (hasAny(text, needles)) tags.add(tag)
}

export function inferAugmentTags(augment: Augment): AugmentTag[] {
  const text = `${augment.apiName} ${augment.name} ${augment.desc} ${augment.tooltip}`.toLowerCase()
  const tags = new Set<AugmentTag>()

  addTag(tags, text, 'ap', ['法术强度', '法强', '魔法伤害', '法术伤害', 'ap', 'ability power'])
  addTag(tags, text, 'ad', ['攻击力', '额外攻击', '物理伤害', 'ad', 'attack damage'])
  addTag(tags, text, 'crit', ['暴击', '会心', 'critical', 'crit'])
  addTag(tags, text, 'attackSpeed', ['攻击速度', '攻速', 'attack speed'])
  addTag(tags, text, 'onHit', ['普攻', '攻击附带', '命中时', '攻击命中', 'on-hit'])
  addTag(tags, text, 'abilityHaste', ['技能急速', '冷却', '缩短', 'haste'])
  addTag(tags, text, 'burst', ['爆发', '造成额外', '斩杀', '处决', 'burst'])
  addTag(tags, text, 'burn', ['灼烧', '燃烧', '持续伤害', 'burn'])
  addTag(tags, text, 'mobility', ['冲刺', '跳跃', '闪烁', '传送', '移动速度', '移速', '位移', 'dash'])
  addTag(tags, text, 'tank', ['护甲', '魔法抗性', '双抗', '抗性', '减伤', '承受', 'tank'])
  addTag(tags, text, 'health', ['生命值', '最大生命', '额外生命', 'health'])
  addTag(tags, text, 'healing', ['治疗', '回复', '生命偷取', '全能吸血', 'heal', 'vamp'])
  addTag(tags, text, 'shield', ['护盾', 'shield'])
  addTag(tags, text, 'control', ['眩晕', '禁锢', '减速', '击飞', '控制', '沉默', '魅惑', '恐惧'])
  addTag(tags, text, 'mana', ['法力', '能量', '资源', 'mana', 'energy'])
  addTag(tags, text, 'summon', ['召唤', '召唤物', '宠物', '仆从', '炮台'])
  addTag(tags, text, 'poke', ['距离', '远距离', '弹体', '技能命中', '消耗'])
  addTag(tags, text, 'execute', ['斩杀', '处决', '残血', '低生命'])
  addTag(tags, text, 'melee', ['近战'])
  addTag(tags, text, 'marksman', ['射手', '远程'])
  addTag(tags, text, 'survival', ['即将阵亡', '不可被选取', '无敌', '保命', '复活', '免疫'])

  return [...tags]
}

function bump(weights: Partial<Record<AugmentTag, number>>, tag: AugmentTag, value: number) {
  weights[tag] = (weights[tag] ?? 0) + value
}

export function inferArchetypeWeights(arch: Archetype): Partial<Record<AugmentTag, number>> {
  const text = `${arch.name} ${arch.damageType} ${arch.note} ${arch.items.map((i) => i.name).join(' ')}`.toLowerCase()
  const weights: Partial<Record<AugmentTag, number>> = { ...DEFAULT_WEIGHTS }

  if (arch.damageType === 'AP' || hasAny(text, ['法师', '法核', '法术', 'ap', '法强'])) {
    bump(weights, 'ap', 34)
    bump(weights, 'abilityHaste', 18)
    bump(weights, 'burst', 16)
    bump(weights, 'poke', 8)
    bump(weights, 'mana', 6)
  }
  if (arch.damageType === 'AD' || hasAny(text, ['ad', '物理', '攻击力'])) {
    bump(weights, 'ad', 30)
    bump(weights, 'onHit', 10)
  }
  if (hasAny(text, ['暴击', '无尽', '收集者', '会心'])) {
    bump(weights, 'crit', 34)
    bump(weights, 'ad', 12)
    bump(weights, 'attackSpeed', 10)
  }
  if (hasAny(text, ['攻速', '卢安娜', '狂战士', '普攻', '特效', '双刀'])) {
    bump(weights, 'attackSpeed', 28)
    bump(weights, 'onHit', 24)
    bump(weights, 'marksman', 10)
  }
  if (hasAny(text, ['灼烧', '燃烧', '持续伤害'])) {
    bump(weights, 'burn', 28)
    bump(weights, 'abilityHaste', 10)
    bump(weights, 'poke', 8)
  }
  if (hasAny(text, ['刺客', '爆发', '秒', 'burst'])) {
    bump(weights, 'burst', 26)
    bump(weights, 'mobility', 14)
    bump(weights, 'execute', 12)
  }
  if (hasAny(text, ['坦克', '肉', '生命值', '叠血', '承伤'])) {
    bump(weights, 'tank', 34)
    bump(weights, 'health', 30)
    bump(weights, 'healing', 14)
    bump(weights, 'shield', 10)
    bump(weights, 'survival', 10)
  }
  if (hasAny(text, ['治疗', '护盾', '辅助', '保护'])) {
    bump(weights, 'healing', 28)
    bump(weights, 'shield', 28)
    bump(weights, 'abilityHaste', 8)
  }
  if (hasAny(text, ['近战', '亮出你的剑'])) {
    bump(weights, 'melee', 30)
    bump(weights, 'survival', 10)
  }

  return weights
}

function gradeFromScore(score: number): DecisionGrade {
  if (score >= 92) return 'S'
  if (score >= 68) return 'A'
  if (score >= 43) return 'B'
  if (score >= 18) return 'C'
  return 'D'
}

function toneFromGrade(grade: DecisionGrade): DecisionTone {
  if (grade === 'Trap') return 'avoid'
  if (grade === 'S') return 'recommend'
  if (grade === 'A' || grade === 'B') return 'good'
  return 'neutral'
}

function summarizeOwnedTags(ownedAugments: Augment[]): Map<AugmentTag, number> {
  const counts = new Map<AugmentTag, number>()
  for (const augment of ownedAugments) {
    for (const tag of inferAugmentTags(augment)) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }
  return counts
}

function comboAdjustment(tags: AugmentTag[], arch: Archetype, ownedAugments: Augment[]): { score: number; notes: string[] } {
  if (ownedAugments.length === 0) return { score: 0, notes: [] }
  const weights = inferArchetypeWeights(arch)
  const ownedTags = summarizeOwnedTags(ownedAugments)
  const notes: string[] = []
  let score = 0

  const stacked = tags
    .filter((tag) => (ownedTags.get(tag) ?? 0) > 0 && (weights[tag] ?? 0) > 0)
    .sort((a, b) => (weights[b] ?? 0) - (weights[a] ?? 0))
  for (const tag of stacked.slice(0, 2)) {
    const count = ownedTags.get(tag) ?? 0
    const bonus = Math.min(18, 6 + count * 6)
    score += bonus
    notes.push(`与已选增强形成${TAG_LABEL[tag]}叠加，+${bonus}`)
  }

  const hasCore = ownedAugments.some((augment) => arch.augments.core.some((ref) => ref.id === augment.id))
  if (hasCore) {
    const routeTags = tags.filter((tag) => (weights[tag] ?? 0) >= 18)
    if (routeTags.length > 0) {
      score += 10
      notes.push('已命中核心路线，同方向增强提权 +10')
    }
  }

  const offRouteTags = tags.filter((tag) => {
    const weight = weights[tag] ?? 0
    return weight <= 0 && (tag === 'ap' || tag === 'ad' || tag === 'crit' || tag === 'attackSpeed' || tag === 'tank')
  })
  if (offRouteTags.length >= 2) {
    score -= 12
    notes.push(`疑似路线偏移：${offRouteTags.slice(0, 2).map((tag) => TAG_LABEL[tag]).join('、')}，-12`)
  }

  return { score, notes }
}

export function scoreAugmentPick(augment: Augment, arch: Archetype, ownedAugments: Augment[] = []): DecisionPick {
  const inCore = arch.augments.core.some((ref) => ref.id === augment.id)
  const inGood = arch.augments.good.some((ref) => ref.id === augment.id)
  const inTrap = arch.augments.trap.some((ref) => ref.id === augment.id)
  const tags = inferAugmentTags(augment)
  const combo = comboAdjustment(tags, arch, ownedAugments)

  if (inTrap) {
    return {
      augment,
      score: -100,
      grade: 'Trap',
      tone: 'avoid',
      label: '避开',
      reason: '人工标记为当前路线陷阱，容易偏离伤害/出装收益。',
      tags,
      comboNotes: combo.notes,
      verified: true,
    }
  }
  if (inCore) {
    const score = 100 + (RARITY_BONUS[augment.rarity] ?? 0) + combo.score
    return {
      augment,
      score,
      grade: 'S',
      tone: 'recommend',
      label: '首选',
      reason: combo.notes.length > 0 ? `人工标记为当前流派核心增强，且有本局 combo 加权。` : '人工标记为当前流派核心增强，优先级最高。',
      tags,
      comboNotes: combo.notes,
      verified: true,
    }
  }
  if (inGood) {
    const score = 72 + (RARITY_BONUS[augment.rarity] ?? 0) + combo.score
    const grade = gradeFromScore(score)
    return {
      augment,
      score,
      grade,
      tone: toneFromGrade(grade),
      label: '可选',
      reason: combo.notes.length > 0 ? `人工标记为当前流派备选增强，并获得本局 combo 加权。` : '人工标记为当前流派备选增强，核心没出现时可以拿。',
      tags,
      comboNotes: combo.notes,
      verified: true,
    }
  }

  const weights = inferArchetypeWeights(arch)
  const tagScore = tags.reduce((sum, tag) => sum + (weights[tag] ?? 0), 0)
  const score = tagScore + (RARITY_BONUS[augment.rarity] ?? 0) + combo.score
  const grade = gradeFromScore(score)
  const matched = tags
    .filter((tag) => (weights[tag] ?? 0) > 0)
    .sort((a, b) => (weights[b] ?? 0) - (weights[a] ?? 0))
    .slice(0, 3)
    .map((tag) => TAG_LABEL[tag])

  return {
    augment,
    score,
    grade,
    tone: toneFromGrade(grade),
    label: grade,
    reason:
      combo.notes.length > 0
        ? `按标签规则评为 ${grade}，并结合本局已选增强调整。`
        : matched.length > 0
        ? `按标签规则评为 ${grade}：命中 ${matched.join('、')}，与当前路线有${grade === 'A' || grade === 'B' ? '一定' : grade === 'S' ? '强' : '有限'}协同。`
        : `按标签规则评为 ${grade}：没有明显命中当前路线偏好，除非局势需要，否则优先级较低。`,
    tags,
    comboNotes: combo.notes,
    verified: false,
  }
}
