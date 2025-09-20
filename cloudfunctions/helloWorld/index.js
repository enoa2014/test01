exports.main = async (event, context) => {
  const { timestamp } = event;
  return {
    message: `Cloud function helloWorld executed successfully at ${timestamp || Date.now()}`,
    event
  };
};
