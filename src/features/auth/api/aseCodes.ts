const MAP: Record<string, string> = {
  'ASE-001': 'auth.error.invalidCredentials',
  'ASE-002': 'auth.error.tfaExpired',
  'ASE-004': 'auth.error.missingFields',
  'ASE-005': 'auth.error.userNotFound',
  'ASE-008': 'auth.error.alreadyRegistered',
  'ASE-009': 'auth.error.syncFailed',
}

export const aseCodeToMessageKey = (code: string | undefined): string => {
  return (code && MAP[code]) || 'auth.error.generic'
}
