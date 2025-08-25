import {
  IChainable,
  JsonPath,
  ProcessorConfig,
  ProcessorMode,
  Map as SfnMap,
} from 'aws-cdk-lib/aws-stepfunctions'

export type DistributedMapS3Parameter =
  | {
      readonly 'Bucket.$': string
      readonly 'Key.$': string
    }
  | {
      readonly Bucket: JsonPath | string
      readonly Key: JsonPath | string
    }

export interface DistributedMapItemReader {
  readonly Resource:
    | 'arn:aws:states:::s3:getObject'
    | 'arn:aws:states:::s3:listObjectsV2'
  readonly ReaderConfig: {
    readonly InputType: 'CSV' | 'JSON' | 'MANIFEST'
    readonly CSVHeaderLocation?: 'FIRST_ROW' | 'GIVEN'
    readonly CSVHeaders?: string[]
    readonly MaxItems?: number
  }
  readonly Parameters: DistributedMapS3Parameter
}

export interface DistributedMapResultWriter {
  readonly Resource: 'arn:aws:states:::s3:putObject'
  readonly Parameters: DistributedMapS3Parameter
}

export interface DistributedMapItemBatcher {
  readonly MaxItemsPerBatch?: number
  readonly MaxItemsPerBatchPath?: string
  readonly MaxInputBytesPerBatch?: number
  readonly MaxInputBytesPerBatchPath?: number
  readonly BatchInput?: Readonly<Record<string, JsonPath | string>>
}

export class DistributedMap extends SfnMap {
  public itemReader?: DistributedMapItemReader
  public resultWriter?: DistributedMapResultWriter
  public itemBatcher?: DistributedMapItemBatcher
  declare public itemSelector?: Readonly<Record<string, JsonPath | string>>
  public label?: string

  public override toStateJson(): object {
    const mapStateJson = super.toStateJson()
    return {
      ...mapStateJson,
      ItemReader: this.itemReader,
      ResultWriter: this.resultWriter,
      ItemBatcher: this.itemBatcher,
      ItemSelector: this.itemSelector,
      Label: this.label,
    }
  }

  public itemProcessor(
    processor: IChainable,
    config: ProcessorConfig = {},
  ): DistributedMap {
    super.itemProcessor(processor, {
      ...config,
      mode: ProcessorMode.DISTRIBUTED,
    })
    return this
  }

  public setLabel(label: string): DistributedMap {
    this.label = label
    return this
  }

  public setItemSelector(
    itemSelector: Readonly<Record<string, JsonPath | string>>,
  ): DistributedMap {
    this.itemSelector = itemSelector
    return this
  }

  public setItemBatcher(
    itemBatcher: DistributedMapItemBatcher,
  ): DistributedMap {
    this.itemBatcher = itemBatcher
    return this
  }

  public setResultWriter(
    resultWriter: DistributedMapResultWriter,
  ): DistributedMap {
    this.resultWriter = resultWriter
    return this
  }

  public setItemReader(itemReader: DistributedMapItemReader): DistributedMap {
    this.itemReader = itemReader
    return this
  }
}
