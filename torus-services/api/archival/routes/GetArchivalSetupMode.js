var reqExpress = require('express');
var router = reqExpress.Router();
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
// var reqTorusRdbms = require('../../../../torus-references/instance/db/TorusRdbms');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var DBInstance = require('../../../../torus-references/instance/DBInstance');
var reqsvchelper = require('../../../../torus-references/common/serviceHelper/ServiceHelper');
router.post('/GetArchivalSetupMode', function (appRequest, appResponse) {
    try {
        var ServiceName = 'GetArchivalSetupMode';
        var pHeaders = appRequest.headers;
        var objLogInfo = '';
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
            try {
                objLogInfo = objLogInfo;
                getClientSetup('ARCHIVAL_SETUP_MODE', function (SetupData) {
                    if (SetupData) {
                        var setupObj = JSON.parse(SetupData.setup_json);
                        reqInstanceHelper.SendResponse(ServiceName, appResponse, setupObj, objLogInfo, '', '', '', 'SUCCESS', '');

                    }
                })

            } catch (error) {
                reqInstanceHelper.SendResponse(ServiceName, appResponse, '', objLogInfo, 'ERR-CODE-160013', 'Error in AssignLogInfoDetails Function', error, 'FAILURE', error);
            }
            
        });





        function getClientSetup(setupName, clientSetupCallback) {
            try {
                var cond = {};
                cond.setup_code = setupName;
                DBInstance.GetFXDBConnection(pHeaders, 'clt_cas', objLogInfo, function Callback_GetCassandraConn(pClient) {
                    reqsvchelper.GetSetupJson(pClient, cond, objLogInfo, function (res) {
                        if (res.Status == 'SUCCESS' && res.Data.length) {
                            clientSetupCallback(res.Data[0]);
                        } else {
                            return reqInstanceHelper.SendResponse(ServiceName, appResponse, null, objLogInfo, res.ErrorCode, res.ErrorMsg, res.Error);
                        }
                    });
                });
            } catch (error) {
                return reqInstanceHelper.SendResponse(ServiceName, appResponse, null, objLogInfo, '', error, error);
            }

        }



        function _PrintInfo(pLogInfo, pMessage) {
            reqInstanceHelper.PrintInfo(ServiceName, pMessage, pLogInfo);
        }


    } catch (error) {

    }



});
module.exports = router;