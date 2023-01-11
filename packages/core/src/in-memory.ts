import { AbstractDataRepo, scalarToString } from './helpers';
import { DataObject, DataRepo, WriteResult, WriteResults } from './types';
import _ from 'lodash';

type DataRecord<T extends DataObject> = {
  keyString: string;
  record: T;
};

const CONCAT_OPERATOR = '||';

export class InMemoryDataRepo<T extends DataObject> extends AbstractDataRepo<T> implements DataRepo<T> {
  private dataRecords: DataRecord<T>[] = [];

  async getObject(template: Partial<T>): Promise<T | null> {
    const keyString = this.getKeyString(template);
    const index = _.sortedIndexBy(this.dataRecords, { keyString, record: template }, (rec) => rec.keyString);
    if (index >= 0 && index < this.dataRecords.length) {
      const found = this.dataRecords[index];
      if (found.keyString === keyString) {
        return found.record;
      }
    }
    return null;
  }
  putObject(obj: T): Promise<WriteResults<T>> {
    const keyString = this.getKeyString(obj);
    const index = _.sortedIndexBy(this.dataRecords, { keyString, record: obj }, (rec) => rec.keyString);
    if (index >= 0 && index < this.dataRecords.length) {
      const found = this.dataRecords[index];
      if (found.keyString === keyString) {
        found.record = obj;
        return Promise.resolve({ data: found.record, result: WriteResult.UPDATED });
      }
    }
    this.dataRecords.splice(index, 0, { keyString, record: obj });
    return Promise.resolve({ data: obj, result: WriteResult.CREATED });
  }
  putObjects(objects: T[]): Promise<WriteResults<T>[]> {
    return Promise.all(objects.map((obj) => this.putObject(obj)));
  }
  listObjects(template: Partial<T>): Promise<T[]> {
    const { getKeys } = this.getFirstPrimaryIndex();
    const valueDefs = getKeys(template, { allowPartial: true, allowSkips: false });
    const keyString = valueDefs.map(({ value }) => scalarToString(value)).join(CONCAT_OPERATOR);
    const index = _.sortedIndexBy(this.dataRecords, { keyString, record: template }, (rec) => rec.keyString);
    const foundRecords: T[] = [];
    for (let i = index; i < this.dataRecords.length; i++) {
      const { keyString: foundKeyString, record } = this.dataRecords[i];
      if (foundKeyString.startsWith(keyString)) {
        foundRecords.push(record);
      } else {
        break;
      }
    }
    return Promise.resolve(foundRecords);
  }

  private getKeyString(dataObject: T | Partial<T>): string {
    const keys = this.getPrimaryKeys(dataObject);

    return keys.map(({ value }) => scalarToString(value)).join(CONCAT_OPERATOR);
  }
}
