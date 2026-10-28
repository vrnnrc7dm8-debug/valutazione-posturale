export type ZipContents = Record<string, Uint8Array>

/** Normalizza path ZIP (backslash, prefisso cartella root, voci directory). */
export function normalizeZipContents(raw: ZipContents): ZipContents {
  const entries: [string, Uint8Array][] = []

  for (const [key, value] of Object.entries(raw)) {
    if (!key || key.endsWith('/') || key.includes('__MACOSX/') || key.endsWith('.DS_Store')) continue
    const normalizedKey = key.replace(/\\/g, '/').replace(/^\.\//, '')
    if (normalizedKey.startsWith('/') || normalizedKey.split('/').some(part => !part || part === '..' || part === '.')) throw new Error('Percorso non sicuro nel pacchetto importato.')
    if (entries.some(([existing]) => existing === normalizedKey)) throw new Error('File duplicato nel pacchetto importato.')
    entries.push([normalizedKey, value])
  }

  const manifests = entries.filter(([k]) => (k === 'manifest.json' || k.endsWith('/manifest.json')) && !k.split('/').includes('attachments'))
  if (manifests.length !== 1) throw new Error('Il pacchetto deve contenere un solo manifest.json.')
  const manifestPath = manifests[0]?.[0]

  if (!manifestPath || manifestPath === 'manifest.json') {
    return Object.fromEntries(entries)
  }

  const rootPrefix = manifestPath.slice(0, -'manifest.json'.length)
  const stripped = entries.map(([k, v]) => {
    if (k.startsWith(rootPrefix)) {
      return [k.slice(rootPrefix.length), v] as [string, Uint8Array]
    }
    return [k, v] as [string, Uint8Array]
  })

  return Object.fromEntries(stripped)
}

export function getZipEntry(
  contents: ZipContents,
  path: string,
): Uint8Array | undefined {
  const normalized = path.replace(/\\/g, '/').replace(/^\.\//, '')
  return contents[normalized] ?? contents[normalized.replace(/^\//, '')]
}

export function requireZipEntry(contents: ZipContents, path: string): Uint8Array {
  const entry = getZipEntry(contents, path)
  if (!entry) {
    throw new Error(`File mancante nello ZIP: ${path}`)
  }
  return entry
}

export function findZipEntryPath(
  contents: ZipContents,
  suffix: string,
): string | undefined {
  return Object.keys(contents).find(
    (k) => k === suffix || k.endsWith(`/${suffix}`),
  )
}
