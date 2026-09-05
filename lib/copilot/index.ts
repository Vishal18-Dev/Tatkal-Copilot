/**
 * The Copilot brain — one shared tool/action layer for every interface
 * (browser voice, calling, and later WhatsApp). Import tools from here.
 *
 * Nothing in this module mutates state or talks to a booking provider: reads
 * come from a context snapshot; actions return validated plans the existing
 * flows enact. See tools.ts for the two hard rules.
 */
export * from "./types";
export * from "./tools";
export * from "./router";
