import React, { useState } from 'react';
import { CreateTunnelRequest } from '../types/tunnel';
import { Play, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface TunnelFormProps {
  onCreateTunnel: (request: CreateTunnelRequest) => void;
  loading?: boolean;
  disabled?: boolean;
}

export const TunnelForm: React.FC<TunnelFormProps> = ({
  onCreateTunnel,
  loading = false,
  disabled = false
}) => {
  const [formData, setFormData] = useState<CreateTunnelRequest>({
    localPort: 3000,
    type: 'quick',
    name: '',
    token: ''
  });

  const [errors, setErrors] = useState<Partial<Record<keyof CreateTunnelRequest, string>>>({});

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof CreateTunnelRequest, string>> = {};

    if (!formData.localPort || formData.localPort < 1 || formData.localPort > 65535) {
      newErrors.localPort = 'Port must be between 1 and 65535';
    }

    if (formData.type === 'named') {
      if (!formData.name?.trim()) {
        newErrors.name = 'Tunnel name is required for named tunnels';
      }
      if (!formData.token?.trim()) {
        newErrors.token = 'Token is required for named tunnels';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onCreateTunnel(formData);
    }
  };

  const handleInputChange = (field: keyof CreateTunnelRequest, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <div className="flex items-center gap-2 mb-6">
        <Play className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">Create New Tunnel</h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Tunnel Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tunnel Type
          </label>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                name="type"
                value="quick"
                checked={formData.type === 'quick'}
                onChange={(e) => handleInputChange('type', e.target.value as 'quick' | 'named')}
                className="mr-2"
                disabled={disabled}
              />
              <span className="text-sm">Quick Tunnel</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="type"
                value="named"
                checked={formData.type === 'named'}
                onChange={(e) => handleInputChange('type', e.target.value as 'quick' | 'named')}
                className="mr-2"
                disabled={disabled}
              />
              <span className="text-sm">Named Tunnel</span>
            </label>
          </div>
        </div>

        {/* Local Port */}
        <div>
          <label htmlFor="localPort" className="block text-sm font-medium text-gray-700 mb-2">
            Local Port
          </label>
          <input
            type="number"
            id="localPort"
            value={formData.localPort}
            onChange={(e) => handleInputChange('localPort', parseInt(e.target.value) || 0)}
            className={cn(
              "w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500",
              errors.localPort ? "border-red-500" : "border-gray-300"
            )}
            placeholder="3000"
            min="1"
            max="65535"
            disabled={disabled}
          />
          {errors.localPort && (
            <p className="mt-1 text-sm text-red-600">{errors.localPort}</p>
          )}
        </div>

        {/* Named Tunnel Fields */}
        {formData.type === 'named' && (
          <>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Tunnel Name
              </label>
              <input
                type="text"
                id="name"
                value={formData.name || ''}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className={cn(
                  "w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500",
                  errors.name ? "border-red-500" : "border-gray-300"
                )}
                placeholder="my-tunnel"
                disabled={disabled}
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name}</p>
              )}
            </div>

            <div>
              <label htmlFor="token" className="block text-sm font-medium text-gray-700 mb-2">
                Tunnel Token
              </label>
              <textarea
                id="token"
                value={formData.token || ''}
                onChange={(e) => handleInputChange('token', e.target.value)}
                className={cn(
                  "w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500",
                  errors.token ? "border-red-500" : "border-gray-300"
                )}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                rows={3}
                disabled={disabled}
              />
              {errors.token && (
                <p className="mt-1 text-sm text-red-600">{errors.token}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Get your token from the Cloudflare dashboard under Zero Trust → Networks → Tunnels
              </p>
            </div>
          </>
        )}

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={disabled || loading}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
              disabled || loading
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700"
            )}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Create Tunnel
              </>
            )}
          </button>
        </div>
      </form>

      {/* Help Text */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h4 className="text-sm font-medium text-blue-900 mb-2">How it works:</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• <strong>Quick Tunnel:</strong> Creates a temporary tunnel that expires when stopped</li>
          <li>• <strong>Named Tunnel:</strong> Uses a pre-configured tunnel with a token for persistent access</li>
          <li>• The tunnel will expose your local application running on the specified port</li>
        </ul>
      </div>
    </div>
  );
};
