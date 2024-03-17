var reqExpress = require('express');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var router = reqExpress.Router();
var reqTranDBHelper = require('../../../../torus-references/instance/TranDBInstance');
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqDateFormatter = require('../../../../torus-references/common/dateconverter/DateFormatter');
var reqDateFormat = require('../../../../node_modules/dateformat');
var serviceName = 'GetCommProcessMessage';

router.post('/GetCommProcessMessage', function (appRequest, appResponse) {
    try {
        var pHeader = appRequest.headers;
        var objLogInfo = {};
        var clientParams = appRequest.body.PARAMS;
        var condObj = {};

        if (clientParams.PRCT_ID) {
            condObj.PRCT_ID = clientParams.PRCT_ID;
        }

        reqTranDBHelper.GetTranDBConn(pHeader, false, function (TranDbsession) {
            reqLogInfo.AssignLogInfoDetail(appRequest, function (pLogInfo, pSessionInfo) {
                objLogInfo = pLogInfo;
                condObj.TENANT_ID = pSessionInfo.TENANT_ID;
                reqTranDBHelper.GetTableFromTranDB(TranDbsession, 'COMM_PROCESS_MESSAGE', condObj, objLogInfo, function (Res, err) {
                    try {
                        if (err) {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-GetCommProcessMessage-900001', 'Catch Error in COMM_PROCESS_MESSAGE TABLE ....', err, 'FAILURE', '');
                        } else if (Res.length) {
                            var obj = {};
                            var rows = [];
                            for (var i = 0; i < Res.length; i++) {
                                var obj = {};
                                obj.commmt_code = Res[i].commmt_code;
                                obj.comm_msg_id = Res[i].comm_msg_id;
                                obj.commpm_id = Res[i].commpm_id;
                                obj.prct_id = Res[i].prct_id;
                                obj.message = Res[i].message;
                                obj.type = Res[i].type;
                                obj.status = Res[i].status;
                                // obj.created_date = convertDate(Res[i].created_date);
                                obj.created_date = Res[i].created_date;
                                rows.push(obj);
                            }
                            reqInstanceHelper.SendResponse(serviceName, appResponse, rows, objLogInfo, '', '', '', '', '');
                        } else {
                            var rows = [];
                            reqInstanceHelper.SendResponse(serviceName, appResponse, rows, objLogInfo, '', '', '', '', '');
                        }

                    } catch (error) {
                        reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-GetCommProcessMessage-900002', 'Catch ErrorCOMM_PROCESS_MESSAGE TABLE API....', error, 'FAILURE', '');
                    }
                });


            });
        });
    } catch (error) {
        reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-GetCommProcessMessage-900003', 'Catch Error in COMM_PROCESS_MESSAGE API....', error, 'FAILURE', '');
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
            reqInstanceHelper.PrintInfo('GetCommProcessMessage', 'Error While Converting a Date - ' + pDate, objLogInfo);
        }
    }

});

module.exports = router;