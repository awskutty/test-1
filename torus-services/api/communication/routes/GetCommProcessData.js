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
        var needTenant = clientParams.is_Tenant;
        var needAppId = clientParams.is_AppId
        var from_date = clientParams.FROM_DATE;
        var to_date = clientParams.TO_DATE
        var strRecordsPerPage = '10';
        var strCurrentPageNo = clientParams.CURRENT_PAGE || 1;
        var results = {}
        reqTranDBHelper.GetTranDBConn(pHeader, false, function (TranDbsession) {
            reqLogInfo.AssignLogInfoDetail(appRequest, function (pLogInfo, pSessionInfo) {
                objLogInfo = pLogInfo;
                //  Get comm process data 
                var TENANT_ID = objLogInfo.TENANT_ID;
                var APP_ID = objLogInfo.APP_ID;

                // var cond;
                // if (clientParams.FROM_DATE != '' && clientParams.TO_DATE == '') {
                //     // cond = __AppendCriteria('CREATED_DATE', reqDateFormat(clientParams.FROM_DATE, "yyyy-mm-dd'hh:MM:00Z'"), '')
                //     // cond = __AppendCriteria('CREATED_DATE', reqDateFormat(clientParams.FROM_DATE), '')
                //     cond = `TO_DATE(TO_CHAR(CREATED_DATE, 'DD-MON-YY hh:mi:ss PM'), 'DD-MON-YY hh:mi:ss PM')>=  TO_DATE(TO_CHAR(cast('${clientParams.FROM_DATE}' as TIMESTAMP),'DD-MON-YY hh:mi:ss PM'),'DD-MON-YY hh:mi:ss PM')`;
                // } else if (clientParams.FROM_DATE != '' && clientParams.TO_DATE != '' && clientParams.FROM_DATE != null && clientParams.TO_DATE != null) {
                //     // cond = __AppendCriteria('CREATED_DATE', reqDateFormat(clientParams.FROM_DATE), reqDateFormat(clientParams.TO_DATE));
                //     // cond = __AppendCriteria('CREATED_DATE', reqDateFormat(clientParams.FROM_DATE, "yyyy-mm-dd'T00:00:00Z'"), reqDateFormat(clientParams.TO_DATE, "yyyy-mm-dd'T00:00:00Z'"))
                //     cond = `TO_DATE(TO_CHAR(CREATED_DATE, 'DD-MON-YY hh:mi:ss PM'), 'DD-MON-YY hh:mi:ss PM')>=  TO_DATE(TO_CHAR(cast('${clientParams.FROM_DATE}' as TIMESTAMP),'DD-MON-YY hh:mi:ss PM'),'DD-MON-YY hh:mi:ss PM')
                //     AND TO_DATE(TO_CHAR(CREATED_DATE, 'DD-MON-YY hh:mi:ss PM'), 'DD-MON-YY hh:mi:ss PM')>=  TO_DATE(TO_CHAR(cast('${clientParams.TO_DATE}' as TIMESTAMP),'DD-MON-YY hh:mi:ss PM'),'DD-MON-YY hh:mi:ss PM')`;
                // }
                // prepare where condition for created_date 
                if (clientParams.GROUP_CODE !== '') {
                    var cond = reqDateFormatter.GetSearchCriteriaForUTC(pHeader, objLogInfo, 'cpd.CREATED_DATE', from_date, to_date);
                } else {
                    var cond = reqDateFormatter.GetSearchCriteriaForUTC(pHeader, objLogInfo, 'cpd.CREATED_DATE', from_date, to_date);
                }
                var strQry;
                if (clientParams.Is_Search == 'Y') {
                    if (clientParams.COMMMG_CODE != '') {
                        strQry = `select * from comm_process_data where COMMMG_CODE='${clientParams.COMMMG_CODE}'`;
                    }
                    // where tenant_id='${TENANT_ID}' AND app_id='${APP_ID}'
                    if (needTenant && clientParams.COMMMG_CODE != '') {
                        strQry = `${strQry} AND tenant_id='${TENANT_ID}'`
                    }

                    if (needAppId && clientParams.COMMMG_CODE != '') {
                        strQry = `${strQry} AND app_id='${APP_ID}'`
                    }

                    // if (clientParams.COMMMG_CODE == '') {
                    //     strQry = `select * from comm_process_data`
                    //     if (needTenant && needAppId) {
                    //         strQry = `${strQry} where tenant_id='${TENANT_ID}' AND app_id='${APP_ID}'`
                    //     } else if (needTenant && !needAppId) {
                    //         strQry = `${strQry} where tenant_id='${TENANT_ID}'`
                    //     } else if (!needTenant && needAppId) {
                    //         strQry = `${strQry} where app_id='${APP_ID}'`
                    //     }
                    // }

                    if (clientParams.GROUP_CODE == '') {
                        strQry = `select cpd.commmg_code,cpd.created_by_name,cpd.commpd_id,cpd.prct_id,cpd.is_processed,cpm.type,
                        cpm.attempt_count, cpm.commmt_code, cpm.status,cpm.comm_msg_id,ci.comm_description, ci.retry_count
                        from comm_process_data cpd left join comm_process_message cpm on cpd.prct_id = cpm.prct_id inner join 
                        dep_tran.comm_info ci on ci.commmt_code = cpm.commmt_code`
                        if (needTenant && needAppId) {
                            strQry = `${strQry} where cpd.tenant_id='${TENANT_ID}' AND cpd.app_id='${APP_ID}'`
                        } else if (needTenant && !needAppId) {
                            strQry = `${strQry} where cpd.tenant_id='${TENANT_ID}'`
                        } else if (!needTenant && needAppId) {
                            strQry = `${strQry} where cpd.app_id='${APP_ID}'`
                        }
                    }


                    if (clientParams.GROUP_CODE !== '' && clientParams.COMM_TYPES !== '' && clientParams.STATUS !== '') {
                        strQry = `select cpd.commmg_code,cpd.created_by_name,cpd.commpd_id,cpd.prct_id,cpd.is_processed,cpm.type,
                        cpm.attempt_count, cpm.commmt_code, cpm.status,cpm.comm_msg_id,ci.comm_description, ci.retry_count
                        from comm_process_data cpd left join comm_process_message cpm on cpd.prct_id = cpm.prct_id inner join 
                        dep_tran.comm_info ci on ci.commmt_code = cpm.commmt_code
                         where cpd.commmg_code = '${clientParams.GROUP_CODE}' and cpm.type = '${clientParams.COMM_TYPES}' and cpm.status ='${clientParams.STATUS}'`
                        if (needTenant && needAppId) {
                            strQry = `${strQry} AND cpd.tenant_id='${TENANT_ID}' AND cpd.app_id='${APP_ID}'`
                        } else if (needTenant && !needAppId) {
                            strQry = `${strQry} AND cpd.tenant_id='${TENANT_ID}'`
                        } else if (!needTenant && needAppId) {
                            strQry = `${strQry} AND cpd.app_id='${APP_ID}'`
                        }
                    }


                    if (clientParams.GROUP_CODE !== '' && clientParams.COMM_TYPES !== '' && clientParams.STATUS == '') {
                        strQry = `select cpd.commmg_code,cpd.created_by_name,cpd.commpd_id,cpd.prct_id,cpd.is_processed,cpm.type,
                        cpm.attempt_count, cpm.commmt_code, cpm.status,cpm.comm_msg_id,ci.comm_description, ci.retry_count
                        from comm_process_data cpd left join comm_process_message cpm on cpd.prct_id = cpm.prct_id inner join 
                        dep_tran.comm_info ci on ci.commmt_code = cpm.commmt_code
                         where cpd.commmg_code = '${clientParams.GROUP_CODE}' and cpm.type = '${clientParams.COMM_TYPES}'`
                        if (needTenant && needAppId) {
                            strQry = `${strQry} AND cpd.tenant_id='${TENANT_ID}' AND cpd.app_id='${APP_ID}'`
                        } else if (needTenant && !needAppId) {
                            strQry = `${strQry} AND cpd.tenant_id='${TENANT_ID}'`
                        } else if (!needTenant && needAppId) {
                            strQry = `${strQry} AND cpd.app_id='${APP_ID}'`
                        }
                    }




                    // if (cond) {
                    //     if (!needTenant && !needAppId) {
                    //         strQry = `${strQry} where ${cond}`;
                    //     } else {
                    //         strQry = `${strQry} AND ${cond}`;
                    //     }
                    // }

                    if (cond) {
                        if (!needTenant && !needAppId) {
                            strQry = `${strQry} AND ${cond}`;
                        } else {
                            strQry = `${strQry} AND ${cond}`;
                        }
                    }
                    strQry = `${strQry} order by commpd_id desc`;
                } else {
                    var order = 'order by commpd_id desc'
                    strQry = `select * from comm_process_data where`;
                    if (needAppId && needTenant) {
                        strQry = ` ${strQry} app_id='${APP_ID}' AND tenant_id='${TENANT_ID}`;
                    } else if (needAppId && !needTenant) {
                        strQry = ` ${strQry} app_id='${APP_ID}'`;
                    } else if (!needAppId && needTenant) {
                        strQry = ` ${strQry} tenant_id='${TENANT_ID}'`;
                    } else {
                        strQry = `select * from comm_process_data`;
                    }
                    strQry = `${strQry} ${order}`

                }
                reqTranDBHelper.ExecuteQueryWithPagingCount(TranDbsession, strQry, strCurrentPageNo, strRecordsPerPage, objLogInfo, function callbackGetTransactionData(res, pCount, err) {
                    if (err)
                        reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-GetCommProcessData-890001', 'Catch Error in COMM PROCES DATA TABLE ....', err, 'FAILURE', '');
                    else {

                        if (res && res.length) {
                            var result = res;
                            var obj = {};
                            var rows = [];
                            for (var i = 0; i < result.length; i++) {
                                obj = {};
                                obj.commmg_code = result[i].commmg_code;
                                obj.created_by_name = result[i].created_by_name;
                                obj.prct_id = result[i].prct_id;
                                obj.type = result[i].type;
                                obj.attempt_count = result[i].attempt_count + "/" + result[i].retry_count;
                                obj.commmt_code = result[i].commmt_code;
                                obj.status = result[i].status;
                                obj.comm_msg_id = result[i].comm_msg_id
                                // obj.created_date = convertDate(result[i].created_date);
                                obj.created_date = result[i].created_date;
                                rows.push(obj);
                            }
                            var resdata = reqInstanceHelper.ArrKeyToUpperCase(rows, objLogInfo)
                            results.data = resdata;
                            results.TotalRecords = pCount[0].count;
                            reqInstanceHelper.SendResponse(serviceName, appResponse, results, objLogInfo, '', '', '', '', '');
                        } else {
                            res = {};
                            res = [];
                            reqInstanceHelper.SendResponse(serviceName, appResponse, res, objLogInfo, '', '', '', '', '');
                        }


                    }
                });
            });
        });
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
        var pWhereCond;
        if (pColumn === 'CREATED_DATE') {
            if (pValue1 == '' || pValue1 == undefined || pValue1 == null) { // ordinary column
                pWhereCond = ' ' + pColumn + " BETWEEN '" + __ToDate(pValue) + "'  AND '" + __ToDate(pValue) + "'";
                // pWhereCond = ' ' + pColumn + " BETWEEN '" + __ToDate(reqDateFormat(pValue, "yyyy-mm-dd hh:MM:ss TT")) + "'  AND '" + __ToDate(reqDateFormat(pValue, "yyyy-mm-dd hh:MM:ss TT")) + "'";
            } else { // Date between
                // pWhereCond = ' ' + pColumn + " BETWEEN '" + __ToDate(reqDateFormat(pValue, "yyyy-mm-dd hh:MM:ss")) + "'  AND '" + __ToDate(reqDateFormat(pValue1, "yyyy-mm-dd hh:MM:ss TT")) + "'";
                pWhereCond = ' ' + pColumn + " BETWEEN '" + __ToDate(pValue) + "'  AND '" + __ToDate(pValue1) + "'";
            }
        }
        return pWhereCond;
    }

    function __ToDate(pDate) {
        return reqDateFormatter.ConvertDate(pDate, pHeader);
    }


});

module.exports = router;