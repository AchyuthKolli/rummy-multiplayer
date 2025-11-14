import React, { useEffect, useState } from 'react';
import socket from '../socket'; // your socket instance - adapt path if needed

export default function MeldBoard({ roomId, playerId }) {
  const [melds, setMelds] = useState([[], [], [], []]);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    socket.emit('getPlayerMelds', { roomId, playerId });
    socket.on('playerMelds', ({ melds: serverMelds, locked: serverLocked }) => {
      if (serverMelds) {
        setMelds(serverMelds);
        setLocked(!!serverLocked);
        try { localStorage.setItem(`melds_${roomId}_${playerId}`, JSON.stringify(serverMelds)); } catch(e) {}
      } else {
        const saved = localStorage.getItem(`melds_${roomId}_${playerId}`);
        if (saved) setMelds(JSON.parse(saved));
      }
    });

    socket.on('playerMeldsUpdated', ({ playerId: pid, melds: updated }) => {
      // could show toast for other players; no-op here
    });

    return () => {
      socket.off('playerMelds');
      socket.off('playerMeldsUpdated');
    };
  }, [roomId, playerId]);

  function handleLock() {
    const sizes = melds.map(m => m.length);
    const isShapeValid = sizes[0] === 3 && sizes[1] === 3 && sizes[2] === 3 && sizes[3] === 4;
    if (!isShapeValid) {
      alert('Melds should be arranged as 3,3,3,4');
      return;
    }
    setLocked(true);
    socket.emit('lockMelds', { roomId, playerId, melds });
    try { localStorage.setItem(`melds_${roomId}_${playerId}`, JSON.stringify(melds)); } catch(e) {}
  }

  return (
    <div className="meld-board">
      <div className="meld-row">
        {melds.map((m, idx) => (
          <div key={idx} className="meld">
            <div className="meld-title">Meld {idx + 1} ({idx === 3 ? 4 : 3}) {locked && <span className="lock">🔒</span>}</div>
            <div className="slots">
              {(idx === 3 ? [0,1,2,3] : [0,1,2]).map((s) => (
                <div key={s} className="slot">{m[s] ? <Card card={m[s]} /> : <div className="empty-slot">{s+1}</div>}</div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button disabled={locked} onClick={handleLock}>{locked ? 'Locked' : 'Lock Melds'}</button>
    </div>
  );
}

function Card({ card }) {
  return <div className="card">{card.rank}{card.suit}</div>;
}
