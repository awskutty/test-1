/**
 * Api_Name         : /GetAuditGroupByInfo
 * Description      : To search the auditlog version info from GSS_AUDITLOG_VERSION_CORE
 * Last Error_Code  : ERR-AUT-15001
 */

// Require dependencies
var modPath = '../../../../node_modules/';
var refPath = '../../../../torus-references/';
var reqExpress = require(modPath + 'express');
var LINQ = require('node-linq').LINQ;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqSolrInstance = require('../../../../torus-references/instance/SolrInstance');
var reqInstanceHelpr = require('../../../../torus-references/common/InstanceHelper');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var reqDateFormat = require('dateformat');


// Initialize Global variables
var router = reqExpress.Router();

// Host the auditlog api
router.post('/GetAuditGroupByInfo', function callbackCpsignin(appRequest, appResponse) {
    var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
    var serviceName = 'GetAuditGroupByInfo';
    reqLogInfo.AssignLogInfoDetail(appRequest, function callbackAssignLogInfoDetail(objLogInfo, objSessionInfo) {
        var headers = appRequest.headers;
        var params = appRequest.body.PARAMS;
        var selectedTran = JSON.parse(params.SELECTED_TRAN);
        var strItemId
        var getFx = appRequest.body.PARAMS.GETFX;
        if (getFx) {
            strItemId = selectedTran[params.PRIMARY_COLUMN];
        } else {
            strItemId = selectedTran[params.PRIMARY_COLUMN.toLowerCase()];
        }
        var strDTCODE = params.DT_CODE;
        var strDTTCODE = params.DTT_CODE;
        var mode = params.MODE;
        var tran_id = params.TRAN_ID;
        var modifiedOnly = params.ONLY_MODIFIED;
        var colName = params.COLUMN_NAME;
        var strRecordsPerPage = '1000';
        var strCurrentPageNo = '1';

        var objResult = {};
        objResult.HeaderInfo = [
            { field: 'COLUMN_NAME', header: 'Column Name', data_type: 'STRING' },
            { field: 'OLD_VALUE', header: 'Old Value', data_type: 'STRING' },
            { field: 'NEW_VALUE', header: 'New Value', data_type: 'STRING' },
            { field: 'VERSION_NO', header: 'Version No', data_type: 'NUMBER' },
            { field: 'CREATED_BY', header: 'Modified By', data_type: 'STRING' },
            { field: 'CREATED_DATE', header: 'Modified Date', data_type: 'DATETIME' }
        ];
        objLogInfo.HANDLER_CODE = serviceName;
        var versionCore = "AUDITLOG_VERSION_CORE";
        var auditCore = "AUDIT_LOG_CORE";
        if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
            versionCore = "TRAN_VERSION";
            auditCore = "TRAN_VERSION_DETAIL";
        }
        if (getFx) {
            var strCriteria = '( AND TRN_ID:' + strItemId + ')';
        } else {
            var strCriteria = '(DT_CODE:' + strDTCODE + ' AND DTT_CODE:' + strDTTCODE + ' AND TRN_ID:' + strItemId + ')';
        }



        _PrintInfo('Solr Searchparam as : ' + strCriteria);

        if (serviceModel.AUDIT_ARCHIVAL_MODEL == "DB") {
            if (mode = 'LIVE') {
                reqTranDBInstance.GetTranDBConn(headers, false, function (dbsession) {
                    getDB(dbsession)
                })
            } else {
                reqDBInstance.GetFXDBConnection(headers, 'arc_tran_db', objLogInfo, function (dbsession) {
                    getDB(dbsession)
                })
            }
        } else {
            getSolr();
        }

        function getSolr() {
            if (serviceModel.AUDIT_ARCHIVAL_MODEL == "SOLR") {
                reqSolrInstance.LogSolrSearchWithPaging(headers, versionCore, strCriteria, strRecordsPerPage, strCurrentPageNo, function callbackLogSolrSearchWithPaging(result, error) {
                    if (error) {
                        return reqInstanceHelpr.SendResponse(serviceName, appResponse, objResult, objLogInfo, 'ERR-AUT-15001', 'Error on querying solr', error);
                    } else {
                        var arrVersionInfo = [];
                        var auditLogVersionData = result.response;
                        if (auditLogVersionData) {
                            strCriteria = 'DT_CODE:' + strDTCODE + ' AND DTT_CODE:' + strDTTCODE + ' AND RECORD_ID:' + strItemId;
                            if (modifiedOnly) {
                                strCriteria = strCriteria + ' AND OLD_VALUE:*';
                            }
                            if (colName) {
                                strCriteria = strCriteria + ' AND COLUMN_NAME:*' + colName.toUpperCase() + '*';
                            }
                            strCriteria = '(' + strCriteria + ')';
                            /*  reqSolrInstance.LogSolrSearchWithPaging(headers, auditCore, strCriteria, strRecordsPerPage, strCurrentPageNo, function callbackLogSolrSearchWithPaging(result, error) {
                             if (error) {
                             return reqInstanceHelpr.SendResponse(serviceName, appResponse, objResult, objLogInfo, 'ERR-AUT-14901', 'Error on querying solr', error);
                             } else { */
                            var arrAuditInfo = [];
                            /*  if (result.response) {
                             for (var i = 0; i < result.response.docs.length; i++) {
                             var versionNumber = result.response.docs[i].VERSION_NO;
                             var created_by = '';
                             var created_date = '';
                              for (var j = 0; j < auditLogVersionData.docs.length; j++) {
                                  var currVersion = auditLogVersionData.docs[j].VERSION_NO;
                                  if (versionNumber == currVersion) {
                                      created_by = auditLogVersionData.docs[j].CREATED_BY;
                                      created_date = auditLogVersionData.docs[j].CREATED_DATE;
                                      break;
                                  }
                              } */

                            var arrTranVersionSolDocs = auditLogVersionData.docs || [];
                            for (var j = 0; j < arrTranVersionSolDocs.length; j++) {
                                var objTranVersionSolDoc = arrTranVersionSolDocs[j];
                                PrepareModifiedColumns(arrAuditInfo, objTranVersionSolDoc, objTranVersionSolDoc.NEW_DATA, objTranVersionSolDoc.OLD_DATA)
                            }

                            arrAuditInfo.sort(function (a, b) {
                                if (a.COLUMN_NAME < b.COLUMN_NAME) { return -1; }
                                if (a.COLUMN_NAME > b.COLUMN_NAME) { return 1; }
                                return 0;
                            })

                            /*  var resobj = {
                                 "APP_ID": result.response.docs[i].APP_ID,
                                 "RECORD_ID": result.response.docs[i].RECORD_ID,
                                 "COLUMN_NAME": result.response.docs[i].COLUMN_NAME,
                                 "OLD_VALUE": (result.response.docs[i].OLD_VALUE && ToDate(result.response.docs[i].OLD_VALUE)) || '',
                                 "NEW_VALUE": (result.response.docs[i].NEW_VALUE && ToDate(result.response.docs[i].NEW_VALUE)) || '',
                                 "DTT_CODE": (result.response.docs[i].DTT_CODE instanceof Array) ? result.response.docs[i].DTT_CODE[0] : result.response.docs[i].DTT_CODE,
                                 "DT_CODE": (result.response.docs[i].DT_CODE instanceof Array) ? result.response.docs[i].DT_CODE[0] : result.response.docs[i].DT_CODE,
                                 "VERSION_NO": versionNumber,
                                 "CREATED_BY": created_by,
                                 // "CREATED_DATE": ToDate(created_date)
                                 "CREATED_DATE": created_date
                             };
                             arrAuditInfo.push(resobj);
                             } */

                            //sorting array for need
                            var sortedArr1 = [];
                            var sortedArr2 = [];
                            for (var i = 0; i < arrAuditInfo.length; i++) {
                                var currentItem = arrAuditInfo[i];
                                if (currentItem.COLUMN_NAME == 'STATUS') {
                                    sortedArr1.push(currentItem);
                                } else {
                                    sortedArr2.push(currentItem);
                                }
                            }
                            var sortedArr = sortedArr1.concat(sortedArr2);

                            objResult.AuditVersionData = JSON.stringify(sortedArr);
                            objResult.RecordsPerPage = strRecordsPerPage;
                            objResult.CurrentPage = strCurrentPageNo;
                            objResult.TotalItems = arrAuditInfo.length;
                            _PrintInfo('No of document found - ' + arrAuditInfo.length);
                            /* } else {
                                objResult.AuditVersionData = JSON.stringify(arrAuditInfo);
                                objResult.RecordsPerPage = strRecordsPerPage;
                                objResult.CurrentPage = strCurrentPageNo;
                                objResult.TotalItems = "0";
        
                                _PrintInfo('No of document found - 0');
                            } */
                            return reqInstanceHelpr.SendResponse(serviceName, appResponse, objResult, objLogInfo, '', '', null);
                            // }
                            // }, "sort=COLUMN_NAME+asc,VERSION_NO+asc");
                        } else {
                            objResult.AuditVersionData = JSON.stringify(arrVersionInfo);
                            objResult.RecordsPerPage = strRecordsPerPage;
                            objResult.CurrentPage = strCurrentPageNo;
                            objResult.TotalItems = "0";
                            _PrintInfo('No of document found - 0');
                            return reqInstanceHelpr.SendResponse(serviceName, appResponse, objResult, objLogInfo, '', '', null);
                        }

                        //return reqInstanceHelpr.SendResponse(serviceName, appResponse, objResult, objLogInfo, '', '', null)
                    }
                });
            }
        }

        function getDB(pSession) {
            if (getFx) {
                var strQry = `SELECT NEW_DATA_JSON,OLD_DATA_JSON,VERSION_NO,CREATED_BY,CREATED_BY_NAME,TO_CHAR(CREATED_DATE,'YYYY-MM-DD HH:MI:SS:MS AM') AS CREATED_DATE FROM HST_FX_TABLE_DATA WHERE TRAN_ID= '${strItemId}' AND APP_ID = '${objLogInfo.APP_ID}' AND TENANT_ID = '${objLogInfo.TENANT_ID}' `
            } else {
                var strQry = `SELECT NEW_DATA_JSON,OLD_DATA_JSON,VERSION_NO,CREATED_BY,CREATED_BY_NAME,TO_CHAR(CREATED_DATE,'YYYY-MM-DD HH:MI:SS:MS AM') AS CREATED_DATE FROM HST_TRAN_DATA WHERE DTT_CODE = '${strDTTCODE}' AND TRAN_ID= '${strItemId}' AND APP_ID = '${objLogInfo.APP_ID}' AND TENANT_ID = '${objLogInfo.TENANT_ID}' `
            }

            reqTranDBInstance.ExecuteQueryWithPagingCount(pSession, strQry, strCurrentPageNo, strRecordsPerPage, objLogInfo, function (res, pCount, err) {
                if (err) {
                    return reqInstanceHelpr.SendResponse(serviceName, appResponse, objResult, objLogInfo, 'ERR-AUT-15001', 'Error on querying DB', err);
                } else {
                    var resdata = reqInstanceHelpr.ArrKeyToUpperCase(res, objLogInfo)
                    var arrAuditInfo = []
                    var arrTranVersionSolDocs = resdata || [];
                    for (var j = 0; j < arrTranVersionSolDocs.length; j++) {
                        var objTranVersionSolDoc = arrTranVersionSolDocs[j];
                        PrepareModifiedColumns(arrAuditInfo, objTranVersionSolDoc, objTranVersionSolDoc.NEW_DATA_JSON, objTranVersionSolDoc.OLD_DATA_JSON)
                    }


                    arrAuditInfo.sort(function (a, b) {
                        if (a.COLUMN_NAME < b.COLUMN_NAME) { return -1; }
                        if (a.COLUMN_NAME > b.COLUMN_NAME) { return 1; }
                        return 0;
                    })

                    //sorting array for need
                    var sortedArr1 = [];
                    var sortedArr2 = [];
                    for (var i = 0; i < arrAuditInfo.length; i++) {
                        var currentItem = arrAuditInfo[i];
                        if (currentItem.COLUMN_NAME == 'STATUS') {
                            sortedArr1.push(currentItem);
                        } else {
                            sortedArr2.push(currentItem);
                        }
                    }
                    var sortedArr = sortedArr1.concat(sortedArr2);

                    objResult.AuditVersionData = JSON.stringify(sortedArr);
                    objResult.RecordsPerPage = strRecordsPerPage;
                    objResult.CurrentPage = strCurrentPageNo;
                    objResult.TotalItems = arrAuditInfo.length;
                    _PrintInfo('No of document found - ' + arrAuditInfo.length);
                    return reqInstanceHelpr.SendResponse(serviceName, appResponse, objResult, objLogInfo, '', '', null);

                }
            })
        }





        // Trying to Reduce the TRAN_VERSION solr Core Size by Collecting/Adding only the modified Columns from the New Data JSON/ Old Data JSOn
        function PrepareModifiedColumns(arrPreparedChangedColumns, fullJson, pNewJson, pOldJson) {
            try {
                var newDataJsonkeys;
                if (!arrPreparedChangedColumns) {
                    arrPreparedChangedColumns = [];
                }
                try {
                    pNewJson = JSON.parse(pNewJson);
                    pOldJson = JSON.parse(pOldJson);
                } catch (error) {
                    if (!pOldJson) {
                        pOldJson = {}
                    }
                }

                newDataJsonkeys = Object.keys(pNewJson);
                var systemColumns = ['created_by', 'created_tz', 'created_tz_offset', 'created_by_sessionid',
                    'created_by_sts_id', 'routingkey', 'app_id', 'created_date_utc', 'tenant_id',
                    'modified_date_utc', 'modified_tz', 'modified_tz_offset', 'modified_by_sessionid',
                    'dtt_code', 'dt_code', 'version_no', 'dt_description', 'dtt_description']


                if (pOldJson && Object.keys(pOldJson).length) {
                    // Get the JSON Diff Columns only
                    for (var i = 0; i < newDataJsonkeys.length; i++) {
                        var newDataJsonkey = newDataJsonkeys[i];
                        if (systemColumns.indexOf(newDataJsonkey.toLocaleLowerCase()) == -1) {
                            if (pNewJson[newDataJsonkey] != pOldJson[newDataJsonkey]) {
                                console.log(newDataJsonkey + " value changed from '" + pNewJson[newDataJsonkey] + "' to '" + pOldJson[newDataJsonkey] + "'");
                                var changedColumnObj = {};
                                changedColumnObj.APP_ID = fullJson.APP_ID;
                                changedColumnObj.CREATED_BY = fullJson.CREATED_BY || fullJson.CREATED_BY_NAME;
                                changedColumnObj.CREATED_DATE = fullJson.CREATED_DATE;
                                changedColumnObj.DT_CODE = fullJson.DT_CODE;
                                changedColumnObj.DTT_CODE = fullJson.DTT_CODE;
                                changedColumnObj.VERSION_NO = fullJson.VERSION_NO;
                                changedColumnObj.RECORD_ID = fullJson.TRN_ID;
                                changedColumnObj.COLUMN_NAME = newDataJsonkey;
                                changedColumnObj.OLD_VALUE = (pOldJson[newDataJsonkey] && ToDate(pOldJson[newDataJsonkey])) || '';
                                changedColumnObj.NEW_VALUE = (pNewJson[newDataJsonkey] && ToDate(pNewJson[newDataJsonkey])) || '';
                                if (modifiedOnly) {
                                    if (changedColumnObj.OLD_VALUE) { // Allowing only modified columns
                                        arrPreparedChangedColumns.push(changedColumnObj);
                                    }
                                } else {
                                    arrPreparedChangedColumns.push(changedColumnObj);
                                }
                            }
                        }
                    }

                } else {

                    for (var i = 0; i < newDataJsonkeys.length; i++) {
                        console.log(newDataJsonkey, "newDataJsonkey")
                        var newDataJsonkey = newDataJsonkeys[i];
                        if (systemColumns.indexOf(newDataJsonkey.toLocaleLowerCase()) == -1) {
                            if (pNewJson[newDataJsonkey]) {
                                var changedColumnObj = {};
                                changedColumnObj.APP_ID = fullJson.APP_ID;
                                changedColumnObj.CREATED_BY = fullJson.CREATED_BY || fullJson.CREATED_BY_NAME;
                                changedColumnObj.CREATED_DATE = fullJson.CREATED_DATE;
                                changedColumnObj.DT_CODE = fullJson.DT_CODE;
                                changedColumnObj.DTT_CODE = fullJson.DTT_CODE;
                                changedColumnObj.VERSION_NO = fullJson.VERSION_NO;
                                changedColumnObj.RECORD_ID = fullJson.TRN_ID;
                                changedColumnObj.COLUMN_NAME = newDataJsonkey;
                                changedColumnObj.OLD_VALUE = "";
                                // changedColumnObj.NEW_VALUE = pNewJson[newDataJsonkey];
                                changedColumnObj.NEW_VALUE = (pNewJson[newDataJsonkey] && ToDate(pNewJson[newDataJsonkey])) || '';
                                if (modifiedOnly) {
                                    if (changedColumnObj.OLD_VALUE) { // Allowing only modified columns
                                        arrPreparedChangedColumns.push(changedColumnObj);
                                    }
                                } else {
                                    arrPreparedChangedColumns.push(changedColumnObj);
                                }
                                console.log(newDataJsonkey + " value changed to '" + pNewJson[newDataJsonkey] + "' from '" + pOldJson[newDataJsonkey] + "'");
                            }
                        }

                    }

                }
            } catch (error) {

            }
            finally {
                return arrPreparedChangedColumns;
            }

        }




        // Convert string to Date format
        function ToDate(pDate) {
            try {
                const regExp = new RegExp('^(-?(?:[1-9][0-9]*)?[0-9]{4})-(1[0-2]|0[1-9])-(3[01]|0[1-9]|[12][0-9])T(2[0-3]|[01][0-9]):([0-5][0-9]):([0-5][0-9])(.[0-9]+)?(Z)?$');
                if (regExp.test(pDate)) {
                    var Restr = reqDateFormat(pDate, "yyyy-mm-dd hh:MM:ss TT");
                    return Restr;
                } else {
                    return pDate;
                }
            } catch (error) {
                return pDate;
            }
        }

        function _PrintError(pErrCode, pErrMessage, pError) {
            reqInstanceHelpr.PrintError(serviceName, pError, pErrCode, objLogInfo, pErrMessage);
        }

        function _PrintInfo(pMessage) {
            reqInstanceHelpr.PrintInfo(serviceName, pMessage, objLogInfo);
        }

    });
});

module.exports = router;