import * as fs from 'fs';
import * as path from 'path';
import { encrypt, decrypt } from '../config/encryption';

const VPN_CONFIG_PATH = process.env.VPN_CONFIG_PATH || '/vpn';
const OVPN_FILE = path.join(VPN_CONFIG_PATH, 'client.ovpn');
const AUTH_FILE = path.join(VPN_CONFIG_PATH, 'auth.txt');
const STATUS_FILE = path.join(VPN_CONFIG_PATH, 'status.json');

export interface VPNStatus {
  connected: boolean;
  configUploaded: boolean;
  ip?: string;
  uptime?: string;
  lastError?: string;
}

export class VPNService {
  async uploadConfig(ovpnContent: string, credentials?: { user: string; pass: string }): Promise<void> {
    // Ensure directory exists
    if (!fs.existsSync(VPN_CONFIG_PATH)) fs.mkdirSync(VPN_CONFIG_PATH, { recursive: true });

    // Write .ovpn file
    fs.writeFileSync(OVPN_FILE, ovpnContent, 'utf8');

    // Write auth file if credentials provided
    if (credentials) {
      fs.writeFileSync(AUTH_FILE, `${credentials.user}\n${credentials.pass}\n`, 'utf8');
      // Add auth-user-pass directive if not present
      if (!ovpnContent.includes('auth-user-pass')) {
        fs.appendFileSync(OVPN_FILE, '\nauth-user-pass /vpn/auth.txt\n');
      }
    }

    // Save status
    this.saveStatus({ connected: false, configUploaded: true });
  }

  async getStatus(): Promise<VPNStatus & { vpnContainerAvailable?: boolean }> {
    let vpnContainerAvailable = false;
    let connected = false;
    let ip: string | undefined;

    try {
      const { execSync } = require('child_process');
      // Check if VPN container is running
      const containerName = execSync('docker ps --format "{{.Names}}" 2>/dev/null | grep vpn || echo ""', { encoding: 'utf8' }).trim();
      vpnContainerAvailable = !!containerName;

      if (containerName) {
        // Check container health status
        const health = execSync(`docker inspect --format="{{.State.Health.Status}}" ${containerName} 2>/dev/null || echo "none"`, { encoding: 'utf8' }).trim();
        connected = health === 'healthy';

        // Get VPN IP from container (tun0 interface)
        if (connected) {
          try {
            const ipResult = execSync(`docker exec ${containerName} ip addr show tun0 2>/dev/null | grep 'inet ' | awk '{print $2}' | cut -d/ -f1`, { encoding: 'utf8' }).trim();
            if (ipResult) ip = ipResult;
          } catch {}
        }
      }
    } catch {}

    return {
      connected,
      configUploaded: fs.existsSync(OVPN_FILE),
      ip,
      vpnContainerAvailable,
    };
  }

  async removeConfig(): Promise<void> {
    if (fs.existsSync(OVPN_FILE)) fs.unlinkSync(OVPN_FILE);
    if (fs.existsSync(AUTH_FILE)) fs.unlinkSync(AUTH_FILE);
    this.saveStatus({ connected: false, configUploaded: false });
  }

  private saveStatus(status: VPNStatus): void {
    try {
      fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2));
    } catch {}
  }
}

export const vpnService = new VPNService();
