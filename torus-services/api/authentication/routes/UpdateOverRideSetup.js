/*
@Api_Name : /UpdateOverRideSetup,
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

// Global variable initialization 

var defaultRedisKey = 'clt-0~app-0~tnt-0~env-0';
var updateobj;
var updatecond;
var strServiceName = 'UpdateOverRideSetup'
router.post('/UpdateOverRideSetup', function (appRequest, appResponse, next) {
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
            var strInputParamJson = appRequest.body.PARAMS
            var connString = ''
            var CondObj = {};
            objLogInfo.PROCESS = 'UpdateOverRideSetup-UI';
            objLogInfo.ACTION_DESC = 'UpdateOverRideSetup';
            // Function call


            _UpdateOverRideSetup()

            // _Prepareparams(

            function _UpdateOverRideSetup() {

                try {
                    reqFXDBInstance.GetFXDBConnection(appRequest.headers, 'clt_cas', objLogInfo, function Callback_GetCassandraConn(mClient) {
                        var redisKeyDefault = connString + '~' + defaultRedisKey.toUpperCase();
                        var routkey = appRequest.headers['routingkey']
                        updateobj = {
                            override_json: JSON.stringify(strInputParamJson.conditionjson)
                        }
                        CondObj = {
                            setup_code: strInputParamJson.label
                        }
                        reqFXDBInstance.UpdateFXDB(mClient, 'FX_SETUP_MASTER', updateobj, CondObj, objLogInfo, function SELCLIENT(pError, pResult) {
                            if (pError) {
                                reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-111001', 'Error In update fx setup master Table Execution', pError);
                            } else {
                                try {

                                    reqInsHelper.SendResponse(strServiceName, appResponse, 'SUCCESS', objLogInfo, null, null, null);
                                } catch (error) {
                                    reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-111002', 'Error in update OverrideSetup  function call', error);
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