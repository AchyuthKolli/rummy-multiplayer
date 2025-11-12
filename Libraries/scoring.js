



# Simple Rummy scoring utilities
# Points: Face cards (J,Q,K,A)=10, 2-10 face value, jokers=0. Cap per hand: 80.
from __future__ import annotations
from typing import List, Dict, Tuple, Optional, Union

# Card dict shape: {rank: str, suit: str | None, joker: bool}
# Can also be Pydantic models with rank, suit, joker attributes

RANK_POINTS = {
    "A": 10,  # Default, can be overridden
    "K": 10,
    "Q": 10,
    "J": 10,
    "10": 10,
    "9": 9,
    "8": 8,
    "7": 7,
    "6": 6,
    "5": 5,
    "4": 4,
    "3": 3,
    "2": 2,
}

RANK_ORDER = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]


def _get_card_attr(card: Union[dict, object], attr: str, default=None):
    """Get attribute from card whether it's a dict or Pydantic model."""
    if isinstance(card, dict):
        return card.get(attr, default)
    return getattr(card, attr, default)


def _is_joker_card(card: dict | tuple, wild_joker_rank: str | None, has_wild_joker_revealed: bool = True) -> bool:
    """Check if a card is a joker (printed or wild).
    
    Args:
        card: Card as dict or tuple
        wild_joker_rank: The rank that acts as wild joker
        has_wild_joker_revealed: Whether wild joker is revealed to this player
    
    Returns:
        True if card is a joker (printed joker or matches wild joker rank IF revealed)
    """
    rank = _get_card_attr(card, "rank")
    
    # Printed jokers are always jokers
    if rank == "JOKER":
        return True
    
    # Wild joker cards only act as jokers if revealed
    if has_wild_joker_revealed and wild_joker_rank and rank == wild_joker_rank:
        return True
    
    return False


def card_points(card: Union[dict, object], ace_value: int = 10) -> int:
    """Calculate points for a single card.
    
    Args:
        card: Card as dict or Pydantic model
        ace_value: Point value for Aces (1 or 10)
    """
    if _get_card_attr(card, "joker"):
        return 0
    rank = _get_card_attr(card, "rank")
    if rank == "A":
        return ace_value
    return RANK_POINTS.get(rank, 0)


def naive_hand_points(hand: List[Union[dict, object]]) -> int:
    # Naive pre-validation: full sum capped to 80
    total = sum(card_points(c) for c in hand)
    return min(total, 80)


def is_sequence(
    cards: list[dict | tuple], 
    wild_joker_rank: str | None = None,
    has_wild_joker_revealed: bool = True
) -> bool:
    """Check if cards form a valid sequence (consecutive ranks, same suit)."""
    if len(cards) < 3:
        return False
    
    # All cards must have the same suit (excluding jokers)
    suits = [_get_card_attr(c, "suit") for c in cards if not _is_joker_card(c, wild_joker_rank, has_wild_joker_revealed)]
    if not suits or len(set(suits)) > 1:
        return False
    
    # Get non-joker cards
    joker_count = sum(1 for c in cards if _is_joker_card(c, wild_joker_rank, has_wild_joker_revealed))
    non_jokers = [c for c in cards if not _is_joker_card(c, wild_joker_rank, has_wild_joker_revealed)]
    
    if len(non_jokers) < 2:
        return False
    
    # Get rank indices for non-joker cards
    rank_indices = sorted([RANK_ORDER.index(_get_card_attr(c, "rank")) for c in non_jokers])
    
    # Check for normal consecutive sequence
    first_idx = rank_indices[0]
    last_idx = rank_indices[-1]
    required_span = last_idx - first_idx + 1
    
    if required_span <= len(cards):
        return True
    
    # Check for wrap-around sequence (Ace can be high: Q-K-A or K-A-2)
    # If we have an Ace (index 0) and high cards (J, Q, K at indices 10, 11, 12)
    if 0 in rank_indices and any(idx >= 10 for idx in rank_indices):
        # Try treating Ace as high (after King)
        # Create alternate indices where Ace = 13
        alt_indices = [idx if idx != 0 else 13 for idx in rank_indices]
        alt_indices.sort()
        alt_span = alt_indices[-1] - alt_indices[0] + 1
        
        if alt_span <= len(cards):
            return True
    
    return False


