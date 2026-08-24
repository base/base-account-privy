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

    // Extract the 32-character hexadecimal nonce from the canonical SIWE field.
    const nonceMatch = message.match(/(?:^|\r?\n)Nonce: ([0-9a-fA-F]{32})(?:\r?\n|$)/);
    const nonce = nonceMatch?.[1];

    if (!nonce) {
      return NextResponse.json(
        { error: 'Invalid message format - nonce not found' },
        { status: 400 }
      );
    }

    // Verify the signature before consuming the nonce so invalid requests cannot burn it.
    // viem also handles ERC-6492 signatures for undeployed wallets.

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

    // Consume the nonce only after signature verification succeeds.
    if (!nonceStore.consume(nonce)) {
      return NextResponse.json(
        { error: 'Invalid or reused nonce' },
        { status: 400 }
      );
    }

    // Authentication successful - create session/JWT here

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
