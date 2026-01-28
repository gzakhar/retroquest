import React, { useState } from "react";
import { useSession } from "../contexts/SessionContext";

interface Props {
  onEnableClick?: () => void;
  compact?: boolean;
}

export const SessionStatus: React.FC<Props> = ({ onEnableClick, compact = false }) => {
  const {
    isActive,
    timeRemaining,
    isLoading,
    revokeSession,
    balance,
    topUp,
    error,
  } = useSession();

  const [isTopping, setIsTopping] = useState(false);

  // Format time remaining as MM:SS or HH:MM:SS
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  const handleRevoke = async () => {
    try {
      await revokeSession();
    } catch (err) {
      console.error("Failed to revoke session:", err);
    }
  };

  const handleTopUp = async () => {
    setIsTopping(true);
    try {
      await topUp(0.01);
    } catch (err) {
      console.error("Failed to top up session:", err);
    } finally {
      setIsTopping(false);
    }
  };

  // Threshold for low balance warning (~4 transactions worth)
  const isLowBalance = balance !== null && balance < 0.002;

  if (compact) {
    // Compact view for header
    if (isActive) {
      return (
        <div className="flex items-center gap-2 px-3 py-1 bg-green-900/50 border border-green-700 rounded-full text-sm">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-green-400">Smooth Mode</span>
          <span className="text-green-300 font-mono">{formatTime(timeRemaining)}</span>

          {/* SOL Balance */}
          <span className={`font-mono text-xs ${isLowBalance ? 'text-yellow-400' : 'text-gray-400'}`}>
            {balance !== null ? `${balance.toFixed(4)} SOL` : '...'}
          </span>

          {/* Top-up button when low */}
          {isLowBalance && (
            <button
              onClick={handleTopUp}
              disabled={isLoading || isTopping}
              className="px-2 py-0.5 text-xs bg-yellow-600/50 hover:bg-yellow-600 border border-yellow-500 rounded transition-colors disabled:opacity-50"
              title="Add 0.01 SOL to session"
            >
              {isTopping ? "..." : "+0.01"}
            </button>
          )}

          <button
            onClick={handleRevoke}
            disabled={isLoading}
            className="ml-1 px-2 py-0.5 text-xs bg-red-600/50 hover:bg-red-600 border border-red-500 rounded transition-colors disabled:opacity-50"
          >
            {isLoading ? "..." : "End"}
          </button>
        </div>
      );
    }
    // Show enable button when no session is active
    return (
      <button
        onClick={onEnableClick}
        disabled={isLoading}
        className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded-full text-sm font-medium transition-colors disabled:opacity-50"
      >
        {isLoading ? "..." : "Enable Smooth Mode"}
      </button>
    );
  }

  // Full view for board
  if (isActive) {
    return (
      <div className="bg-green-900/30 border border-green-700 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
            <div>
              <p className="text-green-400 font-medium">Smooth Mode Active</p>
              <p className="text-green-300/70 text-sm">
                No wallet popups for the next {formatTime(timeRemaining)}
              </p>
              {/* Show balance in full view */}
              <p className={`text-sm font-mono ${isLowBalance ? 'text-yellow-400' : 'text-gray-400'}`}>
                Session balance: {balance !== null ? `${balance.toFixed(4)} SOL` : 'Loading...'}
                {isLowBalance && ' (Low!)'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Top-up button when low */}
            {isLowBalance && (
              <button
                onClick={handleTopUp}
                disabled={isLoading || isTopping}
                className="px-3 py-1 text-sm bg-yellow-600/50 hover:bg-yellow-600 border border-yellow-500 rounded-lg transition-colors disabled:opacity-50"
                title="Add 0.01 SOL to session"
              >
                {isTopping ? "..." : "+0.01 SOL"}
              </button>
            )}
            <button
              onClick={handleRevoke}
              disabled={isLoading}
              className="px-3 py-1 text-sm bg-red-600/50 hover:bg-red-600 border border-red-500 rounded-lg transition-colors disabled:opacity-50"
            >
              {isLoading ? "..." : "End Session"}
            </button>
          </div>
        </div>
        {error && (
          <p className="text-red-400 text-sm mt-2">{error}</p>
        )}
      </div>
    );
  }

  // Inactive state with enable button
  return (
    <div className="bg-gray-700/50 border border-gray-600 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-300 font-medium">Enable Smooth Mode</p>
          <p className="text-gray-400 text-sm">
            One approval, then no more wallet popups
          </p>
        </div>
        <button
          onClick={onEnableClick}
          disabled={isLoading}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          {isLoading ? "Enabling..." : "Enable"}
        </button>
      </div>
      {error && (
        <p className="text-red-400 text-sm mt-2">{error}</p>
      )}
    </div>
  );
};