def is_pure_sequence(
    cards: list[dict | tuple], 
    wild_joker_rank: str | None = None,
    has_wild_joker_revealed: bool = True
) -> bool:
    """Check if cards form a pure sequence (no jokers as substitutes).
    
    Wild joker cards in their natural position (same suit, consecutive rank) are allowed.
    Only reject if wild joker is used as a substitute.
    """
    if not is_sequence(cards, wild_joker_rank, has_wild_joker_revealed):
        return False
    
    # Check for printed jokers (always impure)
    if any(_get_card_attr(c, "rank") == "JOKER" for c in cards):
        return False
    
    # If wild joker not revealed, all cards are treated as natural
    if not has_wild_joker_revealed or not wild_joker_rank:
        return True
    
    # Check if any wild joker cards are used as substitutes (not in natural position)
    suit = None
    for c in cards:
        c_suit = _get_card_attr(c, "suit")
        if suit is None:
            suit = c_suit
        # All cards must have same suit for a sequence
        if c_suit != suit:
            return False
    
    # Get rank indices for all cards
    rank_indices = []
    for c in cards:
        rank = _get_card_attr(c, "rank")
        if rank in RANK_ORDER:
            rank_indices.append(RANK_ORDER.index(rank))
    
    if len(rank_indices) != len(cards):
        return False
    
    rank_indices.sort()
    
    # Check if this is a consecutive sequence
    is_consecutive = all(
        rank_indices[i+1] - rank_indices[i] == 1 
        for i in range(len(rank_indices) - 1)
    )
    
    # Check for wrap-around (Q-K-A or K-A-2)
    is_wraparound = False
    if 0 in rank_indices and any(idx >= 10 for idx in rank_indices):
        alt_indices = [idx if idx != 0 else 13 for idx in rank_indices]
        alt_indices.sort()
        is_wraparound = all(
            alt_indices[i+1] - alt_indices[i] == 1 
            for i in range(len(alt_indices) - 1)
        )
    
    # If cards form a natural consecutive sequence, all wild jokers are in natural positions
    if is_consecutive or is_wraparound:
        return True
    
    # Otherwise, sequence has gaps - must be using wild jokers as substitutes
    return False


def is_set(
    cards: list[dict | tuple], 
    wild_joker_rank: str | None = None,
    has_wild_joker_revealed: bool = True
) -> bool:
    """Check if cards form a valid set (3-4 cards of same rank, different suits)."""
    if len(cards) < 3 or len(cards) > 4:
        return False
    
    # All non-joker cards must have the same rank
    ranks = [_get_card_attr(c, "rank") for c in cards if not _is_joker_card(c, wild_joker_rank, has_wild_joker_revealed)]
    if not ranks or len(set(ranks)) > 1:
        return False
    
    # All non-joker cards must have different suits
    suits = [_get_card_attr(c, "suit") for c in cards if not _is_joker_card(c, wild_joker_rank, has_wild_joker_revealed) and _get_card_attr(c, "suit")]
    if len(suits) != len(set(suits)):
        return False
    
    return True


def validate_hand(
    melds: list[list[dict | tuple]], 
    leftover: list[dict | tuple],
    wild_joker_rank: str | None = None,
    has_wild_joker_revealed: bool = True
) -> dict:
    """Validate a complete 13-card hand declaration."""
    # After drawing, player has 14 cards. They organize 13 into melds and discard the 14th.
    # So we don't check hand length, only that melds contain exactly 13 cards.
    
    if not melds:
        return False, "No meld groups provided"
    
    # Check total cards in groups equals 13
    total_cards = sum(len(g) for g in melds)
    if total_cards != 13:
        return False, f"Meld groups must contain exactly 13 cards, found {total_cards}"
    
    # Check for at least one pure sequence
    has_pure_sequence = False
    valid_sequences = 0
    valid_sets = 0
    
    for group in melds:
        if len(group) < 3:
            return False, f"Each meld must have at least 3 cards, found {len(group)}"
        
        is_seq = is_sequence(group, wild_joker_rank, has_wild_joker_revealed)
        is_pure_seq = is_pure_sequence(group, wild_joker_rank, has_wild_joker_revealed)
        is_valid_set = is_set(group, wild_joker_rank, has_wild_joker_revealed)
        
        if is_pure_seq:
            has_pure_sequence = True
            valid_sequences += 1
        elif is_seq:
            valid_sequences += 1
        elif is_valid_set:
            valid_sets += 1
        else:
            cards_str = ', '.join([f"{_get_card_attr(c, 'rank')}{_get_card_attr(c, 'suit') or ''}" for c in group])
            return False, f"Invalid meld: [{cards_str}] is neither a valid sequence nor set"
    
    if not has_pure_sequence:
        return False, "Must have at least one pure sequence (no jokers)"
    
    if len(melds) < 2:
        return False, "Must have at least 2 melds"
    
    return True, "Valid hand"


def calculate_deadwood_points(
    cards: list[dict | tuple],
    wild_joker_rank: str | None = None,
    has_wild_joker_revealed: bool = True,
    ace_value: int = 10
) -> int:
    """Calculate points for ungrouped/invalid cards.
    
    Args:
        cards: List of cards
        wild_joker_rank: The rank that acts as wild joker
        has_wild_joker_revealed: Whether wild joker is revealed
        ace_value: Point value for Aces (1 or 10)
    """
    total = 0
    for card in cards:
        if _is_joker_card(card, wild_joker_rank, has_wild_joker_revealed):
            total += 0  # Jokers are worth 0
        else:
            total += card_points(card, ace_value)
    return min(total, 80)


