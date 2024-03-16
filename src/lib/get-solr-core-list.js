const { SOLA_SOLR_LIST, SOLA_SOLR_SIZE } = process.env;

export default () =>
  [...Array(Number(SOLA_SOLR_SIZE)).keys()].map((i) => `${SOLA_SOLR_LIST}cl_${i}`);
