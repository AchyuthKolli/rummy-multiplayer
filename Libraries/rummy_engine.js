"""Core rummy game engine with validation and scoring logic"""
import asyncpg
import random
from typing import List, Dict, Tuple, Optional

# Card deck constants
SUITS = ['H', 'D', 'C', 'S']  # Hearts, Diamonds, Clubs, Spades
RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

def create_deck(num_decks: int = 2) -> List[str]:
    """Create shuffled deck with jokers"""
    deck = []
    for _ in range(num_decks):
        # Regular cards
        for suit in SUITS:
            for rank in RANKS:
                deck.append(f"{rank}{suit}")
        # Printed jokers (2 per deck)
        deck.append("JKR")
        deck.append("JKR")
    
    random.shuffle(deck)
    return deck

def calculate_card_points(card: str) -> int:
    """Calculate points for a single card"""
    if card == "JKR":
        return 0
    
    rank = card[:-1]  # Remove suit
    if rank in ['J', 'Q', 'K', 'A']:
        return 10
    return int(rank)

def validate_sequence(cards: List[str]) -> Tuple[bool, bool]:
    """Validate if cards form a sequence. Returns (is_valid, is_pure)"""
    if len(cards) < 3:
        return False, False
    
    # Check for jokers
    has_joker = any(c == "JKR" for c in cards)
    
    # Extract suits and ranks
    suits = [c[-1] for c in cards if c != "JKR"]
    ranks = [c[:-1] for c in cards if c != "JKR"]
    
    # All non-joker cards must be same suit
    if len(set(suits)) > 1:
        return False, False
    
    # Check consecutive ranks
    rank_order = {'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13}
    rank_values = sorted([rank_order[r] for r in ranks])
    
    # With jokers, check if remaining cards can form sequence
    if has_joker:
        # Simple validation for now
        return True, False
    
    # Pure sequence check
    for i in range(1, len(rank_values)):
        if rank_values[i] != rank_values[i-1] + 1:
            return False, False
    
    return True, True

def validate_set(cards: List[str]) -> bool:
    """Validate if cards form a set (same rank, different suits)"""
    if len(cards) < 3:
        return False
    
    # Remove jokers for validation
    non_jokers = [c for c in cards if c != "JKR"]
    if len(non_jokers) < 2:
        return False
    
    # All non-joker cards must have same rank
    ranks = [c[:-1] for c in non_jokers]
    if len(set(ranks)) > 1:
        return False
    
    # All non-joker cards must have different suits
    suits = [c[-1] for c in non_jokers]
    if len(suits) != len(set(suits)):
        return False
    
    return True

async def deal_initial_hands(conn: asyncpg.Connection, table_id: str, round_num: int, player_ids: List[str]):
    """Deal initial 13 cards to each player for a new round"""
    num_players = len(player_ids)
    deck = create_deck(num_decks=2 if num_players <= 4 else 3)
    
    # Deal 13 cards to each player
    for i, player_id in enumerate(player_ids):
        hand = deck[i*13:(i+1)*13]
        await conn.execute(
            """
            INSERT INTO player_rounds (table_id, round_number, user_id, hand, drawn_card, has_drawn, status)
            VALUES ($1, $2, $3, $4, NULL, FALSE, 'playing')
            ON CONFLICT (table_id, round_number, user_id) 
            DO UPDATE SET hand = $4, drawn_card = NULL, has_drawn = FALSE, status = 'playing'
            """,
            table_id, round_num, player_id, hand
        )
    
    # Remaining cards go to stock pile
    stock_pile = deck[num_players*13:]
    
    # Initialize round state
    await conn.execute(
        """
        INSERT INTO round_state (table_id, round_number, stock_pile, discard_pile, current_turn_index)
        VALUES ($1, $2, $3, '{}', 0)
        ON CONFLICT (table_id, round_number)
        DO UPDATE SET stock_pile = $3, discard_pile = '{}', current_turn_index = 0
        """,
        table_id, round_num, stock_pile
    )

async def validate_declaration(conn: asyncpg.Connection, table_id: str, round_num: int, user_id: str) -> Tuple[bool, int, str]:
    """Validate a player's declaration. Returns (is_valid, points, message)"""
    # Get player's melds
    melds = await conn.fetchval(
        "SELECT locked_sequences FROM player_rounds WHERE table_id = $1 AND round_number = $2 AND user_id = $3",
        table_id, round_num, user_id
    )
    
    if not melds:
        return False, 0, "No melds declared"
    
    # Must have at least 2 melds with one pure sequence
    if len(melds) < 2:
        return False, 0, "Need at least 2 melds (1 pure sequence + 1 other)"
    
    has_pure_sequence = False
    for meld in melds:
        is_valid, is_pure = validate_sequence(meld)
        if is_valid and is_pure:
            has_pure_sequence = True
            break
    
    if not has_pure_sequence:
        return False, 0, "Must have at least one pure sequence"
    
    # Valid declaration = 0 points
    return True, 0, "Valid declaration!"