def auto_organize_hand(
    hand: list[dict | tuple],
    wild_joker_rank: str | None = None,
    has_wild_joker_revealed: bool = True
) -> tuple[list[list[dict | tuple]], list[dict | tuple]]:
    """
    Automatically organize a hand into best possible melds and leftover cards.
    Used for scoring opponents when someone declares.
    
    Returns:
        (melds, leftover_cards)
    """
    if not hand or len(hand) == 0:
        return [], []
    
    remaining = list(hand)
    melds = []
    
    # Helper to try forming sequences
    def try_form_sequence(cards_pool: list) -> list | None:
        """Try to find a valid sequence from cards pool."""
        for i in range(len(cards_pool)):
            for j in range(i + 1, len(cards_pool)):
                for k in range(j + 1, len(cards_pool)):
                    group = [cards_pool[i], cards_pool[j], cards_pool[k]]
                    if is_sequence(group, wild_joker_rank, has_wild_joker_revealed):
                        # Try to extend to 4 cards
                        for m in range(len(cards_pool)):
                            if m not in [i, j, k]:
                                extended = group + [cards_pool[m]]
                                if is_sequence(extended, wild_joker_rank, has_wild_joker_revealed):
                                    return extended
                        return group
        return None
    
    # Helper to try forming sets
    def try_form_set(cards_pool: list) -> list | None:
        """Try to find a valid set from cards pool."""
        for i in range(len(cards_pool)):
            for j in range(i + 1, len(cards_pool)):
                for k in range(j + 1, len(cards_pool)):
                    group = [cards_pool[i], cards_pool[j], cards_pool[k]]
                    if is_set(group, wild_joker_rank, has_wild_joker_revealed):
                        # Try to extend to 4 cards
                        for m in range(len(cards_pool)):
                            if m not in [i, j, k]:
                                extended = group + [cards_pool[m]]
                                if is_set(extended, wild_joker_rank, has_wild_joker_revealed):
                                    return extended
                        return group
        return None
    
    # First pass: try to form pure sequences (highest priority)
    while True:
        seq = try_form_sequence(remaining)
        if seq and is_pure_sequence(seq, wild_joker_rank, has_wild_joker_revealed):
            melds.append(seq)
            for card in seq:
                remaining.remove(card)
        else:
            break
    
    # Second pass: form any sequences
    while True:
        seq = try_form_sequence(remaining)
        if seq:
            melds.append(seq)
            for card in seq:
                remaining.remove(card)
        else:
            break
    
    # Third pass: form sets
    while True:
        set_group = try_form_set(remaining)
        if set_group:
            melds.append(set_group)
            for card in set_group:
                remaining.remove(card)
        else:
            break
    
    return melds, remaining


def organize_hand_by_melds(hand: List[Union[dict, object]]) -> Dict[str, List[List[Union[dict, object]]]]:
    """
    Organize a hand into meld groups for display.
    Returns cards grouped by meld type for easy verification.
    
    Returns:
        {
            'pure_sequences': [[card, card, card], ...],
            'impure_sequences': [[card, card, card], ...],
            'sets': [[card, card, card], ...],
            'ungrouped': [card, card, ...]
        }
    """
    if not hand:
        return {
            'pure_sequences': [],
            'impure_sequences': [],
            'sets': [],
            'ungrouped': []
        }
    
    remaining_cards = list(hand)
    pure_seqs = []
    impure_seqs = []
    sets_list = []
    
    # Helper to find best meld of specific type
    def find_meld_of_type(cards: List, meld_type: str) -> Optional[List]:
        if len(cards) < 3:
            return None
        
        # Try all combinations of 3 and 4 cards
        for size in [4, 3]:  # Try 4-card melds first
            if len(cards) < size:
                continue
            for i in range(len(cards) - size + 1):
                group = cards[i:i+size]
                if meld_type == 'pure_seq' and is_pure_sequence(group):
                    return group
                elif meld_type == 'impure_seq' and is_sequence(group) and not is_pure_sequence(group):
                    return group
                elif meld_type == 'set' and is_set(group):
                    return group
        
        # Try all combinations (not just consecutive)
        from itertools import combinations
        for size in [4, 3]:
            if len(cards) < size:
                continue
            for combo in combinations(range(len(cards)), size):
                group = [cards[idx] for idx in combo]
                if meld_type == 'pure_seq' and is_pure_sequence(group):
                    return group
                elif meld_type == 'impure_seq' and is_sequence(group) and not is_pure_sequence(group):
                    return group
                elif meld_type == 'set' and is_set(group):
                    return group
        
        return None
    
    # 1. Find pure sequences first (highest priority)
    while len(remaining_cards) >= 3:
        meld = find_meld_of_type(remaining_cards, 'pure_seq')
        if not meld:
            break
        pure_seqs.append(meld)
        for card in meld:
            remaining_cards.remove(card)
    
    # 2. Find impure sequences
    while len(remaining_cards) >= 3:
        meld = find_meld_of_type(remaining_cards, 'impure_seq')
        if not meld:
            break
        impure_seqs.append(meld)
        for card in meld:
            remaining_cards.remove(card)
    
    # 3. Find sets
    while len(remaining_cards) >= 3:
        meld = find_meld_of_type(remaining_cards, 'set')
        if not meld:
            break
        sets_list.append(meld)
        for card in meld:
            remaining_cards.remove(card)
    
    return {
        'pure_sequences': pure_seqs,
        'impure_sequences': impure_seqs,
        'sets': sets_list,
        'ungrouped': remaining_cards
    }
