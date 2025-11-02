import db from '../db/database.mjs';
import paystackService from '../services/paystackService.mjs';

/**
 * Get the current user's credit balance
 */
export const getBalance = (req, res, next) => {
    try {
        const { userId } = req.user;
        const user = db.prepare('SELECT credits, subscription_ends_at FROM users WHERE id = ?').get(userId);
        
        if (!user) {
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
// In your creditsController.mjs - Update calculateSubscriptionDetails

const calculateSubscriptionDetails = (amountInCents) => {
    // Since frontend sends USD amounts but we're using NGN, adjust the mapping
    const amountUSD = amountInCents / 100;
    
    const subscriptionMap = {
        5: { 
            duration_months: 1, 
            credits: 50,
            type: 'basic',
            minNGN: 4000,  // Minimum NGN amount for $5 package
            maxNGN: 6000   // Maximum NGN amount for $5 package
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
// controllers/creditsController.mjs - Update verifyPayment function

// controllers/creditsController.mjs - Fix the verifyPayment function

export const verifyPayment = async (req, res, next) => {
    const { userId } = req.user;
    const { reference, amount } = req.body;

    console.log('=== PAYMENT VERIFICATION START ===');
    console.log('User ID:', userId);
    console.log('Reference:', reference);
    console.log('Expected amount (USD cents):', amount);
    console.log('Expected amount (USD):', amount / 100);

    if (!reference || !amount) {
        console.log('Missing reference or amount');
        return res.status(400).json({ 
            message: 'Reference and amount are required' 
        });
    }

    // Since frontend is using NGN, adjust validation
    const allowedAmounts = [500, 1500, 2500]; // $5, $15, $25 in cents
    if (!allowedAmounts.includes(amount)) {
        console.log('Invalid amount received:', amount);
        return res.status(400).json({ 
            message: `Invalid payment amount. Expected one of: ${allowedAmounts.join(', ')}` 
        });
    }

    // Use async transaction or handle it differently since better-sqlite3 transactions are synchronous
    try {
        // Check if payment already processed
        const existingPayment = db.prepare(`
            SELECT id FROM transactions WHERE reference = ? AND status = 'completed'
        `).get(reference);

        if (existingPayment) {
            console.log('Payment already processed');
            return res.status(409).json({ 
                message: 'This payment has already been processed' 
            });
        }

        // Verify payment with Paystack - AWAIT THIS!
        console.log('Verifying with Paystack...');
        const verification = await paystackService.verifyTransaction(reference); // ADD AWAIT
        console.log('Paystack verification response:', verification);
        
        if (!verification.status || verification.data.status !== 'success') {
            console.log('Paystack verification failed:', verification);
            
            // Log failed transaction
            db.prepare(`
                INSERT INTO transactions (user_id, amount, reference, status, error_message)
                VALUES (?, ?, ?, 'failed', ?)
            `).run(userId, amount, reference, 'Paystack verification failed');
            
            return res.status(402).json({ 
                message: 'Payment verification failed. Please try again or contact support.' 
            });
        }

        // Check if payment amount matches (convert NGN to USD roughly)
        const paidAmountNGN = verification.data.amount; // ₦15,000
        const paidAmountUSD = paidAmountNGN / 1000; // Rough conversion: ₦1000 ≈ $1 = $15
        const expectedAmountUSD = amount / 100; // $15
        
        console.log('Amount check:');
        console.log('Paid (NGN):', paidAmountNGN);
        console.log('Paid (USD approx):', paidAmountUSD);
        console.log('Expected (USD):', expectedAmountUSD);

        // Since we're using NGN, we need to be flexible with amount validation
        const amountTolerance = 0.8; // 20% tolerance for currency conversion
        const minExpectedUSD = expectedAmountUSD * amountTolerance;
        
        if (paidAmountUSD < minExpectedUSD) {
            console.log('Amount mismatch - too low');
            
            // Log failed transaction
            db.prepare(`
                INSERT INTO transactions (user_id, amount, reference, status, error_message)
                VALUES (?, ?, ?, 'failed', ?)
            `).run(userId, amount, reference, 'Payment amount is lower than expected');
            
            return res.status(400).json({ 
                message: 'Payment amount does not match expected amount.' 
            });
        }

        const subscriptionDetails = calculateSubscriptionDetails(amount);
        const creditsToAdd = subscriptionDetails.credits;
        
        // Calculate subscription end date
        const subscriptionEndsAt = new Date();
        subscriptionEndsAt.setMonth(subscriptionEndsAt.getMonth() + subscriptionDetails.duration_months);

        console.log('Updating user with:', {
            creditsToAdd,
            subscriptionEndsAt,
            subscriptionType: subscriptionDetails.type
        });

        // Use transaction for the database operations
        const transact = db.transaction(() => {
            // Update user credits and subscription
            db.prepare(`
                UPDATE users 
                SET credits = credits + ?, 
                    subscription_ends_at = ?,
                    subscription_type = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(creditsToAdd, subscriptionEndsAt.toISOString(), subscriptionDetails.type, userId);

            // Log the transaction
            db.prepare(`
                INSERT INTO transactions (user_id, amount, credits, reference, status, type, subscription_type, subscription_ends_at)
                VALUES (?, ?, ?, ?, 'completed', 'subscription', ?, ?)
            `).run(userId, amount, creditsToAdd, reference, subscriptionDetails.type, subscriptionEndsAt.toISOString());
        });

        // Execute the transaction
        transact();

        // Return the new balance and subscription info
        const updatedUser = db.prepare(`
            SELECT credits, subscription_ends_at, subscription_type 
            FROM users WHERE id = ?
        `).get(userId);

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
            db.prepare(`
                INSERT INTO transactions (user_id, amount, reference, status, error_message)
                VALUES (?, ?, ?, 'failed', ?)
            `).run(userId, amount, reference, error.message);
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
export const getTransactionHistory = (req, res, next) => {
    try {
        const { userId } = req.user;
        const { limit = 10, offset = 0 } = req.query;

        const transactions = db.prepare(`
            SELECT id, amount, credits, reference, status, type, subscription_type, created_at
            FROM transactions 
            WHERE user_id = ? 
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?
        `).all(userId, limit, offset);

        const total = db.prepare(`
            SELECT COUNT(*) as count FROM transactions WHERE user_id = ?
        `).get(userId).count;

        res.json({
            transactions,
            pagination: {
                total,
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
export const getSubscriptionStatus = (req, res, next) => {
    try {
        const { userId } = req.user;
        
        const user = db.prepare(`
            SELECT subscription_ends_at, subscription_type, credits
            FROM users WHERE id = ?
        `).get(userId);

        if (!user) {
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