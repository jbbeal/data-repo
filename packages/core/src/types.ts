/**
 * Describes an interface for interacting with a data repository. Implementors of this
 * interface may be written for databases, caches, or cloud services such as Amazon S3.
 * By writing against this interface, application developers can ignore the implementation
 * details of these services and focus on the core use cases of storing and retrieving data.
 */
export interface DataRepo<T extends DataObject> {
  /**
   * Provides an index description to the DataRepo. How index descriptions are interpreted
   * by the DataRepo is very implementation dependent.
   */
  provideIndex(index: IndexDescription<T>): void;
  /**
   * Looks up an object by its key fields. This method will always use the index
   * @param template Subset of fields in the object necessary for a complete lookup
   */
  getObject(template: Partial<T>): Promise<GetResponse<T>>;
  putObject(obj: T): Promise<WriteResults<T>>;
  putObjects(objects: T[]): Promise<WriteResults<T>[]>;
  listObjects(template: Partial<T>): Promise<ListResponse<T>>;
}

export type Scalar = IndexableScalar | boolean | null | undefined;
export type IndexableScalar = string | number | Date;
export type OrArray<T> = T | Array<T>;
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface DataObject extends Record<string, OrArray<Scalar> | OrArray<DataObject>> {}

/**
 * Options for the GetKeys type. These parameters allow different data operations to specify different
 * validation requirements on whether or not keys are required. Typically, GET and PUT operations require
 * all keys in the primary index to be set, but LIST operations can support partial indexes. In all cases,
 * the value of `requiredForLookup` specified on the `KeyConfig` takes precedence.
 */
export type GetKeyOptions = {
  /** Lookups that require the full set of keys -- typically GET and PUT operations -- will*/
  allowPartial: boolean;
  /**
   * Some database implementations can allow partial index lookups, but only for prefix keys
   */
  allowSkips: boolean;
};

/**
 * Function that extracts the key fields out of a data object.
 * @param allowPartial Set to true to allow this function to return a partial
 * list of keys.  (In general, you can expect calls to this function from a `getObject`
 * or `putObject` operation to set this to true; calls from a `listObjects` operation
 * will set it to false.)
 */
export type GetKeys<T extends DataObject> = (obj: Partial<T>, opts: GetKeyOptions) => Keys<T>;

/**
 * Represents just the key fields of a data type, T. In many cases, `Keys<T>` will
 * be equivalent to `Pick<T, key_1 | ... | key_n>`, but the type constraint requires
 * key fields to be of type string, number, or Date, and we allow derived fields with
 * new names to be included.
 */
export type Keys<T extends DataObject> = { keyName: keyof T | string; value: IndexableScalar }[];

export type WriteResults<T> = {
  data: T;
  result: WriteResult;
  error?: string;
  errorCode?: number;
};

export enum WriteResult {
  UPDATED = 'updated',
  CREATED = 'created',
  CONFLICT = 'conflict',
  ERROR = 'error',
}

export type GetResponse<T extends DataObject> = {
  data: T | undefined;
  result: ReadResult;
  error?: string;
  errorCode?: number;
};

export type ListResponse<T extends DataObject> = {
  data: T[];
  result: ReadResult;
  hasMore: boolean;
  next: Keys<T> | undefined;
  error?: string;
  errorCode?: number;
};

export enum ReadResult {
  FOUND = 'found',
  NOT_FOUND = 'not_found',
  ERROR = 'error',
}

export type KeyConfig<T extends DataObject> = {
  keyName: keyof T | string;
  keyType?: KeyType;
  /**
   * Indicates that a value for this key is required for lookup.
   * For every index, the first listed indexKey is assumed required and all others are assumed
   * optional. For some implementations, this is merely guidance to optimize performance of
   * existing indexes. For others, this may change how the index key is stored. (For example,
   * a Dynamo implementation may concatenate any required index fields into the hash key
   * portion of the index, and use the range key for non-required fields.)
   */
  requiredForLookup?: boolean;
};

export enum KeyType {
  STRING = 'str',
  NUMBER = 'num',
  DATE = 'date',
}

export type IndexDescription<T extends DataObject> = {
  /** The name of the index. Optional for some implementations. */
  indexName?: string;
  /** The keys in the index, in the order in which they are defined. */
  keyConfigs: KeyConfig<T>[];

  getKeys: GetKeys<T>;

  /**
   * Indicates that this index acts as the primary index. If not specified,
   * will be assumed true for the first index provided to a data repo and false
   * for all others.
   *
   * While specifying multiple primary indexes is allowed by the DataRepo interface,
   * some implementations may disallow it.
   */
  isPrimary?: boolean;

  /**
   * Indicates that the fields in this index uniquely identify an object.
   * If not specified, this defaults to true for primary indexes and false for all
   * others.
   */
  isUnique?: boolean;
};
