import React from 'react';
import { ConfigForm, FieldSchema } from '../components/settings/ConfigForm';
import { CacheManagementPanel } from '../components/cache/CacheManagementPanel';

const SettingsPage: React.FC = () => {
  const schema: Record<string, FieldSchema> = {
    httpPort: { key: 'httpPort', type: 'number', minimum: 1024, maximum: 65535, description: 'Port for the HTTP server' },
  };
  const [values, setValues] = React.useState<Record<string, any>>({ httpPort: 3900 });
  return (
    <div className="space-y-6">
      <div className="bg-card p-4 rounded-lg shadow-sm border border-border neo:rounded-none neo:border-[3px] neo:shadow-[8px_8px_0_0_rgba(0,0,0,1)] dark:neo:shadow-[8px_8px_0_0_rgba(255,255,255,0.9)]">
        <h3 className="text-lg font-semibold mb-4 text-foreground">Server Settings</h3>
        <ConfigForm
          schema={schema}
          values={values}
          onChange={(k, v) => setValues((prev) => ({ ...prev, [k]: v }))}
          onSubmit={() => console.log('Save settings', values)}
          onReset={() => setValues({ httpPort: 3900 })}
        />
      </div>
      
      <CacheManagementPanel />
    </div>
  );
};

export default SettingsPage;
