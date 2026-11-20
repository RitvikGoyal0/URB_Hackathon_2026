/**
 * Matching engine — public API (spec §7). Pure functions, no React.
 * FROZEN signatures; the Engine track replaces the STUB bodies in the modules below.
 */
export { rankListings } from "./rank";
export { perPersonRent } from "./rent";
export { explainListing } from "./explain";
export { diffRankings } from "./diff";
export { DEFAULT_WEIGHTS, applyThisOrThat, normalizeWeights } from "./weights";
export { consensus, type ConsensusLabel } from "./consensus";
