// -- Boot-time settled signals ------------------------------------------------

// Boot writers resolve these so URL imports apply only after the restore and the ?v= project decision.
let _markPersistenceSettled: () => void = () => {};
let persistenceSettled: Promise<void> = new Promise<void>((resolve) => {
  _markPersistenceSettled = resolve;
});

let _markHashImportSettled: () => void = () => {};
let hashImportSettled: Promise<void> = new Promise<void>((resolve) => {
  _markHashImportSettled = resolve;
});

type LinkProjectOutcome = "none" | "current" | "reopened" | "created" | "failed";

let _markLinkProjectSettled: (outcome: LinkProjectOutcome) => void = () => {};
let linkProjectSettled: Promise<LinkProjectOutcome> = new Promise<LinkProjectOutcome>((resolve) => {
  _markLinkProjectSettled = resolve;
});

let _markLinkedFilesSettled: (outcome: LinkProjectOutcome) => void = () => {};
let linkedFilesSettled: Promise<LinkProjectOutcome> = new Promise<LinkProjectOutcome>((resolve) => {
  _markLinkedFilesSettled = resolve;
});

let _markQueryImportSettled: () => void = () => {};
let queryImportSettled: Promise<void> = new Promise<void>((resolve) => {
  _markQueryImportSettled = resolve;
});

function getPersistenceSettled(): Promise<void> {
  return persistenceSettled;
}

function markPersistenceSettled(): void {
  _markPersistenceSettled();
}

function getHashImportSettled(): Promise<void> {
  return hashImportSettled;
}

function markHashImportSettled(): void {
  _markHashImportSettled();
}

function getLinkProjectSettled(): Promise<LinkProjectOutcome> {
  return linkProjectSettled;
}

function markLinkProjectSettled(outcome: LinkProjectOutcome): void {
  _markLinkProjectSettled(outcome);
}

function getLinkedFilesSettled(): Promise<LinkProjectOutcome> {
  return linkedFilesSettled;
}

function markLinkedFilesSettled(outcome: LinkProjectOutcome): void {
  _markLinkedFilesSettled(outcome);
}

function getQueryImportSettled(): Promise<void> {
  return queryImportSettled;
}

function markQueryImportSettled(): void {
  _markQueryImportSettled();
}

function __resetPersistenceSettledForTests(): void {
  persistenceSettled = new Promise<void>((resolve) => {
    _markPersistenceSettled = resolve;
  });
  hashImportSettled = new Promise<void>((resolve) => {
    _markHashImportSettled = resolve;
  });
  linkProjectSettled = new Promise<LinkProjectOutcome>((resolve) => {
    _markLinkProjectSettled = resolve;
  });
  linkedFilesSettled = new Promise<LinkProjectOutcome>((resolve) => {
    _markLinkedFilesSettled = resolve;
  });
  queryImportSettled = new Promise<void>((resolve) => {
    _markQueryImportSettled = resolve;
  });
}

// -- Exports ------------------------------------------------------------------

export {
  getPersistenceSettled,
  markPersistenceSettled,
  getHashImportSettled,
  markHashImportSettled,
  getLinkProjectSettled,
  markLinkProjectSettled,
  getLinkedFilesSettled,
  markLinkedFilesSettled,
  getQueryImportSettled,
  markQueryImportSettled,
  __resetPersistenceSettledForTests,
};
export type { LinkProjectOutcome };
