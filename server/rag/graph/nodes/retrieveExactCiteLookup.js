export async function retrieveExactCiteLookupNode(state) {
  // Phase A adapter mode: cite-aware exact lookup is stubbed.
  state.retrieval.exactCitationLookup = null;
  return state;
}
