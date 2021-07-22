const { SOLA_SOLR_LIST, SOLA_SOLR_SIZE, TRACE_ALGO } = process.env;

export default () =>
  [...Array(SOLA_SOLR_SIZE).keys()].map((i) => `${SOLA_SOLR_LIST}${TRACE_ALGO}_${i}`);
