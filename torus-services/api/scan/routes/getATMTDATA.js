/*
@Api_Name : /getATMTDATA,
@Description : Get Attachment Data
@Error_Code : ERR-ATMT-80210

*/
// Require dependencies
var reqExpress = require('express');
var router = reqExpress.Router();
var reqCassandraInstance = require('../../../../torus-references/instance/CassandraInstance');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo')
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper')
var router = reqExpress.Router();
var reqDBInstance = require('../../../../torus-references/instance/DBInstance')
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var strServiceName = 'GetATMTData';

// Host api to server
router.post('/getATMTDATA', function (appRequest, appResponse) {
    try {
        reqLogInfo.AssignLogInfoDetail(appRequest, function callbackAssignLogInfoDetail(pLogInfo, pSessionInfo) {
            try {
                var objLogInfo = pLogInfo;
                _PrintInfo(objLogInfo,'GetATMTData Begin');
                appResponse.setHeader('Content-Type', 'application/json');
                reqDBInstance.GetFXDBConnection(appRequest.headers, 'dep_cas', objLogInfo, function Callback_GetCassandraConn(mClient) {
                    try {
                        var strOrm = 'knex';
                        // var mClient;
                        var pResult = '';
                        var result = '';
                        var strInputParamJson = '';
                        strInputParamJson = appRequest.body.PARAMS
                        var strReqHeader = appRequest.headers
                        var DT_CODE = "";
                        var DTT_CODE = appRequest.body.DTT_CODE;
                        var FOLDERDT_CODE = appRequest.body.DT_CODE;
                        var param_KEYCOLUMN = "";
                        var param_KEYVALUE = "";
                        var APP_ID = appRequest.body.APP_ID
                        var HANDLER_CODE = "";
                        var ATMT_DTCODE = "";
                        var ATMT_DTTCODE = ""
                        var atmt_dt_code = appRequest.body.ATMT_DT_CODE;
                        var atmt_dtt_code = appRequest.body.ATMT_DTT_CODE;
                        var HANDLER_CODE = appRequest.body.HANDLER_CODE;
                        var param_KEYCOLUMN = appRequest.body.KEYCOLUMN;
                        var param_KEYVALUE = appRequest.body.KEYVALUE;
                        var FOLDERDT_CODE = appRequest.body.DT_CODE;
                        FindDT(DTT_CODE, APP_ID);
                        // Initialize DB
                        // _InitializeTrnDB(strReqHeader, function callbackInitializeDB(pStatus) {
                        //     // Main function to call WFSelect
                        //     //  FindDT Code
    
                        // })
                        function FindDT(pDTT_code, pAPP_ID) {
                            var dt_code = '';
                            try {
                                if (FOLDERDT_CODE != '') {
                                    dt_code = FOLDERDT_CODE;
                                    getATMTDATA(pDTT_code, dt_code);
    
                                } else {
                                    try {
                                        //   var querystring = 'select dt_code,relation_json from dt_info where app_id=? allow filtering;'
                                        var releation_json = '';
                                        // mClient.execute(querystring, [pAPP_ID], {
                                        //         prepare: true
                                        //     },
                                        //     function(err, pResult) {
    
    
                                        reqDBInstance.GetTableFromFXDB(mClient, 'DT_INFO', ['dt_code', 'relation_json'], {
                                            'app_id': pAPP_ID
                                        }, objLogInfo, function (pError, pResult) {
                                            if (pError)
                                                _PrintError(objLogInfo,"ERR-SCN-80202", pError);
                                            else {
                                                if (pResult.rows.length == 0) {
                                                    _PrintError(objLogInfo,"ERR-SCN-80203", "data templates data not found" + pError);
                                                } else {
                                                    try {
                                                        for (var i = 0; i < pResult.rows.length; i++) {
                                                            releation_json = pResult.rows[i].relation_json;
                                                            var rel_jsonvalue = JSON.parse(releation_json);
                                                            for (var j = 0; j < rel_jsonvalue.length; j++) {
                                                                var reldtt_code = rel_jsonvalue[j].DTT_CODE;
                                                                if (reldtt_code == pDTT_code) {
                                                                    dt_code = pResult.rows[i].dt_code;
                                                                    break;
                                                                }
                                                            }
                                                            if (dt_code != '') {
                                                                break;
                                                            }
                                                        }
                                                    } catch (error) {
                                                        _PrintError(objLogInfo,"ERR-ATMT-80204", "Error in data_templates-query" + error);
                                                    }
                                                }
                                                getATMTDATA(pDTT_code, dt_code);
                                            }
                                        })
                                    } catch (error) {
                                        _PrintError(objLogInfo,"ERR-ATMT-80215", "Error in FindDT else function" + error);
                                    }
                                }
                            } catch (error) {
                                _PrintError(objLogInfo,"ERR-ATMT-80205", "Error in FindDT function" + error);
                            }
                        }
    
                        function _InitializeTrnDB(pHeaders, pCallback) {
                            reqDBInstance.GetFXDBConnection(pHeaders, 'dep_cas', objLogInfo, function CallbackGetCassandraConn(pClient) {
                                mDepCas = pClient
                                reqDBInstance.GetFXDBConnection(pHeaders, 'clt_cas', objLogInfo, function CallbackGetCassandraConn(pCltClient) {
                                    mCltCas = pCltClient
                                    reqTranDBInstance.GetTranDBConn(pHeaders, false, function (pSession) {
                                        mTranDB = pSession
                                        pCallback('Success')
                                    })
                                })
                            })
                        }
    
                       
                        // get Attachment Data
                        function getATMTDATA(pDTT_code, dt_code) {
                            try {
                                var paramsresultarray = [];
                                var condatmt = new Object();
                                condatmt.app_id = APP_ID;
                                if (dt_code == '') {
                                    condatmt.dt_code = atmt_dt_code;
                                } else {
                                    condatmt.dt_code = dt_code;
                                }
    
                                reqDBInstance.GetTableFromFXDB(mClient, 'DT_INFO', ['relation_json'], condatmt, objLogInfo, function (err, pResult) {
                                    try {
                                        Mclient = mClient;
                                        if (err)
                                            _PrintError(objLogInfo,"ERR-SCN-80206", err);
                                        else {
                                            if (pResult.rows.length == 0) {
                                                reqLogWriter.TraceError(objLogInfo, "key_column not found", "ERR-SCN-80207");
                                            } else {
                                                var params = {};
                                                var strtargetcolumn = '';
                                                var target_table = '';
                                                var rel_json = pResult.rows[0].relation_json;
                                                var rel_jsonvalue = JSON.parse(rel_json);
                                                for (var j = 0; j < rel_jsonvalue.length; j++) {
                                                    var reldtt_code = rel_jsonvalue[j].DTT_CODE;
                                                    if (reldtt_code == pDTT_code) {
                                                        target_table = rel_jsonvalue[j].TARGET_TABLE;
                                                        strtargetcolumn = rel_jsonvalue[j].PRIMARY_COLUMN;
                                                        break;
                                                    } else {
                                                        if (rel_jsonvalue[j].CHILD_DTT_RELEATIONS[j] != undefined && rel_jsonvalue[j].CHILD_DTT_RELEATIONS[j] != '' && rel_jsonvalue[j].CHILD_DTT_RELEATIONS[j] != null) {
                                                            reldtt_code = rel_jsonvalue[j].CHILD_DTT_RELEATIONS[j].DTT_CODE;
                                                            if (reldtt_code == pDTT_code) {
                                                                target_table = rel_jsonvalue[j].CHILD_DTT_RELEATIONS[j].TARGET_TABLE;
                                                                strtargetcolumn = rel_jsonvalue[j].CHILD_DTT_RELEATIONS[j].PRIMARY_COLUMN;
                                                                break;
                                                            }
                                                        }
                                                    }
    
                                                }
    
                                                if (atmt_dtt_code != '') {
                                                    try {
                                                        params.HANDLER_CODE = HANDLER_CODE;
                                                        params.ATMT_DTCODE = '';
                                                        params.FOLDERDT_CODE = FOLDERDT_CODE;
                                                        params.TARGET_COLUMN = '';
                                                        params.TARGET_TABLE = '';
                                                        params.ATMT_DTCODE = atmt_dt_code;
                                                        params.ATMT_DTTCODE = atmt_dtt_code;
                                                        params.ATMT_KEY_COLUMN = strtargetcolumn;
                                                        params.FOLDERDTT_CODE = DTT_CODE;
                                                        params.FOLDERKEYVALUE = param_KEYVALUE;
                                                        paramsresultarray.push(params);
                                                        result = JSON.stringify(paramsresultarray);
                                                        reqLogWriter.EventUpdate(objLogInfo);
                                                        appResponse.send(result);
                                                    } catch (error) {
                                                        _PrintError(objLogInfo,"ERR-SCN-80208", "Error in atmt_dtt_code IS NOT NULL" + error);
                                                    }
    
                                                } else {
                                                    try {
                                                        params.HANDLER_CODE = HANDLER_CODE;
                                                        params.ATMT_DTCODE = dt_code; //DT_1228_1460370507070'
                                                        params.FOLDERDT_CODE = '';
                                                        params.TARGET_COLUMN = strtargetcolumn;
                                                        params.TARGET_TABLE = target_table;
                                                        params.ATMT_DTTCODE = '';
                                                        params.ATMT_KEY_COLUMN = '';
                                                        params.FOLDERDTT_CODE = '';
                                                        params.FOLDERKEYVALUE = '';
                                                        paramsresultarray.push(params);
                                                        result = JSON.stringify(paramsresultarray);
                                                        reqLogWriter.EventUpdate(objLogInfo);
                                                        appResponse.send(result);
    
                                                    } catch (error) {
                                                        _PrintError(objLogInfo,"ERR-SCN-80209", "Error in atmt_dtt_code IS NULL" + error);
                                                    }
                                                }
                                            }
                                        }
                                    }
                                    catch (error) {
                                        _PrintError(objLogInfo,"ERR-ATMT-80211", "Error in getATMTDATA - GetTableFromFXDB function" + error);
                                    }
                                })
                            } catch (error) {
                                _PrintError(objLogInfo,"ERR-ATMT-80210", "Catch Error in getATMTDATA function" + error);
                            }
                        }
                    } catch (error) {
                        _PrintError(objLogInfo,"ERR-ATMT-80213", "Error in getATMTDATA function" + error);
                    }
    
                });
            } catch (error) {
                _PrintError(objLogInfo,"ERR-ATMT-80214", "Error in AssignLogInfoDetail function" + error);  
            }
           
        })
    } catch (error) {
        _PrintError(objLogInfo,"ERR-ATMT-80212", "Error in getATMTDATA function" + error);

    }
// Common function to print log messages
    function _PrintInfo(pLogInfo,pMessage) {
        reqInstanceHelper.PrintInfo(strServiceName, pMessage, pLogInfo)
      }

    function _PrintError(pLogInfo,pErrcode, pErrmessage) {
        try {
            reqLogWriter.TraceError(pLogInfo, pErrmessage, pErrcode);
            appResponse.send(pErrmessage + " " + pErrcode);
        } catch (error) {
            reqLogWriter.TraceError(pLogInfo, 'Error while sending response from getATMTDATA API - ' + error.stack, pErrcode);
        }
    }

})
/* End of getATMTDATA */
module.exports = router;