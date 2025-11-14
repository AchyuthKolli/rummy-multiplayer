// server/socketHandlers.js
// Attach these to your existing socket.io setup

const { calculateDeadwood } = require('./gameState');

function attachHandlers(io, roomManager) {
  io.on('connection', (socket) => {
    // join room
    socket.on('joinRoom', ({ roomId, player }) => {
      socket.join(roomId);
      // ensure player object added in roomManager (roomManager implementation expected)
      // e.g. roomManager.addPlayer(roomId, player)
    });

    // Player locks their melds: save into room state and broadcast
    socket.on('lockMelds', ({ roomId, playerId, melds }) => {
      const room = roomManager.get(roomId);
      if (!room) return;
      const player = room.players.find(p => p.id === playerId);
      if (!player) return;
      player.melds = melds;
      player.meldsLocked = true;
      io.to(roomId).emit('playerMeldsUpdated', { playerId, melds });
    });

    // Request to get saved melds (on reconnect/refresh)
    socket.on('getPlayerMelds', ({ roomId, playerId }) => {
      const room = roomManager.get(roomId);
      const player = room && room.players.find(p => p.id === playerId);
      socket.emit('playerMelds', { playerId, melds: player ? player.melds : null, locked: player ? !!player.meldsLocked : false });
    });

    // Drop before drawing a card (only allowed when players > 2)
    socket.on('dropBeforeDraw', ({ roomId, playerId }) => {
      const room = roomManager.get(roomId);
      if (!room) return;
      if ((room.players || []).length <= 2) {
        socket.emit('error', { message: 'Drop not allowed in 2-player games' });
        return;
      }
      const player = room.players.find(p => p.id === playerId);
      if (!player || player.hasDroppedThisRound) return;
      player.score = (player.score || 0) + 20;
      player.hasDroppedThisRound = true;
      io.to(roomId).emit('playerDropped', { playerId, newScore: player.score });
    });

    // Handle disconnect/leave
    socket.on('disconnecting', () => {
      const rooms = Array.from(socket.rooms);
      for (const roomId of rooms) {
        const room = roomManager.get(roomId);
        if (!room) continue;
        const player = room.players && room.players.find(p => p.socketId === socket.id);
        if (!player) continue;
        player.score = (player.score || 0) + 60;
        player.disconnected = true;
        io.to(roomId).emit('playerLeft', { playerId: player.id, penalty: 60 });
        // Optionally: remove or mark seat free, continue round logic as needed
      }
    });

    // Chat message - supports room (group) and private
    socket.on('chat', ({ roomId, from, toPlayerId, text }) => {
      const room = roomManager.get(roomId);
      if (!room) return;
      const fromPlayer = room.players.find(p => p.id === from);
      if (!fromPlayer) return;
      if (fromPlayer.isMuted) {
        socket.emit('chatBlocked', { reason: 'You are muted by the host' });
        return;
      }
      if (toPlayerId) {
        const to = room.players.find(p => p.id === toPlayerId);
        if (to) io.to(to.socketId).emit('privateChat', { from, text });
      } else {
        io.to(roomId).emit('chatMessage', { from, text, displayName: fromPlayer.displayName, avatar: fromPlayer.avatar });
      }
    });

    // Host mutes/unmutes a player
    socket.on('setMute', ({ roomId, hostId, targetId, muted }) => {
      const room = roomManager.get(roomId);
      if (!room) return;
      const host = room.players.find(p => p.id === hostId);
      if (!host || !host.isHost) return;
      const target = room.players.find(p => p.id === targetId);
      if (!target) return;
      target.isMuted = muted;
      io.to(roomId).emit('playerMuteChange', { playerId: targetId, muted });
    });
  });
}

module.exports = attachHandlers;
