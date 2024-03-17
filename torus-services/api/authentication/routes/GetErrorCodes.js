/**
 * Api_Name         : /GetErrorCode
 * Description      : To get the error codes
 * Last Error_Code  : ERR-AUT-15302
 **/

// Require dependencies
var modPath = '../../../../node_modules/'
var refPath = '../../../../torus-references/'
var reqExpress = require(modPath + 'express');
var reqLinq = require('node-linq').LINQ;
var reqInstanceHelpr = require(refPath + 'common/InstanceHelper');
var reqLogInfo = require(refPath + 'log/trace/LogInfo');
var reqFXDBInstance = require(refPath + 'instance/DBInstance');
var reqAsync = require('async');

// Initialize Global variables
var router = reqExpress.Router();

// Host the login api
router.post('/GetErrorCodes', function(appRequest, appResponse) {
    var pHeaders = appRequest.headers;
    reqLogInfo.AssignLogInfoDetail(appRequest, function callbackAssignLofInfoDetail(pLogInfo, pSessionInfo) {

        var arrResult = [];
        var DT_INFO = [];
        var DT_TYPE = [];
        var arrDTTInfo = [];
        var objLogInfo = ''
        var strAppId = pSessionInfo.APP_ID; // '1002'
        var strCatName = appRequest.body.PARAMS.CATEGORY_NAME;
        var strErrSubCatName = appRequest.body.PARAMS.SUB_CATEGORY_NAME;

        objLogInfo = pLogInfo;
        objLogInfo.HANDLER_CODE = 'GetErrorCodes-Authentication'

        reqFXDBInstance.GetFXDBConnection(pHeaders, "log_cas", objLogInfo, function callback(pLogSession) {
            __GetErrorDetails(pLogSession, objLogInfo, function callbackGetErrorDetails(pResultArray) {
                if (pResultArray.Status == 'SUCCESS') {
                    var strResult = JSON.stringify(pResultArray);
                    reqInstanceHelpr.SendResponse('GetErrorCodes', appResponse, strResult, objLogInfo, '', '', '')
                } else
                    reqInstanceHelpr.SendResponse('GetErrorCodes', appResponse, '', objLogInfo, pResultArray.ErrorCode, pResultArray.ErrorMsg, pResultArray.Error)
            })
        })


        function __GetErrorDetails(pCasIns, pLogInfo, pCallback) {
            try {
                reqFXDBInstance.GetTableFromFXDB(pCasIns, 'ERROR_CODES', ['EC_DESCRIPTION', 'EC_CODE', 'EC_CATEGORY', 'EC_SUB_CATEGORY'], {
                    ec_category: strCatName,
                    ec_sub_category: strErrSubCatName
                }, pLogInfo, function callback(pError, pResult) {
                    var arrErrorCode = [];
                    if (pError) {
                        return _PrepareAndSendCallback('FAILURE', [], 'ERR-AUT-15301', 'Error on querying ERROR_CATEGORY table', pErrror, null, pCallback)
                    } else if (pResult) {
                        arrErrorCode = __PrepareErrorCode(pResult.rows)
                        return _PrepareAndSendCallback('SUCCESS', arrErrorCode, '', '', null, null, pCallback)
                    }
                })
            } catch (ex) {
                return _PrepareAndSendCallback('FAILURE', [], 'ERR-AUT-15302', 'Error on querying ERROR_CATEGORY table', ex, null, pCallback)
            }
        }

        function __PrepareErrorCode(pErrorCodeRows) {
            var arrErrorCodes = [];
            for (var i = 0; i < pErrorCodeRows.length; i++) {
                var Code = ''
                var Desc = ''
                if (pErrorCodeRows[i]["ec_code"] != undefined && pErrorCodeRows[i]["ec_code"] != null && pErrorCodeRows[i]["ec_code"] != '')
                    Code = pErrorCodeRows[i]["ec_code"];

                if (pErrorCodeRows[i]["ec_description"] != undefined && pErrorCodeRows[i]["ec_description"] != null && pErrorCodeRows[i]["ec_description"] != '')
                    Desc = pErrorCodeRows[i]["ec_description"]

                if (Code != '' && Desc != '') {
                    var objErrCode = {
                        CODE: Code,
                        DESC: Desc
                    }
                    arrErrorCodes.push(objErrCode);
                }
            }
            return arrErrorCodes;
        }

        function _PrintError(pErrCode, pErrMessage, pError) {
            reqInstanceHelpr.PrintError('GetErrorCodes', pError, pErrCode, objLogInfo, pErrMessage)
        }

        function _PrintInfo(pMessage) {
            reqInstanceHelpr.PrintInfo('GetErrorCodes', pMessage, objLogInfo)
        }

        // Prepare callback object
        function _PrepareAndSendCallback(pStatus, pData, pErrorCode, pErrMsg, pError, pWarning, pCallback) {
            var objCallback = {
                Status: pStatus,
                ErrorCode: pErrorCode,
                ErrorMsg: pErrMsg,
                Error: pError,
                Warning: pWarning,
                Data: pData
            }
            return pCallback(objCallback)
        }
    });
});

module.exports = router;