'use client'

import { useState, useEffect } from 'react'
import { Amplify } from 'aws-amplify'
import { events } from 'aws-amplify/data'
import {
  subscribe,
  EventsSubscriptionClientImpl,
  SubscribeVariables,
} from '@/lib/subscribe-events'

const eventsEndpoint = process.env.NEXT_PUBLIC_APPSYNC_EVENTS_ENDPOINT ?? ''
const eventsApiKey = process.env.NEXT_PUBLIC_APPSYNC_EVENTS_API_KEY
const eventsRegion =
  process.env.NEXT_PUBLIC_APPSYNC_EVENTS_REGION ?? 'ap-northeast-1'
const eventsNamespace =
  process.env.NEXT_PUBLIC_APPSYNC_EVENTS_NAMESPACE ?? 'default'

const amplifyConfigured = Boolean(eventsEndpoint && eventsApiKey)

if (amplifyConfigured) {
  Amplify.configure({
    API: {
      Events: {
        endpoint: eventsEndpoint,
        region: eventsRegion,
        defaultAuthMode: 'apiKey',
        apiKey: eventsApiKey,
      },
    },
  })
}

export default function AppSyncTester() {
  // Connection state
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [error, setError] = useState<string | null>(
    amplifyConfigured
      ? null
      : 'Missing NEXT_PUBLIC_APPSYNC_EVENTS_ENDPOINT or NEXT_PUBLIC_APPSYNC_EVENTS_API_KEY. Copy .env.local.example to .env.local and set your values.',
  )

  // Filter variables state
  const [tenantCode, setTenantCode] = useState('MBC')
  const [action, setAction] = useState('')
  const [id, setId] = useState('')

  // Messages state
  const [messages, setMessages] = useState<any[]>([])

  // 2. Manage Subscription Lifecycle
  useEffect(() => {
    if (!isSubscribed) {
      return
    }

    console.log('Connecting to AppSync Events...')
    setError(null) // Clear previous errors when attempting to connect

    const clientImpl = new EventsSubscriptionClientImpl(
      events,
      eventsNamespace,
    )

    const variables: SubscribeVariables = {
      tenantCode,
      action: action || null,
      id: id || null,
    }

    const subscription = subscribe(
      clientImpl,
      variables,
      (message) => {
        console.log('Received message:', message)
        setMessages((prev) => [
          { timestamp: new Date().toLocaleTimeString(), data: message },
          ...prev,
        ])
      },
      (err: any) => {
        console.error('Subscription error:', err)
        // Extract a readable message from the error object
        const errorMessage = err?.message || String(err) || 'Unknown error'
        setError(errorMessage)
        setIsSubscribed(false) // Disconnect on error
      },
    )

    return () => {
      console.log('Unsubscribing...')
      subscription.unsubscribe()
    }
  }, [isSubscribed, tenantCode, action, id])

  // 3. UI
  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-gray-900">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h1 className="text-xl font-bold mb-4">
            AppSync イベントテスター / AppSync Events Tester
          </h1>

          {/* Bilingual Error Banner */}
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r-md">
              <div className="flex">
                <div className="flex-shrink-0">
                  {/* Alert Icon */}
                  <svg
                    className="h-5 w-5 text-red-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    接続エラー / Connection Error
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>
                      AppSyncへの接続に失敗しました。 / Failed to connect to
                      AppSync.
                    </p>
                    <p className="mt-1 font-mono text-xs bg-red-100 p-1 rounded inline-block">
                      {error}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium mb-1">
                テナントコード / Tenant Code *
              </label>
              <input
                type="text"
                value={tenantCode}
                onChange={(e) => setTenantCode(e.target.value)}
                disabled={isSubscribed}
                className="w-full p-2 border rounded-md disabled:bg-gray-100 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                アクション (任意) / Action (Opt)
              </label>
              <input
                type="text"
                value={action}
                onChange={(e) => setAction(e.target.value)}
                disabled={isSubscribed}
                className="w-full p-2 border rounded-md disabled:bg-gray-100 text-sm"
                placeholder="例 / e.g., command-status"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                ID (任意) / ID (Opt)
              </label>
              <input
                type="text"
                value={id}
                onChange={(e) => setId(e.target.value)}
                disabled={isSubscribed}
                className="w-full p-2 border rounded-md disabled:bg-gray-100 text-sm"
                placeholder="例 / e.g., user-123"
              />
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <button
              type="button"
              disabled={!amplifyConfigured}
              onClick={() => setIsSubscribed(!isSubscribed)}
              className={`px-4 py-2 rounded-md text-white font-medium transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                isSubscribed
                  ? 'bg-red-500 hover:bg-red-600'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isSubscribed ? '切断 / Disconnect' : '接続 / Connect'}
            </button>

            <div className="flex items-center space-x-2 text-sm">
              <span
                className={`w-3 h-3 rounded-full ${isSubscribed ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}
              />
              <span className="text-gray-600">
                {isSubscribed
                  ? 'イベント待機中... / Listening for events...'
                  : '未接続 / Disconnected'}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold">
              イベントログ / Event Log ({messages.length})
            </h2>
            <button
              onClick={() => setMessages([])}
              className="text-sm text-gray-500 hover:text-gray-900"
            >
              クリア / Clear
            </button>
          </div>

          <div className="h-96 overflow-y-auto bg-gray-900 rounded-lg p-4 font-mono text-sm text-green-400">
            {messages.length === 0 ? (
              <span className="text-gray-500">
                まだメッセージがありません... / No messages yet...
              </span>
            ) : (
              <div className="space-y-4">
                {messages.map((msg, i) => (
                  <div key={i} className="border-b border-gray-700 pb-4">
                    <span className="text-gray-400 text-xs block mb-1">
                      [{msg.timestamp}]
                    </span>
                    <pre className="whitespace-pre-wrap break-words">
                      {JSON.stringify(msg.data, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
