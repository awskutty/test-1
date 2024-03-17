//Update send mail process
// Require dependencies
var reqExpress = require('express');
var router = reqExpress.Router();
var reqAsync = require('async');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqsvchelper = require('../../../../torus-references/common/serviceHelper/ServiceHelper');
var reqRedisInstance = require('../../../../torus-references/instance/RedisInstance');
var request = require('request')
var reqLINQ = require("node-linq").LINQ;
const { async, promise, reject } = require('q');
const { resolve } = require('path');
const { error } = require('console');


router.post('/ArchivalProcess', function (appRequest, appResponse) {
    try {
        var ServiceName = 'ArchivalProcess';
        var pHeaders = appRequest.headers;
        var PARAMS = appRequest.body.PARAMS;
        var queryLogArr = [];
        var pQueryobj = {}
        var arcIndexId = '';
        var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
        var fetchCOunt = 500;
        var arrQryLog = [];
        var success_commg_code = '';
        var failure_commg_code = '';
        var rtnPeriod = '';
        var rowlimit = '';
        var IdenticalDB = false

        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
            // reqTranDBInstance.GetTranDBConn(pHeaders, true, function (liveDBSessionWithScope) {
            reqDBInstance.GetFXDBConnectionWithScopeParam(pHeaders, 'arc_tran_db', true, objLogInfo, function (archivalDBSession) {
                reqTranDBInstance.GetTranDBConn(pHeaders, false, async function (LiveDBSessionNoscope) {
                    try {
                        var archivalDBType = archivalDBSession.DBConn.DBType;
                        var LiveDBType = LiveDBSessionNoscope.DBConn.DBType;
                        if (LiveDBType == archivalDBType) {
                            IdenticalDB = true
                        }
                        // getClientSetup('ARCHIVAL_SETUP', function (SetupData) {
                        //     if (SetupData.length) {
                        //         var arcSetupJsonValue = JSON.parse(SetupData[0].setup_json);
                        //         success_commg_code = arcSetupJsonValue.SUCCESS_COMMG_CODE;
                        //         failure_commg_code = arcSetupJsonValue.FAILURE_COMMG_CODE;
                        //         rtnPeriod = arcSetupJsonValue.RETENTION_PERIODS;
                        //         rowlimit = arcSetupJsonValue.FETCH_COUNT;
                        //     }
                        // })



                        // var archivalPending = await _getArchivalPrending(LiveDBSessionNoscope);
                        // if (archivalPending.rows.length) {
                        //     //some archival index not yet completed. Need to send mail
                        //     // getClientSetup('ARC_FAILURE_COMMG_CODE', function (SetupData) {
                        //     //     if (SetupData.length) {
                        //     //         var ArchivalMailSetup = JSON.parse(SetupData[0].setup_json);
                        //     //         if (ArchivalMailSetup.Template != '') {
                        //     //             SendMail(ArchivalMailSetup);
                        //     //         }
                        //     //     }
                        //     // })
                        // } else {


                        // query tenant_setup table to get the dynamic values for retention period and looping number of record
                        // var tenantsSetupValues = await _getTeanantSetupValue()

                        getClientSetup('ARCHIVAL_SETUP', function (SetupData) {
                            if (SetupData.length) {
                                var arcSetupJsonValue = JSON.parse(SetupData[0].setup_json);
                                success_commg_code = arcSetupJsonValue.SUCCESS_COMMG_CODE;
                                failure_commg_code = arcSetupJsonValue.FAILURE_COMMG_CODE;
                                rtnPeriod = arcSetupJsonValue.RETENTION_PERIODS;
                                fetchCOunt = arcSetupJsonValue.FETCH_COUNT || 500;
                                if (fetchCOunt) {
                                    rowlimit = ` limit ${fetchCOunt}`
                                    if (serviceModel.TRANDB == 'ORACLE') {
                                        rowlimit = ` and rownum = '${fetchCOunt}'`
                                    }
                                }
                                var qryInfoSel = `select * from archival_qry_info where tenant_id ='${objLogInfo.TENANT_ID}'order by sort_order , table_sort_order desc `
                                reqTranDBInstance.ExecuteSQLQuery(LiveDBSessionNoscope, qryInfoSel, objLogInfo, async function (Res, Err) {
                                    try {
                                        if (Err) {
                                            reqInstanceHelper.SendResponse(ServiceName, appResponse, "", objLogInfo, 'ERR-ARC-40001', 'Error occured while qry the archival process info table.', Err, 'FAILURE');
                                        } else {
                                            if (Res) {
                                                arcIndexId = await _GetArIndex(objLogInfo);
                                                _executearcQuery(arcIndexId, Res.rows)
                                            }
                                        }
                                    } catch (error) {
                                        reqInstanceHelper.SendResponse(ServiceName, appResponse, "", objLogInfo, 'ERR-ARC-40002', 'Error occured while qry the archival process info table.', Error, 'FAILURE');
                                    }
                                })
                            }
                        })
                        // }

                    } catch (error) {
                        reqInstanceHelper.SendResponse(ServiceName, appResponse, "", objLogInfo, 'ERR-ARC-40011', 'Error occured while qry the archival process info table.', error, 'FAILURE');
                    }

                    async function _getTeanantSetupValue() {
                        try {
                            return new promise(async (resolve, reject) => {
                                // var selectQuery= {
                                //    query: 'select * from tenant_setup where category=?',
                                // params:['Archival_Process']
                                // }
                                var whereCond = {
                                    'category': 'ARCHIVAL_SETUP'
                                };
                                var table_name = 'tenant_setup'
                                reqDBInstance.GetTableFromFXDB(pClient, table_name, [], whereCond, objLogInfo, function (pError, pResult) {
                                    if (pError) {
                                        resolve('Error while querying tenant_setup table')
                                    }
                                    else {
                                        resolve(pResult.rows)
                                    }
                                })

                            })

                        } catch (error) {
                            reqInstanceHelper.SendResponse(ServiceName, appResponse, "", objLogInfo, 'ERR-ARC-40025', 'Error occured while qry the tenant_setup table.', error, 'FAILURE');
                        }
                    }

                    async function _executearcQuery(aiID, QueryInfos) {
                        try {
                            return new promise(async (resolve, reject) => {
                                var arrtableList = [];
                                var obj = {}
                                var combainedTableName = ''
                                for (var i = 0; i < QueryInfos.length; i++) {
                                    obj.query = QueryInfos[i].query_text;
                                    obj.query_id = QueryInfos[i].query_id;
                                    obj.ai_id = aiID
                                    combainedTableName = QueryInfos[i].base_table + '~' + QueryInfos[i].target_table
                                    if (!obj[combainedTableName]) {
                                        var objTableList = {};
                                        obj[QueryInfos[i].base_table + '~' + QueryInfos[i].target_table] = true;
                                        objTableList.base_table = QueryInfos[i].base_table;
                                        objTableList.target_table = QueryInfos[i].target_table;
                                        arrtableList.push(objTableList)

                                    } else {
                                        continue
                                    }
                                }
                                for (var j = 0; j < arrtableList.length; j++) {
                                    var curbasetableqry = new reqLINQ(QueryInfos)
                                        .Where(function (u) {
                                            return u.target_table == arrtableList[j].target_table && u.base_table == arrtableList[j].base_table
                                        }).ToArray();

                                    if (curbasetableqry.length) {
                                        var reslistCols = await _getColumns(curbasetableqry[0].target_table)
                                        var Queryres = await queryExecute(curbasetableqry, reslistCols, obj);
                                        if (Queryres == "SUCCESS") {
                                            continue;
                                        }
                                    } else {
                                        _PrintInfo(objLogInfo, ' curbasetableqry Table query is empty')
                                        continue;
                                    }
                                }
                                // query log insert success case
                                // insertRows(LiveDBSessionNoscope, 'archival_query_log', arrQryLog, function (res) {
                                _arIndexStatus(aiID, "ARCHIVAL_INDEX", "SUCCESS")
                                // reqTranDBInstance.Commit(liveDBSessionWithScope, true, function () {
                                // reqTranDBInstance.Commit(archivalDBSession, true, function () {
                                // getClientSetup('ARC_SUCCESS_COMMG_CODE', function (SetupData) {
                                //     if (SetupData.length) {
                                // var ArchivalMailSetup = JSON.parse(SetupData[0].setup_json);
                                // if (ArchivalMailSetup.Template != '') {
                                SendMail(success_commg_code);
                                // }
                                // }
                                // });
                                reqInstanceHelper.SendResponse(ServiceName, appResponse, "SUCCESS", objLogInfo, '', '', '', 'SUCCESS');
                                // })
                                // })
                                // });
                            })
                        } catch (error) {
                            reqInstanceHelper.SendResponse(ServiceName, appResponse, "", objLogInfo, 'ERR-ARC-40025', 'Error occured while qry the archival process info table.', error, 'FAILURE');

                        }
                    }


                    async function queryExecute(pCurrentQueryInfo, ColDetails, obj) {
                        return new Promise(async (resolve, reject) => {
                            try {
                                var queryRes = false;
                                for (var k = 0; k < pCurrentQueryInfo.length; k++) {
                                    var objqryLog = {};
                                    var qry = pCurrentQueryInfo[k].query_text;
                                    qry = qry.replaceAll("$ROWLIMIT", rowlimit);
                                    qry = qry.replaceAll("$RTN_PERIOD", rtnPeriod);
                                    qry = qry.replaceAll("$AI_ID", arcIndexId);
                                    // qry = qry.replace("$RETENTION_PERIOD", intRtnPeriod);
                                    objqryLog.ai_id = arcIndexId;
                                    var qryMode = pCurrentQueryInfo[k].process;

                                    if (k == 0) {
                                        var liveDbCon = await _getDbConnection({ DbMode: "LIVE" }, {});
                                        var arcDBConn = await _getDbConnection({ DbMode: "ARC" }, {});
                                    }
                                    if (pCurrentQueryInfo[k].process == "UPDATE") {
                                        objqryLog.query = qry
                                        objqryLog.start_date = new Date();
                                        queryRes = await UpdateQueryExecution(arcDBConn, liveDbCon, qry, qryMode, objqryLog);
                                        objqryLog.status = "SUCCESS";
                                        objqryLog.end_date = new Date();
                                        arrQryLog.push(objqryLog);
                                        if (queryRes.NeedInsertDelContinue) {
                                            continue;
                                        } else {
                                            break;
                                        }
                                    } else if (pCurrentQueryInfo[k].process == "INSERT") {
                                        objqryLog.start_date = new Date();
                                        await _excuteSelandInsertQry(arcDBConn, liveDbCon, qry, qryMode, pCurrentQueryInfo[k].target_table, ColDetails, arcIndexId, objqryLog)
                                        continue;
                                    } else {
                                        objqryLog.query = qry
                                        objqryLog.start_date = new Date();
                                        await executeDelQry(arcDBConn, liveDbCon, qry, objqryLog)
                                        objqryLog.status = "SUCCESS";
                                        objqryLog.end_date = new Date();
                                        arrQryLog.push(objqryLog);
                                        await commitTran(true, liveDbCon, arcDBConn, objLogInfo);
                                        await _arc_query_log_insert(LiveDBSessionNoscope, arrQryLog, objLogInfo);
                                        continue;
                                    }
                                }
                                if (queryRes.NeedContinueNxtLoop) {
                                    await queryExecute(pCurrentQueryInfo, ColDetails);
                                    _PrintInfo(objLogInfo, 'Continue next loop.');
                                    resolve("SUCCESS")
                                } else {
                                    resolve("SUCCESS")
                                }

                            } catch (error) {
                                reqInstanceHelper.SendResponse(ServiceName, appResponse, "", objLogInfo, 'ERR-ARC-4030', 'Error occured while qry the archival process info table.', error, 'FAILURE');
                            }

                        })
                    }

                    async function _getDbConnection(pParams, objLogInfo) {
                        return new Promise((resolve, reject) => {
                            try {
                                if (pParams.DbMode == 'LIVE') {
                                    reqTranDBInstance.GetTranDBConn(pHeaders, true, function (lveDB) {
                                        resolve(lveDB)
                                    })
                                } else if (pParams.DbMode == 'ARC') {
                                    reqDBInstance.GetFXDBConnectionWithScopeParam(pHeaders, 'arc_tran_db', true, objLogInfo, function (arclveDB) {
                                        resolve(arclveDB)
                                    })
                                }
                            } catch (error) {
                                reqInstanceHelper.SendResponse(ServiceName, appResponse, "", objLogInfo, 'ERR-ARC-40037', 'Exception occured _getDbConnection.', error, 'FAILURE');
                            }
                        })
                    }


                    async function commitTran(isCommit, liveDB, arcDB, objLogInfo) {
                        return new Promise((resolve, reject) => {
                            try {
                                reqTranDBInstance.Commit(liveDB, isCommit, function callbackres(res) {
                                    reqTranDBInstance.Commit(arcDB, isCommit, function callbackres(res) {
                                        liveDB.DBConn.Connection.destroy(() => {
                                            arcDB.DBConn.Connection.destroy(() => {
                                                resolve()
                                            })
                                        })
                                    })
                                })
                            } catch (error) {
                                reqInstanceHelper.SendResponse(ServiceName, appResponse, "", objLogInfo, 'ERR-ARC-40037', 'Exception occured commitTran.', error, 'FAILURE');
                            }
                        })
                    }

                    async function executeDelQry(archivalDB, liveDbCon, pQuery, objqryLog) {
                        return new Promise((resolve, reject) => {
                            try {
                                reqTranDBInstance.ExecuteSQLQuery(liveDbCon, pQuery, objLogInfo, function (pResult, pError) {
                                    if (pError) {
                                        objqryLog.end_date = new Date()
                                        objqryLog.rows_count = 0;
                                        objqryLog.status = "FAILURE";
                                        objqryLog.remarks = pError.message
                                        arrQryLog.push(objqryLog)
                                        _queryLogInsert(LiveDBSessionNoscope, liveDbCon, archivalDB, 'archival_query_log', arrQryLog, "FAILURE", pError.message)

                                    } else {
                                        objqryLog.rows_count = pResult.rowCount;
                                        objqryLog.end_date = new Date();
                                        resolve("SUCCESS")
                                    }

                                })

                            } catch (error) {
                                reqInstanceHelper.SendResponse(ServiceName, appResponse, "", objLogInfo, 'ERR-ARC-40032', 'Error occured while qry the archival process info table.', error, 'FAILURE');
                            }
                        })

                    }

                    async function UpdateQueryExecution(arcDBConn, liveDbCon, pQuery, pProcess, objqryLog) {
                        return new Promise((resolve, reject) => {
                            try {
                                var needInsrtDelContinue = false;
                                var needContinueNxtLoop = false;
                                reqTranDBInstance.ExecuteSQLQuery(LiveDBSessionNoscope, pQuery, objLogInfo, function (pResult, pError) {
                                    if (pError) {
                                        objqryLog.end_date = new Date();
                                        objqryLog.rows_count = 0
                                        objqryLog.remarks = pError.message
                                        objqryLog.status = "FAILURE"
                                        arrQryLog.push(objqryLog)
                                        _queryLogInsert(LiveDBSessionNoscope, liveDbCon, arcDBConn, "archival_query_log", arrQryLog, "FAILURE", pError.message)
                                    } else {
                                        if (pProcess == "UPDATE") {
                                            objqryLog.rows_count = pResult.rowCount;
                                            if (pResult.rowCount) {
                                                needInsrtDelContinue = true;
                                                if (pResult.rowCount >= parseInt(fetchCOunt)) {
                                                    needContinueNxtLoop = true
                                                }
                                            }
                                        }
                                        resolve({ NeedInsertDelContinue: needInsrtDelContinue, NeedContinueNxtLoop: needContinueNxtLoop })

                                    }
                                })

                            } catch (error) {
                                reqInstanceHelper.SendResponse(ServiceName, appResponse, "", objLogInfo, 'ERR-ARC-40034', 'Error occured while qry the archival process info table.', error, 'FAILURE');
                            }
                        })
                    }

                    async function insertRows(connectionDB, pTargettable, pRows, callback) {
                        try {
                            reqTranDBInstance.InsertTranDBWithAudit(connectionDB, pTargettable, pRows, objLogInfo, function (Result, Error) {
                                if (Error) {
                                    callback(Error)
                                } else {
                                    callback(Result);
                                }
                            });
                        } catch (error) {
                            reqInstanceHelper.SendResponse(ServiceName, appResponse, '', objLogInfo, 'ERR-CODE-160015', 'InsertRows Function error', error, 'FAILURE', error);
                        }
                    }




                    async function _excuteSelandInsertQry(arcDBConn, liveDBConn, pQuery, processName, pTable, ColDetails, aiID, objqryLog) {
                        try {
                            return new Promise(async (resolve, reject) => {
                                // pQuery.query = pQuery.query.replace("$AI_ID", aiID)
                                // pQuery.query = pQuery.query.replace("$ROWLIMIT", rowlimit)
                                // pQuery.start_date = new Date()

                                if (!IdenticalDB) {
                                    reqTranDBInstance.ExecuteSQLQuery(LiveDBSessionNoscope, pQuery, objLogInfo, async function (pResult, pError) {
                                        if (pError) {
                                            objqryLog.end_date = new Date()
                                            objqryLog.rows_count = 0;
                                            objqryLog.status = "FAILURE";
                                            objqryLog.remarks = pError.message
                                            arrQryLog.push(pQueryobj)
                                            _queryLogInsert(LiveDBSessionNoscope, liveDBConn, arcDBConn, 'archival_query_log', arrQryLog, "FAILURE", pError.message);
                                            _arIndexStatus(aiID, "ARCHIVAL_INDEX", "FAILURE")
                                        } else {
                                            if (processName == 'UPDATE') {
                                                // pQuery.rows_count = pResult.rowCount
                                            } else {
                                                // pQuery.rows_count = pResult.rows.length;
                                            }
                                            // pQuery.status = "SUCCESS";
                                            // queryLogArr.push(pQuery);

                                            if (pResult.rows.length && processName == "INSERT") {
                                                var res = await _insertProcess(arcDBConn, liveDBConn, pResult.rows, pTable, pQuery.status, objqryLog)
                                                if (res == "Success") {
                                                    objqryLog.end_date = new Date()
                                                    objqryLog.status = "SUCCESS";
                                                    arrQryLog.push(objqryLog)
                                                    resolve("Success")
                                                } else {
                                                    resolve("FAILURE")
                                                }
                                            } else {
                                                // pQuery.end_date = new Date()
                                                resolve("Success")
                                            }
                                        }
                                    })
                                } else {
                                    // var reslistCols = await _getColumns(pTable)
                                    var selQry = pQuery.replace('*', ColDetails)
                                    var insertQry = `INSERT INTO <arc_tran_db>.${pTable} (${ColDetails})  ( ${selQry} ) `;
                                    objqryLog.query = insertQry
                                    reqTranDBInstance.ExecuteSQLQuery(arcDBConn, insertQry, objLogInfo, async function (pResult, pError) {
                                        if (pError) {
                                            objqryLog.end_date = new Date();
                                            objqryLog.rows_count = 0;
                                            objqryLog.status = "FAILURE";
                                            objqryLog.remarks = pError.message;
                                            arrQryLog.push(objqryLog);
                                            _queryLogInsert(LiveDBSessionNoscope, liveDBConn, arcDBConn, "archival_query_log", arrQryLog, "FAILURE", pError)
                                        } else {
                                            objqryLog.end_date = new Date()
                                            objqryLog.status = "SUCCESS";
                                            objqryLog.rows_count = pResult.rowCount;
                                            arrQryLog.push(objqryLog)
                                            resolve("Success")
                                        }
                                    })
                                }
                            })
                        } catch (Error) {
                            reqInstanceHelper.SendResponse(ServiceName, appResponse, "", objLogInfo, 'ERR-ARC-40007', 'Error occured while query executed in the archival_qryinfo table.', Error, 'FAILURE');
                        }
                    }

                    // non identical db insert
                    async function _insertProcess(arcDBConn, liveDBConn, queryResult, target_table, status, objqryLog) {
                        try {
                            return new Promise((resolve, reject) => {
                                reqTranDBInstance.InsertBulkTranDB(arcDBConn, target_table, queryResult, objLogInfo, null, async function (pResult, pError) {
                                    if (pError) {
                                        objqryLog.end_date = new Date()
                                        objqryLog.rows_count = 0;
                                        objqryLog.status = "FAILURE";
                                        objqryLog.remarks = pError.message
                                        arrQryLog.push(pQueryobj)
                                        _queryLogInsert(LiveDBSessionNoscope, liveDBConn, arcDBConn, "archival_query_log", arrQryLog, "FAILURE", pError.message)
                                    } else {
                                        // objqryLog.rows_count =
                                        resolve("Success");
                                    }
                                })
                            })
                        } catch (Error) {
                            reqInstanceHelper.SendResponse(ServiceName, appResponse, "", objLogInfo, 'ERR-ARC-40005', 'Error occured while query executed in the archival_qryinfo table.', Error, 'FAILURE');
                        }

                    }


                    async function _arc_query_log_insert(pliveDbConn, pQryLogData, objLogInfo) {
                        return new Promise((resolve, reject) => {
                            try {
                                reqTranDBInstance.InsertTranDBWithAudit(pliveDbConn, 'archival_query_log', pQryLogData, objLogInfo, function (pResult, pError) {
                                    if (pError) {
                                        reqInstanceHelper.SendResponse(ServiceName, appResponse, "", objLogInfo, 'ERR-ARC-40036', 'Error occured insert _arc_query_log_insert table', pError, 'FAILURE');
                                    } else {
                                        arrQryLog = [];
                                        resolve()
                                    }
                                })

                            } catch (error) {
                                reqInstanceHelper.SendResponse(ServiceName, appResponse, "", objLogInfo, 'ERR-ARC-40035', 'Exception occured insert _arc_query_log_insert table', error, 'FAILURE');
                            }
                        })
                    }

                    async function _getColumns(table) {
                        return new Promise((resolve, reject) => {
                            try {
                                _PrintInfo(objLogInfo, 'Getting column details')
                                var schmeaname = LiveDBSessionNoscope.DBConn.Connection.client.searchPath;
                                let columns = `select get_column_names('${table.toLowerCase()}', '${schmeaname}')`
                                reqTranDBInstance.ExecuteSQLQuery(LiveDBSessionNoscope, columns, objLogInfo, async function (pResult, pError) {
                                    if (pError) {
                                        reqInstanceHelper.SendResponse(ServiceName, appResponse, "", objLogInfo, 'ERR-ARC-40036', 'Error occured insert _arc_query_log_insert table', pError, 'FAILURE');
                                    } else {
                                        _PrintInfo(objLogInfo, 'Got the column details')
                                        resolve(pResult.rows[0]['get_column_names'])
                                    }
                                })
                            } catch (error) {
                                reqInstanceHelper.SendResponse(ServiceName, appResponse, "", objLogInfo, 'ERR-ARC-40035', 'Exception occured insert _arc_query_log_insert table', error, 'FAILURE');
                            }
                        })
                    }


                    async function _queryLogInsert(dbConnection, liveDBWithScope, ArchivalSession, target_table, queryLogArr, status, pErr) {
                        try {
                            if (status == "FAILURE") {
                                for (var logid = 0; logid < queryLogArr.length; logid++) {
                                    if (queryLogArr[logid].status == 'SUCCESS') {
                                        queryLogArr[logid].status = "ROLLBACK"
                                    }
                                }
                            }
                            reqTranDBInstance.InsertTranDBWithAudit(dbConnection, target_table, queryLogArr, objLogInfo, async function (pResult, pError) {
                                if (pError) {
                                    resolve("FAILURE");
                                } else {
                                    var isCommit = false
                                    if (status == "SUCCESS") {
                                        // isCommit = true
                                        isCommit = true
                                    }
                                    await commitTran(false, liveDBWithScope, ArchivalSession, objLogInfo);
                                    SendMail(failure_commg_code);
                                    reqInstanceHelper.SendResponse(ServiceName, appResponse, "", objLogInfo, 'ERR-ARC-40004', 'Error occured .', '', 'FAILURE');

                                    // reqTranDBInstance.Commit(liveDBWithScope, isCommit, function callbackres(res) {
                                    //     reqTranDBInstance.Commit(ArchivalSession, isCommit, function callbackres(res) {
                                    //         if (status == 'FAILURE') {
                                    //             reqInstanceHelper.SendResponse(ServiceName, appResponse, "", objLogInfo, 'ERR-ARC-40009', 'Error occured .', '', 'FAILURE');
                                    //         } else {
                                    //             reqInstanceHelper.SendResponse(ServiceName, appResponse, "SUCCESS", objLogInfo, '', pErr, '', 'SUCCESS');
                                    //         }
                                    //     })
                                    // })
                                }
                            })
                        } catch (error) {
                            reqInstanceHelper.SendResponse(ServiceName, appResponse, "", objLogInfo, 'ERR-ARC-40005', 'Error occured while query executed in the archival_qrylog insert table.', error, 'FAILURE');
                        }
                    }

                    async function _getArchivalPrending(dbSession) {
                        return new Promise(async (resolve, reject) => {
                            try {
                                var query = `select * from archival_index where status='ARCHIVAL_PROCESS_FAILURE'`
                                reqTranDBInstance.ExecuteSQLQuery(dbSession, query, objLogInfo, async function (pResult, pError) {
                                    if (pError) {
                                        resolve("FAILURE")
                                    } else {
                                        resolve(pResult)
                                    }
                                })
                            } catch (error) {
                                reqInstanceHelper.SendResponse(ServiceName, appResponse, "", objLogInfo, 'ERR-ARC-400028', 'Error occured while query executed in the archival_index table.', error, 'FAILURE');
                            }
                        })
                    }

                    async function _GetArIndex(objLogInfo) {
                        return new Promise(async (resolve, reject) => {
                            try {
                                var AiRow = {};
                                AiRow.AI_DESCRIPTION = 'Archival process';
                                AiRow.APP_ID = objLogInfo.APP_ID;
                                AiRow.TENANT_ID = objLogInfo.TENANT_ID;
                                insertRows(LiveDBSessionNoscope, 'ARCHIVAL_INDEX', [AiRow], function (res) {
                                    resolve(res[0].ai_id);
                                });

                            } catch (error) {
                                reqInstanceHelper.SendResponse(ServiceName, appResponse, '', objLogInfo, 'ERR-CODE-160014', 'GetArIndex Function error', error, 'FAILURE', error);
                            }
                        })

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
                        _PrintInfo(objLogInfo, 'sending mail')
                        var RedisURLKey = "SERVICE_MODEL";
                        var URLPrecedence = "";
                        // get the nginx url in redis
                        reqRedisInstance.GetRedisConnection(async function (error, clientR) {
                            if (error) {
                                reqInstanceHelper.SendResponse('Achival Process', appResponse, '', objLogInfo, 'ERR-MIN-50603', 'ERROR IN GET REDIS CONNECTION ', error, '', '');
                            } else {

                                var urldtlFromRedis = await clientR.get(RedisURLKey)
                                URLPrecedence = JSON.parse(urldtlFromRedis)["NODEFS_URL"];
                                var allPorts = await getPortNumber()
                                var CommPort = allPorts.ServicePort['Communication']
                                URLPrecedence = URLPrecedence.replace('<service_port>', CommPort);

                                var CommUrl = URLPrecedence + "/Communication/SendMessage/";
                                console.log("URL PRECEDENCE" + URLPrecedence);
                                console.log("URL IS " + CommUrl);
                                _PrintInfo(objLogInfo, 'CommUrl is  ' + CommUrl)
                                var PARAMS = {
                                    PARAMS: {
                                        TEMPLATECODE: InputParams,
                                        PROCESS: 'DELETE',
                                        AR_ID: arcIndexId,
                                        WFTPA_ID: 'DEFAULT',
                                        DT_CODE: 'DEFAULT',
                                        DTT_CODE: 'DEFAULT',
                                        EVENT_CODE: 'DEFAULT',
                                        ISARCHIVAL: 'Y'
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
                                    url: CommUrl,
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
                                            _PrintInfo(objLogInfo, 'Mail send failed ' + error)
                                        } else {
                                            // CallbackDelete();
                                            _PrintInfo(objLogInfo, 'Communication api response  | ' + JSON.stringify(body))
                                        }
                                    } catch (error) {
                                        reqInstanceHelper.SendResponse('Achival Process', appResponse, '', objLogInfo, 'ERR-MIN-50606', 'ERROR IN Archival send mail api', error, '', '');
                                    }
                                });
                                // }
                                // });
                            }
                        });
                    }

                    async function getPortNumber() {
                        try {
                            return new Promise((resolve, reject) => {
                                reqInstanceHelper.ReadConfigFile(function (error, pConfig) {
                                    resolve(pConfig)
                                })
                            })
                        } catch (error) {
                            reqInstanceHelper.SendResponse(ServiceName, appResponse, '', objLogInfo, 'ERR-CODE-400031', 'getPortNumber Function error', error, 'FAILURE', error);
                        }
                    }
                    async function _arIndexStatus(aiID, target_table, status) {
                        return new Promise((resolve, reject) => {
                            try {
                                reqTranDBInstance.UpdateTranDB(LiveDBSessionNoscope, target_table, { status: status }, { ai_id: aiID }, objLogInfo, function (pResult, pError) {
                                    if (pError) {
                                        reqInstanceHelper.SendResponse(ServiceName, appResponse, '', objLogInfo, 'ERR-CODE-400021', 'GetArIndexStatus Function error', pError, 'FAILURE', pError);
                                    } else {
                                        resolve("SUCCESS");
                                    }
                                })
                            } catch (error) {
                                reqInstanceHelper.SendResponse(ServiceName, appResponse, '', objLogInfo, 'ERR-CODE-400021', 'GetArIndex Function error', error, 'FAILURE', error);
                            }
                        })
                    }

                    function _PrintInfo(pLogInfo, pMessage) {
                        reqInstanceHelper.PrintInfo(ServiceName, pMessage, pLogInfo);
                    }

                })

            })

            // })
        })

    } catch (error) {

    }
})

module.exports = router;