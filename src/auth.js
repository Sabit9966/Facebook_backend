/**
 * JWT auth middleware for data isolation. Verifies Bearer token and sets req.userId.
 * Protected routes must use requireAuth; unauthenticated requests receive 401.
 */
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production-data-isolation';

/**
 * Issues a JWT for the given userId. Used by POST /api/auth/login.
 * @param {string} userId
 * @returns {string} signed JWT
 */
export function signToken(userId) {
    return jwt.sign(
        { sub: userId, iat: Math.floor(Date.now() / 1000) },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
}

/**
 * Middleware: requires valid Authorization: Bearer <token>. Sets req.userId from token sub.
 * Sends 401 if missing or invalid token.
 */
export function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required', code: 'UNAUTHORIZED' });
    }
    const token = authHeader.slice(7).trim();
    if (!token) {
        return res.status(401).json({ error: 'Invalid token', code: 'UNAUTHORIZED' });
    }
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        const userId = payload.sub;
        if (!userId || typeof userId !== 'string') {
            return res.status(401).json({ error: 'Invalid token payload', code: 'UNAUTHORIZED' });
        }
        req.userId = userId;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired', code: 'UNAUTHORIZED' });
        }
        return res.status(401).json({ error: 'Invalid token', code: 'UNAUTHORIZED' });
    }
}
