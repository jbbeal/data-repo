import {
  AbstractDataRepo,
  DataObject,
  GetResponse,
  ListResponse,
  ReadResult,
  scalarToString,
  WriteResult,
  WriteResults,
} from '@data-repo/core';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import _ from 'lodash';
import { pino } from 'pino';

export type DynamoDbDataRepoOptions = {
  /** The name of the DynamoDB table where objects will be stored */
  tableName: string;
  /** Separator string used when joining key values into range key and hash key strings. Defaults to `||`. */
  keySeparator?: string;
  /** Name to use for the hash key field. Defaults to `hashKey` */
  hashKeyName?: string;
  rangeKeyName?: string;
};

export class DynamoDbDataRepo<T extends DataObject> extends AbstractDataRepo<T> {
  private opts: Required<DynamoDbDataRepoOptions>;
  private logger = pino();
  constructor(private ddb: DynamoDBDocument, opts: DynamoDbDataRepoOptions) {
    super();
    this.opts = _.defaults(opts, { keySeparator: '||', hashKeyName: 'hashKey', rangeKeyName: 'rangeKey' });
  }

  async getObject(template: Partial<T>): Promise<GetResponse<T>> {
    const { hashKey, rangeKey } = this.getDdbKeys(template, false);
    const ddbGetResult = await this.ddb.get({
      Key: { [this.opts.hashKeyName]: hashKey, [this.opts.rangeKeyName]: rangeKey },
    });
    return {
      data: ddbGetResult.Item as T | undefined,
      result: ddbGetResult.Item ? ReadResult.FOUND : ReadResult.NOT_FOUND,
    };
  }
  async putObject(obj: T): Promise<WriteResults<T>> {
    const { hashKey, rangeKey } = this.getDdbKeys(obj, false);
    const ddbResult = await this.ddb.put({
      TableName: this.opts.tableName,
      Item: { [this.opts.hashKeyName]: hashKey, [this.opts.rangeKeyName]: rangeKey, ...obj },
      ReturnValues: 'ALL_OLD',
    });
    return {
      data: obj,
      result: ddbResult.Attributes ? WriteResult.UPDATED : WriteResult.CREATED,
    };
  }
  putObjects(objects: T[]): Promise<WriteResults<T>[]> {
    this.logger.trace(objects);
    throw new Error('Method not implemented.');
  }
  listObjects(template: Partial<T>): Promise<ListResponse<T>> {
    this.logger.trace(template);
    throw new Error('Method not implemented.');
  }

  private getDdbKeys(obj: Partial<T>, allowPartial: boolean) {
    const index = this.getFirstPrimaryIndex();
    const keys = index.getKeys(obj, { allowPartial, allowSkips: false });
    const hashKeyValues: string[] = [];
    const rangeKeyValues: string[] = [];
    index.keyConfigs.forEach((keyConfig) => {
      const valueAsString = () => {
        const matchingKey = keys.find(({ keyName }) => keyName === keyConfig.keyName);
        if (matchingKey && matchingKey.value) {
          const keyValueString = scalarToString(matchingKey.value);
          if (keyValueString) {
            return keyValueString;
          }
        }
        throw new Error(`No value found for ${String(keyConfig.keyName)}`);
      };
      if (keyConfig.requiredForLookup) {
        hashKeyValues.push(valueAsString());
      } else {
        rangeKeyValues.push(valueAsString());
      }
    });
    return {
      hashKey: hashKeyValues.join(this.opts.keySeparator),
      rangeKey: rangeKeyValues.join(this.opts.keySeparator),
    };
  }
}
