/*
@Api_Name : /SaveScanConfig,
@Description: To Restore from backup
@Last_Error_code:ERR-UI-111104
*/


var reqExpress = require('express');
var router = reqExpress.Router();
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance')
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInsHelper = require('../../../../torus-references/common/InstanceHelper');
var strServiceName = 'SaveScanConfig';
// API hosting
router.post('/SaveScanConfig', function (appRequest, appResponse, next) {
    try {
        var objLogInfo;
        reqLogInfo.AssignLogInfoDetail(appRequest, function (pLogInfo, objSessionInfo) {
            // Handle the api close event from when client close the request
            objLogInfo = pLogInfo;
            appResponse.on('close', function () { });
            appResponse.on('finish', function () { });
            appResponse.on('end', function () { });
            _PrintInfo('Begin')
            var strInputParamJson = appRequest.body.PARAMS.SELROW;
            var strClient_id = objSessionInfo.CLIENT_ID
            var strTntId = objSessionInfo.TENANT_ID || "0";
            var scs_code = strInputParamJson.scs_code
            var scan_options = strInputParamJson.scan_options
            objLogInfo.HANDLER_CODE = 'SaveScanConfig-UI';
            // Function call
            scan_options = "<?xml version='1.0'?>" + scan_options
            // Module returns an XML string 
            _Prepareparams();
            function _Prepareparams() {
                try {
                    reqFXDBInstance.GetFXDBConnection(appRequest.headers, 'clt_cas', objLogInfo, function Callback_GetCassandraConn(mClient) {
                        var cond = {
                            client_id: strClient_id,
                            tenant_id: strTntId,
                            scs_code: scs_code
                        }
                        reqFXDBInstance.GetTableFromFXDB(mClient, 'scan_settings', [], cond, objLogInfo, function (error, result) {
                            if (error) {
                                reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'errcode', 'errmsg', pError);
                            } else {
                                if (result.rows.length) {
                                    reqFXDBInstance.UpdateFXDB(mClient, 'scan_settings', { scan_options: scan_options }, cond, objLogInfo, function (error, result) {
                                        if (error) {
                                            reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'errcode', 'errmsg', pError);
                                        } else {
                                            reqInsHelper.SendResponse(strServiceName, appResponse, 'SUCCESS', objLogInfo);
                                        }
                                    });
                                } else {
                                    reqFXDBInstance.InsertFXDB(mClient, 'scan_settings', [{
                                        client_id: strClient_id,
                                        tenant_id: strTntId,
                                        scs_code: scs_code,
                                        scan_options: scan_options,
                                    }], objLogInfo, function SELTCLIENT(pError, pResult) {
                                        if (pError) {
                                            reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-111104', 'Error In tenant_setup Table Execution', pError);
                                        } else {
                                            try {
                                                reqInsHelper.SendResponse(strServiceName, appResponse, 'SUCCESS', objLogInfo);
                                            } catch (error) {
                                                reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-111101', 'Error In tenant_setup Table Execution', error);
                                            }
                                        }
                                    });
                                }
                            }
                        });
                    });
                } catch (error) {
                    reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-111102', 'Error In _Prepareparams function', error);
                }
            }
        })
    } catch (error) {
        reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-111103', 'Error In SaveScanParams ', error);
    }

    // Print Log information
    function _PrintInfo(pMessage) {
        reqInsHelper.PrintInfo(strServiceName, pMessage, objLogInfo)
    }
    // Print Log Error
    function _PrintErr(pError, pErrorCode, pMessage) {
        reqInsHelper.PrintError(strServiceName, pError, pErrorCode, objLogInfo, pMessage)
    }
});



module.exports = router;
// End function