interface AppsyncEndpoint {
  endpoint: string
  hostname: string
  apiKey?: string
}

type AppsyncType = 'default' | 'second'

export { AppsyncEndpoint, AppsyncType }
