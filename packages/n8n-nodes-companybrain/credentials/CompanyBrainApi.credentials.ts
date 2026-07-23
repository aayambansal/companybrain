import type { ICredentialType, INodeProperties } from 'n8n-workflow';

export class CompanyBrainApi implements ICredentialType {
  name = 'companyBrainApi';
  displayName = 'CompanyBrain API';
  documentationUrl = 'https://github.com/aayambansal/companybrain';
  properties: INodeProperties[] = [
    {
      displayName: 'API URL',
      name: 'apiUrl',
      type: 'string',
      default: 'http://localhost:3333',
      placeholder: 'https://your-companybrain-host',
    },
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      description:
        'A CompanyBrain API key (cb_...). Leave blank if the server runs in single-user mode.',
    },
  ];
}
