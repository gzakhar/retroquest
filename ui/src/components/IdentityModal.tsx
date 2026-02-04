import React, { useState, useEffect } from "react";
import { useIdentity } from "../contexts/IdentityContext";
import { MIN_USERNAME_CHARS, MAX_USERNAME_CHARS } from "../types";

export const IdentityModal: React.FC = () => {
  const {
    identity,
    isModalOpen,
    isLoading,
    error,
    closeModal,
    createIdentity,
    updateIdentity,
    validateUsername,
  } = useIdentity();

  const [username, setUsername] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const isEditMode = identity !== null;

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isModalOpen) {
      setUsername(identity?.username || "");
      setValidationError(null);
    }
  }, [isModalOpen, identity]);

  if (!isModalOpen) return null;

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUsername(value);

    // Validate on change for immediate feedback
    if (value.length > 0) {
      setValidationError(validateUsername(value));
    } else {
      setValidationError(null);
    }
  };

  const handleSubmit = async () => {
    const error = validateUsername(username);
    if (error) {
      setValidationError(error);
      return;
    }

    try {
      if (isEditMode) {
        await updateIdentity(username);
      } else {
        await createIdentity(username);
      }
    } catch (err) {
      console.error("Failed to save identity:", err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !validationError && username.length >= MIN_USERNAME_CHARS) {
      handleSubmit();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70"
        onClick={closeModal}
      />

      {/* Modal */}
      <div className="relative bg-gray-800 border border-gray-700 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-white mb-2">
            {isEditMode ? "Update Display Name" : "Set Display Name"}
          </h2>
          <p className="text-gray-400">
            {isEditMode
              ? "Change how your name appears to other participants."
              : "Choose a display name that other participants will see instead of your wallet address."}
          </p>
        </div>

        {/* Username input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Display Name
          </label>
          <input
            type="text"
            value={username}
            onChange={handleUsernameChange}
            onKeyDown={handleKeyDown}
            placeholder="Enter your display name"
            maxLength={MAX_USERNAME_CHARS}
            disabled={isLoading}
            className={`w-full px-4 py-3 bg-gray-700 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-colors ${
              validationError
                ? "border-red-500 focus:ring-red-500"
                : "border-gray-600 focus:ring-purple-500"
            }`}
          />
          <div className="flex justify-between mt-2">
            <span className={`text-xs ${validationError ? "text-red-400" : "text-gray-500"}`}>
              {validationError || `${MIN_USERNAME_CHARS}-${MAX_USERNAME_CHARS} characters, letters, numbers, and underscores only`}
            </span>
            <span className="text-xs text-gray-500">
              {username.length}/{MAX_USERNAME_CHARS}
            </span>
          </div>
        </div>

        {/* Info note */}
        <div className="bg-blue-900/30 border border-blue-700/50 rounded-lg p-3 mb-6">
          <p className="text-blue-300 text-xs">
            <strong>Note:</strong> Your display name is stored on-chain and visible to all participants.
            You can change it anytime.
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
            onClick={closeModal}
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading || !!validationError || username.length < MIN_USERNAME_CHARS}
            className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading
              ? "Saving..."
              : isEditMode
                ? "Update Name"
                : "Set Name"}
          </button>
        </div>
      </div>
    </div>
  );
};
