import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const LANGS = ['ar','cs','de','el','es','id','it','ja','ms-MY','pl','pt-BR','th','tr','vi','zh-Hans','zh-Hant']
const NS = ['auth', 'common']
const root = process.cwd()

const flatten = (o: Record<string, unknown>, p = '', out: Record<string, string> = {}) => {
  for (const [k, v] of Object.entries(o)) {
    const key = p ? `${p}.${k}` : k
    if (v && typeof v === 'object') flatten(v as Record<string, unknown>, key, out)
    else if (typeof v === 'string') out[key] = v
  }
  return out
}
const load = (lang: string, ns: string) =>
  JSON.parse(readFileSync(join(root, 'public/locales', lang, `${ns}.json`), 'utf8')) as Record<string, unknown>

describe('locale completeness', () => {
  for (const ns of NS) {
    const enKeys = new Set(Object.keys(flatten(load('en', ns))))
    for (const lang of LANGS) {
      it(`${lang}/${ns}.json exists and has no keys outside the English set`, () => {
        const filePath = join(root, 'public/locales', lang, `${ns}.json`)
        expect(existsSync(filePath)).toBe(true)
        if (!existsSync(filePath)) return
        const langKeys = Object.keys(flatten(load(lang, ns)))
        const orphans = langKeys.filter((k) => !enKeys.has(k))
        expect(orphans).toEqual([])
      })
    }
  }
})
