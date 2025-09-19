import { DetailKey } from '@mbc-cqrs-serverless/core'

export const parseId = (id: string): DetailKey => {
  const idParts = id.split('#')
  if (idParts.length < 4) {
    throw new Error(`Invalid source ID format: ${id}`)
  }

  return {
    pk: `${idParts[0]}#${idParts[1]}`,
    sk: idParts.splice(2).join('#'),
  }
}
