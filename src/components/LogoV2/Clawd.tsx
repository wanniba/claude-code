import * as React from "react";
import { Box, Text } from "../../ink.js";
import { env } from "../../utils/env.js";
export type ClawdPose = "default" | "arms-up" | "look-left" | "look-right";

type Props = {
  pose?: ClawdPose;
};

// Kakashi head - Q版 colorful design
// Row 1: Silver hair (keeps original Clawd silhouette)
// Row 2: Blue headband + Sharingan eye area
// Row 3: Gray mask chin
//
// Pose varies the visible eye character:
//   default   → ▄ (relaxed, half-block iris)
//   look-left → ▖ (pupil shifted left)
//   look-right→ ▗ (pupil shifted right)
//   arms-up   → █ (wide-open Sharingan!)

const EYE_CHAR: Record<ClawdPose, string> = {
  default: "▄",
  "look-left": "▖",
  "look-right": "▗",
  "arms-up": "█",
};

// Apple Terminal eye chars (inverted rendering)
const APPLE_EYES: Record<ClawdPose, string> = {
  default: " ▄   ▄ ",
  "look-left": " ▖   ▖ ",
  "look-right": " ▗   ▗ ",
  "arms-up": " █   █ ",
};

export function Clawd({ pose = "default" }: Props = {}) {
  if (env.terminal === "Apple_Terminal") {
    return <AppleTerminalClawd pose={pose} />;
  }
  const eye = EYE_CHAR[pose];
  return (
    <Box flexDirection="column">
      {/* Row 1: Silver hair */}
      <Text>
        <Text color="kakashi_hair">{" ▐"}</Text>
        <Text color="kakashi_hair" backgroundColor="clawd_background">
          {"▛███▜"}
        </Text>
        <Text color="kakashi_hair">{"▌"}</Text>
      </Text>
      {/* Row 2: Headband + eye */}
      <Text>
        <Text color="kakashi_hair">{"▝▜"}</Text>
        <Text color="kakashi_headband" backgroundColor="clawd_background">
          {"▄█"}
        </Text>
        <Text color="kakashi_eye" backgroundColor="clawd_background">
          {eye}
        </Text>
        <Text color="kakashi_headband" backgroundColor="clawd_background">
          {"█▄"}
        </Text>
        <Text color="kakashi_hair">{"▛▘"}</Text>
      </Text>
      {/* Row 3: Mask */}
      <Text color="kakashi_mask">{"  ▘▘ ▝▝  "}</Text>
    </Box>
  );
}

function AppleTerminalClawd({ pose }: { pose: ClawdPose }) {
  return (
    <Box flexDirection="column" alignItems="center">
      <Text>
        <Text color="kakashi_hair">▗</Text>
        <Text color="clawd_background" backgroundColor="kakashi_hair">
          {APPLE_EYES[pose]}
        </Text>
        <Text color="kakashi_hair">▖</Text>
      </Text>
      <Text backgroundColor="kakashi_headband">{" ".repeat(7)}</Text>
      <Text color="kakashi_mask">▘▘ ▝▝</Text>
    </Box>
  );
}
