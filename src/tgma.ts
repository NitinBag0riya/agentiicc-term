/**
 * Telegram Mini App API Routes
 *
 * Handles requests from the Cloudflare-hosted Mini App
 */
import { Router } from 'express';
import crypto from 'crypto';
import { getRedis } from './db/redis';
import { getPostgres } from './db/postgres';
import { getOrCreateUser, storeApiCredentials } from './db/users';
import { encrypt } from './utils/encryption';

const router = Router();

/**
 * Verify Telegram Web App initData signature
 */
function verifyTelegramWebAppData(
  initData: string,
  botToken: string
): {
  valid: boolean;
  user?: { id: number; first_name: string; username?: string };
} {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');

    if (!hash) {
      return { valid: false };
    }

    params.delete('hash');

    // Sort params alphabetically
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // Generate secret key from bot token
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    // Calculate expected hash
    const expectedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    // Verify hash matches
    if (hash !== expectedHash) {
      console.log('[TGMA] Hash mismatch:', { expected: expectedHash, received: hash });
      return { valid: false };
    }

    // Parse user data
    const userParam = params.get('user');
    if (!userParam) {
      return { valid: false };
    }

    const user = JSON.parse(userParam);

    // Check auth_date (not too old - within 1 hour)
    const authDate = parseInt(params.get('auth_date') || '0');
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 3600) {
      console.log('[TGMA] Auth data too old:', { authDate, now, diff: now - authDate });
      return { valid: false };
    }

    return { valid: true, user };
  } catch (error) {
    console.error('[TGMA] Error verifying initData:', error);
    return { valid: false };
  }
}

/**
 * POST /tgma/create-api-key
 *
 * Creates API keys for the user by calling Aster DEX API
 */
