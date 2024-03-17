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
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');

// Initialize Global variables
var router = reqExpress.Router();
var serviceName = 'GetAuditVersionInfo';

// Host the auditlog api
router.post('/GetAuditVersionInfo', function callbackCpsignin(appRequest, appResponse) {
    var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
    reqLogInfo.AssignLogInfoDetail(appRequest, function callbackAssignLogInfoDetail(pLogInfo, pSessionInfo) {
        var pHeaders = appRequest.headers;
        var objResult = {};
        objResult.HeaderInfo = [
            { field: 'VERSION_NO', header: 'Version No', data_type: 'NUMBER' },
            { field: 'TRN_ID', header: 'Tran Id', data_type: 'STRING' },
            { field: 'PRCT_ID', header: 'Prct Id', data_type: 'NUMBER' },
            { field: 'DTT_DESCRIPTION', header: 'Form Name', data_type: 'STRING' },
            { field: 'CREATED_BY', header: 'Modified By', data_type: 'STRING' },
            { field: 'CREATED_DATE', header: 'Modified Date', data_type: 'DATETIME' }
        ];

        var systemColumns = ['created_by', 'created_tz', 'created_tz_offset', 'created_by_sessionid',
            'created_by_sts_id', 'routingkey', 'app_id', 'created_date_utc', 'tenant_id',
            'modified_by', 'modified_tz', 'modified_tz_offset', 'modified_by_sessionid',
            'modified_date_utc', 'dtt_code', 'dt_code', 'version_no', 'dt_description', 'dtt_description']



        var strSolrFields = [];
        for (let r = 0; r < objResult.HeaderInfo.length; r++) {
            const headerObj = objResult.HeaderInfo[r];
            if (headerObj.field) {
                strSolrFields.push(headerObj.field);
            }
        }
        var strSelTran = appRequest.body.PARAMS.SELECTED_TRAN;
        var strDTCODE = appRequest.body.PARAMS.DT_CODE;
        var strDTTCODE = appRequest.body.PARAMS.DTT_CODE;
        var strKeyCol = appRequest.body.PARAMS.PRIMARY_COLUMN;
        var prct_id = appRequest.body.PARAMS.PRCT_ID;
        var needFullJson = appRequest.body.PARAMS.NEED_FULL_JSON;
        var mode = appRequest.body.PARAMS.MODE;
        var getFx = appRequest.body.PARAMS.GETFX;
        var targetTable = appRequest.body.PARAMS.TARGET_TABLE
        var selectchange = appRequest.body.PARAMS.selectionChange;
        if (needFullJson) {
            strSolrFields.push('NEW_DATA');
            strSolrFields.push('OLD_DATA');
        }
        strSolrFields.push('DT_CODE');
        strSolrFields.push('DT_DESCRIPTION');
        strSolrFields.push('DTT_CODE');

        var strItemId = '';
        var strVersionNumber = '';
        var strRecordsPerPage = '1000';//appRequest.body.PARAMS.RECORDS_PER_PAGE;//'1000';
        var strCurrentPageNo = '1';//appRequest.body.PARAMS.CURRENT_PAGE;//'1';
        var objLogInfo = {};
        var DB_Type = '';
        var SearcFrom = ''
        objLogInfo = pLogInfo;
        objLogInfo.HANDLER_CODE = 'GetAuditVersion serach-Authentication';

        var versionCore = "AUDITLOG_VERSION_CORE";
        if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
            versionCore = "TRAN_VERSION";
        }
        if (getFx && selectchange) {
            if (strSelTran) {
                var objSelTran = JSON.parse(strSelTran);
                strItemId = objSelTran[strKeyCol];
                strVersionNumber = objSelTran['VERSION_NO'] || '';
            }

        } else {
            __GetTranID();
        }




        // serviceModel.AUDIT_ARCHIVAL_MODEL = "SOLR"
        if (serviceModel.AUDIT_ARCHIVAL_MODEL == "DB") {
            // Get the data from database
            if (!mode || mode == "LIVE") {
                reqTranDBInstance.GetTranDBConn(pHeaders, false, function (dbsession) {
                    GetDatafromDB(dbsession)
                })
            } else {
                reqDBInstance.GetFXDBConnection(pHeaders, 'arc_tran_db', objLogInfo, function (dbsession) {
                    GetDatafromDB(dbsession)
                })
            }
        } else {
            // Get the data from solr
            GetSolrSearchResult();
        }



        function GetSolrSearchResult() {
            // strItemId = 1628
            if (strVersionNumber && needFullJson) {
                strVersionNumber = ' AND VERSION_NO: ' + strVersionNumber;
            }
            else {
                strVersionNumber = '';
            }
            var strCriteria = '(DT_CODE:' + strDTCODE + ' AND DTT_CODE:' + strDTTCODE + ' AND TRN_ID:' + strItemId + strVersionNumber + ')';
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
                                //DB_Type = DB_TYPE;


                                // for (var i = 0; i < result.response.docs.length; i++) {
                                //     var resobj = {
                                //         "DTT_CODE": (result.response.docs[i].DTT_CODE instanceof Array) ? result.response.docs[i].DTT_CODE[0] : result.response.docs[i].DTT_CODE,
                                //         "DT_CODE": (result.response.docs[i].DT_CODE instanceof Array) ? result.response.docs[i].DT_CODE[0] : result.response.docs[i].DT_CODE,
                                //         "DTT_DESCRIPTION": (result.response.docs[i].DTT_DESCRIPTION instanceof Array) ? result.response.docs[i].DTT_DESCRIPTION[0] : result.response.docs[i].DTT_DESCRIPTION,
                                //         "DT_DESCRIPTION": (result.response.docs[i].DT_DESCRIPTION instanceof Array) ? result.response.docs[i].DT_DESCRIPTION[0] : result.response.docs[i].DT_DESCRIPTION,
                                //         "TRN_ID": result.response.docs[i].TRN_ID,
                                //         "VERSION_NO": result.response.docs[i].VERSION_NO,
                                //         "CREATED_BY": result.response.docs[i].CREATED_BY,
                                //         // "CREATED_DATE": ToDate(result.response.docs[i].CREATED_DATE),
                                //         "CREATED_DATE": result.response.docs[i].CREATED_DATE,
                                //         "PRCT_ID": result.response.docs[i].PRCT_ID
                                //     };
                                //     var oldData = result.response.docs[i].OLD_DATA ? JSON.parse(result.response.docs[i].OLD_DATA) : {};
                                //     for (var key in oldData) {
                                //         if (isDate(oldData[key])) {
                                //             console.log(oldData[key], '====== ' + key + ' Before ======');
                                //             if (DB_Type == 'POSTGRES') {
                                //                 oldData[key] = reqMoment.utc(oldData[key]).format("YYYY-MM-DD hh:mm:ss A");
                                //             } else {
                                //                 oldData[key] = reqMoment(oldData[key]).format('YYYY-MM-DD hh:mm:ss A');
                                //             }
                                //             console.log(oldData[key], '===== ' + key + ' After =======');
                                //         }
                                //     }
                                //     var newData = result.response.docs[i].NEW_DATA ? JSON.parse(result.response.docs[i].NEW_DATA) : {};
                                //     for (var key in newData) {
                                //         if (isDate(newData[key])) {
                                //             console.log(newData[key], '====== ' + key + ' Before ======');
                                //             if (DB_Type == 'POSTGRES') {
                                //                 newData[key] = reqMoment.utc(newData[key]).format("YYYY-MM-DD hh:mm:ss A");
                                //             } else {
                                //                 newData[key] = reqMoment(newData[key]).format('YYYY-MM-DD hh:mm:ss A');
                                //             }
                                //             console.log(newData[key], '=====' + key + ' After =======');
                                //         }
                                //     }
                                //     resobj.OLD_DATA = JSON.stringify(oldData);
                                //     resobj.NEW_DATA = JSON.stringify(newData);
                                //     arrVersionInfo.push(resobj);
                                // }
                                // objResult.AuditVersionData = JSON.stringify(arrVersionInfo);
                                // objResult.RecordsPerPage = strRecordsPerPage;
                                // objResult.CurrentPage = strCurrentPageNo;
                                // objResult.TotalItems = result.response.numFound;
                                // _PrintInfo('No of document found - ' + result.response.numFound);
                                return reqInstanceHelpr.SendResponse('GetAuditVersionInfo', appResponse, prepareResult(result.response.docs, DB_TYPE), objLogInfo, '', '', null);
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
            }, null, null, strSolrFields.toString());
        }

        function isDate(_date) {
            const _regExp = new RegExp('^(-?(?:[1-9][0-9]*)?[0-9]{4})-(1[0-2]|0[1-9])-(3[01]|0[1-9]|[12][0-9])T(2[0-3]|[01][0-9]):([0-5][0-9]):([0-5][0-9])(.[0-9]+)?(Z)?$');
            return _regExp.test(_date);
        }

        // Convert string to Date format
        function ToDate(pDate) {
            var Restr = '';
            if (DB_Type == 'POSTGRES') {
                Restr = reqMoment.utc(pDate).format("DD-MM-YYYY hh:mm:ss A");
            } else {
                Restr = reqMoment(pDate).format('DD-MM-YYYY hh:mm:ss A');
            }
            return Restr;
        }

        function __GetTranID() {
            if (strSelTran) {
                var objSelTran = JSON.parse(strSelTran);

                strItemId = objSelTran[strKeyCol.toLowerCase()];
                strVersionNumber = objSelTran['version_no'] || '';

            }
        }


        function prepareResult(pData, pDBType) {
            try {
                var arrVersionInfo = [];

                for (var i = 0; i < pData.length; i++) {
                    var resobj = {
                        "DTT_CODE": (pData[i].DTT_CODE instanceof Array) ? pData[i].DTT_CODE[0] : pData[i].DTT_CODE,
                        //"DT_CODE": (pData[i].DT_CODE instanceof Array) ? pData[i].DT_CODE[0] : pData[i].DT_CODE,
                        //"DTT_DESCRIPTION": (pData[i].DTT_DESCRIPTION instanceof Array) ? pData[i].DTT_DESCRIPTION[0] : pData[i].DTT_DESCRIPTION,
                        "DTT_DESCRIPTION": (pData[i].DTT_DESCRIPTION instanceof Array) ? pData[i].DTT_DESCRIPTION[0] : pData[i].DTT_DESCRIPTION,
                        "TRN_ID": pData[i].TRN_ID,
                        "VERSION_NO": pData[i].VERSION_NO,
                        "CREATED_BY": pData[i].CREATED_BY_NAME,
                        "CREATED_DATE": pData[i].CREATED_DATE,
                        // "CREATED_DATE": pData[i].created_date,
                        "PRCT_ID": pData[i].PRCT_ID,

                    };
                    if (!resobj.CREATED_BY && pData[i].VERSION_NO == 1) {
                        resobj.CREATED_BY = JSON.parse(pData[i].NEW_DATA).created_by_name
                    }
                    if (!resobj.CREATED_BY && pData[i].VERSION_NO > 1) {
                        resobj.CREATED_BY = JSON.parse(pData[i].NEW_DATA).modified_by_name
                    }

                    var oldData = pData[i].OLD_DATA ? JSON.parse(pData[i].OLD_DATA) : {};
                    // oldData = JSON.parse(oldData)
                    for (var key in oldData) {
                        if (systemColumns.indexOf(key) == -1) {
                            if (isDate(oldData[key])) {
                                console.log(oldData[key], '====== ' + key + ' Before ======');
                                if (DB_Type == 'POSTGRES') {
                                    oldData[key] = reqMoment.utc(oldData[key]).format("YYYY-MM-DD hh:mm:ss A");
                                } else {
                                    oldData[key] = reqMoment(oldData[key]).format('YYYY-MM-DD hh:mm:ss A');
                                }
                                console.log(oldData[key], '===== ' + key + ' After =======');
                            }
                        } else {
                            delete oldData[key];
                        }
                    }
                    var newData = pData[i].NEW_DATA ? JSON.parse(pData[i].NEW_DATA) : {};
                    for (var key in newData) {
                        if (systemColumns.indexOf(key) == -1) {
                            if (isDate(newData[key])) {
                                console.log(newData[key], '====== ' + key + ' Before ======');
                                if (DB_Type == 'POSTGRES') {
                                    newData[key] = reqMoment.utc(newData[key]).format("YYYY-MM-DD hh:mm:ss A");
                                } else {
                                    newData[key] = reqMoment(newData[key]).format('YYYY-MM-DD hh:mm:ss A');
                                }
                                console.log(newData[key], '=====' + key + ' After =======');
                            }
                        } else {
                            delete newData[key]
                        }

                    }
                    resobj.OLD_DATA = JSON.stringify(oldData);
                    resobj.NEW_DATA = JSON.stringify(newData);
                    arrVersionInfo.push(resobj);
                }
                objResult.AuditVersionData = JSON.stringify(arrVersionInfo);
                objResult.RecordsPerPage = strRecordsPerPage;
                objResult.CurrentPage = strCurrentPageNo;
                objResult.TotalItems = pData.length;
                //_PrintInfo('No of document found - ' + result.response.numFound);
                return objResult
            } catch (error) {
                console.log(error)
            }
        }

        function _PrintError(pErrCode, pErrMessage, pError) {
            reqInstanceHelpr.PrintError('GetAuditVersionInfo', pError, pErrCode, objLogInfo, pErrMessage);
        }

        function _PrintInfo(pMessage) {
            reqInstanceHelpr.PrintInfo('GetAuditVersionInfo', pMessage, objLogInfo);
        }


        function GetDatafromDB(dbsession) {
            try {
                var strCriteria = '';
                if (getFx) {
                    var querycond = {}
                    if (strVersionNumber && needFullJson) {
                        querycond['version_no'] = ` VERSION_NO = '${strVersionNumber}'`;
                    }
                    if (strItemId) {
                        querycond['trn_id'] = `TRAN_ID = '${strItemId}'`
                    }
                    if (targetTable) {
                        querycond['table_name'] = `TABLE_NAME ='${targetTable}'`
                    }
                    for (var i in querycond) {
                        strCriteria += querycond[i] + "and "
                    }
                    strCriteria = strCriteria.slice(0, -4)

                } else {
                    if (strVersionNumber && needFullJson) {
                        strVersionNumber = ` VERSION_NO = '${strVersionNumber}'`;
                    }
                    else {
                        strVersionNumber = '';
                    }


                    if (strDTTCODE) {
                        strCriteria = `DTT_CODE = '${strDTTCODE}' `
                    }
                    if (strCriteria && strVersionNumber) {
                        strCriteria = `${strCriteria} AND  ${strVersionNumber}`
                    } else if (strVersionNumber) {
                        strCriteria = `'${strVersionNumber}'`
                    }


                    if (strItemId && strCriteria) {
                        strCriteria = `${strCriteria} AND TRAN_ID = '${strItemId}'`
                    } else if (strItemId) {
                        strCriteria = `TRAN_ID = '${strItemId}'`
                    }
                    if (prct_id && strCriteria) {
                        strCriteria = `${strCriteria} AND PRCT_ID = '${prct_id}'`;
                    } else if (prct_id) {
                        strCriteria = `PRCT_ID = '${prct_id}'`;
                    }
                }

                if (getFx) {
                    var qry = `SELECT TRAN_ID as TRN_ID ,VERSION_NO,CREATED_BY,TO_CHAR(CREATED_DATE,'YYYY-MM-DD HH:MI:SS:MS AM') AS CREATED_DATE,CREATED_BY_NAME,PRCT_ID,OLD_DATA_JSON as OLD_DATA ,NEW_DATA_JSON as NEW_DATA FROM HST_FX_TABLE_DATA WHERE ${strCriteria}`
                } else {
                    //var qry = `SELECT DTT_CODE,TRAN_ID as TRN_ID,VERSION_NO,CREATED_BY,TO_CHAR(CREATED_DATE,'YYYY-MM-DD HH:MI:SS:MS AM')AS CREATED_DATE,PRCT_ID,OLD_DATA_JSON as OLD_DATA ,NEW_DATA_JSON as NEW_DATA FROM HST_TRAN_DATA WHERE ${strCriteria}`
                    var qry = `SELECT DTT_DESCRIPTION,DTT_CODE,TRAN_ID as TRN_ID,VERSION_NO,CREATED_BY,CREATED_BY_NAME,TO_CHAR(CREATED_DATE,'YYYY-MM-DD HH:MI:SS:MS AM')AS CREATED_DATE,PRCT_ID,OLD_DATA_JSON as OLD_DATA ,NEW_DATA_JSON as NEW_DATA FROM HST_TRAN_DATA WHERE ${strCriteria}`
                }

                // reqTranDBInstance.GetTranDBConn(pHeaders, false, function (dbSession) {
                // reqTranDBInstance.ExecuteQueryWithPagingCount(dbsession, qry, strCurrentPageNo, '10', objLogInfo, function (pResult, pCount, pError) {
                reqTranDBInstance.ExecuteSQLQuery(dbsession, qry, objLogInfo, function (result, pError) {
                    if (pError) {

                    } else {
                        var tranDBKey = 'TRANDB~' + pHeaders.routingkey;
                        reqAuditLog.GetDBType(tranDBKey, false, objLogInfo, function (DB_TYPE, error) {
                            if (error) {
                                reqInstanceHelpr.PrintInfo(serviceName, 'Error while Getting data For this Redis Key - ' + tranDBKey, objLogInfo);
                                reqInstanceHelpr.PrintInfo(serviceName, 'Error - ' + error, objLogInfo);
                                reqInstanceHelpr.SendResponse(serviceName, appResponse, objResult, objLogInfo, 'ERR-AUT-15002', 'Error while Getting data For this Redis Key - ' + tranDBKey, error);
                            } else {
                                //DB_Type = DB_TYPE;


                                var resdata = reqInstanceHelpr.ArrKeyToUpperCase(result.rows, objLogInfo)
                                return reqInstanceHelpr.SendResponse('GetAuditVersionInfo', appResponse, prepareResult(resdata, DB_TYPE), objLogInfo, '', '', null);
                            }
                        }
                        )
                    }
                })
                // })
            } catch (error) {

            }
        }

    });
});

module.exports = router;