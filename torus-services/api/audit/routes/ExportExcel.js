/*
@Api_Name         : /ExportPdf,
@Description      : To Get the Solr data which is used for PDf download in Client Side
@Last_Error_code  : ERR_EXPORTPDF_0007
@Changed for      : page break , page height  
*/

// Require dependencies
var reqExpress = require('express');
var router = reqExpress.Router();
var reqDateFormat = require('dateformat');

var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var reqDateFormatter = require('../../../../torus-references/common/dateconverter/DateFormatter');
var reqSvchelper = require('../../../../torus-references/common/serviceHelper/ServiceHelper');
var reqgetkeycolumn = require('../../transaction/routes/ext/ServiceHelper/ServiceHelper')
var async = require('async');
const { resolve } = require('path');
const { reject } = require('lodash');
router.post('/ExportExcel', function (appRequest, appResponse) {
    var serviceModel = reqDBInstance.DBInstanceSession.SERVICE_MODEL;
    try {
        var ServiceName = 'ExportPdf';
        var errCode = '';
        var errMessage = '';
        var arrDateColumns = [];
        var pHeaders = appRequest.headers;
        var params = appRequest.body.PARAMS || {};
        var strDTCODE = params.DT_CODE;
        var strDTTCODE = params.DTT_CODE;
        var tranOnly = params.TRAN_ONLY;
        var strKeyColumn = params.PRIMARY_COLUMN;
        var objFilters = params.FILTERS;
        var isTranOnly = params.TRAN_ONLY;
        var DttDesc = params.DTT_DESC;
        var maxRowsCount = 1000;
        var Mode = params.MODE;
        var Type = params.Type;
        // var TargetTable = params.TARGET_TABLE
        var TargetTable;
        var AUDIT_EXPORT = {};
        var ReportName;
        // var objFilters = appRequest.body.PARAMS.FILTERS;
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
            var strTENANT_ID = objSessionInfo.TENANT_ID || 'keeqb';
            reqDBInstance.GetFXDBConnection(pHeaders, 'dep_cas', objLogInfo, function (pClient) {
                reqDBInstance.GetFXDBConnection(pHeaders, 'clt_cas', objLogInfo, function (clt_cas_instance) {
                    var cond = {};
                    cond.setup_code = 'AUDIT_EXPORT';
                    // var AUDIT_EXPORT = {};
                    reqSvchelper.GetSetupJson(clt_cas_instance, cond, objLogInfo, async function (res) {
                        if (res.Status == 'SUCCESS') {
                            if (res.Data.length) {
                                var setup_json = JSON.parse(res.Data[0].setup_json);
                                if (setup_json) {
                                    var objsetupJson = setup_json.audit_export;
                                    var reqColumnsDtl = objsetupJson.filter((vale) => {
                                        return vale.DTT_CODE == strDTTCODE;
                                    });

                                    if (reqColumnsDtl.length) {
                                        ReportName = reqColumnsDtl[0].REPORT_NAME;
                                        AUDIT_EXPORT = reqColumnsDtl[0].COLUMNS;
                                        maxRowsCount = isTranOnly ? reqColumnsDtl[0].MAX_ROWS : reqColumnsDtl[0].MAX_ROWS_WITH_IMAGE;
                                    } else {
                                        errCode = 'ERR_EXPORTPDF_0011';
                                        errMessage = 'Tenant Setup Not for selected dtt_code ';
                                        reqInstanceHelper.PrintError(ServiceName, objLogInfo, errCode, errMessage, '');
                                        return reqInstanceHelper.SendResponse(ServiceName, appResponse, '', objLogInfo, errCode, errMessage, '');
                                    }
                                }
                            }

                            if (params && Object.keys(params).length) {
                                // Get the data from table  
                                var strCond = __PrepareSearchParam();
                                TargetTable = await GettingTargetTable(strDTCODE, strDTTCODE)
                                if (Mode == "LIVE") {
                                    reqTranDBInstance.GetTranDBConn(pHeaders, false, function (liveDBConnection) {
                                        if (TargetTable) {
                                            QueryExecute(AUDIT_EXPORT, TargetTable, liveDBConnection, strCond)
                                        }
                                    })
                                } else {
                                    reqDBInstance.GetFXDBConnection(pHeaders, 'arc_tran_db', objLogInfo, function (archivalDBConnection) {
                                        if (TargetTable) {
                                            QueryExecute(AUDIT_EXPORT, TargetTable, archivalDBConnection, strCond)
                                        }
                                    })
                                }

                            } else {
                                errCode = 'ERR_EXPORTPDF_0001';
                                errMessage = 'There is No Input Param from client side';
                                reqInstanceHelper.PrintError(ServiceName, objLogInfo, errCode, errMessage, '');
                                reqInstanceHelper.SendResponse(ServiceName, appResponse, '', objLogInfo, errCode, errMessage, '');
                            }
                        } else {
                            errCode = 'ERR_EXPORTPDF_0003';
                            errMessage = 'Error While Getting AUDIT_EXPORT From Platform Setup Table..';
                            reqInstanceHelper.PrintError(ServiceName, objLogInfo, errCode, errMessage, '');
                            reqInstanceHelper.SendResponse(ServiceName, appResponse, '', objLogInfo, errCode, errMessage, 'FAILURE');
                        }
                    });

                });
            });






            function __PrepareSearchParam() {
                var strWhereCond = '';
                try {
                    if (objFilters != undefined && objFilters != null)
                        Object.keys(objFilters).forEach(function (key) {
                            if (key.toUpperCase() == 'TRN_ID' && objFilters[key]) {
                                strWhereCond = __AppendCriteria(strWhereCond, strKeyColumn, objFilters[key], '');
                            } else if (key.toUpperCase() == 'USER_NAME' && objFilters[key]) {
                                if (strWhereCond) {
                                    strWhereCond = strWhereCond + ' AND (CREATED_BY_NAME LIKE \'' + (objFilters[key]).toUpperCase() + '%\' OR MODIFIED_BY_NAME LIKE \'' + (objFilters[key]).toUpperCase() + '%\')';
                                } else {
                                    strWhereCond = '(CREATED_BY_NAME LIKE \'' + (objFilters[key]).toUpperCase() + '%\' OR MODIFIED_BY_NAME LIKE \'' + (objFilters[key]).toUpperCase() + '%\')';
                                }
                            } else if (key == 'DATE_BETWEEN') {
                                var objDate = objFilters[key];
                                if (objDate.START_DATE != "" && objDate.END_DATE == "") {
                                    strWhereCond = __AppendCriteria(strWhereCond, 'CREATED_DATE', __ToDate(objDate.START_DATE), '');
                                } else if (objDate.START_DATE != "" && objDate.END_DATE != "") {
                                    strWhereCond = __AppendCriteria(strWhereCond, 'CREATED_DATE', __ToDate(objDate.START_DATE), __ToDate(objDate.END_DATE));
                                }
                            } else if (key == 'DATE_COLUMNS') {
                                var dateColumns = objFilters[key];
                                var dateColKeys = Object.keys(dateColumns);
                                for (var i = 0; i < dateColKeys.length; i++) {
                                    var targetCol = dateColKeys[i];
                                    var objDate = dateColumns[targetCol];
                                    if (objDate.START_DATE != "" && objDate.END_DATE == "") {
                                        strWhereCond = __AppendCriteria(strWhereCond, targetCol, __ToDate(objDate.START_DATE), '');
                                    } else if (objDate.START_DATE != "" && objDate.END_DATE != "") {
                                        strWhereCond = __AppendCriteria(strWhereCond, targetCol, __ToDate(objDate.START_DATE), __ToDate(objDate.END_DATE));
                                    }
                                }
                            } else {
                                if (objFilters[key] != '' && objFilters[key] != null && objFilters[key] != undefined) {
                                    if (arrDateColumns.indexOf(key) >= 0) // Date target column
                                        strWhereCond = __AppendCriteria(strWhereCond, key, objFilters[key].from, objFilters[key].to);
                                    else // Text tartget column
                                        strWhereCond = __AppendCriteria(strWhereCond, key, objFilters[key], '');
                                }
                            }
                        });

                    return strWhereCond;
                } catch (error) {
                    _PrintError('ERR-AUT-15205', 'Error on __PrepareSearchParam() ', error);
                }

            }


            function __AppendCriteria(pWhereCond, pColumn, pValue, pValue1) {


                if (pValue1 == '' || pValue1 == undefined || pValue1 == null) { // ordinary column
                    if (arrDateColumns.indexOf(pColumn) >= 0 || pColumn == 'CREATED_DATE') { // Date target column with start value alone
                        if (pWhereCond == '')
                            pWhereCond = ' ' + pColumn + " BETWEEN '" + pValue + "'  AND '" + __ToDate(reqDateFormat(pValue, "yyyy-mm-dd 23:59:59")) + "'";
                        else
                            pWhereCond = pWhereCond + ' AND ' + pColumn + " BETWEEN '" + pValue + "'  AND '" + __ToDate(reqDateFormat(pValue, "yyyy-mm-dd 23:59:59")) + "'";
                    } else if (pColumn.toUpperCase() == 'PRCT_ID') {
                        if (pWhereCond == '')
                            pWhereCond = ' ' + pColumn.toUpperCase() + " = '" + pValue + "'";
                        else
                            pWhereCond = pWhereCond + ' AND ' + pColumn.toUpperCase() + " = '" + pValue + "'";
                    } else {
                        if (pWhereCond == '')
                            pWhereCond = ' ' + pColumn.toUpperCase() + " = '" + pValue + "'";
                        else
                            pWhereCond = pWhereCond + ' AND ' + pColumn.toUpperCase() + " = '" + pValue + "'";
                    }
                } else { // Date between
                    if (pWhereCond == '')
                        pWhereCond = ' ' + pColumn + " BETWEEN '" + pValue + "'  AND '" + __ToDate(reqDateFormat(pValue1, "yyyy-mm-dd 23:59:59")) + "'";
                    else
                        pWhereCond = pWhereCond + ' AND ' + pColumn + " BETWEEN '" + pValue + "'  AND '" + __ToDate(reqDateFormat(pValue1, "yyyy-mm-dd 23:59:59")) + "'";
                }
                return pWhereCond;

            }

            function QueryExecute(Columns, table, Connection, Cond) {
                try {
                    var strQry = {}
                    if (Cond) {
                        strQry = {
                            query: `select ?? from ${table} where ${Cond}`,
                            params: [Columns.split(",")]
                        }
                    } else {
                        strQry = {
                            query: `select ${Columns} from ${table}`,
                            params: []
                        }
                    }
                    // reqTranDBInstance.ExecuteSQLQuery(Connection, strQry, objLogInfo, function (Result, Error) {
                    reqDBInstance.ExecuteSQLQueryWithParams(Connection, strQry, objLogInfo, function (Result, Error) {
                        if (Error) {
                            reqInstanceHelper.SendResponse(ServiceName, appResponse, "", objLogInfo, 'ERR-AUD-00001', 'Error Occured while query the table', '', Error, 'FAILURE');
                        } else {
                            var obj = {}
                            obj.ReportName = ReportName;
                            obj.ReportData = Result.rows;
                            reqInstanceHelper.SendResponse(ServiceName, appResponse, obj, objLogInfo, 'SUCCESS', '', '', 'SUCCESS', 'SUCCESS');
                        }
                    })
                } catch (error) {
                    reqInstanceHelper.SendResponse(ServiceName, appResponse, "", objLogInfo, 'ERR-AUD-00011', 'Exception Occured while query the table', '', error, 'FAILURE');
                }
            }

            function __ToDate(pDate) {
                return reqDateFormatter.ConvertDate(pDate, pHeaders);
            }

            async function GettingTargetTable(DT_CODE, DTT_CODE) {
                return new Promise((resolve, reject) => {
                    var cond = {
                        app_id: objLogInfo.APP_ID,
                        dt_code: DT_CODE
                    }
                    reqDBInstance.GetFXDBConnection(pHeaders, 'dep_cas', objLogInfo, function (pClient) {
                        reqDBInstance.GetTableFromFXDB(pClient, 'DT_INFO', [], cond, objLogInfo, async function (error, result) {
                            try {
                                if (error) {
                                    reqInstanceHelper.PrintError(ServiceName, objLogInfo, 'ERR-AUD-1000011', 'Error in reqDBInstance.GetTableFromFXDB callback', error);
                                } else {
                                    reqInstanceHelper.PrintInfo(ServiceName, 'DT_INFO table result count - ' + result.rows.length, objLogInfo);
                                    var objDTInfo = result.rows[0];
                                    if (objDTInfo) {
                                        objDTTRelation = JSON.parse(objDTInfo.relation_json);
                                        // var filterTable = objDTTRelation.filter((dtt) => dtt.DTT_CODE == DTT_CODE)
                                        // resolve(filterTable[0].TARGET_TABLE)
                                        TargetTable = reqgetkeycolumn.GetTargetTableAndKeyColumn(objDTTRelation, DTT_CODE, objLogInfo)
                                        var targetTable = TargetTable.Data.split(',')
                                        resolve(targetTable[0])
                                    }
                                }
                            }
                            catch (error) {
                                reqInstanceHelper.PrintInfo(ServiceName, 'Clear cache Exception occured  ' + error, objLogInfo);
                            }
                        })
                    })
                })
            }

        });
    } catch (error) {
        errCode = 'ERR_EXPORTPDF_0002';
        errMessage = 'Catch Error in router.post(/AddConnector)...';
        reqInstanceHelper.PrintError(ServiceName, objLogInfo, errCode, errMessage, error);
        reqInstanceHelper.SendResponse(ServiceName, appResponse, null, null, errCode, errMessage, error, 'FAILURE', '');
    }
});
module.exports = router;