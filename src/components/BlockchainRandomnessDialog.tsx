import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';

interface BlockchainRandomnessDialogProps {
  open: boolean;
}

export function BlockchainRandomnessDialog({ open }: BlockchainRandomnessDialogProps) {
  return (
    <Dialog open={open}>
      <DialogContent
        showCloseButton={false}
        className="max-w-sm fixed bottom-4 left-1/2 transform -translate-x-1/2 translate-y-0 top-auto p-4"
      >
        <DialogHeader className="text-center">
          <DialogTitle className="text-sm font-bold text-blue-400">
            🎲 Determining Winner
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center py-3">
          {/* Animated spinner */}
          <div className="relative">
            <div className="w-8 h-8 border-2 border-blue-400/20 border-t-blue-400 rounded-full animate-spin"></div>
            <div className="absolute inset-0 w-8 h-8 border-2 border-transparent border-t-purple-400 rounded-full animate-spin animate-reverse" style={{ animationDuration: '1.5s' }}></div>
          </div>

          <p className="text-xs text-gray-400 mt-2 text-center">
            Using blockchain randomness for fair winner selection
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
