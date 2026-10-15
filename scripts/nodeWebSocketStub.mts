/**
 * Import this FIRST in a script that creates a Supabase client.
 *
 * supabase-js builds its realtime client up front and, on Node 20 (no global
 * WebSocket until Node 22), throws "Node.js 20 detected without native WebSocket
 * support" even for scripts that only run queries. The scripts never subscribe to
 * realtime, so a stand-in constructor is enough.
 */
if (typeof (globalThis as { WebSocket?: unknown }).WebSocket === "undefined") {
  (globalThis as { WebSocket?: unknown }).WebSocket = class UnusedWebSocket {
    constructor() {
      throw new Error("WebSocket is not available in this script (realtime is not used).");
    }
  };
}

export {};
