import _ from 'lodash';
import { getKeyType, getValueForKey, getValuesForKeys, scalarToString } from './helpers';
import { KeyConfig, KeyType, Scalar, DataObject } from './types';

class PrivatePyle {
  constructor(private message: string) {}

  getMessage() {
    return this.message;
  }
}

interface TestDataObject extends DataObject {
  boolValue: boolean;
  strValue: string;
  strValue2: string;
  dateValue: Date;
  dateValue2: Date;
  numValue: number;
  numValue2: number;
}

describe('helpers', function () {
  describe('getValueForKey', function () {
    const testObject = {
      strValue: 'This is a string',
      numValue: 818,
      dateValue: new Date('2022-01-01T00:00:00.000Z'),
      objectValue: { should: 'fail' },
      boolValue: false,
      undefValue: undefined,
    };

    const testCases: { config: KeyConfig<typeof testObject>; expected: Error | Scalar | undefined }[] = [
      {
        config: { keyName: 'strValue', keyType: KeyType.STRING, requiredForLookup: true },
        expected: testObject.strValue,
      },
      {
        config: { keyName: 'numValue', keyType: KeyType.NUMBER, requiredForLookup: true },
        expected: testObject.numValue,
      },
      {
        config: { keyName: 'dateValue', keyType: KeyType.DATE, requiredForLookup: true },
        expected: testObject.dateValue,
      },
      {
        config: { keyName: 'objectValue', keyType: KeyType.STRING, requiredForLookup: true },
        expected: new Error('type must be string, number, or Date'),
      },
      {
        config: { keyName: 'boolValue', keyType: KeyType.NUMBER, requiredForLookup: true },
        expected: new Error('type must be string, number, or Date'),
      },
      {
        config: { keyName: 'undefValue', keyType: KeyType.STRING, requiredForLookup: true },
        expected: new Error('is required'),
      },
      {
        config: { keyName: 'undefValue', keyType: KeyType.STRING, requiredForLookup: false },
        expected: undefined,
      },
    ];

    testCases.forEach(({ config, expected }) => {
      it(`gets ${config.keyName}${expected instanceof Error ? ' and throws expected Error' : ''}`, function () {
        if (expected instanceof Error) {
          expect(() => getValueForKey<typeof testObject>(testObject, config)).toThrowError(expected.message);
        } else {
          expect(getValueForKey(testObject, config)).toStrictEqual(expected);
        }
      });

      if (!(expected instanceof Error) && !(expected === undefined)) {
        _.values(KeyType)
          .filter((v) => v !== config.keyType)
          .forEach((keyType) =>
            it(`Fails to get ${config.keyName} with type ${keyType}`, () => {
              expect(() => getValueForKey<typeof testObject>(testObject, { ...config, keyType })).toThrowError(
                'Config specified type',
              );
            }),
          );
      }
    });
  });

  describe('getKeyType', function () {
    const testCases = [
      { name: 'Handles a string', value: 'This is a string', expected: KeyType.STRING },
      { name: 'Handles a number', value: 852, expected: KeyType.NUMBER },
      { name: 'Handles a date', value: new Date(), expected: KeyType.DATE },
      { name: 'Handles undefined', value: undefined, expected: undefined },
      { name: 'Fails on object', value: { an: 'object' }, expected: TypeError('Cannot use') },
      { name: 'Fails on class', value: new PrivatePyle('Not an error'), expected: TypeError('Cannot use') },
    ];

    testCases.forEach(({ name, value, expected }) =>
      it(name, function () {
        if (expected instanceof Error) {
          expect(() => getKeyType(value)).toThrowError(expected.message);
        } else {
          expect(getKeyType(value)).toStrictEqual(expected);
        }
      }),
    );
  });

  describe('scalarToString', function () {
    const testCases: { name: string; value: any; expected: ReturnType<typeof scalarToString> | Error }[] = [
      { name: 'Handles a string', value: 'Data-driven testing is cool', expected: 'Data-driven testing is cool' },
      {
        name: 'Handles a Date',
        value: new Date('1977-12-19T03:30:45.912-08:00'),
        expected: '1977-12-19T11:30:45.912Z',
      },
      { name: 'Handles a number', value: 382, expected: '382' },
      { name: 'Handles a number-like string', value: '382', expected: '382' },
      { name: 'Handles a boolean', value: true, expected: 'true' },
      { name: 'Returns undefined', value: undefined, expected: undefined },
      { name: 'Returns null', value: null, expected: null },
    ];

    testCases.forEach(({ name, value, expected }) => {
      it(name, function () {
        expect(scalarToString(value)).toStrictEqual(expected);
      });
    });
  });

  describe('getValuesForKeys', function () {
    const testDataObject: TestDataObject = {
      boolValue: false,
      strValue: 'value1',
      strValue2: 'value2',
      dateValue: new Date(),
      dateValue2: new Date('2023-01-01T00:00:00.000Z'),
      numValue: 103,
      numValue2: 691.49,
    };
    const testKeyConfigs: Record<string, KeyConfig<TestDataObject>> = {
      strValue: { keyName: 'strValue', keyType: KeyType.STRING, requiredForLookup: true },
      numValue: { keyName: 'numValue', keyType: KeyType.NUMBER, requiredForLookup: false },
      dateValue: { keyName: 'dateValue', keyType: KeyType.DATE, requiredForLookup: false },
    };

    it('Gets one key', function () {
      const results = getValuesForKeys<TestDataObject>(testDataObject, [testKeyConfigs.strValue], {});
      expect(results).toStrictEqual([{ keyName: 'strValue', value: 'value1' }]);
    });

    it('Gets two keys', function () {
      expect(getValuesForKeys(testDataObject, [testKeyConfigs.strValue, testKeyConfigs.numValue], {})).toStrictEqual([
        { keyName: 'strValue', value: testDataObject.strValue },
        { keyName: 'numValue', value: 103 },
      ]);
    });

    it('Fails on missing key', function () {
      expect(() =>
        getValuesForKeys(_.omit(testDataObject, 'numValue'), [testKeyConfigs.strValue, testKeyConfigs.numValue], {
          allowPartial: false,
        }),
      ).toThrow('did not find value for numValue');
    });

    it('Allows skipped key', function () {
      expect(
        getValuesForKeys(
          _.omit(testDataObject, 'numValue'),
          [testKeyConfigs.strValue, testKeyConfigs.numValue, testKeyConfigs.dateValue],
          {
            allowSkips: true,
          },
        ),
      ).toStrictEqual([
        { keyName: 'strValue', value: testDataObject.strValue },
        { keyName: 'dateValue', value: testDataObject.dateValue },
      ]);
    });

    it('Fails on skipped key', function () {
      expect(() =>
        getValuesForKeys(
          _.omit(testDataObject, 'numValue'),
          [testKeyConfigs.strValue, testKeyConfigs.numValue, testKeyConfigs.dateValue],
          {
            allowSkips: false,
          },
        ),
      ).toThrowError(/prefix.*dateValue/);
    });
  });
});
