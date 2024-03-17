/*
@Api_Name : /ImportTenantSetup,
@Description: To import tenant setup from client to DB
 * @Last_Error_code:ERR-UI-110610

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
var reqInstanceHelper = require(appRoot + '/common/InstanceHelper');
var reqDateFormater = require('../../../../torus-references/common/dateconverter/DateFormatter');
var reqAuditLog = require('../../../../torus-references/log/audit/AuditLog');
var reqTranDBHelper = require('../../../../torus-references/instance/TranDBInstance')

// Global variable initialization 
var reqRedis = require('redis')
var defaultRedisKey = 'clt-0~app-0~tnt-0~env-0';


var strServiceName = 'ImportTenantSetup'

// Host api to server
router.post('/ImportTenantSetup', function (appRequest, appResponse, next) {
    var objLogInfo;

    try {
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
            objLogInfo.PROCESS_INFO.PROCESS_NAME = 'Import_TenantSetup';
            reqTranDBHelper.GetTranDBConn(appRequest.headers, false, function (tran_db_instance) {
                reqAuditLog.GetProcessToken(tran_db_instance, objLogInfo, function (error, prct_id) {

                    // Handle the api close event from when client close the request

                    appResponse.on('close', function () { });
                    appResponse.on('finish', function () { });
                    appResponse.on('end', function () { });

                    // Initialize local variables
                    var pResp = appResponse
                    _PrintInfo('Begin')
                    var strInputParamJson = appRequest.body.PARAMS.SELROW;
                    var strAppId = objSessionInfo.APP_ID;
                    var strClient_id = objSessionInfo.CLIENT_ID;
                    var strTntId = appRequest.body.PARAMS.TENANT_ID;
                    var tenantarray = JSON.parse(appRequest.body.PARAMS.FILE_DATA);
                    var version_num = ''
                    var connString = ''


                    _Prepareparams()

                    function _Prepareparams() {
                        connString = 'LDAP'
                        var redisvalue = ''
                        try {
                            reqFXDBInstance.GetFXDBConnection(appRequest.headers, 'clt_cas', objLogInfo, function Callback_GetCassandraConn(mClient) {
                                var redisKeyDefault = connString + '~' + defaultRedisKey.toUpperCase();
                                var routkey = appRequest.headers['routingkey']
                                reqFXDBInstance.GetTableFromFXDB(mClient, 'tenant_setup', [], {
                                    tenant_id: strTntId,
                                    client_id: strClient_id
                                }, objLogInfo, function SELTCLIENT(pError, pResult) {
                                    if (pError) {
                                        reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-110601', 'Error In tenant_setup Table Execution', pError);
                                    } else {
                                        if (pResult.rows.length > 0) {
                                            _Insertbackup(JSON.stringify(pResult.rows), mClient, function (result) {
                                                if (result == 'SUCCESS') {
                                                    _DeleteOlddata(mClient, 'tenant_setup', function (result) {
                                                        if (result == 'SUCCESS') {
                                                            var strError = '';
                                                            async.forEachOf(tenantarray, function (value, key, callback1) {
                                                                var row = tenantarray[key];
                                                                _Inserttenantsetup(row, mClient, function (pStatus, pError) {
                                                                    if (pStatus == 'FAILURE')
                                                                        strError = strError + pError;
                                                                    callback1();
                                                                })
                                                            }, function (err) {
                                                                if (strError != '') {
                                                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, 'FAILURE', objLogInfo, 'ERR-UI-110612', strError, null, "FAILURE", '');
                                                                } else {
                                                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, 'SUCCESS', objLogInfo, null, null, null);
                                                                }
                                                            });
                                                        }
                                                    });
                                                }
                                            })

                                        } else {
                                            var strError = ''
                                            async.forEachOf(tenantarray, function (value, key, callback1) {
                                                var row = tenantarray[key];
                                                _Inserttenantsetup(row, mClient, function (pStatus, pError) {
                                                    if (pStatus == 'FAILURE')
                                                        strError = strError + pError;
                                                    callback1();
                                                })
                                            }, function (err) {
                                                if (strError != '')
                                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, 'FAILURE', objLogInfo, 'ERR-UI-110611', strError, '', 'FAILURE', '');
                                                else
                                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, 'SUCCESS', objLogInfo, null, null, null);
                                            });
                                        }

                                    }

                                })
                            })
                        } catch (error) {
                            reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-110602', 'Error in Insertbackup function', error);
                        }
                    }
                    //Delete Olddata from tenantsetup version
                    function _DeleteOlddata(mClient, tablename, Prescallback) {
                        try {
                            reqFXDBInstance.DeleteFXDB(mClient, tablename, {
                                tenant_id: strTntId,
                                client_id: strClient_id,
                            }, objLogInfo, function DELCLIENT(pError, pResult) {
                                if (pError) {
                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-110603', 'Error in delete tenant_setup execution', error);
                                } else {
                                    Prescallback('SUCCESS')
                                }
                            });
                        } catch (error) {
                            reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-110604', 'Error in _DeleteOlddata function', error);
                        }
                    }
                    //Insert Backup into tenant_setup_version 
                    function _Insertbackup(ptenant_json, mClient, pcallback) {

                        try {
                            reqFXDBInstance.GetTableFromFXDB(mClient, 'tenant_setup_version', [], {
                                tenant_id: strTntId,
                                client_id: strClient_id
                            }, objLogInfo, function SELTCLIENT(pError, pResult) {
                                if (pError) {
                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-110605', 'Error in tenant_setup_version table Execution', pError);
                                } else {
                                    if (pResult.rows.length > 0) {
                                        version_array = pResult.rows[pResult.rows.length - 1]
                                        version_num = version_array.version_no + 1
                                    } else {
                                        version_num = 0
                                    }
                                    reqFXDBInstance.InsertFXDB(mClient, 'tenant_setup_version', [{
                                        tenant_setup_json: ptenant_json,
                                        tenant_id: strTntId,
                                        client_id: strClient_id,
                                        modified_by: strClient_id,
                                        modified_date: reqDateFormater.GetTenantCurrentDateTime(appRequest.headers, objLogInfo),
                                        created_by: strClient_id,
                                        created_date: reqDateFormater.GetTenantCurrentDateTime(appRequest.headers, objLogInfo),
                                        version_no: version_num

                                    }], objLogInfo, function SELCLIENT(pError, pResult) {
                                        if (pError) {
                                            reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-110606', 'Error in tenant_setup_version table insert', pError);
                                        } else {
                                            pcallback('SUCCESS')
                                            // reqInstanceHelper.SendResponse(strServiceName, appResponse, 'SUCCESS', objLogInfo, null, null, null);
                                        }
                                    });
                                }
                            })
                        } catch (error) {
                            reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-110607', 'Error in_Insertbackup function', error);
                        }
                    }
                    // _Inserttenantsetup
                    function _Inserttenantsetup(pRow, mClient, pcallback) {

                        try {
                            reqFXDBInstance.InsertFXDB(mClient, 'tenant_setup', [{
                                setup_json: pRow.setup_json,
                                routing_key: pRow.routing_key,
                                tenant_id: strTntId,
                                client_id: strClient_id,
                                prct_id: prct_id,
                                category: pRow.label || pRow.category,
                                description: pRow.description,
                                modified_by: pRow.modified_by,
                                modified_date: reqDateFormater.GetTenantCurrentDateTime(appRequest.headers, objLogInfo),
                                version: pRow.version,
                                created_by: pRow.created_by,
                                created_date: pRow.created_date
                            }], objLogInfo, function SELCLIENT(pError, pResult) {
                                if (pError) {
                                    pcallback('FAILURE', pError);
                                } else {
                                    pcallback('SUCCESS', null);
                                }
                            });

                        } catch (error) {
                            reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-110609', 'Error in _Inserttenantsetup function', error);
                        }
                    }

                    // Print Log information
                    function _PrintInfo(pMessage) {
                        reqInstanceHelper.PrintInfo(strServiceName, pMessage, objLogInfo)
                    }
                    // Print Log Error
                    function _PrintErr(pError, pErrorCode, pMessage) {
                        reqInstanceHelper.PrintError(strServiceName, pError, pErrorCode, objLogInfo, pMessage)
                    }
                });
            });
        })

    } catch (error) {
        reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-110610', 'Error in ImportTenantSetup function', error);
    }

});



module.exports = router;
// End function