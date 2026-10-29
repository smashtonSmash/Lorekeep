// The DM's live reference. Every number here is read from the rules code, so it can't drift.
import { setDoc, useApp } from '../core/store'
import { useRole } from '../core/role'
import { TIERS } from '../core/types'
import { ARMOR, armorLines, armorStats } from '../rules/armor'
import {
  ARMOR_HP, ARMOR_PRICE, BROKEN_MULT, CONSUMABLES, CRAFT_GOLD, DAMAGED_AT, KIT_DICE, KIT_PRICE, MERGE_FEE_SILVER, REPAIR_PER_POINT, SALVAGE_RICH_ABOVE,
  SHIELDS, UPGRADE_FEE, WEAPON_FLAT, WEAPON_HP, WEAPON_PRICE, WEAR, consumableName,
} from '../rules/gear'
import { FAVOR_STEP, FOUNTAIN_THRESHOLDS, REFUSE_AT, VAULT_BLOCK, VAULT_START } from '../rules/economy'
import { MYTHIC_RULE, PIES } from '../rules/loot'
import { SPECIAL_COLOR, SPECIAL_LABEL, TIER_COLOR, TIER_LABEL } from '../rules/tiers'
import { Empty, Stepper, confirmBox } from '../ui/kit'

const T = ({ t }: { t: (typeof TIERS)[number] }) => <span style={{ color: TIER_COLOR[t], fontWeight: 700 }}>{TIER_LABEL[t]}</span>

