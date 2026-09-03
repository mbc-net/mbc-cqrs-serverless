import {
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutBucketCorsCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { Readable } from 'stream'

const ENDPOINT = process.env.S3_ENDPOINT || 'http://localhost:4566'
const REGION = process.env.S3_REGION || 'ap-northeast-1'
const BUCKET = 'e2e-s3-smoke'

// A browser origin standing in for a local frontend. The value itself does not
// matter to the assertions; what matters is that an Origin is present at all,
// because that is what turns a plain request into a CORS request.
const ORIGIN = 'http://localhost:3000'

// Mirrors the rule applied locally by infra-local/scripts/resources.{sh,ps1}.
// Keep the two in step: this suite is what proves the emulator honours it.
const CORS_RULE = {
  AllowedOrigins: ['*'],
  AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
  AllowedHeaders: ['*'],
  ExposeHeaders: ['ETag'],
}

// Mirrors packages/core/src/data-store/s3.service.ts:17-21
const client = new S3Client({
  endpoint: ENDPOINT,
  region: REGION,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'DUMMYIDEXAMPLE',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'DUMMYEXAMPLEKEY',
  },
})

const emptyBucket = async () => {
  const listed = await client.send(new ListObjectsV2Command({ Bucket: BUCKET }))
  if (!listed.Contents?.length) return
  await client.send(
    new DeleteObjectsCommand({
      Bucket: BUCKET,
      Delete: { Objects: listed.Contents.map(({ Key }) => ({ Key })) },
    }),
  )
}

describe('S3 emulator smoke test', () => {
  console.log(`S3 smoke test target: ${ENDPOINT}`)

  beforeAll(async () => {
    await client.send(new CreateBucketCommand({ Bucket: BUCKET }))
  })

  afterAll(async () => {
    await emptyBucket()
    await client.send(new DeleteBucketCommand({ Bucket: BUCKET }))
    client.destroy()
  })

  // Covers S3Service.putItem/getItem — s3.service.ts:29,44
  it('round-trips a JSON object', async () => {
    const key = 'smoke/attributes.json'
    const item = { pk: 'TENANT#abc', sk: 'ORDER#1', nested: { total: 42 } }

    await client.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: JSON.stringify(item),
      }),
    )

    const result = await client.send(
      new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    )
    const body = await result.Body.transformToString()

    expect(JSON.parse(body)).toEqual(item)
  })

  // Covers the lib-storage upload — import.service.ts:219
  // Body must exceed the 5 MB default part size or this silently degrades
  // to a single-part upload and proves nothing.
  it('completes a multipart upload via lib-storage', async () => {
    const key = 'smoke/large.csv'
    const body = Buffer.alloc(6 * 1024 * 1024, 'a')

    const upload = new Upload({
      client,
      params: { Bucket: BUCKET, Key: key, Body: body },
    })
    await upload.done()

    const result = await client.send(
      new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    )
    const bytes = await result.Body.transformToByteArray()

    expect(bytes.length).toBe(body.length)
  })

  // Covers the streamed read — csv-import.sfn.event.handler.ts:220,282,320,340
  // The `instanceof Readable` assertion is load-bearing: the handler throws
  // outright if this is false (csv-import.sfn.event.handler.ts:227).
  it('returns a Readable stream body', async () => {
    const key = 'smoke/stream.csv'
    const content = 'code,name\nA001,alpha\nA002,beta\n'

    await client.send(
      new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: content }),
    )

    const { Body } = await client.send(
      new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    )

    expect(Body).toBeInstanceOf(Readable)

    const chunks: Buffer[] = []
    for await (const chunk of Body as Readable) {
      chunks.push(Buffer.from(chunk))
    }

    expect(Buffer.concat(chunks).toString()).toBe(content)
  })

  // Callers must be able to tell "absent" from "failed".
  it('raises NoSuchKey for a missing key', async () => {
    await expect(
      client.send(
        new GetObjectCommand({ Bucket: BUCKET, Key: 'smoke/does-not-exist' }),
      ),
    ).rejects.toMatchObject({ name: 'NoSuchKey' })
  })

  // --- Browser (presigned URL) access path ---------------------------------
  // directory-file.service.ts hands presigned PUT/GET URLs to the browser, so
  // every request on that path is a CORS request. LocalStack covered this with
  // EXTRA_CORS_ALLOWED_ORIGINS=*; Floci has no such switch, so the bucket
  // carries its own rule (see infra-local/scripts/resources.{sh,ps1}).
  describe('presigned URL access from a browser origin', () => {
    beforeAll(async () => {
      await client.send(
        new PutBucketCorsCommand({
          Bucket: BUCKET,
          CORSConfiguration: { CORSRules: [CORS_RULE] },
        }),
      )
    })

    // A failed preflight means the browser never sends the real request, so
    // this is the assertion that catches a CORS regression.
    it.each(['PUT', 'GET'])(
      'answers the %s preflight with an allowed origin',
      async (method) => {
        const res = await fetch(`${ENDPOINT}/${BUCKET}/smoke/preflight.txt`, {
          method: 'OPTIONS',
          headers: {
            Origin: ORIGIN,
            'Access-Control-Request-Method': method,
          },
        })

        expect(res.status).toBeLessThan(300)
        expect(res.headers.get('access-control-allow-origin')).toBeTruthy()
      },
    )

    // Mirrors genUploadDirectoryUrl then genViewUrl —
    // directory-file.service.ts:47,22. ACL and ResponseContentDisposition are
    // carried over deliberately: both are part of the signature the emulator
    // has to accept.
    it('round-trips through presigned upload and view URLs', async () => {
      const key = 'smoke/presigned.txt'
      const content = 'uploaded straight from the browser'

      const uploadUrl = await getSignedUrl(
        client,
        new PutObjectCommand({ Bucket: BUCKET, Key: key, ACL: 'private' }),
        { expiresIn: 60 * 60 },
      )
      const uploaded = await fetch(uploadUrl, {
        method: 'PUT',
        body: content,
        headers: { Origin: ORIGIN },
      })

      expect(uploaded.status).toBe(200)
      expect(uploaded.headers.get('access-control-allow-origin')).toBeTruthy()

      const viewUrl = await getSignedUrl(
        client,
        new GetObjectCommand({
          Bucket: BUCKET,
          Key: key,
          ResponseContentDisposition: `inline; filename="${encodeURIComponent(
            'presigned.txt',
          )}"`,
        }),
        { expiresIn: 60 * 60 },
      )
      const viewed = await fetch(viewUrl, { headers: { Origin: ORIGIN } })

      expect(viewed.status).toBe(200)
      expect(viewed.headers.get('access-control-allow-origin')).toBeTruthy()
      expect(await viewed.text()).toBe(content)
    })
  })
})
