/*
Modified By Udhayaraj Ms for GetCltPwdPolicy from fotgetpassword on 07-11-2016

*/
// Require dependencies
var modPath = '../../../../node_modules/';
var reqExpress = require(modPath + 'express');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var DBInstance = require('../../../../torus-references/instance/DBInstance');
var reqLoginPageHelper = require('./helper/LoginPageHelper');
var reqsvchelper = require('../../../../torus-references/common/serviceHelper/ServiceHelper');
// Cassandra initialization
var mCltClient = '';
var pHeaders = '';
var fPwd = '';
var router = reqExpress.Router();
var objLogInfo = '';
var serviceModel = DBInstance.DBInstanceSession['SERVICE_MODEL'];
router.post('/GetCltPwdPolicy', function (pReq, pResp, pNext) {
    objLogInfo = reqLogInfo.AssignLogInfoDetailForCP(pReq.body, pReq);
    objLogInfo.PROCESS = 'GetCltPwdPolicy-Authentication';
    objLogInfo.ACTION = 'GetCltPwdPolicy';
    reqLogWriter.Eventinsert(objLogInfo);
    try {
        pHeaders = pReq.headers;
        DBInstance.GetFXDBConnection(pHeaders, 'clt_cas', objLogInfo, function Callback_GetCassandraConn(pClient) {
            //reqCasInstance.GetCassandraConn(pHeaders, 'clt_cas', function Callback_GetCassandraConn(pClient) {
            mCltClient = pClient;
            // Initialize local variables
            reqLogWriter.TraceInfo(objLogInfo, 'GetCltPwdPolicy called...');
            pResp.setHeader('Content-Type', 'application/json');
            var pCid = pReq.body.CLIENT_ID;

            GetCltPwdPolicy(mCltClient, pCid, function callback(fPwd) {
                try {
                    var res = {};
                    res.PasswordPolicy = JSON.parse(fPwd);
                    reqLoginPageHelper.PrepareSlat('GetCltPwdPolicy', '', function (error, Result) {
                        res.SaltKey = Result.SaltKey;
                        res.SaltValue = Result.SaltValue;
                        reqLogWriter.TraceInfo(objLogInfo, 'GetCltPwdPolicy Successfully...');
                        reqLogWriter.EventUpdate(objLogInfo);
                        pResp.send(res);
                    });

                } catch (error) {
                    errorHandler("ERR-FX-10133", "Error GetCltPwdPolicy function" + error);
                }
            });
        });
    } catch (error) {
        errorHandler("ERR-FX-10132", "Error GetCltPwdPolicy function" + error);
    }


});

function GetCltPwdPolicy(mCltClient, pCid, callback) {
    try {

        if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
            var cond = {};
            cond.setup_code = 'PASSWORD_POLICY';
            reqsvchelper.GetSetupJson(mCltClient, cond, objLogInfo, function (res) {
                if (res.Status == 'SUCCESS' && res.Data.length) {
                    return callback(JSON.stringify(res.Data.setup_json));
                } else {
                    reqInstanceHelper.SendResponse('PASSWORD_POLICY', appResponse, res.Data, objLogInfo, res.ErrorCode, res.ErrorMsg, res.Error);
                }
            });
        } else {
            DBInstance.GetTableFromFXDB(mCltClient, 'tenant_setup', ['setup_json'], {
                'tenant_id': '0',
                'client_id': pCid,
                'category': 'PASSWORD_POLICY'
            }, objLogInfo, function callbackGetCltPwdPolicy(err, res) {
                if (err) {
                    reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10131");
                } else {
                    var input = res.rows[0];
                    fPwd = JSON.stringify(input.setup_json);
                    return callback(fPwd);
                }
            });
        }
    } catch (error) {
        errorHandler("ERR-FX-10131", "Error GetCltPwdPolicy function" + error);
    }
}

function errorHandler(errcode, message) {
    console.log(message, errcode);
    reqLogWriter.TraceError(objLogInfo, message, errcode);
}

module.exports = router;
module.exports.GetCltPwdPolicy = GetCltPwdPolicy;

// module.exports = {
//     router: router,
//     GetCltPwdPolicy: GetCltPwdPolicy
// }