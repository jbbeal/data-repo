import {
  DataObject,
  DataRepo,
  GetKeys,
  IndexableScalar,
  IndexDescription,
  KeyConfig,
  Keys,
  KeyType,
  OrArray,
  Scalar,
} from './types';
import _ from 'lodash';

export class AbstractDataRepo<T extends DataObject> implements Pick<DataRepo<T>, 'provideIndex'> {
  private indexDefinitions: Required<IndexDescription<T>>[] = [];
  private firstPrimaryIndex?: IndexDescription<T>;
  provideIndex(index: IndexDescription<T>): void {
    if (index.isPrimary === undefined) {
      index.isPrimary = this.indexDefinitions.length === 0;
    }
    if (index.isPrimary && this.firstPrimaryIndex === undefined) {
      this.firstPrimaryIndex = index;
    }
    if (index.isUnique === undefined) {
      index.isUnique = index.isPrimary ? true : false;
    }
    if (index.indexName === undefined) {
      index.indexName = `index_${this.indexDefinitions.length}`;
    }
    this.indexDefinitions.push(index as Required<IndexDescription<T>>);
  }

  getFirstPrimaryIndex() {
    if (!this.firstPrimaryIndex) {
      throw new TypeError('No primary index has been provided');
    }
    return this.firstPrimaryIndex;
  }

  /**
   * Gets the primary keys for a given object or partial object. This method should be used
   * in either `getObject` or `putObject` implementations.
   * @param obj data object
   * @returns The primary keys of `obj`, or an error if not all are specified.
   */
  getPrimaryKeys(obj: Partial<T>): Keys<T> {
    const indexDef = this.getFirstPrimaryIndex();
    return indexDef.getKeys(obj, { allowPartial: false, allowSkips: false });
  }
}

export const defaultIndexDescription: <T extends DataObject>(
  partial: Omit<IndexDescription<T>, 'getKeys'>,
) => IndexDescription<T> = (partialDescription) => ({
  ...partialDescription,
  getKeys: defaultGetKeys(partialDescription.keyConfigs),
});

export function defaultGetKeys<T extends DataObject>(configs: KeyConfig<T>[]): GetKeys<T> {
  return (obj: Partial<T>, opts): Keys<T> => {
    return getValuesForKeys(obj, configs, opts);
  };
}

export function getValuesForKeys<T extends DataObject>(
  obj: Partial<T> | Keys<T>,
  configs: KeyConfig<T>[],
  { allowPartial = true, allowSkips = false },
): { keyName: keyof T | string; value: IndexableScalar }[] {
  const allValues: { keyName: string; value: IndexableScalar }[] = [];
  let skipped = false;
  configs.forEach((config) => {
    const value = getValueForKey(obj, config);
    const keyName = config.keyName as string;
    if (value) {
      if (skipped && !allowSkips) {
        throw new TypeError(
          `Must only specify a prefix of key fields; found value for ${keyName} after skipping one or more index fields`,
        );
      }
      allValues.push({ keyName, value });
    } else if (!allowPartial) {
      throw new TypeError(`Must specify all fields in index; did not find value for ${keyName}`);
    } else {
      skipped = true;
    }
  });
  return allValues;
}

export function getValueForKey<T extends DataObject>(
  obj: Partial<T> | Keys<T>,
  { keyName: configKeyName, keyType: configType, requiredForLookup }: KeyConfig<T>,
): IndexableScalar | undefined {
  let value: IndexableScalar | undefined | OrArray<DataObject> | OrArray<Scalar>;
  if (Array.isArray(obj)) {
    value = _.find(obj, ({ keyName }) => keyName === configKeyName)?.value;
  } else {
    value = obj[configKeyName];
  }
  const keyType = getKeyType(value);
  if (keyType === undefined) {
    if (requiredForLookup) {
      throw new TypeError(`Value for ${configKeyName as string} is required`);
    } else {
      return undefined;
    }
  }
  if (configType && configType !== keyType) {
    throw new TypeError(
      `Config specified type for ${configKeyName as string} should be ${configType}; got ${keyType} instead`,
    );
  }
  switch (keyType) {
    case KeyType.STRING:
      return value as string;
    case KeyType.NUMBER:
      return value as number;
    case KeyType.DATE:
      return value as Date;
  }
}

export function getKeyType(value: any) {
  if (typeof value === 'string') {
    return KeyType.STRING;
  } else if (typeof value === 'number') {
    return KeyType.NUMBER;
  } else if (value instanceof Date) {
    return KeyType.DATE;
  }
  if (value !== undefined) {
    throw new TypeError(`Cannot use ${value} as key field; type must be string, number, or Date`);
  }
  return undefined;
}

export function scalarToString(scalar: Scalar): string | undefined | null {
  if (scalar instanceof Date) {
    return scalar.toISOString();
  } else if (typeof scalar === 'number' || typeof scalar === 'boolean') {
    // TODO: Padding ?
    return scalar.toString();
  } else {
    return scalar;
  }
}
