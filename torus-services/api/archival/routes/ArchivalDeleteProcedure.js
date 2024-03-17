var reqExpress = require('express');
var router = reqExpress.Router();
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
// var reqTorusRdbms = require('../../../../torus-references/instance/db/TorusRdbms');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var DBInstance = require('../../../../torus-references/instance/DBInstance');
var reqDateFormatter = require('../../../../torus-references/common/dateconverter/DateFormatter');
var reqsvchelper = require('../../../../torus-references/common/serviceHelper/ServiceHelper');
var request = require('request');
var reqRedisInstance = require('../../../../torus-references/instance/RedisInstance');
var reqmoment = require('moment');
var async = require('async');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
const { promises } = require('form-data');
const { resolve } = require('path');
const { reject } = require('lodash');
router.post('/ArchivalDeleteIndex', function (appRequest, appResponse) {
    try {
        var ServiceName = 'ArchivalDeleteProcedure';
        var pHeaders = appRequest.headers;
        var routingKey = appRequest.headers.routingkey;
        var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
        var reqParams = appRequest.body.PARAMS;
        var objLogInfo = '';
        var StrAppId = reqParams.APP_ID || '';
        var strTntId = reqParams.TENANT_ID || '';
        var strarId = '';
        var FxRedisDBKey = '';
        var defaultKey = 'CLT-0~APP-0~TNT-0~ENV-0'
        if (serviceModel.TYPE == "ULTIMATE") {
            FxRedisDBKey = "CASSANDRA~" + routingKey;
        } else if (serviceModel.TRANDB == "POSTGRES") {
            FxRedisDBKey = "POSTGRES~" + routingKey;
        } else if (serviceModel.TRANDB == "ORACLE") {
            FxRedisDBKey = "ORACLE~" + routingKey;
        }
        var TranKey = "TRANDB~" + routingKey;
        reqLogInfo.AssignLogInfoDetail(appRequest, async function (objLogInfo, objSessionInfo) {
            var utcMode = objLogInfo.TIMEZONE_INFO.created_date_tz;
            var sessiontz = objLogInfo.CLIENTTZ;
            var sessiontzoffset = objLogInfo.CLIENTTZ_OFFSET;
            var sessionclientip = objLogInfo.CLIENTIP;
            var sessionId = objLogInfo.SESSION_ID;
            var routingkey = appRequest.headers.routingkey;

            if (utcMode == 'TENANT_TZ') {
                var tntTzoffset = objLogInfo.TIMEZONE_INFO.timezone_offset;
            }
            //check tentid appid from request,any one of this id must came from request.else return failure
            if (!StrAppId || !strTntId) {
                _PrintInfo(objLogInfo, "Archival proces Failed, TENANT_ID and APP_ID not available in request param");
                reqInstanceHelper.SendResponse(ServiceName, appResponse, 'Archival process Failed, TENANT_ID and APP_ID not available in request param', objLogInfo, 'ERR-ARC-403210', 'Proces failed', '', '');
            } else {
                // objLogInfo.skipSampleqry = true;
                reqTranDBInstance.GetTranDBConn(pHeaders, false, async function (pSession) {
                    try {
                        connectionDB = pSession;
                        var validateRes = await check_any_archival_inprogress(pSession, objLogInfo);
                        if (validateRes == "FAILURE") {
                            return reqInstanceHelper.SendResponse(ServiceName, appResponse, 'INPROGRESS archival id available.Try after completion', objLogInfo, 'ERR-ARC-403240', 'Proces failed', '', '');
                        } else {
                            var archivalIndexId = await _GetArIndex(pSession, objLogInfo);
                            _getDBSchema(pSession, function () {

                                DeleteArchivalprocess(pSession, archivalIndexId, function (res) {
                                    callback1();
                                })

                                // var setupCOnd = ['ARCHIVAL_INDEX_RETENTION_PERIOD'];
                                // getClientSetup(setupCOnd, function (SetupData) {
                                // if (SetupData.length) {
                                // for (var i = 0; i < SetupData.length; i++) {
                                //     if (SetupData[i].category == 'ARCHIVAL_INDEX_RETENTION_PERIOD') {
                                //         var setupObj = JSON.parse(SetupData[i].setup_json);
                                //         var numberofdays = parseInt(setupObj.ARCHIVAL_INDEX_RETENTION_PERIOD);
                                //     }

                                // This code is commented, No need to check archival setup mode while running,
                                // tenant_id or appp_id r both need as request param,As per the request process will need to do.

                                // else if (SetupData[i].setup_code == 'ARCHIVAL_SETUP_MODE') {
                                //     var arsetupModejson = JSON.parse(SetupData[i].setup_json);
                                //     var arsetupMode = arsetupModejson["Archival Setup Mode"];
                                //     if (arsetupMode.toUpperCase() == 'TENANT') {
                                //         StrdbparmAppId = '';
                                //     } else if (arsetupMode.toUpperCase() == 'APP') {
                                //         strTntId = objLogInfo.TENANT_ID;
                                //     }
                                // }
                                // }
                                // _PrintInfo(objLogInfo, "Archival index retention period" + numberofdays);
                                // if (pSession.DBConn.DBType == 'pg') {
                                //     var Days = reqmoment().subtract(numberofdays, 'd').format("YYYY-MM-DD");
                                //     var query = {
                                //         query: `select * from archival_index where status='ARCHIVAL_INDEX_COMPLETED' and  to_date(to_char(created_date,'yyyy-mm-dd'),'yyyy-mm-dd') <= ?  and APP_ID=  ? `,
                                //         params: [Days, objLogInfo.APP_ID]
                                //     }

                                //     if (strTntId) {
                                //         query = {
                                //             query: ` and TENANT_ID= ?`,
                                //             params: [objLogInfo.TENANT_ID]
                                //         }
                                //     }
                                // } else {
                                // var Days = reqmoment().subtract(numberofdays, 'd').format("DD-MMM-YYYY");
                                // query = {
                                //     query: `select * from archival_index where status='ARCHIVAL_INDEX_COMPLETED' and  to_date(to_char(created_date,'DD-MON-YY'),'DD-MON-YY') <= ?  and APP_ID=  ? `,
                                //     params: [Days, StrAppId]
                                // }
                                // if (strTntId) {
                                //     query = {
                                //         query: ` select * from archival_index where status='ARCHIVAL_INDEX_COMPLETED' and  to_date(to_char(created_date,'DD-MON-YY'),'DD-MON-YY') <= ?  and APP_ID=  ? and TENANT_ID= ?`,
                                //         params: [Days, StrAppId, strTntId]
                                //     }
                                // }
                                // }
                                // _PrintInfo(objLogInfo, "Archival index retention period" + query);
                                // reqTranDBInstance.ExecuteSQLQueryWithParams(pSession, query, objLogInfo, function (result, error) {
                                //     try {
                                //         if (result) {
                                //             if (result.rows.length) {
                                //                 var aiIDs = result.rows;
                                //                 async.forEachOfSeries(aiIDs, function (value, key, callback1) {
                                //                     DeleteArchivalprocess(pSession, value.ai_id, function (res) {
                                //                         callback1();
                                //                     });
                                //                 }, function (err) {
                                //                     if (err != '') {
                                //                         reqInstanceHelper.SendResponse(ServiceName, appResponse, 'SUCCESS', objLogInfo, '', '', '', '');
                                //                     } else {
                                //                         reqInstanceHelper.SendResponse(ServiceName, appResponse, 'FAILURE', objLogInfo, '', '', err, 'FAILURE', '');

                                //                     }
                                //                 });
                                //             } else {
                                //                 return reqInstanceHelper.SendResponse(ServiceName, appResponse, 'No rows Found', objLogInfo);
                                //             }
                                //         } else {
                                //             return reqInstanceHelper.SendResponse(ServiceName, appResponse, '', objLogInfo, 'ERR-AUT-14253', 'Error on select archival index query', error);
                                //         }
                                //     } catch (error) {
                                //         return reqInstanceHelper.SendResponse(ServiceName, appResponse, '', objLogInfo, 'ERR-AUT-14253', 'Error fetching details from language', error);
                                //     }
                                // });
                                // }
                                // });
                            });
                        }

                    } catch (error) {
                        reqInstanceHelper.SendResponse(ServiceName, appResponse, '', objLogInfo, 'ERR-CODE-160013', 'GetTranDBC Function', error, 'FAILURE', error);
                    }
                });
            }

            function check_any_archival_inprogress(DbSession, objLogInfo) {
                return new Promise((resolve, reject) => {
                    try {
                        _PrintInfo(objLogInfo, "Check any pending(INPROGRESS) archial index ");
                        var IndexSelqry = {
                            query: "select * from archival_index where tenant_id=? and status=?",
                            params: [objLogInfo.TENANT_ID, "INPROGRESS"]
                        }
                        reqTranDBInstance.ExecuteSQLQueryWithParams(DbSession, IndexSelqry, objLogInfo, function (pRes, pErr) {
                            if (pErr) {
                                _PrintInfo(objLogInfo, "Error occured while check inprogress archival index." + pErr);
                            } else {
                                if (pRes.rows.length) {
                                    _PrintInfo(objLogInfo, "Some INPROGRESS archival id available.");
                                    resolve("FAILURE")
                                } else {
                                    _PrintInfo(objLogInfo, "No pending archival process");
                                    resolve("SUCCESS")
                                }
                            }

                        })
                    } catch (error) {

                    }
                })
            }

            function _GetArIndex(DBSession, objLogInfo) {
                return new Promise((resolve, reject) => {
                    try {
                        var AiRow = {};
                        AiRow.AI_DESCRIPTION = "ARCHIVAL_INDEX";
                        AiRow.APP_ID = objLogInfo.APP_ID;
                        AiRow.TENANT_ID = objLogInfo.TENANT_ID;
                        AiRow.status = "INPROGRESS"
                        insertRows(DBSession, 'ARCHIVAL_INDEX', [AiRow], objLogInfo, function (res) {
                            resolve(res[0].ai_id);
                        });
                    } catch (error) {
                        reqInstanceHelper.SendResponse(ServiceName, appResponse, '', objLogInfo, 'ERR-CODE-160014', 'GetArIndex Function error', error, 'FAILURE', error);
                    }
                })

            }

            function insertRows(connectionDB, pTargettable, pRows, objLogInfo, callback) {
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

            function getClientSetup(setupName, clientSetupCallback) {
                try {
                    var cond = {};
                    cond.setup_code = setupName;
                    DBInstance.GetFXDBConnection(pHeaders, 'clt_cas', objLogInfo, function Callback_GetCassandraConn(pClient) {
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

            function _getDBSchema(pSession, pcallback) {
                // reqTranDBInstance.GetTranDBConn(pHeaders, false, function (pSession) {

                reqRedisInstance.GetRedisConnection(async function (error, clientR) {
                    // reqInstanceHelper.GetConfig(FxRedisDBKey.toUpperCase(), function (CoreConfig) {
                    try {
                        var CoreConfig = await clientR.get(FxRedisDBKey.toUpperCase())

                        if (!CoreConfig) {
                            CoreConfig = await clientR.get(`${serviceModel.TRANDB}~${defaultKey}`)
                        }
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

                            // reqInstanceHelper.GetConfig(TranKey.toUpperCase(), function (TranConfig) {

                            var TranConfig = await clientR.get(TranKey.toUpperCase());
                            if (!TranConfig) {
                                TranConfig = await clientR.get(`TRANDB~${defaultKey}`);
                            }
                            if (TranConfig === 0) {
                                reqInstanceHelper.SendResponse(ServiceName, appResponse, '', objLogInfo, 'ERR-CODE-160025', 'TRANDB Key Not found ' + TranKey.toUpperCase(), ' Redis key not found', 'FAILURE');
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
                                insertSchName().then(() => {
                                    pcallback();
                                });
                            }
                            // });



                            function insertSchName() {
                                return new Promise((resolve, reject) => {
                                    reqTranDBInstance.DeleteTranDB(pSession, 'ARCHIVAL_SCHEMA', {}, objLogInfo, function (Result, err) {
                                        if (err) {
                                            reqInstanceHelper.SendResponse(ServiceName, appResponse, '', objLogInfo, 'ERR-ARC-403201', 'Error occured delete schema ', err, 'FAILURE');
                                        } else {
                                            reqTranDBInstance.InsertTranDBWithAudit(pSession, 'ARCHIVAL_SCHEMA', arrInsert, objLogInfo, function (Res, Err) {
                                                if (Err) {
                                                    reqInstanceHelper.SendResponse(ServiceName, appResponse, '', objLogInfo, 'ERR-ARC-403202', 'Error occured Insert schema ', Err, 'FAILURE');
                                                } else {
                                                    resolve();
                                                }
                                            });
                                        }
                                    });
                                });
                            }
                        } else {
                            reqInstanceHelper.SendResponse(ServiceName, appResponse, '', objLogInfo, 'ERR-CODE-160023', 'DB Key Not found ' + FxRedisDBKey, ' Redis key not found', 'FAILURE');
                        }
                    } catch (error) {
                        reqInstanceHelper.SendResponse(ServiceName, appResponse, '', objLogInfo, 'ERR-CODE-160013', 'GetTranDBC Function', error, 'FAILURE', error);
                    }
                });
                // });
            }


            function DeleteArchivalprocess(pSession, Ai_ID, CallbackDelete) {
                strarId = Ai_ID;
                if (pSession.DBConn.DBType === "pg") {
                    var query = {
                        query: `select * from fn_archivaldeleteprocess(?, ?, ? , ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        params: [strarId, StrAppId, strTntId, utcMode, tntTzoffset, objLogInfo.USER_ID, objLogInfo.LOGIN_NAME, sessiontz, sessiontzoffset, sessionclientip, sessionId, routingkey]
                    }
                    reqTranDBInstance.ExecuteSQLQueryWithParams(pSession, query, objLogInfo, function (res, err) {
                        if (res) {
                            if (res.rows.length && res.rows[0].fn_archivaldeleteprocess == "SUCCESS") {
                                getClientSetup('ARC_SUCCESS_COMMG_CODE', function (SetupData) {
                                    if (SetupData.length) {
                                        var ArchivalMailSetup = JSON.parse(SetupData[0].setup_json);
                                        if (ArchivalMailSetup.Template != '') {
                                            SendMail(ArchivalMailSetup, CallbackDelete);
                                        } else {
                                            CallbackDelete();
                                        }
                                    }
                                });
                                // CallbackDelete();
                            } else {
                                getClientSetup('ARC_FAILURE_COMMG_CODE', function (SetupData) {
                                    if (SetupData.length) {
                                        var ArchivalMailSetup = JSON.parse(SetupData[0].setup_json);
                                        if (ArchivalMailSetup.Template) {
                                            SendMail(ArchivalMailSetup, CallbackDelete);
                                        } else {
                                            CallbackDelete();
                                        }
                                    }
                                });
                            }
                        } else {
                            _PrintInfo(objLogInfo, "Error in Executesql procedure " + query + " function." + err);
                            reqInstanceHelper.SendResponse(ServiceName, appResponse, '', objLogInfo, 'ERR-ARC-403301', 'Error occured ExecuteProcedure ', err, 'FAILURE');
                        }
                    });
                } else {
                    //var procedureqry = "select fn_archivaldeleteprocess(" + strarId + ") as archival_delete_process from dual";
                    // var procedureqry = `select  fn_archivaldeleteprocess('${strarId}', '${StrAppId}', '${strTntId}')  as archival_delete_process from dual`;
                    var procedureqry = {
                        query: `DECLARE result varchar2(32) ; BEGIN result:= fn_archivaldeleteprocess(?, ?, ? , ?, ?, ?, ?, ?, ?, ?, ?, ?); commit; END;`,
                        params: [strarId, StrAppId, strTntId, utcMode, tntTzoffset, objLogInfo.USER_ID, objLogInfo.LOGIN_NAME, sessiontz, sessiontzoffset, sessionclientip, sessionId, routingkey]
                    }
                    // var procedureqry = `DECLARE result varchar2(32) ; BEGIN result:= fn_archivaldeleteprocess('${strarId}','${StrAppId}', '${strTntId}'); commit; END;`;

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
                                            if (archivalres.status == 'ARCHIVAL_PROCESS_FAILURE') {
                                                getClientSetup('ARC_FAILURE_COMMG_CODE', function (SetupData) {
                                                    if (SetupData.length) {
                                                        var ArchivalMailSetup = JSON.parse(SetupData[0].setup_json);
                                                        if (ArchivalMailSetup.Template != '') {
                                                            SendMail(ArchivalMailSetup, CallbackDelete);
                                                        } else {
                                                            CallbackDelete();
                                                        }
                                                    }
                                                });
                                            } else {
                                                getClientSetup('ARC_SUCCESS_COMMG_CODE', function (SetupData) {
                                                    if (SetupData.length) {
                                                        var ArchivalMailSetup = JSON.parse(SetupData[0].setup_json);
                                                        if (ArchivalMailSetup.Template != '') {
                                                            SendMail(ArchivalMailSetup, CallbackDelete);
                                                        } else {
                                                            CallbackDelete();
                                                        }
                                                    }
                                                });
                                                // CallbackDelete();
                                            }
                                        } else {
                                            CallbackDelete();
                                        }
                                    }
                                });
                            } else {
                                _PrintInfo(objLogInfo, "Error in Oracle Procedure Execution function" + error);
                                reqInstanceHelper.SendResponse(ServiceName, appResponse, '', objLogInfo, 'ERR-ARC-403300', 'Error occured ExecuteProcedure ', error, 'FAILURE');
                            }
                        } catch (error) {
                            reqInstanceHelper.SendResponse(ServiceName, appResponse, '', objLogInfo, 'ERR-CODE-160012', 'Stored Procedure Error', error, 'FAILURE', error);
                        }
                    });
                };



                function SendMail(InputParams, CallbackDelete) {
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
                                            PROCESS: 'DELETE',
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
                                                CallbackDelete();
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
            }




        });

        function _PrintInfo(pLogInfo, pMessage) {
            reqInstanceHelper.PrintInfo(ServiceName, pMessage, pLogInfo);
        }


    } catch (error) {

    }



});
module.exports = router;