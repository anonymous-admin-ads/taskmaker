// Centralized Real-time Event Broadcaster for Multi-User Live Synchronization
const clients = new Set();
let revisionNumber = 1;
let lastChangeTimestamp = new Date().toISOString();

export function getSyncState() {
  return {
    revision: revisionNumber,
    timestamp: lastChangeTimestamp
  };
}

export function addClient(res) {
  clients.add(res);
  res.on('close', () => {
    clients.delete(res);
  });
}

export function notifyChange(entityType, payload = {}) {
  revisionNumber++;
  lastChangeTimestamp = new Date().toISOString();

  const eventData = JSON.stringify({
    entity: entityType,
    revision: revisionNumber,
    timestamp: lastChangeTimestamp,
    payload
  });

  const message = `event: ${entityType}\ndata: ${eventData}\n\n`;
  const globalMessage = `event: change\ndata: ${eventData}\n\n`;

  for (const client of clients) {
    try {
      client.write(message);
      client.write(globalMessage);
    } catch (err) {
      clients.delete(client);
    }
  }
}

