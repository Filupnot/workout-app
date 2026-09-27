import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { createHandler } from './api';
import { createAuthenticator } from './auth';
import { DynamoRepository } from './dynamo';
const required = (key: string) => { const value = process.env[key]; if (!value) throw new Error(`Missing configuration: ${key}`); return value; };
const ssm = new SSMClient({});
let admission = { subject: '', expires: 0 };
const authenticate = createAuthenticator(required('USER_POOL_ID'), required('CLIENT_ID'), async () => {
  if (Date.now() < admission.expires) return admission.subject;
  const parameter = await ssm.send(new GetParameterCommand({ Name: required('OWNER_PARAMETER'), WithDecryption: true }));
  admission = { subject: parameter.Parameter?.Value?.trim() || '', expires: Date.now() + 60000 };
  return admission.subject;
});
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } });
export const handler = createHandler(new DynamoRepository(client, required('TABLE_NAME')), authenticate, required('APP_ORIGIN'));
