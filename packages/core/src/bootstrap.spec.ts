/**
 * Bootstrap Unit Tests
 *
 * Overview:
 * Unit test suite for createHandler function.
 * Verifies Lambda handler compatibility with Node.js 24.
 *
 * Purpose:
 * - Verify createHandler returns correct handler signature
 * - Verify callback parameter is not required for Node.js 24
 * - Verification at source code level
 *
 * Testing Strategy:
 * - Read and analyze source file directly
 * - Verify handler signature returned by createHandler
 * - Verify Node.js 24 compatibility
 */

import * as fs from 'fs'
import * as path from 'path'

describe('bootstrap', () => {
  describe('createHandler', () => {
    /**
     * Node.js 24 Compatibility Tests
     *
     * Node.js 24 does not allow callback parameter in Lambda handler signature.
     * This test group verifies that the handler returned by createHandler
     * is compatible with Node.js 24.
     */
    describe('Node.js 24 compatibility', () => {
      let bootstrapSource: string

      beforeAll(() => {
        // Read source file
        const bootstrapPath = path.join(__dirname, 'bootstrap.ts')
        bootstrapSource = fs.readFileSync(bootstrapPath, 'utf-8')
      })

      it('should have createHandler function that returns a handler', () => {
        // Verify createHandler function exists
        expect(bootstrapSource).toContain('export function createHandler')
      })

      it('returned handler should not have callback parameter for Node.js 24 compatibility', () => {
        /**
         * Node.js 24 Lambda handler requirements:
         * - Handler should have only 2 parameters (event, context)
         * - Having callback parameter causes CallbackHandlerDeprecatedError
         *
         * Reference:
         * https://docs.aws.amazon.com/lambda/latest/dg/nodejs-handler.html
         */

        // Verify the signature of async function returned within createHandler
        // Pattern: return async (event: any, context: Context, callback: Callback)
        // If this pattern exists, it's not compatible with Node.js 24
        const callbackPattern =
          /return\s+async\s*\([^)]*callback[^)]*\)\s*=>/

        const hasCallback = callbackPattern.test(bootstrapSource)

        // Verify callback parameter is not included
        expect(hasCallback).toBe(false)
      })

      it('returned handler should only have event and context parameters', () => {
        /**
         * Correct handler signature:
         * return async (event: any, context: Context) => { ... }
         */

        // Pattern: return async (event, context) => or similar
        const validPattern =
          /return\s+async\s*\(\s*event\s*:\s*\w+\s*,\s*context\s*:\s*Context\s*\)\s*=>/

        const hasValidSignature = validPattern.test(bootstrapSource)

        // Verify correct signature
        expect(hasValidSignature).toBe(true)
      })

      it('should not pass callback to serverlessExpress handler', () => {
        /**
         * Should not pass callback when calling serverlessExpress handler
         */

        // Pattern: server(event, context, callback)
        // If this pattern exists, it's wrong
        const serverCallbackPattern = /server\s*\(\s*event\s*,\s*context\s*,\s*callback\s*\)/

        const passesCallback = serverCallbackPattern.test(bootstrapSource)

        // Verify callback is not passed
        expect(passesCallback).toBe(false)
      })
    })
  })
})
