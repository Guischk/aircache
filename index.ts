const worker = new Worker("src/worker/index.ts");

worker.onmessage = (e) => {
  console.log(e.data);
};

worker.postMessage({ type: "refresh:start" });
setInterval(() => {
  worker.postMessage({ type: "refresh:start" });
}, 1000 * 60 * 5);
