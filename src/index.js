import { DurableObject } from "cloudflare:workers";

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.clients = new Set();
  }

  async fetch(request) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Music Room server", { status: 200 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    server.accept();
    this.clients.add(server);

    server.addEventListener("message", event => {
      for (const other of this.clients) {
        if (other !== server) {
          try {
            other.send(event.data);
          } catch {}
        }
      }
    });

    server.addEventListener("close", () => {
      this.clients.delete(server);
    });

    server.addEventListener("error", () => {
      this.clients.delete(server);
    });

    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }
}

function getRoomName(url) {
  const room = url.searchParams.get("room");
  return (room || "main")
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 32) || "MAIN";
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/ws") {
      const roomName = getRoomName(url);
      const id = env.ROOMS.idFromName(roomName);
      const room = env.ROOMS.get(id);

      return room.fetch(request);
    }

    return env.ASSETS.fetch(request);
  }
};
