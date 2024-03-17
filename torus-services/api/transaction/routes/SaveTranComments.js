/*
    @Api_Name           : /SaveTranComments,
    @Description        : To save transaction comments
    @Last Error Code    : 'ERR-TRX-100305'
*/

// Require dependencies
var modPath = '../../../../node_modules/';
var reqExpress = require(modPath + 'express');
var reqHashTable = require(modPath + 'jshashtable');
var router = reqExpress.Router();
var reqLINQ = require(modPath + 'node-linq').LINQ;
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var strServiceName = "SaveTranComments";
var mSession;

// Host api to server
router.post('/SaveTranComments', function (appRequest, appResponse) {
    var objLogInfo;
    try {
        //This will call when unexpected close or finish
        function finishApiCall() {
            if (mSession) {
                reqTranDBInstance.CallRollback(mSession);
            }
        }
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
            try {
                objLogInfo.HANDLER_CODE = 'SAVE_TRAN_COMMENT';
                // Handle the close event when client closes the api request
                appResponse.on('close', function () { // This will call unexpected close from client
                    finishApiCall();
                    reqLogWriter.EventUpdate(objLogInfo);
                });
                appResponse.on('finish', function () {
                    finishApiCall();
                });
                appResponse.on('end', function () {
                    finishApiCall();
                });
                reqInstanceHelper.PrintInfo(strServiceName, 'Begin', objLogInfo);
                var params = appRequest.body.PARAMS;
                var headers = appRequest.headers;
                var sessionInfoKeys = Object.keys(objSessionInfo);
                // This loop is for merge session values with params
                for (var i = 0; i < sessionInfoKeys.length; i++) {
                    var currentKey = sessionInfoKeys[i];
                    params[currentKey] = objSessionInfo[currentKey];
                }
                reqTranDBInstance.GetTranDBConn(headers, false, function (pSession) {
                    mSession = pSession;
                    reqInstanceHelper.PrintInfo(strServiceName, 'Calling SaveTranComments Function', objLogInfo);
                    SaveTranComments(params);

                    function SaveTranComments(pClientparams) {
                        try {
                            var strResult = "FAILURE";
                            var objTrancomments = {};
                            var strTcId = pClientparams.TC_ID;
                            objTrancomments.TS_ID = pClientparams.TS_ID;
                            objTrancomments.STPC_ID = pClientparams.STPC_ID;
                            objTrancomments.COMMENT_TEXT = pClientparams.COMMENT_TEXT;
                            if (strTcId > 0) {
                                objTrancomments.MODIFIED_BY = pClientparams.UserId;
                                objTrancomments.MODIFIED_BY_STS_ID = pClientparams.STSId;
                                reqInstanceHelper.PrintInfo(strServiceName, 'Updating in TRANSACTION_COMMENTS table', objLogInfo);
                                reqTranDBInstance.UpdateTranDBWithAudit(mSession, 'TRANSACTION_COMMENTS', objTrancomments, {
                                    TC_ID: strTcId
                                }, objLogInfo, function (pRes, pError) {
                                    if (pError) {
                                        return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-TRX-100301', 'Error while updating TRANSACTION_COMMENTS table ', pError, '', '');
                                    } else {
                                        return reqInstanceHelper.SendResponse(strServiceName, appResponse, 'SUCCESS', objLogInfo);
                                    }
                                });
                            } else {
                                objTrancomments.CREATED_BY_STS_ID = pClientparams.STS_ID;
                                objTrancomments.APP_ID = objLogInfo.APP_ID;
                                objTrancomments.TENANT_ID = objLogInfo.TENANT_ID;
                                reqInstanceHelper.PrintInfo(strServiceName, 'Inserting in TRANSACTION_COMMENTS table', objLogInfo);
                                reqTranDBInstance.InsertTranDBWithAudit(mSession, 'TRANSACTION_COMMENTS', [objTrancomments], objLogInfo, function (pRes, pError) {
                                    if (pError) {
                                        return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-TRX-100302', 'Error while Inserting in TRANSACTION_COMMENTS  table', pError, '', '');
                                    } else {
                                        return reqInstanceHelper.SendResponse(strServiceName, appResponse, 'SUCCESS', objLogInfo, '', '', '', '', '');
                                    }
                                });
                            }
                        } catch (error) {
                            return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-TRX-100303', 'Error in calling SaveTranComments function', error, '', '');
                        }
                    }
                });
            } catch (error) {
                return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-TRX-100305', 'Error in calling SaveTranComments function', error, '', '');
            }
        });
    } catch (error) {
        return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-TRX-100304', 'Error in calling SaveTranComments API function', error, '', '');
    }
});

module.exports = router;
/*********** End of Service **********/