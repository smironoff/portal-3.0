// Harvest legacy portal-2.0 translations into portal-3.0 by matching English source text.
// Usage: node scripts/i18n-harvest.mjs
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const LEGACY = 'C:/Work/ThinkMarkets/portal-2.0/public/locales'

if (!existsSync(LEGACY)) {
  console.error(`Legacy locales not found at ${LEGACY}. Set the correct path and re-run.`)
  process.exit(1)
}

const LANGS = ['ar','cs','de','el','es','id','it','ja','ms-MY','pl','pt-BR','th','tr','vi','zh-Hans','zh-Hant']
const NS = ['auth', 'common']

const flatten = (obj, prefix, out) => {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object') flatten(v, key, out)
    else if (typeof v === 'string') out[key] = v
  }
  return out
}

// Build, per language, an index: englishValue -> translatedValue (first match wins).
const enIndexByLang = {}
const enLegacy = {}
for (const file of readdirSync(join(LEGACY, 'en'))) {
  if (!file.endsWith('.json')) continue
  flatten(JSON.parse(readFileSync(join(LEGACY, 'en', file), 'utf8')), '', enLegacy)
}
// enLegacy: legacyKeyPath -> englishValue. Invert to englishValue -> legacyKeyPath.
const keyByEnglish = {}
for (const [kp, val] of Object.entries(enLegacy)) if (!(val in keyByEnglish)) keyByEnglish[val] = kp

for (const lang of LANGS) {
  const langFlat = {}
  const dir = join(LEGACY, lang)
  if (!existsSync(dir)) continue
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.json')) continue
    flatten(JSON.parse(readFileSync(join(dir, file), 'utf8')), '', langFlat)
  }
  // englishValue -> translated, via the legacy key path
  const idx = {}
  for (const [eng, kp] of Object.entries(keyByEnglish)) {
    if (kp in langFlat) idx[eng] = langFlat[kp]
  }
  enIndexByLang[lang] = idx
}

const setDeep = (obj, path, value) => {
  const parts = path.split('.')
  let cur = obj
  for (let i = 0; i < parts.length - 1; i++) {
    cur[parts[i]] = cur[parts[i]] ?? {}
    cur = cur[parts[i]]
  }
  cur[parts[parts.length - 1]] = value
}

const missing = {}
for (const ns of NS) {
  const enNs = JSON.parse(readFileSync(join(ROOT, 'public/locales/en', `${ns}.json`), 'utf8'))
  const enFlat = flatten(enNs, '', {})
  for (const lang of LANGS) {
    const out = {}
    const idx = enIndexByLang[lang] ?? {}
    for (const [keyPath, enVal] of Object.entries(enFlat)) {
      const translated = idx[enVal]
      if (translated != null) setDeep(out, keyPath, translated)
      else {
        setDeep(out, keyPath, enVal) // English fallback so the file is structurally complete
        ;(missing[lang] ??= []).push(`${ns}.${keyPath}`)
      }
    }
    const outDir = join(ROOT, 'public/locales', lang)
    mkdirSync(outDir, { recursive: true })
    writeFileSync(join(outDir, `${ns}.json`), JSON.stringify(out, null, 2) + '\n', 'utf8')
  }
}

console.log('Harvest complete. English-only fallbacks (need translation):')
for (const [lang, keys] of Object.entries(missing)) console.log(`  ${lang}: ${keys.length} -> ${keys.join(', ')}`)