export default function Rules() {
  const s = useApp()
  const role = useRole()
  const set = s.docs.settings
  const recap = s.docs.recap.events
  return (
    <div className="stack">
      <h2>DM reference</h2>
      <p className="muted">Numbers marked <span className="ph">PLACEHOLDER</span> are first passes, ready for tuning.</p>

      <div className="card stack">
        <div className="row between"><h3>Session recap</h3>{role.isDM && recap.length > 0 && <button className="btn small" onClick={async () => { if (await confirmBox('Clear the recap for the next session?', 'Clear')) setDoc('recap', () => ({ events: [] })) }}>Clear for next session</button>}</div>
        {recap.length ? <div className="log">{[...recap].reverse().map((e) => <div key={e.id}>{e.icon} {e.text} <small>· {new Date(e.t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</small></div>)}</div> : <Empty>Loot, purchases, forge work and casino results land here as they happen.</Empty>}
      </div>

      {role.isDM && (
        <div className="card stack">
          <h3>Table settings</h3>
          <div className="row between"><span>Custom origin ability points</span><Stepper value={set.originBudget} min={0} max={8} onChange={(n) => setDoc('settings', (x) => ({ ...x, originBudget: n }))} /></div>
          <label className="toggle"><input type="checkbox" checked={set.allowReroll} onChange={(e) => setDoc('settings', (x) => ({ ...x, allowReroll: e.target.checked }))} /> Players may reroll their 4d6 ability scores</label>
        </div>
      )}

      <div className="card stack">
        <h3>House rules</h3>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>Only the DM gives items after character creation (quick picks, custom items, loot). Players spend, trade, equip, salvage and take revealed loot.</li>
          <li>Only the DM uses Add Gold. Loot, town sales, casino winnings and trades still move coin. 10 silver = 1 gold.</li>
          <li>Trades wait for the receiver to Accept. The item stays with the giver until then.</li>
          <li>Anyone can read a spell scroll from their pack. No slot needed.</li>
          <li>Nothing drops just because HP hits 0. The DM rolls loot.</li>
          <li>Inspiration: 2 pips per character. The DM gives them.</li>
          <li>Carrying capacity = Strength score in slots. Armor 1, great weapons and longbows 2, identical potions share one slot. Over capacity is a warning only.</li>
        </ul>
      </div>

      <div className="card stack">
        <h3>Rarity</h3>
        <div className="row">{TIERS.map((t) => <T key={t} t={t} />)}<span>·</span>{(['pink', 'black'] as const).map((x) => <span key={x} style={{ color: SPECIAL_COLOR[x], fontWeight: 700 }}>{SPECIAL_LABEL[x]}</span>)}</div>
        <small>Special (pink) and Named Mythic (black) sit beside the ladder. They don't upgrade, salvage or appear on loot tables. Named Mythic gear must be synced to its owner.</small>
      </div>

      <div className="card stack">
        <h3>Monster loot</h3>
        <div className="scroll-x"><table className="simple"><thead><tr><th>Tier</th><th>Drop</th><th>Slices</th></tr></thead><tbody>
          {(Object.keys(PIES) as (keyof typeof PIES)[]).map((t) => <tr key={t}><td><T t={t} /></td><td>{PIES[t].drop * 100}%</td><td>{PIES[t].slices.map((x) => ('mat' in x ? `${x.w} ${x.mat} mat` : `${x.w} ${TIER_LABEL[x.gear]} gear`)).join(' · ')}</td></tr>)}
          <tr><td><T t="mythic" /></td><td>100%</td><td>{MYTHIC_RULE}</td></tr>
        </tbody></table></div>
        <small>Gear is the weapon they hold or armor that fits (50/50 if both). Light or unknown armor splits evenly across padded, leather and studded. Tier is guessed from the name; the DM can override it.</small>
      </div>

      <div className="card stack">
        <h3>Healing & consumables</h3>
        <div className="scroll-x"><table className="simple"><thead><tr><th>Item</th><th>Tier</th><th>Price</th><th>Effect</th></tr></thead><tbody>
          {CONSUMABLES.map((c) => <tr key={c.key}><td>{consumableName(c)}</td><td><T t={c.tier} /></td><td>{c.price}g</td><td>{c.desc}</td></tr>)}
        </tbody></table></div>
      </div>

      <div className="card stack">
        <h3>Armor</h3>
        <small>Light: base + full Dex. Medium: Dex up to +2. Heavy: no Dex. Each tier stacks on the ones below. Mythic resets AC bonuses to +3 vs its focus, −1 vs the other physical types.</small>
        {ARMOR.map((a) => (
          <details key={a.id} className="card tight">
            <summary>{a.name} · {a.cat} · AC {a.base} · {a.focus}</summary>
            <p className="muted" style={{ fontSize: '.85rem' }}>{a.always.join(' · ')}</p>
            {TIERS.map((t) => { const st = armorStats(a.id, t, 2); return <p key={t} style={{ fontSize: '.88rem' }}><T t={t} />: {[...armorLines(st), ...st.notes.filter((n) => !a.always.includes(n))].join('; ') || '—'} <small>(prof +2 shown)</small></p> })}
          </details>
        ))}
      </div>

      <div className="card stack">
        <h3>Shields</h3>
        {SHIELDS.map((sh) => <details key={sh.id} className="card tight"><summary>{sh.name} · {sh.cat} row</summary>{TIERS.map((t) => <p key={t} style={{ fontSize: '.88rem' }}><T t={t} />: +{sh.ac[t]} AC. {sh.rules[t].join(' ')}</p>)}</details>)}
      </div>

      <div className="card stack">
        <h3>Prices, durability & the forge</h3>
        <div className="scroll-x"><table className="simple"><thead><tr><th></th>{TIERS.map((t) => <th key={t}><T t={t} /></th>)}</tr></thead><tbody>
          <tr><td>Light armor price (medium ×2, heavy ×5)</td>{TIERS.map((t) => <td key={t}>{ARMOR_PRICE[t]}g</td>)}</tr>
          <tr><td>Weapon price <span className="ph">PLACEHOLDER</span></td>{TIERS.map((t) => <td key={t}>{WEAPON_PRICE[t]}g</td>)}</tr>
          <tr><td>Weapon bonus damage <span className="ph">PLACEHOLDER</span></td>{TIERS.map((t) => <td key={t}>+{WEAPON_FLAT[t]}</td>)}</tr>
          {(['light', 'medium', 'heavy'] as const).map((c) => <tr key={c}><td>{c} armor durability <span className="ph">PLACEHOLDER</span></td>{TIERS.map((t) => <td key={t}>{ARMOR_HP[c][t]}</td>)}</tr>)}
          {(['light', 'standard', 'heavy'] as const).map((c) => <tr key={c}><td>{c} weapon durability <span className="ph">PLACEHOLDER</span></td>{TIERS.map((t) => <td key={t}>{WEAPON_HP[c][t]}</td>)}</tr>)}
          <tr><td>Repair (gold / point, Broken ×{BROKEN_MULT})</td>{TIERS.map((t) => <td key={t}>{REPAIR_PER_POINT[t]}g</td>)}</tr>
          <tr><td>Upgrade 3→1 fee (from)</td>{TIERS.map((t) => <td key={t}>{UPGRADE_FEE[t] != null ? `${UPGRADE_FEE[t]}g` : '—'}</td>)}</tr>
          <tr><td>Craft (4 mats +)</td>{TIERS.map((t) => <td key={t}>{CRAFT_GOLD[t]}g</td>)}</tr>
          <tr><td>Repair kit dice</td>{TIERS.map((t) => <td key={t}>{KIT_DICE[t]}</td>)}</tr>
          <tr><td>Repair kit price</td>{TIERS.map((t) => <td key={t}>{KIT_PRICE[t]}g</td>)}</tr>
        </tbody></table></div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: '.92rem' }}>
          <li>Wear when hit: {WEAR.hit} · weak type {WEAR.weak} · critical {WEAR.crit}. Weapons lose {WEAR.miss} on a miss.</li>
          <li>Damaged at or below {DAMAGED_AT * 100}% (half plate Legendary+: 25%): −1 AC. Broken at 0: unusable; kits can't fix it.</li>
          <li>Salvage: Broken → 1 mat of its tier; up to {SALVAGE_RICH_ABOVE * 100}% → 2; above → 2 + 2 of the tier below.</li>
          <li>Merge 3 mats → 1 of the next color for {MERGE_FEE_SILVER} silver <span className="ph">PLACEHOLDER</span>. Gray only merges. 2 mats → 1 repair kit.</li>
          <li>A higher-tier kit on lower gear rolls one die size bigger. A lower kit can't fix higher gear.</li>
        </ul>
      </div>

      <div className="card stack">
        <h3>Town</h3>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: '.92rem' }}>
          <li>Favor runs −100 to +100 per character per merchant, starting at 0. Every {FAVOR_STEP} favor takes 1% off that merchant's markup. At {REFUSE_AT} or below they refuse to sell. <span className="ph">PLACEHOLDER</span></li>
          <li>Each purchase adds +2 favor with that merchant. Merchants buy items at half list price. <span className="ph">PLACEHOLDER</span></li>
          <li>Vault: {VAULT_START} slots, then +{VAULT_BLOCK} for 1g, 2g, 4g, 8g… (doubling). One shared vault in every town.</li>
          <li>Wishing fountain: a secret threshold of {FOUNTAIN_THRESHOLDS.join(' / ')}g. Coins are kept; meeting it grants a gift <span className="ph">PLACEHOLDER</span> and re-rolls the secret.</li>
        </ul>
      </div>
    </div>
  )
}
