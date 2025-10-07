import { Clock, Gamepad2 } from "lucide-react";

interface DemoModeIndicatorProps {
  countdown: number;
  phase: 'waiting' | 'arena' | 'results';
  participantCount: number;
}

export function DemoModeIndicator({ countdown, phase, participantCount }: DemoModeIndicatorProps) {
  return (
    <div className="fixed top-20 left-4 z-50">
      <div className="bg-gradient-to-br from-purple-900/90 to-purple-950/90 backdrop-blur-sm rounded-lg border-2 border-purple-600/60 shadow-2xl p-4 min-w-[200px]">
        <div className="flex items-center gap-2 mb-2">
          <Gamepad2 className="w-5 h-5 text-purple-400 animate-pulse" />
          <span className="text-lg font-bold text-purple-300 uppercase tracking-wider">Demo Mode</span>
        </div>
        
        {phase === 'waiting' && (
          <>
            <div className="flex items-center gap-2 text-purple-200">
              <Clock className="w-4 h-4" />
              <span className="font-mono text-2xl">{countdown}s</span>
            </div>
            <div className="text-sm text-purple-400 mt-1">
              Starting demo game...
            </div>
            <div className="text-xs text-purple-400 mt-1">
              {participantCount} bots joined
            </div>
          </>
        )}
        
        {phase === 'arena' && (
          <div className="text-purple-200">
            <div className="text-sm font-semibold">Battle in progress!</div>
            <div className="text-xs text-purple-400 mt-1">
              {participantCount} participants fighting
            </div>
          </div>
        )}
        
        {phase === 'results' && (
          <div className="text-purple-200">
            <div className="text-sm font-semibold">Demo Complete!</div>
            <div className="text-xs text-purple-400 mt-1">
              Restarting soon...
            </div>
          </div>
        )}
        
        <div className="mt-3 pt-2 border-t border-purple-600/40">
          <div className="text-xs text-purple-400">
            Place a real bet to start playing!
          </div>
        </div>
      </div>
    </div>
  );
}