/****
 * Api_Name          : /getkafkatopiclist,
 * Description       : ,
 * Last_Error_Code   : ERR-ANL-5100
 ****/

// Require dependencies
var modPath = '../../../../node_modules/'
var express = require(modPath + 'express');
var kafka = require(modPath + 'kafka-node');
var reqTranDBInstance = require('../../../../torus-references/instance/AnalyticInstance');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInsHelper = require('../../../../torus-references/common/InstanceHelper');

// Initialize Global variables
var strResult = '';
var strMessage = '';

var router = express.Router();

// Host the login api
router.post('/getkafkatopiclist', function(appReq, appResp) {

  reqLogInfo.AssignLogInfoDetail(appReq, function (objLogInfo, objSessionInfo) {
    reqLogWriter.Eventinsert(objLogInfo);
    objLogInfo.PROCESS = 'getkafkatopiclist-Analytics';
    objLogInfo.ACTION = 'getkafkatopiclist';
    var strHeader = {};

    if (appReq.headers && appReq.headers.routingkey) {
        strHeader = appReq.headers;
        strHeader.routingkey = "CLT-0~APP-0~TNT-0~ENV-0";
    }
    else {
        strHeader = { 'routingkey': 'CLT-0~APP-0~TNT-0~ENV-0' }
    }

    var Client = kafka.Client;
    var client ;
    
    try {    
        client = new Client(appReq.body.kafkamast_id.code);
        var temparry = [];
        client.once('connect', function () {
          client.loadMetadataForTopics([], function (error, results) {
            if (error) {
              _SendResponse({}, 'ERR-ANL-111105', 'Error in getting topics from kaka', error, null,objLogInfo);
            }
            for(var key in results[1].metadata){
              temparry.push({topic:key});
            }
            _SendResponse(JSON.stringify({status: 'success',data:temparry}), '', '', null, null,objLogInfo);
          });
      });
    } catch (error) {
      errorHandler("ERR-ANL-111105", "Error in getting kafkatopic for kafka masters" + error)
    }
  });
    // To send the app response
    function _SendResponse(pResponseData, pErrorCode, pErrorMsg, pError, pWarning,pobjLogInfo) {
      var strProcessStatus = (pWarning != null && pWarning != '') ? 'FAILURE' : 'SUCCESS'
      var ResponseData = (pResponseData == null || pResponseData == undefined) ? '' : pResponseData
      return reqInsHelper.SendResponse('ChangeSearchTag', appResp, ResponseData, pobjLogInfo, pErrorCode, pErrorMsg, pError, strProcessStatus, pWarning)
  }

  function errorHandler(errcode, message) {
      console.log(errcode, message);
      reqLogWriter.TraceError(objLogInfo, message, errcode);
  }
});
module.exports = router;