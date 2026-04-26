const jwt = require('jsonwebtoken');
const SECRET_KEY = process.env.JWT_SECRET


function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        req.user = decoded; // Attach user info to request object
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
    }

}

module.exports = authenticate;