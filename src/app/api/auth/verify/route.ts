import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import { nonceStore } from '@/lib/nonce-store';

const client = createPublicClient({
  chain: base,
  transport: http()
});

export async function POST(request: NextRequest) {
  try {
    const { address, message, signature } = await request.json();

    // Validate required fields
    if (!address || !message || !signature) {
      return NextResponse.json(
        { error: 'Missing required fields: address, message, signature' },
        { status: 400 }
      );
    }

    // 1. Extract and validate nonce from SIWE message
    const nonce = extractNonce(message);

    if (!nonce) {
      return NextResponse.json(
        {
          error: 'Invalid message format',
          details: 'Nonce not found in SIWE message. Expected format: "Nonce: <hex_string>"'
        },
        { status: 400 }
      );
    }

    if (!validateNonce(nonce)) {
      return NextResponse.json(
        {
          error: 'Invalid nonce format',
          details: 'Nonce must be a hexadecimal string with at least 8 characters'
        },
        { status: 400 }
      );
    }

    if (!nonceStore.consume(nonce)) {
      return NextResponse.json(
        { error: 'Invalid or reused nonce' },
        { status: 400 }
      );
    }

    // 2. Verify the signature using viem (handles ERC-6492 for undeployed wallets)
    const valid = await client.verifyMessage({
      address: address as `0x${string}`,
      message,
      signature: signature as `0x${string}`
    });

    if (!valid) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // 3. Authentication successful - create session/JWT here
    // For now, just return success with user info
    return NextResponse.json({
      success: true,
      address,
      message: 'Authentication successful',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error verifying SIWE message:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Extract and validate nonce from SIWE message
function extractNonce(message: string): string | null {
  const noncePatterns = [
    { pattern: /Nonce:\s*([a-fA-F0-9]+)/, description: "Standard Nonce format" },
    { pattern: /nonce:\s*([a-fA-F0-9]+)/i, description: "Case-insensitive nonce" },
    { pattern: /at\s+([a-fA-F0-9]{32,64})$/, description: "End-of-message nonce" }
  ];

  for (const { pattern, description } of noncePatterns) {
    const match = message.match(pattern);
    if (match?.[1]) {
      console.log(`Found nonce using: ${description}`);
      return match[1];
    }
  }

  return null;
}

function validateNonce(nonce: string): boolean {
  // Basic nonce validation - adjust based on your nonce generation strategy
  return nonce.length >= 8 && /^[a-fA-F0-9]+$/.test(nonce);
}
