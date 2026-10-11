// BullMQ processors, schedulers and the outbox relay. The code lives in apps/api/src/worker and in each
// feature module (processors are registered next to the service they call); this package is the process entry.
require('@djaber/api/worker/bootstrap')
  .startWorker()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
