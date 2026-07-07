export interface AppConfig {
  crooApiUrl: string;
  crooWsUrl: string;
  crooSdkKey: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing ${name}. Set it from your agent.croo.network Dashboard.`);
  }
  return value.trim();
}

export function loadConfig(): AppConfig {
  return {
    crooApiUrl: requireEnv("CROO_API_URL"),
    crooWsUrl: requireEnv("CROO_WS_URL"),
    crooSdkKey: requireEnv("CROO_SDK_KEY"),
  };
}