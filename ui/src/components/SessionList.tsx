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
  deserializeParticipantEntry,
} from "../utils/deserialize";
import { SessionWithAddress, STAGE_NAMES, PROGRAM_ID } from "../types";

const PARTICIPANT_ENTRY_SIZE = 67; // 1 + 32 + 32 + 1 + 1

export const SessionList: React.FC = () => {
  const { connected, publicKey } = useWallet();
  const { connection, getAccountInfo } = useProgram();
  const [sessions, setSessions] = useState<SessionWithAddress[]>([]);
  const [participatingSessions, setParticipatingSessions] = useState<SessionWithAddress[]>([]);
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

        // Fetch own sessions and participating sessions in parallel
        const [ownSessions, participatingData] = await Promise.all([
          fetchOwnSessions(),
          fetchParticipatingSessions(),
        ]);

        setSessions(ownSessions);
        setParticipatingSessions(participatingData);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching sessions:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
        setLoading(false);
      }
    };

    // Fetch sessions where user is the team authority (facilitator)
    const fetchOwnSessions = async (): Promise<SessionWithAddress[]> => {
      if (!publicKey) return [];

      const [teamRegistryPda] = findTeamRegistryPda(publicKey, PROGRAM_ID);
      const teamRegistryAccount = await getAccountInfo(teamRegistryPda);

      if (!teamRegistryAccount) {
        return [];
      }

      const teamRegistry = deserializeTeamRegistry(
        Buffer.from(teamRegistryAccount.data)
      );

      const sessionAddresses: PublicKey[] = [];
      for (let i = 0n; i < teamRegistry.sessionCount; i++) {
        const [sessionPda] = findSessionPda(publicKey, i, PROGRAM_ID);
        sessionAddresses.push(sessionPda);
      }

      if (sessionAddresses.length === 0) return [];

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

      return fetchedSessions;
    };

    // Fetch sessions where user is a participant (via ParticipantEntry)
    const fetchParticipatingSessions = async (): Promise<SessionWithAddress[]> => {
      if (!publicKey) return [];

      // Query ParticipantEntry accounts where participant == connected wallet
      const participantEntries = await connection.getProgramAccounts(PROGRAM_ID, {
        filters: [
          { dataSize: PARTICIPANT_ENTRY_SIZE },
          { memcmp: { offset: 33, bytes: publicKey.toBase58() } },
        ],
      });

      if (participantEntries.length === 0) return [];

      // Extract unique session addresses
      const sessionAddresses: PublicKey[] = [];
      const seenSessions = new Set<string>();

      for (const entry of participantEntries) {
        const entryData = deserializeParticipantEntry(Buffer.from(entry.account.data));
        const sessionKey = entryData.session.toString();
        if (!seenSessions.has(sessionKey)) {
          seenSessions.add(sessionKey);
          sessionAddresses.push(entryData.session);
        }
      }

      // Fetch session accounts
      const sessionAccounts =
        await connection.getMultipleAccountsInfo(sessionAddresses);

      const fetchedSessions: SessionWithAddress[] = [];
      sessionAccounts.forEach((account, index) => {
        if (account) {
          const sessionData = deserializeSession(Buffer.from(account.data));
          // Exclude sessions where user is the team authority (those are in "Your Sessions")
          if (!sessionData.teamAuthority.equals(publicKey)) {
            fetchedSessions.push({
              address: sessionAddresses[index],
              data: sessionData,
            });
          }
        }
      });

      // Sort by created slot (newest first)
      fetchedSessions.sort((a, b) =>
        Number(b.data.createdAtSlot - a.data.createdAtSlot)
      );

      return fetchedSessions;
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

  const renderSessionCard = (session: SessionWithAddress, isParticipating = false) => (
    <Link
      key={session.address.toString()}
      to={`/session/${session.address.toString()}`}
      className={`block bg-gray-800 rounded-xl border p-6 hover:border-purple-500 transition-colors ${
        isParticipating ? "border-green-700" : "border-gray-700"
      }`}
    >
      <div className="flex justify-between items-start mb-4">
        <span
          className={`px-2 py-1 rounded text-xs font-medium ${
            session.data.closed
              ? "bg-gray-600 text-gray-300"
              : "bg-purple-600 text-white"
          }`}
        >
          {session.data.closed ? "Closed" : STAGE_NAMES[session.data.stage]}
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
  );

  const hasNoSessions = sessions.length === 0 && participatingSessions.length === 0;

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Sessions</h1>
        <Link
          to="/create"
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium"
        >
          + New Session
        </Link>
      </div>

      {hasNoSessions ? (
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
        <div className="space-y-8">
          {/* Your Sessions (as facilitator) */}
          {sessions.length > 0 && (
            <div>
              <h2 className="text-lg font-medium text-gray-300 mb-4">
                Your Sessions
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {sessions.map((session) => renderSessionCard(session, false))}
              </div>
            </div>
          )}

          {/* Participating In (as participant) */}
          {participatingSessions.length > 0 && (
            <div>
              <h2 className="text-lg font-medium text-gray-300 mb-4">
                Participating In
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {participatingSessions.map((session) =>
                  renderSessionCard(session, true)
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
