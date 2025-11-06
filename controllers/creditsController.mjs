// controllers/creditsController.mjs
import { supabase } from '../db/supabaseClient.mjs';
import paystackService from '../services/paystackService.mjs';

/**
 * Get the current user's credit balance
 */
export const getBalance = async (req, res, next) => {
    try {
        const { userId } = req.user;
        const { data: user, error } = await supabase
            .from('users')
            .select('credits, subscription_ends_at')
            .eq('id', userId)
            .single();
        
        if (error || !user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({ 
            credits: user.credits,
            subscription_ends_at: user.subscription_ends_at,
            has_active_subscription: user.subscription_ends_at && new Date(user.subscription_ends_at) > new Date()
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Calculate credits based on amount (for one-time purchases)
 */
const calculateCreditsFromAmount = (amountInCents) => {
    const amount = amountInCents / 100; // Convert to dollars
    
    const creditMap = {
        5: 50,   // $5 = 50 credits
        15: 120, // $15 = 120 credits
        25: 260  // $25 = 260 credits
    };

    return creditMap[amount] || Math.floor(amount * 10); // Fallback: 10 credits per dollar
};

/**
 * Calculate subscription duration and credits
 */
const calculateSubscriptionDetails = (amountInCents) => {
    const amountUSD = amountInCents / 100;
    
    const subscriptionMap = {
        5: { 
            duration_months: 1, 
            credits: 50,
            type: 'basic',
            minNGN: 4000,
            maxNGN: 6000
        },
        15: { 
            duration_months: 1, 
            credits: 120,
            type: 'standard',
            minNGN: 12000,
            maxNGN: 18000
        },
        25: { 
            duration_months: 1, 
            credits: 260,
            type: 'premium',
            minNGN: 20000,
            maxNGN: 30000
        }
    };

    return subscriptionMap[amountUSD] || { 
        duration_months: 1, 
        credits: Math.floor(amountUSD * 10),
        type: 'custom'
    };
};

/**
 * Verify Paystack payment and add credits/subscription
 */
export const verifyPayment = async (req, res, next) => {
    const { userId } = req.user;
    const { reference, amount } = req.body;

    console.log('=== PAYMENT VERIFICATION START ===');
    console.log('User ID:', userId);
    console.log('Reference:', reference);
    console.log('Expected amount (USD cents):', amount);

    if (!reference || !amount) {
        console.log('Missing reference or amount');
        return res.status(400).json({ 
            message: 'Reference and amount are required' 
        });
    }

    const allowedAmounts = [500, 1500, 2500];
    if (!allowedAmounts.includes(amount)) {
        console.log('Invalid amount received:', amount);
        return res.status(400).json({ 
            message: `Invalid payment amount. Expected one of: ${allowedAmounts.join(', ')}` 
        });
    }

    try {
        // First, get the current user to know their existing credits
        const { data: currentUser, error: userError } = await supabase
            .from('users')
            .select('credits')
            .eq('id', userId)
            .single();

        if (userError || !currentUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if payment already processed
        const { data: existingPayment, error: checkError } = await supabase
            .from('transactions')
            .select('id')
            .eq('reference', reference)
            .eq('status', 'completed')
            .single();

        if (existingPayment) {
            console.log('Payment already processed');
            return res.status(409).json({ 
                message: 'This payment has already been processed' 
            });
        }

        // Verify payment with Paystack
        console.log('Verifying with Paystack...');
        const verification = await paystackService.verifyTransaction(reference);
        console.log('Paystack verification response:', verification);
        
        if (!verification.status || verification.data.status !== 'success') {
            console.log('Paystack verification failed:', verification);
            
            // Log failed transaction
            await supabase
                .from('transactions')
                .insert([
                    {
                        user_id: userId,
                        amount: amount,
                        reference: reference,
                        status: 'failed',
                        error_message: 'Paystack verification failed'
                    }
                ]);

            return res.status(402).json({ 
                message: 'Payment verification failed. Please try again or contact support.' 
            });
        }

        // Check if payment amount matches
        const paidAmountNGN = verification.data.amount;
        const paidAmountUSD = paidAmountNGN / 1000;
        const expectedAmountUSD = amount / 100;
        
        console.log('Amount check:');
        console.log('Paid (NGN):', paidAmountNGN);
        console.log('Paid (USD approx):', paidAmountUSD);
        console.log('Expected (USD):', expectedAmountUSD);

        const amountTolerance = 0.8;
        const minExpectedUSD = expectedAmountUSD * amountTolerance;
        
        if (paidAmountUSD < minExpectedUSD) {
            console.log('Amount mismatch - too low');
            
            // Log failed transaction
            await supabase
                .from('transactions')
                .insert([
                    {
                        user_id: userId,
                        amount: amount,
                        reference: reference,
                        status: 'failed',
                        error_message: 'Payment amount is lower than expected'
                    }
                ]);

            return res.status(400).json({ 
                message: 'Payment amount does not match expected amount.' 
            });
        }

        const subscriptionDetails = calculateSubscriptionDetails(amount);
        const creditsToAdd = subscriptionDetails.credits;
        
        // Calculate new total credits by ADDING to existing credits
        const newTotalCredits = currentUser.credits + creditsToAdd;
        
        const subscriptionEndsAt = new Date();
        subscriptionEndsAt.setMonth(subscriptionEndsAt.getMonth() + subscriptionDetails.duration_months);

        console.log('Credit calculation:', {
            existingCredits: currentUser.credits,
            creditsToAdd: creditsToAdd,
            newTotalCredits: newTotalCredits,
            subscriptionEndsAt,
            subscriptionType: subscriptionDetails.type
        });

        // Update user credits and subscription - ADD credits instead of replacing
        const { data: updatedUser, error: updateError } = await supabase
            .from('users')
            .update({ 
                credits: newTotalCredits, // This is the existing + new credits
                subscription_ends_at: subscriptionEndsAt.toISOString(),
                subscription_type: subscriptionDetails.type,
                updated_at: new Date().toISOString()
            })
            .eq('id', userId)
            .select()
            .single();

        if (updateError) throw updateError;

        // Log the transaction
        const { error: transactionError } = await supabase
            .from('transactions')
            .insert([
                {
                    user_id: userId,
                    amount: amount,
                    credits: creditsToAdd,
                    reference: reference,
                    status: 'completed',
                    type: 'subscription',
                    subscription_type: subscriptionDetails.type,
                    subscription_ends_at: subscriptionEndsAt.toISOString()
                }
            ]);

        if (transactionError) throw transactionError;

        const result = {
            newBalance: updatedUser.credits,
            creditsAdded: creditsToAdd,
            subscription_ends_at: updatedUser.subscription_ends_at,
            subscription_type: updatedUser.subscription_type,
            has_active_subscription: new Date(updatedUser.subscription_ends_at) > new Date()
        };

        console.log('=== PAYMENT VERIFICATION SUCCESS ===');
        console.log('Result:', result);
        
        res.json({
            message: 'Payment verified successfully! Credits and subscription added.',
            ...result
        });

    } catch (error) {
        console.error('Payment processing error:', error);
        
        // Log failed transaction
        try {
            await supabase
                .from('transactions')
                .insert([
                    {
                        user_id: userId,
                        amount: amount,
                        reference: reference,
                        status: 'failed',
                        error_message: error.message
                    }
                ]);
        } catch (dbError) {
            console.error('Failed to log transaction:', dbError);
        }

        if (error.message.includes('already processed')) {
            return res.status(409).json({ 
                message: 'This payment has already been processed' 
            });
        }
        
        if (error.message.includes('verification failed') || error.message.includes('Failed to verify transaction')) {
            return res.status(402).json({ 
                message: 'Payment verification failed. Please try again or contact support.' 
            });
        }

        if (error.message.includes('amount mismatch') || error.message.includes('lower than expected')) {
            return res.status(400).json({ 
                message: 'Payment amount does not match expected amount.' 
            });
        }

        res.status(500).json({ 
            message: 'Payment processing failed: ' + error.message 
        });
    }
};

/**
 * Get user's transaction history
 */
export const getTransactionHistory = async (req, res, next) => {
    try {
        const { userId } = req.user;
        const { limit = 10, offset = 0 } = req.query;

        const { data: transactions, error } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

        if (error) throw error;

        const { count, error: countError } = await supabase
            .from('transactions')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);

        if (countError) throw countError;

        res.json({
            transactions: transactions || [],
            pagination: {
                total: count,
                limit: parseInt(limit),
                offset: parseInt(offset)
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get subscription status
 */
export const getSubscriptionStatus = async (req, res, next) => {
    try {
        const { userId } = req.user;
        
        const { data: user, error } = await supabase
            .from('users')
            .select('subscription_ends_at, subscription_type, credits')
            .eq('id', userId)
            .single();

        if (error || !user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const now = new Date();
        const subscriptionEndsAt = user.subscription_ends_at ? new Date(user.subscription_ends_at) : null;
        
        const status = {
            has_active_subscription: subscriptionEndsAt && subscriptionEndsAt > now,
            subscription_ends_at: user.subscription_ends_at,
            subscription_type: user.subscription_type,
            days_remaining: subscriptionEndsAt && subscriptionEndsAt > now 
                ? Math.ceil((subscriptionEndsAt - now) / (1000 * 60 * 60 * 24))
                : 0,
            credits: user.credits
        };

        res.json(status);
    } catch (error) {
        next(error);
    }
};