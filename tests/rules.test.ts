import { describe, expect, test } from 'bun:test'
import { average, parseDice, roll } from '../src/core/dice'
import type { Character } from '../src/core/types'
import { armorStats, wornArmor } from '../src/rules/armor'
import { acOf, acVersus, addItem, attacksOf, encumbrance, giveInspiration, levelUp, pay, slotsFor, toggleEquip } from '../src/rules/character'
import { resolveAttack, takeDamage } from '../src/rules/combat'
import { handValue, rouletteWins, deal, act, settle } from '../src/rules/casino'
import { buyVaultSlots, deposit, markup, offer, refuses, removeMerchant, vaultPrice, acceptTrade, DEFAULT_MERCHANTS } from '../src/rules/economy'
import { makeArmor, makeConsumable, makeMaterial, makeShield, makeWeapon, maxDur, salvageYield, kitDice } from '../src/rules/gear'
import { guessTier, rollLoot, splitCoins } from '../src/rules/loot'
import { craft, merge, salvage, upgrade } from '../src/rules/smith'

const seq = (...xs: number[]) => { let i = 0; return () => xs[i++ % xs.length] }
const blank = (o: Partial<Character> = {}): Character => ({
  id: 'c1', name: 'Test', race: 'Human', cls: 'Fighter', level: 1, abilities: { str: 14, dex: 14, con: 12, int: 10, wis: 10, cha: 10 }, bonuses: {},
  hitDie: 10, maxHp: 12, hp: 12, tempHp: 0, speed: 30, saves: [], customSaves: [], skills: [], traits: [], features: [], attacks: [], inventory: [],
  purse: { gold: 100, silver: 0 }, conditions: [], effects: [], favor: {}, inspiration: 0, createdAt: 0, ...o,
})
const town = () => ({ places: [], currentId: '', merchants: [...DEFAULT_MERCHANTS], fountain: { silver: 0, threshold: null }, vault: { slots: 10, blocks: 0, items: [] }, stash: { on: false, gold: 0, silver: 0, items: [] } })

describe('dice', () => {
  test('parses mixed pools', () => {
    expect(parseDice('2d6+1d4+3')).toEqual({ dice: [{ count: 2, sides: 6, sign: 1 }, { count: 1, sides: 4, sign: 1 }], mod: 3 })
    expect(parseDice('nope')).toBeNull()
    expect(average('2d6+2')).toBe(9)
  })
  test('crit doubles dice not modifiers', () => {
    expect(roll('1d6+2', () => 0.99, { crit: true }).total).toBe(14)
  })
})

describe('armor ladder', () => {
  test('padded rare replaces −1 with −prof', () => {
    expect(armorStats('padded', 'blue', 3).reduce.bludgeoning).toBe(3)
  })
  test('studded legendary drops deflect and gives +2 vs piercing', () => {
    const s = armorStats('studded', 'legendary', 2)
    expect(s.deflect).toBe(false)
    expect(s.acVs.piercing).toBe(2)
  })
  test('mythic resets AC bonuses to +3/−1', () => {
    const s = armorStats('leather', 'mythic', 2)
    expect(s.acVs).toEqual({ slashing: 3, piercing: -1, bludgeoning: -1 })
  })
  test('sworn plate', () => {
    expect(armorStats('plate', 'mythic', 2, { sworn: 'piercing' }).acVs).toEqual({ bludgeoning: -1, piercing: 3, slashing: -1 })
  })
  test('legendary padded under chain mail adds +1 AC', () => {
    expect(wornArmor({ armorId: 'chain-mail', tier: 'green' }, { armorId: 'padded', tier: 'legendary' }).underAc).toBe(1)
    expect(wornArmor({ armorId: 'leather', tier: 'green' }, { armorId: 'padded', tier: 'legendary' }).underAc).toBe(0)
  })
})

