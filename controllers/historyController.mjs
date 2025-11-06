// controllers/historyController.js
import { supabase } from '../db/supabaseClient.mjs';

export const getHistory = async (req, res, next) => {
    const { userId } = req.user;

    try {
        // Fetch chat history
        const { data: messages, error: messagesError } = await supabase
            .from('messages')
            .select('session_id, role, content, type, cost, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: true });

        if (messagesError) throw messagesError;

        // Group messages by session_id
        const chatSessions = messages.reduce((acc, msg) => {
            acc[msg.session_id] = acc[msg.session_id] || [];
            acc[msg.session_id].push(msg);
            return acc;
        }, {});

        // Fetch transaction history
        const { data: transactions, error: transactionsError } = await supabase
            .from('transactions')
            .select('amount, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (transactionsError) throw transactionsError;

        res.json({
            chatHistory: Object.values(chatSessions),
            transactionHistory: transactions || []
        });
    } catch (error) {
        next(error);
    }
};

export const clearHistory = async (req, res, next) => {
    const { userId } = req.user;

    try {
        const { error } = await supabase
            .from('messages')
            .delete()
            .eq('user_id', userId);

        if (error) throw error;

        res.status(200).json({ message: 'Chat history cleared successfully.' });
    } catch (error) {
        next(error);
    }
};