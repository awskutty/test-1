/*
@Api_Name : /SaveSetupConfig,
@Description: To save tenant_setup params to DB
 * @Last_Error_code:ERR-UI-110701
*/

// Require dependencies
var modPath = '../../../../node_modules/'
var appRoot = '../../../../torus-references'
var reqExpress = require(modPath + 'express');
var router = reqExpress.Router();
var reqLinq = require(modPath + 'node-linq').LINQ;
var reqFXDBInstance = require(appRoot + '/instance/DBInstance')
var reqRedisInstance = require('../../../../torus-references/instance/RedisInstance');
var reqLogInfo = require(appRoot + '/log/trace/LogInfo');
var reqInsHelper = require(appRoot + '/common/InstanceHelper');
var reqDateFormater = require('../../../../torus-references/common/dateconverter/DateFormatter');

// Global variable initialization 

var defaultRedisKey = 'clt-0~app-0~tnt-0~env-0';
var updateobj;
var updatecond;
var strServiceName = 'SaveSetupConfig'
router.post('/SaveSetupConfig', function (appRequest, appResponse, next) {
    var objLogInfo = ''
    try {
        reqLogInfo.AssignLogInfoDetail(appRequest, function (pLogInfo, session_info) {
            objLogInfo = pLogInfo
            // Handle the api close event from when client close the request

            appResponse.on('close', function () {});
            appResponse.on('finish', function () {});
            appResponse.on('end', function () {});
            _PrintInfo('Begin');
            // Initialize local variables
            var pResp = appResponse
            var strAppId = session_info.APP_ID;
            var strClient_id = session_info.CLIENT_ID
            var strTntId = session_info.TENANT_ID;
            var strInputParamJson = appRequest.body.PARAMS
            var process = appRequest.body.PARAMS.PROCESS;
            var NewColumnkey = strInputParamJson.NewColumn
            var NewColumnValue = strInputParamJson.NewColumnValue
            var connString = ''
            var CondObj = {};
            objLogInfo.PROCESS = 'SaveSetupConfig-UI';
            objLogInfo.ACTION_DESC = 'SaveSetupConfig';
            updatesetup = false;
            // Function call
            if (process) {

                _Prepareparams()
            }
            // _Prepareparams(

            function _Prepareparams() {

                try {
                    reqFXDBInstance.GetFXDBConnection(appRequest.headers, 'clt_cas', objLogInfo, function Callback_GetCassandraConn(mClient) {
                        var redisKeyDefault = connString + '~' + defaultRedisKey.toUpperCase();
                        var routkey = appRequest.headers['routingkey']
                        // if (strInputParamJson.Isnew) {
                        if (process == 'tenant_setup') {
                            CondObj = {
                                setup_json: strInputParamJson.SETUP_JSON,
                                schema_json: strInputParamJson.setup_schema || null,
                                routing_key: routkey,
                                tenant_id: strTntId,
                                client_id: strClient_id,
                                category: strInputParamJson.SETUP_CODE,
                                editor_type: strInputParamJson.editor_type || '',
                                description: strInputParamJson.SETUP_CODE || '',
                                version: 0,
                                created_by: '',
                                created_date: reqDateFormater.GetTenantCurrentDateTime(appRequest.headers, objLogInfo)
                            }
                        } else {
                            CondObj = {
                                setup_json: strInputParamJson.SETUP_JSON,
                                setup_code: strInputParamJson.SETUP_CODE,
                                [NewColumnkey]: NewColumnValue
                            }
                        }

                         

                        reqFXDBInstance.InsertFXDB(mClient, process, [CondObj], objLogInfo, function SELCLIENT(pError, pResult) {
                            if (pError) {
                                reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-111001', 'Error In tenant_setup Table Execution', pError);
                            } else {
                                try {
                                    reqInsHelper.SendResponse(strServiceName, appResponse, 'SUCCESS', objLogInfo, null, null, null);
                                } catch (error) {
                                    reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-111002', 'Error In SaveLdap function call', error);
                                }
                            }
                        });
                     
                    })
                } catch (error) {
                    reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-111005', 'Error In Prepareparams function', error);
                }
            }
        })
    } catch (error) {
        reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-111006', 'Error In LoadParamsConfig function', error);
    }




    // Print Log information
    function _PrintInfo(pMessage) {
        reqInsHelper.PrintInfo(strServiceName, pMessage, objLogInfo)
    }

});



module.exports = router;
// End function