import { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "./ui/card";

interface DepositModalProps {
  onClose: () => void;
  onDeposit: (amount: number) => Promise<void>;
  houseWallet?: string;
}

export function DepositModal({
  onClose,
  onDeposit,
  houseWallet,
}: DepositModalProps) {
  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleDeposit = async () => {
    const numAmount = parseFloat(amount);
    if (numAmount > 0) {
      setIsLoading(true);
      try {
        await onDeposit(numAmount);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 pb-8">
      <Card className="w-full max-w-md mx-4 bg-gray-800 text-white border-gray-700">
        <CardHeader>
          <CardTitle className="text-xl text-white">Deposit SOL</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="text-center">
            <p className="text-gray-300 text-sm mb-3">Choose deposit amount:</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <Button
                onClick={() => setAmount("0.1")}
                variant="outline"
                className={`${amount === "0.1" ? "bg-purple-600 text-white" : ""}`}
              >
                0.1 SOL
                <span className="block text-xs text-gray-400">100 coins</span>
              </Button>
              <Button
                onClick={() => setAmount("0.5")}
                variant="outline"
                className={`${amount === "0.5" ? "bg-purple-600 text-white" : ""}`}
              >
                0.5 SOL
                <span className="block text-xs text-gray-400">500 coins</span>
              </Button>
              <Button
                onClick={() => setAmount("1")}
                variant="outline"
                className={`${amount === "1" ? "bg-purple-600 text-white" : ""}`}
              >
                1 SOL
                <span className="block text-xs text-gray-400">1,000 coins</span>
              </Button>
              <Button
                onClick={() => setAmount("2")}
                variant="outline"
                className={`${amount === "2" ? "bg-purple-600 text-white" : ""}`}
              >
                2 SOL
                <span className="block text-xs text-gray-400">2,000 coins</span>
              </Button>
            </div>
          </div>

          <div>
            <label className="block text-gray-300 text-sm mb-2">
              Custom Amount (SOL)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.1"
              step="0.01"
              min="0.01"
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-purple-500"
            />
            <p className="text-xs text-gray-400 mt-1">
              1 SOL = 1,000 Game Coins
            </p>
          </div>
        </CardContent>

        <CardFooter>
          <div className="flex space-x-3 w-full">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1"
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeposit}
              className="flex-1 bg-green-600 hover:bg-green-700"
              disabled={isLoading || !amount || parseFloat(amount) <= 0}
            >
              {isLoading ? "Sending..." : `Pay ${amount} SOL`}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}