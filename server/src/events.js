// In-process pub/sub used by REST routes to push live updates over Socket.io
let _io = null;

export function setIo(io) {
  _io = io;
  console.log('[ws] event bus wired to socket.io');
}

const listeners = new Map(); // room -> Set<fn>

export function subscribe(room, fn) {
  if (!listeners.has(room)) listeners.set(room, new Set());
  listeners.get(room).add(fn);
  return () => listeners.get(room)?.delete(fn);
}

export function publish(room, event, payload) {
  const subs = listeners.get(room);
  if (subs) for (const fn of subs) { try { fn(event, payload); } catch (e) { console.error(e); } }
  // Forward to every socket that joined this room (e.g. order_12)
  if (_io) _io.to(room).emit(event, payload);
}

export const orderRoom = (id) => `order_${id}`;
export const adminRoom = 'admin';
