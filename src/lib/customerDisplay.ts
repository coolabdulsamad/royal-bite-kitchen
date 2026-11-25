/**
 * BroadcastChannel helpers for the customer-facing display.
 * - POS side: createDisplayPublisher(getState) → publish(state), listens for
 *   state requests and re-publishes automatically.
 * - Display side: subscribeDisplay(onState) → sends a state request on open
 *   so a display launched mid-sale catches up immediately.
 */
import {
  DISPLAY_CHANNEL,
  DISPLAY_REQUEST_STATE,
  type CustomerDisplayState,
  type DisplayChannelMessage,
} from "@contracts/display";

export function createDisplayPublisher() {
  if (typeof BroadcastChannel === "undefined") {
    // very old browser — degrade to no-op, POS keeps working
    return { publish: (_state: CustomerDisplayState) => {}, close: () => {} };
  }
  const channel = new BroadcastChannel(DISPLAY_CHANNEL);
  let current: CustomerDisplayState = { kind: "idle" };

  channel.onmessage = (event: MessageEvent<DisplayChannelMessage>) => {
    if (event.data?.type === DISPLAY_REQUEST_STATE) {
      channel.postMessage({ type: "state", state: current });
    }
  };

  return {
    publish(state: CustomerDisplayState) {
      current = state;
      channel.postMessage({ type: "state", state } satisfies DisplayChannelMessage);
    },
    close() {
      channel.close();
    },
  };
}

export function subscribeDisplay(
  onState: (state: CustomerDisplayState) => void,
): () => void {
  if (typeof BroadcastChannel === "undefined") return () => {};
  const channel = new BroadcastChannel(DISPLAY_CHANNEL);
  channel.onmessage = (event: MessageEvent<DisplayChannelMessage>) => {
    if (event.data?.type === "state") onState(event.data.state);
  };
  channel.postMessage({ type: DISPLAY_REQUEST_STATE } satisfies DisplayChannelMessage);
  return () => channel.close();
}
