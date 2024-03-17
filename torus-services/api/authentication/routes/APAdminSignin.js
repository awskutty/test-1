// Require dependencies
var modPath = '../../../../node_modules/';
var reqExpress = require(modPath + 'express');
var reqEncHelper = require('../../../../torus-references/common/crypto/EncryptionInstance');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqDateFormater = require('../../../../torus-references/common/dateconverter/DateFormatter');
//var reqMoment = require('moment');
// Cassandra initialization
// var mClient = reqCasInstance.SessionValues['plt_cas'];

// Prepare queries
const USERSELECT = 'select * from users where login_name = ?';
const USERSUCLOGINUDT = 'update users set last_successful_login =? where u_id =? and login_name =?';
const USERUNSUCLOGINUDT = 'update users set last_unsuccessful_login =? where u_id =? and login_name =?';
const USRSESSSELECT = 'select login_ip from user_sessions where u_id = ?';
const USRSESSINSERT = 'insert into user_sessions(us_id,u_id,session_id,login_ip,created_by,created_date) values(?,?,?,?,?,?)';

// Initialize Global variables
var objSesionInfo = new SessionInfo();
var strResult = '';
var strMessage = '';
var router = reqExpress.Router();

router.post('/DoAdminSignin', function (pReq, pResp, pNext) {

    var objLogInfo = reqLogInfo.AssignLogInfoDetailForCP(pReq.body, pReq);
    reqLogWriter.Eventinsert(objLogInfo);
    objLogInfo.PROCESS = 'DoAdminSignin-Authentication';
    objLogInfo.ACTION = 'DoAdminSignin';
    try {
        // Initialize local variables
        pResp.setHeader('Content-Type', 'application/json');
        var strSessionId = pReq.body.pUname.toUpperCase() + '-' + Date.now();
        var date = reqDateFormater.GetTenantCurrentDateTime(pReq.headers, objLogInfo);
        var ticks = date.getTime();
        var tmpIp = pReq.connection.remoteAddress;
        tmpIp = tmpIp.split(':');
        var strClientIp = tmpIp[tmpIp.length - 1];
        var strUname = pReq.body.pUname.toUpperCase();
        var strPwd = pReq.body.pPwd;
        var logintrycnt = pReq.body.pLoginTryCount;
        var ldCode = pReq.body.LD_CODE;
        var lang_part = pReq.body.LANG_PART;
        var NEED_DUPLICATE_LOGIN_CHECK = '';
        var intlogintrycount = '';
        var pswdexpalertdays = '';
        var pswdexpirationdays = '';
        var CL_STP_SESSION_TIMEOUT = '';
        console.log('Input Params pUname : %s , strClientIp:%s , pPwd : %s ', strUname, strClientIp, strPwd);
        var decrypted = reqEncHelper.DecryptPassword(strPwd);

        DoAdminSignin();

        function DoAdminSignin() {
            try {
                reqDBInstance.GetFXDBConnection(pReq.headers, 'plt_cas', objLogInfo, function Callback_GetCassandraConn(mClient) {
                    // Get user detail
                    console.log("Entered");
                    reqDBInstance.GetTableFromFXDB(mClient, 'users', [], {
                        'login_name': strUname
                    }, objLogInfo, function (err, result) {
                        // mClient.execute(USERSELECT, [strUname], {
                        //     prepare: true
                        // }, function (err, result) {
                        try {
                            if (err)
                                reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10011");

                            else {
                                if (!err) {
                                    // Check for user found or not
                                    if (result.rows.length > 0) {
                                        var pUser = result.rows[0];
                                        objSesionInfo.U_ID = pUser.u_id;
                                        objSesionInfo.CLIENT_ID = pUser.client_id;
                                        objSesionInfo.LOGIN_NAME = pUser.login_name;
                                        if (pUser.double_authentication != '') {
                                            objSesionInfo.NEED_OTP = pUser.double_authentication;
                                        }
                                        // Check for allocated ip
                                        /*if (user.allocated_ip != '' && user.allocated_ip != strClientIp) {
    strResult = 'FAILURE';
    strMessage = 'Invalid login Ip';
    console.log('Invalid login Ip');
    PrepareResultStr(objSesionInfo, 'ip');
    return;
}*/

                                        // Check for Account Locked
                                        if (pUser.account_locked_date) {
                                            strResult = 'FAILURE';
                                            strMessage = 'User has been Locked . Please contact adminstrator';
                                            reqLogWriter.TraceInfo(objLogInfo, 'User has been Locked . Please contact adminstrator');

                                            PrepareResultStr(objSesionInfo, 'act lock');
                                            return;
                                        }

                                        // Check for INVALID PASSWORD
                                        CheckInvalidPassword(pUser, mClient);

                                    } else {
                                        // Check for INVALID USERNAME
                                        reqLogWriter.TraceInfo(objLogInfo, 'No user found');

                                        strResult = 'FAILURE';
                                        strMessage = 'Invalid username';
                                        PrepareResultStr(objSesionInfo, 'invalid user');
                                        return;
                                    }

                                }
                            }
                        } catch (error) {
                            errorHandler("ERR-FX-10011", "Error APAdminSignin function ERR-004 " + error);
                        }
                    });
                });
            } catch (error) {
                errorHandler("ERR-FX-10010", "Error APAdminSignin function ERR-004 " + error);
            }
        } // End of fn Do_Login

        // Check for Invalid password
        function CheckInvalidPassword(pUser, mClient) {
            try {
                if (pUser.login_password != reqEncHelper.EncryptPassword(decrypted)) {
                    strResult = 'FAILURE';
                    strMessage = 'Invalid password';
                    reqDBInstance.UpdateFXDB(mCltClient, 'USERS', {
                        'last_unsuccessful_login': reqDateFormater.GetTenantCurrentDateTime(pReq.headers, objLogInfo)
                    }, {
                        'u_id': pUser.u_id,
                        'login_name': pUser.login_name
                    }, objLogInfo, function callbackuserlastunsuclogupd(err) {

                        // mClient.execute(USERUNSUCLOGINUDT, [Date.now(), pUser.u_id, pUser.login_name], {
                        //     prepare: true
                        // }, function (err) {
                        if (err)
                            reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10009");


                        else {
                            reqLogWriter.TraceInfo(objLogInfo, 'Invalid password');

                            PrepareResultStr(objSesionInfo, 'invalid pwd');
                            return;
                        }
                    });
                } else {
                    CheckAlreadyLoggedIn(pUser, mClient);
                }
            } catch (error) {
                errorHandler("ERR-FX-10009", "Error APAdminSignin function ERR-004" + error);
            }
        }

        // Check for Already Logged In
        function CheckAlreadyLoggedIn(pUser, mClient) {
            try {
                // //ALREADY LOGGED IN
                // client.execute(strUsrSessSelect, [user.u_id], {
                //     prepare: true
                // }, function (err, result) {

                //     if (err)
                //         console.log('execute failed ' + err.toString());
                //     else {

                // ALREADY LOGGED IN
                /*console.log('NEED_DUPLICATE_LOGIN_CHECK' + NEED_DUPLICATE_LOGIN_CHECK);
if (typeof (NEED_DUPLICATE_LOGIN_CHECK) == 'undefined' || NEED_DUPLICATE_LOGIN_CHECK == null || NEED_DUPLICATE_LOGIN_CHECK == 'Y') {
	for (usrSes = 0; usrSes < result.rows.length - 1; usrSes++) {
		if (result.rows[usrSes].login_ip != strClientIp) {
			strResult = 'Already Logged in';
			strMessage = 'User has already logged in from another system';
			PrepareResultStr(objSesionInfo, 'duplicate login chk');
			return;
		}
	}
}*/
                //LOGIN TRY COUNT
                if (intlogintrycount < logintrycnt) {
                    strResult = 'FAILURE';
                    strMessage = 'User has been Locked . Please contact adminstrator';
                    reqDBInstance.UpdateFXDB(mCltClient, 'USERS', {
                        'last_unsuccessful_login': reqDateFormater.GetTenantCurrentDateTime(pReq.headers, objLogInfo)
                    }, {
                        'u_id': pUser.u_id,
                        'login_name': pUser.login_name
                    }, objLogInfo, function (err) {

                        // mClient.execute(USERUNSUCLOGINUDT, [Date.now(), pUser.u_id, pUser.client_id, pUser.login_name], {
                        //     prepare: true
                        // }, function (err) {
                        try {
                            if (err) {
                                reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10008");


                            } else {
                                PrepareResultStr(objSesionInfo, 'login try cnt');
                                return;
                            }
                        } catch (error) {
                            errorHandler("ERR-FX-10008", "Error APAdminSignin function ERR-004 " + error);
                        }
                    });

                } else {
                    //Success callback
                    reqLogWriter.TraceInfo(objLogInfo, 'SuccessCallback');


                    SuccessCallback(pUser, mClient);
                    return;
                }
            } catch (error) {
                errorHandler("ERR-FX-10007", "Error APAdminSignin function " + error);
            }
        }

        //	}
        //	});



        // Assign session info values for success case
        function SuccessCallback(pUser, mClient) {
            try {
                strResult = 'SUCCESS';
                strMessage = 'SUCCESS';
                objSesionInfo.RESULT_FLAG = 'Y';
                objSesionInfo.USER_NAME = pUser.first_name;
                objSesionInfo.U_ID = pUser.u_id;
                objSesionInfo.LOGIN_NAME = pUser.login_name;
                if (pUser.primary_language != null) {
                    objSesionInfo.USER_LANG_CODE = pUser.primary_language.toString();
                }
                objSesionInfo.SESSION_ID = strSessionId;

                if (CL_STP_SESSION_TIMEOUT != 0)
                    objSesionInfo.SESSION_TIMEOUT = CL_STP_SESSION_TIMEOUT;
                else if (pUser.session_timeout != null)
                    objSesionInfo.SESSION_TIMEOUT = pUser.session_timeout;
                else
                    objSesionInfo.SESSION_TIMEOUT = 0;

                if (pUser.allocated_static_module != null)
                    objSesionInfo.ALLOCATED_STATIC_MODULE = pUser.allocated_static_module;
                else
                    objSesionInfo.ALLOCATED_STATIC_MODULE = '[]';

                if (pUser.last_successful_login != null)
                    objSesionInfo.LAST_SUCCESSFUL_LOGIN = pUser.last_successful_login;
                else
                    objSesionInfo.LAST_SUCCESSFUL_LOGIN = '';


                if (pUser.last_unsuccessful_login != null)
                    objSesionInfo.LAST_UNSUCCESSFUL_LOGIN = pUser.last_unsuccessful_login;
                else
                    objSesionInfo.LAST_UNSUCCESSFUL_LOGIN = '';

                //insert user sessions
                //var params = [reqUuid.v1(), pUser.u_id, strSessionId, strClientIp, pUser.u_id, new Date()];
                // mClient.execute(strUsrSessInsert, params, {
                //     prepare: true,
                //     hints: ['varchar', 'varchar', 'varchar', 'varchar', 'varchar', 'timestamp']
                // }, function (err) {
                //     if (err)
                //         console.log(err.toString());
                //     else if (!err) {
                //insert last successful login
                const USERSUCLOGINUDT = 'update users set last_successful_login =? where u_id =? and login_name =?';
                reqDBInstance.UpdateFXDB(mClient, 'users', {
                    'last_successful_login': reqDateFormater.GetTenantCurrentDateTime(pReq.headers, objLogInfo)
                }, {
                    'u_id': pUser.u_id,
                    'login_name': pUser.login_name
                }, objLogInfo, function (err) {
                    // mClient.execute(USERSUCLOGINUDT, [new Date(), pUser.u_id, pUser.login_name], {
                    //     prepare: true
                    // }, function (err) {
                    if (err)
                        reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10006");


                    else
                        PrepareResultStr(objSesionInfo, 'Success case');
                });

                //     }
                // })
            } catch (error) {
                errorHandler("ERR-FX-10006", "Error APAdminSignin function ERR-004 " + error);
            }
        }

        function PrepareResultStr(Sess_info, pParent) {
            objSesionInfo.LOGIN_RESULT = strResult;
            objSesionInfo.MESSAGE = strMessage;
            objSesionInfo.LOGIN_IP = strClientIp;
            ResultStr = JSON.stringify(Sess_info);
            reqLogWriter.TraceInfo(objLogInfo, 'Result Json' + ResultStr);

            reqLogWriter.EventUpdate(objLogInfo);
            pResp.write(ResultStr);
            pResp.end();
        }
    } catch (error) {
        errorHandler("ERR-FX-10005", "Error APAdminSignin function" + error);
    }

    function errorHandler(errcode, message) {
        console.log(message, errcode);
        reqLogWriter.TraceError(objLogInfo, message, errcode);
    }
});

