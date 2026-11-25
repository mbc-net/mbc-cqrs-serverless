/** Opt-in, domain-owned transport for explicit-version async publication. */
export interface StrictInlineOptions {
  profile: 'strict-inline-v1'
}

export const DYNAMODB_SAFETY_OPTIONS = Symbol('DYNAMODB_SAFETY_OPTIONS')
export const STRICT_INLINE_ATTRIBUTE_BYTES = 128 * 1024
export const STRICT_INLINE_ITEM_BYTES = 300 * 1024

export function validateStrictInlineOptions(value: unknown): void {
  if (value === undefined) return
  if (
    !value ||
    typeof value !== 'object' ||
    Object.getPrototypeOf(value) !== Object.prototype ||
    Reflect.ownKeys(value).length !== 1 ||
    Object.getOwnPropertyDescriptor(value, 'profile')?.value !==
      'strict-inline-v1'
  ) {
    throw new Error('Invalid strict inline profile')
  }
}
