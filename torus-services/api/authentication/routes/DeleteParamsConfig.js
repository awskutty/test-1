/*
@Api_Name : /DeletparamsConfig,
@Description: To get delete the tenant Setup config   from  DB 
 * @Last_Error_code:ERR-UI-110404
*/

// Require dependencies
var modPath = '../../../../node_modules/'
var referenceRoot = '../../../../torus-references'
var reqExpress = require(modPath + 'express');
var router = reqExpress.Router();
var reqLinq = require(modPath + 'node-linq').LINQ;
var reqFXDBInstance = require(referenceRoot + '/instance/DBInstance')
var reqLogInfo = require(referenceRoot + '/log/trace/LogInfo');
var reqInsHelper = require(referenceRoot + '/common/InstanceHelper');
var reqRedis = require('redis')
var defaultRedisKey = 'clt-0~app-0~tnt-0~env-0';
var strServiceName = 'DeleteParamsConfig';
// Cassandra initialization
// var mClient = reqDBInstance.SessionValues['dep_cas'];


// Host api to server
router.post('/DeleteParamsConfig', function (appRequest, appResponse, next) {

    var objLogInfo = ''
    try {
        reqLogInfo.AssignLogInfoDetail(appRequest, function (pobjLogInfo, psession_info) {
            // Handle the api close event from when client close the request

            appResponse.on('close', function () {});
            appResponse.on('finish', function () {});
            appResponse.on('end', function () {});
            _PrintInfo('Begin')
            objLogInfo = pobjLogInfo
            // Initialize local variables
            var pResp = appResponse
            var strInputParamJson = appRequest.body.PARAMS.SELROW;
            var process = appRequest.body.PARAMS.PROCESS;
            var NewColumnkey = appRequest.body.PARAMS.NewColumn;
            var NewColumnValue = appRequest.body.PARAMS.NewColumnValue;
            var strAppId = psession_info.APP_ID;
            var strClient_id = psession_info.CLIENT_ID
            var strTntId = appRequest.body.PARAMS.TENANT_ID;
            var connString = ''
            objLogInfo.HANDLER_CODE = 'Delete ParamsConfig-UI';
            // Function call

            var DeleteObj = {}
            if (process == 'tenant_setup') {
                DeleteObj = {
                    'tenant_id': strTntId,
                    'client_id': strClient_id,
                    'category': strInputParamJson.label
                }
            } else {
                DeleteObj = {
                    'setup_code': strInputParamJson.label,
                }

                if (process != 'FX_SETUP_MASTER') {
                    DeleteObj[NewColumnkey] = NewColumnValue
                }

            }

            _Prepareparams()
            //function for prepare params to delete
            function _Prepareparams() {
                connString = 'LDAP'
                var redisvalue = ''
                try {
                    reqFXDBInstance.GetFXDBConnection(appRequest.headers, 'clt_cas', objLogInfo, function Callback_GetCassandraConn(mClient) {
                        var redisKeyDefault = connString + '~' + defaultRedisKey.toUpperCase();
                        var routkey = appRequest.headers['routingkey']

                        reqFXDBInstance.DeleteFXDB(mClient, process, DeleteObj, objLogInfo, function DELCLIENT(pError, pResult) {
                            if (pError) {
                                reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-110401', 'Error In tenant_setup delete', pError);
                            } else {
                                try {
                                    reqInsHelper.SendResponse(strServiceName, appResponse, 'SUCCESS', objLogInfo, null, null, null);

                                } catch (error) {
                                    reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-110402', 'Error In _Prepareparams function', error);
                                }
                            }
                        });

                    })
                } catch (error) {
                    reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-110403', 'Error In _Prepareparams function', error);
                }
            }
        })
    } catch (error) {
        reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-110404', 'Error In DeletparamsConfig function', error);
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