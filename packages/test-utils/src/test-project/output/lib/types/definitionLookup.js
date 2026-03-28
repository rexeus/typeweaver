export const getOperationDefinition = (spec, resourceName, operationId) => {
  const operation = spec.resources[resourceName]?.operations.find(
    (candidate) => candidate.operationId === operationId,
  );
  if (operation === undefined) {
    throw new Error(
      `Missing operation definition '${String(resourceName)}.${String(operationId)}'.`,
    );
  }
  return operation;
};
export const getResponseDefinition = (responses, responseName) => {
  const response = responses.find((candidate) => candidate.name === responseName);
  if (response === undefined) {
    throw new Error(`Missing response definition '${String(responseName)}'.`);
  }
  return response;
};
