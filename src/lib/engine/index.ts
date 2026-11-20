/**
 * Matching engine — public API (spec §7). Pure functions, no React.
 * FROZEN signatures; the Engine track replaces the STUB bodies in the modules below.
 */
export { rankListings, filterForLobby, applyEvidenceRule, roomsIn, SUBJECTIVE_FEATURES } from "./rank";
export { perPersonRent } from "./rent";
export { explainListing } from "./explain";
export { diffRankings } from "./diff";
export { DEFAULT_WEIGHTS, applyThisOrThat, normalizeWeights } from "./weights";
export { consensus, type ConsensusLabel } from "./consensus";
export { compatibility, rankRoommates, compatLabel, type Compat } from "./compat";
export { scheduleTrips, tripsPerPlace, parseTime, TRIP_GAP_MIN } from "./schedule";
export { estimateTrip, haversineKm, roadKm, modeMinutes } from "./estimate";
export { averageCommute } from "./subscores";
export { ESTIMATE_NOTE } from "./constants";
