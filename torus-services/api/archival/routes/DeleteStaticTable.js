/*
@Api_Name         : /ArchivalIndex,
@Description      : To insert "Static table (manually created tables)" table entry for archival process
@Last_Error_code  : ERR-HAN-
*/

// Require dependencies
var reqExpress = require('express');
var router = reqExpress.Router();
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqCommon = require('../../../../torus-references/transaction/Common');
var reqDateFormatter = require('../../../../torus-references/common/dateconverter/DateFormatter');
var request = require('request');
router.post('/DeleteStaticTable', function (appRequest, appResponse) {
    try {
        var ServiceName = 'DeleteStaticTable';
        var pHeaders = appRequest.headers;
        var params = appRequest.body.PARAMS;
        var objLogInfo;
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
            reqDBInstance.GetFXDBConnection(pHeaders, 'dep_cas', objLogInfo, function (pClient) {
                reqTranDBInstance.GetTranDBConn(pHeaders, false, function (pession) {
                    var trndbsession = pession;
                    var pTable = "ARC_STATIC_TABLES";
                    var pRows = {
                        target_table: params.target_table
                    };
                    if (params.as_id != undefined) {
                        // pRows['as_id'] = params.as_id;
                        deleteArsetup();
                    } else {
                        _DeleteStaticTable(pTable, pRows).then((res) => {
                            reqInstanceHelper.SendResponse(ServiceName, appResponse, "SUCCESS", objLogInfo, '', '', '', 'SUCCESS', 'Deleted Successfully.');
                        }).catch((error) => {
                            reqInstanceHelper.SendResponse(ServiceName, appResponse, error, objLogInfo, '', '', '', 'FAILURE', '');
                        });
                    }



                    function _DeleteStaticTable(pTable, pRows) {
                        return new Promise((resolve, reject) => {
                            try {
                                reqDBInstance.DeleteFXDB(pClient, pTable, pRows, objLogInfo, function (pErr, pRes) {
                                    if (pErr) {
                                        reject(pErr);
                                    } else {
                                        resolve(pRes);
                                    }
                                });
                            } catch (error) {
                                reject(error);
                            }
                        });
                    }



                    function deleteArsetup() {
                        try {
                            var delCond = {
                                as_id: params.as_id
                            };
                            reqDBInstance.DeleteFXDB(pClient, 'ARCHIVAL_SETUP', delCond, objLogInfo, function (pErr, pRes) {
                                if (pErr) {
                                    reqInstanceHelper.SendResponse(ServiceName, appResponse, '', objLogInfo, 'ERR_ARCH_40625', 'Error Occured in delete Archival_Setup table ', pErr, 'FAILURE', '');
                                } else {
                                    reqTranDBInstance.DeleteTranDB(trndbsession, 'ARCHIVAL_QRY_INFO', delCond, objLogInfo, function (Res, err) {
                                        if (err) {
                                            reqInstanceHelper.SendResponse(ServiceName, appResponse, '', objLogInfo, 'ERR_ARCH_40624', 'Error Occured in delete Archival_qry_info table ', error, 'FAILURE', '');
                                        } else {
                                            reqTranDBInstance.DeleteTranDB(trndbsession, 'ARCHIVAL_PROCESS_INFO', delCond, objLogInfo, function (res, error) {
                                                if (error) {
                                                    reqInstanceHelper.SendResponse(ServiceName, appResponse, '', objLogInfo, 'ERR_ARCH_40623', 'Error Occured in delete Archival_process_info table ', error, 'FAILURE', '');
                                                } else {
                                                    _DeleteStaticTable(pTable, pRows).then((res) => {
                                                        reqInstanceHelper.SendResponse(ServiceName, appResponse, "SUCCESS", objLogInfo, '', '', '', 'SUCCESS', 'Deleted Successfully.');
                                                    }).catch((error) => {
                                                        reqInstanceHelper.SendResponse(ServiceName, appResponse, '', objLogInfo, 'ERR_ARCH_40622', 'Exception occured ', error, 'FAILURE', '');
                                                    });
                                                }
                                            });
                                        }
                                    });
                                }
                            });
                        } catch (error) {
                            reqInstanceHelper.SendResponse(ServiceName, appResponse, '', objLogInfo, 'ERR_ARCH_40621', 'Exception occured white delete function ', error, 'FAILURE', '');
                        }
                    };
                });



            });
        });
    } catch (error) {
        reqInstanceHelper.SendResponse(ServiceName, appResponse, error, objLogInfo, 'ERR_ARCH_40620', '', '', 'FAILURE', '');
    }
});
module.exports = router;