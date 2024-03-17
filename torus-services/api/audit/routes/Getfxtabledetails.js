var reqExpress = require('express');
var router = reqExpress.Router();
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var serviceName = 'GetfxtableDetails'

router.post('/GetfxtableDetails', function (appRequest, appResponse) {
    try {
        var mHeaders = appRequest.headers
        var Params = appRequest.body.PARAMS
        var mode = Params.MODE
        var KeyColumn
        var strRecordsPerPage = '10';
        var strCurrentPageNo = appRequest.body.PARAMS.CURRENT_PAGENO || 1;
        var query
        var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
        var versionCore = "AUDITLOG_VERSION_CORE";
        if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
            versionCore = "TRAN_VERSION";
        }
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
            reqDBInstance.GetFXDBConnection(mHeaders, 'clt_cas', objLogInfo, function (clt_cas_instance) {
                reqDBInstance.GetTableFromFXDB(clt_cas_instance, 'tenant_setup', [], {
                    category: 'FX_TABLES',
                    tenant_id: objLogInfo.TENANT_ID
                }, objLogInfo, function (pError, result) {
                    if (pError) {
                        reqInstanceHelper.SendResponse(serviceName, appResponse, pError, objLogInfo, 'ERR-AUDIT-130001', 'Exception Error Occured', '', '', pError);
                    } else {
                        var Result = JSON.parse(result.rows[0].setup_json)
                        var Json_value = Result['FX_TABLES']
                        var Tablearray = []
                        for (let i = 0; i < Json_value.length; i++) {
                            if (Json_value[i]['table_name'] == Params.table_name) {
                                query = `${Json_value[i]['query']}`
                                KeyColumn = Json_value[i]['key_coloumn'];
                                break;
                            }
                        }
                        if (Params.IS_SEARCH == 'Y') {
                            var StartDate = Params['FILTERS']['DATE_BETWEEN'].START_DATE || ''
                            var EndDate = Params['FILTERS']['DATE_BETWEEN'].END_DATE || ''
                            var Tran_id = Params['FILTERS']['DATE_BETWEEN'].Tran_Id || ''

                            var addquery = ''
                            var pcond = {}
                            if (StartDate && !EndDate) {
                                pcond.date = ` CREATED_DATE >= To_DATE('${StartDate}', 'yyyy-mm/dd')`
                            } else if (!StartDate && EndDate) {
                                pcond.date = ` CREATED_DATE <= To_DATE('${EndDate}', 'yyyy-mm/dd') `
                            } else if (StartDate && EndDate) {
                                // between
                                pcond.date = `CREATED_DATE between TO_DATE ('${StartDate}', 'yyyy-mm/dd') AND TO_DATE ('${EndDate}', 'yyyy-mm/dd') `
                            }
                            if (Tran_id) {
                                pcond.trnid = `${KeyColumn} = '${Tran_id}'`
                            }
                            for (var i in pcond) {
                                addquery += pcond[i] + "and"
                            }
                            if (Tran_id != '' || StartDate != '' || EndDate != '') {
                                addquery = addquery.slice(0, -3)
                                query = query + "  WHERE " + addquery
                            } else {
                                query = query
                            }

                        } else {
                            query = query
                        }

                        if (serviceModel.AUDIT_ARCHIVAL_MODEL == "DB") {
                            // Get the data from database
                            if (!mode || mode == "LIVE") {
                                reqTranDBInstance.GetTranDBConn(mHeaders, false, function (pSession) {
                                    GetDatafromDB(pSession)
                                })
                            } else {
                                reqDBInstance.GetFXDBConnection(mHeaders, 'arc_tran_db', objLogInfo, function (pSession) {
                                    GetDatafromDB(pSession)
                                })
                            }
                        }


                    }
                })
            })


            function GetDatafromDB(dbsession) {
                query = query + ' order by created_date desc'
                reqTranDBInstance.ExecuteQueryWithPagingCount(dbsession, query, strCurrentPageNo, strRecordsPerPage, objLogInfo, function (res, pCount, err) {
                    if (err) {
                        reqInstanceHelper.SendResponse(serviceName, appResponse, err, objLogInfo, 'ERR-AUDIT-100001', 'Exception occured', '', '', err);
                    } else {
                        if (res.length > 0) {
                            var resdata = reqInstanceHelper.ArrKeyToUpperCase(res, objLogInfo)
                            PrepareHeadersData(resdata, function (res, err) {
                                if (res.length > 0) {
                                    var FxdetailsRes = {
                                        HeaderInfo: res,
                                        ExchangeData: resdata,
                                        TotalRecords: pCount[0].count,
                                        Primary_key: KeyColumn
                                    }
                                    reqInstanceHelper.SendResponse(serviceName, appResponse, FxdetailsRes, objLogInfo, 'SUCCESS', '', '', '', '');
                                } else {
                                    reqInstanceHelper.SendResponse(serviceName, appResponse, err, objLogInfo, 'ERROR', '', '', '', '');
                                }
                            })
                        } else {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, 'No Data Found in Table', objLogInfo, 'No Data Found', '', '', '', '');
                        }
                    }
                })

            }

            function PrepareHeadersData(responsedata, callback) {
                try {
                    var HeadersData = []
                    var HeadersKey = Object.keys(responsedata[0])
                    for (let i = 0; i < HeadersKey.length; i++) {
                        var HeaderObj = {}
                        HeaderObj.header = HeadersKey[i].replaceAll('_', ' ')
                        HeaderObj.field = HeadersKey[i]
                        HeadersData.push(HeaderObj)

                    }
                    callback(HeadersData)
                } catch (err) {
                    reqInstanceHelper.SendResponse(serviceName, appResponse, err, objLogInfo, 'ERROR', '', '', '', '');
                }
            }
        })

    } catch (error) {

    }
});
module.exports = router