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
  getQueryImportSettled,
  markQueryImportSettled,
  __resetPersistenceSettledForTests,
};
