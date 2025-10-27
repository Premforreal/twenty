import { callRestApi } from './utils/call-rest-api';
import { callGraphQLApi } from './utils/call-graphql-api';

enum FieldMetadataType {
  ACTOR = 'ACTOR',
  ADDRESS = 'ADDRESS',
  ARRAY = 'ARRAY',
  BOOLEAN = 'BOOLEAN',
  CURRENCY = 'CURRENCY',
  DATE = 'DATE',
  DATE_TIME = 'DATE_TIME',
  EMAILS = 'EMAILS',
  FULL_NAME = 'FULL_NAME',
  LINKS = 'LINKS',
  MORPH_RELATION = 'MORPH_RELATION',
  MULTI_SELECT = 'MULTI_SELECT',
  NUMBER = 'NUMBER',
  NUMERIC = 'NUMERIC',
  PHONES = 'PHONES',
  POSITION = 'POSITION',
  RATING = 'RATING',
  RAW_JSON = 'RAW_JSON',
  RELATION = 'RELATION',
  RICH_TEXT = 'RICH_TEXT',
  RICH_TEXT_V2 = 'RICH_TEXT_V2',
  SELECT = 'SELECT',
  TEXT = 'TEXT',
  TS_VECTOR = 'TS_VECTOR',
  UUID = 'UUID',
}

export const main = async (params: {
  objectNameSingular: string;
  objectNamePlural: string;
  fieldName: string;
  fieldType: FieldMetadataType;
  computeFunction: string;
}) => {
  const {
    objectNameSingular,
    objectNamePlural,
    fieldName,
    fieldType,
    computeFunction,
  } = params;

  const result = await callRestApi({
    httpMethod: 'GET',
    url: 'rest/metadata/objects',
  });

  const object = result.data.objects.find(
    (object) => object.nameSingular === objectNameSingular,
  );

  if (!object) {
    throw new Error(`Object ${objectNameSingular} not found`);
  }

  const computedField = object.fields.find((field) => field.name === fieldName);

  if (!computedField) {
    await callRestApi({
      httpMethod: 'POST',
      url: 'rest/metadata/fields',
      payload: {
        objectMetadataId: object.id,
        type: fieldType,
        name: fieldName,
        label: fieldName,
        description: 'Computed field: ' + computeFunction,
      },
    });
  }

  const serverlessFunction = await callGraphQLApi({
    query: `
          mutation Mutation($input: CreateServerlessFunctionInput!) {
              createOneServerlessFunction(input: $input) {
                  id
              }
          }
        `,
    variables: { input: { name: 'Field compute' } },
  });

  const serverlessFunctionId =
    serverlessFunction.data.createOneServerlessFunction.id;

  const code = {
    src: {
      'index.ts': `import axios from "axios"

export const main = async (record) => {
const computeFunction = ${computeFunction}
const computedFieldValue = computeFunction(record)

const options = {
method: 'PATCH',
url: \`${process.env.TWENTY_API_URL}/rest/${objectNamePlural}/\${record.id}\`,
headers: {
  'Content-Type': 'application/json',
  Authorization: 'Bearer ${process.env.TWENTY_API_KEY}',
},
data: {${fieldName}: computedFieldValue },
};

await axios.request(options);

return true
}`,
    },
  };

  await callGraphQLApi({
    query: `
          mutation Mutation($input: UpdateServerlessFunctionInput!) {
              updateOneServerlessFunction(input: $input) {
                  id
              }
          }
        `,
    variables: {
      input: { id: serverlessFunctionId, update: { code, name: 'toto' } },
    },
  });

  console.log('serverlessFunctionId', serverlessFunctionId);

  const r = await callGraphQLApi({
    query: `
          mutation Mutation($input: CreateDatabaseEventTriggerInput!) {
              createOneDatabaseEventTrigger(input: $input) {
                  id
              }
          }
        `,
    variables: {
      input: {
        serverlessFunctionId,
        settings: { eventName: `${objectNameSingular}.created` },
      },
    },
  });

  console.log('result', JSON.stringify(r, null, 2));

  await callGraphQLApi({
    query: `
          mutation Mutation($input: CreateDatabaseEventTriggerInput!) {
              createOneDatabaseEventTrigger(input: $input) {
                  id
              }
          }
        `,
    variables: {
      input: {
        serverlessFunctionId,
        settings: { eventName: `${objectNameSingular}.updated` },
      },
    },
  });
};
