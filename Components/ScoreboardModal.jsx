import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trophy, Crown } from "lucide-react";
import { PlayingCard } from "./PlayingCard";
import type { RevealedHandsResponse } from "../apiclient/data-contracts";
import { toast } from 'sonner';
import apiclient from '../apiclient';

export interface Props {
  isOpen: boolean;
  onClose: () => void;
  data: RevealedHandsResponse | null;
  players: Array<{ user_id: string; display_name?: string | null }>;
  currentUserId: string;
  tableId: string;
  hostUserId: string;
  onNextRound?: () => void;
}

export const ScoreboardModal: React.FC<Props> = ({ isOpen, onClose, data, players, currentUserId, tableId, hostUserId, onNextRound }) => {
  const [startingNextRound, setStartingNextRound] = useState(false);
  
  if (!data) return null;

  // Sort players by score (lowest first, as lower is better)
  const sortedPlayers = players
    .filter(p => data.scores[p.user_id] !== undefined)
    .map(p => ({
      ...p,
      score: data.scores[p.user_id],
      cards: data.revealed_hands[p.user_id] || [],
      organized: data.organized_melds?.[p.user_id] || null,
      isWinner: p.user_id === data.winner_user_id
    }))
    .sort((a, b) => a.score - b.score);

  const winnerName = sortedPlayers.find(p => p.isWinner)?.display_name || "Winner";
  const isHost = currentUserId === hostUserId;

  const handleStartNextRound = async () => {
    setStartingNextRound(true);
    try {
      await apiclient.start_next_round({ table_id: tableId });
      toast.success('Starting next round!');
      onClose();
      if (onNextRound) onNextRound();
    } catch (error: any) {
      const errorMessage = error?.error?.detail || error?.message || 'Failed to start next round';
      toast.error(errorMessage);
    } finally {
      setStartingNextRound(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-900 border-amber-600/30">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-2xl text-amber-400">
            <Trophy className="w-8 h-8 text-yellow-400" />
            Round {data.round_number} Complete!
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Winner announcement */}
          <div className="bg-gradient-to-r from-yellow-900/30 to-amber-900/30 border border-yellow-600/40 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-xl font-bold text-yellow-300">
              <Crown className="w-6 h-6" />
              {winnerName} wins with {sortedPlayers[0]?.score || 0} points!
            </div>
          </div>

          {/* Players list */}
          <div className="space-y-4">
            {sortedPlayers.map((player, idx) => (
              <div
                key={player.user_id}
                className={`rounded-lg border p-4 ${
                  player.isWinner
                    ? 'bg-yellow-950/20 border-yellow-600/50'
                    : 'bg-slate-800/50 border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {player.isWinner && <Crown className="w-5 h-5 text-yellow-400" />}
                    <span className="font-semibold text-lg text-slate-200">
                      {idx + 1}. {player.display_name || `Player ${player.user_id.slice(0, 8)}`}
                    </span>
                    {player.user_id === currentUserId && (
                      <span className="text-xs bg-blue-600/30 text-blue-300 px-2 py-1 rounded">You</span>
                    )}
                  </div>
                  <div className="text-xl font-bold text-amber-400">
                    {player.score} pts
                  </div>
                </div>

                {/* Organized melds display */}
                {player.organized ? (
                  <div className="space-y-3">
                    <div className="text-sm font-semibold text-slate-300 mb-2">
                      Hand Organization (4-3-3-3 Format):
                    </div>
                    
                    {/* Pure Sequences - HIGHEST PRIORITY */}
                    {player.organized.pure_sequences?.length > 0 && (
                      <div>
                        <div className="text-xs font-bold text-emerald-400 mb-1 flex items-center gap-2">
                          <span className="bg-emerald-900/50 px-2 py-0.5 rounded">✓ PURE SEQUENCE</span>
                          <span className="text-xs text-slate-400">(No Jokers)</span>
                        </div>
                        <div className="space-y-2">
                          {player.organized.pure_sequences.map((meld: any[], meldIdx: number) => (
                            <div key={`pure-${meldIdx}`} className="border-2 border-emerald-600/40 bg-emerald-950/30 rounded-lg p-2">
                              <div className="text-[10px] text-emerald-300 mb-1">
                                Meld {meldIdx + 1} ({meld.length} cards)
                              </div>
                              <div className="flex gap-1 flex-wrap">
                                {meld.map((card: any, cardIdx: number) => (
                                  <div key={cardIdx} className="transform scale-75 origin-top-left">
                                    <PlayingCard card={card} />
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Impure Sequences - MEDIUM PRIORITY */}
                    {player.organized.impure_sequences?.length > 0 && (
                      <div>
                        <div className="text-xs font-bold text-blue-400 mb-1 flex items-center gap-2">
                          <span className="bg-blue-900/50 px-2 py-0.5 rounded">✓ IMPURE SEQUENCE</span>
                          <span className="text-xs text-slate-400">(With Jokers)</span>
                        </div>
                        <div className="space-y-2">
                          {player.organized.impure_sequences.map((meld: any[], meldIdx: number) => (
                            <div key={`impure-${meldIdx}`} className="border-2 border-blue-600/40 bg-blue-950/30 rounded-lg p-2">
                              <div className="text-[10px] text-blue-300 mb-1">
                                Meld {meldIdx + 1} ({meld.length} cards)
                              </div>
                              <div className="flex gap-1 flex-wrap">
                                {meld.map((card: any, cardIdx: number) => (
                                  <div key={cardIdx} className="transform scale-75 origin-top-left">
                                    <PlayingCard card={card} />
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Sets - LOWER PRIORITY */}
                    {player.organized.sets?.length > 0 && (
                      <div>
                        <div className="text-xs font-bold text-purple-400 mb-1 flex items-center gap-2">
                          <span className="bg-purple-900/50 px-2 py-0.5 rounded">✓ SET</span>
                          <span className="text-xs text-slate-400">(Same Rank, Different Suits)</span>
                        </div>
                        <div className="space-y-2">
                          {player.organized.sets.map((meld: any[], meldIdx: number) => (
                            <div key={`set-${meldIdx}`} className="border-2 border-purple-600/40 bg-purple-950/30 rounded-lg p-2">
                              <div className="text-[10px] text-purple-300 mb-1">
                                Meld {meldIdx + 1} ({meld.length} cards)
                              </div>
                              <div className="flex gap-1 flex-wrap">
                                {meld.map((card: any, cardIdx: number) => (
                                  <div key={cardIdx} className="transform scale-75 origin-top-left">
                                    <PlayingCard card={card} />
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Ungrouped cards (deadwood) - PENALTY */}
                    {player.organized.ungrouped?.length > 0 && (
                      <div>
                        <div className="text-xs font-bold text-red-400 mb-1 flex items-center gap-2">
                          <span className="bg-red-900/50 px-2 py-0.5 rounded">✗ DEADWOOD</span>
                          <span className="text-xs text-slate-400">(Ungrouped - Counts as Points)</span>
                        </div>
                        <div className="border-2 border-red-600/40 bg-red-950/30 rounded-lg p-2">
                          <div className="text-[10px] text-red-300 mb-1">
                            {player.organized.ungrouped.length} ungrouped card(s)
                          </div>
                          <div className="flex gap-1 flex-wrap">
                            {player.organized.ungrouped.map((card: any, cardIdx: number) => (
                              <div key={cardIdx} className="transform scale-75 origin-top-left">
                                <PlayingCard card={card} />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Summary */}
                    <div className="text-xs text-slate-400 pt-2 border-t border-slate-700">
                      Total: {(player.organized.pure_sequences?.length || 0) + 
                             (player.organized.impure_sequences?.length || 0) + 
                             (player.organized.sets?.length || 0)} valid melds, 
                      {player.organized.ungrouped?.length || 0} deadwood cards
                    </div>
                  </div>
                ) : (
                  // Fallback: show all cards if no organization
                  <div className="flex gap-1 flex-wrap">
                    {player.cards.map((card: any, idx: number) => (
                      <div key={idx} className="transform scale-75 origin-top-left">
                        <PlayingCard card={card} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-3 justify-end">
            {isHost && (
              <Button 
                onClick={handleStartNextRound} 
                disabled={startingNextRound}
                className="bg-green-600 hover:bg-green-700 font-semibold"
              >
                {startingNextRound ? 'Starting...' : '🎮 Start Next Round'}
              </Button>
            )}
            <Button onClick={onClose} className="bg-amber-600 hover:bg-amber-700">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
