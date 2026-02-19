export async function parseCitationQueryNode(state) {
  // Phase A adapter mode: explicit cite parsing node exists but stays passive.
  state.citationQuery = {
    ...state.citationQuery,
    detected: false,
    sectionKey: null,
    sectionId: null,
  };
  return state;
}
