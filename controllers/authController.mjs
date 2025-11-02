import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db/database.mjs';

// --- Utility Functions ---

const generateToken = (id) => {
    // SECURITY: Use a strong, secret key from environment variables.
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });
};

// --- Controller Functions ---

/**
 * Register a new user.
 */
export const register = (req, res, next) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Please provide email and password' });
    }
    
    // SECURITY: Validate email format and password strength
    if (password.length < 8) {
        return res.status(400).json({ message: 'Password must be at least 8 characters long' });
    }

    try {
        const findUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        if (findUser) {
            return res.status(409).json({ message: 'User with this email already exists' });
        }

        const salt = bcrypt.genSaltSync(10);
        const password_hash = bcrypt.hashSync(password, salt);
        
        // New users get 500 cents ($5.00) by default
        const stmt = db.prepare('INSERT INTO users (email, password_hash, credits) VALUES (?, ?, ?)');
        const info = stmt.run(email, password_hash, 500);

        res.status(201).json({
            message: 'User registered successfully',
            token: generateToken(info.lastInsertRowid),
            user: {
                id: info.lastInsertRowid,
                email: email,
                credits: 500
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Authenticate a user and return a JWT.
 */
export const login = (req, res, next) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Please provide email and password' });
    }

    try {
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

        if (user && bcrypt.compareSync(password, user.password_hash)) {
            res.json({
                message: 'Login successful',
                token: generateToken(user.id),
                user: {
                    id: user.id,
                    email: user.email,
                    credits: user.credits
                }
            });
        } else {
            // SECURITY: Use a generic message to prevent user enumeration attacks.
            res.status(401).json({ message: 'Invalid credentials' });
        }
    } catch (error) {
        next(error);
    }
};

/**
 * Get the profile of the currently authenticated user.
 */
export const getProfile = (req, res, next) => {
    try {
        // The user object is attached to the request by the `protect` middleware
        const user = db.prepare('SELECT id, email, credits FROM users WHERE id = ?').get(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        next(error);
    }
};
