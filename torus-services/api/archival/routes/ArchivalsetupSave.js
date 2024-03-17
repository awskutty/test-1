/*
@Api_Name         : /savearchivalsetup,
@Description      : To create archival Setup 
@Last_Error_code  : ERR-ARC-
@Last_Modified_for:DELETE_WHEN_NO_CHILD and Sort order implementation. 
*/

// Require dependencies
var reqExpress = require('express');
var router = reqExpress.Router();
var reqAsync = require('async');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqAuditLog = require('../../../../torus-references/log/audit/AuditLog');
var reqCommon = require('../../../../torus-references/transaction/Common');
var reqDateFormatter = require('../../../../torus-references/common/dateconverter/DateFormatter');
const { resolve } = require('path');
const { reject } = require('lodash');
var reqLINQ = require("node-linq").LINQ;

router.post('/savearchivalsetup', function (appRequest, appResponse) {
    try {
        var ServiceName = 'savearchivalsetup';
        var pHeaders = appRequest.headers;
        var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
        var auditarcMode = serviceModel.AUDIT_ARCHIVAL_MODEL;
        // var rowCOunt = 100
        // var rowlimit = ''
        // if (serviceModel.TRANDB == 'POSTGRES') {
        //     rowlimit = ` limit ${rowCOunt}`
        // } else if (serviceModel.TRANDB == 'ORACLE') {
        //     rowlimit = ` and rownum = ${rowCOunt}`
        // }

        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
            objLogInfo.PROCESS_INFO.PROCESS_NAME = 'Save_Archival_Setup';
            reqDBInstance.GetFXDBConnection(pHeaders, 'dep_cas', objLogInfo, function Callback_GetCassandraConn(pClient) {
                reqDBInstance.GetFXDBConnection(pHeaders, 'clt_cas', objLogInfo, function Callback_Conn(cltClinet) {
                    reqTranDBInstance.GetTranDBConn(pHeaders, false, function (pSession) {
                        reqAuditLog.GetProcessToken(pSession, objLogInfo, function (error, prct_id) {
                            _PrintInfo(objLogInfo, "Get Connection Ended");
                            var params = appRequest.body.PARAMS;
                            var ObjName = params.ObjName;
                            var ObjType = params.ObjType;
                            var DttCode = params.DttCode;
                            var DtCode = params.DtCode;
                            var TargetTable = params.TargetTable;
                            var TableType = params.TableType;
                            var KeyColumn = params.KeyColumn;
                            var DeleteWhen = params.Delete_Me;
                            var ArSetupMode = params.SetupMode;
                            var strAsId = '';
                            var TextType = 'TEXT';
                            if (pSession && pSession.DBConn && pSession.DBConn.DBType && pSession.DBConn.DBType.toUpperCase() == "ORACLEDB") {
                                TextType = "varchar2(128)";
                            }
                            var TrnaData = '';

                            if (params.as_id) {
                                deleteArsetup();
                            } else {
                                // Get Archival set up Unique id from fx total items table and AR index id
                                // mainfunction();
                                _getUnqId();
                            }

                            function deleteArsetup() {
                                try {
                                    var delCond = {
                                        as_id: params.as_id
                                    };
                                    reqDBInstance.DeleteFXDB(pClient, 'ARCHIVAL_SETUP', delCond, objLogInfo, function (pErr, pRes) {
                                        if (pErr) {
                                            var res = {};
                                            res.errMessage = " while delete archival setup  table ";
                                            res.errCode = "ERR-ARCH-45052";
                                            res.errobj = pErr;
                                            sendFailureRespone(res);
                                        } else {
                                            reqTranDBInstance.DeleteTranDB(pSession, 'ARCHIVAL_QRY_INFO', delCond, objLogInfo, function (Res, err) {
                                                if (err) {
                                                    var res = {};
                                                    res.errMessage = " while delete archival query info table ";
                                                    res.errCode = "ERR-ARCH-45051";
                                                    res.errobj = err;
                                                    sendFailureRespone(res);
                                                } else {
                                                    reqTranDBInstance.DeleteTranDB(pSession, 'ARCHIVAL_PROCESS_INFO', delCond, objLogInfo, function (res, error) {
                                                        if (error) {
                                                            var res = {};
                                                            res.errMessage = " while delete archival process table ";
                                                            res.errCode = "ERR-ARCH-45050";
                                                            res.errobj = error;
                                                            sendFailureRespone(res);
                                                        } else {
                                                            // mainfunction();
                                                            _getUnqId();
                                                        }
                                                    });
                                                }
                                            });
                                        }
                                    });
                                } catch (error) {
                                    var res = {};
                                    res.errMessage = " when call  deleteArsetup ";
                                    res.errCode = "ERR-ARCH-45054";
                                    res.errobj = error;
                                    sendFailureRespone(res);
                                }
                            };

                            function _getUnqId() {
                                _PrintInfo(objLogInfo, "Geting Unique id for ar(archival index id) and as (archival setup id)");
                                _GetASID("ARCHIVAL_SETUP").then((asID) => {
                                    _PrintInfo(objLogInfo, "Got archival setup id");
                                    strAsId = asID.toString();
                                    mainfunction();
                                });
                            };

                            function mainfunction() {
                                try {
                                    _PrintInfo(objLogInfo, "Calling main function with table type " + TableType);
                                    if (TableType == "STATIC") {
                                        // Static table query prepare
                                        StaticTableQry().then((staticQryObj) => {
                                            _PrintInfo(objLogInfo, "Got the query , going to call _insertArqrynfo function ");
                                            _insertArqrynfo(staticQryObj.selectquery, staticQryObj.deletequery);
                                        }).catch((error) => {
                                            var res = {};
                                            res.errMessage = "Exception occured StaticTableQry promis return function";
                                            res.errCode = "ERR-ARCH-46015";
                                            res.errobj = error;
                                            sendFailureRespone(res);
                                        });
                                    } else if (TableType == "FX_TABLE") {
                                        // FX table query prepare
                                        Fxtablequery().then(function (qryobj) {
                                            _insertArqrynfo(qryobj.selectquery, qryobj.deletequery);
                                        }).catch(function (err) {
                                            sendFailureRespone(err);
                                        });
                                    } else if (TableType == "DYNAMIC") {
                                        // Dynamic table query prepare
                                        DynamicTableQry().then(function (qryobj) {
                                            _insertArqrynfo(qryobj.selectquery, qryobj.deletequery);
                                        }).catch((err) => {
                                            sendFailureRespone(err);
                                        });
                                    } else {
                                        appResponse.send("Table type not avail");
                                    }
                                } catch (error) {
                                    var res = {};
                                    res.errMessage = "Exception occured mainfunction function";
                                    res.errCode = "ERR-ARCH-46001";
                                    res.errobj = error;
                                    sendFailureRespone(res);
                                }
                            }
                            function StaticTableQry() {
                                return new Promise((resolve, reject) => {
                                    try {
                                        _PrintInfo(objLogInfo, "Prepare static table query");
                                        var staticDelQry = "DELETE FROM <tran_db>." + TargetTable + " TRN1 WHERE ";
                                        var staticInsert = `INSERT INTO <arc_tran_db>.${TargetTable} SELECT * FROM <tran_db>.${TargetTable} TRN1 WHERE `
                                        var staticSel = `SELECT * FROM <tran_db>.${TargetTable} TRN1 WHERE `
                                        _GetConditionParam(params.setupJson, function (cond) {
                                            _PrintInfo(objLogInfo, "Got the where condition");
                                            var staticqry = [{
                                                query_mode: "INSERT",
                                                query_text: staticInsert + cond,
                                                sort_order: 1,
                                                query_id: `${TargetTable}_INSERT`,
                                                target_table: TargetTable,
                                                sel_query: staticSel
                                            }, {
                                                query_mode: "DELETE",
                                                query_text: staticDelQry + cond,
                                                sort_order: 2,
                                                query_id: `${TargetTable}_DELETE`,
                                                target_table: TargetTable,
                                                sel_query: staticSel
                                            }];
                                            var InserarrDel = [];
                                            var insertarrInst = [];
                                            for (var i = 0; i < staticqry.length; i++) {
                                                var insertobj = {
                                                    DT_CODE: "STATIC",
                                                    DTT_CODE: "STATIC",
                                                    QUERY_TEXT: staticqry[i].query_text,
                                                    QUERY_TYPE: "STATIC",
                                                    TARGET_TABLE: staticqry[i].target_table,
                                                    SELECT_QUERY: staticqry[i].sel_query,
                                                    BASE_TABLE: TargetTable,
                                                    APP_ID: objLogInfo.APP_ID,
                                                    TENANT_ID: objLogInfo.TENANT_ID,
                                                    AS_ID: strAsId,
                                                    sort_order: staticqry[i].sort_order,
                                                    STATUS: 'CREATED',
                                                    created_by: objLogInfo.USER_ID || 1,
                                                    prct_id: prct_id,
                                                    created_date: reqDateFormatter.GetTenantCurrentDateTime(pHeaders, objLogInfo),
                                                    query_id: staticqry[i].query_id,
                                                    process: staticqry[i].query_mode
                                                };
                                                if (staticqry[i].query_mode == "DELETE" || staticqry[i].query_mode == 'ARC_INSERT') {
                                                    insertobj.schema_name = 'tran_db';
                                                    InserarrDel.push(insertobj);
                                                } else {
                                                    insertobj.sort_order = i;
                                                    insertobj.process = staticqry[i].query_mode;
                                                    insertarrInst.push(insertobj);
                                                }
                                            };
                                            var allqry = {};
                                            allqry.deletequery = InserarrDel;
                                            allqry.selectquery = insertarrInst;
                                            resolve(allqry);
                                        });
                                    } catch (error) {
                                        reject(error);
                                    }
                                });
                            }

                            function _InsertArchSetup() {
                                try {
                                    _PrintInfo(objLogInfo, "preare insert data for archival setup");
                                    var archinsertobj = {};
                                    archinsertobj.AS_ID = strAsId.toString();
                                    archinsertobj.APP_ID = objLogInfo.APP_ID;
                                    archinsertobj.CREATED_BY = objLogInfo.USER_ID;
                                    archinsertobj.CREATED_DATE = reqDateFormatter.GetTenantCurrentDateTime(pHeaders, objLogInfo);
                                    archinsertobj.object_Name = ObjName || "TEST";
                                    archinsertobj.object_type = ObjType || "TEST";
                                    archinsertobj.SETUP_JSON = JSON.stringify(params) || '';
                                    archinsertobj.DTT_CODE = DttCode;
                                    archinsertobj.DT_CODE = DtCode;
                                    archinsertobj.APP_ID = objLogInfo.APP_ID;
                                    archinsertobj.TENANT_ID = objLogInfo.TENANT_ID;
                                    archinsertobj.TARGET_TABLE = TargetTable;
                                    archinsertobj.prct_id = prct_id
                                    _PrintInfo(objLogInfo, "Archival setup insert started");
                                    reqDBInstance.InsertFXDB(pClient, "ARCHIVAL_SETUP", [archinsertobj], objLogInfo, function (pErr, pRes) {
                                        if (pErr) {
                                            var res = {};
                                            res.errMessage = "Error occured _InsertArchSetup function";
                                            res.errCode = "ERR-ARCH-46037";
                                            res.errobj = pErr;
                                            sendFailureRespone(res);
                                        } else {
                                            _PrintInfo(objLogInfo, "Archival setup insert Ended");
                                            reqInstanceHelper.SendResponse(ServiceName, appResponse, "SUCCESS", objLogInfo, '', '', '', 'SUCCESS');
                                        }
                                    });

                                } catch (error) {
                                    var res = {};
                                    res.errMessage = "Exception occured _InsertArchSetup function";
                                    res.errCode = "ERR-ARCH-46007";
                                    res.errobj = error;
                                    sendFailureRespone(res);
                                }
                            };

                            function _GetASID(pCode) {
                                return new Promise((resolve, reject) => {
                                    try {
                                        _PrintInfo(objLogInfo, "Get unique id for archival setup - update fx total items");
                                        var updatefx = "update fx_total_items set counter_value = counter_value + 1 where code='" + pCode + "'";
                                        reqDBInstance.ExecuteQuery(cltClinet, updatefx, objLogInfo, function (pErr, Res) {
                                            try {
                                                if (pErr) {
                                                    console.log(pErr);
                                                    reject(pErr);
                                                } else {
                                                    _SelFxToltalItems(pCode, function (response) {
                                                        _PrintInfo(objLogInfo, "Got unique id");
                                                        resolve(response);
                                                    });
                                                }
                                            } catch (error) {
                                                return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-5', 'Exception Occured while executing FxTotalItem function pg Select Query ', error, '', '');
                                            }
                                        });
                                    } catch (error) {
                                        var res = {};
                                        res.errMessage = "Exception occured _GetASID function";
                                        res.errCode = "ERR-ARCH-46002";
                                        res.errobj = error;
                                        sendFailureRespone(res);
                                    }
                                });
                            };

                            //fx_total_items select
                            function _SelFxToltalItems(pCode, callback) {
                                try {
                                    _PrintInfo(objLogInfo, "Get id from fx total items");
                                    var fxquery = "select counter_value from fx_total_items where code='" + pCode + "'";
                                    reqDBInstance.ExecuteQuery(cltClinet, fxquery, objLogInfo, function (error, result) {
                                        try {
                                            if (error) {
                                                console.log(error);
                                            } else {
                                                if (result.rows.length > 0) {
                                                    var value = result.rows[0].counter_value;
                                                    callback(value);
                                                }
                                            }
                                        } catch (error) {
                                            var res = {};
                                            res.errMessage = "Exception occured call back execution function";
                                            res.errCode = "ERR-ARCH-46005";
                                            res.errobj = error;
                                            sendFailureRespone(res);
                                        }
                                    });
                                } catch (error) {
                                    var res = {};
                                    res.errMessage = "Exception occured _SelFxToltalItems function";
                                    res.errCode = "ERR-ARCH-46003";
                                    res.errobj = error;
                                    sendFailureRespone(res);
                                }
                            }

                            // Insert archival query info table
                            function _insertArqrynfo(Selinserarr, DelInsertarr, strqry) {
                                var strqry = strqry;
                                _PrintInfo(objLogInfo, "Insert archival qery info insert started");
                                insertRows("ARCHIVAL_QRY_INFO", Selinserarr, function (res) {
                                    _PrintInfo(objLogInfo, "Insert archival qerinfo insert Ended");
                                    insertRows("archival_qry_info", DelInsertarr, function (res) {
                                        _PrintInfo(objLogInfo, "AARCHIVAL_PROCESS_INFO insert success");
                                        _PrintInfo(objLogInfo, "Archival setup table insert function started");
                                        _InsertArchSetup();
                                    });
                                });
                            };


                            function insertRows(pTargettable, pRows, callback) {
                                try {
                                    _PrintInfo(objLogInfo, "Insert started for " + pTargettable + " table.");
                                    reqTranDBInstance.InsertTranDBWithAudit(pSession, pTargettable, pRows, objLogInfo, function (Result, Error) {
                                        if (Error) {
                                            callback(Error);
                                        } else {
                                            _PrintInfo(objLogInfo, "Insert Success for " + pTargettable + " table.");
                                            callback(Result);
                                        }
                                    });
                                } catch (error) {
                                    var res = {};
                                    res.errMessage = "Exception occured insertRows function";
                                    res.errCode = "ERR-ARCH-46012";
                                    res.errobj = error;
                                    sendFailureRespone(res);
                                }
                            }

                            function DynamicTableQry() {
                                return new Promise((resolve, reject) => {
                                    try {
                                        var Full_dttr = [];
                                        var CurrentDtInfo = {};
                                        var cond = {};
                                        cond.app_id = objLogInfo.APP_ID;
                                        cond.dt_code = DtCode;
                                        // Get DT_INFO Releation Json to find parent child target tables
                                        reqDBInstance.GetTableFromFXDB(pClient, 'DT_INFO', [], cond, objLogInfo, function (error, result) {
                                            if (error) {
                                                var res = {};
                                                res.errMessage = "Error query DT_INFO";
                                                res.errCode = "ERR-ARCH-46055";
                                                res.errobj = error;
                                                sendFailureRespone(res);
                                            } else {
                                                var objdtInfoR = result.rows[0];
                                                var DTR = [];
                                                if (objdtInfoR) {
                                                    if (objdtInfoR.relation_json) {
                                                        DTR = JSON.parse(objdtInfoR.relation_json);
                                                        Full_dttr = JSON.parse(objdtInfoR.relation_json);
                                                    } else {
                                                        var res = {};
                                                        res.errMessage = "Relation Not Found";
                                                        res.errCode = "ERR-ARCH-46056";
                                                        res.errobj = 'Relation not Found';
                                                        sendFailureRespone(res);
                                                    }
                                                } else {
                                                    var res = {};
                                                    res.errMessage = "Relation not Found ";
                                                    res.errCode = "ERR-ARCH-46055";
                                                    res.errobj = 'Relation not Found';
                                                    sendFailureRespone(res);
                                                }


                                                var sortorder = 0;
                                                preparesortorder(Full_dttr);
                                                function preparesortorder(parsedJson) {
                                                    // for (var i = parsedJson.length - 1; i >= 0; i--) {
                                                    for (var i = 0; i < parsedJson.length; i++) {
                                                        sortorder = sortorder + 1;
                                                        parsedJson[i]['sort_order'] = sortorder;
                                                        preparesortorder(parsedJson[i].CHILD_DTT_RELEATIONS);
                                                    }
                                                }


                                                _getCurrentDttInfo(DttCode);

                                                function _getCurrentDttInfo(pDtCod) {
                                                    try {
                                                        reqCommon.DoFilterRecursiveArr(Full_dttr, pDtCod, 'DTT_CODE', 'CHILD_DTT_RELEATIONS', objLogInfo, function (dttR) {
                                                            CurrentDtInfo = dttR;
                                                        });
                                                    } catch (error) {
                                                        console.log(error);
                                                    }
                                                }


                                                //  To find all child
                                                var childarr = [];
                                                //findAllChild(Full_dttr, DttCode);

                                                findallImidiateChild(Full_dttr, DttCode);

                                                // function findAllChild(fulDtr, dtt) {
                                                //     reqCommon.DoFilterRecursiveArr(fulDtr, dtt, 'DTT_CODE', 'CHILD_DTT_RELEATIONS', objLogInfo, function (dttR) {
                                                //         if (dttR.TARGET_TABLE != CurrentDtInfo.TARGET_TABLE) {
                                                //             childarr.push(dttR);
                                                //         }
                                                //         for (var i = 0; i < dttR.CHILD_DTT_RELEATIONS.length; i++) {
                                                //             findAllChild(fulDtr, dttR.CHILD_DTT_RELEATIONS[i].DTT_CODE);
                                                //         }
                                                //     });
                                                // }

                                                function findallImidiateChild(fulDtr, dtt) {
                                                    _PrintInfo(objLogInfo, "findallImidiateChild ");
                                                    reqCommon.DoFilterRecursiveArr(fulDtr, dtt, 'DTT_CODE', 'CHILD_DTT_RELEATIONS', objLogInfo, function (dttR) {
                                                        childarr = dttR.CHILD_DTT_RELEATIONS;
                                                    });
                                                }
                                                if (DeleteWhen.toUpperCase() == "DELETE_WHEN_NO_CHILD") {
                                                    findallImidiateChild(Full_dttr, CurrentDtInfo);
                                                    PreparewhenNoChildqry(CurrentDtInfo, childarr, function (arryQry) {
                                                        resolve(arryQry);
                                                    });
                                                } else if (DeleteWhen.toUpperCase() == "NONE") {
                                                    deleteModeNoneqry(CurrentDtInfo, function (arryQry) {
                                                        resolve(arryQry);
                                                    });
                                                } else {
                                                    // Delete when No parent (Delete_when_parent_deleted)
                                                    _whenNoparent(CurrentDtInfo, Full_dttr, function (arryQry) {
                                                        resolve(arryQry);
                                                    });
                                                }
                                            }
                                        });
                                    } catch (error) {
                                        var res = {};
                                        res.errMessage = "Exception occured DynamicTableQry function";
                                        res.errCode = "ERR-ARCH-46009";
                                        res.errobj = error;
                                        reject(res);
                                    }
                                });
                            }

                            function PreparewhenNoChildqry(CurrentDtInfo, childarr, pcallback) {
                                _GetConditionParam(params.setupJson, function (strCond) {
                                    var strCommon = '';
                                    var totalLength = childarr.length;
                                    var tempItem = '';
                                    if (auditarcMode == "SOLR") {
                                        HstTranDel = HstTranDel + ` AND PROCESS_COUNT=1 AND LOCK_ID IS NULL`;
                                    }
                                    for (var i = 0; i < childarr.length; i++) {
                                        if (i == 0) {
                                            strCommon = strCommon + " INNER JOIN  " + childarr[i].TARGET_TABLE + " T" + [i] + " ON TRN" + [i + 1] + "." + CurrentDtInfo.PRIMARY_COLUMN + " = " + " T" + [i] + "." + childarr[i].FOREIGN_COLUMN + " WHERE TRN" + [i + 1] + ".TENANT_ID ='" + objLogInfo.TENANT_ID + "'" + " AND T" + [i] + ".AI_ID IS NULL";
                                        } else {
                                            strCommon = strCommon + " INNER JOIN  " + childarr[i].TARGET_TABLE + " T" + [i] + " ON TRN" + [i + 1] + "." + childarr[i].FOREIGN_COLUMN + " = " + " T" + [i] + "." + childarr[i].FOREIGN_COLUMN + " WHERE TRN" + [i + 1] + ".TENANT_ID ='" + objLogInfo.TENANT_ID + "'" + " AND T" + [i] + ".AI_ID IS NULL";
                                        }

                                        if (totalLength - 1 == i) {
                                            continue;
                                        } else {
                                            tempItem = i;
                                            if (tempItem != 0) {
                                                strCommon = strCommon + " UNION SELECT " + " TRN" + [i + 2] + "." + childarr[i - 1].PRIMARY_COLUMN + " FROM " + childarr[i - 1].TARGET_TABLE + " TRN" + [i + 2];
                                            } else {
                                                strCommon = strCommon + " UNION SELECT " + " TRN" + [i + 2] + "." + childarr[i].PRIMARY_COLUMN + " FROM " + childarr[i].TARGET_TABLE + " TRN" + [i + 2];
                                            }
                                            // strCommon = strCommon + " UNION SELECT " + " TRN" + [i + 2] + "." + CurrentDtInfo.PRIMARY_COLUMN + " FROM " + CurrentDtInfo.TARGET_TABLE + " TRN" + [i + 2];
                                            // strCommon = strCommon + " UNION SELECT " + " TRN" + [i + 2] + "." + childarr[i - 1].PRIMARY_COLUMN + " FROM " + childarr[i - 1].TARGET_TABLE + " TRN" + [i + 2];
                                        }
                                    }

                                    var strqry = "INSERT INTO ARCHIVAL_INDEX_DETAIL (AI_ID,TABLE_NAME,KEY_COLUMN_ID,KEY_COLUMN_NAME) SELECT $AI_ID AS AI_ID , '" + CurrentDtInfo.TARGET_TABLE + "' as table_name ," + CurrentDtInfo.PRIMARY_COLUMN + " as key_column_id ,'" + CurrentDtInfo.PRIMARY_COLUMN + "' as key_column_name " + " FROM " + CurrentDtInfo.TARGET_TABLE + " TRN1 WHERE (AI_ID IS NULL ) AND " + strCond + " AND " + CurrentDtInfo.PRIMARY_COLUMN + " NOT IN ( SELECT " + " TRN1." + CurrentDtInfo.PRIMARY_COLUMN + " FROM " + CurrentDtInfo.TARGET_TABLE + " TRN1 ";
                                    var strSelectIdQry = `SELECT ${CurrentDtInfo.PRIMARY_COLUMN} FROM ${CurrentDtInfo.TARGET_TABLE}  TRN1 WHERE ${strCond}  AND ${CurrentDtInfo.PRIMARY_COLUMN}  NOT IN ( SELECT TRN1.${CurrentDtInfo.PRIMARY_COLUMN} FROM ${CurrentDtInfo.TARGET_TABLE} TRN1 `
                                    strqry = strqry + strCommon + ")";
                                    strSelectIdQry = strSelectIdQry + strCommon + ")";

                                    //@tranSetUpdate, update transaction_set table archival index id, to prevent same tranction insert archival index details table 
                                    var tranSetUpdate = "UPDATE " + CurrentDtInfo.TARGET_TABLE + " SET AI_ID = $AI_ID , PRCT_ID = $PRCT_ID WHERE " + CurrentDtInfo.PRIMARY_COLUMN + " IN(SELECT KEY_COLUMN_ID  FROM  ARCHIVAL_INDEX_DETAIL WHERE AI_ID = $AI_ID  AND table_name = '" + CurrentDtInfo.TARGET_TABLE + "')";

                                    // Archival schema insert quries
                                    var TranTblInsert = `INSERT INTO <arc_tran_db>.${CurrentDtInfo.TARGET_TABLE} ( SELECT * FROM <tran_db>.${CurrentDtInfo.TARGET_TABLE} WHERE ${CurrentDtInfo.PRIMARY_COLUMN} IN ( ${strSelectIdQry})) `
                                    var TranCmtInsert = "INSERT INTO <arc_tran_db>.TRANSACTION_COMMENTS ( SELECT * FROM <tran_db>.TRANSACTION_COMMENTS WHERE DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND  TS_ID  IN ( SELECT TS_ID FROM TRANSACTION_SET WHERE DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND TRN_ID IN ( " + strSelectIdQry + ")))";
                                    var TranSetInsert = "INSERT INTO <arc_tran_db>.TRANSACTION_SET  ( SELECT * FROM <tran_db>.TRANSACTION_SET WHERE DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND TRN_ID IN (" + strSelectIdQry + "'))";
                                    var TranJournyInsert = "INSERT INTO <arc_tran_db>.TRANSACTION_JOURNEY ( SELECT * FROM <tran_db>.TRANSACTION_JOURNEY WHERE DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND TRN_ID IN (" + strSelectIdQry + "))";
                                    var TranJrnyDtlInsert = "INSERT INTO <arc_tran_db>.TRANSACTION_JOURNEY_DETAIL (SELECT * FROM <tran_db>.TRANSACTION_JOURNEY_DETAIL WHERE DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND TRN_ID IN ( " + strSelectIdQry + "))";
                                    var TranAtmtInsert = "INSERT INTO <arc_tran_db>.TRN_ATTACHMENTS ( SELECT * FROM <tran_db>.TRN_ATTACHMENTS WHERE IS_PROCESSED='Y' AND DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND TRN_ID IN ( " + strSelectIdQry + "))";
                                    var TranaDataInsert = "INSERT INTO <arc_res_db>.TRNA_DATA ( SELECT * FROM <res_cas>.TRNA_DATA WHERE IS_PROCESSED='Y' AND RELATIVE_PATH IN (select relative_path from TRN_ATTACHMENTS WHERE DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND TRN_ID IN (" + strSelectIdQry + ")))";
                                    // var strArcPrctqry = `INSERT INTO <arc_res_db>.PRC_TOKENS ( SELECT * FROM <tran_db>.PRC_TOKENS WHERE PRCT_ID IN (SELECT DISTINCT PRCT_ID FROM  <tran_db>.HST_TRAN_DATA WHERE TRAN_ID IN(SELECT KEY_COLUMN_ID  FROM  ARCHIVAL_INDEX_DETAIL WHERE AI_ID = $AI_ID  AND table_name = '${CurrentDtInfo.TARGET_TABLE}') AND DTT_CODE='${CurrentDtInfo.DTT_CODE}' AND PROCESS_COUNT=1 AND LOCK_ID IS NULL) AND PROCESS_COUNT=1 AND LOCK_ID IS NULL)`;

                                    var HstTranInsert = "INSERT INTO <arc_res_db>.HST_TRAN_DATA ( SELECT * FROM <res_cas>.HST_TRAN_DATA WHERE TRAN_ID IN (" + strSelectIdQry + "))";


                                    // Tran db delete queries
                                    var TranTblDel = "DELETE FROM <tran_db>." + CurrentDtInfo.TARGET_TABLE + "  WHERE " + CurrentDtInfo.PRIMARY_COLUMN + " IN ( " + strSelectIdQry + ")";
                                    var TrnSetDel = "DELETE FROM <tran_db>.TRANSACTION_SET WHERE DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND TRN_ID IN ( " + strSelectIdQry + ")";
                                    var TranAtmtDel = "DELETE FROM <tran_db>.TRN_ATTACHMENTS WHERE IS_PROCESSED='Y' AND  DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND TRN_ID IN (" + strSelectIdQry + ")";
                                    var TranCmtDel = "DELETE FROM <tran_db>.TRANSACTION_COMMENTS WHERE DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND  TS_ID   IN ( SELECT TS_ID FROM TRANSACTION_SET WHERE DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND (TRN_ID IN (" + strSelectIdQry + "))";
                                    var TranJourneyDel = "DELETE FROM <tran_db>.TRANSACTION_JOURNEY WHERE DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND  TRN_ID IN (" + strSelectIdQry + ")";
                                    var TranJrnyDtlDel = "DELETE FROM <tran_db>.TRANSACTION_JOURNEY_DETAIL WHERE DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND TRN_ID IN (" + strSelectIdQry + ")";
                                    var TranaDataDel = "DELETE FROM <res_cas>.TRNA_DATA WHERE IS_PROCESSED='Y' AND RELATIVE_PATH IN (select relative_path from TRN_ATTACHMENTS where DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND TRN_ID IN (" + strSelectIdQry + "))";
                                    // var strPrctqry = `DELETE FROM <tran_db>.PRC_TOKENS WHERE PRCT_ID IN (SELECT DISTINCT PRCT_ID FROM  <tran_db>.HST_TRAN_DATA WHERE TRAN_ID IN(SELECT KEY_COLUMN_ID  FROM  ARCHIVAL_INDEX_DETAIL WHERE AI_ID = $AI_ID  AND table_name = '${CurrentDtInfo.TARGET_TABLE}') AND DTT_CODE='${CurrentDtInfo.DTT_CODE}' AND PROCESS_COUNT=1 AND LOCK_ID IS NULL) AND PROCESS_COUNT=1 AND LOCK_ID IS NULL`;
                                    var HstTranDel = `DELETE FROM <tran_db>.HST_TRAN_DATA WHERE TRAN_ID IN(${strSelectIdQry}) AND DTT_CODE='${CurrentDtInfo.DTT_CODE}'`;



                                    // tranSetUpdate = tranSetUpdate + strCommon + ")";
                                    var arrQuries = [
                                        {
                                            query: TranJourneyDel,
                                            query_type: 'HST_TS_JOURNEY_QUERY',
                                            mode: 'DELETE',
                                            schema_name: 'tran_db',
                                            sort_order: 8,
                                            query_id: `${CurrentDtInfo.DTT_CODE}_TRANSACTION_JOURNEY_DELETE`,
                                            target_table: 'TRANSACTION_JOURNEY'
                                        }, {
                                            query: TranJrnyDtlDel,
                                            query_type: 'TRANSACTION_JOURNEY_DETAIL',
                                            mode: 'DELETE',
                                            schema_name: 'tran_db',
                                            sort_order: 10,
                                            query_id: `${CurrentDtInfo.DTT_CODE}_TRANSACTION_JOURNEY_DETAIL_DELETE`,
                                            target_table: 'TRANSACTION_JOURNEY_DETAIL'
                                        }, {
                                            query: TranCmtDel,
                                            query_type: 'TRN_COMENTS_QUERY',
                                            mode: 'DELETE',
                                            schema_name: 'tran_db',
                                            sort_order: 6,
                                            query_id: `${CurrentDtInfo.DTT_CODE}_TRANSACTION_COMMENTS_DELETE`,
                                            target_table: 'TRANSACTION_COMMENTS'
                                        }, {
                                            query: TrnSetDel,
                                            query_type: 'TS_QUERY',
                                            mode: 'DELETE',
                                            schema_name: 'tran_db',
                                            sort_order: 14,
                                            query_id: `${CurrentDtInfo.DTT_CODE}_TRANSACTION_SET_DELETE`,
                                            target_table: 'TRANSACTION_SET'
                                        }, {
                                            query: TranAtmtDel,
                                            query_type: 'TRN_ATMT_QUERY',
                                            mode: 'DELETE',
                                            schema_name: 'tran_db',
                                            sort_order: 12,
                                            query_id: `${CurrentDtInfo.DTT_CODE}_TRN_ATTACHMENTS_DELETE`,
                                            target_table: 'TRN_ATTACHMENTS'

                                        }, {
                                            query: HstTranDel,
                                            query_type: 'TRN_QUERY',
                                            mode: 'DELETE',
                                            schema_name: 'tran_db',
                                            sort_order: 2,
                                            query_id: `${CurrentDtInfo.DTT_CODE}_HST_TRAN_DATA_DELETE`,
                                            target_table: 'HST_TRAN_DATA'

                                        }, {
                                            query: TranTblDel,
                                            query_type: 'TRN_QUERY',
                                            mode: 'DELETE',
                                            schema_name: 'tran_db',
                                            sort_order: 16,
                                            query_id: `${CurrentDtInfo.DTT_CODE}_${CurrentDtInfo.TARGET_TABLE}_DELETE`,
                                            target_table: CurrentDtInfo.TARGET_TABLE

                                        }];
                                    if (auditarcMode == "DB") {
                                        arrQuries.push({
                                            query: TranTblInsert,
                                            query_type: 'TRN_QUERY',
                                            mode: 'INSERT',
                                            schema_name: 'arc_tran_db',
                                            sort_order: 15,
                                            query_id: `${CurrentDtInfo.DTT_CODE}_${CurrentDtInfo.TARGET_TABLE}_INSERT`,
                                            target_table: CurrentDtInfo.TARGET_TABLE
                                        }, {
                                            query: TranSetInsert,
                                            query_type: 'TRN_QUERY',
                                            mode: 'INSERT',
                                            schema_name: 'arc_tran_db',
                                            sort_order: 13,
                                            query_id: `${CurrentDtInfo.DTT_CODE}_TRANSACTION_SET_INSERT`,
                                            target_table: 'TRANSACTION_SET'
                                        }, {
                                            query: TranAtmtInsert,
                                            query_type: 'TRN_QUERY',
                                            mode: 'INSERT',
                                            schema_name: 'arc_res_db',
                                            sort_order: 11,
                                            query_id: `${CurrentDtInfo.DTT_CODE}_TRN_ATTACHMENTS_INSERT`,
                                            target_table: 'TRN_ATTACHMENTS'
                                        }, {
                                            query: TranCmtInsert,
                                            query_type: 'TRN_QUERY',
                                            mode: 'INSERT',
                                            schema_name: 'arc_tran_db',
                                            sort_order: 5,
                                            query_id: `${CurrentDtInfo.DTT_CODE}_TRANSACTION_COMMENTS_INSERT`,
                                            target_table: 'TRANSACTION_COMMENTS'
                                        }, {
                                            query: TranJournyInsert,
                                            query_type: 'TRN_QUERY',
                                            mode: 'INSERT',
                                            schema_name: 'arc_tran_db',
                                            sort_order: 7,
                                            query_id: `${CurrentDtInfo.DTT_CODE}_TRANSACTION_JOURNEY_INSERT`,
                                            target_table: 'TRANSACTION_JOURNEY'
                                        }, {
                                            query: TranJrnyDtlInsert,
                                            query_type: 'TRN_QUERY',
                                            mode: 'INSERT',
                                            schema_name: 'arc_tran_db',
                                            sort_order: 9,
                                            query_id: `${CurrentDtInfo.DTT_CODE}_TRANSACTION_JOURNEY_DETAIL_INSERT`,
                                            target_table: 'TRANSACTION_JOURNEY_DETAIL'
                                        }, {
                                            query: TranaDataInsert,
                                            query_type: 'TRN_QUERY',
                                            mode: 'INSERT',
                                            schema_name: 'arc_tran_db',
                                            sort_order: 3,
                                            query_id: `${CurrentDtInfo.DTT_CODE}_TRNA_DATA_INSERT`,
                                            target_table: 'TRNA_DATA'
                                        }, {
                                            query: HstTranInsert,
                                            query_type: 'TRN_QUERY',
                                            mode: 'INSERT',
                                            schema_name: 'arc_tran_db',
                                            sort_order: 1,
                                            query_id: `${CurrentDtInfo.DTT_CODE}_HST_TRAN_DATA_INSERT`,
                                            target_table: 'HST_TRAN_DATA'
                                        }
                                        )
                                    }

                                    if (serviceModel.TYPE == 'LITE') {
                                        arrQuries.unshift({
                                            query: TranaDataDel,
                                            query_type: 'TRNA_DATA_DEL',
                                            mode: 'DELETE',
                                            schema_name: 'res_cas',
                                            sort_order: 4,
                                            query_id: `${CurrentDtInfo.DTT_CODE}_TRNA_DATA_DELETE`,
                                            target_table: 'TRNA_DATA'
                                        });
                                    }

                                    var qryobj = _prepareInsertarr(arrQuries, CurrentDtInfo);

                                    _PrintInfo(objLogInfo, "Going to insert into archival qry info table");
                                    pcallback(qryobj);
                                });
                            }


                            function _prepareInsertarr(arrQuries, CurrentDtInfo) {

                                var arrseletdynamicqry = [];
                                var arrdeletedynamicqry = [];
                                _PrintInfo(objLogInfo, "arrQuries.length " + arrQuries.length);

                                for (var i = 0; i < arrQuries.length; i++) {
                                    _PrintInfo(objLogInfo, "Prepare query for " + arrQuries[i].mode);
                                    var insertobj = {};
                                    insertobj.DT_CODE = DtCode;
                                    insertobj.DTT_CODE = CurrentDtInfo.DTT_CODE;
                                    insertobj.QUERY_TEXT = arrQuries[i].query;
                                    insertobj.QUERY_TYPE = arrQuries[i].query_type;
                                    insertobj.TARGET_TABLE = arrQuries[i].target_table;
                                    // insertobj.SELECT_QUERY = arrQuries[i].sel_query;
                                    // insertobj.UPDATE_QUERY = arrQuries[i].update_qry;
                                    insertobj.BASE_TABLE = CurrentDtInfo.TARGET_TABLE;
                                    insertobj.APP_ID = objLogInfo.APP_ID;
                                    insertobj.TENANT_ID = objLogInfo.TENANT_ID;
                                    insertobj.AS_ID = strAsId;
                                    insertobj.created_by = objLogInfo.USER_ID || 1;
                                    insertobj.created_date = reqDateFormatter.GetTenantCurrentDateTime(pHeaders, objLogInfo);
                                    insertobj.status = 'CREATED';
                                    insertobj.prct_id = prct_id;
                                    insertobj.query_id = arrQuries[i].query_id;
                                    insertobj.table_sort_order = CurrentDtInfo.sort_order;
                                    insertobj.process = arrQuries[i].mode;
                                    if (arrQuries[i].mode == "DELETE" || arrQuries[i].mode == "INSERT" || arrQuries[i].mode == "UPDATE") {
                                        insertobj.schema_name = arrQuries[i].schema_name;
                                        insertobj.sort_order = arrQuries[i].sort_order
                                        arrdeletedynamicqry.push(insertobj);
                                    } else {
                                        insertobj.sort_order = CurrentDtInfo.sort_order;
                                        arrseletdynamicqry.push(insertobj);
                                    }
                                }
                                var qryobj = {};
                                qryobj.selectquery = arrseletdynamicqry;
                                qryobj.deletequery = new reqLINQ(arrdeletedynamicqry)
                                    .OrderBy(function (u) {
                                        return u.sort_order
                                    }).ToArray();

                                return qryobj;
                            }

                            function deleteModeNoneqry(CurrentDtInfo, pcallback) {
                                try {
                                    _GetConditionParam(params.setupJson, function (cond) {
                                        _PrintInfo(objLogInfo, "Prepare DELEE WHEN NONE table query");
                                        var strInsertqry = "INSERT INTO ARCHIVAL_INDEX_DETAIL (AI_ID,TABLE_NAME,KEY_COLUMN_ID,KEY_COLUMN_NAME) SELECT  $AI_ID AS AI_ID , '" + CurrentDtInfo.TARGET_TABLE + "' as TARGET_TABLE ," + CurrentDtInfo.PRIMARY_COLUMN + " as key_column_id ,'" + CurrentDtInfo.PRIMARY_COLUMN + "' as key_column_name  FROM " + CurrentDtInfo.TARGET_TABLE + " TRN1 WHERE(TRN1.AI_ID IS NULL) AND ";

                                        //@tranSetUpdate, update transaction_set table archival index id, to prevent same tranction insert archival index details table 
                                        var selectQry = `SELECT ${CurrentDtInfo.PRIMARY_COLUMN} FROM ${CurrentDtInfo.TARGET_TABLE} TRN1  WHERE `
                                        selectQry = selectQry + cond;
                                        // var tranSetUpdate = "UPDATE " + CurrentDtInfo.TARGET_TABLE + " SET AI_ID= $AI_ID , PRCT_ID = $PRCT_ID WHERE " + CurrentDtInfo.PRIMARY_COLUMN + " IN(SELECT KEY_COLUMN_ID  FROM  ARCHIVAL_INDEX_DETAIL WHERE AI_ID = $AI_ID  AND TABLE_NAME = '" + CurrentDtInfo.TARGET_TABLE + "')";





                                        var HstTranInsert = `INSERT INTO <arc_tran_db>.HST_TRAN_DATA ( SELECT * FROM <tran_db>.HST_TRAN_DATA WHERE DTT_CODE='${CurrentDtInfo.DTT_CODE}' AND TRAN_ID IN ( ${selectQry})) `;
                                        var HstTranUpdate = `UPDATE <tran_db>.HST_TRAN_DATA SET AI_ID = '$AI_ID' WHERE DTT_CODE='${CurrentDtInfo.DTT_CODE}' AND TRAN_ID IN ( ${selectQry}) `;
                                        // var HstTranSel = `SELECT * FROM <tran_db>.HST_TRAN_DATA WHERE DTT_CODE='${CurrentDtInfo.DTT_CODE}' AND TRAN_ID IN ( ${selectQry}) `;
                                        var HstTranSel = `SELECT * FROM <tran_db>.HST_TRAN_DATA WHERE DTT_CODE='${CurrentDtInfo.DTT_CODE}' AND AI_ID = '$AI_ID'`;
                                        // var HstTranDel = `DELETE FROM <tran_db>.HST_TRAN_DATA WHERE DTT_CODE='${CurrentDtInfo.DTT_CODE}' AND TRAN_ID IN(${selectQry})`;
                                        var HstTranDel = `DELETE FROM <tran_db>.HST_TRAN_DATA WHERE DTT_CODE='${CurrentDtInfo.DTT_CODE}' AND AI_ID = '$AI_ID'`;

                                        var TranDataInsert = `INSERT INTO <arc_res_db>.TRNA_DATA ( SELECT * FROM <res_cas>.TRNA_DATA WHERE RELATIVE_PATH IN (select relative_path from TRN_ATTACHMENTS WHERE DTT_CODE ='${CurrentDtInfo.DTT_CODE}' AND TRN_ID IN (${selectQry})))`;
                                        var TranDataUpdate = `UPDATE <res_cas>.TRNA_DATA SET AI_ID = '$AI_ID' WHERE RELATIVE_PATH IN (select relative_path from TRN_ATTACHMENTS WHERE DTT_CODE ='${CurrentDtInfo.DTT_CODE}' AND TRN_ID IN (${selectQry}))`;
                                        // var TranDataSel = `SELECT * FROM <res_cas>.TRNA_DATA WHERE RELATIVE_PATH IN (select relative_path from TRN_ATTACHMENTS WHERE DTT_CODE ='${CurrentDtInfo.DTT_CODE}' AND TRN_ID IN (${selectQry}))`;
                                        var TranDataSel = `SELECT * FROM <res_cas>.TRNA_DATA WHERE AI_ID = '$AI_ID'`;
                                        // var TrnaDataDel = "DELETE FROM <res_cas>.TRNA_DATA WHERE RELATIVE_PATH IN (select relative_path from TRN_ATTACHMENTS WHERE DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND TRN_ID IN (" + selectQry + "))";
                                        var TrnaDataDel = "DELETE FROM <res_cas>.TRNA_DATA WHERE AI_ID = '$AI_ID'";

                                        var TransCMTInsert = "INSERT INTO <arc_tran_db>.TRANSACTION_COMMENTS ( SELECT * FROM <tran_db>.TRANSACTION_COMMENTS WHERE DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND  TS_ID  IN ( SELECT TS_ID FROM TRANSACTION_SET WHERE DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND TRN_ID IN ( " + selectQry + ")))";
                                        var TransCMTUpdate = "UPDATE <tran_db>.TRANSACTION_COMMENTS SET AI_ID = '$AI_ID' WHERE  DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND  TS_ID  IN ( SELECT TS_ID FROM TRANSACTION_SET WHERE DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND TRN_ID IN ( " + selectQry + "))";
                                        // var TransCMTSel = "SELECT * FROM <tran_db>.TRANSACTION_COMMENTS WHERE DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND  TS_ID  IN ( SELECT TS_ID FROM TRANSACTION_SET WHERE DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND TRN_ID IN ( " + selectQry + "))";
                                        var TransCMTSel = "SELECT * FROM <tran_db>.TRANSACTION_COMMENTS WHERE DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND  AI_ID = '$AI_ID'";
                                        // var TransCMTDel = "DELETE FROM <tran_db>.TRANSACTION_COMMENTS WHERE DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND  TS_ID  IN ( SELECT TS_ID FROM TRANSACTION_SET WHERE DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND TRN_ID IN (" + selectQry + "))";
                                        var TransCMTDel = "DELETE FROM <tran_db>.TRANSACTION_COMMENTS WHERE DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND AI_ID = '$AI_ID'";



                                        var TranJrnyInsert = "INSERT INTO <arc_tran_db>.TRANSACTION_JOURNEY ( SELECT * FROM <tran_db>.TRANSACTION_JOURNEY WHERE DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND TRN_ID IN ( " + selectQry + ")";
                                        var TranJrnyUpdate = "UPDATE <tran_db>.TRANSACTION_JOURNEY SET AI_ID = '$AI_ID' WHERE DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND TRN_ID IN ( " + selectQry + ")";
                                        // var TranJrnySel = "SELECT * FROM <tran_db>.TRANSACTION_JOURNEY WHERE DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND TRN_ID IN ( " + selectQry + ")";
                                        var TranJrnySel = "SELECT * FROM <tran_db>.TRANSACTION_JOURNEY WHERE DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND  AI_ID = '$AI_ID'";
                                        // var TranjrnyDel = "DELETE FROM <tran_db>.TRANSACTION_JOURNEY WHERE DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND TRN_ID  IN (" + selectQry + ")";
                                        var TranjrnyDel = "DELETE FROM <tran_db>.TRANSACTION_JOURNEY WHERE DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND AI_ID = '$AI_ID'";

                                        var TranJrnyDtlInsert = "INSERT INTO <arc_tran_db>.TRANSACTION_JOURNEY_DETAIL ( SELECT * FROM <tran_db>.TRANSACTION_JOURNEY_DETAIL WHERE DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND TRN_ID IN (" + selectQry + "))";
                                        var TranJrnyDtlUpdate = "UPDATE <tran_db>.TRANSACTION_JOURNEY_DETAIL SET AI_ID = '$AI_ID'  WHERE DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND TRN_ID IN (" + selectQry + ")";
                                        // var TranJrnyDtlSel = "SELECT * FROM <tran_db>.TRANSACTION_JOURNEY_DETAIL WHERE DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND TRN_ID IN (" + selectQry + ")";
                                        var TranJrnyDtlSel = "SELECT * FROM <tran_db>.TRANSACTION_JOURNEY_DETAIL WHERE DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND AI_ID = '$AI_ID'";
                                        // var TranJrnyDtlDel = "DELETE FROM <tran_db>.TRANSACTION_JOURNEY_DETAIL WHERE DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND TRN_ID IN (" + selectQry + ")";
                                        var TranJrnyDtlDel = "DELETE FROM <tran_db>.TRANSACTION_JOURNEY_DETAIL WHERE DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND AI_ID = '$AI_ID'";

                                        var TranAtmtInsert = "INSERT INTO <arc_tran_db>.TRN_ATTACHMENTS ( SELECT * FROM <tran_db>.TRN_ATTACHMENTS WHERE IS_PROCESSED='Y' AND DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND TRN_ID IN ( " + selectQry + "))";
                                        var TranAtmtUpdate = "UPDATE <tran_db>.TRN_ATTACHMENTS SET AI_ID = '$AI_ID' WHERE DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND TRN_ID IN ( " + selectQry + ")";
                                        // var TranAtmtSel = "SELECT * FROM <tran_db>.TRN_ATTACHMENTS WHERE IS_PROCESSED='Y' AND DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND TRN_ID IN ( " + selectQry + ")";
                                        var TranAtmtSel = "SELECT * FROM <tran_db>.TRN_ATTACHMENTS WHERE DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND AI_ID = '$AI_ID'";
                                        // var TranATMTDel = "DELETE FROM <tran_db>.TRN_ATTACHMENTS WHERE IS_PROCESSED='Y' AND DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND TRN_ID IN (" + selectQry + ")";
                                        var TranATMTDel = "DELETE FROM <tran_db>.TRN_ATTACHMENTS WHERE DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND AI_ID = '$AI_ID'";

                                        var TransetInsert = "INSERT INTO <arc_tran_db>.TRANSACTION_SET  ( SELECT * FROM <tran_db>.TRANSACTION_SET WHERE DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND TRN_ID IN ( " + selectQry + "))";
                                        var TransetUpdate = "UPDATE <tran_db>.TRANSACTION_SET SET AI_ID = '$AI_ID' WHERE DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND TRN_ID IN ( " + selectQry + ")";
                                        // var TransetSel = " SELECT * FROM <tran_db>.TRANSACTION_SET WHERE DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND TRN_ID IN ( " + selectQry + ")";
                                        var TransetSel = " SELECT * FROM <tran_db>.TRANSACTION_SET WHERE DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND AI_ID = '$AI_ID' ";
                                        var TranmsetDel = "DELETE FROM <tran_db>.TRANSACTION_SET WHERE DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND AI_ID = '$AI_ID'";

                                        var TranTblInsert = `INSERT INTO <arc_tran_db>.${CurrentDtInfo.TARGET_TABLE} ( SELECT * FROM <tran_db>.${CurrentDtInfo.TARGET_TABLE} WHERE ${CurrentDtInfo.PRIMARY_COLUMN} IN (${selectQry}))`;
                                        var TranTblUpdate = `UPDATE <tran_db>.${CurrentDtInfo.TARGET_TABLE} SET AI_ID = '$AI_ID'  WHERE ${CurrentDtInfo.PRIMARY_COLUMN} IN (${selectQry})`;
                                        // var TranTblSel = `SELECT * FROM <tran_db>.${CurrentDtInfo.TARGET_TABLE} WHERE ${CurrentDtInfo.PRIMARY_COLUMN} IN (${selectQry}) `
                                        var TranTblSel = `SELECT * FROM <tran_db>.${CurrentDtInfo.TARGET_TABLE} WHERE AI_ID = '$AI_ID' `
                                        // var TrantblDel = "DELETE FROM <tran_db>." + CurrentDtInfo.TARGET_TABLE + "  WHERE " + CurrentDtInfo.PRIMARY_COLUMN + " IN (" + selectQry + ")";
                                        var TrantblDel = "DELETE FROM <tran_db>." + CurrentDtInfo.TARGET_TABLE + "  WHERE AI_ID = '$AI_ID'";


                                        if (auditarcMode == "SOLR") {
                                            HstTranDel = HstTranDel + ` AND PROCESS_COUNT=1 AND LOCK_ID IS NULL`;
                                        }

                                        _PrintInfo(objLogInfo, "Got the where condition");
                                        strInsertqry = strInsertqry + cond;


                                        // strStaticQry = strStaticQry + cond;
                                        var arrQuries = [{
                                            query: HstTranUpdate,
                                            query_type: 'ARCHIVAL',
                                            mode: 'UPDATE',
                                            schema_name: 'arc_res_db',
                                            sort_order: 1,
                                            table_sort_order: CurrentDtInfo.sort_order,
                                            query_id: `${CurrentDtInfo.DTT_CODE}_HST_TRAN_DATA_INSERT`,
                                            target_table: 'HST_TRAN_DATA'
                                        },
                                        {
                                            query: HstTranSel,
                                            query_type: 'ARCHIVAL',
                                            mode: 'INSERT',
                                            schema_name: 'arc_res_db',
                                            sort_order: 2,
                                            table_sort_order: CurrentDtInfo.sort_order,
                                            query_id: `${CurrentDtInfo.DTT_CODE}_HST_TRAN_DATA_INSERT`,
                                            target_table: 'HST_TRAN_DATA'
                                        }, {
                                            query: HstTranDel,
                                            query_type: 'HST_TRAN_DATA_DEL',
                                            mode: 'DELETE',
                                            schema_name: 'tran_db',
                                            sort_order: 3,
                                            table_sort_order: CurrentDtInfo.sort_order,
                                            query_id: `${CurrentDtInfo.DTT_CODE}_HST_TRAN_DATA_DELETE`,
                                            target_table: 'HST_TRAN_DATA'
                                        }, {
                                            query: TranjrnyDel,
                                            query_type: 'HST_TS_JOURNEY_QUERY',
                                            mode: 'DELETE',
                                            schema_name: 'tran_db',
                                            sort_order: 12,
                                            table_sort_order: CurrentDtInfo.sort_order,
                                            query_id: `${CurrentDtInfo.DTT_CODE}_HST_TS_JOURNEY_QUERY_DELETE`,
                                            target_table: 'TRANSACTION_JOURNEY'
                                        },
                                        {
                                            query: TranJrnyDtlDel,
                                            query_type: 'TRANSACTION_JOURNEY_DETAIL',
                                            mode: 'DELETE',
                                            schema_name: 'tran_db',
                                            sort_order: 15,
                                            table_sort_order: CurrentDtInfo.sort_order,
                                            query_id: `${CurrentDtInfo.DTT_CODE}_TRANSACTION_JOURNEY_DETAIL_DELETE`,
                                            target_table: 'TRANSACTION_JOURNEY_DETAIL'
                                        }, {
                                            query: TransCMTSel,
                                            query_type: 'TRN_COMENTS_QUERY',
                                            mode: 'INSERT',
                                            schema_name: 'tran_db',
                                            sort_order: 8,
                                            table_sort_order: CurrentDtInfo.sort_order,
                                            query_id: `${CurrentDtInfo.DTT_CODE}_TRN_COMENTS_QUERY_DELETE`,
                                            target_table: 'TRANSACTION_COMMENTS'
                                        }, {
                                            query: TransCMTDel,
                                            query_type: 'TRN_COMENTS_QUERY',
                                            mode: 'DELETE',
                                            schema_name: 'tran_db',
                                            sort_order: 9,
                                            table_sort_order: CurrentDtInfo.sort_order,
                                            query_id: `${CurrentDtInfo.DTT_CODE}_TRN_COMENTS_QUERY_DELETE`,
                                            target_table: 'TRANSACTION_COMMENTS'
                                        },
                                        {
                                            query: TranmsetDel,
                                            query_type: 'TS_QUERY',
                                            mode: 'DELETE',
                                            schema_name: 'tran_db',
                                            sort_order: 21,
                                            table_sort_order: CurrentDtInfo.sort_order,
                                            query_id: `${CurrentDtInfo.DTT_CODE}_TRANSACTION_SET_DELETE`,
                                            target_table: 'TRANSACTION_SET'
                                        }, {
                                            query: TranATMTDel,
                                            query_type: 'TRN_ATMT_QUERY',
                                            mode: 'DELETE',
                                            schema_name: 'tran_db',
                                            sort_order: 18,
                                            table_sort_order: CurrentDtInfo.sort_order,
                                            query_id: `${CurrentDtInfo.DTT_CODE}_TRN_ATTACHMENTS_DELETE`,
                                            target_table: 'TRN_ATTACHMENTS'
                                        },
                                        {
                                            query: TrantblDel,
                                            query_type: 'TRN_QUERY',
                                            mode: 'DELETE',
                                            schema_name: 'tran_db',
                                            sort_order: 24,
                                            table_sort_order: CurrentDtInfo.sort_order,
                                            query_id: `${CurrentDtInfo.DTT_CODE}_${CurrentDtInfo.TARGET_TABLE}_DELETE`,
                                            target_table: CurrentDtInfo.TARGET_TABLE
                                        }
                                        ];
                                        if (auditarcMode == "DB") {
                                            arrQuries.push({
                                                query: TranTblUpdate,
                                                query_type: 'ARCHIVAL',
                                                mode: 'UPDATE',
                                                schema_name: 'arc_tran_db',
                                                sort_order: 22
                                                , table_sort_order: CurrentDtInfo.sort_order,
                                                query_id: `${CurrentDtInfo.DTT_CODE}_${CurrentDtInfo.TARGET_TABLE}_INSERT`,
                                                target_table: CurrentDtInfo.TARGET_TABLE
                                            }, {
                                                query: TranTblSel,
                                                query_type: 'ARCHIVAL',
                                                mode: 'INSERT',
                                                schema_name: 'arc_tran_db',
                                                sort_order: 23
                                                , table_sort_order: CurrentDtInfo.sort_order,
                                                query_id: `${CurrentDtInfo.DTT_CODE}_${CurrentDtInfo.TARGET_TABLE}_INSERT`,
                                                target_table: CurrentDtInfo.TARGET_TABLE
                                            }, {
                                                query: TransCMTUpdate,
                                                query_type: 'ARCHIVAL',
                                                mode: 'UPDATE',
                                                schema_name: 'arc_tran_db',
                                                sort_order: 7,
                                                table_sort_order: CurrentDtInfo.sort_order,
                                                query_id: `${CurrentDtInfo.DTT_CODE}_TRANSACTION_COMMENTS_INSERT`,
                                                target_table: 'TRANSACTION_COMMENTS'
                                            }, {
                                                query: TransetUpdate,
                                                query_type: 'ARCHIVAL',
                                                mode: 'UPDATE',
                                                schema_name: 'arc_tran_db',
                                                sort_order: 19,
                                                table_sort_order: CurrentDtInfo.sort_order,
                                                query_id: `${CurrentDtInfo.DTT_CODE}_TRANSACTION_SET_INSERT`,
                                                target_table: 'TRANSACTION_SET'
                                            }, {
                                                query: TransetSel,
                                                query_type: 'ARCHIVAL',
                                                mode: 'INSERT',
                                                schema_name: 'arc_tran_db',
                                                sort_order: 20,
                                                table_sort_order: CurrentDtInfo.sort_order,
                                                query_id: `${CurrentDtInfo.DTT_CODE}_TRANSACTION_SET_INSERT`,
                                                target_table: 'TRANSACTION_SET'
                                            }, {
                                                query: TranJrnyDtlUpdate,
                                                query_type: 'ARCHIVAL',
                                                mode: 'UPDATE',
                                                schema_name: 'arc_tran_db',
                                                sort_order: 13,
                                                table_sort_order: CurrentDtInfo.sort_order,
                                                query_id: `${CurrentDtInfo.DTT_CODE}_TRANSACTION_JOURNEY_DETAIL_INSERT`,
                                                target_table: 'TRANSACTION_JOURNEY_DETAIL'
                                            }, {
                                                query: TranJrnyDtlSel,
                                                query_type: 'ARCHIVAL',
                                                mode: 'INSERT',
                                                schema_name: 'arc_tran_db',
                                                sort_order: 14,
                                                table_sort_order: CurrentDtInfo.sort_order,
                                                query_id: `${CurrentDtInfo.DTT_CODE}_TRANSACTION_JOURNEY_DETAIL_INSERT`,
                                                target_table: 'TRANSACTION_JOURNEY_DETAIL'
                                            }, {
                                                query: TranJrnyUpdate,
                                                query_type: 'ARCHIVAL',
                                                mode: 'UPDATE',
                                                schema_name: 'arc_tran_db',
                                                sort_order: 10,
                                                table_sort_order: CurrentDtInfo.sort_order,
                                                query_id: `${CurrentDtInfo.DTT_CODE}_TRANSACTION_JOURNEY_INSERT`,
                                                target_table: 'TRANSACTION_JOURNEY'
                                            }, {
                                                query: TranJrnySel,
                                                query_type: 'ARCHIVAL',
                                                mode: 'UPDATE',
                                                schema_name: 'arc_tran_db',
                                                sort_order: 11,
                                                table_sort_order: CurrentDtInfo.sort_order,
                                                query_id: `${CurrentDtInfo.DTT_CODE}_TRANSACTION_JOURNEY_INSERT`,
                                                target_table: 'TRANSACTION_JOURNEY'
                                            }, {
                                                query: TranAtmtUpdate,
                                                query_type: 'ARCHIVAL',
                                                mode: 'UPDATE',
                                                schema_name: 'arc_tran_db',
                                                sort_order: 16,
                                                table_sort_order: CurrentDtInfo.sort_order,
                                                query_id: `${CurrentDtInfo.DTT_CODE}_TRN_ATTACHMENTS_INSERT`,
                                                target_table: 'TRN_ATTACHMENTS'
                                            }, {
                                                query: TranAtmtSel,
                                                query_type: 'ARCHIVAL',
                                                mode: 'INSERT',
                                                schema_name: 'arc_tran_db',
                                                sort_order: 17,
                                                table_sort_order: CurrentDtInfo.sort_order,
                                                query_id: `${CurrentDtInfo.DTT_CODE}_TRN_ATTACHMENTS_INSERT`,
                                                target_table: 'TRN_ATTACHMENTS'
                                            }, {
                                                query: TranDataUpdate,
                                                query_type: 'ARCHIVAL',
                                                mode: 'UPDATE',
                                                schema_name: 'arc_res_db',
                                                sort_order: 4,
                                                table_sort_order: CurrentDtInfo.sort_order,
                                                query_id: `${CurrentDtInfo.DTT_CODE}_TRNA_DATA_INSERT`,
                                                target_table: 'TRNA_DATA'
                                            }, {
                                                query: TranDataSel,
                                                query_type: 'ARCHIVAL',
                                                mode: 'INSERT',
                                                schema_name: 'arc_res_db',
                                                sort_order: 5,
                                                table_sort_order: CurrentDtInfo.sort_order,
                                                query_id: `${CurrentDtInfo.DTT_CODE}_TRNA_DATA_INSERT`,
                                                target_table: 'TRNA_DATA'
                                            }, {
                                                query: TrnaDataDel,
                                                query_type: 'ARCHIVAL',
                                                mode: 'DELETE',
                                                schema_name: 'arc_res_db',
                                                sort_order: 6,
                                                table_sort_order: CurrentDtInfo.sort_order,
                                                query_id: `${CurrentDtInfo.DTT_CODE}_TRNA_DATA_INSERT`,
                                                target_table: 'TRNA_DATA'
                                            }
                                            )
                                        }
                                        // if (serviceModel.TYPE == 'LITE') {
                                        //     arrQuries.unshift({
                                        //         query: TranDataSel,
                                        //         query_type: 'TRNA_DATA_DEL',
                                        //         mode: 'DELETE',
                                        //         schema_name: 'res_cas',
                                        //         sort_order: 4,
                                        //         table_sort_order: CurrentDtInfo.sort_order,
                                        //         query_id: `${CurrentDtInfo.DTT_CODE}_TRNA_DATA_DELETE`,
                                        //         target_table: 'TRNA_DATA'
                                        //     });
                                        // }

                                        var allqry = _prepareInsertarr(arrQuries, CurrentDtInfo);
                                        pcallback(allqry);
                                    });
                                } catch (error) {
                                    pcallback(error);
                                }
                            }

                            function Fxtablequery() {
                                return new Promise((resolve, reject) => {
                                    try {
                                        var COndobj = {};
                                        COndobj.fx_group = params.Group;
                                        reqDBInstance.GetTableFromFXDBNoCache(pClient, 'ARC_FX_TABLES', [], COndobj, objLogInfo, async function (perr, PRes) {
                                            if (perr) {
                                                resolve(perr);
                                            } else {
                                                if (PRes.rows.length) {
                                                    var objqry = await _preparequery(PRes.rows);
                                                    resolve(objqry);
                                                } else {
                                                    _PrintInfo(objLogInfo, ' FX TABLE ENTRY NOT FOUND');
                                                    var res = {};
                                                    res.errMessage = "FX TABLE ENTRY NOT FOUND";
                                                    res.errCode = "ERR-ARCH-46016";
                                                    res.errobj = "FX table entry not found";
                                                    reject(res);
                                                }
                                            }
                                        });
                                    } catch (error) {
                                        var res = {};
                                        res.errMessage = "Exception occured Fxtablequery function";
                                        res.errCode = "ERR-ARCH-46009";
                                        res.errobj = error;
                                        sendFailureRespone(res);
                                    }
                                });
                            }

                            function _preparequery(pRows) {
                                return new Promise((resolve, reject) => {
                                    try {
                                        _PrintInfo(objLogInfo, "Prepare query FXtable");
                                        var gropdata = pRows;
                                        var totalLength = gropdata.length;
                                        var arrtable = [];
                                        var qrysortorder = 0
                                        prepareParentChild();

                                        function prepareParentChild() {
                                            for (var i = 0; i < totalLength; i++) {
                                                var obj = {};
                                                obj["table_name"] = gropdata[i].table_name;
                                                obj["key_column_name"] = gropdata[i].key_column_name;
                                                obj["parent_table_name"] = gropdata[i].parent_table_name;
                                                obj["foreign_key_column"] = gropdata[i].foreign_key_column;
                                                obj["Keyspaces"] = gropdata[i].keyspaces;
                                                var childObj = gropdata.filter((objRow) => {
                                                    return objRow.foreign_key_column == gropdata[i].key_column_name;
                                                });
                                                if (childObj.length) {
                                                    obj["child_table_name"] = childObj[0].table_name;
                                                    obj["child_key_column_name"] = childObj[0].key_column_name;
                                                }
                                                arrtable.push(obj);
                                            }
                                        }

                                        var ParentTable = arrtable.filter((parentObj) => {
                                            return parentObj.parent_table_name == null || parentObj.parent_table_name == '';
                                        });
                                        var parentIndex = 0;
                                        if (ParentTable.length > 0) {
                                            parentIndex = arrtable.indexOf(ParentTable[0]);
                                        }

                                        arrtable = parentChildRelationship(arrtable, parentIndex, 0);

                                        function parentChildRelationship(arr, from, to) {
                                            var shiftposition = arr.splice(from, 1)[0];
                                            arr.splice(to, 0, shiftposition);
                                            return arr;
                                        }


                                        var parentqrywithCOnd = `SELECT ${arrtable[0].key_column_name} FROM ${arrtable[0].table_name}`;
                                        _GetConditionParam(params.setupJson, function (strCond) {
                                            try {
                                                if (strCond) {
                                                    parentqrywithCOnd = ` ${parentqrywithCOnd} where ${strCond}`
                                                }
                                                var arrDeleteQuery = [];
                                                var rootTable = arrtable[0].table_name;
                                                for (var i = arrtable.length - 1; i >= 0; i--) {
                                                    var selqry = `select ${arrtable[i].key_column_name} from ${arrtable[i].table_name}`
                                                    var joinadded = false;
                                                    var aliasName = ''
                                                    if (arrtable[i].table_name != rootTable) {
                                                        for (var j = i; j >= 0; j--) {
                                                            if (selqry.indexOf(arrtable[j].parent_table_name) > -1 && selqry.indexOf(`inner join ${arrtable[j].parent_table_name}`) > -1 && !arrtable[j].foreign_key_column && !arrtable[j].parent_table_name) {
                                                                continue
                                                            }
                                                            if (!joinadded) {
                                                                selqry = `${selqry} trn${j + 2}`
                                                            }
                                                            if (arrtable[j].table_name != rootTable) {
                                                                if (arrtable[j].parent_table_name == rootTable) {
                                                                    aliasName = "TRN1"
                                                                } else {
                                                                    aliasName = `trn${j + 1}`
                                                                }
                                                                selqry += ` inner join ${arrtable[j].parent_table_name} ${aliasName} on trn${j + 2}.${arrtable[j].foreign_key_column} = ${aliasName}.${arrtable[j].foreign_key_column} `
                                                            } else {
                                                                if (arrtable[j].table_name == rootTable) {
                                                                    aliasName = "TRN1"
                                                                } else {
                                                                    aliasName = `trn${j + 1}`
                                                                }

                                                                selqry += ` inner join ${arrtable[j].table_name} ${aliasName} on trn${j + 2}.${arrtable[j].key_column_name} = ${aliasName}.${arrtable[j].key_column_name} `
                                                            }
                                                            joinadded = true;

                                                            if (rootTable == arrtable[j].parent_table_name) {
                                                                break;
                                                            }
                                                        }
                                                    } else {
                                                        // add alias name only if it is root table
                                                        selqry += ` TRN1 `
                                                    }
                                                    var arrQry = [];

                                                    var UpdateQry = {
                                                        // qry: `INSERT INTO <arc_tran_db>.${arrtable[i].table_name} select * from <tran_db>.${arrtable[i].table_name} where ${arrtable[i].key_column_name} in (${selqry} where ${strCond})`,
                                                        qry: `UPDATE <tran_db>.${arrtable[i].table_name} SET AI_ID='$AI_ID' WHERE  ${arrtable[i].key_column_name} IN (${selqry} where ${strCond})`,
                                                        table_name: arrtable[i].table_name,
                                                        mode: 'UPDTAE',
                                                        Keyspaces: arrtable[i].Keyspaces,
                                                        table_sort_order: i + 1,
                                                        sort_order: 1
                                                        // sel_query: `SELECT * FROM <tran_db>.${arrtable[i].table_name} where ${arrtable[i].key_column_name} in (${selqry} where ${strCond})`
                                                    }
                                                    var InsertQry = {
                                                        // qry: `INSERT INTO <arc_tran_db>.${arrtable[i].table_name} select * from <tran_db>.${arrtable[i].table_name} where ${arrtable[i].key_column_name} in (${selqry} where ${strCond})`,
                                                        qry: `SELECT * FROM <tran_db>.${arrtable[i].table_name} WHERE AI_ID = $AI_ID`,
                                                        table_name: arrtable[i].table_name,
                                                        mode: 'INSERT',
                                                        Keyspaces: arrtable[i].Keyspaces,
                                                        table_sort_order: i + 1,
                                                        sort_order: 2
                                                        // sel_query: `SELECT * FROM <tran_db>.${arrtable[i].table_name} where ${arrtable[i].key_column_name} in (${selqry} where ${strCond})`
                                                    };

                                                    var Delqry = {
                                                        // qry: `DELETE FROM <tran_db>.${arrtable[i].table_name} where ${arrtable[i].key_column_name} in (${selqry} where ${strCond})`,
                                                        qry: `DELETE FROM <tran_db>.${arrtable[i].table_name} WHERE AI_ID =$AI_ID `,
                                                        table_name: arrtable[i].table_name,
                                                        mode: 'DELETE',
                                                        Keyspaces: arrtable[i].Keyspaces,
                                                        table_sort_order: i + 1,
                                                        sort_order: 3
                                                        // sel_query: `SELECT * FROM <tran_db>.${arrtable[i].table_name} where ${arrtable[i].key_column_name} in (${selqry} where ${strCond})`
                                                    }
                                                    arrQry.push(UpdateQry);
                                                    arrQry.push(InsertQry);
                                                    arrQry.push(Delqry)

                                                    for (var k = 0; k < arrQry.length; k++) {
                                                        var objinsert = {
                                                            DT_CODE: "FX_TABLE",
                                                            DTT_CODE: "FX_TABLE",
                                                            QUERY_TYPE: "FX_TABLE",
                                                            QUERY_TEXT: arrQry[k].qry,
                                                            TARGET_TABLE: arrQry[k].table_name,
                                                            BASE_TABLE: arrQry[k].table_name,
                                                            SELECT_QUERY: arrQry[k].sel_query,
                                                            APP_ID: objLogInfo.APP_ID,
                                                            TENANT_ID: objLogInfo.TENANT_ID,
                                                            AS_ID: strAsId,
                                                            created_by: objLogInfo.USER_ID || 1,
                                                            schema_name: arrQry[k].Keyspaces,
                                                            created_date: reqDateFormatter.GetTenantCurrentDateTime(pHeaders, objLogInfo),
                                                            status: 'CREATED',
                                                            prct_id: prct_id,
                                                            query_id: `FX_TABLE_${arrQry[k].table_name}_${arrQry[k].mode}`,
                                                            table_sort_order: arrQry[k].table_sort_order,
                                                            sort_order: arrQry[k].sort_order,
                                                            process: arrQry[k].mode
                                                        }
                                                        arrDeleteQuery.push(objinsert);
                                                    }
                                                    strCond = strCond.replaceAll(`${aliasName}.`, 'TRN1.')
                                                }
                                                var allqry = {};
                                                allqry.deletequery = arrDeleteQuery;
                                                allqry.selectquery = [];
                                                return resolve(allqry);
                                            } catch (error) {
                                                console.log(error)
                                                var res = {};
                                                res.errMessage = "Exception occured _GetConditionParam callback function";
                                                res.errCode = "ERR-ARCH-46110";
                                                res.errobj = error;
                                                sendFailureRespone(res);
                                            }

                                        })
                                    } catch (error) {
                                        var res = {};
                                        res.errMessage = "Exception occured _preparequery function";
                                        res.errCode = "ERR-ARCH-46010";
                                        res.errobj = error;
                                        sendFailureRespone(res);
                                    }
                                })

                            }


                            function _whenNoparent(CurrentDtInfo, DTR, pcallback) {

                                var cond = {};
                                cond.app_id = objLogInfo.APP_ID;
                                cond.dt_code = DtCode;
                                var flatenarr = [];
                                flattenArray(DTR);

                                function flattenArray(Arr) {
                                    try {
                                        for (var b = 0; b < Arr.length; b++) {
                                            var curDtt = Arr[b].DTT_CODE;
                                            var currTable = Arr[b].TARGET_TABLE;
                                            var currKeyColumn = Arr[b].TARGET_TABLE;
                                            if (Arr[b].CHILD_DTT_RELEATIONS.length > 0) {
                                                for (var child = 0; child < Arr[b].CHILD_DTT_RELEATIONS.length; child++) {
                                                    if (Arr[b].CHILD_DTT_RELEATIONS[child]) {
                                                        Arr[b].CHILD_DTT_RELEATIONS[child]["PARENT_DTT"] = curDtt;
                                                        Arr[b].CHILD_DTT_RELEATIONS[child]["PARENT_TABLE"] = currTable;
                                                        Arr[b].CHILD_DTT_RELEATIONS[child]["PARENT_KEY_COLUMN"] = currKeyColumn;
                                                    }
                                                }
                                                flattenArray(Arr[b].CHILD_DTT_RELEATIONS);
                                            } else {
                                                var obj = {
                                                    "TARGET_TABLE": Arr[b].TARGET_TABLE,
                                                    "PRIMARY_COLUMN": Arr[b].PRIMARY_COLUMN,
                                                    "DTT_CODE": Arr[b].DTT_CODE,
                                                    "FOREIGN_COLUMN": Arr[b].FOREIGN_COLUMN,
                                                    "CATEGORY": Arr[b].CATEGORY,
                                                    "DTT_DESCRIPTION": Arr[b].DTT_DESCRIPTION,
                                                    "PARENT_DTT": Arr[b].PARENT_DTT,
                                                    "PARENT_TABLE": Arr[b].PARENT_TABLE
                                                };
                                                // flatenarr.unshift(obj);
                                                flatenarr.push(obj);
                                                Arr.splice(b, 1);
                                                flattenArray(DTR);
                                            }
                                        }

                                    } catch (error) {
                                        var res = {};
                                        res.errMessage = "Exception occured flattenArray function";
                                        res.errCode = "ERR-ARCH-45046";
                                        res.errobj = error;
                                        sendFailureRespone(res);
                                    }

                                }

                                //  TO Find all parent
                                findallParent(flatenarr, CurrentDtInfo.DTT_CODE);

                                function findallParent(flatenarr, dttCode) {
                                    try {
                                        var allParent = [];
                                        findandprepareparent(flatenarr, dttCode);

                                        function findandprepareparent(flatenarr, dttCode) {
                                            for (var k = 0; k < flatenarr.length; k++) {
                                                if (flatenarr[k].DTT_CODE == dttCode) {
                                                    if (flatenarr[k].TARGET_TABLE != TargetTable) {
                                                        console.log(TargetTable);
                                                        allParent.unshift(flatenarr[k]);
                                                    }
                                                    findandprepareparent(flatenarr, flatenarr[k].PARENT_DTT);
                                                }
                                            }
                                        }
                                        console.log(allParent);

                                        Prepareparentqry(allParent);
                                    } catch (error) {
                                        var res = {};
                                        res.errMessage = "Exception occured findallParent function";
                                        res.errCode = "ERR-ARCH-45046";
                                        res.errobj = error;
                                        sendFailureRespone(res);
                                    }
                                }


                                function Prepareparentqry(arrdata, ischildLoop) {
                                    try {
                                        var counter = 0;
                                        var totalParent = '';
                                        if (ischildLoop == undefined) {
                                            totalParent = arrdata;
                                        }
                                        let parentTable;
                                        if (ischildLoop == undefined) {
                                            parentTable = arrdata.filter((crnttable) => {
                                                return crnttable.TARGET_TABLE == CurrentDtInfo.PARENT_TABLE;
                                            });
                                            arrdata = parentTable;
                                        }
                                        var strCommon = '';
                                        reqAsync.forEachSeries(arrdata, function (data, callback) {
                                            _getsetupJson(data, function (setup) {
                                                var i = counter;
                                                if (setup) {
                                                    var parsedjson = JSON.parse(setup);
                                                    if (parsedjson.setupJson) {
                                                        var ssJson = parsedjson.setupJson[0];
                                                        _prepareConditionParam(ssJson, function (strCond) {

                                                            if (ischildLoop) {
                                                                strCommon = strCommon + " INNER JOIN  " + CurrentDtInfo.PARENT_TABLE + " T" + [i] + " ON TRN" + [i + 1] + "." + CurrentDtInfo.FOREIGN_COLUMN + " = " + " T" + [i] + "." + CurrentDtInfo.FOREIGN_COLUMN + " INNER JOIN  " + data.TARGET_TABLE + " t" + [i + 1] + " ON T" + [i] + "." + data.PRIMARY_COLUMN + " = " + " T" + [i + 1] + "." + data.PRIMARY_COLUMN + " WHERE " + strCond + ")";
                                                            } else {
                                                                strCommon = strCommon + " INNER JOIN  " + data.TARGET_TABLE + " T" + [i] + " ON TRN" + [i + 1] + "." + CurrentDtInfo.FOREIGN_COLUMN + " = " + " T" + [i] + "." + data.PRIMARY_COLUMN + " WHERE " + strCond + ")";
                                                            }

                                                            counter = counter + 1;
                                                            callback();
                                                        });
                                                    } else {
                                                        let parentTable = totalParent.filter((crnttable) => {
                                                            return crnttable.TARGET_TABLE == arrdata[0].PARENT_TABLE;
                                                        });
                                                        arrdata = parentTable;
                                                        Prepareparentqry(arrdata, true);
                                                    }

                                                } else {
                                                    strCommon = ' )'
                                                }
                                            });
                                        }, function (error) {
                                            if (error) {
                                                var res = {};
                                                res.errMessage = "Exception occured forEachSeries function";
                                                res.errCode = "ERR-ARCH-45044";
                                                res.errobj = error;
                                                sendFailureRespone(res);
                                            } else {
                                                var strqry = "INSERT INTO ARCHIVAL_INDEX_DETAIL (AI_ID,TABLE_NAME,KEY_COLUMN_ID,KEY_COLUMN_NAME) SELECT $AI_ID AS AI_ID , '" + CurrentDtInfo.TARGET_TABLE + "' as table_name ," + CurrentDtInfo.PRIMARY_COLUMN + " as key_column_id ,'" + CurrentDtInfo.PRIMARY_COLUMN + "' as key_column_name " + " FROM " + CurrentDtInfo.TARGET_TABLE + " TRN1 WHERE (TRN1.AI_ID IS NULL) AND " + CurrentDtInfo.PRIMARY_COLUMN + " IN ( SELECT " + " TRN1." + CurrentDtInfo.PRIMARY_COLUMN + " FROM " + CurrentDtInfo.TARGET_TABLE + " TRN1 ";
                                                var strIdSelQuery = `SELECT ${CurrentDtInfo.PRIMARY_COLUMN} FROM ${CurrentDtInfo.TARGET_TABLE} TRN1 WHERE ${CurrentDtInfo.PRIMARY_COLUMN} IN ( SELECT ${CurrentDtInfo.PRIMARY_COLUMN} FROM ${CurrentDtInfo.TARGET_TABLE} TRN1`;
                                                strIdSelQuery = strIdSelQuery + strCommon;
                                                strqry = strqry + strCommon;

                                                var targetTableSelQry = "INSERT INTO ARCHIVAL_INDEX_DETAIL (AI_ID,TABLE_NAME,KEY_COLUMN_ID,KEY_COLUMN_NAME) SELECT $AI_ID AS AI_ID , '" + CurrentDtInfo.TARGET_TABLE + "' as table_name ," + CurrentDtInfo.PRIMARY_COLUMN + " as key_column_id ,'" + CurrentDtInfo.PRIMARY_COLUMN + "' as key_column_name " + " FROM " + CurrentDtInfo.TARGET_TABLE + " TRN1 WHERE (TRN1.AI_ID IS NULL) AND " + CurrentDtInfo.PRIMARY_COLUMN + " IN ( SELECT " + " TRN1." + CurrentDtInfo.PRIMARY_COLUMN + " FROM " + CurrentDtInfo.TARGET_TABLE + " TRN1 ";
                                                var strArcTraninsertqry = `INSERT INTO <arc_tran_db>.${CurrentDtInfo.TARGET_TABLE} SELECT * FROM <tran_db>.${CurrentDtInfo.TARGET_TABLE} WHERE ${CurrentDtInfo.PRIMARY_COLUMN} IN (${strIdSelQuery}) `
                                                //@tranSetUpdate, update transaction_set table archival index id, to prevent same tranction insert archival index details table 
                                                var tranSetUpdate = "UPDATE " + CurrentDtInfo.TARGET_TABLE + " SET AI_ID= $AI_ID , PRCT_ID = $PRCT_ID WHERE " + CurrentDtInfo.PRIMARY_COLUMN + " IN(SELECT KEY_COLUMN_ID  FROM  ARCHIVAL_INDEX_DETAIL WHERE AI_ID = $AI_ID  AND TABLE_NAME = '" + CurrentDtInfo.TARGET_TABLE + "')";

                                                var HstTranDataInsert = `INSERT INTO <arc_tran_db>.HST_TRAN_DATA ( SELECT * FROM <tran_db>.HST_TRAN_DATA WHERE TRAN_ID IN (${strIdSelQuery}) AND DTT_CODE='${CurrentDtInfo.DTT_CODE}')`;
                                                var HstTranDel = `DELETE FROM <tran_db>.HST_TRAN_DATA WHERE TRAN_ID IN(${CurrentDtInfo.TARGET_TABLE}') AND DTT_CODE='${CurrentDtInfo.DTT_CODE}'`;
                                                var TranaDataInsert = "INSERT INTO <arc_res_db>.TRNA_DATA ( SELECT * FROM <res_cas>.TRNA_DATA WHERE IS_PROCESSED='Y' AND RELATIVE_PATH IN (select relative_path from TRN_ATTACHMENTS WHERE DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND TRN_ID IN ( " + strIdSelQuery + ")))";
                                                var TranaDataDel = "DELETE FROM <res_cas>.TRNA_DATA WHERE IS_PROCESSED='Y' AND RELATIVE_PATH IN (select relative_path from TRN_ATTACHMENTS WHERE DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND TRN_ID IN ( " + strIdSelQuery + "))";
                                                var TransCMTInsert = "INSERT INTO <arc_tran_db>.TRANSACTION_COMMENTS ( SELECT * FROM <tran_db>.TRANSACTION_COMMENTS WHERE DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND  TS_ID  IN ( SELECT TS_ID FROM TRANSACTION_SET WHERE DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND TRN_ID IN (" + strIdSelQuery + ")))";
                                                var TranCMTDel = "DELETE FROM <tran_db>.TRANSACTION_COMMENTS WHERE DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND  TS_ID   IN ( SELECT TS_ID FROM TRANSACTION_SET WHERE DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND TRN_ID IN (" + strIdSelQuery + "))";
                                                var TranJrnyInsert = "INSERT INTO <arc_tran_db>.TRANSACTION_JOURNEY ( SELECT * FROM <tran_db>.TRANSACTION_JOURNEY WHERE DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND TRN_ID IN (" + strIdSelQuery + "))";
                                                var TranJrnyDel = "DELETE FROM <tran_db>.TRANSACTION_JOURNEY WHERE DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND TRN_ID IN ( " + strIdSelQuery + ")";
                                                var TranJrnyDtlInsert = "INSERT INTO <arc_tran_db>.TRANSACTION_JOURNEY_DETAIL ( SELECT * FROM <tran_db>.TRANSACTION_JOURNEY_DETAIL WHERE DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND TRN_ID IN (" + strIdSelQuery + "))";
                                                var TranJrnyDtlDel = "DELETE FROM <tran_db>.TRANSACTION_JOURNEY_DETAIL WHERE DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND TRN_ID IN ( " + strIdSelQuery + ")";
                                                var TranATMTInsert = "INSERT INTO <arc_tran_db>.TRN_ATTACHMENTS ( SELECT * FROM <tran_db>.TRN_ATTACHMENTS WHERE IS_PROCESSED='Y' AND DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND TRN_ID IN (" + strIdSelQuery + "))";
                                                var TranATMTDel = "DELETE FROM <tran_db>.TRN_ATTACHMENTS WHERE IS_PROCESSED='Y' AND DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND TRN_ID IN (" + strIdSelQuery + ")";
                                                var TranSetInsert = "INSERT INTO <arc_tran_db>.TRANSACTION_SET  ( SELECT * FROM <tran_db>.TRANSACTION_SET WHERE DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND TRN_ID IN (" + strIdSelQuery + "))";
                                                var TransetDel = "DELETE FROM <tran_db>.TRANSACTION_SET WHERE DTT_CODE ='" + CurrentDtInfo.DTT_CODE + "' AND TRN_ID IN ( " + strIdSelQuery + "')";
                                                var TranTblInsert = `INSERT INTO <arc_tran_db>.${CurrentDtInfo.TARGET_TABLE} ( SELECT * FROM <tran_db>.${CurrentDtInfo.TARGET_TABLE} WHERE ${CurrentDtInfo.PRIMARY_COLUMN} IN (${strIdSelQuery})) `
                                                var TranTblDel = "DELETE FROM <tran_db>." + CurrentDtInfo.TARGET_TABLE + "  WHERE " + CurrentDtInfo.PRIMARY_COLUMN + " IN(" + strIdSelQuery + "')";

                                                // var strPrctqry = `DELETE FROM <tran_db>.PRC_TOKENS WHERE PRCT_ID IN (SELECT DISTINCT PRCT_ID FROM  <tran_db>.HST_TRAN_DATA WHERE TRAN_ID IN(${CurrentDtInfo.TARGET_TABLE}') AND DTT_CODE='${CurrentDtInfo.DTT_CODE}' AND PROCESS_COUNT=1 AND LOCK_ID IS NULL) AND PROCESS_COUNT=1 AND LOCK_ID IS NULL`;
                                                // var strHstqry = `DELETE FROM <tran_db>.HST_TRAN_DATA WHERE TRAN_ID IN(${CurrentDtInfo.TARGET_TABLE}') AND DTT_CODE='${CurrentDtInfo.DTT_CODE}' AND PROCESS_COUNT=1 AND LOCK_ID IS NULL`;

                                                //var totalLe ngth = childarr.length;
                                                if (auditarcMode == "SOLR") {
                                                    HstTranDel = HstTranDel + ` AND PROCESS_COUNT=1 AND LOCK_ID IS NULL`;
                                                }


                                                var arrQuries = [
                                                    {
                                                        query: HstTranDel,
                                                        query_type: 'TRN_QUERY',
                                                        mode: 'DELETE',
                                                        schema_name: 'tran_db',
                                                        sort_order: 2,
                                                        table_sort_order: CurrentDtInfo.sort_order,
                                                        query_id: `${CurrentDtInfo.DTT_CODE}_HST_TRAN_DATA_DELETE`,
                                                        target_table: 'HST_TRAN_DATA'
                                                    }, {
                                                        query: TranJrnyDel,
                                                        query_type: 'HST_TS_JOURNEY_QUERY',
                                                        mode: 'DELETE',
                                                        schema_name: 'tran_db',
                                                        sort_order: 8,
                                                        table_sort_order: CurrentDtInfo.sort_order,
                                                        query_id: `${CurrentDtInfo.DTT_CODE}_TRANSACTION_JOURNEY_DELETE`,
                                                        target_table: 'TRANSACTION_JOURNEY'
                                                    }, {
                                                        query: TranJrnyDtlDel,
                                                        query_type: 'HST_TS_JOURNEY_QUERY',
                                                        mode: 'DELETE',
                                                        schema_name: 'tran_db',
                                                        sort_order: 10,
                                                        table_sort_order: CurrentDtInfo.sort_order,
                                                        query_id: `${CurrentDtInfo.DTT_CODE}_TRANSACTION_JOURNEY_DETAIL_DELETE`,
                                                        target_table: 'TRANSACTION_JOURNEY_DETAIL'
                                                    },
                                                    {
                                                        query: TranCMTDel,
                                                        query_type: 'TRN_COMENTS_QUERY',
                                                        mode: 'DELETE',
                                                        schema_name: 'tran_db',
                                                        sort_order: 6,
                                                        table_sort_order: CurrentDtInfo.sort_order,
                                                        query_id: `${CurrentDtInfo.DTT_CODE}_TRANSACTION_COMMENTS_DELETE`,
                                                        target_table: 'TRANSACTION_COMMENTS'
                                                    }, {
                                                        query: TranATMTDel,
                                                        query_type: 'TRN_ATMT_QUERY',
                                                        mode: 'DELETE',
                                                        schema_name: 'tran_db',
                                                        sort_order: 12,
                                                        table_sort_order: CurrentDtInfo.sort_order,
                                                        query_id: `${CurrentDtInfo.DTT_CODE}_TRN_ATTACHMENTS_DELETE`,
                                                        target_table: 'TRN_ATTACHMENTS'
                                                    }, {
                                                        query: TransetDel,
                                                        query_type: 'TS_QUERY',
                                                        mode: 'DELETE',
                                                        schema_name: 'tran_db',
                                                        sort_order: 14,
                                                        table_sort_order: CurrentDtInfo.sort_order,
                                                        query_id: `${CurrentDtInfo.DTT_CODE}_TRANSACTION_SET_DELETE`,
                                                        target_table: 'TRANSACTION_SET'
                                                    }, {
                                                        query: TranTblInsert,
                                                        query_type: 'TRN_QUERY',
                                                        mode: 'DELETE',
                                                        schema_name: 'tran_db',
                                                        sort_order: 15,
                                                        table_sort_order: CurrentDtInfo.sort_order,
                                                        query_id: `${CurrentDtInfo.DTT_CODE}_${CurrentDtInfo.TARGET_TABLE}_INSERT`,
                                                        target_table: CurrentDtInfo.TARGET_TABLE
                                                    }];
                                                if (auditarcMode == "DB") {
                                                    arrQuries.push({
                                                        query: TranTblDel,
                                                        query_type: 'TRN_QUERY',
                                                        mode: 'INSERT',
                                                        schema_name: 'tran_db',
                                                        sort_order: 16,
                                                        table_sort_order: CurrentDtInfo.sort_order,
                                                        query_id: `${CurrentDtInfo.DTT_CODE}_${CurrentDtInfo.TARGET_TABLE}_DELETE`,
                                                        target_table: CurrentDtInfo.TARGET_TABLE
                                                    }, {
                                                        query: TranSetInsert,
                                                        query_type: 'TRN_QUERY',
                                                        mode: 'INSERT',
                                                        schema_name: 'tran_db',
                                                        sort_order: 13,
                                                        table_sort_order: CurrentDtInfo.sort_order,
                                                        query_id: `${CurrentDtInfo.DTT_CODE}_TRANSACTION_SET_INSERT`,
                                                        target_table: 'TRANSACTION_SET'
                                                    }, {
                                                        query: TranATMTInsert,
                                                        query_type: 'TRN_QUERY',
                                                        mode: 'INSERT',
                                                        schema_name: 'tran_db',
                                                        sort_order: 11,
                                                        table_sort_order: CurrentDtInfo.sort_order,
                                                        query_id: `${CurrentDtInfo.DTT_CODE}_TRN_ATTACHMENTS_INSERT`,
                                                        target_table: 'TRN_ATTACHMENTS'
                                                    }, {
                                                        query: TransCMTInsert,
                                                        query_type: 'TRN_QUERY',
                                                        mode: 'INSERT',
                                                        schema_name: 'tran_db',
                                                        sort_order: 5,
                                                        table_sort_order: CurrentDtInfo.sort_order,
                                                        query_id: `${CurrentDtInfo.DTT_CODE}_TRANSACTION_COMMENTS_INSERT`,
                                                        target_table: 'TRANSACTION_COMMENTS'
                                                    }, {
                                                        query: TranJrnyInsert,
                                                        query_type: 'TRN_QUERY',
                                                        mode: 'INSERT',
                                                        schema_name: 'tran_db',
                                                        sort_order: 7,
                                                        table_sort_order: CurrentDtInfo.sort_order,
                                                        query_id: `${CurrentDtInfo.DTT_CODE}_TRANSACTION_JOURNEY_INSERT`,
                                                        target_table: 'TRANSACTION_JOURNEY'
                                                    }, {
                                                        query: TranJrnyDtlInsert,
                                                        query_type: 'TRN_QUERY',
                                                        mode: 'INSERT',
                                                        schema_name: 'tran_db',
                                                        sort_order: 9,
                                                        table_sort_order: CurrentDtInfo.sort_order,
                                                        query_id: `${CurrentDtInfo.DTT_CODE}_TRANSACTION_JOURNEY_DETAIL_INSERT`,
                                                        target_table: 'TRANSACTION_JOURNEY_DETAIL'
                                                    }, {
                                                        query: TranaDataInsert,
                                                        query_type: 'TRN_QUERY',
                                                        mode: 'INSERT',
                                                        schema_name: 'tran_db',
                                                        sort_order: 3,
                                                        table_sort_order: CurrentDtInfo.sort_order,
                                                        query_id: `${CurrentDtInfo.DTT_CODE}_TRNA_DATA_INSERT`,
                                                        target_table: 'TRNA_DATA'
                                                    }, {
                                                        query: HstTranDataInsert,
                                                        query_type: 'TRN_QUERY',
                                                        mode: 'INSERT',
                                                        schema_name: 'tran_db',
                                                        sort_order: 1,
                                                        table_sort_order: CurrentDtInfo.sort_order,
                                                        query_id: `${CurrentDtInfo.DTT_CODE}_HST_TRAN_DATA_INSERT`,
                                                        target_table: 'HST_TRAN_DATA'
                                                    })
                                                }
                                                if (serviceModel.TYPE == 'LITE') {
                                                    arrQuries.unshift({
                                                        query: TranaDataDel,
                                                        query_type: 'TRNA_DATA_DEL',
                                                        mode: 'DELETE',
                                                        schema_name: 'res_cas',
                                                        sort_order: 4,
                                                        table_sort_order: CurrentDtInfo.sort_order,
                                                        query_id: `${CurrentDtInfo.DTT_CODE}_TRNA_DATA_INSERT`,
                                                        target_table: 'TRNA_DATA'
                                                    });
                                                }


                                                var qryobj = _prepareInsertarr(arrQuries, CurrentDtInfo);

                                                _PrintInfo(objLogInfo, "Going to insert into archival qry info table");
                                                pcallback(qryobj);
                                            }

                                        });
                                    } catch (error) {
                                        var res = {};
                                        res.errMessage = "Exception occured _getsetupJson function";
                                        res.errCode = "ERR-ARCH-45043";
                                        res.errobj = error;
                                        sendFailureRespone(res);
                                    }
                                }
                                // });
                            }

                            function _getsetupJson(dttinfo, callback) {
                                try {
                                    var Cond = {};
                                    Cond.dtt_code = dttinfo.DTT_CODE;
                                    Cond.tenant_id = objLogInfo.TENANT_ID;
                                    console.log("_getsetupJson fuction executing");
                                    reqDBInstance.GetTableFromFXDBNoCache(pClient, "ARCHIVAL_SETUP", [], Cond, objLogInfo, function (pErr, pRes) {
                                        try {
                                            if (pErr) {
                                                var res = {};
                                                res.errMessage = "Exception occured _getsetupJson  callback function";
                                                res.errCode = "ERR-ARCH-45023";
                                                res.errobj = pErr;
                                                sendFailureRespone(res);
                                            } else {
                                                console.log(`ARCHIVAL_SETUP row length | ${pRes.rows.length}`);
                                                var sjson = pRes.rows[0].setup_json;
                                                callback(sjson);
                                            }
                                        } catch (error) {
                                            var res = {};
                                            res.errMessage = "Exception occured _getsetupJson function";
                                            res.errCode = "ERR-ARCH-45022";
                                            res.errobj = error;
                                            sendFailureRespone(res);

                                        }
                                    });
                                } catch (error) {
                                    var res = {};
                                    res.errMessage = "Exception occured _getsetupJson function";
                                    res.errCode = "ERR-ARCH-46011";
                                    res.errobj = error;
                                    sendFailureRespone(res);
                                }
                            }

                            function _GetConditionParam(setUpJsonvalue, callback) {
                                try {
                                    var strCond = "";
                                    if (ArSetupMode == 'TENANT') {
                                        strCond = ` ((TRN1.TENANT_ID= '${objLogInfo.TENANT_ID}') AND`;
                                    }
                                    var arrcond = setUpJsonvalue;

                                    var combineCondtion = " OR ";

                                    if (arrcond != undefined && arrcond.length === 1) {
                                        combineCondtion = '';
                                    }
                                    if (arrcond != undefined) {
                                        arrcond.forEach((item, inx) => {
                                            if (inx == arrcond.length - 1) {
                                                combineCondtion = '';
                                            }
                                            item.forEach((curentCondtion, indx) => {
                                                var cnd = '';
                                                if (item.length > 1 && indx != item.length - 1) {
                                                    cnd = ' AND ';
                                                }
                                                if (indx == 0) {
                                                    strCond += '(';
                                                }

                                                if (curentCondtion['Operator'] == '&lt;') {
                                                    curentCondtion['Operator'] = '<'
                                                }
                                                if (curentCondtion['Operator'] == '&gt;') {
                                                    curentCondtion['Operator'] = '>'
                                                }
                                                if (curentCondtion['Operator'] == '&gt;=') {
                                                    curentCondtion['Operator'] = '>='
                                                }
                                                if (curentCondtion['Operator'] == '&lt;=') {
                                                    curentCondtion['Operator'] = '<='
                                                }

                                                if (curentCondtion['Data_type'] === 'Date') {
                                                    if (pSession.DBConn.DBType.toUpperCase() == "ORACLEDB") {
                                                        if (curentCondtion['Binding_Value'].toLowerCase().indexOf('sysdate') > -1) {
                                                            curentCondtion['Binding_Value'] = curentCondtion['Binding_Value'].toString();
                                                            strCond += `${'TRUNC('}${'TRN1.'} ${curentCondtion['Binding_Name']}${')'} ${curentCondtion['Operator']} ${'to_date(to_char(cast('}'${curentCondtion['Binding_Value']}' as date),'DD-MON-YY'),'DD-MON-YY') ${cnd}`;
                                                        } else {
                                                            strCond += `${'TRUNC('}${'TRN1.'} ${curentCondtion['Binding_Name']}${')'} ${curentCondtion['Operator']} ${'to_date(to_char(cast('}'${curentCondtion['Binding_Value']}' as date),'DD-MON-YY'),'DD-MON-YY') ${cnd}`;
                                                        }
                                                    } else {
                                                        if (curentCondtion['Binding_Value'].toLowerCase().indexOf('sysdate') > -1 || curentCondtion['Binding_Value'].toLowerCase().indexOf('current') > -1) {
                                                            curentCondtion['Binding_Value'] = curentCondtion['Binding_Value'].toString();
                                                            strCond += `${'to_date(to_char('}${'TRN1.'}${curentCondtion['Binding_Name']},'yyyy-mm-dd'),'yyyy-mm-dd') ${curentCondtion['Operator']} to_date(to_char(cast(${curentCondtion['Binding_Value']} as date),'yyyy-mm-dd'),'yyyy-mm-dd') ${cnd}`;
                                                        } else {
                                                            strCond += `${'to_date(to_char('}${'TRN1.'}${curentCondtion['Binding_Name']},'yyyy-mm-dd'),'yyyy-mm-dd') ${curentCondtion['Operator']} to_date(to_char(cast('${curentCondtion['Binding_Value']}' as date),'yyyy-mm-dd'),'yyyy-mm-dd') ${cnd}`;
                                                        }
                                                    }

                                                } else {
                                                    if (curentCondtion['Operator'] === 'Between' || curentCondtion['Operator'] === 'IN') {
                                                        if (curentCondtion['Operator'] === 'IN') {
                                                            strCond += `${'TRN1.'}${curentCondtion['Binding_Name']} ${curentCondtion['Operator']} (${curentCondtion['Binding_Value']}) ${cnd}`;
                                                        } else {
                                                            strCond += `${'TRN1.'}${curentCondtion['Binding_Name']} ${curentCondtion['Operator']} ${curentCondtion['Binding_Value']} ${cnd}`;
                                                        }
                                                    } else {
                                                        strCond += `${'TRN1.'}${curentCondtion['Binding_Name']}${curentCondtion['Operator']}'${curentCondtion['Binding_Value']}'${cnd}`;
                                                    }

                                                }
                                                if (indx === item.length - 1) {
                                                    strCond += ')';
                                                }
                                            });
                                            strCond += combineCondtion;
                                        });
                                        if (ArSetupMode === 'TENANT') {
                                            strCond += ')';
                                        }
                                    }
                                    callback(strCond, arrcond);
                                } catch (error) {
                                    var res = {};
                                    res.errMessage = "Exception occured _GetConditionParam function";
                                    res.errCode = "ERR-ARCH-46011";
                                    res.errobj = error;
                                    sendFailureRespone(res);
                                }
                            }


                            function _prepareConditionParam(setUpJsonvalue, callback) {
                                try {
                                    var arrcond = setUpJsonvalue;
                                    var strCond = '';
                                    if (ArSetupMode == 'TENANT') {
                                        strCond = ` TRN1.TENANT_ID= '${objLogInfo.TENANT_ID}'`;
                                    }
                                    for (var i = 0; i < arrcond.length; i++) {
                                        // for (var j = 0; j < arrcond[i].length; j++) {

                                        if (arrcond[i].Data_type == 'Date') {
                                            if (pSession.DBConn.DBType.toUpperCase() == "ORACLEDB") {
                                                if (arrcond[i].Binding_Value.toLowerCase().indexOf('sysdate') > -1) {
                                                    if (strCond) {
                                                        strCond = `${strCond} AND TRUNC(T0.${arrcond[i]['Binding_Name']})${arrcond[i]['Operator']}to_date(to_char(cast('${arrcond[i]['Binding_Value']}' as date),'DD-MON-YY'),'DD-MON-YY')`;
                                                    } else {
                                                        strCond = `TRUNC(T0.${arrcond[i]['Binding_Name']})${arrcond[i]['Operator']}to_date(to_char(cast('${arrcond[i]['Binding_Value']}' as date),'DD-MON-YY'),'DD-MON-YY')`;
                                                    }
                                                } else {
                                                    strCond += `TRUNC(T0.${arrcond[i]['Binding_Name']})${arrcond[i]['Operator']} ${'to_date(to_char(cast('}'${arrcond[i]['Binding_Value']}' as date),'DD-MON-YY'),'DD-MON-YY')`;
                                                }
                                            } else {
                                                // strCond += `${'to_date(to_char('}${'TRN1.'}${curentCondtion['Binding_Name']},'yyyy-mm-dd'),'yyyy-mm-dd') ${curentCondtion['Operator']}${'to_date(to_char(cast('} '${curentCondtion['Binding_Value']}' as date),'yyyy-mm-dd'),'yyyy-mm-dd') ${cnd}`;
                                                if (strCond) {
                                                    strCond = `${strCond} AND to_date(to_char(TRN1.${arrcond[i]['Binding_Name']},'yyyy-mm-dd'),'yyyy-mm-dd')${arrcond[i]['Operator']}to_date(to_char(cast('${arrcond[i]['Binding_Value']}' as date),'yyyy-mm-dd'),'yyyy-mm-dd')`;
                                                } else {
                                                    // strCond = "T0." + arrcond[i].Binding_Name + arrcond[i].Operator + arrcond[i].Binding_Value;
                                                    strCond = `to_date(to_char(T0.${arrcond[i]['Binding_Name']},'yyyy-mm-dd'),'yyyy-mm-dd)${arrcond[i]['Operator']}to_date(to_char(cast('${arrcond[i]['Binding_Value']}' as date),'yyyy-mm-dd'),'yyyy-mm-dd')`;

                                                }
                                            }
                                        } else {
                                            if (strCond) {
                                                strCond = strCond + " AND TRN1." + arrcond[i].Binding_Name + arrcond[i].Operator + "'" + arrcond[i].Binding_Value + "'";
                                            } else {
                                                strCond = "T0." + arrcond[i].Binding_Name + arrcond[i].Operator + "'" + arrcond[i].Binding_Value + "'";
                                            }
                                        }

                                        // }
                                    }
                                    callback(strCond, arrcond);
                                } catch (error) {
                                    var res = {};
                                    res.errMessage = "Exception occured _GetConditionParam function";
                                    res.errCode = "ERR-ARCH-46011";
                                    res.errobj = error;
                                    sendFailureRespone(res);
                                }
                            }
                        });

                    });
                });


                function sendFailureRespone(pres) {
                    reqInstanceHelper.SendResponse(ServiceName, appResponse, '', objLogInfo, pres.errCode, pres.errMessage, pres.errobj, 'FAILURE');
                }

                function _PrintInfo(pLogInfo, pMessage) {
                    reqInstanceHelper.PrintInfo(ServiceName, pMessage, pLogInfo);
                }

            });


        });
    } catch (error) {
        var res = {};
        res.errMessage = "Exception occured prepareResult function";
        res.errCode = "ERR-ARCH-45002";
        res.errobj = error;
        sendFailureRespone(res);

    }
});

module.exports = router;