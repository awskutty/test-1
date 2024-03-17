/*
Modified By UdhayaRaj Ms for password changes
*/

// Require dependencies
var modPath = '../../../../node_modules/'
var reqExpress = require(modPath + 'express');
var reqEncHelper = require('../../../../torus-references/common/crypto/EncryptionInstance');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var router = reqExpress.Router();
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var DBInstance = require('../../../../torus-references/instance/DBInstance');
// Cassandra initialization
var mPltClient = '';


const CLTNEWPWD = 'insert into clients(client_id,email_id,client_password) values(?,?,?)';
var pHeaders = ''

// Host the login api
router.post('/GetPltNewPwd', function (pReq, pResp, pNext) {
    var objLogInfo = reqLogInfo.AssignLogInfoDetailForCP(pReq.body, pReq);
    objLogInfo.PROCESS = 'GetPltNewPwd-Authentication';
    objLogInfo.ACTION = 'GetPltNewPwd';
    reqLogWriter.Eventinsert(objLogInfo);

    try {
        pHeaders = pReq.headers;
        DBInstance.GetFXDBConnection(pHeaders, 'plt_cas', objLogInfo, function Callback_GetCassandraConn(pClient) {
            //reqCasInstance.GetCassandraConn(pHeaders, 'plt_cas', function Callback_GetCassandraConn(pClient) {
            mPltClient = pClient;

            pResp.setHeader('Content-Type', 'application/json');
            // Initialize Global variables
            var pUname = pReq.body.LOGIN_NAME.toUpperCase();
            var pswd = reqEncHelper.DecryptPassword(pReq.body.New_pwd);
            var password = reqEncHelper.EncryptPassword(pswd);
            reqLogWriter.TraceInfo(objLogInfo, 'GetPltNewPwd Called...');
            DBInstance.InsertFXDB(mPltClient, 'clients', [{
                'client_id': pReq.body.CLIENT_ID,
                'email_id': pUname,
                'client_password': password
            }], objLogInfo, function (err) {
                // mPltClient.execute(CLTNEWPWD, [pReq.body.CLIENT_ID, pUname, password], {
                //     prepare: true
                // }, function (err) {
                try {
                    if (err) {
                        reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10143");
                    } else {
                        var fres = JSON.stringify("SUCCESS");
                        reqLogWriter.TraceInfo(objLogInfo, 'GetPltNewPwd SUCCESS...');
                        reqLogWriter.EventUpdate(objLogInfo);
                        pResp.send(fres);
                    }
                } catch (error) {
                    errorHandler("ERR-FX-10143", "Error GetPltNewPwd function" + error)
                }
            })
        })
    } catch (error) {
        errorHandler("ERR-FX-10142", "Error GetPltNewPwd function" + error)
    }

    function errorHandler(errcode, message) {
        console.log(message, errcode);
        reqLogWriter.TraceError(objLogInfo, message, errcode);
    }
});
module.exports = router;