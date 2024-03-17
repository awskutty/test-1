/*
@Api_Name         : /archivalQryLog,
@Description      : To get the archival query Log details  from table
@Last_Error_code  : ERR-HAN-
*/

// Require dependencies
//Archival log
var reqExpress = require('express');
var router = reqExpress.Router();
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqCommon = require('../../../../torus-references/transaction/Common');
var reqDateFormatter = require('../../../../torus-references/common/dateconverter/DateFormatter');
var reqsvchelper = require('../../../../torus-references/common/serviceHelper/ServiceHelper');
var reqMoment = require('moment');
var reqDateFormat = require('dateformat');
var pSessionval = '';
router.post('/archivalQryLog', function (appRequest, appResponse) {
    try {
        var ServiceName = 'archivalQryLog';
        var pHeaders = appRequest.headers;
        var objLogInfo = {};
        var aiId = appRequest.body.PARAMS.aiId;
        var process = appRequest.body.PARAMS.PROCESS;
        var RowResult;
        var responseArr = [];
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
            reqTranDBInstance.GetTranDBConn(pHeaders, false, function (pSession) {
                try {
                    var cond = {
                        ai_id: aiId
                    };
                    // if (process) {
                    //     cond['category'] = process;
                    // }
                    reqTranDBInstance.GetTableFromTranDB(pSession, 'ARCHIVAL_QUERY_LOG', cond, objLogInfo, function (Res, Err) {
                        try {
                            if (Err) {
                                reqInstanceHelper.SendResponse(ServiceName, appResponse, "", objLogInfo, 'ERR-ARC-', 'Error occured while qry the table.', Err, 'FAILURE');
                            } else {
                                if (Res.length) {
                                    RowResult = Res;
                                    var obj = {};
                                    for (var i = 0; i < RowResult.length; i++) {
                                        obj = {};
                                        obj['ai_id'] = RowResult[i].ai_id;
                                        obj['app_id'] = RowResult[i].app_id;
                                        obj['aql_id'] = RowResult[i].aql_id;
                                        obj['category'] = RowResult[i].category;
                                        obj['created_date'] = RowResult[i].created_date;
                                        obj['remarks'] = RowResult[i].remarks;
                                        obj['status'] = RowResult[i].status;
                                        obj['query'] = RowResult[i].query;
                                        obj['tenant_id'] = RowResult[i].tenant_id;
                                        obj['rows_count'] = (RowResult[i].rows_count) ? RowResult[i].rows_count : '';
                                        // obj['start_date'] = (RowResult[i].start_date) ? ToDate(RowResult[i].start_date) : '';
                                        // obj['end_date'] = (RowResult[i].end_date) ? ToDate(RowResult[i].end_date) : ''
                                        obj['start_date'] = RowResult[i].start_date;
                                        obj['end_date'] = RowResult[i].end_date;
                                        if (obj['start_date'] && obj['end_date']) {
                                            obj['process_time'] = reqMoment.utc(reqMoment(obj['end_date'], "DD/MM/YYYY HH:mm:ss").diff(reqMoment(obj['start_date'], "DD/MM/YYYY HH:mm:ss"))).format("HH:mm:ss");
                                        } else {
                                            obj['process_time'] = '-';
                                        }
                                        responseArr.push(obj);
                                    }
                                }
                                reqInstanceHelper.SendResponse(ServiceName, appResponse, responseArr, objLogInfo, '', '', '', 'SUCCESS');
                            }
                        } catch (error) {
                            reqInstanceHelper.SendResponse(ServiceName, appResponse, "", objLogInfo, 'ERR-ARC-', 'Exception occured while qry the table.', error, 'FAILURE');
                        }
                    });
                } catch (error) {
                    reqInstanceHelper.SendResponse(ServiceName, appResponse, "", objLogInfo, 'ERR-ARC-', 'Exception occured after get connection callback', error, 'FAILURE');
                }
            });
            // Convert string to Date format
            function ToDate(pDate) {
                try {
                    var Restr = reqDateFormat(pDate, "dd-mm-yyyy hh:MM:ss TT");
                    return Restr;
                } catch (error) {

                }

            }
        });
    } catch (error) {
        reqInstanceHelper.SendResponse(ServiceName, appResponse, "", objLogInfo, 'ERR-ARC-', 'Exception occured main catch', error, 'FAILURE');
    }
});