router.post('/create-api-key', async (req, res) => {
  try {
    const { walletAddress, signature, nonce, tgInitData, exchange = 'aster' } = req.body;

    console.log('[TGMA] Received create-api-key request', { exchange });

    // Validate required fields
    if (!walletAddress || !signature || !nonce || !tgInitData) {
      return res.status(400).json({
        error: 'Missing required fields: walletAddress, signature, nonce, tgInitData'
      });
    }

    // Verify Telegram authentication
    const botToken = process.env.TELEGRAM_BOT_TOKEN!;
    const verification = verifyTelegramWebAppData(tgInitData, botToken);

    if (!verification.valid) {
      console.log('[TGMA] Invalid Telegram authentication');
      return res.status(401).json({ error: 'Invalid Telegram authentication' });
    }

    const telegramUser = verification.user!;
    const telegramUserId = telegramUser.id;

    console.log('[TGMA] Authenticated Telegram user:', {
      id: telegramUserId,
      username: telegramUser.username,
      wallet: walletAddress.slice(0, 6) + '...' + walletAddress.slice(-4)
    });

    let apiKey = '';
    let apiSecret = '';

    if (exchange === 'aster') {
        // Note: Nonce validation is handled by Aster API
        // The nonce is a counter/random number from Aster, not a timestamp
        console.log('[TGMA] Using nonce from Aster:', nonce);

        // Call Aster DEX API to create API keys
        console.log('[TGMA] Calling Aster API to create keys...');
        console.log('[TGMA] Using nonce/timestamp:', nonce);
        console.log('[TGMA] Signature:', signature.slice(0, 20) + '...');
        console.log('[TGMA] Wallet:', walletAddress);

        // Generate a unique desc (max 20 chars)
        // Format: TG_{last 6 digits of telegram ID}_{random 6 digits}
        const shortId = telegramUserId.toString().slice(-6);
        const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
        const desc = `TG_${shortId}_${random}`; // e.g., TG_461047_123456 (17 chars)

        console.log('[TGMA] Generated desc:', desc, `(${desc.length} chars)`);

        const asterResponse = await fetch('https://sapi.asterdex.com/api/v1/createApiKey', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            address: walletAddress,
            userOperationType: 'CREATE_API_KEY',
            userSignature: signature,
            desc: desc,
            timestamp: nonce.toString(),
          })
        });

        if (!asterResponse.ok) {
          const errorText = await asterResponse.text();
          console.error('[TGMA] Aster API error:', errorText);
          console.error('[TGMA] Request details:', {
            address: walletAddress,
            userOperationType: 'CREATE_API_KEY',
            timestamp: nonce,
            signatureLength: signature.length,
          });
          return res.status(500).json({
            error: 'Failed to create API key on Aster DEX',
            details: errorText
          });
        }

        const asterData = await asterResponse.json();
        apiKey = asterData.apiKey;
        apiSecret = asterData.apiSecret;
    } else if (exchange === 'hyperliquid') {
        console.log('[TGMA] Linking Hyperliquid Wallet...');
        // Verify Signature
        // Message format must match what frontend signs: `Link Account ${nonce}`
        const message = `Link Hyperliquid Account ${nonce}`;
        
        try {
            const { ethers } = await import('ethers');
            const recoveredAddress = ethers.verifyMessage(message, signature);
            
            if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
                console.error('[TGMA] Signature Mismatch:', { recovered: recoveredAddress, expected: walletAddress });
                return res.status(401).json({ error: 'Invalid Signature' });
            }
            
            // Treat as Linked (Address + Placeholder Secret)
            // TODO: For full trading, we need Agent Private Key. 
            // For now, linking Main Address implies "View Only" or "User needs to config Agent later".
            apiKey = walletAddress;
            apiSecret = 'WATCH_ONLY'; 
            
        } catch (err: any) {
             console.error('[TGMA] Signature Verification Failed:', err);
             return res.status(400).json({ error: 'Signature Verification Failed' });
        }
    } else {
        return res.status(400).json({ error: 'Invalid exchange parameter' });
    }

    console.log(`[TGMA] ✅ Credentials prepared for ${exchange}:`, {
      apiKey: `${apiKey.slice(0, 8)}...`,
      walletAddress: walletAddress.slice(0, 6) + '...' + walletAddress.slice(-4)
    });

    // Store encrypted credentials in database
    const db = getPostgres();
    const redis = getRedis();

    // Get or create user record
    const user = await getOrCreateUser(telegramUserId, telegramUser.username);

    // Encrypt the credentials
    const encryptedKey = encrypt(apiKey);
    const encryptedSecret = encrypt(apiSecret);

    // Store in database
    await storeApiCredentials(user.id, encryptedKey, encryptedSecret, false, exchange);

    console.log('[TGMA] ✅ Credentials stored for user', user.id);

    // Update user's session in Redis to mark them as linked
    const sessionKey = `session:${telegramUserId}`;
    const session = await redis.get(sessionKey);

    if (session) {
      const sessionData = JSON.parse(session);
      sessionData.isLinked = true;
      sessionData.userId = user.id;
      await redis.set(sessionKey, JSON.stringify(sessionData));
      console.log('[TGMA] ✅ Session updated');
    } else {
      // Create new session
      await redis.set(sessionKey, JSON.stringify({
        isLinked: true,
        userId: user.id,
        telegramId: telegramUserId,
        username: telegramUser.username,
      }));
      console.log('[TGMA] ✅ New session created');
    }

    // Send success message to user via Telegram
    try {
      const botToken = process.env.TELEGRAM_BOT_TOKEN!;
      const message = `✅ *Wallet Linked Successfully!*\n\n` +
        `Your wallet has been connected to Aster DEX.\n\n` +
        `🔐 Wallet: \`${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}\`\n\n` +
        `You can now start trading! Use /menu to get started.`;

      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: telegramUserId,
          text: message,
          parse_mode: 'Markdown'
        })
      });

      console.log('[TGMA] ✅ Success message sent to user');
    } catch (error) {
      console.error('[TGMA] Failed to send Telegram message:', error);
      // Don't fail the request if message sending fails
    }

    return res.json({
      success: true,
      message: 'API keys created and linked successfully'
    });

  } catch (error) {
    console.error('[TGMA] Error in create-api-key:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /tgma/get-nonce
 *
 * Gets a nonce from Aster API for wallet signature
 */
router.post('/get-nonce', async (req, res) => {
  try {
    const { walletAddress } = req.body;

    console.log('[TGMA] Getting nonce for wallet:', walletAddress?.slice(0, 6) + '...' + walletAddress?.slice(-4));

    if (!walletAddress) {
      return res.status(400).json({ error: 'Missing walletAddress' });
    }

    // Call Aster API to get nonce
    const asterResponse = await fetch('https://sapi.asterdex.com/api/v1/getNonce', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        address: walletAddress,
        userOperationType: 'CREATE_API_KEY',
      })
    });

    if (!asterResponse.ok) {
      const errorText = await asterResponse.text();
      console.error('[TGMA] Aster getNonce error:', errorText);
      return res.status(500).json({
        error: 'Failed to get nonce from Aster DEX',
        details: errorText
      });
    }

    const nonce = await asterResponse.text();
    console.log('[TGMA] ✅ Got nonce:', nonce);

    return res.json({ nonce: nonce.trim() });

  } catch (error) {
    console.error('[TGMA] Error in get-nonce:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
