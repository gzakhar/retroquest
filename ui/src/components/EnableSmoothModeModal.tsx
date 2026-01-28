import React, { useState } from "react";
import { useSession } from "../contexts/SessionContext";
import { DEFAULT_SESSION_VALIDITY_SECONDS } from "../types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onEnabled?: () => void;
}

const DURATION_OPTIONS = [
  { label: "30 minutes", seconds: 30 * 60 },
  { label: "1 hour", seconds: 60 * 60 },
  { label: "2 hours", seconds: 2 * 60 * 60 },
  { label: "4 hours", seconds: 4 * 60 * 60 },
];

export const EnableSmoothModeModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onEnabled,
}) => {
  const { createSession, isLoading, error } = useSession();
  const [selectedDuration, setSelectedDuration] = useState(DEFAULT_SESSION_VALIDITY_SECONDS);

  if (!isOpen) return null;

  const handleEnable = async () => {
    try {
      await createSession(selectedDuration);
      onEnabled?.();
      onClose();
    } catch (err) {
      console.error("Failed to enable smooth mode:", err);
      // Don't close on error - let user see the error and retry
    }
  };

  const handleSkip = () => {
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70"
        onClick={handleSkip}
      />

      {/* Modal */}
      <div className="relative bg-gray-800 border border-gray-700 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-white mb-2">
            Enable Smooth Mode?
          </h2>
          <p className="text-gray-400">
            Retrospectives involve many small actions. Smooth mode lets you
            participate without constant wallet popups.
          </p>
        </div>

        {/* How it works */}
        <div className="bg-gray-700/50 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-medium text-gray-300 mb-3">How it works:</h3>
          <ul className="space-y-2 text-sm text-gray-400">
            <li className="flex items-start gap-2">
              <span className="text-purple-400 mt-0.5">1.</span>
              <span>Approve once to create a temporary session key</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-400 mt-0.5">2.</span>
              <span>All actions during the session are instant</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-400 mt-0.5">3.</span>
              <span>Session expires automatically or you can end it early</span>
            </li>
          </ul>
        </div>

        {/* Duration selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Session duration:
          </label>
          <div className="grid grid-cols-2 gap-2">
            {DURATION_OPTIONS.map((option) => (
              <button
                key={option.seconds}
                onClick={() => setSelectedDuration(option.seconds)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedDuration === option.seconds
                    ? "bg-purple-600 text-white"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Security note */}
        <div className="bg-blue-900/30 border border-blue-700/50 rounded-lg p-3 mb-6">
          <p className="text-blue-300 text-xs">
            <strong>Security:</strong> Session keys can only interact with this
            program. They cannot transfer funds or access other apps. A small
            amount of SOL (~0.01) is used for transaction fees.
          </p>
        </div>

        {/* Error display */}
        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 mb-4">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleSkip}
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            Skip for now
          </button>
          <button
            onClick={handleEnable}
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {isLoading ? "Enabling..." : "Enable Smooth Mode"}
          </button>
        </div>
      </div>
    </div>
  );
};
