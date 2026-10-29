// Races, classes and backgrounds: SRD 5.1 bundle + expanded options + the table's own custom origins.
import srd from './srd.json'
import { EXPANDED_BACKGROUNDS, EXPANDED_CLASSES, EXPANDED_RACES, type BgBlurb, type ClassBlurb, type RaceBlurb } from './expandedOrigins'

export type { BgBlurb, ClassBlurb, RaceBlurb }
const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name)
export const RACES: RaceBlurb[] = [...(srd.races as RaceBlurb[]), ...EXPANDED_RACES].sort(byName)
export const CLASSES: ClassBlurb[] = [...(srd.classes as ClassBlurb[]), ...EXPANDED_CLASSES].sort(byName)
export const BACKGROUNDS: BgBlurb[] = [...(srd.backgrounds as BgBlurb[]), ...EXPANDED_BACKGROUNDS].sort(byName)

/** Custom origins saved to the campaign library. */
export interface CustomOrigin { id: string; kind: 'race' | 'class' | 'background'; name: string; desc: string; hitDie?: number; skills?: string[]; saves?: string[] }
