process.loadEnvFile();

const { SOLA_SOLR_LIST } = process.env;

const status = (
  await fetch(`${SOLA_SOLR_LIST}admin/cores?indexInfo=true&wt=json`).then((res) => res.json())
).status;

const cores = {
  total: {
    current: null,
    hasDeletions: null,
    segmentCount: 0,
    numDocs: 0,
    maxDoc: 0,
    deletedDocs: 0,
    size: 0,
  },
};
for (let id in status) {
  const {
    name,
    index: { current, hasDeletions, segmentCount, numDocs, maxDoc, deletedDocs, size },
  } = status[id];
  cores[name] = {
    current,
    hasDeletions,
    segmentCount,
    numDocs,
    maxDoc,
    deletedDocs,
    size,
  };
  cores.total.segmentCount += segmentCount;
  cores.total.numDocs += numDocs;
  cores.total.maxDoc += maxDoc;
  cores.total.deletedDocs += deletedDocs;
  cores.total.size += Number(size.split(" ")[0]);
}
cores.total.size = `${cores.total.size.toFixed(2)} GB`;

console.table(cores);
