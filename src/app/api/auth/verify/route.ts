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

    // 1. Extract and check nonce hasn't been reused
    // SIWE messages can have different formats, try multiple patterns
    let nonce: string | undefined;
    
    // Try different nonce patterns
    const patterns = [
      /Nonce: ([a-zA-Z0-9]+)/,           // "Nonce: abc123"
      /nonce: ([a-zA-Z0-9]+)/i,          // "nonce: abc123" (case insensitive)
      /at ([a-zA-Z0-9]{32})$/,           // "at abc123" (end of message)
      /([a-zA-Z0-9]{32})/                // Any 32-character hex string
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        nonce = match[1];
        break;
      }
    }

    if (!nonce) {
      return NextResponse.json(
        { error: 'Invalid message format - nonce not found' },
        { status: 400 }
      );
    }

    // Check if nonce exists and consume it (prevents reuse)
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
