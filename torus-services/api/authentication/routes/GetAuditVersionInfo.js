/**
 * Api_Name         : /GetAuditVersionInfo
 * Description      : To search the auditlog version info from GSS_AUDITLOG_VERSION_CORE
 * Last Error_Code  : ERR-AUT-15002
 */

// Require dependencies
var modPath = '../../../../node_modules/';
var refPath = '../../../../torus-references/';
var reqExpress = require(modPath + 'express');
var reqMoment = require('moment');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqAuditLog = require('../../../../torus-references/log/audit/AuditLog');
var reqSolrInstance = require('../../../../torus-references/instance/SolrInstance');
var reqInstanceHelpr = require('../../../../torus-references/common/InstanceHelper');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');

// Initialize Global variables
var router = reqExpress.Router();
var serviceName = 'GetAuditVersionInfo';

// Host the auditlog api
router.post('/GetAuditVersionInfo', function callbackCpsignin(appRequest, appResponse) {
    var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
    reqLogInfo.AssignLogInfoDetail(appRequest, function callbackAssignLogInfoDetail(pLogInfo, pSessionInfo) {
        var pHeaders = appRequest.headers;
        var objResult = {};
        var strSelTran = appRequest.body.PARAMS.SELECTED_TRAN;
        var strDTCODE = appRequest.body.PARAMS.DT_CODE;
        var strDTTCODE = appRequest.body.PARAMS.DTT_CODE;
        var strKeyCol = appRequest.body.PARAMS.PRIMARY_COLUMN;
        var prct_id = appRequest.body.PARAMS.PRCT_ID;
        var strItemId = '';
        var strRecordsPerPage = '1000';//appRequest.body.PARAMS.RECORDS_PER_PAGE;//'1000';
        var strCurrentPageNo = '1';//appRequest.body.PARAMS.CURRENT_PAGE;//'1';
        var objLogInfo = {};
        var DB_Type = '';
        objLogInfo = pLogInfo;
        objLogInfo.HANDLER_CODE = 'GetAuditVersion serach-Authentication';

        var versionCore = "AUDITLOG_VERSION_CORE";
        if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
            versionCore = "TRAN_VERSION";
        }

        GetSolrSearchResult();

        function GetSolrSearchResult() {

            __GetTranID();
            // strItemId = 1628
            var strCriteria = '(DT_CODE:' + strDTCODE + ' AND DTT_CODE:' + strDTTCODE + ' AND TRN_ID:' + strItemId + ')';
            if (prct_id) {
                strCriteria = '(PRCT_ID:' + prct_id + ')';
            }
            _PrintInfo('Solr Searchparam as : ' + strCriteria);
            reqSolrInstance.LogSolrSearchWithPaging(pHeaders, versionCore, strCriteria, strRecordsPerPage, strCurrentPageNo, function callbackLogSolrSearchWithPaging(result, err) {
                if (err) {
                    reqInstanceHelpr.SendResponse(serviceName, appResponse, objResult, objLogInfo, 'ERR-AUT-15001', 'Error on querying solr', err);
                }
                else {
                    var arrVersionInfo = [];
                    if (result.response && result.response.docs && result.response.docs.length) {
                        var tranDBKey = 'TRANDB~' + pHeaders.routingkey;
                        reqAuditLog.GetDBType(tranDBKey, false, objLogInfo, function (DB_TYPE, error) {
                            if (error) {
                                reqInstanceHelpr.PrintInfo(serviceName, 'Error while Getting data For this Redis Key - ' + tranDBKey, objLogInfo);
                                reqInstanceHelpr.PrintInfo(serviceName, 'Error - ' + error, objLogInfo);
                                reqInstanceHelpr.SendResponse(serviceName, appResponse, objResult, objLogInfo, 'ERR-AUT-15002', 'Error while Getting data For this Redis Key - ' + tranDBKey, error);
                            } else {
                                DB_Type = DB_TYPE;
                                for (var i = 0; i < result.response.docs.length; i++) {
                                    var resobj = {
                                        "DTT_CODE": (result.response.docs[i].DTT_CODE instanceof Array) ? result.response.docs[i].DTT_CODE[0] : result.response.docs[i].DTT_CODE,
                                        "DT_CODE": (result.response.docs[i].DT_CODE instanceof Array) ? result.response.docs[i].DT_CODE[0] : result.response.docs[i].DT_CODE,
                                        "DTT_DESCRIPTION": (result.response.docs[i].DTT_DESCRIPTION instanceof Array) ? result.response.docs[i].DTT_DESCRIPTION[0] : result.response.docs[i].DTT_DESCRIPTION,
                                        "DT_DESCRIPTION": (result.response.docs[i].DT_DESCRIPTION instanceof Array) ? result.response.docs[i].DT_DESCRIPTION[0] : result.response.docs[i].DT_DESCRIPTION,
                                        "TRN_ID": result.response.docs[i].TRN_ID,
                                        "VERSION_NO": result.response.docs[i].VERSION_NO,
                                        "CREATED_BY": result.response.docs[i].CREATED_BY,
                                        "CREATED_DATE": ToDate(result.response.docs[i].CREATED_DATE),
                                        "PRCT_ID": result.response.docs[i].PRCT_ID
                                    };
                                    var oldData = result.response.docs[i].OLD_DATA ? JSON.parse(result.response.docs[i].OLD_DATA) : {};
                                    for (var key in oldData) {
                                        if (isDate(oldData[key])) {
                                            console.log(oldData[key], '====== ' + key + ' Before ======');
                                            if (DB_Type == 'POSTGRES') {
                                                oldData[key] = reqMoment.utc(oldData[key]).format("YYYY-MM-DD hh:mm:ss A");
                                            } else {
                                                oldData[key] = reqMoment(oldData[key]).format('YYYY-MM-DD hh:mm:ss A');
                                            }
                                            console.log(oldData[key], '===== ' + key + ' After =======');
                                        }
                                    }
                                    var newData = JSON.parse(result.response.docs[i].NEW_DATA);
                                    for (var key in newData) {
                                        if (isDate(newData[key])) {
                                            console.log(newData[key], '====== ' + key + ' Before ======');
                                            if (DB_Type == 'POSTGRES') {
                                                newData[key] = reqMoment.utc(newData[key]).format("YYYY-MM-DD hh:mm:ss A");
                                            } else {
                                                newData[key] = reqMoment(newData[key]).format('YYYY-MM-DD hh:mm:ss A');
                                            }
                                            console.log(newData[key], '=====' + key + ' After =======');
                                        }
                                    }
                                    resobj.OLD_DATA = JSON.stringify(oldData);
                                    resobj.NEW_DATA = JSON.stringify(newData);
                                    arrVersionInfo.push(resobj);
                                }
                                objResult.AuditVersionData = JSON.stringify(arrVersionInfo);
                                objResult.RecordsPerPage = strRecordsPerPage;
                                objResult.CurrentPage = strCurrentPageNo;
                                objResult.TotalItems = result.response.numFound;
                                _PrintInfo('No of document found - ' + result.response.numFound);
                                return reqInstanceHelpr.SendResponse('GetAuditVersionInfo', appResponse, objResult, objLogInfo, '', '', null);
                            }
                        });

                    } else {
                        objResult.AuditVersionData = JSON.stringify(arrVersionInfo);
                        objResult.RecordsPerPage = strRecordsPerPage;
                        objResult.CurrentPage = strCurrentPageNo;
                        objResult.TotalItems = "0";
                        _PrintInfo('No of document found - 0');
                        return reqInstanceHelpr.SendResponse('GetAuditVersionInfo', appResponse, objResult, objLogInfo, '', '', null);
                    }
                }
            });
        }

        function isDate(_date) {
            const _regExp = new RegExp('^(-?(?:[1-9][0-9]*)?[0-9]{4})-(1[0-2]|0[1-9])-(3[01]|0[1-9]|[12][0-9])T(2[0-3]|[01][0-9]):([0-5][0-9]):([0-5][0-9])(.[0-9]+)?(Z)?$');
            return _regExp.test(_date);
        }

        // Convert string to Date format
        function ToDate(pDate) {
            var Restr = '';
            if (DB_Type == 'POSTGRES') {
                Restr = reqMoment.utc(pDate).format("YYYY-MM-DD hh:mm:ss A");
            } else {
                Restr = reqMoment(pDate).format('YYYY-MM-DD hh:mm:ss A');
            }
            return Restr;
        }

        function __GetTranID() {
            if (strSelTran) {
                var objSelTran = JSON.parse(strSelTran);
                strItemId = objSelTran[strKeyCol.toLowerCase()];
            }
        }

        function _PrintError(pErrCode, pErrMessage, pError) {
            reqInstanceHelpr.PrintError('GetAuditVersionInfo', pError, pErrCode, objLogInfo, pErrMessage);
        }

        function _PrintInfo(pMessage) {
            reqInstanceHelpr.PrintInfo('GetAuditVersionInfo', pMessage, objLogInfo);
        }

    });
});

module.exports = router;