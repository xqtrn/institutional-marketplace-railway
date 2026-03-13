const VALID_API_KEYS = [
  process.env.API_SECRET,
  'investclub-admin-secure-key-2024',
  'marketplace-admin-2024',
  'investclub-admin-2024'
].filter(Boolean);

function validateApiKey(req, res, next) {
  const headerKey = req.headers['x-api-key'];
  const bodyKey = req.body?.apiKey;
  const apiKey = headerKey || bodyKey;

  if (!apiKey || !VALID_API_KEYS.includes(apiKey)) {
    return res.status(401).json({
      error: 'Unauthorized',
      debug: {
        receivedKey: apiKey ? apiKey.substring(0, 10) + '...' : 'none',
        validKeysCount: VALID_API_KEYS.length
      }
    });
  }

  next();
}

function validateBearerToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Bearer token is now telegram_id
  req.telegramId = authHeader.replace('Bearer ', '');
  // Keep backward compat for routes that use req.userEmail
  req.userEmail = req.telegramId;
  next();
}

module.exports = { validateApiKey, validateBearerToken, VALID_API_KEYS };
