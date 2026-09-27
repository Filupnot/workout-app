import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

type Item = Record<string, any>;
const cancelled = () => Object.assign(new Error('Transaction cancelled'), { name: 'TransactionCanceledException' });

// A small in-memory DynamoDB supporting only the operations the repository uses.
// Any other command, including Scan, fails the test.
export function fakeDynamo() {
  const items = new Map<string, Item>();
  const commands: string[] = [];
  let failNextTransaction = false;
  const id = (pk: string, sk: string) => `${pk}\u0000${sk}`;
  const client = {
    async send(command: { constructor: { name: string }; input: any }) {
      const name = command.constructor.name; const input = command.input;
      commands.push(name);
      if (name === 'GetCommand') return { Item: structuredClone(items.get(id(input.Key.pk, input.Key.sk))) };
      if (name === 'QueryCommand') {
        const index = input.IndexName === 'byDate';
        const [hash, range] = index ? ['GSI1PK', 'GSI1SK'] : ['pk', 'sk'];
        const values = input.ExpressionAttributeValues;
        let rows = [...items.values()].filter(i => i[hash] === values[':p'] && (index || String(i.sk).startsWith(values[':s'])))
          .sort((a, b) => String(a[range]).localeCompare(String(b[range])));
        if (input.ScanIndexForward === false) rows.reverse();
        if (input.ExclusiveStartKey) {
          const at = rows.findIndex(r => r.pk === input.ExclusiveStartKey.pk && r.sk === input.ExclusiveStartKey.sk);
          rows = rows.slice(at + 1);
        }
        const page = rows.slice(0, input.Limit);
        const last = page.at(-1);
        return { Items: structuredClone(page), LastEvaluatedKey: rows.length > page.length && last ?
          { pk: last.pk, sk: last.sk, ...(index ? { GSI1PK: last.GSI1PK, GSI1SK: last.GSI1SK } : {}) } : undefined };
      }
      if (name === 'TransactWriteCommand') {
        if (failNextTransaction) { failNextTransaction = false; throw new Error('Transient database failure'); }
        for (const { Put } of input.TransactItems) {
          if (!Put?.ConditionExpression) continue;
          const old = items.get(id(Put.Item.pk, Put.Item.sk));
          const ok = Put.ConditionExpression === 'attribute_not_exists(pk)' ? !old : old?.revision === Put.ExpressionAttributeValues[':r'];
          if (!ok) throw cancelled();
        }
        for (const { Put, Delete } of input.TransactItems) {
          if (Put) items.set(id(Put.Item.pk, Put.Item.sk), structuredClone(Put.Item));
          if (Delete) items.delete(id(Delete.Key.pk, Delete.Key.sk));
        }
        return {};
      }
      throw new Error(`Unexpected command ${name}`);
    }
  } as unknown as Pick<DynamoDBDocumentClient, 'send'>;
  return { client, items, commands, failNext() { failNextTransaction = true; } };
}
