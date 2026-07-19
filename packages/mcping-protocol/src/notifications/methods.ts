const NAMESPACE = 'notifications/mcping';

/** JSON-RPC method names for mcping's server → client notifications. */
export const MCPING_METHODS = {
  /** Native push notification — the app shows a system notification. */
  push: `${NAMESPACE}/push`,
  /** Reserved for driving a desktop app / sending a prompt; not parsed yet. */
  action: `${NAMESPACE}/action`,
} as const;

export type McpingMethod = (typeof MCPING_METHODS)[keyof typeof MCPING_METHODS];
