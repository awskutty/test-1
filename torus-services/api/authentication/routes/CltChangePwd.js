var modPath = '../../../../node_modules/'
var reqExpress = require(modPath + 'express');
var reqEncHelper = require('../../../../torus-references/common/crypto/EncryptionInstance');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqRedisInstance = require('../../../../torus-references/instance/RedisInstance');
var reqLoginPageHelper = require('./helper/LoginPageHelper');
var reqDateFormater = require('../../../../torus-references/common/dateconverter/DateFormatter');
var router = reqExpress.Router();
//var reqMoment = require('moment');
// Cassandra initialization
// var mCltClient = reqCasInstance.SessionValues['clt_cas'];

const OLDPWD = 'select login_password,client_id  from users where login_name=?';
const USER = 'INSERT INTO users(login_name,login_password,client_id,u_id) VALUES(?,?,?,?)';
const USERPWDLOG = 'INSERT INTO user_password_log(u_id,new_password,old_password,created_date,created_by) VALUES(?,?,?,?,?)';
// Host the login api
router.post('/CltChangePwd', function (pReq, pResp, pNext) {

    var objLogInfo = reqLogInfo.AssignLogInfoDetailForCP(pReq.body, pReq);
    objLogInfo.PROCESS = 'CltChangePwd-Authentication';
    objLogInfo.ACTION = 'CltChangePwd';
    reqLogWriter.Eventinsert(objLogInfo);

    // Initialize local variables
    pResp.setHeader('Content-Type', 'application/json');
    var strUname = pReq.body.LOGIN_NAME.toUpperCase();
    var CPwd = '';
    var Newpwd = pReq.body.New_pwd;
    var oldPwd = pReq.body.old_pswd;
    var Cclient_id = '';
    var password = '';
    var strSessionid = pReq.body.SESS_ID;
    var strLoginip = pReq.body.LOGIN_IP;
    var userid = pReq.body.USER_ID;
    var SALTKEY = pReq.headers["salt-session"];
    var finalres = 'SUCCESS';

    
    GetCltNewPwd();

    //Get the New password
    function GetCltNewPwd() {
        try {
            reqDBInstance.GetFXDBConnection(pReq.headers, 'clt_cas', objLogInfo, function Callback_GetCassandraConn(mCltClient) {
                var SlatValue;
                reqLoginPageHelper.get_salt_value(SALTKEY, function (Res, err) {
                    if (err) {
                        pResp.send(err);
                    } else {
                        SlatValue = Res.salt;

                        reqDBInstance.GetTableFromFXDB(mCltClient, 'USERS', ['login_password', 'client_id'], {
                            'login_name': strUname
                        }, objLogInfo, function (err, res) {
                            try {
                                if (err) {
                                    reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10059");
                                } else {
                                    for (var i = 0; i < res.rows.length; i++) {
                                        var chpwd = res.rows[0];
                                        CPwd = chpwd.login_password;
                                        Cclient_id = chpwd.client_id;
                                    }
                                    //var pswd = reqEncHelper.DecryptPassword(Newpwd);
                                    password = Newpwd //reqEncHelper.passwordHash256(pswd) //reqEncHelper.EncryptPassword(pswd);
                                    // var oldpswd = oldPwd //reqEncHelper.DecryptPassword(oldPwd);
                                    // var oldpwd = reqEncHelper.passwordHash256Withsalt(oldpswd, SlatValue); //reqEncHelper.EncryptPassword(oldpswd);
                                    var HasedPwd = reqEncHelper.passwordHash256Withsalt(CPwd, SlatValue);
                                    if (HasedPwd == oldPwd) {
                                        //mCltClient.execute(USER, [strUname, password, Cclient_id, userid], {prepare: true}, function (err) {
                                        reqDBInstance.UpdateFXDB(mCltClient, 'USERS', {
                                            'login_password': password
                                        }, {
                                            'client_id': Cclient_id,
                                            'u_id': userid,
                                            'login_name': strUname
                                        }, objLogInfo, function (err) {
                                            // reqDBInstance.InsertFXDB(mCltClient, 'USERS', [{
                                            //     'login_name': strUname,
                                            //     'login_password': password,
                                            //     'client_id': Cclient_id,
                                            //     'u_id': userid
                                            // }], objLogInfo, function(err) {
                                            try {
                                                if (err) {
                                                    reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10059");
                                                } else {
                                                    console.log('Update success');
                                                    //mCltClient.execute(USERPWDLOG, [userid, password, CPwd, new Date(), userid], {prepare: true},function (err) {
                                                    reqDBInstance.InsertFXDB(mCltClient, 'USER_PASSWORD_LOG', [{
                                                        'u_id': userid,
                                                        'new_password': password,
                                                        'old_password': CPwd,
                                                        'created_date': reqDateFormater.GetTenantCurrentDateTime(pReq.headers, objLogInfo),
                                                        'created_by': userid
                                                    }], objLogInfo, function (err) {
                                                        try {
                                                            if (err) {
                                                                reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10059");
                                                            } else {
                                                                console.log('USER_PASSWORD_LOG insert  success');
                                                                reqLogWriter.TraceInfo(objLogInfo, ' DoClientLogoff Success...');
                                                                finalres = JSON.stringify(finalres);
                                                                reqLogWriter.EventUpdate(objLogInfo);
                                                                pResp.send(finalres)
                                                                if (SALTKEY) {
                                                                    reqLoginPageHelper.DeleteSaltSession('CLT Change password', objLogInfo, SALTKEY)
                                                                }
                                                                console.log('Delete continue..........')
                                                                reqDBInstance.DeleteFXDB(mCltClient, 'user_sessions', {
                                                                    'u_id': userid,
                                                                    'login_ip': strLoginip,
                                                                    'session_id': strSessionid
                                                                }, objLogInfo, function callbackClientLogoff(pError) {
                                                                    try {
                                                                        if (pError) {
                                                                            console.log('pError' + pError)
                                                                            reqLogWriter.TraceError(objLogInfo, pError, "ERR-FX-10104");
                                                                        }
                                                                    } catch (error) {
                                                                        errorHandler("ERR-FX-10104", "Error DoClientLogoff function ERR-002 " + error)
                                                                    }
                                                                });

                                                            }
                                                        } catch (error) {
                                                            errorHandler("ERR-FX-10059", "Error CltChangePwd function  " + error)
                                                        }
                                                    });
                                                }
                                            } catch (error) {
                                                errorHandler("ERR-FX-10058", "Error CltChangePwd function  " + error)
                                            }
                                        });
                                    } else {
                                        reqLogWriter.EventUpdate(objLogInfo);
                                        pResp.send(JSON.stringify("Current password is Wrong"));
                                    }
                                }
                            } catch (error) {
                                errorHandler("ERR-FX-10057", "Error CltChangePwd function  " + error)
                            }
                        });
                    }
                })
            });
        } catch (error) {
            errorHandler("ERR-FX-10056", "Error CltChangePwd function  " + error)
        }
    }

    function errorHandler(errcode, message) {
        console.log(message, errcode);
        reqLogWriter.TraceError(objLogInfo, message, errcode);
    }
});

module.exports = router;