var modPath = '../../../../node_modules/'
var reqExpress = require(modPath + 'express');
var reqEncHelper = require('../../../../torus-references/common/crypto/EncryptionInstance');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var DBInstance = require('../../../../torus-references/instance/DBInstance');
var router = reqExpress.Router();
// Cassandra initialization
var mPltClient = '';
var pHeaders = '';
const PWD = 'select *  from clients where email_id=? allow filtering';
var CLIENT = 'insert into clients(email_id,client_password,client_id) values(?,?,?)';
// Host the login api
router.post('/PltChangePwd', function(pReq, pResp, pNext) {
    pHeaders = pReq.headers;
    var objLogInfo = reqLogInfo.AssignLogInfoDetailForCP(pReq.body, pReq);
    objLogInfo.PROCESS = 'PltChangePwd-Authentication';
    objLogInfo.ACTION = 'PltChangePwd';
    DBInstance.GetFXDBConnection(pHeaders, 'plt_cas', objLogInfo, function Callback_GetCassandraConn(pClient) {
        //reqCasInstance.GetCassandraConn(pHeaders, 'plt_cas', function Callback_GetCassandraConn(pClient) {
        mPltClient = pClient;
        reqLogWriter.Eventinsert(objLogInfo);

        // Initialize local variables
        pResp.setHeader('Content-Type', 'application/json');
        var strUname = pReq.body.LOGIN_NAME.toUpperCase();
        var CPwd = '';
        var Newpwd = pReq.body.New_pwd;
        var oldPwd = pReq.body.old_pswd;
        var Cclient_id = pReq.body.CLIENT_ID;
        var password = '';
        var finalres = 'SUCCESS';
        GetPltNewPwd();

        //Get the New password
        function GetPltNewPwd() {
            reqLogWriter.TraceInfo(objLogInfo, 'PltChangePwd called...');
            DBInstance.GetTableFromFXDB(mPltClient, 'clients', [], {
                'email_id': strUname
            }, objLogInfo, function(err, res) {
                // mPltClient.execute(PWD, [strUname], function(err, res) {
                try {
                    if (err) {
                        reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10169");
                    } else {
                        reqLogWriter.TraceInfo(objLogInfo, "RESULT LENGTH::" + res.rows.length);
                        for (var i = 0; i < res.rows.length; i++) {
                            console.log('entered...')
                            var chpwd = res.rows;
                            CPwd = chpwd[0].client_password;
                        }
                        GetResult(CPwd);
                    }
                } catch (error) {
                    errorHandler("ERR-FX-10169", "Error PltChangePwd function" + error)
                }
            })
        }

        function GetResult(CPwd) {
            try {
                var pswd = reqEncHelper.DecryptPassword(Newpwd);
                password = reqEncHelper.EncryptPassword(pswd);
                var oldpswd = reqEncHelper.DecryptPassword(oldPwd);
                var oldpwd = reqEncHelper.EncryptPassword(oldpswd);

                if (CPwd == oldpwd) {
                    DBInstance.InsertFXDB(mPltClient, 'clients', [{
                        'email_id': strUname,
                        'client_password': password,
                        'client_id': Cclient_id
                    }], objLogInfo, function(err) {
                        // mPltClient.execute(CLIENT, [strUname, password, Cclient_id], {
                        //     prepare: true
                        // }, function (err) {
                        try {
                            if (err) {
                                reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10168");
                            } else {
                                finalres = JSON.stringify(finalres);
                                reqLogWriter.EventUpdate(objLogInfo);
                                pResp.send(finalres);
                            }
                        } catch (error) {
                            errorHandler("ERR-FX-10168", "Error PltChangePwd function" + error)
                        }
                    });
                } else {
                    finalres = JSON.stringify("Current password is Wrong");
                    reqLogWriter.EventUpdate(objLogInfo);
                    pResp.send(finalres);
                }

            } catch (error) {
                errorHandler("ERR-FX-10167", "Error PltChangePwd function" + error)
            }
        }
    })

    function errorHandler(errcode, message) {
        console.log(message, errcode);
        reqLogWriter.TraceError(objLogInfo, message, errcode);
    }
});


module.exports = router;