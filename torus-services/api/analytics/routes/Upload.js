/****
 * Api_Name          : /Upload,
 * Description       : ,
 * Last_Error_Code   : ERR-ANL-5100
 ****/

// Require dependencies
var modPath = '../../../../node_modules/'
var express = require('express');
var path = require('path');
var Fs = require('fs');
var reqTranDBInstance = require('../../../../torus-references/instance/AnalyticInstance');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInsHelper = require('../../../../torus-references/common/InstanceHelper');

// Initialize Global variables
var strResult = '';
var strMessage = '';

var router = express.Router();

// Host the login api
router.post('/Upload', function(appReq, appResp) {

    reqLogInfo.AssignLogInfoDetail(appReq, function (objLogInfo, objSessionInfo) {
    reqLogWriter.Eventinsert(objLogInfo);
    objLogInfo.PROCESS = 'Upload CSV-Analytics';
    objLogInfo.ACTION = 'Upload';
    var strHeader = {};

    if (appReq.headers && appReq.headers.routingkey) {
        strHeader = appReq.headers;
    }
    else {
        strHeader = { 'routingkey': 'CLT-0~APP-0~TNT-0~ENV-0' }
    }
    
    try {
        var csvrefpath = path.join(__dirname, 'Temp',appReq.files.csvfile.name)
        var csvcontent = appReq.files.csvfile;

        Fs.writeFile(csvrefpath, csvcontent, function (err) {
            if (err){
                _SendResponse({}, 'ERR-ANL-111105', 'Error in creating csv file', err, null,objLogInfo);
            }
            else{
                _SendResponse(JSON.stringify({status: 'success'}),'', '', null, null,objLogInfo);
            }
          });
    } catch (error) {
        errorHandler("ERR-ANL-111105", "Error in creating csv file" + error)
    }
});
    // To send the app response
    function _SendResponse(pResponseData, pErrorCode, pErrorMsg, pError, pWarning,pobjLogInfo) {
        var strProcessStatus = (pWarning != null && pWarning != '') ? 'FAILURE' : 'SUCCESS'
        var ResponseData = (pResponseData == null || pResponseData == undefined) ? '' : pResponseData
        return reqInsHelper.SendResponse('Upload', appResp, ResponseData, pobjLogInfo, pErrorCode, pErrorMsg, pError, strProcessStatus, pWarning)
    }
    function errorHandler(errcode, message) {
        console.log(errcode, message);
        reqLogWriter.TraceError(objLogInfo, message, errcode);
    }
});
module.exports = router;