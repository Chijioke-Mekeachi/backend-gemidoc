// controllers/chatController.js
import { supabase } from '../db/supabaseClient.mjs';
import { getGeminiResponse } from '../services/geminiService.mjs';

const GENERAL_CHAT_COST = 5;
const DIAGNOSIS_COST = 50;

export const handleChat = async (req, res, next) => {
    const { userId } = req.user;
    const { message, history, type, sessionId } = req.body;

    if (!message || !type || !sessionId) {
        return res.status(400).json({ message: 'Message, type, and sessionId are required.' });
    }

    const cost = type === 'diagnosis' ? DIAGNOSIS_COST : GENERAL_CHAT_COST;

    try {
        // Start a transaction using Supabase's transaction capability
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('credits')
            .eq('id', userId)
            .single();

        if (userError || !user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.credits < cost) {
            return res.status(402).json({ message: 'Insufficient credits. Please top up your account.' });
        }

        // Deduct credits
        const { data: updatedUser, error: updateError } = await supabase
            .from('users')
            .update({ credits: user.credits - cost })
            .eq('id', userId)
            .select()
            .single();

        if (updateError) throw updateError;

        // Save user's message
        const { error: messageError } = await supabase
            .from('messages')
            .insert([
                {
                    user_id: userId,
                    session_id: sessionId,
                    role: 'user',
                    content: message,
                    type: type,
                    cost: 0
                }
            ]);

        if (messageError) throw messageError;

        // Get AI response
        const modelResponse = await getGeminiResponse(message, history, type);
        
        // Save AI response
        const { error: aiMessageError } = await supabase
            .from('messages')
            .insert([
                {
                    user_id: userId,
                    session_id: sessionId,
                    role: 'model',
                    content: modelResponse,
                    type: type,
                    cost: cost
                }
            ]);

        if (aiMessageError) throw aiMessageError;

        res.json({
            reply: modelResponse,
            newBalance: updatedUser.credits
        });

    } catch (error) {
        next(error);
    }
};