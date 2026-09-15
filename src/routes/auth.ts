import { Router } from 'express';
import { LoginSchema } from '../shared/schemas.js';
import { validateBody } from '../middleware/validate.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';
import { authService } from '../services/authService.js';
import { authenticateToken } from '../middleware/auth.js';

export const authRouter = Router();

// Login endpoint
authRouter.post('/login', authRateLimiter, validateBody(LoginSchema), (req, res) => {
  const { username, password } = req.body;
  const user = authService.findByUsername(username);

  if (!user || !authService.verifyPassword(user, password)) {
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Helytelen felhasználónév vagy jelszó.',
      },
    });
    return;
  }

  const token = authService.createToken(user);

  res.json({
    success: true,
    message: 'Sikeres bejelentkezés.',
    data: {
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    },
  });
});

// Current authenticated user profile
authRouter.get('/me', authenticateToken, (req, res) => {
  const user = authService.findById(req.user!.sub);
  if (!user) {
    res.status(404).json({
      success: false,
      error: {
        code: 'USER_NOT_FOUND',
        message: 'A felhasználó nem található.',
      },
    });
    return;
  }

  res.json({
    success: true,
    data: {
      id: user.id,
      username: user.username,
      role: user.role,
      createdAt: user.createdAt,
    },
  });
});

