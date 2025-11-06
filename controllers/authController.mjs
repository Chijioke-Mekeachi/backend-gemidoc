// controllers/authController.js
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase } from '../db/supabaseClient.mjs';

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });
};

export const register = async (req, res, next) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Please provide email and password' });
    }
    
    if (password.length < 8) {
        return res.status(400).json({ message: 'Password must be at least 8 characters long' });
    }

    try {
        // Check if user exists
        const { data: existingUser, error: checkError } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .single();

        if (existingUser) {
            return res.status(409).json({ message: 'User with this email already exists' });
        }

        const salt = bcrypt.genSaltSync(10);
        const password_hash = bcrypt.hashSync(password, salt);
        
        // Insert new user - Supabase will automatically generate UUID
        const { data: newUser, error: insertError } = await supabase
            .from('users')
            .insert([
                { 
                    email, 
                    password_hash, 
                    credits: 500 
                }
            ])
            .select()
            .single();

        if (insertError) throw insertError;

        res.status(201).json({
            message: 'User registered successfully',
            token: generateToken(newUser.id),
            user: {
                id: newUser.id,
                email: newUser.email,
                credits: newUser.credits
            }
        });
    } catch (error) {
        next(error);
    }
};

export const login = async (req, res, next) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Please provide email and password' });
    }

    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (error || !user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        if (bcrypt.compareSync(password, user.password_hash)) {
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
            res.status(401).json({ message: 'Invalid credentials' });
        }
    } catch (error) {
        next(error);
    }
};

export const getProfile = async (req, res, next) => {
    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('id, email, credits')
            .eq('id', req.user.id)
            .single();

        if (error || !user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        next(error);
    }
};