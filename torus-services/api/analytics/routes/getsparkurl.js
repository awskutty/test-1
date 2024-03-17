/****
 * Api_Name          : /Upload,
 * Description       : ,
 * Last_Error_Code   : ERR-ANL-5100
 ****/

// Require dependencies
var modPath = '../../../../node_modules/'
var express = require(modPath + 'express');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInsHelper = require('../../../../torus-references/common/InstanceHelper');
// Initialize Global variables

var strResult = '';
var strMessage = '';

var router = express.Router();

// Host the login api
router.post('/getsparkurlkey', function (appReq, appResp) {
    reqLogInfo.AssignLogInfoDetail(appReq, function (objLogInfo, objSessionInfo) {
        reqLogWriter.Eventinsert(objLogInfo);
        objLogInfo.PROCESS = 'Getsparkserviceurl-Analytics';
        objLogInfo.ACTION = 'sparkserviceurl';

        try {
            reqInsHelper.GetConfig('SPARK-ANALYTICS', function callbackGetKey(pConfig,pError) {
                if(pError){
                    _SendResponse({}, 'ERR-ANL-111105', 'Error selecting from project Table', err, null,objLogInfo);
                }
                else{
                    _SendResponse(JSON.stringify({ status: 'success', data: JSON.parse(pConfig)}), '', '', null, null,objLogInfo);
                }
            })
        } catch (error) {
            errorHandler("ERR-ANL-111105", "Error in getting trandb function in datasourceconfig" + error)
        }
    })

  // To send the app response
  function _SendResponse(pResponseData, pErrorCode, pErrorMsg, pError, pWarning,pobjLogInfo) {
    var strProcessStatus = (pWarning != null && pWarning != '') ? 'FAILURE' : 'SUCCESS'
    var ResponseData = (pResponseData == null || pResponseData == undefined) ? '' : pResponseData
    return reqInsHelper.SendResponse('sparkserviceurl', appResp, ResponseData, pobjLogInfo, pErrorCode, pErrorMsg, pError, strProcessStatus, pWarning)
  }

  function errorHandler(errcode, message) {
    console.log(errcode, message);
    reqLogWriter.TraceError(objLogInfo, message, errcode);
  }
});
module.exports = router;