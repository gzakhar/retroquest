import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { SessionStatus } from "./SessionStatus";
import { EnableSmoothModeModal } from "./EnableSmoothModeModal";
import { IdentityModal } from "./IdentityModal";
import { useIdentity } from "../contexts/IdentityContext";

export const Header: React.FC = () => {
  const { connected, publicKey } = useWallet();
  const { identity, openModal } = useIdentity();
  const [showSmoothModeModal, setShowSmoothModeModal] = useState(false);
  const [showIdentityDropdown, setShowIdentityDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowIdentityDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const truncatedAddress = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
    : "";

  return (
    <>
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo and Nav */}
            <div className="flex items-center space-x-8">
              <Link to="/" className="flex items-center space-x-2">
                <span className="text-2xl font-bold text-purple-400">
                  RetroQuest
                </span>
              </Link>

              <nav className="flex space-x-4">
                {connected && (
                  <>
                    <Link
                      to="/"
                      className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
                    >
                      Boards
                    </Link>
                    <Link
                      to="/create"
                      className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
                    >
                      Create Board
                    </Link>
                  </>
                )}
                <Link
                  to="/pda-explorer"
                  className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
                >
                  PDA Explorer
                </Link>
              </nav>
            </div>

            {/* Session Status, Identity & Wallet Button */}
            <div className="flex items-center gap-3">
              {connected && (
                <SessionStatus
                  compact
                  onEnableClick={() => setShowSmoothModeModal(true)}
                />
              )}

              {/* Identity dropdown */}
              {connected && publicKey && (
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setShowIdentityDropdown(!showIdentityDropdown)}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
                  >
                    <span className={identity ? "text-white" : "text-gray-400 font-mono"}>
                      {identity?.username || truncatedAddress}
                    </span>
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform ${showIdentityDropdown ? "rotate-180" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {showIdentityDropdown && (
                    <div className="absolute right-0 mt-2 w-56 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50">
                      <div className="p-3 border-b border-gray-700">
                        <p className="text-xs text-gray-500">Wallet Address</p>
                        <p className="text-sm text-gray-300 font-mono truncate" title={publicKey.toBase58()}>
                          {publicKey.toBase58()}
                        </p>
                      </div>
                      <div className="p-2">
                        <button
                          onClick={() => {
                            openModal();
                            setShowIdentityDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 rounded-lg transition-colors"
                        >
                          {identity ? "Change Display Name" : "Set Display Name"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-700" />
            </div>
          </div>
        </div>
      </header>

      {/* Smooth Mode Modal */}
      <EnableSmoothModeModal
        isOpen={showSmoothModeModal}
        onClose={() => setShowSmoothModeModal(false)}
      />

      {/* Identity Modal */}
      <IdentityModal />
    </>
  );
};
