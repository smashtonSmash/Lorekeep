// Sample table so a fresh install has something to click. Everything here is marked `sample` and can be removed in one tap.
import type { Character, Combatant, Encounter, WikiPage } from './types'
import { uid } from './types'
import { addItem, toggleEquip } from '../rules/character'
import { makeArmor, makeConsumable, makeMaterial, makeShield, makeWeapon, SPECIALS } from '../rules/gear'
import { MONSTERS } from '../data/monsters'
import { average } from './dice'

function base(o: Partial<Character> & Pick<Character, 'id' | 'name' | 'race' | 'cls'>): Character {
  return {
    level: 1, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, bonuses: {}, hitDie: 8, maxHp: 10, hp: 10, tempHp: 0, speed: 30,
    saves: [], customSaves: [], skills: [], traits: [], features: [], attacks: [], inventory: [], purse: { gold: 10, silver: 0 },
    conditions: [], effects: [], favor: {}, inspiration: 0, createdAt: Date.now(), sample: true, ...o,
  }
}
function equipAll(c: Character, items: ReturnType<typeof makeWeapon>[], equip: number[]) {
  let out = c
  items.forEach((it, i) => { out = addItem(out, it); if (equip.includes(i)) out = toggleEquip(out, out.inventory[out.inventory.length - 1].id).char })
  return out
}

export function seed(): { chars: Character[]; wiki: WikiPage[]; encounter: Encounter } {
  const thorin = equipAll(base({
    id: 'sample-thorin', name: 'Thorin Ashforge', playerName: '', race: 'Dwarf', subrace: 'Hill Dwarf', cls: 'Fighter', background: 'Soldier', level: 3, hitDie: 10,
    abilities: { str: 15, dex: 12, con: 14, int: 10, wis: 12, cha: 8 }, bonuses: { con: 2, wis: 1 }, maxHp: 34, hp: 34, speed: 25,
    saves: ['str', 'con'], skills: ['Athletics', 'Intimidation'], purse: { gold: 12, silver: 7 },
    traits: [{ id: uid(), name: 'Dwarven Resilience', effect: 'resistance', types: ['poison'] }],
    details: 'Soot-dark beard braided with copper rings. Smells faintly of forge smoke.',
  }), [makeArmor('padded', 'purple'), makeWeapon('warhammer', 'blue'), makeShield('medium', 'green'), makeConsumable('heal-green', 2), makeMaterial('gray', 2)], [0, 1, 2])
  const lyra = base({
    id: 'sample-lyra', name: 'Lyra Moonwhisper', race: 'Elf', subrace: 'High Elf', cls: 'Wizard', background: 'Sage', level: 3, hitDie: 6,
    abilities: { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 }, bonuses: { dex: 2, int: 1 }, maxHp: 17, hp: 17,
    saves: ['int', 'wis'], skills: ['Arcana', 'History', 'Perception'], purse: { gold: 25, silver: 0 },
    caster: { ability: 'int', max: [4, 2, 0, 0, 0, 0, 0, 0, 0], used: [0, 0, 0, 0, 0, 0, 0, 0, 0], known: ['fire-bolt', 'mage-hand', 'magic-missile', 'shield', 'sleep', 'scorching-ray', 'misty-step'], custom: [] },
  })
  const lyraArmed = equipAll(lyra, [makeWeapon('dagger', 'green'), makeConsumable('heal-green'), makeConsumable('thunderclap')], [0])
  const pip = equipAll(base({
    id: 'sample-pip', name: 'Pip Underbough', race: 'Halfling', subrace: 'Lightfoot', cls: 'Rogue', background: 'Criminal', level: 3,
    abilities: { str: 8, dex: 15, con: 12, int: 13, wis: 10, cha: 14 }, bonuses: { dex: 2, cha: 1 }, maxHp: 21, hp: 21, speed: 25,
    saves: ['dex', 'int'], skills: ['Stealth', 'Sleight of Hand', 'Deception', 'Acrobatics'], purse: { gold: 6, silver: 4 },
  }), [makeArmor('studded', 'blue'), makeWeapon('shortsword', 'green'), makeWeapon('shortbow', 'green'), SPECIALS.coin()], [0, 1])

  const mon = (key: string, n: number): Combatant => {
    const m = MONSTERS.find((x) => x.key === key)!
    const hp = average(m.hp)
    return {
      id: uid(), side: 'monster', name: n > 1 ? `${m.name} ${n}` : m.name, init: null, initMod: m.dex, ac: m.ac, maxHp: hp, hp, tempHp: 0,
      attacks: m.attacks.map(([name, toHit, damage, damageType]) => ({ id: uid(), name, toHit, damage, damageType })),
      traits: (m.traits ?? []).map(([effect, types]) => ({ id: uid(), name: effect, effect, types })), conditions: [], armorText: m.armor, srdKey: key, sample: true,
    }
  }
  const party = (c: Character): Combatant => ({ id: uid(), side: 'party', characterId: c.id, name: c.name, init: null, initMod: 0, ac: 10, maxHp: 1, hp: 1, tempHp: 0, attacks: [], traits: [], conditions: [], sample: true })
  const wiki: WikiPage[] = [
    { id: 'sample-w1', title: 'Grimble the Goblin Boss', category: 'NPC', text: 'Runs the warren under the old mill. Cowardly, clever, keeps a pet rat named Duke.', updatedAt: Date.now(), sample: true },
    { id: 'sample-w2', title: 'Crossroads', category: 'Location', text: 'A market town where four roads meet. The wishing fountain in the square is older than anyone remembers.', updatedAt: Date.now(), sample: true },
    { id: 'sample-w3', title: 'Session 1 — The Mill', category: 'Session', text: 'The party cleared the mill basement and found a map with three red marks.', updatedAt: Date.now(), sample: true },
  ]
  return {
    chars: [thorin, lyraArmed, pip],
    wiki,
    encounter: { combatants: [party(thorin), party(lyraArmed), party(pip), mon('goblin', 1), mon('goblin', 2), mon('wolf', 1)], round: 1, turnId: null, log: [], pendingLoot: [] },
  }
}
