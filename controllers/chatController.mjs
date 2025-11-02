import db from '../db/database.mjs';
import { getGeminiResponse } from '../services/geminiService.mjs';

// Define costs in cents
const GENERAL_CHAT_COST = 5; // $0.05
const DIAGNOSIS_COST = 50; // $0.50

/**
 * Handles chat interactions, deducts credits, and saves conversation history.
 */
export const handleChat = async (req, res, next) => {
    const { userId } = req.user;
    const { message, history, type, sessionId } = req.body; // type can be 'general' or 'diagnosis'

    if (!message || !type || !sessionId) {
        return res.status(400).json({ message: 'Message, type, and sessionId are required.' });
    }

    const cost = type === 'diagnosis' ? DIAGNOSIS_COST : GENERAL_CHAT_COST;

    const transact = db.transaction(() => {
        const user = db.prepare('SELECT credits FROM users WHERE id = ?').get(userId);

        if (!user) {
            throw new Error('User not found'); // This should ideally not happen if protect middleware is working
        }

        if (user.credits < cost) {
            throw new Error('Insufficient credits');
        }

        // Deduct credits
        db.prepare('UPDATE users SET credits = credits - ? WHERE id = ?').run(cost, userId);

        // Save user's message to history
        db.prepare(
            'INSERT INTO messages (user_id, session_id, role, content, type, cost) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(userId, sessionId, 'user', message, type, 0); // User message has no cost itself

        return db.prepare('SELECT credits FROM users WHERE id = ?').get(userId).credits;
    });

    try {
        // Run the transaction to check and deduct credits
        const updatedCredits = transact();

        // If transaction is successful, get response from AI
        const modelResponse = await getGeminiResponse(message, history, type);
        
        // Save AI's response to history
        db.prepare(
            'INSERT INTO messages (user_id, session_id, role, content, type, cost) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(userId, sessionId, 'model', modelResponse, type, cost);

        res.json({
            reply: modelResponse,
            newBalance: updatedCredits
        });

    } catch (error) {
        if (error.message === 'Insufficient credits') {
            return res.status(402).json({ message: 'Insufficient credits. Please top up your account.' });
        }
        if (error.message === 'User not found') {
            return res.status(404).json({ message: 'User not found.' });
        }
        next(error);
    }
};
