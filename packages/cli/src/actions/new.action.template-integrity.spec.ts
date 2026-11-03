import { readFileSync } from 'fs'
import path from 'path'

// Minimal semver range check for the forms used in overrides: an exact
// version ("4.3.2"), a bare major selector ("1"), "^x.y.z" (x >= 1) and
// "~x.y.z". Anything else (prerelease versions, "^1", 0.x caret ranges)
// throws, so a new form fails the test loudly instead of being misjudged.
function satisfies(version: string, range: string): boolean {
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`unsupported version "${version}"`)
  }
  const [major, minor, patch] = version.split('.').map(Number)
  const match = range.match(/^([\^~]?)(\d+)(?:\.(\d+)\.(\d+))?$/)
  if (!match) throw new Error(`unsupported range "${range}"`)
  const [, op, maj, min, pat] = match
  if (min === undefined) {
    if (op !== '') throw new Error(`unsupported range "${range}"`)
    return major === Number(maj)
  }
  const [rMajor, rMinor, rPatch] = [Number(maj), Number(min), Number(pat)]
  const atLeast =
    major > rMajor ||
    (major === rMajor &&
      (minor > rMinor || (minor === rMinor && patch >= rPatch)))
  if (op === '') return major === rMajor && minor === rMinor && patch === rPatch
  if (op === '~') return atLeast && major === rMajor && minor === rMinor
  if (rMajor === 0) throw new Error(`unsupported range "${range}"`)
  return atLeast && major === rMajor
}

