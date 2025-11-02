import db from '../db/database.mjs';

/**
 * Get all chat messages and transactions for the authenticated user.
 */
export const getHistory = (req, res, next) => {
    const { userId } = req.user;

    try {
        // Fetch chat history, grouped by session
        const messages = db.prepare(`
            SELECT session_id, role, content, type, cost, created_at 
            FROM messages 
            WHERE user_id = ? 
            ORDER BY created_at ASC
        `).all(userId);

        // Group messages by session_id
        const chatSessions = messages.reduce((acc, msg) => {
            acc[msg.session_id] = acc[msg.session_id] || [];
            acc[msg.session_id].push(msg);
            return acc;
        }, {});

        // Fetch transaction history
        const transactions = db.prepare(`
            SELECT amount, created_at 
            FROM transactions 
            WHERE user_id = ? 
            ORDER BY created_at DESC
        `).all(userId);

        res.json({
            chatHistory: Object.values(chatSessions), // Return as an array of sessions
            transactionHistory: transactions
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Clear all chat messages for the authenticated user.
 */
export const clearHistory = (req, res, next) => {
    const { userId } = req.user;

    try {
        db.prepare('DELETE FROM messages WHERE user_id = ?').run(userId);
        res.status(200).json({ message: 'Chat history cleared successfully.' });
    } catch (error) {
        next(error);
    }
};
