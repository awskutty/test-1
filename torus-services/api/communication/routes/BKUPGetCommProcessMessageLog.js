var reqExpress = require('express');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var router = reqExpress.Router();
var reqTranDBHelper = require('../../../../torus-references/instance/TranDBInstance');
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqDateFormatter = require('../../../../torus-references/common/dateconverter/DateFormatter');
var reqDateFormat = require('../../../../node_modules/dateformat');
var serviceName = 'GetCommProcessMessageLog';

router.post('/GetCommProcessMessageLog', function (appRequest, appResponse) {
    try {
        var pHeader = appRequest.headers;
        var objLogInfo = {};
        var clientParams = appRequest.body.PARAMS;
        var condObj = {};

        if (clientParams.message_id) {
            condObj.comm_msg_id = clientParams.message_id;
        }

        reqTranDBHelper.GetTranDBConn(pHeader, false, function (TranDbsession) {
            reqLogInfo.AssignLogInfoDetail(appRequest, function (pLogInfo, pSessionInfo) {
                objLogInfo = pLogInfo;
                reqTranDBHelper.GetTableFromTranDB(TranDbsession, 'COMM_PROCESS_MESSAGE_LOG', condObj, objLogInfo, function (Res, err) {
                    try {
                        if (err) {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-GetCommProcessMessageLog-800001', 'Catch Error in COMM_PROCESS_MESSAGE_LOG TABLE ....', err, 'FAILURE', '');
                        } else if (Res.length) {
                            var obj = {};
                            var rows = [];
                            for (var i = 0; i < Res.length; i++) {
                                var obj = {};
                                obj.commpml_id = Res[i].commpml_id;
                                obj.comm_msg_id = Res[i].comm_msg_id;
                                obj.attempt_count = Res[i].attempt_count;
                                obj.comments = Res[i].comments;
                                obj.created_date = convertDate(Res[i].created_date);
                                rows.push(obj);
                            }
                            reqInstanceHelper.SendResponse(serviceName, appResponse, rows, objLogInfo, '', '', '', '', '');
                        } else {
                            var rows = []
                            reqInstanceHelper.SendResponse(serviceName, appResponse, rows, objLogInfo, '', '', '', '', '');
                        }

                    } catch (error) {
                        reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-GetCommProcessMessageLog-800002', 'Catch Error COMM_PROCESS_MESSAGE_LOG TABLE API....', error, 'FAILURE', '');
                    }
                });


            });
        })
    } catch (error) {
        reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-GetCommProcessMessageLog-800003', 'Catch Error in COMM_PROCESS_MESSAGE_LOG API....', error, 'FAILURE', '');
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
            reqInstanceHelper.PrintInfo('GetCommProcessMessageLog', 'Error While Converting a Date - ' + pDate, objLogInfo);
        }
    }

});

module.exports = router;