import { readFileSync } from 'fs'
import path from 'path'

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
