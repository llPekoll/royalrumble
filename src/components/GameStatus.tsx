import { useGameState } from "../hooks/useGameState";

export function GameStatus() {
  const { gameState, gameConfig, loading } = useGameState();

  if (loading) {
    return (
      <div className="inline-flex items-center gap-2 bg-gray-800/50 backdrop-blur-sm px-4 py-2 rounded-full border border-gray-700">
        <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse" />
        <span className="text-sm text-gray-400">Loading...</span>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="inline-flex items-center gap-2 bg-red-500/20 backdrop-blur-sm px-4 py-2 rounded-full border border-red-500/50">
        <div className="w-2 h-2 bg-red-500 rounded-full" />
        <span className="text-sm text-red-400">Connection Error</span>
      </div>
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const timeExpired = gameState.endTimestamp > 0 && now > gameState.endTimestamp;

  // Determine status display
  const getStatusInfo = () => {
    if (gameConfig?.gameLocked) {
      return {
        color: "bg-orange-500/20 border-orange-500/50",
        dotColor: "bg-orange-500",
        icon: "🔒",
        text: "Game Locked - Drawing Winner",
        description: "VRF in progress..."
      };
    }

    switch (gameState.status) {
      case "Idle":
        return {
          color: "bg-gray-500/20 border-gray-500/50",
          dotColor: "bg-gray-500",
          icon: "⏳",
          text: "Waiting for Players",
          description: "Be the first to join!"
        };

      case "Waiting":
        if (timeExpired) {
          return {
            color: "bg-yellow-500/20 border-yellow-500/50",
            dotColor: "bg-yellow-500",
            icon: "⏰",
            text: "Betting Closed",
            description: "Game starting soon..."
          };
        }
        return {
          color: "bg-green-500/20 border-green-500/50",
          dotColor: "bg-green-500 animate-pulse",
          icon: "🟢",
          text: "Betting Open",
          description: `${gameState.bets.length} players joined`
        };

      case "AwaitingWinnerRandomness":
        return {
          color: "bg-blue-500/20 border-blue-500/50",
          dotColor: "bg-blue-500 animate-pulse",
          icon: "🎲",
          text: "Drawing Winner",
          description: "Blockchain randomness..."
        };

      case "Finished":
        return {
          color: "bg-purple-500/20 border-purple-500/50",
          dotColor: "bg-purple-500",
          icon: "🏆",
          text: "Game Complete",
          description: "Winner selected!"
        };

      default:
        return {
          color: "bg-gray-500/20 border-gray-500/50",
          dotColor: "bg-gray-500",
          icon: "❓",
          text: "Unknown Status",
          description: ""
        };
    }
  };

  const status = getStatusInfo();

  return (
    <div className={`inline-flex flex-col gap-1 backdrop-blur-sm px-4 py-2 rounded-lg border ${status.color}`}>
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${status.dotColor}`} />
        <span className="text-sm font-medium">
          {status.icon} {status.text}
        </span>
      </div>
      {status.description && (
        <span className="text-xs text-gray-400 pl-4">
          {status.description}
        </span>
      )}
    </div>
  );
}
