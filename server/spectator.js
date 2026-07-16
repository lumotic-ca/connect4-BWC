import { v4 as uuidv4 } from 'uuid';

// A non-playing observer connected to an online room
class Spectator {
  constructor({ id = uuidv4(), name, socket = null, room = null }) {
    // Unique identifier for this spectator within the room
    this.id = id;
    // Display name entered when joining as a spectator
    this.name = name;
    // Active Socket.IO connection, if any
    this.socket = socket;
    // Parent room reference
    this.room = room;
  }

  get connected() {
    return this.socket !== null;
  }

  // Emit an event to this spectator when they are connected
  emit(eventName, data) {
    if (this.socket) {
      this.socket.emit(eventName, data);
    }
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      connected: this.connected
    };
  }
}

export default Spectator;