describe('character AC', () => {
  test('light armor takes full dex, heavy none, shield adds', () => {
    let c = addItem(blank(), makeArmor('leather', 'green'))
    c = toggleEquip(c, c.inventory[0].id).char
    expect(acOf(c)).toBe(13)
    c = addItem(c, makeShield('medium', 'green'))
    c = toggleEquip(c, c.inventory[1].id).char
    expect(acOf(c)).toBe(15)
  })
  test('damaged armor −1, broken armor ignored', () => {
    const a = { ...makeArmor('chain-mail', 'green'), equipped: true }
    expect(acOf(blank({ inventory: [{ ...a, dur: 10 }] }))).toBe(15)
    expect(acOf(blank({ inventory: [{ ...a, dur: 0 }] }))).toBe(12)
  })
  test('acVersus uses per-type bonus', () => {
    const c = blank({ inventory: [{ ...makeArmor('leather', 'mythic'), equipped: true }] })
    expect(acVersus(c, 'slashing') - acVersus(c, 'piercing')).toBe(4)
  })
  test('two-handed weapon bumps the shield off', () => {
    let c = addItem(addItem(blank(), makeShield('medium', 'green')), makeWeapon('greatsword', 'green'))
    c = toggleEquip(c, c.inventory[0].id).char
    c = toggleEquip(c, c.inventory[1].id).char
    expect(c.inventory.filter((i) => i.equipped).map((i) => i.kind)).toEqual(['weapon'])
  })
  test('weapon attacks are derived', () => {
    let c = addItem(blank(), makeWeapon('longsword', 'blue'))
    c = toggleEquip(c, c.inventory[0].id).char
    expect(attacksOf(c)[0]).toMatchObject({ toHit: 4, damage: '1d8+1+2', damageType: 'slashing' })
  })
  test('potions stack into one slot', () => {
    let c = addItem(blank(), makeConsumable('heal-green'))
    c = addItem(c, makeConsumable('heal-green', 2))
    expect(c.inventory).toHaveLength(1)
    expect(c.inventory[0].qty).toBe(3)
    expect(encumbrance(c).used).toBe(1)
  })
})

describe('combat', () => {
  const def = (o = {}) => ({ name: 'T', acFor: () => 12, traits: [], ...o })
  test('nat 20 crits, nat 1 misses', () => {
    expect(resolveAttack({ toHit: 0, damage: '1d6', damageType: 'slashing', d20: 20 }, def()).crit).toBe(true)
    expect(resolveAttack({ toHit: 99, damage: '1d6', damageType: 'slashing', d20: 1 }, def()).hit).toBe(false)
  })
  test('armor reduce then resistance', () => {
    const r = resolveAttack({ toHit: 5, damage: '10', damageType: 'slashing', d20: 15 },
      def({ traits: [{ id: 't', name: 'r', effect: 'resistance', types: ['slashing'] }], armor: { ...armorStats('leather', 'green', 2) } }))
    expect(r.damage).toBe(4) // (10 − 1) / 2
  })
  test('miss wears the weapon, hit wears the armor', () => {
    const armor = armorStats('leather', 'mythic', 2)
    expect(resolveAttack({ toHit: 0, damage: '1', damageType: 'piercing', d20: 2 }, def({ armor })).weaponWear).toBe(1)
    expect(resolveAttack({ toHit: 10, damage: '1', damageType: 'piercing', d20: 10 }, def({ armor })).wear?.amount).toBe(2)
  })
  test('second wind', () => {
    expect(takeDamage(5, 2, 20, true)).toMatchObject({ hp: 1, usedSecondWind: true })
  })
})

describe('blacksmith', () => {
  test('upgrade 3→1 keeps lowest durability and charges', () => {
    let c = blank()
    for (const d of [15, 7, 12]) c = addItem(c, { ...makeArmor('padded', 'green'), dur: d })
    const r = upgrade(c, c.inventory.map((i) => i.id))
    expect(r.ok).toBe(true)
    expect(r.item).toMatchObject({ tier: 'blue', dur: 7 })
    expect(r.char.purse.gold).toBe(95)
  })
  test('heavy upgrade fee ×5', () => {
    let c = blank()
    for (let i = 0; i < 3; i++) c = addItem(c, makeArmor('plate', 'green'))
    expect(upgrade(c, c.inventory.map((i) => i.id)).char.purse.gold).toBe(75)
  })
  test('craft needs 4 mats, gray cannot craft', () => {
    const c = addItem(blank(), makeMaterial('blue', 4))
    expect(craft(c, 'blue', { kind: 'weapon', id: 'dagger' }).item?.name).toBe('Rare Dagger')
    expect(craft(addItem(blank(), makeMaterial('gray', 4)), 'gray', { kind: 'weapon', id: 'dagger' }).ok).toBe(false)
  })
  test('merge 3→1', () => {
    const r = merge(addItem(blank(), makeMaterial('gray', 3)), 'gray')
    expect(r.char.inventory[0]).toMatchObject({ mat: 'green', qty: 1 })
  })
  test('salvage bands', () => {
    expect(salvageYield(0, 15, 'green')).toEqual([{ mat: 'green', qty: 1 }])
    expect(salvageYield(9, 15, 'green')).toEqual([{ mat: 'green', qty: 2 }])
    expect(salvageYield(15, 15, 'green')).toEqual([{ mat: 'green', qty: 2 }, { mat: 'gray', qty: 2 }])
    const c = addItem(blank(), { ...makeArmor('padded', 'purple'), special: 'pink' })
    expect(salvage(c, c.inventory[0].id).ok).toBe(false)
  })
  test('kit dice step up on lower tiers', () => {
    expect(kitDice('blue', 'green')).toBe('1d8+4')
    expect(kitDice('green', 'blue')).toBeNull()
  })
  test('durability table', () => { expect(maxDur(makeArmor('plate', 'mythic'))).toBe(96) })
})

