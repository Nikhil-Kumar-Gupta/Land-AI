const surveys = [];

function createSurvey(data) {
  const survey = {
    id: Date.now().toString(),
    ...data,
    createdAt: new Date().toISOString()
  };

  surveys.push(survey);

  return survey;
}

function getSurveys() {
  return surveys;
}

module.exports = {
  createSurvey,
  getSurveys
};