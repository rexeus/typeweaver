export const finalHandlerShouldNotRun = async () => ({
  statusCode: 500,
  body: { error: "final handler used" },
});
