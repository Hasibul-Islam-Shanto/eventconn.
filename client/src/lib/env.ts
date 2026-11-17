function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    // If running in the browser and accessing via a non-localhost host (e.g. EC2 IP or domain)
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      // If accessed via NodePort 30000, API Gateway is on NodePort 30001
      if (window.location.port === '30000') {
        return `${window.location.protocol}//${window.location.hostname}:30001/api`;
      }
      // If accessed via port 3000, API Gateway is on port 4000
      if (window.location.port === '3000') {
        return `${window.location.protocol}//${window.location.hostname}:4000/api`;
      }
      // If accessed via standard HTTP/HTTPS (Port 80/443 or Ingress/Domain)
      if (!window.location.port || window.location.port === '80' || window.location.port === '443') {
        return `${window.location.origin}/api`;
      }
      // Fallback for other custom ports
      return `${window.location.protocol}//${window.location.hostname}:30001/api`;
    }
  }

  return process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api';
}

export const env = {
  get apiBaseUrl(): string {
    return getApiBaseUrl().replace(/\/$/, '');
  },
};
