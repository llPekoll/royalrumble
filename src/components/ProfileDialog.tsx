import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { toast } from "sonner";
import { User } from "lucide-react";

interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentName?: string;
  walletAddress: string;
}

export function ProfileDialog({
  open,
  onOpenChange,
  currentName,
  walletAddress
}: ProfileDialogProps) {
  const [displayName, setDisplayName] = useState(currentName || "");
  const [isUpdating, setIsUpdating] = useState(false);

  const updateDisplayName = useMutation(api.players.updateDisplayName);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!displayName.trim()) {
      toast.error("Please enter a display name");
      return;
    }

    if (displayName.trim().length < 3) {
      toast.error("Display name must be at least 3 characters");
      return;
    }

    if (displayName.trim().length > 20) {
      toast.error("Display name must be less than 20 characters");
      return;
    }

    setIsUpdating(true);
    try {
      await updateDisplayName({
        walletAddress,
        displayName: displayName.trim()
      });
      toast.success("Display name updated successfully!");
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to update display name:", error);
      toast.error("Failed to update display name. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-gray-900 border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <User className="w-5 h-5" />
            Profile Settings
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Customize your profile settings and display name.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="wallet" className="text-gray-300">
              Wallet Address
            </Label>
            <div className="px-3 py-2 bg-gray-800 rounded-md text-gray-400 font-mono text-sm">
              {truncateAddress(walletAddress)}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName" className="text-gray-300">
              Display Name
            </Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter your display name"
              className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
              maxLength={20}
              minLength={3}
              required
            />
            <p className="text-xs text-gray-500">
              3-20 characters. This will be shown in the game.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isUpdating}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {isUpdating ? "Updating..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
