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
var reqDateFormat = require('dateformat');


// Initialize Global variables
var router = reqExpress.Router();

// Host the auditlog api
router.post('/GetAuditGroupByInfo', function callbackCpsignin(appRequest, appResponse) {
    var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
    var objLogInfo = {};
    var serviceName = 'GetAuditGroupByInfo';
    reqLogInfo.AssignLogInfoDetail(appRequest, function callbackAssignLogInfoDetail(objLogInfo, objSessionInfo) {
        var headers = appRequest.headers;
        var params = appRequest.body.PARAMS;
        var selectedTran = JSON.parse(params.SELECTED_TRAN);
        var strItemId = selectedTran[params.PRIMARY_COLUMN.toLowerCase()];
        var strDTCODE = params.DT_CODE;
        var strDTTCODE = params.DTT_CODE;
        var modifiedOnly = params.ONLY_MODIFIED;
        var colName = params.COLUMN_NAME;
        var strRecordsPerPage = '1000';
        var strCurrentPageNo = '1';

        var objResult = {};
        objLogInfo.HANDLER_CODE = serviceName;
        var versionCore = "AUDITLOG_VERSION_CORE";
        var auditCore = "AUDIT_LOG_CORE";
        if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
            versionCore = "TRAN_VERSION";
            auditCore = "TRAN_VERSION_DETAIL";
        }

        var strCriteria = '(DT_CODE:' + strDTCODE + ' AND DTT_CODE:' + strDTTCODE + ' AND TRN_ID:' + strItemId + ')';

        _PrintInfo('Solr Searchparam as : ' + strCriteria);

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
                    reqSolrInstance.LogSolrSearchWithPaging(headers, auditCore, strCriteria, strRecordsPerPage, strCurrentPageNo, function callbackLogSolrSearchWithPaging(result, error) {
                        if (error) {
                            return reqInstanceHelpr.SendResponse(serviceName, appResponse, objResult, objLogInfo, 'ERR-AUT-14901', 'Error on querying solr', error);
                        } else {
                            var arrAuditInfo = [];
                            if (result.response) {
                                for (var i = 0; i < result.response.docs.length; i++) {
                                    var created_by = '';
                                    var created_date = '';
                                    var versionNumber = result.response.docs[i].VERSION_NO;
                                    for (var j = 0; j < auditLogVersionData.docs.length; j++) {
                                        var currVersion = auditLogVersionData.docs[j].VERSION_NO;
                                        if (versionNumber == currVersion) {
                                            created_by = auditLogVersionData.docs[j].CREATED_BY;
                                            created_date = auditLogVersionData.docs[j].CREATED_DATE;
                                            break;
                                        }
                                    }
                                    var resobj = {
                                        "APP_ID": result.response.docs[i].APP_ID,
                                        "RECORD_ID": result.response.docs[i].RECORD_ID,
                                        "COLUMN_NAME": result.response.docs[i].COLUMN_NAME,
                                        "OLD_VALUE": (result.response.docs[i].OLD_VALUE != undefined) ? result.response.docs[i].OLD_VALUE : '',
                                        "NEW_VALUE": (result.response.docs[i].NEW_VALUE != undefined) ? result.response.docs[i].NEW_VALUE : '',
                                        "DTT_CODE": (result.response.docs[i].DTT_CODE instanceof Array) ? result.response.docs[i].DTT_CODE[0] : result.response.docs[i].DTT_CODE,
                                        "DT_CODE": (result.response.docs[i].DT_CODE instanceof Array) ? result.response.docs[i].DT_CODE[0] : result.response.docs[i].DT_CODE,
                                        "VERSION_NO": versionNumber,
                                        "CREATED_BY": created_by,
                                        "CREATED_DATE": ToDate(created_date)
                                    };
                                    arrAuditInfo.push(resobj);
                                }

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
                                objResult.TotalItems = result.response.numFound;
                                _PrintInfo('No of document found - ' + result.response.numFound);
                            } else {
                                objResult.AuditVersionData = JSON.stringify(arrAuditInfo);
                                objResult.RecordsPerPage = strRecordsPerPage;
                                objResult.CurrentPage = strCurrentPageNo;
                                objResult.TotalItems = "0";

                                _PrintInfo('No of document found - 0');
                            }
                            return reqInstanceHelpr.SendResponse(serviceName, appResponse, objResult, objLogInfo, '', '', null);
                        }
                    }, "sort=COLUMN_NAME+asc,VERSION_NO+asc");
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


        // Convert string to Date format
        function ToDate(pDate) {
            var Restr = reqDateFormat(pDate, "yyyy-mm-dd hh:MM:ss TT");
            return Restr;
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