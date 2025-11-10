import React, { useState } from 'react';

interface ConfigSetupProps {
  onConnect: (config: { apiKey: string; clientId: string; spreadsheetId: string }) => void;
  initialSpreadsheetId: string;
  isGapiReady: boolean;
}

const ConfigSetup: React.FC<ConfigSetupProps> = ({ onConnect, initialSpreadsheetId, isGapiReady }) => {
  const [apiKey, setApiKey] = useState('');
  const [clientId, setClientId] = useState('');
  const [spreadsheetId, setSpreadsheetId] = useState(initialSpreadsheetId);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim() || !clientId.trim() || !spreadsheetId.trim()) {
      setError('Vui lòng điền đầy đủ tất cả các trường.');
      return;
    }
    setError('');
    onConnect({ apiKey, clientId, spreadsheetId });
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-primary">
      <div className="w-full max-w-lg p-8 space-y-6 bg-secondary rounded-lg shadow-lg">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-highlight">Cấu hình Kết nối Google Sheets</h1>
          <p className="mt-2 text-text-secondary">
            Để truy cập dữ liệu trên Google Sheets, ứng dụng cần bạn cấp quyền thông qua OAuth 2.0. Vui lòng cung cấp các thông tin sau từ dự án Google Cloud của bạn.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="apiKey" className="block text-sm font-medium text-text-secondary mb-1">
              Google API Key
            </label>
            <input
              id="apiKey"
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full bg-primary border border-accent rounded-md p-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-highlight"
              placeholder="AIzaSy..."
              required
            />
            <p className="text-xs text-text-secondary mt-1">Dùng để xác định ứng dụng của bạn với các dịch vụ của Google.</p>
          </div>
          <div>
            <label htmlFor="clientId" className="block text-sm font-medium text-text-secondary mb-1">
              Google OAuth 2.0 Client ID (Loại: Web application)
            </label>
            <input
              id="clientId"
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full bg-primary border border-accent rounded-md p-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-highlight"
              placeholder="xxxxxxxx.apps.googleusercontent.com"
              required
            />
             <p className="text-xs text-text-secondary mt-1">Quan trọng: Dùng để yêu cầu bạn cấp quyền truy cập vào Google Sheets.</p>
             <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-sm text-highlight hover:underline mt-1 block">
                Làm thế nào để tạo API Key và OAuth Client ID?
            </a>
          </div>
          <div>
            <label htmlFor="spreadsheetId" className="block text-sm font-medium text-text-secondary mb-1">
              Spreadsheet ID
            </label>
            <input
              id="spreadsheetId"
              type="text"
              value={spreadsheetId}
              onChange={(e) => setSpreadsheetId(e.target.value)}
              className="w-full bg-primary border border-accent rounded-md p-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-highlight"
              placeholder="1ZY4epEmhscFzkZEXcCUG5HyuxiQIxuiNJx5_RsgE984"
              required
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={!isGapiReady}
            className="w-full bg-highlight text-primary font-bold py-3 px-4 rounded-md hover:bg-teal-400 transition duration-300 disabled:bg-accent disabled:cursor-not-allowed"
          >
            {isGapiReady ? 'Kết nối & Đăng nhập' : 'Đang tải thư viện...'}
          </button>
        </form>
        <div className="text-center text-text-secondary text-sm">
            <p className="font-bold">Quan trọng:</p>
            <p>Hãy chắc chắn rằng bạn đã tạo hai sheet có tên `Transactions` và `Config` trong file Google Sheets của bạn.</p>
        </div>
      </div>
    </div>
  );
};

export default ConfigSetup;