import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import asyncpg
from app.auth import AuthorizedUser

router = APIRouter()

# Database connection helper
async def get_db_connection():
    """Create and return a database connection."""
    return await asyncpg.connect(os.environ.get("DATABASE_URL"))

# Pydantic models
class SendMessageRequest(BaseModel):
    """Request to send a chat message."""
    table_id: str
    message: str
    is_private: bool = False
    recipient_id: str | None = None

class ChatMessage(BaseModel):
    """Chat message response."""
    id: int
    table_id: str
    user_id: str
    sender_name: str
    message: str
    is_private: bool
    recipient_id: str | None
    created_at: str

class GetMessagesParams(BaseModel):
    """Parameters for retrieving chat messages."""
    table_id: str
    limit: int = 100
    before_id: int | None = None  # For pagination

class GetMessagesResponse(BaseModel):
    """Response containing chat messages."""
    messages: list[ChatMessage]
    has_more: bool

@router.post("/chat/send")
async def send_message(body: SendMessageRequest, user: AuthorizedUser) -> ChatMessage:
    """
    Send a chat message (public or private).
    
    - Public messages are visible to all players at the table
    - Private messages are only visible to sender and recipient
    """
    conn = await get_db_connection()
    try:
        # Verify user is part of the table
        player = await conn.fetchrow(
            """
            SELECT display_name FROM rummy_table_players 
            WHERE table_id = $1 AND user_id = $2
            """,
            body.table_id,
            user.sub
        )
        
        if not player:
            raise HTTPException(status_code=403, detail="You are not part of this table")
        
        # If private message, verify recipient exists at table
        if body.is_private and body.recipient_id:
            recipient = await conn.fetchrow(
                """
                SELECT user_id FROM rummy_table_players 
                WHERE table_id = $1 AND user_id = $2
                """,
                body.table_id,
                body.recipient_id
            )
            
            if not recipient:
                raise HTTPException(status_code=400, detail="Recipient is not part of this table")
        
        # Insert message
        row = await conn.fetchrow(
            """
            INSERT INTO chat_messages (table_id, user_id, message, is_private, recipient_id)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, table_id, user_id, message, is_private, recipient_id, created_at
            """,
            body.table_id,
            user.sub,
            body.message,
            body.is_private,
            body.recipient_id
        )
        
        return ChatMessage(
            id=row["id"],
            table_id=row["table_id"],
            user_id=row["user_id"],
            sender_name=player["display_name"] or "Anonymous",
            message=row["message"],
            is_private=row["is_private"],
            recipient_id=row["recipient_id"],
            created_at=row["created_at"].isoformat()
        )
    finally:
        await conn.close()

@router.get("/chat/messages")
async def get_messages(table_id: str, limit: int = 100, before_id: int | None = None, user: AuthorizedUser = None) -> GetMessagesResponse:
    """
    Retrieve chat messages for a table.
    
    Returns public messages and private messages where user is sender or recipient.
    Supports pagination with before_id parameter.
    """
    conn = await get_db_connection()
    try:
        # Verify user is part of the table
        player = await conn.fetchrow(
            """
            SELECT user_id FROM rummy_table_players 
            WHERE table_id = $1 AND user_id = $2
            """,
            table_id,
            user.sub
        )
        
        if not player:
            raise HTTPException(status_code=403, detail="You are not part of this table")
        
        # Build query for messages
        # Get public messages OR private messages where user is sender or recipient
        query = """
            SELECT 
                cm.id, cm.table_id, cm.user_id, cm.message, 
                cm.is_private, cm.recipient_id, cm.created_at,
                rtp.display_name as sender_name
            FROM chat_messages cm
            JOIN rummy_table_players rtp ON cm.table_id = rtp.table_id AND cm.user_id = rtp.user_id
            WHERE cm.table_id = $1
                AND (
                    cm.is_private = FALSE 
                    OR cm.user_id = $2 
                    OR cm.recipient_id = $2
                )
        """
        
        params = [table_id, user.sub]
        
        # Add pagination
        if before_id:
            query += " AND cm.id < $3"
            params.append(before_id)
        
        query += " ORDER BY cm.created_at DESC, cm.id DESC LIMIT $" + str(len(params) + 1)
        params.append(limit + 1)  # Fetch one extra to check if there are more
        
        rows = await conn.fetch(query, *params)
        
        # Check if there are more messages
        has_more = len(rows) > limit
        messages_data = rows[:limit] if has_more else rows
        
        messages = [
            ChatMessage(
                id=row["id"],
                table_id=row["table_id"],
                user_id=row["user_id"],
                sender_name=row["sender_name"] or "Anonymous",
                message=row["message"],
                is_private=row["is_private"],
                recipient_id=row["recipient_id"],
                created_at=row["created_at"].isoformat()
            )
            for row in messages_data
        ]
        
        # Reverse to get chronological order (oldest first)
        messages.reverse()
        
        return GetMessagesResponse(
            messages=messages,
            has_more=has_more
        )
    finally:
        await conn.close()
