/****
  @Descriptions                 : Listing Template Information  
  @Last_Error_Code              : ERR-ListTemplate-0002
 ****/


var reqExpress = require('express');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var router = reqExpress.Router();
var reqTranDBHelper = require('../../../../torus-references/instance/TranDBInstance');
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqDateFormatter = require('../../../../torus-references/common/dateconverter/DateFormatter');
var reqDateFormat = require('../../../../node_modules/dateformat');
var serviceName = 'GetCommProcessData';

router.post('/GetCommProcessData', function (appRequest, appResponse) {
    try {
        var pHeader = appRequest.headers;
        var objLogInfo = {};
        var clientParams = appRequest.body.PARAMS;
        reqTranDBHelper.GetTranDBConn(pHeader, false, function (TranDbsession) {
            reqLogInfo.AssignLogInfoDetail(appRequest, function (pLogInfo, pSessionInfo) {
                objLogInfo = pLogInfo;
                //  Get comm process data 
                var TENANT_ID = pSessionInfo.TENANT_ID

                var cond;
                if (clientParams.FROM_DATE != '' && clientParams.TO_DATE == '') {
                    // cond = __AppendCriteria('CREATED_DATE', reqDateFormat(clientParams.FROM_DATE, "yyyy-mm-dd'hh:MM:00Z'"), '')
                    cond = __AppendCriteria('CREATED_DATE', reqDateFormat(clientParams.FROM_DATE), '')
                } else if (clientParams.FROM_DATE != '' && clientParams.TO_DATE != '' && clientParams.FROM_DATE != null && clientParams.TO_DATE != null) {
                    cond = __AppendCriteria('CREATED_DATE', reqDateFormat(clientParams.FROM_DATE), reqDateFormat(clientParams.TO_DATE))
                    // cond = __AppendCriteria('CREATED_DATE', reqDateFormat(clientParams.FROM_DATE, "yyyy-mm-dd'T00:00:00Z'"), reqDateFormat(clientParams.TO_DATE, "yyyy-mm-dd'T00:00:00Z'"))
                }
                var strQry;
                if (clientParams.Is_Search == 'Y') {
                    if (clientParams.COMMMG_CODE != '') {
                        strQry = `select * from comm_process_data where tenant_id='${TENANT_ID}' AND COMMMG_CODE='${clientParams.COMMMG_CODE}'`
                    } else {
                        strQry = `select * from comm_process_data where tenant_id='${TENANT_ID}'`
                    }
                    if (cond) {
                        strQry = `${strQry} AND ${cond}`;
                    }
                    strQry = `${strQry} order by commpd_id desc`
                } else {
                    strQry = `select * from comm_process_data where tenant_id='${TENANT_ID}' order by commpd_id desc`
                }
                reqTranDBHelper.ExecuteSQLQuery(TranDbsession, strQry, objLogInfo, function callbackGetTransactionData(res, pCount, err) {
                    if (err)
                        reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-GetCommProcessData-890001', 'Catch Error in COMM PROCES DATA TABLE ....', err, 'FAILURE', '');
                    else {

                        if (res && res.rows.length) {
                            var result = res.rows;
                            var obj = {};
                            var rows = [];
                            for (var i = 0; i < result.length; i++) {
                                obj = {};
                                obj.commmg_code = result[i].commmg_code;
                                obj.commpd_id = result[i].commpd_id;
                                obj.is_processed = result[i].is_processed;
                                obj.prct_id = result[i].prct_id;
                                obj.comments = result[i].comments;
                                obj.created_date = convertDate(result[i].created_date);
                                rows.push(obj);
                            }
                            reqInstanceHelper.SendResponse(serviceName, appResponse, rows, objLogInfo, '', '', '', '', '');
                        } else {
                            res = {};
                            res.rows = [];
                            reqInstanceHelper.SendResponse(serviceName, appResponse, res, objLogInfo, '', '', '', '', '');
                        }


                    }
                })
            });
        })
    } catch (error) {
        reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-GetCommProcessData-890002', 'Catch Error in ListTemplate API....', error, 'FAILURE', '');
    }


    function convertDate(pDate) {
        try {
            if (pDate) {
                var Restr = reqDateFormat(pDate, "yyyy-mm-dd hh:MM:ss TT");
                return Restr;
            } else {
                return pDate;
            }

        } catch (error) {
            reqInstanceHelper.PrintInfo('GETATMTDETAILS', 'Error While Converting a Date - ' + pDate, objLogInfo);
        }
    }


    function __AppendCriteria(pColumn, pValue, pValue1) {
        var pWhereCond
        if (pColumn === 'CREATED_DATE') {
            if (pValue1 == '' || pValue1 == undefined || pValue1 == null) { // ordinary column
                pWhereCond = ' ' + pColumn + " BETWEEN '" + __ToDate(pValue) + "'  AND '" + __ToDate(pValue) + "'";    
                // pWhereCond = ' ' + pColumn + " BETWEEN '" + __ToDate(reqDateFormat(pValue, "yyyy-mm-dd hh:MM:ss TT")) + "'  AND '" + __ToDate(reqDateFormat(pValue, "yyyy-mm-dd hh:MM:ss TT")) + "'";
            } else { // Date between
                // pWhereCond = ' ' + pColumn + " BETWEEN '" + __ToDate(reqDateFormat(pValue, "yyyy-mm-dd hh:MM:ss")) + "'  AND '" + __ToDate(reqDateFormat(pValue1, "yyyy-mm-dd hh:MM:ss TT")) + "'";
                pWhereCond = ' ' + pColumn + " BETWEEN '" + __ToDate(pValue) + "'  AND '" + __ToDate(pValue1) + "'";
            }
        }
        return pWhereCond
    }

    function __ToDate(pDate) {
        return reqDateFormatter.ConvertDate(pDate, pHeader);
    }


});

module.exports = router;