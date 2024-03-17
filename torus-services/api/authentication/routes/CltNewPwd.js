var modPath = '../../../../node_modules/'
var reqExpress = require(modPath + 'express');
var reqEncHelper = require('../../../../torus-references/common/crypto/EncryptionInstance');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo')
var router = reqExpress.Router();
var reqDateFormater = require('../../../../torus-references/common/dateconverter/DateFormatter');
const OLDPWD = 'select login_password,client_id  from users where login_name=?';
const USER = 'insert into users(login_name,login_password,client_id,u_id) values(?,?,?,?)';
const USERPWDLOG = 'insert into user_password_log(u_id,new_password,old_password,created_date,created_by) values(?,?,?,?,?)';
// Host the login api
router.post('/GetCltNewPwd', function(pReq, pResp, pNext) {

    var objLogInfo = reqLogInfo.AssignLogInfoDetailForCP(pReq.body, pReq);
    objLogInfo.PROCESS = 'GetCltNewPwd-Authentication';
    objLogInfo.ACTION = 'GetCltNewPwd';
    reqLogWriter.Eventinsert(objLogInfo);

    try {
        // Initialize local variables
        pResp.setHeader('Content-Type', 'application/json');
        var strUname = pReq.body.LOGIN_NAME.toUpperCase();
        var CPwd = '';
        var Newpwd = pReq.body.New_pwd;
        var Cclient_id = '';
        var password = '';
        var userid = pReq.body.USER_ID;
        var finalres = 'SUCCESS';
        GetCltNewPwd();

        //Get the New password
        function GetCltNewPwd() {
            //reqCassandraInstance.GetCassandraConn(pReq.headers, 'clt_cas', function Callback_GetCassandraConn(mCltClient) {
            reqDBInstance.GetFXDBConnection(pReq.headers, 'clt_cas', objLogInfo, function Callback_GetCassandraConn(mCltClient) {
                //mCltClient.execute(OLDPWD, [strUname], function(err, res) {
                reqDBInstance.GetTableFromFXDB(mCltClient, 'USERS', ['login_password', 'client_id'], {
                    'login_name': strUname
                }, objLogInfo, function(err, res) {
                    try {
                        if (err) {
                            reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10070");
                        } else {
                            for (var i = 0; i < res.rows.length; i++) {
                                var chpwd = res.rows[0];
                                CPwd = chpwd.login_password;
                                Cclient_id = chpwd.client_id;
                            }
                            var pswd = reqEncHelper.DecryptPassword(Newpwd);
                            password = reqEncHelper.EncryptPassword(pswd);
                            //mCltClient.execute(USER, [strUname, password, Cclient_id, userid], {prepare: true}, function (err) {
                            reqDBInstance.UpdateFXDB(mCltClient, 'USERS', {
                                'login_password': password
                            }, {
                                'login_name': strUname
                            }, objLogInfo, function(err) {
                                // reqDBInstance.InsertFXDB(mCltClient, 'USERS', [{
                                //     'login_name': strUname,
                                //     'login_password': password,
                                //     'client_id': Cclient_id,
                                //     'u_id': userid
                                // }], objLogInfo, function(err) {
                                try {
                                    if (err) {
                                        reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10070");
                                    } else {
                                        //mCltClient.execute(USERPWDLOG, [userid, password, CPwd, new Date(), userid], {prepare: true},function (err) {
                                        reqDBInstance.InsertFXDB(mCltClient, 'USER_PASSWORD_LOG', [{
                                            'u_id': userid,
                                            'new_password': password,
                                            'old_password': CPwd,
                                            'created_date': reqDateFormater.GetTenantCurrentDateTime(pReq.headers, objLogInfo),
                                            'created_by': userid
                                        }], objLogInfo, function(err) {
                                            try {
                                                if (err) {
                                                    reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10070");

                                                } else {
                                                    finalres = JSON.stringify(finalres);
                                                    pResp.write(finalres);
                                                    reqLogWriter.EventUpdate(objLogInfo);
                                                    pResp.end();
                                                }
                                            } catch (error) {
                                                errorHandler("ERR-FX-10070", "Error GetCltNewPwd function ERR-004 " + error)
                                            }
                                        });
                                    }
                                } catch (error) {
                                    errorHandler("ERR-FX-10069", "Error GetCltNewPwd function ERR-004 " + error)
                                }
                            });
                        }
                    } catch (error) {
                        errorHandler("ERR-FX-10068", "Error GetCltNewPwd function ERR-004 " + error)
                    }
                });
            });
        }
    } catch (error) {
        errorHandler("ERR-FX-10067", "Error GetCltNewPwd function ERR-004 " + error)
    }

    function errorHandler(errcode, message) {
        console.log(message, errcode);
        reqLogWriter.TraceError(objLogInfo, message, errcode);
    }
});


module.exports = router;