router.post('/LoadarchivalIdex', function (appRequest, appResponse) {
    try {
        var ServiceName = 'archivalQryLog';
        var pHeaders = appRequest.headers;
        var objLogInfo = {};
        var params = appRequest.body.PARAMS;
        var FromDate = params.FROM_DATE;
        var SrchToDate = params.TO_DATE;
        var AiID = params.AI_ID;
        var RecordPerPage = 10;
        var CondOptr = '>=';
        // var toDateoptr = '';
        // if (SrchToDate) {
        //     toDateoptr = '' = '<=';
        // }
        var CurrentPage = params.CurrentPage || 1;
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
            reqTranDBInstance.GetTranDBConn(pHeaders, false, function (pSession) {
                pSessionval = pSession;
                try {
                    var setupCode = ['ARCHIVAL_SETUP_MODE'];
                    getClientSetup(setupCode, function (SetupData) {
                        if (SetupData.length) {
                            var arsetupModejson = JSON.parse(SetupData[0].setup_json);
                            arsetupMode = arsetupModejson["Archival_Setup_Mode"] || arsetupModejson["Archival Setup Mode"];
                        }
                        var strCond = '';
                        if (AiID) {
                            strCond = `WHERE AI_ID=${AiID}`;
                        }

                        if (strCond == '') {
                            if (arsetupMode.toUpperCase() == 'TENANT') {
                                strCond = `WHERE TENANT_ID = '${objLogInfo.TENANT_ID}'`;
                            } else if (arsetupMode.toUpperCase() == 'APP') {
                                strCond = ` WHERE APP_ID = '${objLogInfo.APP_ID}'`;
                            }
                        } else {
                            if (arsetupMode.toUpperCase() == 'TENANT') {
                                strCond = ` ${strCond} AND TENANT_ID = '${objLogInfo.TENANT_ID}'`;
                            } else if (arsetupMode.toUpperCase() == 'APP') {
                                strCond = ` ${strCond} AND APP_ID = '${objLogInfo.APP_ID}'`;
                            }
                        }
                        if (FromDate) {
                            FromDate = DateConversion(FromDate);
                            if (strCond) {
                                strCond = `${strCond} AND TO_DATE(TO_CHAR(CREATED_DATE,'DD-MON-YY'),'DD-MON-YY') ${CondOptr} TO_DATE(TO_CHAR(cast('${FromDate}' as TIMESTAMP),'DD-MON-YY'),'DD-MON-YY')`;
                            } else {
                                strCond = `WHERE TO_DATE(TO_CHAR(CREATED_DATE,'DD-MON-YY'),'DD-MON-YY')${CondOptr} TO_DATE(TO_CHAR(cast('${FromDate}' as TIMESTAMP),'DD-MON-YY'),'DD-MON-YY')`;
                            }
                            if (SrchToDate) {
                                SrchToDate = DateConversion(SrchToDate);
                                strCond = `${strCond} AND TO_DATE(TO_CHAR(CREATED_DATE,'DD-MON-YY '),'DD-MON-YY') <= TO_DATE(TO_CHAR(cast('${SrchToDate}' as TIMESTAMP),'DD-MON-YY'),'DD-MON-YY')`;
                            }
                        }


                        var query = `SELECT * FROM ARCHIVAL_INDEX ${strCond} order by ai_id desc`;
                        // reqTranDBInstance.GetTableFromTranDB(pSession, 'archival_index', cond, objLogInfo, function (Res, Err) {
                        // reqTranDBInstance.ExecuteSQLQuery(pSession, query, objLogInfo, function (Res, Err) {
                        reqTranDBInstance.ExecuteQueryWithPagingCount(pSession, query, CurrentPage, RecordPerPage, objLogInfo, function (result, Count, Err) {
                            try {
                                if (Err) {
                                    reqInstanceHelper.SendResponse(ServiceName, appResponse, "", objLogInfo, 'ERR-ARC-', 'Error occured while qry the table.', Err, 'FAILURE');
                                } else {
                                    var Resobj = {};
                                    if (result.length > 0) {
                                        for (var i = 0; i < result.length; i++) {
                                            result[i].created_date = result[i].created_date.toLocaleString();
                                        }
                                    }
                                    Resobj.rows = result;
                                    Resobj.TotalRecord = Count[0].count;
                                    reqInstanceHelper.SendResponse(ServiceName, appResponse, Resobj, objLogInfo, '', '', '', 'SUCCESS');
                                }
                            } catch (error) {
                                reqInstanceHelper.SendResponse(ServiceName, appResponse, "", objLogInfo, 'ERR-ARC-', 'Exception occured while qry the table.', error, 'FAILURE');
                            }
                        });
                    });
                } catch (error) {
                    reqInstanceHelper.SendResponse(ServiceName, appResponse, "", objLogInfo, 'ERR-ARC-', 'Exception occured after get connection callback', error, 'FAILURE');
                }
            });

            // Convert string to Date format
            function ToDate(pDate) {
                var Restr = '';
                if (pSessionval.DBConn.DBType == 'pg') {
                    Restr = reqMoment.utc(pDate).format("YYYY-MM-DD hh:mm:ss A");
                } else {
                    Restr = reqMoment(pDate).format('YYYY-MM-DD hh:mm:ss A');
                }
                return Restr;
            }

            function DateConversion(pDate) {
                var Restr = '';
                if (pSessionval.DBConn.DBType == 'pg') {
                    Restr = reqMoment.utc(pDate).format("DD-MMM-YYYY hh:mm:ss A");
                } else {
                    Restr = reqMoment(pDate).format('DD-MMM-YYYY hh:mm:ss A');
                }
                return Restr;
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
        });
    } catch (error) {
        reqInstanceHelper.SendResponse(ServiceName, appResponse, "", objLogInfo, 'ERR-ARC-', 'Exception occured main catch', error, 'FAILURE');
    }
});


module.exports = router;