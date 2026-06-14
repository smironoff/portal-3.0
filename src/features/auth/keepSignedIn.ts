const KEY = 'keepLogged'

export const keepSignedIn = {
  get: () => localStorage.getItem(KEY) === 'true',
  set: (v: boolean) => localStorage.setItem(KEY, String(v)),
}
