/**
 * Api_Name         : /GetErrorCode
 * Description      : To get the Error category
 * Last Error_Code  : ERR-AUT-15203
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
router.post('/GetErrorCategory', function(appRequest, appResponse) {
    var pHeaders = appRequest.headers;
    reqLogInfo.AssignLogInfoDetail(appRequest, function callbackAssignLofInfoDetail(pLogInfo, pSessionInfo) {

        var arrResult = [];
        var DT_INFO = [];
        var DT_TYPE = [];
        var arrDTTInfo = [];
        var objLogInfo = ''
        var strAppId = pSessionInfo.APP_ID; // '1002'

        objLogInfo = pLogInfo;
        objLogInfo.HANDLER_CODE = 'GetErrorCategory-Authentication'

        reqFXDBInstance.GetFXDBConnection(pHeaders, "log_cas", objLogInfo, function callback(pLogSession) {
            __GetErrorDetails(pLogSession, objLogInfo, function callbackGetErrorDetails(pResultArray) {
                if (pResultArray.Status == 'SUCCESS') {
                    var strResult = JSON.stringify(pResultArray);
                    reqInstanceHelpr.SendResponse('GetErrorCategory', appResponse, strResult, objLogInfo, '', '', '')
                } else
                    reqInstanceHelpr.SendResponse('GetErrorCategory', appResponse, '', objLogInfo, pResultArray.ErrorCode, pResultArray.ErrorMsg, pResultArray.Error)
            })
        })

        function __GetErrorDetails(pCasIns, pLogInfo, pCallback) {
            var arrLogs = [];
            reqFXDBInstance.GetTableFromFXDB(pCasIns, 'ERROR_CATEGORY', ['EC_CATEGORY', 'EC_SUB_CATEGORY'], {}, pLogInfo, function callback(pErr, pRes) {
                if (pErr)
                    return _PrepareAndSendCallback('FAILURE', [], 'ERR-AUT-15201', 'Error on querying ERROR_CATEGORY table', pErr, null, pCallback)
                else {
                    try {
                        var arrErrCategory = GetDistinctErrorCategory(pRes.rows);

                        reqAsync.forEachSeries(arrErrCategory, function(ErrCat, catCallback) {
                            var strCatName = '';
                            var objCat = {};

                            if (ErrCat['ec_category'] != undefined && ErrCat['ec_category'] != null && ErrCat['ec_category'] != '')
                                strCatName = ErrCat['ec_category'];

                            objCat.CATEGORY = strCatName;

                            var arrErrSubCat = new reqLinq(pRes.rows)
                                .Where(function(item) {
                                    return item['ec_category'] === strCatName
                                }).ToArray();

                            var arrSubCat = [];
                            reqAsync.forEachSeries(arrErrSubCat, function(ErrSubCat, subCatCallback) {
                                var strErrSubCatName = '';
                                if (ErrSubCat['ec_sub_category'] != undefined && ErrSubCat['ec_sub_category'] != null && ErrSubCat['ec_sub_category'] != '')
                                    strErrSubCatName = ErrSubCat['ec_sub_category'];

                                arrSubCat.push(strErrSubCatName);
                                subCatCallback();
                            }, function(pErr) {
                                objCat.SUB_CATEGORY = arrSubCat;
                                arrLogs.push(objCat);
                                catCallback(); // End callback of SubCategory loop
                            })
                        }, function(pErr) {
                            if (pErr)
                                return _PrepareAndSendCallback('FAILURE', [], 'ERR-AUT-15202', 'Error on __GetErrorDetails() ', pErr, null, pCallback)
                            else
                                return _PrepareAndSendCallback('SUCCESS', arrLogs, '', '', null, null, pCallback)
                        })
                    } catch (ex) {
                        return _PrepareAndSendCallback('FAILURE', [], 'ERR-AUT-15203', 'Error on __GetErrorDetails() ', ex, null, pCallback)
                    }
                }

            })
        }

        function GetDistinctErrorCategory(pRows) {
            var arrCategory = [];
            var tempCategory = [];
            for (var k = 0; k < pRows.length; k++) {
                if (tempCategory.indexOf(pRows[k]['ec_category']) < 0) {
                    tempCategory.push(pRows[k]['ec_category']);
                    arrCategory.push(pRows[k]);
                }
            }
            return arrCategory;
        }

        function _PrintError(pErrCode, pErrMessage, pError) {
            reqInstanceHelpr.PrintError('GetErrorCategory', pError, pErrCode, objLogInfo, pErrMessage)
        }

        function _PrintInfo(pMessage) {
            reqInstanceHelpr.PrintInfo('GetErrorCategory', pMessage, objLogInfo)
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