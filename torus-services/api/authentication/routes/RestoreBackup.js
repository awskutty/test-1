/*
@Api_Name : /RestoreBackup,
@Description: To Restore from backup
@Last_Error_code:ERR-UI-110908
*/

// Require dependencies
var node_modules = '../../../../node_modules/'
var referenceRoot = '../../../../torus-references'
var reqExpress = require(node_modules + 'express')
var router = reqExpress.Router()
var reqLinq = require(node_modules + 'node-linq').LINQ;
var async = require(node_modules + 'async');
var reqFXDBInstance = require(referenceRoot + '/instance/DBInstance')
var reqLogInfo = require(referenceRoot + '/log/trace/LogInfo');
var reqInstanceHelper = require(referenceRoot + '/common/InstanceHelper');
var reqRedis = require(node_modules + 'redis')
var defaultRedisKey = 'clt-0~app-0~tnt-0~env-0';
var reqDateFormater = require('../../../../torus-references/common/dateconverter/DateFormatter');

var serviceName = "RestoreBackup"

// Host the SearchUser api
router.post('/RestoreBackup', function(appRequest, appResponse, next) {
    var objLogInfo = ''
    reqLogInfo.AssignLogInfoDetail(appRequest, function(oLogInfo, objSessionInfo) {

        try {
            objLogInfo = oLogInfo
                // Handle the api close event from when client close the request

            appResponse.on('close', function() {});
            appResponse.on('finish', function() {});
            appResponse.on('end', function() {});
            reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo)

            // Initialize local variables
            var pResp = appResponse
            var strInputParamJson = appRequest.body.PARAMS.SELROW;
            var strAppId = objSessionInfo.APP_ID;
            var strClient_id = objSessionInfo.CLIENT_ID
            var strTntId = appRequest.body.PARAMS.TENANT_ID;
            var strversion_no = appRequest.body.PARAMS.VERSION
            var backups = []

            var connString = ''
            reqInstanceHelper.PrintInfo(serviceName, 'Preparing params', objLogInfo);
            _Prepareparams(function(response) {
                if (response.STATUS === "SUCCESS") {
                    reqInstanceHelper.SendResponse(serviceName, appResponse, response.SUCCESS_DATA, objLogInfo, null, null, null)
                } else {
                    reqInstanceHelper.SendResponse(serviceName, appResponse, response.SUCCESS_DATA, objLogInfo, response.ERROR_CODE, response.ERROR_MESSAGE, response.ERROR_OBJECT)
                }
            })

            function _Prepareparams(callback) {
                var redisvalue = ''
                try {
                    reqInstanceHelper.PrintInfo(serviceName, 'Getting FXDB Connection', objLogInfo);
                    reqFXDBInstance.GetFXDBConnection(appRequest.headers, 'clt_cas', objLogInfo, function Callback_GetCassandraConn(mClient) {
                        var redisKeyDefault = connString + '~' + defaultRedisKey.toUpperCase();
                        var routkey = appRequest.headers['routingkey']
                        reqInstanceHelper.PrintInfo(serviceName, 'Getting tenant_setup_version', objLogInfo);
                        reqFXDBInstance.GetTableFromFXDB(mClient, 'tenant_setup_version', [], {
                            tenant_id: strTntId,
                            client_id: strClient_id,
                            version_no: strversion_no
                        }, objLogInfo, function SELTCLIENT(error, pResult) {
                            if (error) {
                                callback(sendMethodResponse("FAILURE", '', '', 'ERR-UI-110901', 'Error querying tenant_setup_version', error))
                            } else {
                                reqInstanceHelper.PrintInfo(serviceName, 'Calling _DeleteOlddata method', objLogInfo);
                                _DeleteOlddata(mClient, 'tenant_setup', function(result) {
                                    if (result.STATUS == 'SUCCESS') {
                                        var restorearray = JSON.parse(pResult.rows[0].tenant_setup_json)
                                        async.forEachOf(restorearray, function(value, key, callback1) {
                                            var row = restorearray[key];
                                            _Inserttenantsetup(row, mClient, function(result) {
                                                callback1();
                                            })
                                        }, function(error) {
                                            if (error) {
                                                callback(sendMethodResponse("FAILURE", '', '', 'ERR-UI-110908', 'Error querying tenant_setup_version', error))
                                            } else {
                                                callback(sendMethodResponse("SUCCESS", '', 'SUCCESS', '', '', ''))
                                            }
                                        });
                                    }
                                })
                            }

                        })
                    })
                } catch (error) {
                    callback(sendMethodResponse("FAILURE", '', '', 'ERR-UI-110907', 'Exception occured', error))
                }
            }

            function _DeleteOlddata(mClient, tablename, callback) {
                try {
                    reqFXDBInstance.DeleteFXDB(mClient, tablename, {
                        tenant_id: strTntId,
                        client_id: strClient_id,
                    }, objLogInfo, function DELCLIENT(error, pResult) {
                        if (error) {
                            callback(sendMethodResponse("FAILURE", '', '', 'ERR-UI-110902', 'Error deleting record', error))
                        } else {
                            callback(sendMethodResponse("SUCCESS", '', '', '', '', ''))
                        }
                    });
                } catch (error) {
                    callback(sendMethodResponse("FAILURE", '', '', 'ERR-UI-110903', 'Exception occured', error))
                }
            }

            function _Inserttenantsetup(pRow, mClient, pcallback) {
                try {
                    reqFXDBInstance.InsertFXDB(mClient, 'tenant_setup', [{
                        setup_json: pRow.setup_json,
                        routing_key: pRow.routing_key,
                        tenant_id: pRow.tenant_id,
                        client_id: pRow.client_id,
                        category: pRow.label || pRow.category,
                        description: pRow.description,
                        modified_by: pRow.modified_by,
                        modified_date: reqDateFormater.GetTenantCurrentDateTime(appRequest.headers, objLogInfo),
                        version: pRow.version,
                        created_by: pRow.created_by,
                        created_date: pRow.created_date
                    }], objLogInfo, function SELCLIENT(error, pResult) {
                        if (error) {
                            pcallback(sendMethodResponse("FAILURE", '', '', 'ERR-UI-110904', 'Error inserting to tenant_setup', error))
                        } else {
                            pcallback(sendMethodResponse("SUCCESS", '', '', '', '', ''))
                        }
                    });
                } catch (error) {
                    pcallback(sendMethodResponse("FAILURE", '', '', 'ERR-UI-110905', 'Exception occured', error))
                }
            }
        } catch (error) {
            reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-UI-110906', 'Exception occured', error)
                // sendMethodResponse("FAILURE", '', '', 'ERR-UI-110906', 'Exception occured', error)
        }
    });
});

function sendMethodResponse(status, successMessage, SuccessDataObj, errorCode, errorMessage, errorObject) {
    var obj = {
        'STATUS': status,
        'SUCCESS_MESSAGE': successMessage,
        'SUCCESS_DATA': SuccessDataObj,
        'ERROR_CODE': errorCode,
        'ERROR_MESSAGE': errorMessage,
        'ERROR_OBJECT': errorObject
    }
    return obj;
}


module.exports = router;
//*******End of Service*******//