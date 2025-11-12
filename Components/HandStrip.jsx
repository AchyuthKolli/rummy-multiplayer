import React, { useState } from "react";
import type { RoundMeResponse } from "../apiclient/data-contracts";
import { PlayingCard } from "./PlayingCard";

export interface Props {
  hand: RoundMeResponse["hand"];
  onCardClick?: (card: RoundMeResponse["hand"][number], index: number) => void;
  selectedIndex?: number;
  highlightIndex?: number;
  onReorder?: (reorderedHand: RoundMeResponse["hand"]) => void;
}

export const HandStrip: React.FC<Props> = ({ hand, onCardClick, selectedIndex, highlightIndex, onReorder }) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const [touchStartIndex, setTouchStartIndex] = useState<number | null>(null);
  const [touchPosition, setTouchPosition] = useState<{ x: number; y: number } | null>(null);

  // Mouse/Desktop drag handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    const card = hand[index];
    e.dataTransfer.setData('card', JSON.stringify(card));
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      setDropTargetIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDropTargetIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDropTargetIndex(null);
      return;
    }

    const newHand = [...hand];
    const [draggedCard] = newHand.splice(draggedIndex, 1);
    newHand.splice(dropIndex, 0, draggedCard);

    if (onReorder) {
      onReorder(newHand);
    }

    setDraggedIndex(null);
    setDropTargetIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDropTargetIndex(null);
  };

  // Touch/Mobile handlers
  const handleTouchStart = (e: React.TouchEvent, index: number) => {
    const touch = e.touches[0];
    setTouchStartIndex(index);
    setDraggedIndex(index);
    setTouchPosition({ x: touch.clientX, y: touch.clientY });
    console.log('📱 Touch drag started for card', index);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartIndex === null) return;
    e.preventDefault(); // Prevent scrolling while dragging
    const touch = e.touches[0];
    setTouchPosition({ x: touch.clientX, y: touch.clientY });
    
    // Find which card is under the touch
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    const cardElement = element?.closest('[data-card-index]');
    if (cardElement) {
      const targetIndex = Number(cardElement.getAttribute('data-card-index'));
      if (targetIndex !== touchStartIndex) {
        setDropTargetIndex(targetIndex);
        console.log('📱 Dragging over card', targetIndex);
      }
    }
  };

  const handleTouchEnd = () => {
    console.log('📱 Touch drag ended', { touchStartIndex, dropTargetIndex });
    if (touchStartIndex !== null && dropTargetIndex !== null && touchStartIndex !== dropTargetIndex) {
      const newHand = [...hand];
      const [draggedCard] = newHand.splice(touchStartIndex, 1);
      newHand.splice(dropTargetIndex, 0, draggedCard);
      
      if (onReorder) {
        console.log('📱 Reordering hand');
        onReorder(newHand);
      }
    }
    
    setTouchStartIndex(null);
    setDraggedIndex(null);
    setDropTargetIndex(null);
    setTouchPosition(null);
  };

  return (
    <div className="w-full overflow-x-auto">
      <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 gap-2 py-4">
        {hand.map((card, idx) => (
          <div
            key={`${card.code}-${idx}`}
            data-card-index={idx}
            draggable={!!onReorder}
            onDragStart={(e) => handleDragStart(e, idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, idx)}
            onDragEnd={handleDragEnd}
            onTouchStart={(e) => handleTouchStart(e, idx)}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className={`transition-all duration-200 ${
              idx === draggedIndex ? 'opacity-50 scale-95' : ''
            } ${
              idx === dropTargetIndex ? 'scale-105 ring-2 ring-amber-400' : ''
            }`}
          >
            <PlayingCard
              card={card}
              onClick={onCardClick ? () => onCardClick(card, idx) : undefined}
              selected={selectedIndex === idx}
            />
            {idx === highlightIndex && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full animate-ping" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
