import { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "./ui/card";

interface DepositModalProps {
  onClose: () => void;
  onDeposit: (amount: number) => Promise<void>;
}

export function DepositModal({
  onClose,
  onDeposit,
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
      <Card className="w-full max-w-md mx-4 bg-gradient-to-b from-amber-900/95 to-amber-950/95 backdrop-blur-sm border-2 border-amber-600/60 shadow-2xl shadow-amber-900/50">
        <CardHeader className="border-b border-amber-700/50">
          <CardTitle className="text-xl text-amber-100">Deposit SOL</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="text-center">
            <p className="text-amber-300 text-sm mb-3">Choose deposit amount:</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                onClick={() => setAmount("0.1")}
                className={`py-2.5 rounded ${amount === "0.1" ? "bg-amber-600 text-white border border-amber-400" : "bg-amber-800/30 hover:bg-amber-700/40 border border-amber-600/50 text-amber-300"} transition-colors`}
              >
                <div className="font-bold text-sm">0.1 SOL</div>
                <div className="text-xs opacity-80">100 coins</div>
              </button>
              <button
                onClick={() => setAmount("0.5")}
                className={`py-2.5 rounded ${amount === "0.5" ? "bg-amber-600 text-white border border-amber-400" : "bg-amber-800/30 hover:bg-amber-700/40 border border-amber-600/50 text-amber-300"} transition-colors`}
              >
                <div className="font-bold text-sm">0.5 SOL</div>
                <div className="text-xs opacity-80">500 coins</div>
              </button>
              <button
                onClick={() => setAmount("1")}
                className={`py-2.5 rounded ${amount === "1" ? "bg-amber-600 text-white border border-amber-400" : "bg-amber-800/30 hover:bg-amber-700/40 border border-amber-600/50 text-amber-300"} transition-colors`}
              >
                <div className="font-bold text-sm">1 SOL</div>
                <div className="text-xs opacity-80">1,000 coins</div>
              </button>
              <button
                onClick={() => setAmount("2")}
                className={`py-2.5 rounded ${amount === "2" ? "bg-amber-600 text-white border border-amber-400" : "bg-amber-800/30 hover:bg-amber-700/40 border border-amber-600/50 text-amber-300"} transition-colors`}
              >
                <div className="font-bold text-sm">2 SOL</div>
                <div className="text-xs opacity-80">2,000 coins</div>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-amber-300 text-sm mb-2">
              Custom Amount (SOL)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.1"
              step="0.01"
              min="0.01"
              className="w-full bg-black/30 border border-amber-700/50 rounded-lg px-3 py-2 text-amber-100 placeholder-amber-600 focus:outline-none focus:border-amber-500"
            />
            <p className="text-xs text-amber-400 mt-1">
              1 SOL = 1,000 Game Coins
            </p>
          </div>
        </CardContent>

        <CardFooter className="border-t border-amber-700/50">
          <div className="flex space-x-3 w-full">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 bg-amber-800/30 hover:bg-amber-700/40 border border-amber-600/50 rounded text-amber-300 font-semibold transition-colors"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              onClick={() => void handleDeposit()}
              className="flex-1 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 disabled:from-gray-600 disabled:to-gray-700 rounded font-bold text-white shadow-lg shadow-amber-900/50 transition-all disabled:opacity-50"
              disabled={isLoading || !amount || parseFloat(amount) <= 0}
            >
              {isLoading ? "Sending..." : `Pay ${amount} SOL`}
            </button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