// Session Class declaration
function SessionInfo() {
    this.LOGIN_RESULT = "";
    this.RESULT_FLAG = "";
    this.USER_NAME = "";
    this.LOGIN_NAME = "";
    this.U_ID = "";
    this.CLIENT_ID = "";
    this.RECORDS_PER_PAGE = 10;
    this.MESSAGE = "";
    this.ENCRYPTION_KEY = "";
    this.USER_LANG_CODE = "";
    this.USER_APPS = [];
    this.SESSION_ID = "";
    this.SESSION_TIMEOUT = "";
    this.USER_LANGUAGES = "";
    this.APPSYS = "";
    this.TEST_VALUE = "";
    this.USER_QUEUE = "";
    this.LOGIN_IP = "";
    this.TARGET = "";
    this.ALL_DESIGNERS = "";
    this.CHAT_PASS = "";
    this.CHAT_ENABLE = "";
    this.DATE_FORMAT = "dd/MM/yyyy";
    this.USER_APP = new DESIGNER();
    this.APP_ID = "";
    this.APP_NAME = "";
    this.APPUSTS_ID = "";
    this.APPU_ID = "";
    this.APP_USER_ROLES = "";
    this.WFT_CODE = "";
    this.APP_STS_ID = "";
    this.STS_ID = "";
    this.S_ID = "";
    this.S_DESC = "";
    this.CLUSTER_CODE = "";
    this.SYSTEM_USER_ROLE = "";
    this.DISCLAIMER_MESSAGE = "";
    this.DISCLAIMER = "";
    this.NEED_WATER_MARKING = "";
    this.SU_ID = "";
    this.RS_DB_INFO = "";
    this.RS_STORAGE_TYPE = "";
    this.CB_SERVICE = "";
    this.CB_HANDLER = "";
    this.ATT_VIEWER = "";
    this.ACCUSOFT_HOST_NAME = "";
    this.NEED_ENCRYPTION = "";
    this.GDPIC_KEY = "";
    this.ATMT_VWR_TYPE = "ACCUSOFT";
    this.NEED_OTP = "";
    this.LAST_SUCCESSFUL_LOGIN = "";
    this.LAST_UNSUCCESSFUL_LOGIN = "";
    this.PASSWORD_POLICY = "";
    this.ALLOCATED_STATIC_MODULE = "";
    this.APPTYPES = "";
    this.DEVICE_TYPES = "";
    this.LANG_DATA = "";
    this.APP_LANG_DATA = "";
    this.API_GATEWAY_SETUP = "";
};


function DESIGNER() {
    this.APP = [];
    this.ROLE_CODE = "";
    this.ROLE_DESCRIPTION = "";
    this.TARGET = "";
    this.RESULT = "";
    this.MESSAGE = "";
};

function API_GATEWAY_SETUP() {
    this.SessionToken = "";
};



module.exports = router;