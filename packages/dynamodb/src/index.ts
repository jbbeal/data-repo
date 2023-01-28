import { DataRepo, DataObject, GetResponse, IndexDescription, ListResponse, WriteResults } from '@data-repo/core';

class DynamoDbDataRepo<T extends DataObject> implements DataRepo<T> {
  provideIndex(index: IndexDescription<T>): void {
    throw new Error('Method not implemented.');
  }
  getObject(template: Partial<T>): Promise<GetResponse<T>> {
    throw new Error('Method not implemented.');
  }
  putObject(obj: T): Promise<WriteResults<T>> {
    throw new Error('Method not implemented.');
  }
  putObjects(objects: T[]): Promise<WriteResults<T>[]> {
    throw new Error('Method not implemented.');
  }
  listObjects(template: Partial<T>): Promise<ListResponse<T>> {
    throw new Error('Method not implemented.');
  }
}
