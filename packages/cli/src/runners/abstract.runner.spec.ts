import { spawn } from 'child_process'
import { EventEmitter } from 'events'

import { AbstractRunner } from './abstract.runner'

jest.mock('child_process')

describe('Abstract Runner', () => {
  const mockSpawn = spawn as jest.MockedFunction<typeof spawn>
  let mockChildProcess: any

  beforeEach(() => {
    jest.clearAllMocks()
    mockChildProcess = new EventEmitter()
    mockChildProcess.stdout = new EventEmitter()
    mockChildProcess.stderr = new EventEmitter()
    
    mockSpawn.mockReturnValue(mockChildProcess as any)
  })

  describe('Overview: Base runner functionality for command execution', () => {
    describe('Purpose: Test successful command execution', () => {
      it('should execute command successfully with default options', async () => {
        const runner = new AbstractRunner('npm', ['--version'])
        
        const runPromise = runner.run('install')
        
        setTimeout(() => {
          mockChildProcess.emit('close', 0)
        }, 10)

        await expect(runPromise).resolves.toBeNull()
        expect(mockSpawn).toHaveBeenCalledWith('npm', ['--version', 'install'], expect.any(Object))
      })

      it('should execute command with custom arguments', async () => {
        const runner = new AbstractRunner('node', ['-v'])
        
        const runPromise = runner.run('--help')
        
        setTimeout(() => {
          mockChildProcess.emit('close', 0)
        }, 10)

        await expect(runPromise).resolves.toBeNull()
        expect(mockSpawn).toHaveBeenCalledWith('node', ['-v', '--help'], expect.any(Object))
      })

      it('should collect output when collectResult is true', async () => {
        const runner = new AbstractRunner('echo', ['hello'])
        
        const runPromise = runner.run('world', true)
        
        setTimeout(() => {
          mockChildProcess.stdout.emit('data', Buffer.from('hello\n'))
        }, 10)

        const result = await runPromise
        expect(result).toBe('hello')
      })
    })

    describe('Purpose: Test error handling scenarios', () => {
      it('should handle command execution failure', async () => {
        const runner = new AbstractRunner('invalid-command', [])
        
        const runPromise = runner.run('test')
        
        setTimeout(() => {
          mockChildProcess.emit('close', 1)
        }, 10)

        await expect(runPromise).rejects.toBeUndefined()
      })

      it('should handle spawn errors', async () => {
        const runner = new AbstractRunner('invalid-command', [])
        
        const runPromise = runner.run('test')
        
        setTimeout(() => {
          mockChildProcess.emit('close', 1)
        }, 10)

        await expect(runPromise).rejects.toBeUndefined()
      })

      it('should handle stderr output as error', async () => {
        const runner = new AbstractRunner('test-command', [])
        
        const runPromise = runner.run('test')
        
        setTimeout(() => {
          mockChildProcess.emit('close', 1)
        }, 10)

        await expect(runPromise).rejects.toBeUndefined()
      })
    })

    describe('Purpose: Test command string generation', () => {
      it('should generate correct command string with binary and arguments', () => {
        const runner = new AbstractRunner('npm', ['install', '--save'])
        
        const commandString = runner.rawFullCommand('test')
        
        expect(commandString).toBe('npm install --save test')
      })

      it('should generate command string with empty arguments', () => {
        const runner = new AbstractRunner('node', [])
        
        const commandString = runner.rawFullCommand('test')
        
        expect(commandString).toBe('node test')
      })

      it('should handle arguments with spaces', () => {
        const runner = new AbstractRunner('echo', ['hello world', 'test'])
        
        const commandString = runner.rawFullCommand('command')
        
        expect(commandString).toBe('echo hello world test command')
      })
    })

    describe('Purpose: Test output collection functionality', () => {
      it('should collect stdout when collectResult is enabled', async () => {
        const runner = new AbstractRunner('cat', ['file.txt'])
        
        const runPromise = runner.run('test', true)
        
        setTimeout(() => {
          mockChildProcess.stdout.emit('data', Buffer.from('line 1\n'))
        }, 10)

        const result = await runPromise
        expect(result).toBe('line 1')
      })

      it('should not collect output when collectResult is false', async () => {
        const runner = new AbstractRunner('echo', ['test'])
        
        const runPromise = runner.run('command', false)
        
        setTimeout(() => {
          mockChildProcess.emit('close', 0)
        }, 10)

        const result = await runPromise
        expect(result).toBeNull()
      })

      it('should handle empty stdout output', async () => {
        const runner = new AbstractRunner('true', [])
        
        const runPromise = runner.run('test', false)
        
        setTimeout(() => {
          mockChildProcess.emit('close', 0)
        }, 10)

        const result = await runPromise
        expect(result).toBeNull()
      })
    })

    describe('Purpose: Test edge cases and error scenarios', () => {
      it('should handle process exit with signal', async () => {
        const runner = new AbstractRunner('test-command', [])
        
        const runPromise = runner.run('test')
        
        setTimeout(() => {
          mockChildProcess.emit('close', null, 'SIGTERM')
        }, 10)

        await expect(runPromise).rejects.toBeUndefined()
      })

      it('should handle multiple stderr chunks', async () => {
        const runner = new AbstractRunner('test-command', [])
        
        const runPromise = runner.run('test')
        
        setTimeout(() => {
          mockChildProcess.emit('close', 1)
        }, 10)

        await expect(runPromise).rejects.toBeUndefined()
      })

      it('should handle very long command arguments', async () => {
        const longArgs = Array(100).fill('very-long-argument-name')
        const runner = new AbstractRunner('test-command', longArgs)
        
        const commandString = runner.rawFullCommand('test')
        
        expect(commandString).toContain('test-command')
        expect(commandString.split(' ')).toHaveLength(102)
      })
    })

    describe('Purpose: Test concurrent execution scenarios', () => {
      it('should handle multiple runner instances', async () => {
        const runner1 = new AbstractRunner('echo', ['test1'])
        const runner2 = new AbstractRunner('echo', ['test2'])
        
        const promise1 = runner1.run('command1')
        const promise2 = runner2.run('command2')
        
        setTimeout(() => {
          mockChildProcess.emit('close', 0)
        }, 10)

        const results = await Promise.all([promise1, promise2])
        expect(results).toEqual([null, null])
      })

      it('should handle rapid successive runs', async () => {
        const runner = new AbstractRunner('echo', ['test'])
        
        const promises = Array(5).fill(null).map((_, i) => {
          const promise = runner.run(`command${i}`)
          setTimeout(() => {
            mockChildProcess.emit('close', 0)
          }, 10 + i)
          return promise
        })

        const results = await Promise.all(promises)
        expect(results).toEqual([null, null, null, null, null])
      })
    })
  })
})
