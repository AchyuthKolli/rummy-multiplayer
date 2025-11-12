# Data models and helpers for Rummy engine
# These are pure-Python helpers used by FastAPI endpoints.
from __future__ import annotations
from pydantic import BaseModel, Field
from typing import List, Literal, Optional, Dict, Tuple
import random

Rank = Literal["A","2","3","4","5","6","7","8","9","10","J","Q","K", "JOKER"]
Suit = Literal["S","H","D","C"]

class Card(BaseModel):
    rank: Rank
    suit: Optional[Suit] = None  # Jokers have no suit
    joker: bool = False          # True if joker (printed or wild)

    def code(self) -> str:
        if self.joker and self.rank == "JOKER":
            return "JOKER"
        return f"{self.rank}{self.suit or ''}"

class DeckConfig(BaseModel):
    decks: int = 2  # standard: 2 decks for up to 6 players
    include_printed_jokers: bool = True

RANKS: List[Rank] = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"]
SUITS: List[Suit] = ["S","H","D","C"]

class ShuffledDeck(BaseModel):
    cards: List[Card]

    def draw(self) -> Card:
        return self.cards.pop()  # draw from top (end)


def build_deck(cfg: DeckConfig) -> List[Card]:
    cards: List[Card] = []
    for _ in range(cfg.decks):
        for s in SUITS:
            for r in RANKS:
                cards.append(Card(rank=r, suit=s, joker=False))
        if cfg.include_printed_jokers:
            # Two printed jokers per deck typical
            cards.append(Card(rank="JOKER", suit=None, joker=True))
            cards.append(Card(rank="JOKER", suit=None, joker=True))
    return cards


def fair_shuffle(cards: List[Card], seed: Optional[int] = None) -> ShuffledDeck:
    rnd = random.Random(seed)
    # Use Fisher-Yates via random.shuffle
    cards_copy = list(cards)
    rnd.shuffle(cards_copy)
    return ShuffledDeck(cards=cards_copy)


class DealResult(BaseModel):
    hands: Dict[str, List[Card]]  # user_id -> 13 cards
    stock: List[Card]
    discard: List[Card]
    printed_joker: Optional[Card]


def deal_initial(user_ids: List[str], cfg: DeckConfig, seed: Optional[int] = None) -> DealResult:
    deck = fair_shuffle(build_deck(cfg), seed)
    # Flip printed joker from stock top (non-player)
    printed_joker: Optional[Card] = None

    # Deal 13 to each player, round-robin
    hands: Dict[str, List[Card]] = {u: [] for u in user_ids}
    # Pre-draw a printed joker to reveal if present (optional rule)
    # We'll reveal the first printed joker encountered when drawing discard initial card

    # Draw initial discard card
    discard: List[Card] = []

    # Distribute 13 cards
    for i in range(13):
        for u in user_ids:
            hands[u].append(deck.draw())

    # Reveal top card to discard; if joker, keep discarding until a non-joker to start
    while True:
        if not deck.cards:
            break
        top = deck.draw()
        if top.joker:
            discard.append(top)
            continue
        discard.append(top)
        break

    return DealResult(hands=hands, stock=deck.cards, discard=discard, printed_joker=printed_joker)


class StartRoundRequest(BaseModel):
    table_id: str
    user_ids: List[str] = Field(min_items=2, max_items=6)
    disqualify_score: int = 200
    seed: Optional[int] = None

class StartRoundResponse(BaseModel):
    round_id: str
    table_id: str
    number: int
    active_user_id: str
    stock_count: int
    discard_top: Optional[str]
