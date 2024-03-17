/*
@Api_Name         : /savearchivalsetup,
@Description      : To create archival index 
@Last_Error_code  : ERR-HAN-
*/

// Require dependencies
var reqExpress = require('express');
var router = reqExpress.Router();
var reqAsync = require('async');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqCommon = require('../../../../torus-references/transaction/Common');
var reqDateFormatter = require('../../../../torus-references/common/dateconverter/DateFormatter');


router.post('/ArchivalPreviewQuery', function (appRequest, appResponse) {
    try {
        var ServiceName = 'ArchivalPreviewQuery';
        var pHeaders = appRequest.headers;
        var Mode = appRequest.body.PARAMS.ArchivalMode
        var table_name = 'ARCHIVAL_QRY_INFO';
        // if (Mode == 'Archival') {
        //     table_name = 'ARCHIVAL_PROCESS_INFO';
        // } else {
        //     table_name = 'ARCHIVAL_QRY_INFO';
        // }
        var objLogInfo = {};
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
            _PrintInfo(objLogInfo, "Archival preview Query Begins");
            _PrintInfo(objLogInfo, "Archival Mode" + Mode);
            reqTranDBInstance.GetTranDBConn(pHeaders, false, function (pSession) {
                try {
                    var cond = {};
                    _PrintInfo(objLogInfo, "Querying Arichval Table beigns");
                    reqTranDBInstance.GetTableFromTranDB(pSession, table_name, cond, objLogInfo, function (Res, Err) {
                        try {
                            if (Err) {
                                reqInstanceHelper.SendResponse(ServiceName, appResponse, "", objLogInfo, 'ERR-ARC-46004', 'Error occured while qry the archival process info table.', Err, 'FAILURE');

                            } else {
                                _PrintInfo(objLogInfo, "Querying Arichval Table Ends")
                                reqInstanceHelper.SendResponse(ServiceName, appResponse, Res, objLogInfo, '', '', '', 'SUCCESS');
                            }
                        } catch (error) {
                            reqInstanceHelper.SendResponse(ServiceName, appResponse, "", objLogInfo, 'ERR-ARC-46003', 'Exception occured while qry  the archival process info table.', error, 'FAILURE');
                        }
                    });
                } catch (error) {
                    reqInstanceHelper.SendResponse(ServiceName, appResponse, "", objLogInfo, 'ERR-ARC-46002', 'Exception occured after get connection callback', error, 'FAILURE');
                }
            })

            function sendFailureRespone(pres) {
                reqInstanceHelper.SendResponse(ServiceName, appResponse, '', objLogInfo, pres.errCode, pres.errMessage, pres.errobj, 'FAILURE');
            }

            function _PrintInfo(pLogInfo, pMessage) {
                reqInstanceHelper.PrintInfo(ServiceName, pMessage, pLogInfo);
            }
        });
    } catch (error) {
        var res = {};
        res.errMessage = "Exception occured prepareResult function";
        res.errCode = "ERR-ARCH-46001";
        res.errobj = error;
        sendFailureRespone(res);

    }
});

module.exports = router;