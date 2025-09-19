import { query } from "../_generated/server";

// Get house wallet address
export const getHouseWallet = query({
  args: {},
  handler: async () => {
    const houseWallet = process.env.HOUSE_WALLET;
    if (!houseWallet) {
      throw new Error("House wallet not configured");
    }
    return { address: houseWallet };
  },
});