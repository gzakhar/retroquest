import React from "react";
import { PublicKey } from "@solana/web3.js";

interface Props {
  address: PublicKey | string;
  identities: Map<string, string>;
  className?: string;
  showAddress?: boolean;
}

function truncateAddress(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export const UsernameDisplay: React.FC<Props> = ({
  address,
  identities,
  className = "",
  showAddress = false,
}) => {
  const addressStr = typeof address === "string" ? address : address.toBase58();
  const username = identities.get(addressStr);

  if (username) {
    if (showAddress) {
      return (
        <span className={className} title={addressStr}>
          {username} <span className="text-gray-500">({truncateAddress(addressStr)})</span>
        </span>
      );
    }
    return (
      <span className={className} title={addressStr}>
        {username}
      </span>
    );
  }

  return (
    <span className={`font-mono ${className}`} title={addressStr}>
      {truncateAddress(addressStr)}
    </span>
  );
};

export function getDisplayName(
  address: PublicKey | string,
  identities: Map<string, string>
): string {
  const addressStr = typeof address === "string" ? address : address.toBase58();
  return identities.get(addressStr) || truncateAddress(addressStr);
}
