/*
    @Api_Name : /GetDesignerlst,
    @Description: To get designer list
    @Last Error Code : 'ERR-MIN-51805'
*/

// Require dependencies
var reqExpress = require('express');
var router = reqExpress.Router();
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');;
var serviceName = 'GetDesignerlst';

// Host api to server
router.post('/GetDesignerlst', function(appRequest, appResposnse) {
    var objLogInfo;
    var mSession = null;
    //this will call when unexpected close or finish
    function finishApiCall() {
        if (mSession) {
            reqTranDBInstance.CallRollback(mSession);
        }
    }
    reqLogInfo.AssignLogInfoDetail(appRequest, function(objLogInfo, objSessionInfo) {
        try {
            objLogInfo.HANDLER_CODE = 'GetDesignerlst'; //correct it
            appResposnse.on('close', function() {
                finishApiCall(appResposnse);
            });
            appResposnse.on('finish', function() {
                finishApiCall(appResposnse);
            });
            appResposnse.on('end', function() {
                finishApiCall(appResposnse);
            });
            reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo);
            var params = appRequest.body;
            var headers = appRequest.headers;
            var sessionInfoKeys = Object.keys(objSessionInfo);
            // This loop is for merge session values with params
            for (var i = 0; i < sessionInfoKeys.length; i++) {
                var currentKey = sessionInfoKeys[i];
                params[currentKey] = objSessionInfo[currentKey];
            }
            reqDBInstance.GetFXDBConnection(headers, 'clt_cas', objLogInfo, function CallbackGetCassandraConn(pClient) {
                try {
                    DesignerInfo();

                    function DesignerInfo() {
                        try {
                            var objDesignerInfo = {};
                            reqDBInstance.GetTableFromFXDB(pClient, 'code_descriptions', ['code_value'], {
                                cd_code: 'STATIC_MODULE'
                            }, objLogInfo, function calbackGetTableFromFXDB(error, result) {
                                try {
                                    if (error) {
                                        reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-51801', 'Error in DesignerInfo function', error);
                                    } else {
                                        if (result.rows.length) {
                                            var arrCodeValue = JSON.parse(result.rows[0].code_value);
                                            objDesignerInfo.STATIC_MODULE = arrCodeValue;
                                            reqInstanceHelper.SendResponse(serviceName, appResposnse, JSON.stringify(objDesignerInfo), objLogInfo);
                                        } else {
                                            reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, '', '', null, 'FAILURE', 'No Designer info found');
                                        }
                                    }
                                } catch (error) {
                                    reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-51802', 'Error in DesignerInfo function', error);
                                }
                            });
                        } catch (error) {
                            reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-51803', 'Error in DesignerInfo function', error);
                        }
                    }
                } catch (error) {
                    reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-51804', 'Error in reqDBInstance.GetFXDBConnection callback', error);
                }
            });
        } catch (error) {
            reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-51805', 'Error in reqLogInfo.AssignLogInfoDetail callback', error);
        }
    });
})
module.exports = router;
/********* End of Service *********/