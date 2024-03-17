// Require dependencies
var modPath = '../../../../node_modules/'
var reqExpress = require(modPath + 'express');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var DBInstance = require('../../../../torus-references/instance/DBInstance');
// Cassandra initialization
var mPltClient = '';

const PWDPOLICY = 'select value from platform_setup where code=?';
var Pwd = '';
var router = reqExpress.Router();
var pHeaders = '';
var objLogInfo = ''
router.post('/GetPltPwdPolicy', function(pReq, pResp, pNext) {
    objLogInfo = reqLogInfo.AssignLogInfoDetailForCP(pReq.query, pReq);
    objLogInfo.PROCESS = 'GetPltPwdPolicy-Authentication';
    objLogInfo.ACTION = 'GetPltPwdPolicy';
    reqLogWriter.Eventinsert(objLogInfo);

    try {

        pHeaders = pReq.headers;
        DBInstance.GetFXDBConnection(pHeaders, 'plt_cas', objLogInfo, function Callback_GetCassandraConn(pClient) {
            //reqCasInstance.GetCassandraConn(pHeaders, 'plt_cas', function Callback_GetCassandraConn(pClient) {
            mPltClient = pClient;


            // Initialize local variables
            reqLogWriter.TraceInfo(objLogInfo, 'GetPltPwdPolicy Called...');
            pResp.setHeader('Content-Type', 'application/json');
            GetPltPwdPolicy(mPltClient, function callback(Pwd) {
                try {
                    reqLogWriter.TraceInfo(objLogInfo, 'GetPltPwdPolicy Loaded Successfully...');
                    pResp.send(Pwd);
                } catch (error) {
                    errorHandler("ERR-FX-10147", "Error GetPltPwdPolicy function" + error)
                }
            });
        })
    } catch (error) {
        errorHandler("ERR-FX-10146", "Error GetPltPwdPolicy function" + error)
    }


});

function GetPltPwdPolicy(mPltClient, callback) {
    try {
        DBInstance.GetTableFromFXDB(mPltClient, 'platform_setup', ['value'], {
            'code': 'PASSWORD_POLICY'
        }, objLogInfo, function callbackGetCltPwdPolicy(err, res) {
            // mPltClient.execute(PWDPOLICY, ['PASSWORD_POLICY'], {
            //     prepare: true
            // }, function callbackGetCltPwdPolicy(err, res) {
            try {
                if (err) {
                    reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10145");
                } else {
                    for (var i = 0; i < res.rows.length; i++) {
                        var input = res.rows[i];
                        Pwd = JSON.stringify(input.value);
                    }
                    return callback(Pwd);
                }
            } catch (error) {
                errorHandler("ERR-FX-10145", "Error GetPltPwdPolicy function" + error)
            }
        });
    } catch (error) {
        errorHandler("ERR-FX-10144", "Error GetPltPwdPolicy function" + error)
    }
}

function errorHandler(errcode, message) {
    console.log(message, errcode);
    reqLogWriter.TraceError(objLogInfo, message, errcode);
}

module.exports = router;
module.exports.GetPltPwdPolicy = GetPltPwdPolicy;

// module.exports = {
//     GetPltPwdPolicy: GetPltPwdPolicy,
//     router: router
// };