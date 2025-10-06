const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const patientProfile = require('../patientProfile/index.js');
const { handleGetPatientFullDetail } = patientProfile;

exports.main = async event => {
  const action = (event && event.action) || 'detail';

  switch (action) {
    case 'detail':
    case 'fullDetail':
      return await handleGetPatientFullDetail(event || {});
    case 'list':
    case 'delete':
      return await patientProfile.main(event || {});
    default:
      return await patientProfile.main(event || {});
  }
};
