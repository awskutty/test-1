var express = require('../../../../node_modules/express');
var router = express.Router();
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var captchahelper = require('../routes/helper/LoginPageHelper');
router.post('/GetCaptcha', function (appRequest, appResponse) {
  try {
    var serviceName = 'GetCaptcha';
    var objLogInfo = ''
    var pHeaders = appRequest.headers;
    reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo);
    reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, sessionInfo) {
      var params = appRequest.body.PARAMS;
      captchahelper.GetCaptcha(params, pHeaders, objLogInfo, function (error, res) {
        if (error) {
          return reqInstanceHelper.SendResponse(servicename, appResponse, '', objLogInfo, 'ERR-AUTH-16001', 'error occured hile generate the captcha', error, 'FAILURE', '');
        } else {
          reqInstanceHelper.PrintInfo(serviceName, 'Get captcha end', objLogInfo);
          reqInstanceHelper.SendResponse(serviceName, appResponse, res, objLogInfo, '', '', '', '', '');
        }
      });
    })

  } catch (error) {
    reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-AUTH-15124', 'Exception occured while create captcha ', error, '', '');
  }

});
module.exports = router;
//*******End of Serive*******//
