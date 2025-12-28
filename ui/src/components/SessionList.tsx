import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useProgram } from "../hooks/useProgram";
import {
  findTeamRegistryPda,
  findSessionPda,
} from "../utils/pda";
import {
  deserializeTeamRegistry,
  deserializeSession,
} from "../utils/deserialize";
import { SessionWithAddress, STAGE_NAMES, PROGRAM_ID } from "../types";

export const SessionList: React.FC = () => {
  const { connected, publicKey } = useWallet();
  const { connection, getAccountInfo } = useProgram();
  const [sessions, setSessions] = useState<SessionWithAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSessions = async () => {
      if (!publicKey) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Get team registry to find session count
        const [teamRegistryPda] = findTeamRegistryPda(publicKey, PROGRAM_ID);
        const teamRegistryAccount = await getAccountInfo(teamRegistryPda);

        if (!teamRegistryAccount) {
          // No team registry yet - user hasn't created any sessions
          setSessions([]);
          setLoading(false);
          return;
        }

        const teamRegistry = deserializeTeamRegistry(
          Buffer.from(teamRegistryAccount.data)
        );

        // Fetch all sessions for this team
        const sessionAddresses: PublicKey[] = [];
        for (let i = 0n; i < teamRegistry.sessionCount; i++) {
          const [sessionPda] = findSessionPda(publicKey, i, PROGRAM_ID);
          sessionAddresses.push(sessionPda);
        }

        if (sessionAddresses.length > 0) {
          const sessionAccounts =
            await connection.getMultipleAccountsInfo(sessionAddresses);

          const fetchedSessions: SessionWithAddress[] = [];
          sessionAccounts.forEach((account, index) => {
            if (account) {
              fetchedSessions.push({
                address: sessionAddresses[index],
                data: deserializeSession(Buffer.from(account.data)),
              });
            }
          });

          // Sort by session index (newest first)
          fetchedSessions.sort((a, b) =>
            Number(b.data.sessionIndex - a.data.sessionIndex)
          );
          setSessions(fetchedSessions);
        }

        setLoading(false);
      } catch (err) {
        console.error("Error fetching sessions:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
        setLoading(false);
      }
    };

    fetchSessions();
  }, [publicKey, connection, getAccountInfo]);

  if (!connected) {
    return (
      <div className="text-center py-16">
        <h2 className="text-2xl font-bold text-gray-200 mb-4">
          Welcome to RetroQuest
        </h2>
        <p className="text-gray-400 mb-8">
          Connect your Phantom wallet to get started
        </p>
        <div className="text-6xl mb-4">🎯</div>
        <p className="text-gray-500 text-sm">
          Run retrospectives on Solana blockchain
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
        <p className="text-gray-400 mt-4">Loading sessions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-red-400 mb-4">Error: {error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Your Sessions</h1>
        <Link
          to="/create"
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium"
        >
          + New Session
        </Link>
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-16 bg-gray-800 rounded-xl border border-gray-700">
          <div className="text-5xl mb-4">📝</div>
          <h3 className="text-xl font-medium text-gray-200 mb-2">
            No sessions yet
          </h3>
          <p className="text-gray-400 mb-6">
            Create your first retrospective session to get started
          </p>
          <Link
            to="/create"
            className="inline-block px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium"
          >
            Create Session
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sessions.map((session) => (
            <Link
              key={session.address.toString()}
              to={`/session/${session.address.toString()}`}
              className="block bg-gray-800 rounded-xl border border-gray-700 p-6 hover:border-purple-500 transition-colors"
            >
              <div className="flex justify-between items-start mb-4">
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    session.data.closed
                      ? "bg-gray-600 text-gray-300"
                      : "bg-purple-600 text-white"
                  }`}
                >
                  {session.data.closed
                    ? "Closed"
                    : STAGE_NAMES[session.data.stage]}
                </span>
                <span className="text-gray-500 text-sm">
                  #{session.data.sessionIndex.toString()}
                </span>
              </div>

              <h3 className="text-lg font-medium mb-2">
                Session {session.data.sessionIndex.toString()}
              </h3>

              <div className="text-gray-400 text-sm space-y-1">
                <p>{session.data.categories.length} categories</p>
                <p>{session.data.allowlist.length} participants</p>
                <p>{session.data.noteCount.toString()} notes</p>
                <p>{session.data.groupCount.toString()} groups</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};
