"use client";

import { useState } from "react";
import { useBaseAccountSdk } from "@privy-io/react-auth";
import { SignInWithBaseButton } from "@base-org/account-ui/react";
import Section from "../reusables/section";
import { showSuccessToast, showErrorToast } from "@/components/ui/custom-toast";

const Authentication = () => {
  const { baseAccountSdk } = useBaseAccountSdk();
  const [loading, setLoading] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);

  const provider = baseAccountSdk?.getProvider();

  const handleSignInWithBase = async () => {
    if (!provider) {
      showErrorToast("Base Account SDK not available");
      return;
    }

    try {
      setLoading(true);
      setVerificationResult(null);

      // Get a fresh nonce
      const nonceResponse = await fetch("/api/auth/nonce");
      if (!nonceResponse.ok) {
        throw new Error("Failed to get nonce");
      }
      const { nonce } = await nonceResponse.json();

      // Connect and authenticate with SIWE
      const response = (await provider.request({
        method: "wallet_connect",
        params: [
          {
            version: "1",
            capabilities: {
              signInWithEthereum: {
                nonce,
                chainId: 8453,
              },
            },
          },
        ],
      })) as {
        accounts: Array<{
          address: string;
          capabilities: {
            signInWithEthereum: { message: string; signature: string };
          };
        }>;
      };
      const { address } = response.accounts[0];
      const { message, signature } =
        response.accounts[0].capabilities.signInWithEthereum;

      // Verify with backend
      const verifyResponse = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, message, signature }),
      });

      const result = await verifyResponse.json();

      if (!verifyResponse.ok) {
        throw new Error(result.error || "Verification failed");
      }

      setVerificationResult(result);
      showSuccessToast("Successfully signed in with Base and verified!");
    } catch (error: any) {
      console.error("Sign in error:", error);
      showErrorToast(error.message || "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  const availableActions = [
    {
      name: "Sign In With Base",
      function: handleSignInWithBase,
      disabled: loading || !provider,
    },
  ];

  return (
    <>
      <Section
        name="Authentication"
        description="Sign in with Base Account and verify the signature on the backend."
        filepath="src/components/sections/authentication"
        actions={availableActions}
      >
        <div className="space-y-4">
          {/* Sign In With Base Button */}
          <div className="w-fit">
            <SignInWithBaseButton
              colorScheme="dark"
              onClick={handleSignInWithBase}
            />
          </div>
          <div className="w-fit">
            <SignInWithBaseButton
              colorScheme="light"
              onClick={handleSignInWithBase}
            />
          </div>
        </div>
      </Section>
      <div>
        {verificationResult && (
          <div className="bg-green-50 p-4 rounded-lg">
            <h4 className="font-semibold mb-3 text-green-900">
              ✅ Backend Verified!
            </h4>
            <div className="text-sm text-green-800 space-y-1">
              <div>
                <strong>Address:</strong> {verificationResult.address}
              </div>
              <div>
                <strong>Verified at:</strong>{" "}
                {new Date(verificationResult.timestamp).toLocaleString()}
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className="text-center text-blue-600">
            Signing in with Base...
          </div>
        )}
      </div>
    </>
  );
};

export default Authentication;
