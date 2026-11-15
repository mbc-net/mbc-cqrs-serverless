import { Logger } from '@nestjs/common'

/** Databases whose Prisma filter syntax the master and survey packages handle. */
export type DatabaseProvider = 'postgresql' | 'mysql'

const logger = new Logger('DatabaseProvider')

/**
 * The provider to build Prisma filters for: the override when given, otherwise the
 * provider the Prisma client was generated for. An unknown provider falls back to
 * postgresql, the behaviour before MySQL support, and logs a warning.
 */
export function resolveDatabaseProvider(
  prismaClient: unknown,
  override?: DatabaseProvider,
): DatabaseProvider {
  if (override) return override
  // ponytail: `_activeProvider` is Prisma-internal (present in Prisma 5); the
  // `databaseProvider` module option is the escape hatch if it moves.
  const active = (prismaClient as { _activeProvider?: unknown } | undefined)
    ?._activeProvider
  if (active === 'postgresql' || active === 'mysql') return active
  logger.warn(
    `Could not detect the database provider (got ${String(active)}); using postgresql filters. ` +
      `Set the module option databaseProvider to 'mysql' or 'postgresql'.`,
  )
  return 'postgresql'
}

/** Case-insensitive `contains`. MySQL's default collations already ignore case. */
export function containsInsensitive(
  value: string,
  provider: DatabaseProvider,
): { contains: string; mode?: 'insensitive' } {
  return provider === 'postgresql'
    ? { contains: value, mode: 'insensitive' }
    : { contains: value }
}

/** Path to a top-level key of a Json column, in the syntax each database expects. */
export function jsonPath(
  key: string,
  provider: DatabaseProvider,
): string | string[] {
  return provider === 'postgresql' ? [key] : `$.${key}`
}
