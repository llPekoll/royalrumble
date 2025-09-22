import { Button } from "./ui/button";

export interface NavigationProps {
  currentView: "game" | "leaderboard";
  onViewChange: (view: "game" | "leaderboard") => void;
}

export function Navigation({ currentView, onViewChange }: NavigationProps) {
  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 md:hidden">
      <div className="bg-white/90 backdrop-blur-sm border border-gray-300 rounded-full p-2 flex space-x-2">
        <Button
          onClick={() => onViewChange("game")}
          variant={currentView === "game" ? "default" : "ghost"}
          className={`px-6 py-2 rounded-full transition-all ${
            currentView === "game"
              ? "bg-purple-600 hover:bg-purple-700 text-white"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          }`}
        >
          🎮 Game
        </Button>

        <Button
          onClick={() => onViewChange("leaderboard")}
          variant={currentView === "leaderboard" ? "default" : "ghost"}
          className={`px-6 py-2 rounded-full transition-all ${
            currentView === "leaderboard"
              ? "bg-purple-600 hover:bg-purple-700 text-white"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          }`}
        >
          🏆 Leaderboard
        </Button>
      </div>
    </div>
  );
}
