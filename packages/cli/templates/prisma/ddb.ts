import {
  CreateTableCommand,
  CreateTableCommandInput,
  DescribeContinuousBackupsCommand,
  DescribeTableCommand,
  DescribeTimeToLiveCommand,
  DynamoDBClient,
  ResourceNotFoundException,
  UpdateContinuousBackupsCommand,
  UpdateTimeToLiveCommand,
} from '@aws-sdk/client-dynamodb'
import dotenv from 'dotenv'
import { appendFileSync, readFileSync, readdirSync, writeFileSync } from 'fs'
import path from 'path'

dotenv.config()

const envFilePath = './.env'
const tableDir = path.join(__dirname, 'dynamodbs')
const cqrsModuleFname = 'cqrs.json'
const cqrsTableDecsFname = 'cqrs_desc.json'

const tablePrefix = `${process.env.NODE_ENV}-${process.env.APP_NAME}-`

const client = new DynamoDBClient({
  endpoint: process.env.DYNAMODB_ENDPOINT,
  region: process.env.DYNAMODB_REGION,
})

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

let cnt = 0

async function main() {
  // clear table stream arn in .env
  clearTableStreamArnInEnv()
  // create cqrs tables
  await createCqrsTables()
  // create other tables
  await Promise.all(
    readdirSync(tableDir)
      .filter(
        (fname) => fname !== cqrsModuleFname && fname !== cqrsTableDecsFname,
      )
      .map((fname) =>
        createTable(
          JSON.parse(readFileSync(path.join(tableDir, fname)).toString()),
        ),
      ),
  )
  if (cnt) {
    console.log('\n' + cnt + ' tables were created successfully')
  } else {
    console.log('\nNo tables were created')
  }
}

async function createCqrsTables() {
  const cqrsModules: string[] =
    JSON.parse(readFileSync(path.join(tableDir, cqrsModuleFname)).toString()) ||
    []
  const desc: CreateTableCommandInput = JSON.parse(
    readFileSync(path.join(tableDir, cqrsTableDecsFname)).toString(),
  )

  for (const name of cqrsModules) {
    const cmdDesc = { ...desc, TableName: name + '-command' }
    const dataDecs = {
      ...cmdDesc,
      StreamSpecification: undefined,
      TableName: name + '-data',
    }
    const historyDesc = { ...dataDecs, TableName: name + '-history' }
    await Promise.all([cmdDesc, dataDecs, historyDesc].map(createTable))
  }
}

async function createTable(config: CreateTableCommandInput) {
  // random wait
  if (process.env.NODE_ENV !== 'local') {
    await new Promise((r) =>
      setTimeout(r, 200 + Math.floor(Math.random() * 5000)),
    )
  }

  const originName = config.TableName as string
  console.log('\ncreating table:', originName)

  // add table prefix
  config.TableName = tablePrefix + config.TableName

  // check table is already created
  try {
    const tableDesc = await client.send(
      new DescribeTableCommand({ TableName: config.TableName }),
    )
    if (tableDesc.Table?.TableArn) {
      console.log(
        'table exists:',
        tableDesc.Table.TableArn,
        ' => stream:',
        tableDesc.Table.LatestStreamArn,
      )

      await updateTable(config.TableName)

      if (tableDesc.Table.LatestStreamArn) {
        appendTableStreamArnToEnv(originName, tableDesc.Table.LatestStreamArn)
      }

      return tableDesc.Table.TableArn
    }
  } catch (error) {
    if (!(error instanceof ResourceNotFoundException)) {
      throw error
    }
  }

  // create table
  const table = await client.send(new CreateTableCommand(config))
  if (table.TableDescription?.TableArn) {
    console.log(
      'table created with arn: `',
      table.TableDescription?.TableArn,
      '`, and stream arn:`',
      table.TableDescription?.LatestStreamArn,
      '`',
    )
    cnt++

    if (table.TableDescription?.LatestStreamArn) {
      appendTableStreamArnToEnv(
        originName,
        table.TableDescription?.LatestStreamArn,
      )
    }
  }
  return table.TableDescription?.TableArn
}

async function updateTable(TableName: string) {
  try {
    // Time to live
    const ttlDesc = await client.send(
      new DescribeTimeToLiveCommand({ TableName }),
    )
    if (ttlDesc.TimeToLiveDescription?.TimeToLiveStatus === 'DISABLED') {
      console.log('enable time to live for table:', TableName)

      await client.send(
        new UpdateTimeToLiveCommand({
          TableName,
          TimeToLiveSpecification: {
            Enabled: true,
            AttributeName: 'ttl',
          },
        }),
      )

      // random wait
      if (process.env.NODE_ENV !== 'local') {
        await new Promise((r) =>
          setTimeout(r, Math.floor(Math.random() * 5000)),
        )
      }
    }

    // Point-in-time recovery for production
    if (process.env.NODE_ENV !== 'local') {
      const pitDesc = await client.send(
        new DescribeContinuousBackupsCommand({ TableName }),
      )
      if (
        pitDesc.ContinuousBackupsDescription?.PointInTimeRecoveryDescription
          ?.PointInTimeRecoveryStatus === 'DISABLED'
      ) {
        console.log('enable point-in-time recovery for table:', TableName)

        await client.send(
          new UpdateContinuousBackupsCommand({
            TableName,
            PointInTimeRecoverySpecification: {
              PointInTimeRecoveryEnabled: true,
            },
          }),
        )

        // random wait
        if (process.env.NODE_ENV !== 'local') {
          await new Promise((r) =>
            setTimeout(r, Math.floor(Math.random() * 5000)),
          )
        }
      }
    }
  } catch (error) {
    console.error(error)
  }
}

function appendTableStreamArnToEnv(name: string, streamArn: string) {
  if (process.env.NODE_ENV !== 'local') {
    return
  }

  try {
    appendFileSync(
      envFilePath,
      `\nLOCAL_DDB_${name
        .replace('-command', '')
        .toUpperCase()}_STREAM=${streamArn}`,
    )
  } catch (error) {
    console.error('Write to .env error!', error)
  }
}

function clearTableStreamArnInEnv() {
  if (process.env.NODE_ENV !== 'local') {
    return
  }

  console.log('Clear table stream arn in .env')
  const lines = readFileSync(envFilePath, 'utf-8').split('\n')
  const newLines = lines.filter(
    (line) => !line.match(/^LOCAL_DDB_.*_STREAM.*$/),
  )
  writeFileSync(envFilePath, newLines.join('\n'))
}
