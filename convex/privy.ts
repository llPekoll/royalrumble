import { action } from "./_generated/server";
import { v } from "convex/values";

/**
 * Get Privy embedded wallet balance using Privy REST API
 * Requires PRIVY_APP_ID and PRIVY_APP_SECRET environment variables
 */
export const getWalletBalance = action({
  args: {
    walletId: v.string(),
  },
  handler: async (ctx, args) => {
    console.log("🔍 getWalletBalance called with walletId:", args.walletId);

    const appId = process.env.PRIVY_APP_ID;
    const appSecret = process.env.PRIVY_APP_SECRET;

    console.log("🔑 Credentials check:", {
      hasAppId: !!appId,
      hasAppSecret: !!appSecret,
      appIdLength: appId?.length,
    });

    if (!appId || !appSecret) {
      console.error("❌ Missing Privy credentials in environment variables");
      return { success: false, error: "Missing Privy credentials" };
    }

    try {
      // Create Basic Auth header (Convex doesn't have Buffer, use btoa)
      const authString = btoa(`${appId}:${appSecret}`);

      // Privy API uses 'solana' for both mainnet and devnet
      // The network is determined by the wallet itself (created on mainnet or devnet)
      const url = `https://api.privy.io/v1/wallets/${args.walletId}/balance?asset=sol&chain=solana`;
      console.log("📡 Fetching from Privy API:", url);

      // Fetch balance from Privy API
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Basic ${authString}`,
          "privy-app-id": appId,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Privy API error (${response.status}):`, errorText);
        return {
          success: false,
          error: `Privy API error: ${response.status}`,
        };
      }

      const data = await response.json();

      // Extract SOL balance from response
      const solBalance = data.balances?.find((b: any) => b.chain === "solana" && b.asset === "sol");

      if (!solBalance) {
        console.log("ℹ️ No SOL balance found for wallet");
        return {
          success: true,
          balance: 0,
          displayValue: "0.0000",
        };
      }

      console.log("✅ Fetched Privy wallet balance:", {
        walletId: args.walletId,
        balance: solBalance.display_values?.eth || "0",
        rawValue: solBalance.raw_value,
        fullResponse: data,
      });

      return {
        success: true,
        balance: parseFloat(solBalance.display_values?.eth || "0"),
        displayValue: solBalance.display_values?.eth || "0.0000",
        rawValue: solBalance.raw_value,
        rawValueDecimals: solBalance.raw_value_decimals,
      };
    } catch (error) {
      console.error("❌ Failed to fetch Privy wallet balance:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});
