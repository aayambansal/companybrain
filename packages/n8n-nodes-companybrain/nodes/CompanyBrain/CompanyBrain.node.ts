import type {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  IHttpRequestMethods,
  IDataObject,
} from 'n8n-workflow';

export class CompanyBrain implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'CompanyBrain',
    name: 'companyBrain',
    icon: 'file:companybrain.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"]}}',
    description: 'Search, add, and ask your company memory',
    defaults: { name: 'CompanyBrain' },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [{ name: 'companyBrainApi', required: true }],
    properties: [
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        options: [
          {
            name: 'Search',
            value: 'search',
            description: 'Hybrid search over your memory',
            action: 'Search memory',
          },
          {
            name: 'Ask',
            value: 'ask',
            description: 'RAG answer with citations',
            action: 'Ask memory',
          },
          { name: 'Add', value: 'add', description: 'Store a new memory', action: 'Add a memory' },
        ],
        default: 'search',
      },
      {
        displayName: 'Query',
        name: 'query',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { operation: ['search', 'ask'] } },
        description: 'The question or search query',
      },
      {
        displayName: 'Content',
        name: 'content',
        type: 'string',
        typeOptions: { rows: 4 },
        default: '',
        required: true,
        displayOptions: { show: { operation: ['add'] } },
      },
      {
        displayName: 'Title',
        name: 'title',
        type: 'string',
        default: '',
        displayOptions: { show: { operation: ['add'] } },
      },
      {
        displayName: 'Space',
        name: 'space',
        type: 'string',
        default: '',
        description: 'Optional space slug to scope to',
      },
      {
        displayName: 'Limit',
        name: 'limit',
        type: 'number',
        default: 6,
        displayOptions: { show: { operation: ['search', 'ask'] } },
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const creds = await this.getCredentials('companyBrainApi');
    const apiUrl = String(creds.apiUrl ?? 'http://localhost:3333').replace(/\/$/, '');
    const apiKey = String(creds.apiKey ?? '');
    const out: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      const operation = this.getNodeParameter('operation', i) as string;
      const space = (this.getNodeParameter('space', i, '') as string) || undefined;

      let path = '';
      let body: Record<string, unknown> = {};
      if (operation === 'search') {
        path = '/v1/search';
        body = {
          q: this.getNodeParameter('query', i) as string,
          mode: 'hybrid',
          space,
          limit: this.getNodeParameter('limit', i, 6) as number,
        };
      } else if (operation === 'ask') {
        path = '/v1/chat';
        body = {
          message: this.getNodeParameter('query', i) as string,
          space,
          limit: this.getNodeParameter('limit', i, 6) as number,
        };
      } else {
        path = '/v1/memories';
        body = {
          content: this.getNodeParameter('content', i) as string,
          title: (this.getNodeParameter('title', i, '') as string) || undefined,
          space,
        };
      }

      const headers: Record<string, string> = { 'content-type': 'application/json' };
      if (apiKey) headers['authorization'] = `Bearer ${apiKey}`;

      const response = await this.helpers.httpRequest({
        method: 'POST' as IHttpRequestMethods,
        url: apiUrl + path,
        headers,
        body,
        json: true,
      });

      out.push({ json: response as IDataObject, pairedItem: { item: i } });
    }

    return [out];
  }
}
