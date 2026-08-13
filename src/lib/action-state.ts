export type ActionState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[]>;
} | null;

export const INITIAL_ACTION_STATE: ActionState = null;
