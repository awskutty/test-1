/*
@Api_Name : /ExportTenantSetup,
@Description: To export tenant Setup Table
 * @Last_Error_code:ERR-UI-110503
*/

// Require dependencies
var modPath = '../../../../node_modules/'
var reqExpress = require(modPath + 'express');
var router = reqExpress.Router();
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance')
var reqLinq = require(modPath + 'node-linq').LINQ;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInsHelper = require('../../../../torus-references/common/InstanceHelper');
var strServiceName = 'Exporttenantsetup'


router.post('/ExportTenantSetup', function(appRequest, appResponse, next) {
    var objLogInfo = ''
    try {
        reqLogInfo.AssignLogInfoDetail(appRequest, function(LogInfo, objSessionInfo) {
            objLogInfo = LogInfo
                // Handle the api close event from when client close the request

            appResponse.on('close', function() {});
            appResponse.on('finish', function() {});
            appResponse.on('end', function() {});
            _PrintInfo('Begin')
                // Initialize local variables

            var strInputParamJson = appRequest.body.PARAMS;
            var strAppId = objSessionInfo.APP_ID;
            var strClient_id = objSessionInfo.CLIENT_ID
            var strTntId = strInputParamJson.TENANT_ID;
            var mClient = ''
            objLogInfo.HANDLER_CODE = 'ExportTenantSetup-UI';
            var result = {
                "Tenant_setup": [],

            };

            // Prepare query
            _Prepareparams()

            function _Prepareparams() {
                try {
                    reqFXDBInstance.GetFXDBConnection(appRequest.headers, 'clt_cas', objLogInfo, function Callback_GetCassandraConn(pClient) {
                        mClient = pClient
                        reqFXDBInstance.GetTableFromFXDB(mClient, 'tenant_setup', [], {
                            tenant_id: strTntId,
                            client_id: strClient_id
                        }, objLogInfo, function SELTCLIENT(pError, pResult) {
                            if (pError) {
                                reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-110501', 'Error In tenant_setup execution', pError);

                            } else {
                                result.Tenant_setup = pResult.rows
                                reqInsHelper.SendResponse(strServiceName, appResponse, result, objLogInfo, null, null, null);
                            }
                        })

                    })
                } catch (error) {
                    reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-110502', 'Error In tenant_setup execution', error);
                }
            }
        })
    } catch (error) {
        reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-110503', 'Error In LoadParamsConfig function', error);
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