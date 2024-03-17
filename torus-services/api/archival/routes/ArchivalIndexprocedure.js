var reqExpress = require('express');
var router = reqExpress.Router();
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
// var reqTorusRdbms = require('../../../../torus-references/instance/db/TorusRdbms');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqDateFormatter = require('../../../../torus-references/common/dateconverter/DateFormatter');
var reqRedisInstance = require('../../../../torus-references/instance/RedisInstance');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqsvchelper = require('../../../../torus-references/common/serviceHelper/ServiceHelper');
var reqAuditLog = require('../../../../torus-references/log/audit/AuditLog');
var request = require('request');
router.post('/ArchivalIndex', function (appRequest, appResponse) {
    try {
        console.log('Indexing started');
        var ServiceName = 'ArchivalINdexProcedure';
        var pHeaders = appRequest.headers;
        var objLogInfo = '';
        var connectionDB = '';
        var strarId = '';
        var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
        var routingKey = appRequest.headers.routingkey;
        var reqParams = appRequest.body.PARAMS;
        var FxRedisDBKey = '';
        var TranKey = '';
        var strAppId = reqParams.APP_ID || '';
        var strTntId = reqParams.TENANT_ID || '';
        var app_id = '';
        var tenant_id = '';
        var uId = '';
        var Dbconfig = '';
        if (serviceModel.TYPE == "ULTIMATE") {
            FxRedisDBKey = "CASSANDRA~" + routingKey;
        } else if (serviceModel.TRANDB == "POSTGRES") {
            FxRedisDBKey = "POSTGRES~" + routingKey;
        } else if (serviceModel.TRANDB == "ORACLE") {
            FxRedisDBKey = "ORACLE~" + routingKey;
        }
        TranKey = "TRANDB~" + routingKey;


        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
            _PrintInfo(objLogInfo, "Got loginfo");

            console.log('objLogInfo APP_ID ' + objLogInfo.APP_ID);
            console.log('objLogInfo TENANT_ID ' + objLogInfo.TENANT_ID);
            //check tentid appid from request,any one of this id must came from request.else return failure
            if (!strAppId || !strTntId) {
                _PrintInfo(objLogInfo, "Archival index Failed, TENANT_ID and APP_ID not available in request param");
                reqInstanceHelper.SendResponse(ServiceName, appResponse, 'Archival index Failed, TENANT_ID and APP_ID not available in request param', objLogInfo, 'ERR-ARC-403210', 'Index failed', '', '');
            } else {
                // objLogInfo.skipSampleqry = true;
                reqTranDBInstance.GetTranDBConn(pHeaders, false, function (pSession) {
                    reqInstanceHelper.GetConfig(FxRedisDBKey.toUpperCase(), function (CoreConfig) {
                        try {
                            app_id = objLogInfo.APP_ID;
                            tenant_id = objLogInfo.TENANT_ID;
                            // var setupCode = ['ARCHIVAL_SETUP_MODE'];
                            var utcMode = objLogInfo.TIMEZONE_INFO.created_date_tz;
                            var sessiontz = objLogInfo.CLIENTTZ;
                            var sessiontzoffset = objLogInfo.CLIENTTZ_OFFSET;
                            var sessionclientip = objLogInfo.CLIENTIP;
                            var sessionId = objLogInfo.SESSION_ID;
                            var routingkey = appRequest.headers.routingkey;
                            var tntTzoffset = '';

                            if (utcMode == 'TENANT_TZ') {
                                tntTzoffset = objLogInfo.TIMEZONE_INFO.timezone_offset;
                            }


                            // This code is commented, No need to check archival setup mode while running,
                            // tenant_id or appp_id r both need as request param,As per the request index will need to do.

                            // getClientSetup(setupCode, function (SetupData) {
                            // if (SetupData.length) {
                            //     var arsetupModejson = JSON.parse(SetupData[0].setup_json);
                            //     var arsetupMode = arsetupModejson["Archival Setup Mode"];
                            //     if (arsetupMode.toUpperCase() == 'TENANT') {
                            //         //MODE is TENANT, indexing will happen for all app belogging to Tenant 
                            //         // strAppId = '';
                            //         strTntId = objLogInfo.TENANT_ID;

                            //     } else if (arsetupMode.toUpperCase() == 'APP') {
                            //         //Mode is APP ,indexing will happen for only for app 
                            //         strAppId = objLogInfo.APP_ID;
                            //         strTntId = objLogInfo.TENANT_ID;
                            //     }
                            // }
                            // objLogInfo = objLogInfo;
                            connectionDB = pSession;

                            uId = objLogInfo.USER_ID || 2;
                            var arrInsert = [];
                            if (CoreConfig) {
                                var RedisCoreConfig = JSON.parse(CoreConfig);
                                if (serviceModel.TYPE == 'ULTIMATE') {
                                    var arrkSpaces = RedisCoreConfig.CassandraServers[0].CassandraKeySpaces;
                                    for (var i = 0; i < arrkSpaces.length; i++) {
                                        var inserobj = {};
                                        inserobj.schema_name = arrkSpaces[i].KeySpace;
                                        inserobj.schema_code = arrkSpaces[i].Code;
                                        arrInsert.push(inserobj);
                                    }
                                    var arrkSpaces = '';
                                } else if (FxRedisDBKey.indexOf('ORACLE') > -1) {
                                    console.log('ORACLE');
                                    arrkSpaces = RedisCoreConfig.OracleServers[0].OracleSchemas;
                                } else if (FxRedisDBKey.indexOf('POSTGRES') > -1) {
                                    console.log('PG');
                                    arrkSpaces = RedisCoreConfig.PostgresServers[0].PostgresSchemas;
                                }
                                for (var i = 0; i < arrkSpaces.length; i++) {
                                    var inserobj = {};
                                    inserobj.schema_name = arrkSpaces[i].Schema;
                                    inserobj.schema_code = arrkSpaces[i].Code;
                                    arrInsert.push(inserobj);
                                }

                                reqInstanceHelper.GetConfig(TranKey.toUpperCase(), function (TranConfig) {
                                    if (TranConfig === 0) {
                                        reqInstanceHelper.SendResponse(ServiceName, appResponse, '', objLogInfo, 'ERR-CODE-160127', 'TRANDB Key Not found ' + TranKey.toUpperCase(), ' Redis key not found', 'FAILURE');
                                    } else {
                                        Preparetrnkey(TranConfig);
                                    }

                                    function Preparetrnkey(config) {
                                        var trnaConfig = JSON.parse(config);
                                        var insertobj = {};
                                        if (serviceModel.TRANDB == "ORACLE") {
                                            insertobj = {
                                                schema_name: trnaConfig.UserID,
                                                schema_code: 'tran_db'
                                            };
                                        } else {
                                            insertobj = {
                                                schema_name: trnaConfig.SearchPath,
                                                schema_code: 'tran_db'
                                            };
                                        }
                                        arrInsert.push(insertobj);
                                        insertSchName();
                                    }
                                });



                                function insertSchName() {
                                    console.log('objLogInfo.APP_ID ' + objLogInfo.APP_ID);
                                    console.log('objLogInfo.tenant_id ' + objLogInfo.TENANT_ID);
                                    reqTranDBInstance.DeleteTranDB(pSession, 'ARCHIVAL_SCHEMA', {
                                        app_id: objLogInfo.APP_ID,
                                        tenant_id: objLogInfo.TENANT_ID
                                    }, objLogInfo, function (Result, err) {
                                        if (err) {
                                            reqInstanceHelper.SendResponse(ServiceName, appResponse, '', objLogInfo, 'ERR-ARC-403201', 'Error occured delete schema ', err, 'FAILURE');
                                        } else {
                                            reqTranDBInstance.InsertTranDBWithAudit(pSession, 'ARCHIVAL_SCHEMA', arrInsert, objLogInfo, function (Res, Err) {
                                                if (Err) {
                                                    reqInstanceHelper.SendResponse(ServiceName, appResponse, '', objLogInfo, 'ERR-ARC-403202', 'Error occured Insert schema ', Err, 'FAILURE');
                                                } else {
                                                    _GetArIndex('ARCHIVAL_INDEX', function (arId) {
                                                        strarId = arId;
                                                        reqAuditLog.GetProcessToken(pSession, objLogInfo, function (error, prctId) {
                                                            if (error) {
                                                                reqInstanceHelper.SendResponse(ServiceName, appResponse, '', objLogInfo, 'ERR-CODE-160025', 'Error whlle geeting Prct id ', error, 'FAILURE', error);
                                                            } else {
                                                                _PrintInfo(objLogInfo, "DB Connection Type  " + pSession.DBConn.DBType);
                                                                if (pSession.DBConn.DBType === "pg") {
                                                                    // var query = `select * from fn_archivalindexprocess('${strarId}', '${strAppId}', '${strTntId}')`;
                                                                    var objqry = {
                                                                        query: `select * from fn_archivalindexprocess(?, ?, ?, ? , ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                                                                        params: [strarId, strAppId, prctId, strTntId, utcMode, tntTzoffset, objLogInfo.USER_ID, objLogInfo.LOGIN_NAME, sessiontz, sessiontzoffset, sessionclientip, sessionId, routingkey]
                                                                    }
                                                                    reqTranDBInstance.ExecuteSQLQueryWithParams(pSession, objqry, objLogInfo, function (res, err) {
                                                                        if (res) {
                                                                            if (res.rows.length && res.rows[0].fn_archivalindexprocess === 'SUCCESS') {
                                                                                getClientSetup('ARC_SUCCESS_COMMG_CODE', function (SetupData) {
                                                                                    if (SetupData.length) {
                                                                                        var ArchivalMailSetup = JSON.parse(SetupData[0].setup_json);
                                                                                        if (ArchivalMailSetup.Template != '') {
                                                                                            SendMail(ArchivalMailSetup);
                                                                                        } else {
                                                                                            _PrintInfo(objLogInfo, "Archival index Template setup not found");
                                                                                            reqInstanceHelper.SendResponse(ServiceName, appResponse, 'SUCCESS', objLogInfo, '', '', '', '');
                                                                                        }
                                                                                    } else {
                                                                                        _PrintInfo(objLogInfo, "Archival index success setup not found");
                                                                                        reqInstanceHelper.SendResponse(ServiceName, appResponse, 'Archival index Failure Setup not Found', objLogInfo, '', '', '', '');
                                                                                    }
                                                                                });

                                                                            } else {
                                                                                getClientSetup('ARC_FAILURE_COMMG_CODE', function (SetupData) {
                                                                                    if (SetupData.length) {
                                                                                        var ArchivalMailSetup = JSON.parse(SetupData[0].setup_json);
                                                                                        if (ArchivalMailSetup.To != '') {
                                                                                            SendMail(ArchivalMailSetup);
                                                                                        } else {
                                                                                            _PrintInfo(objLogInfo, "Archival index failure template setup not found");
                                                                                            reqInstanceHelper.SendResponse(ServiceName, appResponse, 'SUCCESS', objLogInfo, '', '', '', '');
                                                                                        }
                                                                                    } else {
                                                                                        _PrintInfo(objLogInfo, "Archival index success setup not found");
                                                                                        reqInstanceHelper.SendResponse(ServiceName, appResponse, 'Archival index success Setup not Found', objLogInfo, '', '', '', '');
                                                                                    }
                                                                                });

                                                                            }
                                                                        } else {
                                                                            _PrintInfo(objLogInfo, "Error in postgres execution procedure " + err);
                                                                            reqInstanceHelper.SendResponse(ServiceName, appResponse, '', objLogInfo, 'ERR-ARC-403203', 'Error occured Insert schema ', err, 'FAILURE');
                                                                        }
                                                                    });
                                                                } else {
                                                                    // var procedureqry = `select * from fn_archivalindexprocess_test('${strarId}', '${strAppId}', '${strTntId}')as achival_index_process from dual `;
                                                                    var procedureqry = {
                                                                        query: `DECLARE result varchar2(32) ; BEGIN result:= fn_archivalindexprocess(?, ?, ?, ? , ?, ?, ?, ?, ?, ?, ?, ?, ?); commit; END;`,
                                                                        params: [strarId, strAppId, prctId, strTntId, utcMode, tntTzoffset, objLogInfo.USER_ID, objLogInfo.LOGIN_NAME, sessiontz, sessiontzoffset, sessionclientip, sessionId, routingkey]
                                                                    }
                                                                    // reqTranDBInstance.ExecuteProcedure(pSession, 'ArchivalIndexProcess', bindVars, objLogInfo, function (result, error) {
                                                                    reqTranDBInstance.ExecuteSQLQueryWithParams(pSession, procedureqry, '', function (result, error) {
                                                                        try {
                                                                            if (result) {
                                                                                reqTranDBInstance.GetTableFromTranDB(pSession, 'ARCHIVAL_INDEX', {
                                                                                    ai_id: strarId
                                                                                }, objLogInfo, function (Result, err) {
                                                                                    if (err) {
                                                                                        reqInstanceHelper.SendResponse(ServiceName, appResponse, '', objLogInfo, 'ERR-ARC-403201', 'Error occured ArchivalIndex table ', err, 'FAILURE');
                                                                                    } else {
                                                                                        var archivalres = '';
                                                                                        if (Result.length) {
                                                                                            archivalres = Result[0];
                                                                                            if (archivalres.status == 'ARCHIVAL_INDEX_FAILURE') {
                                                                                                getClientSetup('ARC_FAILURE_COMMG_CODE', function (SetupData) {
                                                                                                    if (SetupData.length) {
                                                                                                        var ArchivalMailSetup = JSON.parse(SetupData[0].setup_json);
                                                                                                        if (ArchivalMailSetup.Template != '') {
                                                                                                            SendMail(ArchivalMailSetup);
                                                                                                        } else {
                                                                                                            reqInstanceHelper.SendResponse(ServiceName, appResponse, result.rows, objLogInfo, '', '', '', '');
                                                                                                        }
                                                                                                    } else {
                                                                                                        reqInstanceHelper.SendResponse(ServiceName, appResponse, 'Archival index Failure Setup not Found', objLogInfo, '', '', '', '');
                                                                                                    }
                                                                                                });
                                                                                            } else {
                                                                                                getClientSetup('ARC_SUCCESS_COMMG_CODE', function (SetupData) {
                                                                                                    if (SetupData.length) {
                                                                                                        var ArchivalMailSetup = JSON.parse(SetupData[0].setup_json);
                                                                                                        if (ArchivalMailSetup.Template != '') {
                                                                                                            SendMail(ArchivalMailSetup);
                                                                                                        } else {
                                                                                                            reqInstanceHelper.SendResponse(ServiceName, appResponse, result.rows, objLogInfo, '', '', '', '');
                                                                                                        }
                                                                                                    } else {
                                                                                                        reqInstanceHelper.SendResponse(ServiceName, appResponse, 'Archival index success Setup not Found', objLogInfo, '', '', '', '');
                                                                                                    }
                                                                                                });

                                                                                            }
                                                                                        } else {
                                                                                            reqInstanceHelper.SendResponse(ServiceName, appResponse, 'ARCHIVAL INDEX TABLE RECORD NOT FOUND', objLogInfo, '', '', '', '');
                                                                                        }
                                                                                    }
                                                                                });
                                                                            }

                                                                            else {
                                                                                _PrintInfo(objLogInfo, "Error in Oracle Procedure Execution function" + error);
                                                                                reqInstanceHelper.SendResponse(ServiceName, appResponse, '', objLogInfo, 'ERR-ARC-403203', 'Error occured ExecuteProcedure ', error, 'FAILURE');
                                                                            }
                                                                        } catch (error) {
                                                                            reqInstanceHelper.SendResponse(ServiceName, appResponse, '', objLogInfo, 'ERR-CODE-160012', 'Stored Procedure Error', error, 'FAILURE', error);
                                                                        }
                                                                    });
                                                                }
                                                            }
                                                        });
                                                    });
                                                }

                                            });
                                        }
                                    });
                                }
                            } else {
                                reqInstanceHelper.SendResponse(ServiceName, appResponse, '', objLogInfo, 'ERR-CODE-160023', 'DB Key Not found ' + FxRedisDBKey, ' Redis key not found', 'FAILURE');
                            }

                            // });
                        } catch (error) {
                            reqInstanceHelper.SendResponse(ServiceName, appResponse, '', objLogInfo, 'ERR-CODE-160013', 'GetTranDBC Function', error, 'FAILURE', error);
                        }
                    });
                });
            }
            function getClientSetup(setupName, clientSetupCallback) {
                try {
                    var cond = {};
                    cond.setup_code = setupName;
                    reqDBInstance.GetFXDBConnection(pHeaders, 'clt_cas', objLogInfo, function Callback_GetCassandraConn(pClient) {
                        reqsvchelper.GetSetupJson(pClient, cond, objLogInfo, function (res) {
                            if (res.Status == 'SUCCESS' && res.Data.length) {
                                clientSetupCallback(res.Data);
                            } else {
                                return reqInstanceHelper.SendResponse(ServiceName, appResponse, null, objLogInfo, res.ErrorCode, res.ErrorMsg, res.Error);
                            }
                        });
                    });
                } catch (error) {
                    return reqInstanceHelper.SendResponse(ServiceName, appResponse, null, objLogInfo, '', error, error);
                }

            }
            function SendMail(InputParams) {
                var RedisURLKey = "NGINX_HAPROXY_URL";
                var URLPrecedence = "";
                // get the nginx url in redis
                reqRedisInstance.GetRedisConnection(function (error, clientR) {
                    if (error) {
                        reqInstanceHelper.SendResponse('Achival Delete Procedure', appResponse, '', objLogInfo, 'ERR-MIN-50603', 'ERROR IN GET REDIS CONNECTION ', error, '', '');
                    } else {
                        clientR.get(RedisURLKey, function (err, res) {
                            if (err) {
                                reqInstanceHelper.SendResponse('Achival Delete Procedure', appResponse, '', objLogInfo, 'ERR-MIN-50604', 'ERROR IN GET REDIS URL ', err, '', '');
                            } else {
                                URLPrecedence = JSON.parse(res)["url"];
                                console.log("URL PRECEDENCE" + URLPrecedence);

                                var url = "";
                                url = URLPrecedence.split("microsvc")[0];
                                console.log("URL IS " + url);

                                var PARAMS = {
                                    PARAMS: {
                                        USER_EMAIL: InputParams.To,
                                        TEMPLATECODE: InputParams.Template,
                                        PROCESS: 'INDEX',
                                        AR_ID: strarId,
                                        WFTPA_ID: 'DEFAULT',
                                        DT_CODE: 'DEFAULT',
                                        DTT_CODE: 'DEFAULT',
                                        EVENT_CODE: 'DEFAULT',
                                        ISARCHIVAL: 'Y',
                                        TO: InputParams.To
                                    }
                                };

                                PARAMS.PROCESS_INFO = {
                                    "MODULE": "DEFAULT",
                                    "MENU_GROUP": "DEFAULT",
                                    "MENU_ITEM": "DEFAULT",
                                    "PROCESS_NAME": "DEFAULT"
                                };
                                //Call the sendMessage for mail 
                                var options = {
                                    url: url + 'Communication/SendMessage/',
                                    method: 'POST',
                                    json: true,
                                    headers: {
                                        "routingkey": appRequest.headers['routingkey'],
                                        "session-id": appRequest.headers['session-id']
                                    },
                                    body: PARAMS
                                };
                                request(options, function (error, response, body) {
                                    try {
                                        if (error) {
                                            reqInstanceHelper.SendResponse('Achival Delete Procedure', appResponse, '', objLogInfo, 'ERR-MIN-50605', 'ERROR IN SEND MESSAGE IN ARCHIVAL DELETE PROCEDURE ', error, '', '');
                                        } else {
                                            // CallbackDelete()
                                            reqInstanceHelper.SendResponse(ServiceName, appResponse, 'SUCCESS', objLogInfo, '', '', '', '');
                                            // reqInstanceHelper.SendResponse('Achival Delete Procedure', appResponse, 'SUCCESS', objLogInfo, '', '', '', '', '');
                                        }
                                    } catch (error) {
                                        reqInstanceHelper.SendResponse('Achival Delete Procedure', appResponse, '', objLogInfo, 'ERR-MIN-50606', 'ERROR IN Archival send mail api', error, '', '');
                                    }
                                });
                            }
                        });
                    }
                });
            }

            // Common function to Archival index id
            function _GetArIndex(TargetTable, callback) {
                try {
                    console.log('-----------> uId | ' + uId);
                    var AiRow = {};
                    AiRow.AI_DESCRIPTION = TargetTable;
                    AiRow.APP_ID = app_id;
                    AiRow.TENANT_ID = tenant_id;

                    insertRows('ARCHIVAL_INDEX', [AiRow], function (res) {
                        callback(res[0].ai_id);
                    });
                } catch (error) {
                    reqInstanceHelper.SendResponse(ServiceName, appResponse, '', objLogInfo, 'ERR-CODE-160014', 'GetArIndex Function error', error, 'FAILURE', error);
                }
            }
            function insertRows(pTargettable, pRows, callback) {
                try {
                    _PrintInfo(objLogInfo, "Insert started for " + pTargettable + " table.");
                    reqTranDBInstance.InsertTranDBWithAudit(connectionDB, pTargettable, pRows, objLogInfo, function (Result, Error) {
                        if (Error) {
                            callback(Error);
                        } else {
                            _PrintInfo(objLogInfo, "Insert Success for " + pTargettable + " table.");
                            callback(Result);
                        }
                    });
                } catch (error) {
                    reqInstanceHelper.SendResponse(ServiceName, appResponse, '', objLogInfo, 'ERR-CODE-160015', 'InsertRows Function error', error, 'FAILURE', error);
                }
            }

            function _PrintInfo(pLogInfo, pMessage) {
                reqInstanceHelper.PrintInfo(ServiceName, pMessage, pLogInfo);
            }
        });



    } catch (error) {
        console.log(error);
    }



});
module.exports = router;