// `mbc new` copies packages/cli/templates and runs `npm i` plus
// `npm run migrate` against it, but CI never installs the template. These
// checks catch template mistakes that only surface in a freshly scaffolded
// project.
describe('scaffolding template integrity', () => {
  const templatesDir = path.join(__dirname, '../../templates')

  describe('package.json overrides', () => {
    const packageJson = JSON.parse(
      readFileSync(path.join(templatesDir, 'package.json'), 'utf-8'),
    )
    const directDeps: Record<string, string> = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    }

    // npm rejects the whole install with EOVERRIDE ("Override for X conflicts
    // with direct dependency") when an override of a direct dependency does
    // not match its spec exactly. Use "$X" to reference the direct spec.
    it.each(
      Object.entries(packageJson.overrides ?? {}).filter(
        ([name]) => name in directDeps,
      ),
    )(
      'override for direct dependency %s matches its spec',
      (name, override) => {
        const spec =
          typeof override === 'string'
            ? override
            : (override as Record<string, unknown>)['.']

        if (spec === undefined) return
        expect([directDeps[name], `$${name}`]).toContain(spec)
      },
    )

    // The root overrides that clear production advisories do not reach
    // scaffolded projects: `mbc new` copies the template with its own
    // package.json and lockfile. Every root override whose package ships in
    // the template's production tree must therefore be mirrored in the
    // template, so new projects do not keep advisories the CHANGELOG reports
    // as fixed. Root overrides for packages that the template only has as dev
    // dependencies (or not at all) are not required.
    const rootOverrides: Record<string, unknown> = JSON.parse(
      readFileSync(path.join(templatesDir, '../../../package.json'), 'utf-8'),
    ).overrides
    const lockPackages: Record<
      string,
      { dev?: boolean; devOptional?: boolean }
    > = JSON.parse(
      readFileSync(path.join(templatesDir, 'package-lock.json'), 'utf-8'),
    ).packages
    const productionPackages = new Set(
      Object.entries(lockPackages)
        .filter(
          ([key, entry]) =>
            key.includes('node_modules/') && !entry.dev && !entry.devOptional,
        )
        .map(([key]) => key.slice(key.lastIndexOf('node_modules/') + 13)),
    )
    // "body-parser@1" -> "body-parser", "@scope/name@2" -> "@scope/name"
    const packageName = (selector: string) => {
      const at = selector.lastIndexOf('@')
      return at > 0 ? selector.slice(0, at) : selector
    }
    const mirrored = Object.keys(rootOverrides).filter((selector) =>
      productionPackages.has(packageName(selector)),
    )

    it('finds the production overrides to mirror', () => {
      expect(mirrored).toEqual(
        expect.arrayContaining([
          'multer',
          'proxy-addr',
          'body-parser@1',
          'body-parser@2',
          'qs',
        ]),
      )
    })

    it.each(mirrored)('mirrors the root override for %s', (selector) => {
      const name = packageName(selector)
      const override = packageJson.overrides?.[selector]
      // A direct dependency must be overridden with "$name" (EOVERRIDE); the
      // lockfile check below still holds its resolved version to the root.
      if (name in directDeps && override === `$${name}`) return
      expect(override).toEqual(rootOverrides[selector])
    })

    // The override strings can match while the committed lockfile, which is
    // what `mbc new` installs from, still pins an older version. Every
    // production copy of a mirrored package must satisfy the root range.
    it.each(
      mirrored.filter(
        (selector) => typeof rootOverrides[selector] === 'string',
      ),
    )('template lockfile satisfies the root override for %s', (selector) => {
      const name = packageName(selector)
      const selectorRange = selector.slice(name.length + 1) // "1" in body-parser@1
      const copies = Object.entries(lockPackages)
        .filter(
          ([key, entry]) =>
            key.endsWith(`node_modules/${name}`) &&
            !entry.dev &&
            !entry.devOptional,
        )
        .map(([, entry]) => (entry as { version: string }).version)
        .filter(
          (version) => !selectorRange || satisfies(version, selectorRange),
        )

      // A version-scoped selector (body-parser@2) may match no copy in the
      // template; an unscoped one always does, since it is in production.
      if (!selectorRange) expect(copies.length).toBeGreaterThan(0)
      for (const version of copies) {
        expect({
          version,
          satisfies: satisfies(version, rootOverrides[selector] as string),
        }).toEqual({ version, satisfies: true })
      }
    })
  })

  describe('prisma/ddb.ts (npm run migrate:ddb)', () => {
    const packageJson = JSON.parse(
      readFileSync(path.join(templatesDir, 'package.json'), 'utf-8'),
    )
    const source = readFileSync(
      path.join(templatesDir, 'prisma/ddb.ts'),
      'utf-8',
    )

    // .env.local writes endpoints as http://localhost:${LOCAL_X_PORT:-NNNN};
    // plain dotenv leaves that literal and the DynamoDB client throws
    // "Invalid URL", so the loaded env must go through dotenv-expand.
    it('expands ${VAR:-default} when loading .env', () => {
      expect(source).toMatch(/expand\(\s*dotenv\.config\(/)
    })

    it('declares dotenv and dotenv-expand as direct dependencies', () => {
      const deps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      }
      expect(deps).toHaveProperty('dotenv')
      expect(deps).toHaveProperty('dotenv-expand')
    })
  })

  describe('.env.local DATABASE_URL', () => {
    const lines = readFileSync(
      path.join(templatesDir, '.env.local'),
      'utf-8',
    ).split('\n')
    const index = lines.findIndex((line) => line.startsWith('DATABASE_URL='))
    const databaseUrl = lines[index]

    it('is defined', () => {
      expect(index).toBeGreaterThanOrEqual(0)
    })

    // Prisma expands ${VAR} in .env but not ${VAR:-default}; the latter fails
    // `prisma migrate deploy` with P1013 "invalid port number".
    it('does not use ${VAR:-default} expansion', () => {
      expect(databaseUrl).not.toMatch(/\$\{[A-Z0-9_]+:-/)
    })

    it('only references variables defined earlier in the file', () => {
      const referenced = [...databaseUrl.matchAll(/\$\{([A-Z0-9_]+)\}/g)].map(
        (match) => match[1],
      )
      const definedBefore = lines
        .slice(0, index)
        .map((line) => line.match(/^([A-Z0-9_]+)=/)?.[1])
        .filter(Boolean)

      for (const name of referenced) {
        expect(definedBefore).toContain(name)
      }
    })
  })
})
