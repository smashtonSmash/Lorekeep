// SRD 5.1 monsters (CC-BY-4.0), trimmed to what a battle card needs.
import type { DamageType, TraitEffect } from '../core/types'

export interface MonsterDef {
  key: string; name: string; cr: string; ac: number; hp: string; dex: number; armor?: string; beast?: boolean
  attacks: [string, number, string, DamageType][]
  traits?: [TraitEffect, DamageType[]][]
}
const NONMAGIC: DamageType[] = ['bludgeoning', 'piercing', 'slashing']
const m = (key: string, name: string, cr: string, ac: number, hp: string, dex: number, attacks: MonsterDef['attacks'], o: Partial<MonsterDef> = {}): MonsterDef => ({ key, name, cr, ac, hp, dex, attacks, ...o })

export const MONSTERS: MonsterDef[] = [
  m('rat', 'Giant Rat', '1/8', 12, '2d6', 2, [['Bite', 4, '1d4+2', 'piercing']], { beast: true }),
  m('kobold', 'Kobold', '1/8', 12, '2d6-2', 2, [['Dagger', 4, '1d4+2', 'piercing'], ['Sling', 4, '1d4+2', 'bludgeoning']]),
  m('bandit', 'Bandit', '1/8', 12, '2d8+2', 1, [['Scimitar', 3, '1d6+1', 'slashing'], ['Light Crossbow', 3, '1d8+1', 'piercing']], { armor: 'leather armor' }),
  m('cultist', 'Cultist', '1/8', 12, '2d8', 1, [['Scimitar', 3, '1d6+1', 'slashing']], { armor: 'leather armor' }),
  m('goblin', 'Goblin', '1/4', 15, '2d6', 2, [['Scimitar', 4, '1d6+2', 'slashing'], ['Shortbow', 4, '1d6+2', 'piercing']], { armor: 'leather armor, shield' }),
  m('skeleton', 'Skeleton', '1/4', 13, '2d8+4', 2, [['Shortsword', 4, '1d6+2', 'piercing'], ['Shortbow', 4, '1d6+2', 'piercing']], { armor: 'armor scraps', traits: [['vulnerability', ['bludgeoning']], ['immunity', ['poison']]] }),
  m('zombie', 'Zombie', '1/4', 8, '3d8+9', -2, [['Slam', 3, '1d6+1', 'bludgeoning']], { traits: [['immunity', ['poison']]] }),
  m('wolf', 'Wolf', '1/4', 13, '2d8+2', 2, [['Bite', 4, '2d4+2', 'piercing']], { beast: true }),
  m('boar', 'Boar', '1/4', 11, '2d8+2', 0, [['Tusk', 3, '1d6+1', 'slashing']], { beast: true }),
  m('orc', 'Orc', '1/2', 13, '2d8+6', 1, [['Greataxe', 5, '1d12+3', 'slashing'], ['Javelin', 5, '1d6+3', 'piercing']], { armor: 'hide armor' }),
  m('hobgoblin', 'Hobgoblin', '1/2', 18, '2d8+2', 1, [['Longsword', 3, '1d8+1', 'slashing'], ['Longbow', 3, '1d8+1', 'piercing']], { armor: 'chain mail, shield' }),
  m('gnoll', 'Gnoll', '1/2', 15, '5d8', 1, [['Bite', 4, '1d4+2', 'piercing'], ['Spear', 4, '1d6+2', 'piercing'], ['Longbow', 3, '1d8+1', 'piercing']], { armor: 'hide armor, shield' }),
  m('lizardfolk', 'Lizardfolk', '1/2', 15, '4d8+4', 0, [['Bite', 4, '1d6+2', 'piercing'], ['Heavy Club', 4, '1d6+2', 'bludgeoning']], { armor: 'natural armor, shield' }),
  m('shadow', 'Shadow', '1/2', 12, '3d8+3', 2, [['Strength Drain', 4, '2d6+2', 'necrotic']], { traits: [['resistance', ['acid', 'cold', 'fire', 'lightning', 'thunder', ...NONMAGIC]], ['immunity', ['necrotic', 'poison']], ['vulnerability', ['radiant']]] }),
  m('bugbear', 'Bugbear', '1', 16, '5d8+5', 2, [['Morningstar', 4, '2d8+2', 'piercing'], ['Javelin', 4, '1d6+2', 'piercing']], { armor: 'hide armor, shield' }),
  m('dire-wolf', 'Dire Wolf', '1', 14, '5d10+10', 2, [['Bite', 5, '2d6+3', 'piercing']], { beast: true }),
  m('ghoul', 'Ghoul', '1', 12, '5d8', 2, [['Claws', 4, '2d4+2', 'slashing'], ['Bite', 2, '2d6+2', 'piercing']], { traits: [['immunity', ['poison']]] }),
  m('brown-bear', 'Brown Bear', '1', 11, '4d10+12', 0, [['Bite', 6, '1d8+4', 'piercing'], ['Claws', 6, '2d6+4', 'slashing']], { beast: true }),
  m('thug', 'Thug', '1/2', 11, '5d8+10', 0, [['Mace', 4, '1d6+2', 'bludgeoning'], ['Heavy Crossbow', 2, '1d10', 'piercing']], { armor: 'leather armor' }),
  m('veteran', 'Veteran', '3', 17, '9d8+18', 1, [['Longsword', 5, '1d8+3', 'slashing'], ['Shortsword', 5, '1d6+3', 'piercing']], { armor: 'splint' }),
  m('knight', 'Knight', '3', 18, '8d8+16', 0, [['Greatsword', 5, '2d6+3', 'slashing']], { armor: 'plate' }),
  m('ogre', 'Ogre', '2', 11, '7d10+21', -1, [['Greatclub', 6, '2d8+4', 'bludgeoning'], ['Javelin', 6, '2d6+4', 'piercing']], { armor: 'hide armor' }),
  m('gargoyle', 'Gargoyle', '2', 15, '7d8+21', 0, [['Bite', 4, '1d6+2', 'piercing'], ['Claws', 4, '1d6+2', 'slashing']], { traits: [['resistance', NONMAGIC], ['immunity', ['poison']]] }),
  m('owlbear', 'Owlbear', '3', 13, '7d10+21', 1, [['Beak', 7, '1d10+5', 'piercing'], ['Claws', 7, '2d8+5', 'slashing']], { beast: true }),
  m('werewolf', 'Werewolf', '3', 12, '9d8+18', 1, [['Bite', 4, '1d8+2', 'piercing'], ['Claws', 4, '2d4+2', 'slashing']], { traits: [['immunity', NONMAGIC]] }),
  m('minotaur', 'Minotaur', '3', 14, '9d10+27', 0, [['Greataxe', 6, '2d12+4', 'slashing'], ['Gore', 6, '2d8+4', 'piercing']]),
  m('mummy', 'Mummy', '3', 11, '9d8+18', -1, [['Rotting Fist', 5, '2d6+3', 'bludgeoning']], { traits: [['vulnerability', ['fire']], ['resistance', NONMAGIC], ['immunity', ['necrotic', 'poison']]] }),
  m('ghost', 'Ghost', '4', 11, '10d8', 1, [['Withering Touch', 5, '4d6+3', 'necrotic']], { traits: [['resistance', ['acid', 'fire', 'lightning', 'thunder', ...NONMAGIC]], ['immunity', ['cold', 'necrotic', 'poison']]] }),
  m('troll', 'Troll', '5', 15, '8d10+40', 1, [['Bite', 7, '1d6+4', 'piercing'], ['Claw', 7, '2d6+4', 'slashing']], { armor: 'natural armor' }),
  m('hill-giant', 'Hill Giant', '5', 13, '10d12+40', -1, [['Greatclub', 8, '3d8+5', 'bludgeoning'], ['Rock', 8, '3d10+5', 'bludgeoning']], { armor: 'natural armor' }),
  m('wyvern', 'Wyvern', '6', 13, '13d10+39', 0, [['Bite', 7, '2d6+4', 'piercing'], ['Stinger', 7, '2d6+4', 'piercing']]),
  m('young-red-dragon', 'Young Red Dragon', '10', 18, '17d10+85', 0, [['Bite', 10, '2d10+6', 'piercing'], ['Claw', 10, '2d6+6', 'slashing'], ['Fire Breath (DEX 17)', 0, '16d6', 'fire']], { traits: [['immunity', ['fire']]] }),
  m('vampire', 'Vampire', '13', 16, '17d8+68', 4, [['Unarmed Strike', 9, '1d8+4', 'bludgeoning'], ['Bite', 9, '1d6+4', 'piercing']], { traits: [['resistance', ['necrotic', ...NONMAGIC]]] }),
  m('beholder', 'Beholder', '13', 18, '19d10+76', 2, [['Bite', 5, '4d6', 'piercing'], ['Disintegration Ray', 0, '10d8', 'force']]),
  m('adult-black-dragon', 'Adult Black Dragon', '14', 19, '17d12+85', 2, [['Bite', 11, '2d10+6', 'piercing'], ['Claw', 11, '2d6+6', 'slashing'], ['Acid Breath (DEX 18)', 0, '12d8', 'acid']], { traits: [['immunity', ['acid']]] }),
  m('lich', 'Lich', '21', 17, '18d8+54', 3, [['Paralyzing Touch', 12, '3d6', 'cold']], { traits: [['resistance', ['cold', 'lightning', 'necrotic']], ['immunity', ['poison', ...NONMAGIC]]] }),
  m('ancient-red-dragon', 'Ancient Red Dragon', '24', 22, '28d20+252', 0, [['Bite', 17, '2d10+10', 'piercing'], ['Claw', 17, '2d6+10', 'slashing'], ['Fire Breath (DEX 24)', 0, '26d6', 'fire']], { traits: [['immunity', ['fire']]] }),
  m('tarrasque', 'Tarrasque', '30', 25, '33d20+330', 0, [['Bite', 19, '4d12+10', 'piercing'], ['Claw', 19, '4d8+10', 'slashing'], ['Tail', 19, '4d6+10', 'bludgeoning']], { traits: [['immunity', ['fire', 'poison', ...NONMAGIC]]] }),
]
