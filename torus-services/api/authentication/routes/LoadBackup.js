/*
@Api_Name : /LoadBackup,
@Description: To get old backup from tenant_setup_versions
 * @Last_Error_code:ERR-UI-110701
*/

// Require dependencies
var modPath = '../../../../node_modules/'
var appRoot = '../../../../torus-references'
var reqExpress = require(modPath + 'express');
var router = reqExpress.Router();
var reqLinq = require(modPath + 'node-linq').LINQ;
var async = require(modPath + 'async');
var reqFXDBInstance = require(appRoot + '/instance/DBInstance')
var reqLogInfo = require(appRoot + '/log/trace/LogInfo');
var reqInsHelper = require(appRoot + '/common/InstanceHelper');

// Global variable initialization 


var strServiceName = 'LoadBackup'
    // Host api to server
router.post('/LoadBackup', function(appRequest, appResponse, next) {

    var objLogInfo = ''
    try {

        reqLogInfo.AssignLogInfoDetail(appRequest, function(pLogInfo, session_info) {

            // Handle the api close event from when client close the request

            appResponse.on('close', function() {});
            appResponse.on('finish', function() {});
            appResponse.on('end', function() {});

            _PrintInfo('Begin')
            objLogInfo = pLogInfo
                // Initialize local variables
            var pResp = appResponse
            var strInputParamJson = appRequest.body.SELROW;
            var strAppId = session_info.APP_ID;
            var strClient_id = session_info.CLIENT_ID
            var strTntId = appRequest.body.PARAMS.TENANT_ID;
            var backups = []
            var connString = ''

            _Prepareparams()
                //Prepare Params 
            function _Prepareparams() {
                var redisvalue = ''
                try {
                    reqFXDBInstance.GetFXDBConnection(appRequest.headers, 'clt_cas', objLogInfo, function Callback_GetCassandraConn(mClient) {
                        reqFXDBInstance.GetTableFromFXDB(mClient, 'tenant_setup_version', [], {
                            tenant_id: strTntId,
                            client_id: strClient_id
                        }, objLogInfo, function SELTCLIENT(pError, pResult) {
                            if (pError) {
                                reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-110701', 'Error In tenant_setup_version Table Execution', pError);
                            } else {
                                for (i = 0; i < pResult.rows.length; i++) {
                                    var version = {}
                                    version.CODE = pResult.rows[i].version_no
                                    version.DESC = "Version_" + pResult.rows[i].version_no

                                    backups.push(version)
                                }
                                pResp.send(backups)
                            }

                        })
                    })
                } catch (error) {
                    reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-110702', 'Error In _Prepareparams function', error);
                }
            }

            // Print Log information
            function _PrintInfo(pMessage) {
                reqInsHelper.PrintInfo(strServiceName, pMessage, objLogInfo)
            }
            // Print Log Error
            function _PrintErr(pError, pErrorCode, pMessage) {
                reqInsHelper.PrintError(strServiceName, pError, pErrorCode, objLogInfo, pMessage)
            }
        })
    } catch (error) {
        reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-110703', 'Error In LoadBackup', error);

    }

});



module.exports = router;
// End function