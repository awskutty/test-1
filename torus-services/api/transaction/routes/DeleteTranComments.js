/*
    @Api_Name           : /SaveTranComments,
    @Description        : To Delete tran comments
    @Last Error Code    : 'ERR-TRX-100403'
*/

// Require dependencies
var reqExpress = require('express');
var router = reqExpress.Router();
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo')
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');

var strServiceName = "DeleteTranComments";
var mSession = null;


//Host the Method to express
router.post('/DeleteTranComments', function(appRequest, appResponse) {
    var objLogInfo;
    try {
        //This will call when unexpected close or finish
        function finishApiCall() {
            if (mSession) {
                reqTranDBInstance.CallRollback(mSession);
            }
        }
        reqLogInfo.AssignLogInfoDetail(appRequest, function(objLogInfo, objSessionInfo) {
            objLogInfo.HANDLER_CODE = 'DELETE_TRAN_COMMENT';
            // Handle the close event when client closes the api request
            appResponse.on('close', function() { // This will call unexpected close from client
                finishApiCall();
            });
            appResponse.on('finish', function() {
                finishApiCall();
            });
            appResponse.on('end', function() {
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
            reqTranDBInstance.GetTranDBConn(headers, false, function(pSession) {
                mSession = pSession;
                DeleteTranComments(params);

                function DeleteTranComments(pClientparams) {
                    try {
                        var strResult = "FAILURE";
                        var objTrancomments = {};
                        objTrancomments.TC_ID = pClientparams.TC_ID;
                        reqTranDBInstance.DeleteTranDB(mSession, 'TRANSACTION_COMMENTS', {
                            TC_ID: objTrancomments.TC_ID
                        }, objLogInfo, function(result, error) {
                            if (error) {
                                reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-TRX-100401', 'Error While Deleting in TRANSACTION_COMMENTS table', error);
                            } else {
                                reqInstanceHelper.SendResponse(strServiceName, appResponse, 'SUCCESS', objLogInfo);
                            }
                        });
                    } catch (error) {
                        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-TRX-100402', 'Error in callig DeleteTranComments table', error, '', '');
                    }
                }
            });
        });
    } catch (error) {
        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-TRX-100403', 'Error in calling DeleteTranComments API function', error, '', '');
    }
});

module.exports = router;
/*********** End of Service **********/