const fs = require('node:fs');
const path = require('node:path');
function crearAvisosViaje(file) {
  let memory = [];
  const read = () => file && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : memory;
  return {
    events(userId) { return read().filter(event => event.userId === userId); },
    closed(userId, routeId) {
      let lock;
      if (file) {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        lock = fs.openSync(file + '.lock', 'wx');
      }
      try {
        const events = read();
        if (events.some(event => event.routeId === routeId)) return;
        const event = { id: require('node:crypto').randomUUID(), userId, routeId, createdAt: new Date().toISOString() };
        const updated = [...events, event].slice(-200);
        if (file) { fs.writeFileSync(file + '.tmp', JSON.stringify(updated)); fs.renameSync(file + '.tmp', file); }
        else memory = updated;
      } finally {
        if (lock !== undefined) { fs.closeSync(lock); fs.unlinkSync(file + '.lock'); }
      }
    },
  };
}
module.exports = { crearAvisosViaje };
