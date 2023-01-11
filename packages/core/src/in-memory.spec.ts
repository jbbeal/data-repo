import { defaultIndexDescription, InMemoryDataRepo, KeyType, WriteResult } from '.';
import _ from 'lodash';

describe(InMemoryDataRepo.name, function () {
  it('exists', function () {
    expect(1).toStrictEqual(1);
  });

  describe('Simple Index', function () {
    type SimpleUser = {
      userId: number;
      email: string;
      password: string;
    };

    const firstUser = {
      userId: 581,
      password: 'nottelling',
      email: 'test1@test.com',
    };
    const secondUser = {
      userId: 582,
      password: 'stillnottelling',
      email: 'test2@test.com',
    };

    let testStore: InMemoryDataRepo<SimpleUser>;

    beforeEach(function () {
      testStore = new InMemoryDataRepo<SimpleUser>();
      testStore.provideIndex(
        defaultIndexDescription({
          indexName: 'userId',
          keyConfigs: [{ keyName: 'userId', keyType: KeyType.NUMBER, requiredForLookup: true }],
        }),
      );
    });

    it('Sets primary index', async function () {
      const index = testStore.getFirstPrimaryIndex();
      expect(index.indexName).toBe('userId');
      expect(index.keyConfigs).toStrictEqual([{ keyName: 'userId', keyType: KeyType.NUMBER, requiredForLookup: true }]);
      expect(index.isPrimary).toBe(true);
      expect(index.isUnique).toBe(true);
    });

    it('Can create an object', async function () {
      const result = await testStore.putObject(firstUser);
      expect(result).toBeDefined();
      expect(result.result).toBe(WriteResult.CREATED);
      expect(result.data).toStrictEqual<SimpleUser>(firstUser);
    });

    it('Can update an object', async function () {
      await testStore.putObject({ userId: firstUser.userId, password: 'fake', email: 'fake' });
      const result = await testStore.putObject(firstUser);
      expect(result).toBeDefined();
      expect(result.result).toBe(WriteResult.UPDATED);
      expect(result.data).toStrictEqual<SimpleUser>(firstUser);
    });

    it('Saves two users', async function () {
      await testStore.putObject(firstUser);
      const secondResult = await testStore.putObject(secondUser);
      expect(secondResult).toBeDefined();
      expect(secondResult.result).toBe(WriteResult.CREATED);
      expect(secondResult.data).toStrictEqual(secondUser);
    });

    it('Bulk saves users', async function () {
      await testStore.putObject({ userId: firstUser.userId, password: 'afke', email: 'afke' });
      const batchResult = await testStore.putObjects([firstUser, secondUser]);
      expect(batchResult).toBeDefined();
      expect(batchResult[0].data).toStrictEqual(firstUser);
      expect(batchResult[0].result).toBe(WriteResult.UPDATED);
      expect(batchResult[1].data).toStrictEqual(secondUser);
      expect(batchResult[1].result).toBe(WriteResult.CREATED);
    });

    it('Finds a user', async function () {
      await testStore.putObjects([firstUser, secondUser]);
      const found = await testStore.getObject({ userId: firstUser.userId });
      expect(found).toStrictEqual(firstUser);
    });

    it('Finds other user', async function () {
      await testStore.putObjects([firstUser, secondUser]);
      const found = await testStore.getObject({ userId: secondUser.userId });
      expect(found).toStrictEqual(secondUser);
    });

    it('Returns null', async function () {
      await testStore.putObjects([firstUser, secondUser]);
      expect(await testStore.getObject({ userId: 3 })).toBeNull();
    });
  });

  describe('Compound index', function () {
    type Measure = {
      name: string;
      ts: Date;
      amount: number;
    };

    const measures: Measure[] = _.range(1, 24).map((num) => ({
      name: 'measure1',
      ts: new Date(2023, 1, 5, num),
      amount: 5 * num,
    }));

    let testStore: InMemoryDataRepo<Measure>;

    beforeAll(async function () {
      testStore = new InMemoryDataRepo();
      testStore.provideIndex(
        defaultIndexDescription({
          indexName: 'name_ts',
          keyConfigs: [
            { keyName: 'name', keyType: KeyType.STRING, requiredForLookup: true },
            { keyName: 'ts', keyType: KeyType.DATE, requiredForLookup: false },
          ],
        }),
      );
    });

    it('Can save objects', async function () {
      const batchResult = await testStore.putObjects(measures);
      expect(batchResult).toHaveLength(measures.length);
      batchResult.forEach((result) => {
        expect(result.result).toBe(WriteResult.CREATED);
        expect(result.data.name).toBe('measure1');
      });
    });

    it('Retrieves all by name', async function () {
      await testStore.putObjects(measures);
      const otherMeasures: Measure[] = _.range(1, 30).flatMap((dayNum): Measure[] => [
        { name: 'measure2', ts: new Date(2023, 1, dayNum), amount: dayNum + 2 },
        { name: 'measure0', ts: new Date(2023, 1, dayNum), amount: dayNum + 2 },
      ]);
      await testStore.putObjects(otherMeasures);
      const foundMeasures = await testStore.listObjects({ name: measures[0].name });
      expect(foundMeasures).toHaveLength(measures.length);
    });
  });
});
