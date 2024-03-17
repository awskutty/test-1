/**
 * Api_Name         : /GetAuditLogInfo
 * Description      : To search the auditlog info from GSS_AUDIT_LOG_CORE
 * Last Error_Code  : ERR-AUT-14902
 */

// Require dependencies
var modPath = '../../../../node_modules/';
var refPath = '../../../../torus-references/';
var reqExpress = require(modPath + 'express');
var LINQ = require('node-linq').LINQ;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqAuditLog = require('../../../../torus-references/log/audit/AuditLog');
var reqSolrInstance = require('../../../../torus-references/instance//SolrInstance');
var reqInstanceHelpr = require('../../../../torus-references/common/InstanceHelper');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqDateFormat = require('dateformat');
var reqMoment = require('moment');

// Initialize Global variables
var router = reqExpress.Router();
var serviceName = 'GetAuditLogInfo';

// Host the auditlog api
router.post('/GetAuditLogInfo', function callbackCpsignin(appRequest, appResponse) {

    var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
    reqLogInfo.AssignLogInfoDetail(appRequest, function callbackAssignLogInfoDetail(pLogInfo, pSessionInfo) {

        var audiCore = "AUDIT_LOG_CORE";
        if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
            audiCore = "TRAN_VERSION_DETAIL";
        }


        var objLogInfo = pLogInfo;
        var pHeaders = appRequest.headers;
        var objResult = {};
        var strDTCODE = appRequest.body.PARAMS.DT_CODE;
        var strDTTCODE = appRequest.body.PARAMS.DTT_CODE;
        var strRecordID = appRequest.body.PARAMS.RECORD_ID; // 1628
        var strVersionNo = appRequest.body.PARAMS.VERSION_NO;
        var modifiedOnly = appRequest.body.PARAMS.ONLY_MODIFIED;
        var strRecordsPerPage = appRequest.body.PARAMS.RECORDS_PER_PAGE;
        var strCurrentPageNo = appRequest.body.PARAMS.CURRENT_PAGE;

        objLogInfo.HANDLER_CODE = 'GetAuditLogInfo search-Authentication';

        GetSolrSearchResult();

        function GetSolrSearchResult() {
            var strCriteria = '(DT_CODE:' + strDTCODE + ' AND DTT_CODE:' + strDTTCODE + ' AND RECORD_ID:' + strRecordID + ' AND VERSION_NO:' + strVersionNo + ')';
            // strCriteria = '(DT_CODE:DT_FX_FOLDERS AND DTT_CODE:DTT_FX_FOLDERS AND RECORD_ID:1628)'
            if (modifiedOnly) {
                strCriteria = '(DT_CODE:' + strDTCODE + ' AND DTT_CODE:' + strDTTCODE + ' AND RECORD_ID:' + strRecordID + ' AND VERSION_NO:' + strVersionNo + ' AND OLD_VALUE:*)';
            }
            _PrintInfo('Solr Searchparam as : ' + strCriteria);

            reqSolrInstance.LogSolrSearchWithPaging(pHeaders, audiCore, strCriteria, strRecordsPerPage, strCurrentPageNo, function callbackLogSolrSearchWithPaging(result, err) {
                if (err) {
                    return reqInstanceHelpr.SendResponse('GetAuditLogInfo', appResponse, objResult, objLogInfo, 'ERR-AUT-14901', 'Error on querying solr', err);
                }
                else {
                    var arrAuditInfo = [];
                    if (result.response && result.response.docs && result.response.docs.length) {
                        var DB_Type = '';
                        var tranDBKey = 'TRANDB~' + pHeaders.routingkey;
                        reqAuditLog.GetDBType(tranDBKey, false, objLogInfo, function (DB_TYPE, error) {
                            if (error) {
                                reqInstanceHelpr.PrintInfo(serviceName, 'Error while Getting data For this Redis Key - ' + tranDBKey, objLogInfo);
                                reqInstanceHelpr.PrintInfo(serviceName, 'Error - ' + error, objLogInfo);
                                reqInstanceHelpr.SendResponse(serviceName, appResponse, objResult, objLogInfo, 'ERR-AUT-14902', 'Error while Getting data For this Redis Key - ' + tranDBKey, error);
                            } else {
                                DB_Type = DB_TYPE;
                                for (var i = 0; i < result.response.docs.length; i++) {
                                    var resobj = {
                                        "APP_ID": result.response.docs[i].APP_ID,
                                        "RECORD_ID": result.response.docs[i].RECORD_ID,
                                        "COLUMN_NAME": result.response.docs[i].COLUMN_NAME,
                                        "OLD_VALUE": (result.response.docs[i].OLD_VALUE != undefined) ? result.response.docs[i].OLD_VALUE : '',
                                        "NEW_VALUE": (result.response.docs[i].NEW_VALUE != undefined) ? result.response.docs[i].NEW_VALUE : '',
                                        "DTT_CODE": (result.response.docs[i].DTT_CODE instanceof Array) ? result.response.docs[i].DTT_CODE[0] : result.response.docs[i].DTT_CODE,
                                        "DT_CODE": (result.response.docs[i].DT_CODE instanceof Array) ? result.response.docs[i].DT_CODE[0] : result.response.docs[i].DT_CODE,
                                        "VERSION_NO": result.response.docs[i].VERSION_NO,
                                    };
                                    if (isDate(resobj.OLD_VALUE)) {
                                        console.log(resobj.OLD_VALUE, '====== Before ======');
                                        if (DB_Type == 'POSTGRES') {
                                            resobj.OLD_VALUE = reqMoment.utc(resobj.OLD_VALUE).format("YYYY-MM-DD hh:mm:ss A");
                                        } else {
                                            resobj.OLD_VALUE = reqMoment(resobj.OLD_VALUE).format("YYYY-MM-DD hh:mm:ss A");
                                        }
                                        console.log(resobj.OLD_VALUE, '===== After =======');
                                    }
                                    if (isDate(resobj.NEW_VALUE)) {
                                        console.log(resobj.NEW_VALUE, '====== Before ======');
                                        if (DB_Type == 'POSTGRES') {
                                            resobj.NEW_VALUE = reqMoment.utc(resobj.NEW_VALUE).format("YYYY-MM-DD hh:mm:ss A");
                                        } else {
                                            resobj.NEW_VALUE = reqMoment(resobj.NEW_VALUE).format("YYYY-MM-DD hh:mm:ss A");
                                        }
                                        console.log(resobj.NEW_VALUE, '====== After ======');
                                    }
                                    arrAuditInfo.push(resobj);
                                }
                                objResult.AuditData = JSON.stringify(arrAuditInfo);
                                objResult.RecordsPerPage = strRecordsPerPage;
                                objResult.CurrentPage = strCurrentPageNo;
                                objResult.TotalItems = result.response.numFound;
                                _PrintInfo('No of document found - ' + result.response.numFound);
                                return reqInstanceHelpr.SendResponse('GetAuditLogInfo', appResponse, objResult, objLogInfo, '', '', null);
                            }
                        });
                    } else {
                        objResult.AuditData = JSON.stringify(arrAuditInfo);
                        objResult.RecordsPerPage = strRecordsPerPage;
                        objResult.CurrentPage = strCurrentPageNo;
                        objResult.TotalItems = "0";
                        _PrintInfo('No of document found - 0');
                        return reqInstanceHelpr.SendResponse('GetAuditLogInfo', appResponse, objResult, objLogInfo, '', '', null);
                    }
                }
            });
        }

        function isDate(_date) {
            const _regExp = new RegExp('^(-?(?:[1-9][0-9]*)?[0-9]{4})-(1[0-2]|0[1-9])-(3[01]|0[1-9]|[12][0-9])T(2[0-3]|[01][0-9]):([0-5][0-9]):([0-5][0-9])(.[0-9]+)?(Z)?$');
            return _regExp.test(_date);
        }

        function __GetTranID() {
            var objSelTran = JSON.parse(strSelTran);
            strItemId = objSelTran[strKeyCol.toLowerCase()];
        }

        function _PrintError(pMessage, pErrorCode) {
            reqInstanceHelpr.PrintError('GetAuditLogInfo', pMessage, pErrorCode, objLogInfo);
        }

        function _PrintInfo(pMessage) {
            reqInstanceHelpr.PrintInfo('GetAuditLogInfo', pMessage, objLogInfo);
        }
    });
});

module.exports = router;