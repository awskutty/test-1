/****
 * Api_Name          : /Queryexecdetailfetch,
 * Description       : ,
 * Last_Error_Code   : ERR-ANL-5100
 ****/

// Require dependencies
var modPath = '../../../../node_modules/'
var express = require(modPath + 'express');
var reqTranDBInstance = require('../../../../torus-references/instance/AnalyticInstance');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInsHelper = require('../../../../torus-references/common/InstanceHelper');

// Initialize Global variables
var strResult = '';
var strMessage = '';

var router = express.Router();

// Host the login api
router.post('/queryexecdetailfetch', function(appReq, appResp) {

  reqLogInfo.AssignLogInfoDetail(appReq, function (objLogInfo, objSessionInfo) {
    reqLogWriter.Eventinsert(objLogInfo);
    objLogInfo.PROCESS = 'queryexecdetailfetch-Analytics';
    objLogInfo.ACTION = 'queryexecdetailfetch';
    var strHeader = {};

    if (appReq.headers && appReq.headers.routingkey) {
        strHeader = appReq.headers;
        strHeader.routingkey = "CLT-0~APP-0~TNT-0~ENV-0";
    }
    else {
        strHeader = { 'routingkey': 'CLT-0~APP-0~TNT-0~ENV-0' }
    }

    var query = "SELECT query_string, data_source, data_destination FROM project_queries where name = '"+appReq.body.query_name+"';"

    try {
        reqTranDBInstance.GetTranDBConn(strHeader, false, function callbackGetTranDB(pSession) {
          reqTranDBInstance.ExecuteSQLQuery(pSession, query, objLogInfo, function callback(res, err) {
            if (err) {
                _SendResponse({}, 'ERR-ANL-111105', 'Error selecting from project_queries Table', err, null,objLogInfo);
            }
            else {
                _SendResponse(JSON.stringify({status: 'success',data:res.rows}),'', '', null, null,objLogInfo);
            }
          })
        })
      } catch (error) {
        errorHandler("ERR-ANL-111105", "Error in getting trandb function in datasourceconfig" + error)
      }
    });
  // To send the app response
  function _SendResponse(pResponseData, pErrorCode, pErrorMsg, pError, pWarning,pobjLogInfo) {
    var strProcessStatus = (pWarning != null && pWarning != '') ? 'FAILURE' : 'SUCCESS'
    var ResponseData = (pResponseData == null || pResponseData == undefined) ? '' : pResponseData
    return reqInsHelper.SendResponse('Queryexecdetailfetch', appResp, ResponseData, pobjLogInfo, pErrorCode, pErrorMsg, pError, strProcessStatus, pWarning)
  }

  function errorHandler(errcode, message) {
    console.log(errcode, message);
    reqLogWriter.TraceError(objLogInfo, message, errcode);
  }
});
module.exports = router;