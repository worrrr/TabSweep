export function getMessage(key: string, substitutions?: string | string[]): string {
  try {
    return chrome?.i18n?.getMessage?.(key, substitutions) || key
  } catch {
    return key
  }
}

export function getUILanguage(): string {
  try {
    return chrome?.i18n?.getUILanguage?.() || 'en'
  } catch {
    return 'en'
  }
}

export function isZhLanguage(): boolean {
  try {
    const lang = getUILanguage().toLowerCase()
    return lang.startsWith('zh')
  } catch {
    return false
  }
}