describe('loot', () => {
  test('tier guess', () => {
    expect(guessTier('Ancient Red Dragon')).toBe('mythic')
    expect(guessTier('Young Red Dragon')).toBe('legendary')
    expect(guessTier('Hill Giant')).toBe('purple')
    expect(guessTier('Orc')).toBe('blue')
    expect(guessTier('Goblin')).toBe('green')
  })
  test('common: 20% drop', () => {
    expect(rollLoot('green', {}, seq(0.5))).toEqual([])
    expect(rollLoot('green', {}, seq(0.1, 0.1))[0].mat).toBe('gray')
  })
  test('mythic always drops legendary', () => {
    expect(rollLoot('mythic', {}, seq(0.9))[0].tier).toBe('legendary')
  })
  test('split', () => { expect(splitCoins(1, 3, 4)).toEqual({ each: 3, leftover: 1 }) })
})

describe('economy', () => {
  test('favor: every 5 = 1% off; refuse at −40', () => {
    expect(markup({ baseAdjust: 15 } as never, 25)).toBe(10)
    expect(refuses(-40)).toBe(true)
    expect(refuses(-39)).toBe(false)
  })
  test('always one merchant', () => {
    const t = { ...town(), merchants: [DEFAULT_MERCHANTS[0]] }
    expect(removeMerchant(t, 'mara').ok).toBe(false)
  })
  test('vault doubles', () => {
    expect([0, 1, 2, 3].map(vaultPrice)).toEqual([1, 2, 4, 8])
    const r = buyVaultSlots(blank(), town())
    expect(r.town.vault.slots).toBe(15)
    let t = { ...town(), vault: { slots: 1, blocks: 0, items: [] } }
    let c = addItem(addItem(blank(), makeWeapon('dagger', 'green')), makeWeapon('mace', 'green'))
    const d1 = deposit(c, t, c.inventory[0].id); t = d1.town; c = d1.char
    expect(deposit(c, t, c.inventory[0].id).ok).toBe(false)
  })
  test('fountain keeps coins and resets on reward', () => {
    const r = offer({ silver: 95, threshold: 10 }, 5)
    expect(r.granted).toBe(true)
    expect(r.fountain.silver).toBe(0)
  })
  test('trade moves item only on accept', () => {
    const a = addItem(blank({ id: 'a' }), makeWeapon('dagger', 'green'))
    const b = blank({ id: 'b' })
    const r = acceptTrade(a, b, a.inventory[0].id, 1)!
    expect(r.from.inventory).toHaveLength(0)
    expect(r.to.inventory).toHaveLength(1)
  })
  test('pay makes change', () => {
    expect(pay(blank({ purse: { gold: 1, silver: 2 } }), 5)!.purse).toEqual({ gold: 0, silver: 7 })
    expect(pay(blank({ purse: { gold: 0, silver: 2 } }), 5)).toBeNull()
  })
})

describe('level, inspiration, slots', () => {
  test('level up adds hp and checklist', () => {
    const c = levelUp(blank({ level: 3 }), 6)
    expect(c.level).toBe(4)
    expect(c.maxHp).toBe(19)
    expect(c.levelTasks).toMatchObject({ asi: false })
  })
  test('inspiration caps at 2', () => {
    const c = giveInspiration(giveInspiration(blank())!)!
    expect(c.inspiration).toBe(2)
    expect(giveInspiration(c)).toBeNull()
  })
  test('slots', () => {
    expect(slotsFor('Wizard', 5).max.slice(0, 3)).toEqual([4, 3, 2])
    expect(slotsFor('Paladin', 1).max[0]).toBe(0)
    expect(slotsFor('Warlock', 5)).toMatchObject({ pact: true })
    expect(slotsFor('Warlock', 5).max[2]).toBe(2)
  })
})

describe('casino', () => {
  test('hand values with soft aces', () => {
    expect(handValue([{ r: 'A', s: '♠' }, { r: 'K', s: '♠' }]).total).toBe(21)
    expect(handValue([{ r: 'A', s: '♠' }, { r: 'A', s: '♥' }, { r: '9', s: '♠' }]).total).toBe(21)
  })
  test('roulette payouts', () => {
    expect(rouletteWins({ kind: 'red' }, 1)).toBe(1)
    expect(rouletteWins({ kind: 'red' }, 0)).toBe(0)
    expect(rouletteWins({ kind: 'number', n: 17 }, 17)).toBe(35)
  })
  test('a round settles', () => {
    let r = deal([{ id: 'p', name: 'P', bet: 10 }], [])
    if (r.phase === 'insurance') r = { ...r, phase: 'playing' }
    r = act(r, 'p', 'stand')
    if (r.phase !== 'done') r = settle(r)
    expect(r.phase).toBe('done')
    expect(r.seats[0].hands[0].result).toBeDefined()
  })
})
