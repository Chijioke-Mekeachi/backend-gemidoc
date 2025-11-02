/**
 * Custom error handling middleware.
 * Catches errors from async controllers and sends a structured response.
 */
export const errorHandler = (err, req, res, next) => {
    console.error('SERVER ERROR:', err.stack);

    // Default to a 500 Internal Server Error if no status code is set
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

    res.status(statusCode).json({
        message: err.message || 'An unexpected error occurred.',
        // In development mode, include the stack trace for easier debugging.
        // SECURITY: Do not expose stack traces in production.
        stack: process.env.NODE_ENV === 'production' ? '🥞' : err.stack,
    });
};
