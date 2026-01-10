"use client";

import { useState, useMemo } from "react";
import { useWallets } from "@privy-io/react-auth";
import Section from "../reusables/section";
import { showSuccessToast, showErrorToast } from "@/components/ui/custom-toast";
import type { Hex } from "viem";

type SubAccount = {
  address: string;
  publicKey: string;
  [key: string]: any;
};

const SubAccounts = () => {
  const { wallets } = useWallets();
  const [subAccounts, setSubAccounts] = useState<SubAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Find the Base Account wallet
  const baseAccount = useMemo(() => {
    return wallets.find((wallet) => wallet.walletClientType === 'base_account');
  }, [wallets]);

  const handleGetSubAccounts = async () => {
    if (!baseAccount) {
      showErrorToast("No Base Account found. Please connect your Base Account first.");
      return;
    }

    setIsLoading(true);
    try {
      // Switch to Base Mainnet
      await baseAccount.switchChain(8453);
      const provider = await baseAccount.getEthereumProvider();

      // Get existing sub accounts
      const response = await provider.request({
        method: 'wallet_getSubAccounts',
        params: [
          {
            account: baseAccount.address as `0x${string}`,
            domain: window.location.origin
          }
        ]
      });

      const { subAccounts: existingSubAccounts } = response as { subAccounts: SubAccount[] };
      setSubAccounts(existingSubAccounts || []);
      
      if (existingSubAccounts && existingSubAccounts.length > 0) {
        showSuccessToast(`Found ${existingSubAccounts.length} existing sub account(s)`);
      } else {
        showSuccessToast("No existing sub accounts found");
      }
    } catch (error) {
      console.error("Error getting sub accounts:", error);
      const message = error?.toString?.() ?? "Failed to get sub accounts";
      showErrorToast(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSubAccount = async () => {
    if (!baseAccount) {
      showErrorToast("No Base Account found. Please connect your Base Account first.");
      return;
    }

    setIsLoading(true);
    try {
      // Switch to Base Mainnet
      await baseAccount.switchChain(8453);
      const provider = await baseAccount.getEthereumProvider();
      console.log(baseAccount.address);

      // Create new sub account
      await provider.request({
        method: 'wallet_addSubAccount',
        params: [
          {
            account: {
              type: 'create',
            }
          }
        ]
      });

      showSuccessToast("Sub account created successfully");
      
      // Refresh the sub accounts list
      await handleGetSubAccounts();
    } catch (error) {
      console.error("Error creating sub account:", error);
      const message = error?.toString?.() ?? "Failed to create sub account";
      showErrorToast(message);
    } finally {
      setIsLoading(false);
    }
  };

  const availableActions = [
    {
      name: "Get Sub Accounts",
      function: handleGetSubAccounts,
      disabled: !baseAccount || isLoading,
    },
    {
      name: "Create Sub Account",
      function: handleAddSubAccount,
      disabled: !baseAccount || isLoading,
    },
  ];

  return (
    <Section
      name="Sub Accounts"
      description={
        "Sub Accounts allow you to provision app-specific wallet accounts for your users that are embedded directly in your application."
      }
      filepath="src/components/sections/sub-accounts"
      actions={availableActions}
    >
      <div className="mb-4">
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">
            Base Account Status: {baseAccount ? `Connected (${baseAccount.address})` : "Not connected"}
          </p>
          {baseAccount && (
            <p className="text-xs text-gray-500 mb-4">
              Network: Base (Chain ID: 8453)
            </p>
          )}
        </div>

        {subAccounts.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-medium mb-2">Existing Sub Accounts:</h4>
            <div className="space-y-2">
              {subAccounts.map((subAccount, index) => (
                <div
                  key={subAccount.address || index}
                  className="p-3 border border-gray-200 rounded-md bg-gray-50"
                >
                  <div className="text-xs text-gray-600">
                    <p><strong>Address:</strong> {subAccount.address}</p>
                    {subAccount.publicKey && (
                      <p><strong>Public Key:</strong> {subAccount.publicKey}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-sm text-gray-600">Processing...</span>
          </div>
        )}
      </div>
    </Section>
  );
};

export default SubAccounts;
