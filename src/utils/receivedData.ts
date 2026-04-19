import { PlayerGameState } from "./gameState";

const playerReceivedDataTypeNames = new Set([
  "playerList",
  "chatText",
  "sharedGameState",
] as const);

export type PlayerReceivedData =
  | {
      type: "playerList";
      players: { id: number; name: string; score: number }[];
      myId: number;
      myName: string;
    }
  | {
      type: "chatText";
      text: string;
    }
  | {
      type: "sharedGameState";
      gameState: PlayerGameState;
    };

export function isPlayerReceivedData(obj: unknown): obj is PlayerReceivedData {
  if (
    obj &&
    typeof obj === "object" &&
    "type" in obj &&
    typeof obj.type === "string" &&
    playerReceivedDataTypeNames.has(obj.type as any)
  ) {
    return true;
  }
  return false;
}

const hostReceivedDataTypeNames = new Set([
  "chatRequest",
  "reportGuess",
  "reportTopic",
  "reportReady",
] as const);

export type HostReceivedData =
  | {
      type: "chatRequest";
      text: string;
    }
  | {
      type: "reportGuess";
      guess: number;
    }
  | {
      type: "reportTopic";
      topic: string;
      side1: string;
      side2: string;
      result: number;
    }
  | {
      type: "reportReady";
    };

export function isHostReceivedData(obj: unknown): obj is HostReceivedData {
  if (
    obj &&
    typeof obj === "object" &&
    "type" in obj &&
    typeof obj.type === "string" &&
    hostReceivedDataTypeNames.has(obj.type as any)
  ) {
    return true;
  }
  return false;
}
